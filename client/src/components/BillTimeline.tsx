import React, { useEffect, useState } from 'react';
import { Undo2 } from 'lucide-react';
import api from '../lib/api';
import { useDialog } from '../contexts/DialogContext';
import './BillTimeline.css';

interface BillEvent {
  id: string;
  title: string;
  note: string;
  created_at: string;
}

interface Props {
  billId: string;
  propertyId: string;
  refreshKey?: number;
  optimisticEvents?: BillEvent[];
  onFetchSuccess?: () => void;
  onRevert?: () => Promise<void>;
}

const formatTs = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} | ${hh}:${min}`;
};

export const BillTimeline: React.FC<Props> = ({
  billId,
  propertyId,
  refreshKey,
  optimisticEvents = [],
  onFetchSuccess,
  onRevert
}) => {
  const [events, setEvents] = useState<BillEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await api.get(`/properties/${propertyId}/bills/${billId}/events`);
        setEvents(res.data);
        onFetchSuccess?.();
      } catch (err) {
        // failed silently
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [billId, propertyId, refreshKey]);

  const { confirm: showConfirm } = useDialog();

  const handleRevert = async () => {
    if (!onRevert) return;
    const confirmed = await showConfirm({
      title: 'ביטול תנועה אחרונה',
      message: 'האם אתה בטוח שברצונך לבטל את התנועה האחרונה?',
      icon: '🔄',
      actions: [
        { label: 'כן, בטל', type: 'danger' },
        { label: 'ביטול', type: 'ghost' }
      ]
    });

    if (confirmed === 0) {
      try {
        await onRevert();
      } catch (err) {
        console.error('Revert failed:', err);
      }
    }
  };

  if (loading) return (
    <div className="timeline-loading">
      <div className="spinner-sm" />
      <span>טוען היסטוריה...</span>
    </div>
  );

  const fetchedIds = new Set(events.map(e => e.id));
  const filteredOptimistic = optimisticEvents.filter(e => !fetchedIds.has(e.id));

  const allEvents = [...filteredOptimistic, ...events].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="bill-timeline-container" onClick={e => e.stopPropagation()}>
      <div className="timeline-title">היסטוריית חשבון</div>

      <div className="timeline-scroll-content">
        {allEvents.length === 0 ? (
          <div className="timeline-empty">אין אירועים לתצוגה</div>
        ) : (
          <div className="timeline-list">
            {allEvents.map((event, i) => (
              <div key={event.id} className="timeline-item">
                <div className="timeline-dot-wrapper">
                  <div className="timeline-dot" />
                  {i === 0 && allEvents.length > 1 && onRevert && (
                    <button
                      className="revert-btn-timeline"
                      onClick={(e) => { e.stopPropagation(); handleRevert(); }}
                      title="בטל פעולה אחרונה"
                    >
                      <Undo2 size={12} />
                    </button>
                  )}
                  {i < allEvents.length - 1 && <div className="timeline-line" />}
                </div>
                <div className="timeline-content">
                  <div className="timeline-header-stacked">
                    <span className="timeline-event-title">{event.title}</span>
                    <span className="timeline-date">{formatTs(event.created_at)}</span>
                  </div>
                  {event.note && <div className="timeline-note">{event.note}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
