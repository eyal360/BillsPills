import React, { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import { he } from 'date-fns/locale';
import { format } from 'date-fns';
import 'react-day-picker/dist/style.css';
import type { Bill, OcrResult, Property } from '../types';
import api from '../lib/api';
import { CustomSelect } from './CustomSelect';
import './AddBillModal.css';

interface Props {
  propertyId?: string;
  editingBill?: Bill;
  onClose: () => void;
  onAdded: (bill: Bill) => void;
  allProperties?: Property[];
}

const BILL_TYPES = ['חשמל', 'מים', 'גז', 'ארנונה', 'ועד בית', 'אינטרנט', 'טלוויזיה', 'ביטוח', 'אחר'];

export const AddBillModal: React.FC<Props> = ({ propertyId, editingBill, onClose, onAdded, allProperties = [] }) => {
  const [currentPropertyId, setCurrentPropertyId] = useState<string>(propertyId || '');
  const [step, setStep] = useState(1); // 1: Upload/Select, 2: Property Verify (if global), 3: Bill Form

  const [billType, setBillType] = useState(editingBill?.bill_type || '');
  const [amount, setAmount] = useState(editingBill?.amount != null ? String(editingBill.amount) : '');
  const [paidAmount, setPaidAmount] = useState(editingBill?.paid_amount != null ? String(editingBill.paid_amount) : '');
  const [status, setStatus] = useState<'waiting' | 'paid' | 'partial'>(editingBill?.status || 'paid');
  const [extractedData, setExtractedData] = useState<Record<string, unknown>>(editingBill?.extracted_data || {});
  const [recognizedPropertyName, setRecognizedPropertyName] = useState('');

  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    editingBill?.billing_period_start ? {
      from: new Date(editingBill.billing_period_start),
      to: editingBill.billing_period_end ? new Date(editingBill.billing_period_end) : undefined
    } : undefined
  );
  const [showCalendar, setShowCalendar] = useState(false);

  const [ocrLoading, setOcrLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [billTypeError, setBillTypeError] = useState(false);
  const [amountError, setAmountError] = useState(false);
  const [propertyError, setPropertyError] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (editingBill) {
      setBillType(editingBill.bill_type);
      setAmount(String(editingBill.amount || ''));
      setPaidAmount(String(editingBill.paid_amount || ''));
      setStatus(editingBill.status);
      setExtractedData(editingBill.extracted_data || {});
      if (editingBill.billing_period_start) {
        setDateRange({
          from: new Date(editingBill.billing_period_start),
          to: editingBill.billing_period_end ? new Date(editingBill.billing_period_end) : undefined
        });
      }
      setStep(3);
    }
  }, [editingBill]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    };
    if (showCalendar) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showCalendar]);

  const handleOcr = async (file: File) => {
    setOcrLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (allProperties.length > 0) {
        formData.append('properties', JSON.stringify(allProperties));
      }

      const res = await api.post<OcrResult>('/bills/ocr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = res.data;

      setBillType(data.bill_type || '');
      setAmount(data.amount != null ? String(data.amount) : '');
      setExtractedData(data.extracted_data || {});

      if (data.billing_period_start) {
        const start = new Date(data.billing_period_start);
        const end = data.billing_period_end ? new Date(data.billing_period_end) : undefined;
        if (!isNaN(start.getTime())) {
          setDateRange({ from: start, to: (end && !isNaN(end.getTime())) ? end : undefined });
        }
      }

      if (data.matched_property_id) {
        setCurrentPropertyId(data.matched_property_id);
        setRecognizedPropertyName('');
      } else {
        setCurrentPropertyId('');
        const propName = data.extracted_data?.property_name || data.extracted_data?.name;
        if (propName) {
          setRecognizedPropertyName(String(propName));
        } else {
          setRecognizedPropertyName('');
        }
      }

      // If global (no propertyId passed), go to step 2 to confirm property
      if (!propertyId) {
        setStep(2);
      } else {
        setStep(3);
      }
    } catch (err: any) {
      console.error('OCR Error:', err);
      const msg = err.response?.data?.error || 'שגיאה בעיבוד הקובץ — ניתן להזין נתונים ידנית';
      setError(msg);
      if (!propertyId) setStep(2); else setStep(3);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentPropertyId) { setPropertyError(true); return; }

    let hasError = false;
    if (!billType) { setBillTypeError(true); hasError = true; }
    const totalAmount = parseFloat(amount);
    if (!amount || isNaN(totalAmount)) { setAmountError(true); hasError = true; }
    if (hasError) return;

    setLoading(true);
    setError('');

    let finalStatus = status;
    let finalPaidAmount: number | null = null;

    if (status === 'partial') {
      const partialVal = parseFloat(paidAmount) || 0;
      if (partialVal >= totalAmount) {
        finalStatus = 'paid';
        finalPaidAmount = totalAmount;
      } else if (partialVal <= 0) {
        finalStatus = 'waiting';
        finalPaidAmount = null;
      } else {
        finalPaidAmount = partialVal;
      }
    } else if (status === 'paid') {
      finalPaidAmount = totalAmount;
    }

    try {
      const payload = {
        bill_type: billType,
        amount: totalAmount,
        status: finalStatus,
        paid_amount: finalPaidAmount,
        extracted_data: extractedData,
        billing_period_start: dateRange?.from?.toISOString(),
        billing_period_end: dateRange?.to?.toISOString(),
      };

      let res;
      if (editingBill) {
        res = await api.put<Bill>(`/bills/${editingBill.id}`, payload);
      } else {
        res = await api.post<Bill>(`/properties/${currentPropertyId}/bills`, payload);
      }
      onAdded(res.data);
    } catch {
      setError('אירעה שגיאה בשמירת החשבון');
    } finally {
      setLoading(false);
    }
  };

  const formattedRange = dateRange?.from ? (
    dateRange.to ? `${format(dateRange.from, 'dd/MM/yy')} - ${format(dateRange.to, 'dd/MM/yy')}` : format(dateRange.from, 'dd/MM/yy')
  ) : 'בחר תקופת חיוב';

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {step > 1 && !editingBill && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { if (propertyId && step === 3) setStep(1); else setStep(step - 1); }}
                disabled={loading}
                style={{
                  fontSize: '0.85rem',
                  padding: '6px 12px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                חזור
              </button>
            )}
            <h2 className="modal-title">
              {editingBill ? 'עריכת חשבון' : 'הוספת חשבון'}
            </h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="error-alert mb-md">⚠️ {error}</div>}

        {!editingBill && (
          <div className="stepper mb-lg">
            {Array.from({ length: propertyId ? 2 : 3 }, (_, i) => i + 1).map(s => {
              const isActive = propertyId ? (step === 1 ? s === 1 : s === 2) : (step === s);
              return <div key={s} className={`step-dot ${isActive ? 'active' : ''}`} />;
            })}
          </div>
        )}

        {step === 1 ? (
          <div className="step-selection">
            <div className="step-icon">🧾</div>
            <h3 className="text-center">העלה חשבון או הזן ידנית</h3>
            <button className="btn btn-primary btn-full btn-lg" onClick={() => fileRef.current?.click()} disabled={ocrLoading}>
              {ocrLoading ? 'מעבד קובץ...' : 'העלה חשבון'}
            </button>
            <input 
              type="file" 
              ref={fileRef} 
              style={{ display: 'none' }} 
              accept="image/*,application/pdf"
              onChange={e => e.target.files?.[0] && handleOcr(e.target.files[0])} 
            />
            <button className="btn btn-secondary btn-full btn-lg" style={{ marginTop: '12px' }} onClick={() => { if (!propertyId) setStep(2); else setStep(3); }}>הזן נתונים ידנית</button>
          </div>
        ) : step === 2 ? (
          <div className="form-container">
            <h3 className="mb-md">שיוך לנכס</h3>
            <div className="floating-group has-value">
              <CustomSelect
                value={currentPropertyId}
                onChange={val => { setCurrentPropertyId(val); setPropertyError(false); }}
                options={allProperties.map(p => ({ value: p.id, label: p.address ? `${p.name} (${p.address})` : p.name }))}
                placeholder="בחר נכס *"
                error={propertyError}
              />
            </div>
            {recognizedPropertyName && !currentPropertyId && (
              <div className="error-text mt-xs" style={{ color: '#ff4d4d', fontSize: '0.85rem', fontWeight: 600 }}>
                ⚠️ זוהה נכס "{recognizedPropertyName}" אבל הוא לא קיים
              </div>
            )}
            <button className="btn btn-primary btn-full mt-lg" onClick={() => {
              if (!currentPropertyId) {
                setPropertyError(true);
                return;
              }
              setStep(3);
            }}>המשך לפרטי חשבון</button>
          </div>
        ) : (
          <div className="form-container">

            <div className={`floating-group ${billType ? 'has-value' : ''}`}>
              <CustomSelect
                value={billType}
                onChange={val => { setBillType(val); setBillTypeError(false); }}
                options={BILL_TYPES.map(t => ({ value: t, label: t }))}
                placeholder="סוג חשבון *"
                error={billTypeError}
              />
            </div>

            <div className={`floating-group has-value calendar-trigger`} onClick={() => setShowCalendar(true)}>
              <div className="floating-input date-range-display">
                {formattedRange}
              </div>
              <label className="floating-label">תקופת חיוב (אופציונלי)</label>
              <span className="calendar-icon">📅</span>

              {showCalendar && (
                <div className="calendar-overlay">
                  <div className="calendar-popover" ref={calendarRef} onClick={e => e.stopPropagation()}>
                    <DayPicker
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      locale={he}
                      dir="rtl"
                      numberOfMonths={windowWidth > 768 ? 2 : 1}
                      className="custom-rdp"
                    />
                    <div className="calendar-footer">
                      <button className="btn btn-primary btn-sm" onClick={() => setShowCalendar(false)}>אישור</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={`floating-group ${amount ? 'has-value' : ''}`}>
              <input ref={amountRef} type="number" inputMode="decimal" className={`floating-input ${amountError ? 'error' : ''}`} placeholder=" " value={amount} onChange={e => { setAmount(e.target.value); if (amountError) setAmountError(false); }} dir="ltr" style={{ textAlign: 'left' }} />
              <label className="floating-label">סכום חשבון *</label>
            </div>

            <div className="status-toggle-container">
              {(['paid' as const, 'partial' as const, 'waiting' as const]).map(s => (
                <button
                  key={s}
                  className={`status-toggle-btn ${status === s ? 'active' : ''} ${s}`}
                  onClick={() => setStatus(s)}
                >
                  {s === 'paid' ? 'שולם' : s === 'partial' ? 'שילמתי חלק' : 'לא שולם'}
                </button>
              ))}
            </div>

            {status === 'partial' && (
              <div className={`floating-group ${paidAmount ? 'has-value' : ''}`} style={{ marginTop: '8px' }}>
                <input type="number" inputMode="decimal" className="floating-input" placeholder=" " value={paidAmount} onChange={e => setPaidAmount(e.target.value)} dir="ltr" style={{ textAlign: 'left' }} />
                <label className="floating-label">כמה שילמת עד כה? (₪)</label>
              </div>
            )}

            <button className="btn btn-primary btn-full submit-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? <span className="spinner" /> : (editingBill ? 'שמור שינויים' : 'עדכן חשבון')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
