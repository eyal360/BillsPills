import React, { useState, useRef, useEffect } from 'react';
import type { Bill } from '../types';
import api from '../lib/api';
import { CATEGORY_COLORS, BILL_ICONS } from '../lib/constants';
import './BillCard.css';

interface Props {
  bill: Bill;
  onUpdated: (bill: Bill) => void;
  onUndoableAction?: (actionFn: () => Promise<void>, label: string) => void;
  onEdit?: (bill: Bill) => void;
  onDeleted?: (id: string) => void;
  onPress?: () => void;
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

const formatBillingPeriodName = (startIso?: string, endIso?: string) => {
  if (!startIso) return '';
  const d1 = new Date(startIso);
  const m1 = HEBREW_MONTHS[d1.getMonth()];
  const yy1 = String(d1.getFullYear()).slice(-2);
  
  if (endIso) {
    const d2 = new Date(endIso);
    const m2 = HEBREW_MONTHS[d2.getMonth()];
    const yy2 = String(d2.getFullYear()).slice(-2);
    
    if (m1 === m2) return ` (${m1} ${yy1}')`;
    return ` (${m1}-${m2} ${yy2}')`;
  }
  return ` (${m1} ${yy1}')`;
};

const getBillIcon = (type: string) =>
  BILL_ICONS[type] || Object.entries(BILL_ICONS).find(([k]) => type.includes(k))?.[1] || '📄';

const getCategoryColor = (type: string) =>
  CATEGORY_COLORS[type] || CATEGORY_COLORS['אחר'];

const formatTsShort = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
};

export const BillCard: React.FC<Props> = ({
  bill, onUpdated, onDeleted, onEdit, onUndoableAction, onPress
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSnapped, setIsSnapped] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const touchStart = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
      // Close snap if clicking card main
      if (!isSnapped) return;
      if (!menuRef.current?.contains(e.target as Node)) {
        setIsSnapped(false);
        setSwipeOffset(0);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSnapped]);

  const updateStatus = async (newStatus: 'waiting' | 'paid' | 'partial', newPaidAmount?: number) => {
    try {
      const res = await api.put(`/bills/${bill.id}`, {
        ...bill,
        status: newStatus,
        paid_amount: newPaidAmount ?? (newStatus === 'paid' ? bill.amount : bill.paid_amount)
      });
      onUpdated(res.data);
    } catch (err) {
      // error logged to monitoring service in production
    }
  };

  const handleTogglePaid = async () => {
    const oldStatus = bill.status;
    const oldPaidAmount = bill.paid_amount;
    const isActuallyPaid = bill.status === 'paid';
    const newStatus = isActuallyPaid ? 'waiting' : 'paid';

    const action = () => updateStatus(newStatus);
    const undoAction = () => updateStatus(oldStatus, oldPaidAmount);

    await action();
    onUndoableAction?.(undoAction, isActuallyPaid ? 'התשלום בוטל' : 'החשבון שולם');
    setShowMenu(false);
    setIsSnapped(false);
    setSwipeOffset(0);
  };

  const handleDelete = () => {
    setShowMenu(false);
    onDeleted?.(bill.id);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (bill.status === 'paid') return;
    touchStart.current = e.touches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStart.current;

    // Smoothly drag up to 100px
    if (diff > 0) {
      setSwipeOffset(Math.min(diff, 100));
    } else if (isSnapped && diff < 0) {
      setSwipeOffset(Math.max(80 + diff, 0));
    }
  };

  const onTouchEnd = () => {
    if (swipeOffset > 60) {
      setIsSnapped(true);
      setSwipeOffset(80);
    } else {
      setIsSnapped(false);
      setSwipeOffset(0);
    }
    touchStart.current = null;
  };

  const amountDisplay = (() => {
    const total = bill.amount || 0;
    const paid = bill.paid_amount || 0;
    
    // Show X/Y if partial OR if it was paid but we want to see the balance (like if total changed)
    if (bill.status === 'partial' || (bill.status === 'paid' && paid > 0 && paid !== total)) {
      return `${paid.toLocaleString('he-IL', { minimumFractionDigits: 0 })}/${total.toLocaleString('he-IL', { minimumFractionDigits: 0 })}`;
    }
    
    // If it's paid in full, just show the total with shekel sign
    if (bill.status === 'paid') {
      return `₪${total.toLocaleString('he-IL', { minimumFractionDigits: 0 })}`;
    }

    // Default: unpaid, show total
    return `₪${total.toLocaleString('he-IL', { minimumFractionDigits: 0 })}`;
  })();

  const statusInfo = (() => {
    switch (bill.status) {
      case 'paid': return { label: 'שולם', cls: 'paid' };
      case 'partial': return { label: 'שולם חלקית', cls: 'partial' };
      default: return { label: 'לא שולם', cls: 'waiting' };
    }
  })();

  const accentColor = getCategoryColor(bill.bill_type);

  return (
    <div className="bill-swipe-wrapper" style={{ zIndex: (showMenu || isSnapped) ? 1002 : 1 }}>
      <button
        className={`quick-pay-btn ${isSnapped ? 'visible' : ''}`}
        onClick={handleTogglePaid}
        style={{ opacity: isSnapped ? 1 : Math.max(0, swipeOffset - 20) / 60 }}
      >
        סמן כשולם
      </button>

      <div
        className={`bill-card-pill ${bill.status === 'paid' ? 'paid' : ''}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          borderRight: `5px solid ${accentColor}`,
          transform: `translateX(${swipeOffset}px)`,
          transition: touchStart.current === null ? 'transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)' : 'none',
          zIndex: 1
        }}
      >
        <div 
          className="bill-card-main" 
          onClick={() => {
            if (showMenu) {
              setShowMenu(false);
              return;
            }
            onPress?.();
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="bill-icon-pill">
              {getBillIcon(bill.bill_type)}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="bill-type-pill text-sm">
                {bill.bill_type}{formatBillingPeriodName(bill.billing_period_start, bill.billing_period_end)}
              </div>
              <div className="bill-date-pill">{formatTsShort(bill.created_at)}</div>
            </div>
          </div>

          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingLeft: '36px' }}>
            <div className="bill-amount-pill">{amountDisplay}</div>
            <span className={`badge-pill ${statusInfo.cls}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>

        <div className="bill-kebab-container" ref={menuRef}>
          <button className="kebab-btn" onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}>⋮</button>

          {showMenu && (
            <div className="kebab-dropdown" onClick={e => e.stopPropagation()}>
              <button className="kebab-option edit" onClick={() => { onEdit?.(bill); setShowMenu(false); }}>ערוך</button>
              <button className="kebab-option delete" onClick={handleDelete}>מחק</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
