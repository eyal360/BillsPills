import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import type { User } from '../types';
import api from '../lib/api';
import './AdminPage.css';

export const AdminPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<{ totalUsers: number; totalProperties: number; totalBills: number; totalSpent: number; waitingCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/admin/users'),
      api.get('/admin/stats'),
    ]).then(([usersRes, statsRes]) => {
      setUsers(usersRes.data);
      setStats(statsRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Layout showBack title="ניהול">
      <div className="loading-center" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
        <span>טוען נתוני מנהל...</span>
      </div>
    </Layout>
  );

  return (
    <Layout showBack title="לוח בקרה - מנהל">
      <div className="page-content">

        {/* Stats Grid */}
        {stats && (
          <div className="admin-stats-grid">
            {[
              { label: 'משתמשים', value: stats.totalUsers, icon: '👥' },
              { label: 'נכסים', value: stats.totalProperties, icon: '🏠' },
              { label: 'חשבונות', value: stats.totalBills, icon: '📄' },
              { label: 'ממתינים', value: stats.waitingCount, icon: '⏳' },
            ].map(stat => (
              <div key={stat.label} className="stat-card card">
                <div className="stat-icon">{stat.icon}</div>
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label text-xs text-muted">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {stats && (
          <div className="admin-total card">
            <div className="text-sm text-muted">סה"כ הוצאות במערכת</div>
            <div className="admin-total-amount brand-text">
              ₪{stats.totalSpent.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
            </div>
          </div>
        )}

        {/* Users */}
        <h3 className="font-bold mb-md">משתמשים</h3>
        {users.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <p>אין משתמשים במערכת</p>
          </div>
        ) : (
          <div className="users-list">
            {users.map(user => (
              <div
                key={user.id}
                className="user-card card card-interactive"
                onClick={() => navigate(`/admin/user/${user.id}`)}
              >
                <div className="user-card-avatar">
                  {(user.full_name || user.email || 'U')[0].toUpperCase()}
                </div>
                <div className="user-card-info">
                  <div className="font-semibold">{user.full_name || 'ללא שם'}</div>
                  <div className="text-sm text-muted">{user.email}</div>
                </div>
                <div className="user-card-right">
                  <span className={`badge ${user.role === 'admin' ? 'badge-waiting' : 'badge-paid'}`}>
                    {user.role === 'admin' ? '👑 מנהל' : 'משתמש'}
                  </span>
                  <span className="text-muted" style={{ fontSize: '1.2rem' }}>›</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};
