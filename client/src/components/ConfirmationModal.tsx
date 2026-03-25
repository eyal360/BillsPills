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
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  title,
  message,
  actions,
  onClose,
  icon = '⚠️'
}) => {
  return (
    <div className="modal-backdrop confirmation-dialog-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal confirmation-dialog-modal">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body text-center">
          <div className="dialog-icon">{icon}</div>
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
          
          <div className="dialog-actions">
            {actions.map((action, index) => (
              <button
                key={index}
                className={`btn btn-full ${action.type ? `btn-${action.type}` : 'btn-primary'}`}
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
