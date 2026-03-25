import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface DialogOptions {
  title: string;
  message: string | ReactNode;
  icon?: string;
  actions: {
    label: string;
    type?: 'primary' | 'danger' | 'ghost' | 'secondary';
  }[];
  isPrompt?: boolean;
  promptPlaceholder?: string;
  onPromptChange?: (val: string) => void;
}

interface DialogContextType {
  confirm: (options: DialogOptions) => Promise<number | null>;
  alert: (title: string, message: string | ReactNode, icon?: string) => Promise<void>;
  prompt: (title: string, message: string | ReactNode, placeholder?: string) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<(DialogOptions & { resolve: (value: number | null) => void }) | null>(null);

  const confirm = (options: DialogOptions): Promise<number | null> => {
    return new Promise((resolve) => {
      setDialog({ ...options, resolve });
    });
  };

  const alert = (title: string, message: string | ReactNode, icon: string = '⚠️'): Promise<void> => {
    return new Promise((resolve) => {
      setDialog({
        title,
        message,
        icon,
        actions: [{ label: 'הבנתי', type: 'primary' }],
        resolve: () => resolve()
      });
    });
  };

  const prompt = (title: string, message: string | ReactNode, placeholder: string = ''): Promise<string | null> => {
    return new Promise((resolve) => {
      let currentVal = '';
      setDialog({
        title,
        message,
        icon: '✏️',
        isPrompt: true,
        promptPlaceholder: placeholder,
        onPromptChange: (val) => { currentVal = val; },
        actions: [{ label: 'אישור', type: 'primary' }],
        resolve: (idx) => {
          if (idx === null) resolve(null);
          else resolve(currentVal);
        }
      });
    });
  };

  const handleClose = () => {
    if (dialog) {
      dialog.resolve(null);
      setDialog(null);
    }
  };

  const handleAction = (index: number) => {
    if (dialog) {
      dialog.resolve(index);
      setDialog(null);
    }
  };

  return (
    <DialogContext.Provider value={{ confirm, alert, prompt }}>
      {children}
      {dialog && (
        <ConfirmationModal
          title={dialog.title}
          message={dialog.message}
          icon={dialog.icon}
          onClose={handleClose}
          isPrompt={dialog.isPrompt}
          promptPlaceholder={dialog.promptPlaceholder}
          onPromptChange={dialog.onPromptChange}
          actions={dialog.actions.map((action, i) => ({
            ...action,
            onClick: () => handleAction(i)
          }))}
        />
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
