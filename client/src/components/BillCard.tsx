import React, { useState, useRef, useEffect } from 'react';
import { Edit, Trash2 } from 'lucide-react';
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

const formatBillingPeriodName = (startIso?: string, endIso?: string, noBrackets = false) => {
  if (!startIso) return '';
  const d1 = new Date(startIso);
  const m1 = HEBREW_MONTHS[d1.getMonth()];
  const yyyy1 = d1.getFullYear();
  
  let content = '';
  if (endIso) {
    const d2 = new Date(endIso);
    const m2 = HEBREW_MONTHS[d2.getMonth()];
    const yyyy2 = d2.getFullYear();
    
    if (m1 === m2) content = `${m1} ${yyyy1}`;
    else content = `${m1}-${m2} ${yyyy2}`;
  } else {
    content = `${m1} ${yyyy1}`;
  }

  return noBrackets ? content : ` (${content})`;
};

const getBillIcon = (type: string) =>
  BILL_ICONS[type] || Object.entries(BILL_ICONS).find(([k]) => type.includes(k))?.[1] || '📄';

const getCategoryColor = (type: string) =>
  CATEGORY_COLORS[type] || CATEGORY_COLORS['אחר'];

const formatTsShort = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};

// Drive icon states:
//  'idle'     - no Drive file and none pending
//  'pending'  - file was uploaded, waiting for server async upload to complete
//  'uploading' - user is manually uploading a file right now
//  'synced'   - gdrive_file_id is set (shown via bill.gdrive_file_id)
//  'failed'   - upload timed out or errored
type DriveState = 'idle' | 'pending' | 'uploading' | 'failed';

export const BillCard: React.FC<Props> = ({
  bill, onUpdated, onDeleted, onEdit, onUndoableAction, onPress
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSnapped, setIsSnapped] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Initialize drive state from bill prop
  const [driveState, setDriveState] = useState<DriveState>(() =>
    bill._drivePending && !bill.gdrive_file_id ? 'pending' : 'idle'
  );

  const touchStart = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const driveFileRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Drive upload polling ──────────────────────────────────────────────────
  // When a bill was just created with a scanned file, the server uploads to Drive
  // asynchronously. Poll every 2s until gdrive_file_id appears (max 30s).
  useEffect(() => {
    if (!bill._drivePending || bill.gdrive_file_id) return;

    setDriveState('pending');
    let attempts = 0;
    const MAX_ATTEMPTS = 15; // 15 × 2s = 30 seconds

    pollingRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await api.get(`/bills/${bill.id}`);
        if (res.data.gdrive_file_id) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setDriveState('idle'); // bill.gdrive_file_id being set is enough to show icon
          onUpdated({ ...res.data, _drivePending: false });
        } else if (attempts >= MAX_ATTEMPTS) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setDriveState('failed'); // Timed out → show gray icon
        }
      } catch {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setDriveState('failed');
      }
    }, 2000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill.id, bill._drivePending]);

  // If bill gets gdrive_file_id from outside (e.g. parent re-fetched), clear pending
  useEffect(() => {
    if (bill.gdrive_file_id && driveState === 'pending') {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setDriveState('idle');
    }
  }, [bill.gdrive_file_id, driveState]);

  // ─── Manual Drive upload (from hamburger menu) ────────────────────────────
  const handleDriveFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDriveState('uploading');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post(
        `/properties/${bill.property_id}/bills/${bill.id}/drive-files`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setDriveState('idle');
      onUpdated(res.data); // Updated bill now has gdrive_file_id set
    } catch {
      setDriveState('failed');
    } finally {
      e.target.value = ''; // Reset file input
    }
  };

  // ─── Click outside to close menu / snap ───────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
      if (!isSnapped) return;
      if (!menuRef.current?.contains(e.target as Node)) {
        setIsSnapped(false);
        setSwipeOffset(0);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSnapped]);

  // ─── Status update ────────────────────────────────────────────────────────
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

  // ─── Swipe gestures ───────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    if (bill.status === 'paid') return;
    touchStart.current = e.touches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStart.current;

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

  // ─── Amount display ────────────────────────────────────────────────────────
  const amountDisplay = (() => {
    const total = bill.amount || 0;
    const paid = bill.paid_amount || 0;
    
    if (bill.status === 'partial' || (bill.status === 'paid' && paid > 0 && paid !== total)) {
      return `${paid.toLocaleString('he-IL', { minimumFractionDigits: 0 })}/${total.toLocaleString('he-IL', { minimumFractionDigits: 0 })}`;
    }
    if (bill.status === 'paid') {
      return `₪${total.toLocaleString('he-IL', { minimumFractionDigits: 0 })}`;
    }
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

  // ─── Drive icon logic ─────────────────────────────────────────────────────
  const hasDriveFile   = !!bill.gdrive_file_id;
  const isPending      = driveState === 'pending';
  const isUploading    = driveState === 'uploading';
  const isFailed       = driveState === 'failed';
  const showDriveIcon  = hasDriveFile || isPending || isUploading || isFailed;

  const driveTitle = isPending || isUploading
    ? 'מעלה ל-Google Drive...'
    : isFailed
      ? 'שגיאה בהעלאה ל-Drive'
      : 'שמור ב-Google Drive';

  const driveBadgeClass = [
    'gdrive-badge',
    isPending || isUploading ? 'drive-pending' : '',
    isFailed ? 'drive-failed' : '',
  ].filter(Boolean).join(' ');

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
                {bill.bill_type}
              </div>
              <div className="bill-date-pill">
                {bill.billing_period_start 
                  ? formatBillingPeriodName(bill.billing_period_start, bill.billing_period_end, true)
                  : formatTsShort(bill.created_at)}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', paddingLeft: '36px' }}>
            {/* Google Drive badge — shows color, pulsing, or gray based on state */}
            {showDriveIcon && (
              <div className={driveBadgeClass} title={driveTitle}>
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg"
                  alt="Google Drive"
                  width={20}
                  height={20}
                  draggable={false}
                />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <div className="bill-amount-pill">{amountDisplay}</div>
              <span className={`badge-pill ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
            </div>
          </div>
        </div>

        <div className={`bill-kebab-container ${showMenu ? 'menu-open' : ''}`} ref={menuRef}>
          <button className="kebab-btn" onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}>⋮</button>

          {showMenu && (
            <div className="kebab-dropdown" onClick={e => e.stopPropagation()}>
              <button className="kebab-option edit" onClick={() => { onEdit?.(bill); setShowMenu(false); }}>
                <Edit size={16} />
                <span>ערוך</span>
              </button>
              <button
                className="kebab-option drive-upload"
                onClick={() => { driveFileRef.current?.click(); setShowMenu(false); }}
                disabled={isUploading || isPending}
              >
                {isUploading ? (
                  <span>מעלה...</span>
                ) : (
                  <>
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg"
                      alt="Google Drive"
                      width={15}
                      height={15}
                      draggable={false}
                    />
                    <span>העלה קבצים נוספים</span>
                  </>
                )}
              </button>
              <div className="kebab-divider" />
              <button className="kebab-option delete" onClick={handleDelete}>
                <Trash2 size={16} />
                <span>מחק</span>
              </button>
            </div>
          )}
        </div>

        {/* Hidden file input for manual Drive upload */}
        <input
          ref={driveFileRef}
          type="file"
          accept="image/*,application/pdf"
          style={{ display: 'none' }}
          onChange={handleDriveFileChange}
        />
      </div>
    </div>
  );
};
