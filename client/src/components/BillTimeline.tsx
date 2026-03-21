import React, { useEffect, useState } from 'react';
import api from '../lib/api';
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

export const BillTimeline: React.FC<Props> = ({ billId, propertyId }) => {
  const [events, setEvents] = useState<BillEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await api.get(`/properties/${propertyId}/bills/${billId}/events`);
        setEvents(res.data);
      } catch (err) {
        console.error('Failed to fetch events:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [billId, propertyId]);

  if (loading) return (
    <div className="timeline-loading">
      <div className="spinner-sm" />
      <span>טוען היסטוריה...</span>
    </div>
  );

  return (
    <div className="bill-timeline-container" onClick={e => e.stopPropagation()}>
      <div className="timeline-title">היסטוריית חשבון</div>
      
      {events.length === 0 ? (
        <div className="timeline-empty">אין אירועים לתצוגה</div>
      ) : (
        <div className="timeline-list">
          {events.map((event, i) => (
            <div key={event.id} className="timeline-item">
              <div className="timeline-dot-wrapper">
                <div className="timeline-dot" />
                {i < events.length - 1 && <div className="timeline-line" />}
              </div>
              <div className="timeline-content">
                <div className="timeline-header">
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
  );
};
