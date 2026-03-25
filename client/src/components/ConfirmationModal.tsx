import React from 'react';
import './ConfirmationModal.css';

export interface DialogAction {
  label: string;
  onClick: () => void | Promise<void>;
  type?: 'primary' | 'danger' | 'ghost' | 'secondary';
}

interface ConfirmationModalProps {
  title: string;
  message: string | React.ReactNode;
  actions: DialogAction[];
  onClose: () => void;
  icon?: string;
  isPrompt?: boolean;
  promptPlaceholder?: string;
  onPromptChange?: (val: string) => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  title,
  message,
  actions,
  onClose,
  icon = '⚠️',
  isPrompt,
  promptPlaceholder,
  onPromptChange
}) => {
  const [inputValue, setInputValue] = React.useState('');
  return (
    <div className="modal-backdrop confirmation-dialog-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal confirmation-dialog-modal">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body text-center">
          {(!isPrompt || icon !== '✏️') && icon !== '⚠️' && <div className="dialog-icon">{icon}</div>}
          {isPrompt && icon === '✏️' && <div className="dialog-icon" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{icon}</div>}
          <div className="dialog-message">
            {typeof message === 'string' ? (
              message.split('\n').map((line, i) => (
                <React.Fragment key={i}>
                  {line}
                  <br />
                </React.Fragment>
              ))
            ) : message}
          </div>

          {isPrompt && (
            <div className={`floating-group ${inputValue ? 'has-value' : ''}`} style={{ marginTop: '32px' }}>
              <input
                type="text"
                autoFocus
                maxLength={15}
                className="floating-input"
                placeholder=" "
                value={inputValue}
                onChange={e => {
                  setInputValue(e.target.value);
                  onPromptChange?.(e.target.value);
                }}
                dir="rtl"
              />
              <label className="floating-label">{promptPlaceholder || 'הזן שם...'}</label>
            </div>
          )}
          
          <div className="dialog-actions">
            {actions.map((action, index) => (
              <button
                key={index}
                className={`btn btn-full ${action.type ? `btn-${action.type}` : 'btn-primary'}`}
                disabled={isPrompt && action.type === 'primary' && inputValue.trim().length < 3}
                onClick={async () => {
                  await action.onClick();
                  onClose();
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
