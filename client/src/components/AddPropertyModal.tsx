import React, { useState, useRef } from 'react';
import type { Property } from '../types';
import api from '../lib/api';
import './AddPropertyModal.css';

interface Props {
  onClose: () => void;
  onAdded: (property: Property) => void;
}

type Step = 1 | 2;

export const AddPropertyModal: React.FC<Props> = ({ onClose, onAdded }) => {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🏢');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);

  const PROPERTY_EMOJIS = ['🏠', '🏢', '🏗️', '🏬', '🏰', '🏡', '🏦', '🏪', '🏝️', '🏕️', '🏟️', '🏘️'];

  const handleNext = () => {
    if (step === 1 && !name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setError('');
    setStep(2);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/properties', {
        name: name.trim(),
        address: address.trim(),
        description: description.trim(),
        icon
      });
      onAdded(res.data);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'אירעה שגיאה בשמירת הנכס';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {step > 1 && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setStep(1)}
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
            <h2 className="modal-title">הוספת נכס חדש</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Stepper */}
        <div className="stepper">
          {[1, 2].map(s => (
            <div key={s} className={`step-dot ${step === s ? 'active' : ''}`} />
          ))}
        </div>

        {error && <div className="error-alert mb-md">⚠️ {error}</div>}

        {step === 1 && (
          <div className="step-content">
            <h3 className="text-center mb-lg">הזן את פרטי הנכס</h3>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div className="icon-selector-wrapper">
                <select
                  className="icon-selector"
                  value={icon}
                  onChange={e => setIcon(e.target.value)}
                  aria-label="בחר אייקון"
                >
                  {PROPERTY_EMOJIS.map(emoji => (
                    <option key={emoji} value={emoji}>{emoji}</option>
                  ))}
                </select>
                <div className="icon-selector-arrow">▼</div>
              </div>

              <div className={`floating-group ${name ? 'has-value' : ''}`} style={{ flex: 1, marginTop: 0 }}>
                <input
                  id="prop-name"
                  ref={nameRef}
                  className={`floating-input ${nameError ? 'error' : ''}`}
                  placeholder=" "
                  value={name}
                  onChange={e => {
                    setName(e.target.value);
                    if (nameError) setNameError(false);
                  }}
                  onFocus={() => {
                    if (nameError) setNameError(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addressRef.current?.focus();
                    }
                  }}
                  autoFocus
                />
                <label className="floating-label" htmlFor="prop-name">שם הנכס *</label>
                {nameError && (
                  <div className="field-error">
                    <span className="error-icon">⚠️</span> שם הנכס הוא שדה חובה
                  </div>
                )}
              </div>
            </div>

            <div className="floating-group">
              <input
                id="prop-address"
                ref={addressRef}
                className="floating-input"
                placeholder=" "
                value={address}
                onChange={e => setAddress(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    descRef.current?.focus();
                  }
                }}
              />
              <label className="floating-label" htmlFor="prop-address">כתובת (אופציונלי)</label>
            </div>

            <div className="floating-group">
              <input
                id="prop-desc"
                ref={descRef}
                className="floating-input"
                placeholder=" "
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleNext();
                  }
                }}
              />
              <label className="floating-label" htmlFor="prop-desc">תיאור (אופציונלי)</label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="step-content">
            <div className="step-icon">✅</div>
            <h3 className="text-center mb-lg">אישור פרטים</h3>
            <div className="confirm-card card">
              <div className="confirm-row">
                <span className="text-muted text-sm">אייקון:</span>
                <span style={{ fontSize: '1.5rem' }}>{icon}</span>
              </div>
              <div className="confirm-row">
                <span className="text-muted text-sm">שם:</span>
                <span className="font-semibold">{name}</span>
              </div>
              {address && (
                <div className="confirm-row">
                  <span className="text-muted text-sm">כתובת:</span>
                  <span>{address}</span>
                </div>
              )}
              {description && (
                <div className="confirm-row">
                  <span className="text-muted text-sm">תיאור:</span>
                  <span>{description}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="modal-actions">
          {step < 2 ? (
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleNext}>
              הבא ›
            </button>
          ) : (
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'עדכן נכס'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
