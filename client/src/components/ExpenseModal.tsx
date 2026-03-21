import React from 'react';
import type { ExpenseSummary } from '../types';
import { CustomSelect } from './CustomSelect';
import { CATEGORY_COLORS, BILL_ICONS, MONTHS } from '../lib/constants';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import './ExpenseModal.css';

interface Props {
  summary: ExpenseSummary[];
  total: number;
  filterYear: number | null;
  setFilterYear: (year: number | null) => void;
  filterMonth: number | null;  setFilterMonth: (month: number | null) => void;
  availableYears: number[];
  onClose: () => void;
}

export const ExpenseModal: React.FC<Props> = ({ 
  summary, total, filterYear, setFilterYear, filterMonth, setFilterMonth, availableYears, onClose 
}) => {
  const resetFilters = () => { setFilterYear(null); setFilterMonth(null); };

  const summaryLabel = (() => {
    if (!filterYear) return 'הוצאות עד כה';
    const monthName = filterMonth ? MONTHS[filterMonth - 1] : null;
    return monthName ? `הוצאות ${monthName} לשנת ${filterYear}` : `הוצאות לשנת ${filterYear}`;
  })();

  const data = summary.map(item => ({
    name: item.bill_type,
    value: item.total,
    icon: BILL_ICONS[item.bill_type] || '',
    color: CATEGORY_COLORS[item.bill_type] || CATEGORY_COLORS['אחר'],
    percent: (item.total / total) * 100
  }));

  const renderCustomLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, name, value, percent } = props;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6; // Position further out but still on segment
    const x = cx + radius * Math.cos(-RADIAN * midAngle);
    const y = cy + radius * Math.sin(-RADIAN * midAngle);

    // If slice is too small, hide label or move slightly
    if (percent < 0.05) return null;

    const icon = BILL_ICONS[name] || '';

    return (
      <g>
        <text 
          x={x} 
          y={y} 
          fill="white" 
          textAnchor="middle" 
          dominantBaseline="central"
          style={{ fontSize: '13px', fontWeight: 800, textShadow: '0 2px 4px rgba(0,0,0,0.5)', pointerEvents: 'none' }}
        >
          <tspan x={x} dy="-0.6em">{`${icon} ${name}`}</tspan>
          <tspan x={x} dy="1.2em">{`₪${Math.round(value).toLocaleString()}`}</tspan>
        </text>
      </g>
    );
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal expense-modal-content interactive-recharts better-pie">
        <div className="modal-header">
          <h2 className="modal-title">פירוט הוצאות</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="summary-section card" style={{ background: 'var(--bg-input)', border: 'none', marginBottom: 'var(--space-md)' }}>
          <div className="summary-total" style={{ fontSize: '2.4rem' }}>
            ₪{total.toLocaleString('he-IL', { minimumFractionDigits: 1 })}
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

        {summary.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <p>אין נתונים להצגה בתקופה זו</p>
          </div>
        ) : (
          <div className="chart-fullscreen-container recharts-container responsive-pie-full">
            <ResponsiveContainer width="100%" height={500}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius="100%"
                  dataKey="value"
                  labelLine={false}
                  label={renderCustomLabel}
                  animationDuration={800}
                  stroke="#fff"
                  strokeWidth={2}
                  style={{ outline: 'none' }}
                >
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      style={{ cursor: 'normal' }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
