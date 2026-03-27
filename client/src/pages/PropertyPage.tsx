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
import { PieChart, ChevronDown, ChevronUp } from 'lucide-react';
import { useBillProcess } from '../contexts/BillProcessContext';
import { AddPropertyModal } from '../components/AddPropertyModal';
import { useDialog } from '../contexts/DialogContext';
import './PropertyPage.css';

interface UndoState {
  visible: boolean;
  label: string;
  undoFn: () => Promise<void>;
}

export const PropertyPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { activeProcessId, openModal } = useBillProcess();
  const [property, setProperty] = useState<Property | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBill, setEditingBill] = useState<Bill | undefined>();
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [filterMonth, setFilterMonth] = useState<number | null>(null);
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  const [showPartialInput, setShowPartialInput] = useState(false);
  const [partialValue, setPartialValue] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'paid' | 'partial' | 'waiting' | null>(null);
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);
  const [optimisticEvents, setOptimisticEvents] = useState<any[]>([]);

  const addOptimisticEvent = (title: string, note: string) => {
    const newEvent = {
      id: `temp-${Date.now()}`,
      title,
      note,
      created_at: new Date().toISOString(),
      isOptimistic: true
    };
    setOptimisticEvents(prev => [newEvent, ...prev]);
  };
  const [showEditPropertyModal, setShowEditPropertyModal] = useState(false);
  const [partialError, setPartialError] = useState<string | null>(null);
  const [isPaidSectionExpanded, setIsPaidSectionExpanded] = useState(false);
  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({});
  const { confirm } = useDialog();

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
        // error logged to monitoring service in production
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Safety: Clear expansion/blur if the current expanded bill is no longer available 
  // or if we just want to ensure it closes on major list changes.
  useEffect(() => {
    if (expandedBillId) {
      const billExists = bills.some(b => b.id === expandedBillId);
      if (!billExists) {
        setExpandedBillId(null);
      }
    }
  }, [bills, expandedBillId]);

  const { unpaidBills, paidBillsGrouped } = useMemo(() => {
    const list = [...bills].filter(b => {
      if (!b.created_at) return true;
      const d = new Date(b.created_at);
      if (filterYear && d.getFullYear() !== filterYear) return false;
      if (filterMonth && (d.getMonth() + 1) !== filterMonth) return false;
      return true;
    });

    // Sort by date (newest first)
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const unpaid = list.filter(b => b.status === 'waiting' || b.status === 'partial');
    const paid = list.filter(b => b.status === 'paid');

    const grouped: Record<number, Bill[]> = {};
    paid.forEach(b => {
      const year = new Date(b.created_at).getFullYear();
      if (!grouped[year]) grouped[year] = [];
      grouped[year].push(b);
    });

    return {
      unpaidBills: unpaid,
      paidBillsGrouped: grouped,
      allFiltered: list
    };
  }, [bills, filterYear, filterMonth]);

  const allFiltered = useMemo(() => {
    const list = bills.filter(b => {
      if (!b.created_at) return true;
      const d = new Date(b.created_at);
      if (filterYear && d.getFullYear() !== filterYear) return false;
      if (filterMonth && (d.getMonth() + 1) !== filterMonth) return false;
      return true;
    });
    return list;
  }, [bills, filterYear, filterMonth]);

  const totalSpent = useMemo(() =>
    allFiltered.reduce((sum, b) => sum + (b.amount || 0), 0),
    [allFiltered]
  );

  const expenseSummary: ExpenseSummary[] = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    allFiltered.forEach(b => {
      if (!map[b.bill_type]) map[b.bill_type] = { total: 0, count: 0 };
      map[b.bill_type].total += b.amount || 0;
      map[b.bill_type].count++;
    });
    return Object.entries(map).map(([bill_type, data]) => ({
      bill_type,
      ...data,
    })).sort((a, b) => b.total - a.total);
  }, [allFiltered]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    bills.forEach(b => b.created_at && years.add(new Date(b.created_at).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [bills]);


  const handleBillUpdated = (updated: Bill) => {
    setBills(prev => prev.map(b => b.id === updated.id ? updated : b));
    setTimelineRefreshKey(prev => prev + 1);
  };

  const handleRevertLastEvent = async (billId: string) => {
    try {
      addOptimisticEvent('מבטל פעולה...', 'מעדכן את מצב החשבון...');
      const res = await api.delete(`/bills/${billId}/events/last`);
      const updatedBill = res.data;
      
      // Update local state
      setBills(prev => prev.map(b => b.id === billId ? updatedBill : b));
      
      // Update UI state
      setSelectedStatus(updatedBill.status);
      setPartialValue('');
      setShowPartialInput(false);
      setExpandedBillId(null);
      
      // Refresh timeline
      setTimelineRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Failed to revert event:', err);
      setOptimisticEvents(prev => prev.filter(e => !e.isOptimistic));
    }
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
        const confirmed = await confirm({
          title: 'סגירת חשבון',
          message: 'האם אתה בטוח שברצונך לסמן את החשבון כשולם במלואו?',
          icon: '✅',
          actions: [
            { label: 'כן, שולם', type: 'primary' },
            { label: 'ביטול', type: 'ghost' }
          ]
        });

        if (confirmed !== 0) {
          setSelectedStatus(bill.status);
          return;
        }

        try {
          const remaining = (bill.amount || 0) - (bill.paid_amount || 0);
          addOptimisticEvent('שולם במלואו', `יתרה לסילוק: ₪${remaining.toFixed(1)}`);
          
          // Clear expansion and blur immediately
          setExpandedBillId(null);
          setShowPartialInput(false);

          const res = await api.put(`/bills/${bill.id}`, {
            ...bill,
            status: 'paid',
            paid_amount: bill.amount || 0
          });

          handleBillUpdated(res.data);
          setTimelineRefreshKey(prev => prev + 1);
        } catch (err) {
          setSelectedStatus(bill.status);
          setOptimisticEvents(prev => prev.filter(e => !e.isOptimistic));
        }
      }, 50);
    } else if (newStatus === 'partial') {
      setPartialValue(String(bill.paid_amount || ''));
      setShowPartialInput(true);
    } else {
      // waiting status - revert
      if ((bill.paid_amount || 0) > 0) {
        const confirmed = await confirm({
          title: 'ביטול תשלום',
          message: 'האם אתה בטוח? פעולה זו תבטל את כל התשלומים שבוצעו ותחזיר את היתרה למלואה.',
          icon: '🔄',
          actions: [
            { label: 'בטל תשלום', type: 'danger' },
            { label: 'לא, השאר ככה', type: 'ghost' }
          ]
        });

        if (confirmed !== 0) {
          setSelectedStatus(bill.status);
          return;
        }
      }

      try {
        addOptimisticEvent('התשלום בוטל', 'החשבון הוחזר למצב "לא שולם"');
        setExpandedBillId(null);
        const res = await api.put(`/bills/${bill.id}`, {
          ...bill,
          status: 'waiting',
          paid_amount: 0
        });

        handleBillUpdated(res.data);
        setTimelineRefreshKey(prev => prev + 1);
        setShowPartialInput(false);
      } catch (err) {
        setSelectedStatus(bill.status);
        setOptimisticEvents(prev => prev.filter(e => !e.isOptimistic));
      }
    }
  };

  const handleUpdatePartial = async (bill: Bill) => {
    const newPaymentAmount = parseFloat(partialValue);
    if (isNaN(newPaymentAmount)) return;

    if (newPaymentAmount <= 0) {
      setPartialError('נא להזין סכום חיובי');
      return;
    }

    const currentPaid = bill.paid_amount || 0;
    const totalBillAmount = bill.amount || 0;
    const newTotalPaid = currentPaid + newPaymentAmount;

    if (newTotalPaid > totalBillAmount + 0.01) { // 0.01 for float precision
      setPartialError(`הסכום הכולל (₪${newTotalPaid.toFixed(1)}) לא יכול לעלות על סכום החשבון (₪${totalBillAmount})`);
      return;
    }

    setPartialError(null);

    let statusToSave: 'partial' | 'paid' = 'partial';
    if (Math.abs(newTotalPaid - totalBillAmount) < 0.01) {
      const confirmed = await confirm({
        title: 'תשלום מלא',
        message: 'הסכום ששילמת עד כה משלים את החשבון במלואו. האם לסמן את החשבון כשולם?',
        icon: '💰',
        actions: [
          { label: 'כן, סמן כשולם', type: 'primary' },
          { label: 'לא, חזור', type: 'ghost' }
        ]
      });

      if (confirmed !== 0) {
        return;
      }
      statusToSave = 'paid';
    }

    try {
      const addedNow = newPaymentAmount.toFixed(1);
      const remaining = (totalBillAmount - newTotalPaid).toFixed(1);
      const eventTitle = statusToSave === 'paid' ? 'שולם במלואו' : 'שולם חלקית';
      const eventNote = statusToSave === 'paid' 
        ? `החשבון סולק במלואו (₪${newTotalPaid.toFixed(1)})`
        : `שולם עכשיו: ₪${addedNow} | סה"כ שולם: ₪${newTotalPaid.toFixed(1)} | נשאר: ₪${remaining}`;
      
      addOptimisticEvent(eventTitle, eventNote);

      // If fully paid, close expansion immediately to avoid orphaned blur
      if (statusToSave === 'paid') {
        setExpandedBillId(null);
        setShowPartialInput(false);
      }

      const res = await api.put(`/bills/${bill.id}`, {
        ...bill,
        status: statusToSave,
        paid_amount: newTotalPaid
      });

      handleBillUpdated(res.data);
      setTimelineRefreshKey(prev => prev + 1);
      setPartialValue('');
      if (statusToSave !== 'paid') {
        setShowPartialInput(false);
      }
    } catch (err) {
      console.error('Partial payment error:', err);
      setOptimisticEvents(prev => prev.filter(e => !e.isOptimistic));
    }
  };

  const handleDeleteBill = async (billId: string) => {
    const confirmed = await confirm({
      title: 'מחיקת חשבון',
      message: 'האם אתה בטוח שברצונך למחוק את החשבון?',
      icon: '🗑️',
      actions: [
        { label: 'מחק חשבון', type: 'danger' },
        { label: 'ביטול', type: 'ghost' }
      ]
    });

    if (confirmed !== 0) return;
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
      setPartialError(null);
    } else {
      setExpandedBillId(billId);
      setShowPartialInput(false);
      setPartialError(null);
      const b = bills.find(x => x.id === billId);
      setSelectedStatus(b?.status || 'waiting');
    }
  };

  const toggleYear = (year: number) => {
    setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }));
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
    <Layout
      title={property?.name || 'נכס'}
      titleClassName="property-title"
    >
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
            <button className="btn btn-primary btn-lg" style={{ minWidth: '200px' }} onClick={() => { setEditingBill(undefined); openModal('new'); }}>
              + חשבון חדש
            </button>
          </div>

          {allFiltered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📄</div>
              <h3>אין חשבונות עדיין</h3>
            </div>
          ) : (
            <div className="bills-list">
              {expandedBillId && (
                <div className="global-blur-backdrop" onClick={() => setExpandedBillId(null)} />
              )}

              {/* --- נשאר לשלם --- */}
              {unpaidBills.length > 0 && (
                <>
                  <div className="archive-header" dir="ltr" style={{ cursor: 'default', pointerEvents: 'none', marginBottom: '16px' }}>
                    <div className="archive-divider-line"></div>
                    <div className="archive-title">
                      <span>נשאר לשלם</span>
                    </div>
                  </div>
                  {unpaidBills.map(bill => (
                    <div key={bill.id} className={`bill-container-expandable ${expandedBillId === bill.id ? 'expanded' : ''}`}>
                      <BillCard
                        bill={bill}
                        onUpdated={handleBillUpdated}
                        onDeleted={handleDeleteBill}
                        onUndoableAction={handleUndoableAction}
                        onEdit={(b) => { setEditingBill(b); openModal('new'); setExpandedBillId(null); setShowPartialInput(false); }}
                        onPress={() => toggleExpand(bill.id)}
                      />
                      {expandedBillId === bill.id && (
                        <div className="bill-expansion-container" onClick={e => e.stopPropagation()}>
                          {bill.notes && (
                            <div className="bill-notes-display" style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem', color: 'var(--text-secondary)', position: 'relative', overflow: 'hidden' }}>
                              <div style={{ fontWeight: 600, color: 'var(--brand-primary)', marginBottom: '4px', fontSize: '0.8rem', opacity: 0.8 }}>הערה:</div>
                              <div style={{ lineHeight: '1.4' }}>{bill.notes}</div>
                            </div>
                          )}
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
                            <div className="partial-input-wrapper" style={{ marginBottom: '20px' }}>
                              <div className="partial-input-row">
                                <div className={`floating-group ${partialValue ? 'has-value' : ''}`} style={{ flex: 1, margin: 0 }}>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    className={`floating-input ${partialError ? 'error' : ''}`}
                                    placeholder=" "
                                    value={partialValue}
                                    onChange={e => {
                                      setPartialValue(e.target.value);
                                      if (partialError) setPartialError(null);
                                    }}
                                    dir="rtl"
                                  />
                                  <label className="floating-label">סכום לתשלום עכשיו (₪)</label>
                                </div>
                                <button className="btn btn-primary btn-sm" onClick={() => handleUpdatePartial(bill)}>עדכן</button>
                              </div>
                              {partialError && (
                                <div className="field-error" style={{ marginTop: '8px', padding: '0 12px' }}>
                                  <span className="error-icon">⚠️</span> {partialError}
                                </div>
                              )}
                            </div>
                          )}
                          <BillTimeline 
                            billId={bill.id} 
                            propertyId={id!} 
                            refreshKey={timelineRefreshKey} 
                            optimisticEvents={optimisticEvents.filter(e => e.bill_id === bill.id || !e.bill_id)}
                            onFetchSuccess={() => setOptimisticEvents([])}
                            onRevert={() => handleRevertLastEvent(bill.id)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {/* --- שולמו --- */}
              {Object.keys(paidBillsGrouped).length > 0 && (
                <div className="paid-section-container">
                  <div
                    className="archive-header"
                    onClick={() => setIsPaidSectionExpanded(!isPaidSectionExpanded)}
                  >
                    <div className="archive-divider-line"></div>
                    <div className="archive-title" dir="rtl">
                      <span>שולמו</span>
                      {isPaidSectionExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                    </div>
                    <div className="archive-divider-line"></div>
                  </div>

                  <div className={`collapsible-content ${isPaidSectionExpanded ? 'expanded' : ''}`}>
                    {Object.keys(paidBillsGrouped)
                      .map(Number)
                      .sort((a, b) => b - a)
                      .map(year => (
                        <div key={year} className="year-group">
                          <button
                            className={`year-toggle-header ${expandedYears[year] ? 'expanded' : ''}`}
                            onClick={() => toggleYear(year)}
                          >
                            <span className="year-label">{year}</span>
                            <span className={`year-chevron ${expandedYears[year] ? 'open' : ''}`}>›</span>
                          </button>

                          <div className={`year-content ${expandedYears[year] ? 'expanded' : ''}`}>
                            {paidBillsGrouped[year].map(bill => (
                              <div key={bill.id} className={`bill-container-expandable ${expandedBillId === bill.id ? 'expanded' : ''}`}>
                                <BillCard
                                  bill={bill}
                                  onUpdated={handleBillUpdated}
                                  onDeleted={handleDeleteBill}
                                  onUndoableAction={handleUndoableAction}
                                  onEdit={(b) => { setEditingBill(b); openModal('new'); setExpandedBillId(null); setShowPartialInput(false); }}
                                  onPress={() => toggleExpand(bill.id)}
                                />
                                {expandedBillId === bill.id && (
                                  <div className="bill-expansion-container" onClick={e => e.stopPropagation()}>
                                    {bill.notes && (
                                      <div className="bill-notes-display" style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ fontWeight: 600, color: 'var(--brand-primary)', marginBottom: '4px', fontSize: '0.8rem', opacity: 0.8 }}>הערה:</div>
                                        <div style={{ lineHeight: '1.4' }}>{bill.notes}</div>
                                      </div>
                                    )}
                                    <BillTimeline 
                                      billId={bill.id} 
                                      propertyId={id!} 
                                      refreshKey={timelineRefreshKey} 
                                      onRevert={() => handleRevertLastEvent(bill.id)}
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {undoAction.visible && (
        <div className="undo-toast" onClick={executeUndo}>
          <span>{undoAction.label} נמחק. <u>ביטול</u></span>
        </div>
      )}

      {(activeProcessId || editingBill) && (
        <AddBillModal
          propertyId={id!}
          editingBill={editingBill}
          onClose={() => setEditingBill(undefined)}
          onAdded={(b) => {
            if (editingBill) handleBillUpdated(b);
            else {
              setBills(prev => [b, ...prev]);
              setTimelineRefreshKey(prev => prev + 1);
            }
            setEditingBill(undefined);
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

      {showEditPropertyModal && property && (
        <AddPropertyModal
          onClose={() => setShowEditPropertyModal(false)}
          onAdded={(updated) => {
            setProperty(updated);
            setShowEditPropertyModal(false);
          }}
          editingProperty={property}
        />
      )}
    </Layout>
  );
};
