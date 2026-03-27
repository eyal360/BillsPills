import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Share2, AlertCircle, CheckCircle, Info, AlertTriangle, XCircle } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import './SharePropertyModal.css';

interface Props {
  propertyId: string;
  propertyName: string;
  onClose: () => void;
}

interface Share {
  id: string;
  email: string;
}

export const SharePropertyModal: React.FC<Props> = ({ propertyId, propertyName, onClose }) => {
  const [emailInput, setEmailInput] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [inputError, setInputError] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchShares();
  }, [propertyId]);

  const fetchShares = async () => {
    try {
      setFetching(true);
      const res = await api.get(`/properties/${propertyId}/shares`);
      const sharedEmails = res.data.map((s: Share) => s.email);
      console.log('Fetched shares for property:', { propertyId, sharedEmails, raw: res.data });
      setEmails(sharedEmails);
    } catch (err: any) {
      console.error('Failed to fetch shares:', err);
      showToast('אירעה שגיאה בטעינת המידע על השיתופים', 'error');
    } finally {
      setFetching(false);
    }
  };

  const isGmail = (email: string) => {
    return email.toLowerCase().endsWith('@gmail.com');
  };

  const validateEmail = (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) return false;

    // Basic email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return 'פורמט אימייל לא תקין';
    }

    if (!isGmail(trimmed)) {
      return 'ניתן לשתף רק עם כתובות Gmail';
    }

    if (emails.includes(trimmed.toLowerCase())) {
      return 'כתובת זו כבר נוספה';
    }

    return '';
  };

  const addEmail = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    const validationError = validateEmail(trimmed);

    if (validationError) {
      setInputError(validationError);
      return false;
    }

    setEmails([...emails, trimmed]);
    setEmailInput('');
    setInputError('');
    return true;
  };

  const removeEmail = (emailToRemove: string) => {
    setEmails(emails.filter(e => e !== emailToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (['Enter', 'Tab', ' '].includes(e.key)) {
      if (emailInput.trim()) {
        e.preventDefault();
        addEmail(emailInput);
      }
    }
  };

  const handleBlur = () => {
    if (emailInput.trim()) {
      addEmail(emailInput);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.post(`/properties/${propertyId}/shares`, { emails });
      showToast(`הנכס "${propertyName}" שותף בהצלחה!`, 'success');
      onClose();
    } catch (err: any) {
      console.error('Save shares error:', err);
      showToast(err.response?.data?.error || 'אירעה שגיאה בשמירת השיתופים', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    toast.custom((t) => (
      <div className={`custom-toast toast-${type} ${t.visible ? 'animate-enter' : 'animate-leave'}`}>
        <div className="toast-icon">
          {type === 'success' && <CheckCircle size={20} />}
          {type === 'error' && <XCircle size={20} />}
          {type === 'info' && <Info size={20} />}
          {type === 'warning' && <AlertTriangle size={20} />}
        </div>
        <div className="toast-content">{message}</div>
        <button className="toast-close-btn" onClick={() => toast.dismiss(t.id)}>
          <X size={16} />
        </button>
      </div>
    ), {
      duration: 2000,
      position: 'top-center',
    });
  };

  return createPortal(
    <div className="modal-backdrop" onClick={e => {
      e.stopPropagation();
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="modal share-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="share-title-wrapper">
            <Share2 className="share-icon" size={20} />
            <h2 className="modal-title">שיתוף נכס: {propertyName}</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          <div className="share-input-section">
            <label className="input-label" htmlFor="email-input">שתף עם הכתובת הבאה (Gmail בלבד)</label>
            <div dir="ltr" className={`chip-input-container ${inputError ? 'has-error' : ''}`}>
              <input
                id="email-input"
                dir="ltr"
                ref={inputRef}
                type="text"
                className="chip-input"
                placeholder={emails.length === 0 ? "example@gmail.com" : "example@gmail.com"}
                value={emailInput}
                onChange={e => {
                  setEmailInput(e.target.value);
                  if (inputError) setInputError('');
                }}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                autoFocus
              />
            </div>

            {/* Email Pills - Always visible below input */}
            <div className="shared-users-section">
              <h4 className="section-subtitle">משתמשים עם גישה:</h4>
              <div className="shared-emails-list">
                {emails.length > 0 ? (
                  emails.map(email => (
                    <div key={email} className={`email-chip ${!isGmail(email) ? 'invalid' : ''}`}>
                      <span className="chip-text">{email}</span>
                      <button className="chip-remove" onClick={() => removeEmail(email)}>
                        <X size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="no-shares-text">טרם נוספו משתמשים לשיתוף</div>
                )}
              </div>
            </div>
            {inputError && (
              <div className="input-error-text">
                <AlertCircle size={14} />
                <span>{inputError}</span>
              </div>
            )}
          </div>

          {fetching && (
            <div className="fetching-indicator">
              <span className="spinner" />
              <span>טוען שיתופים קיימים...</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>ביטול</button>
          <button
            className="btn btn-primary share-save-btn"
            onClick={handleSave}
            disabled={loading || fetching}
          >
            {loading ? <span className="spinner" /> : 'שמור'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
