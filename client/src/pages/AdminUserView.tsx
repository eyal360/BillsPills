import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import type { Property } from '../types';
import api from '../lib/api';

export const AdminUserView: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get(`/admin/users/${userId}/properties`)
      .then(res => setProperties(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const PROPERTY_EMOJIS = ['🏠', '🏢', '🏗️', '🏬', '🏰', '🏡'];

  if (loading) return (
    <Layout showBack title="נכסי משתמש">
      <div className="loading-center" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    </Layout>
  );

  return (
    <Layout showBack title="נכסי משתמש">
      <div className="page-content">
        <div className="admin-view-notice card mb-lg" style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)' }}>
          <span style={{ fontSize: '1.2rem' }}>👁️</span>
          <span className="text-sm">צפייה בנתוני המשתמש (לקריאה בלבד)</span>
        </div>

        {properties.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏠</div>
            <p>אין נכסים למשתמש זה</p>
          </div>
        ) : (
          <div className="properties-grid">
            {properties.map((prop, idx) => (
              <div
                key={prop.id}
                className="property-card card card-interactive"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 'var(--space-lg) var(--space-md)', minHeight: 140, justifyContent: 'center', gap: 'var(--space-sm)', position: 'relative' }}
                onClick={() => navigate(`/admin/user/${userId}/property/${prop.id}`)}
              >
                <div style={{ fontSize: '2.2rem' }}>{PROPERTY_EMOJIS[idx % PROPERTY_EMOJIS.length]}</div>
                <div className="font-bold text-sm">{prop.name}</div>
                {prop.address && <div className="text-xs text-muted">{prop.address}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};
