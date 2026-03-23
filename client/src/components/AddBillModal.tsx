import React, { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { DatePicker, ConfigProvider } from 'antd-mobile';

const heIL = {
  locale: 'he',
  common: {
    confirm: 'אישור',
    cancel: 'ביטול',
    loading: 'טוען',
    close: 'סגור'
  },
  DatePicker: {
    tillNow: 'עכשיו'
  },
  Mask: {
    name: 'מסכה'
  },
  Modal: {
    ok: 'אישור'
  },
  Dialog: {
    ok: 'אישור'
  },
  Calendar: {
    title: 'בחירת תאריך',
    confirm: 'אישור',
    start: 'התחלה',
    end: 'סיום',
    startAndEnd: 'התחלה/סיום',
    today: 'היום',
    markItems: ['ב', 'ג', 'ד', 'ה', 'ו', 'ש', 'א'],
    yearAndMonth: '${year} ${month}'
  },
  Input: {
    clear: 'נקה'
  },
  SearchBar: {
    name: 'חיפוש'
  },
  Stepper: {
    decrease: 'הפחת',
    increase: 'הגדל'
  },
  Switch: {
    name: 'מתג'
  },
  Selector: {
    name: 'בחירה'
  }
} as any;
import type { Bill, OcrResult, Property } from '../types';
import api from '../lib/api';
import { CustomSelect } from './CustomSelect';
import { BILL_TYPES, APP_MESSAGES, BILL_STATUSES } from '../lib/constants';
import { PillLoader } from './PillLoader';
import './AddBillModal.css';

interface Props {
  propertyId?: string;
  editingBill?: Bill;
  onClose: () => void;
  onAdded: (bill: Bill) => void;
  allProperties?: Property[];
}

export const AddBillModal: React.FC<Props> = ({ propertyId, editingBill, onClose, onAdded, allProperties = [] }) => {
  const [currentPropertyId, setCurrentPropertyId] = useState<string>(propertyId || '');
  const [step, setStep] = useState(1); // 1: Upload/Select, 2: Property Verify (if global), 3: Bill Form

  const [billType, setBillType] = useState(editingBill?.bill_type || '');
  const [amount, setAmount] = useState(editingBill?.amount != null ? String(editingBill.amount) : '');
  const [paidAmount, setPaidAmount] = useState(editingBill?.paid_amount != null ? String(editingBill.paid_amount) : '');
  const [status, setStatus] = useState<'waiting' | 'paid' | 'partial'>(editingBill?.status || 'paid');
  const [extractedData, setExtractedData] = useState<Record<string, unknown>>(editingBill?.extracted_data || {});
  const [recognizedPropertyName, setRecognizedPropertyName] = useState('');

  const [startDate, setStartDate] = useState<Date | null>(editingBill?.billing_period_start ? new Date(editingBill.billing_period_start) : null);
  const [endDate, setEndDate] = useState<Date | null>(editingBill?.billing_period_end ? new Date(editingBill.billing_period_end) : null);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [ocrLoading, setOcrLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [billTypeError, setBillTypeError] = useState(false);
  const [amountError, setAmountError] = useState(false);
  const [propertyError, setPropertyError] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Handle OCR initialization if file is passed (e.g. from camera/gallery)
    // but here we usually wait for user interaction
  }, []);

  useEffect(() => {
    if (editingBill) {
      setBillType(editingBill.bill_type);
      setAmount(String(editingBill.amount || ''));
      setPaidAmount(String(editingBill.paid_amount || ''));
      setStatus(editingBill.status);
      setExtractedData(editingBill.extracted_data || {});
      if (editingBill.billing_period_start) {
        setStartDate(new Date(editingBill.billing_period_start));
        setEndDate(editingBill.billing_period_end ? new Date(editingBill.billing_period_end) : null);
      }
      setStep(3);
    }
  }, [editingBill]);

  // Date helpers
  const handleStartDateSelect = (val: Date) => {
    setStartDate(val);
    setShowStartPicker(false);
  };

  const handleEndDateSelect = (val: Date) => {
    setEndDate(val);
    setShowEndPicker(false);
  };

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
          setStartDate(start);
          setEndDate((end && !isNaN(end.getTime())) ? end : null);
        }
      }

      if (data.matched_property_id) {
        setCurrentPropertyId(data.matched_property_id);
        setRecognizedPropertyName('');
      } else {
        setCurrentPropertyId('');
        const propName = data.recognized_property_name || data.extracted_data?.recognized_property_name || data.extracted_data?.property_name || data.extracted_data?.name;
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
      // ocr error handled by UI state
      const msg = err.response?.data?.error || APP_MESSAGES.OCR_GENERIC_ERROR;
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
        finalStatus = BILL_STATUSES.PAID;
        finalPaidAmount = totalAmount;
      } else if (partialVal <= 0) {
        finalStatus = BILL_STATUSES.WAITING;
        finalPaidAmount = null;
      } else {
        finalPaidAmount = partialVal;
      }
    } else if (status === 'paid') {
      finalPaidAmount = totalAmount;
    }

    if (editingBill) {
      const oldAmount = editingBill.amount || 0;
      const currentPaid = editingBill.paid_amount || 0;
      
      if (totalAmount !== oldAmount) {
        if (editingBill.status === 'paid' && totalAmount > oldAmount) {
          finalStatus = 'partial';
          finalPaidAmount = oldAmount;
        } else if (editingBill.status === 'partial') {
          if (currentPaid >= totalAmount) {
            finalStatus = BILL_STATUSES.PAID;
            finalPaidAmount = totalAmount;
          } else {
            finalStatus = 'partial';
            finalPaidAmount = currentPaid;
          }
        }
      } else {
        finalStatus = editingBill.status;
        finalPaidAmount = editingBill.paid_amount || 0;
      }
    }

    try {
      const payload = {
        bill_type: billType,
        amount: totalAmount,
        status: finalStatus,
        paid_amount: finalPaidAmount,
        extracted_data: extractedData,
        billing_period_start: startDate?.toISOString(),
        billing_period_end: endDate?.toISOString(),
      };

      let res;
      if (editingBill) {
        res = await api.put<Bill>(`/bills/${editingBill.id}`, payload);
        
        // Add generic event if total amount changed
        if (editingBill.amount !== totalAmount) {
          await api.post(`/properties/${currentPropertyId}/bills/${editingBill.id}/events`, {
            title: 'סכום החשבון עודכן',
            note: `מ-₪${editingBill.amount || 0} ל-₪${totalAmount}`
          });
        }
      } else {
        res = await api.post<Bill>(`/properties/${currentPropertyId}/bills`, payload);
      }
      onAdded(res.data);
    } catch (err: any) {
      console.error('Save bill error:', err);
      setError(err.response?.data?.error || 'אירעה שגיאה בשמירת החשבון');
    } finally {
      setLoading(false);
    }
  };

  const startDateDisplay = startDate ? format(startDate, 'dd/MM/yy') : 'תאריך התחלה';
  const endDateDisplay = endDate ? format(endDate, 'dd/MM/yy') : 'תאריך סיום';

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
            <div className="step-icon" style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              {ocrLoading ? (
                <PillLoader demo={true} hideLabel={true} />
              ) : (
                <span style={{ fontSize: '4.5rem' }}>🧾</span>
              )}
            </div>
            <h3 className="text-center">{ocrLoading ? 'מנתח את החשבון...' : 'העלה חשבון או הזן ידנית'}</h3>
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

            <div className="date-range-row">
              <div className="date-box" onClick={() => setShowStartPicker(true)}>
                <span className="date-label">מתאריך</span>
                <span className={`date-value ${!startDate ? 'muted' : ''}`}>{startDateDisplay}</span>
              </div>
              <div className="date-arrow">←</div>
              <div className="date-box" onClick={() => setShowEndPicker(true)}>
                <span className="date-label">עד תאריך</span>
                <span className={`date-value ${!endDate ? 'muted' : ''}`}>{endDateDisplay}</span>
              </div>

              <ConfigProvider locale={heIL}>
                <DatePicker
                  visible={showStartPicker}
                  onClose={() => setShowStartPicker(false)}
                  onConfirm={handleStartDateSelect}
                  value={startDate || new Date()}
                  title="תאריך התחלה"
                />
                <DatePicker
                  visible={showEndPicker}
                  onClose={() => setShowEndPicker(false)}
                  onConfirm={handleEndDateSelect}
                  value={endDate || startDate || new Date()}
                  title="תאריך סיום"
                  min={startDate || undefined}
                />
              </ConfigProvider>
            </div>

            <div className={`floating-group ${amount ? 'has-value' : ''}`}>
              <input ref={amountRef} type="number" inputMode="decimal" className={`floating-input ${amountError ? 'error' : ''}`} placeholder=" " value={amount} onChange={e => { setAmount(e.target.value); if (amountError) setAmountError(false); }} dir="rtl" style={{ textAlign: 'right' }} />
              <label className="floating-label">סכום חשבון *</label>
            </div>

            {!editingBill && (
              <>
                <div className="status-toggle-container">
                  {([BILL_STATUSES.PAID, BILL_STATUSES.PARTIAL, BILL_STATUSES.WAITING]).map(s => (
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
              </>
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
