import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import type { Property, Bill, ExpenseSummary } from '../types';
import api from '../lib/api';
import { BillCard } from '../components/BillCard';
import { AddBillModal } from '../components/AddBillModal';
import { ExpenseModal } from '../components/ExpenseModal';
import { CustomSelect } from '../components/CustomSelect';
import { BillTimeline } from '../components/BillTimeline';
import { MONTHS } from '../lib/constants';
import { PieChart } from 'lucide-react';
import './PropertyPage.css';

interface UndoState {
  visible: boolean;
  label: string;
  undoFn: () => Promise<void>;
}

export const PropertyPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddBill, setShowAddBill] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | undefined>();
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [filterMonth, setFilterMonth] = useState<number | null>(null);
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  const [showPartialInput, setShowPartialInput] = useState(false);
  const [partialValue, setPartialValue] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'paid' | 'partial' | 'waiting' | null>(null);

  // Undo Toast state
  const [undoAction, setUndoAction] = useState<UndoState>({ visible: false, label: '', undoFn: async () => { } });
  const undoTimer = useRef<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [propRes, billsRes] = await Promise.all([
          api.get(`/properties/${id}`),
          api.get(`/properties/${id}/bills`),
        ]);
        setProperty(propRes.data);
        setBills(billsRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const filteredBills = useMemo(() => {
    const list = bills.filter(b => {
      if (!b.created_at) return true;
      const d = new Date(b.created_at);
      if (filterYear && d.getFullYear() !== filterYear) return false;
      if (filterMonth && (d.getMonth() + 1) !== filterMonth) return false;
      return true;
    });

    return list.sort((a, b) => {
      const isUnpaidA = a.status === 'waiting' || a.status === 'partial';
      const isUnpaidB = b.status === 'waiting' || b.status === 'partial';
      if (isUnpaidA && !isUnpaidB) return -1;
      if (!isUnpaidA && isUnpaidB) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [bills, filterYear, filterMonth]);

  const totalSpent = useMemo(() =>
    filteredBills.reduce((sum, b) => sum + (b.amount || 0), 0),
    [filteredBills]
  );

  const expenseSummary: ExpenseSummary[] = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filteredBills.forEach(b => {
      if (!map[b.bill_type]) map[b.bill_type] = { total: 0, count: 0 };
      map[b.bill_type].total += b.amount || 0;
      map[b.bill_type].count++;
    });
    return Object.entries(map).map(([bill_type, data]) => ({
      bill_type,
      ...data,
    })).sort((a, b) => b.total - a.total);
  }, [filteredBills]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    bills.forEach(b => b.created_at && years.add(new Date(b.created_at).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [bills]);

  const handleBillUpdated = (updated: Bill) => {
    setBills(prev => prev.map(b => b.id === updated.id ? updated : b));
  };

  const handleUndoableAction = (undoFn: () => Promise<void>, label: string) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoAction({ visible: true, label, undoFn });
    undoTimer.current = setTimeout(() => {
      setUndoAction(prev => ({ ...prev, visible: false }));
    }, 4000);
  };

  const executeUndo = async () => {
    await undoAction.undoFn();
    setUndoAction(prev => ({ ...prev, visible: false }));
  };

  const handleStatusChange = async (bill: Bill, newStatus: 'paid' | 'partial' | 'waiting') => {
    setSelectedStatus(newStatus);
    if (newStatus !== 'partial') setShowPartialInput(false);

    if (newStatus === 'paid') {
      // Small timeout to let the UI reflect the change before confirm() blocks
      setTimeout(async () => {
        if (!window.confirm('האם אתה בטוח שברצונך לסמן את החשבון כשולם במלואו?')) {
          setSelectedStatus(bill.status);
          return;
        }
        
        try {
          const res = await api.put(`/bills/${bill.id}`, {
            ...bill,
            status: 'paid',
            paid_amount: bill.amount || 0
          });
          
          await api.post(`/properties/${id}/bills/${bill.id}/events`, {
            title: 'החשבון שולם',
            note: `סכום: ₪${bill.amount || 0}`
          });

          handleBillUpdated(res.data);
          setShowPartialInput(false);
        } catch (err) {
          console.error(err);
          setSelectedStatus(bill.status);
        }
      }, 50);
    } else if (newStatus === 'partial') {
      setPartialValue(String(bill.paid_amount || ''));
      setShowPartialInput(true);
    } else {
      // waiting status - revert
      try {
        const res = await api.put(`/bills/${bill.id}`, {
          ...bill,
          status: 'waiting',
          paid_amount: 0
        });
        
        handleBillUpdated(res.data);
        setShowPartialInput(false);
      } catch (err) {
        console.error(err);
        setSelectedStatus(bill.status);
      }
    }
  };

  const handleUpdatePartial = async (bill: Bill) => {
    const amountVal = parseFloat(partialValue);
    if (isNaN(amountVal)) return;
    
    try {
      const res = await api.put(`/bills/${bill.id}`, { 
        ...bill, 
        status: 'partial', 
        paid_amount: amountVal 
      });

      // Add timeline event for partial payment
      await api.post(`/properties/${id}/bills/${bill.id}/events`, {
        title: 'שולם חלקית',
        note: `שולם: ₪${amountVal} | נשאר: ₪${((bill.amount || 0) - amountVal).toFixed(1)}`
      });

      handleBillUpdated(res.data);
      setShowPartialInput(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBill = async (billId: string) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק את החשבון?')) return;
    try {
      await api.delete(`/bills/${billId}`);
      setBills(prev => prev.filter(b => b.id !== billId));
      setExpandedBillId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const resetFilters = () => { setFilterYear(null); setFilterMonth(null); };

  const summaryLabel = (() => {
    if (!filterYear) return 'הוצאות עד כה';
    const monthName = filterMonth ? MONTHS[filterMonth - 1] : null;
    return monthName ? `הוצאות ${monthName} לשנת ${filterYear}` : `הוצאות לשנת ${filterYear}`;
  })();

  const toggleExpand = (billId: string) => {
    if (expandedBillId === billId) {
      setExpandedBillId(null);
      setShowPartialInput(false);
      setSelectedStatus(null);
    } else {
      setExpandedBillId(billId);
      setShowPartialInput(false);
      const b = bills.find(x => x.id === billId);
      setSelectedStatus(b?.status || 'waiting');
    }
  };

  if (loading) return (
    <Layout>
      <div className="loading-center" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
        <span>טוען נכס...</span>
      </div>
    </Layout>
  );

  return (
    <Layout title={property?.name || 'נכס'}>
      <div className="page-content">
        <div className="summary-wrapper">
          <div className="summary-section card">
            <div className="summary-total">
              ₪{totalSpent.toLocaleString('he-IL', { minimumFractionDigits: 1 })}
            </div>
            <div className="summary-label">{summaryLabel}</div>
            <div className="time-filter" dir="rtl">
              <CustomSelect
                value={filterYear != null ? String(filterYear) : ''}
                onChange={val => { setFilterYear(val ? Number(val) : null); setFilterMonth(null); }}
                options={availableYears.map(y => ({ value: String(y), label: String(y) }))}
                placeholder="בחר שנה"
              />
              <CustomSelect
                value={filterMonth != null ? String(filterMonth) : ''}
                onChange={val => setFilterMonth(val ? Number(val) : null)}
                options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
                placeholder="בחר חודש"
                disabled={!filterYear}
              />
              {(filterYear || filterMonth) && (
                <button className="btn btn-ghost btn-sm filter-reset-btn" onClick={resetFilters}>✕</button>
              )}
            </div>
          </div>
          <button className="chart-btn" title="סטטיסטיקות" onClick={() => setShowExpenseModal(true)}>
            <PieChart size={32} />
          </button>
        </div>

        <div className="bills-section">
          <div className="bills-header flex justify-center mb-lg">
            <button className="btn btn-primary btn-lg" style={{ minWidth: '200px' }} onClick={() => { setEditingBill(undefined); setShowAddBill(true); }}>
              + חשבון חדש
            </button>
          </div>

          {filteredBills.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📄</div>
              <h3>אין חשבונות עדיין</h3>
            </div>
          ) : (
            <div className="bills-list">
              {expandedBillId && (
                <div className="global-blur-backdrop" onClick={() => setExpandedBillId(null)} />
              )}
              {filteredBills.map((bill, index) => {
                const isUnpaid = bill.status === 'waiting' || bill.status === 'partial';
                const nextBill = filteredBills[index + 1];
                const isNextPaid = nextBill && nextBill.status === 'paid';
                const isExpanded = expandedBillId === bill.id;

                return (
                  <React.Fragment key={bill.id}>
                    {index === 0 && isUnpaid && (
                      <div className="bills-divider" style={{ marginBottom: '24px' }}>
                        <span>נשאר לשלם</span>
                      </div>
                    )}
                    <div className={`bill-container-expandable ${isExpanded ? 'expanded' : ''}`}>
                      <BillCard
                        bill={bill}
                        onUpdated={handleBillUpdated}
                        onDeleted={(id) => handleDeleteBill(id)}
                        onUndoableAction={handleUndoableAction}
                        onEdit={(b) => { setEditingBill(b); setShowAddBill(true); setExpandedBillId(null); setShowPartialInput(false); }}
                        onPress={() => toggleExpand(bill.id)}
                      />
                      {isExpanded && (
                        <div className="bill-expansion-container" onClick={e => e.stopPropagation()}>
                          <div className="bill-actions-row">
                            <div className="status-toggle-container" style={{ flex: 1, marginTop: 0 }}>
                              {(['paid' as const, 'partial' as const, 'waiting' as const]).map(s => (
                                <button
                                  key={s}
                                  className={`status-toggle-btn ${selectedStatus === s ? 'active' : ''} ${s}`}
                                  onClick={() => handleStatusChange(bill, s)}
                                >
                                  {s === 'paid' ? 'שולם' : s === 'partial' ? 'שילמתי חלק' : 'לא שולם'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {showPartialInput && (
                            <div className="partial-input-row">
                              <div className={`floating-group ${partialValue ? 'has-value' : ''}`} style={{ flex: 1, margin: 0 }}>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  className="floating-input"
                                  placeholder=" "
                                  value={partialValue}
                                  onChange={e => setPartialValue(e.target.value)}
                                  dir="rtl"
                                />
                                <label className="floating-label">כמה שילמת עד כה? (₪)</label>
                              </div>
                              <button className="btn btn-primary btn-sm" onClick={() => handleUpdatePartial(bill)}>עדכן</button>
                            </div>
                          )}

                          <BillTimeline billId={bill.id} propertyId={id!} />
                        </div>
                      )}
                    </div>
                    {isUnpaid && isNextPaid && (
                      <div className="bills-divider">
                        <span>שולמו</span>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showAddBill && (
        <AddBillModal
          propertyId={id!}
          editingBill={editingBill}
          onClose={() => setShowAddBill(false)}
          onAdded={(b) => {
            if (editingBill) handleBillUpdated(b);
            else setBills(prev => [b, ...prev]);
            setShowAddBill(false);
          }}
        />
      )}

      {showExpenseModal && (
        <ExpenseModal
          summary={expenseSummary}
          total={totalSpent}
          filterYear={filterYear}
          setFilterYear={setFilterYear}
          filterMonth={filterMonth}
          setFilterMonth={setFilterMonth}
          availableYears={availableYears}
          onClose={() => setShowExpenseModal(false)}
        />
      )}

      {undoAction.visible && (
        <div className="undo-toast">
          <span>{undoAction.label}</span>
          <button onClick={executeUndo}>בטל פעולה</button>
        </div>
      )}
    </Layout>
  );
};
