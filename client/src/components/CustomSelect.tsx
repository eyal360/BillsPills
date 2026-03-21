import React, { useState } from 'react';
import './CustomSelect.css';

interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

export const CustomSelect: React.FC<Props> = ({
  value,
  onChange,
  options,
  placeholder = 'בחר...',
  disabled = false,
  error = false,
}) => {
  const [open, setOpen] = useState(false);

  const selected = options.find(o => o.value === value);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <>
      {/* Trigger — looks like a floating input */}
      <button
        type="button"
        className={`custom-select-trigger ${value ? 'has-value' : ''} ${disabled ? 'disabled' : ''} ${error ? 'error' : ''}`}
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
      >
        <span className={`custom-select-value ${!value ? 'placeholder' : ''}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="custom-select-chevron">›</span>
      </button>

      {/* Overlay sheet */}
      {open && (
        <div className="custom-select-backdrop" onClick={() => setOpen(false)}>
          <div className="custom-select-sheet" onClick={e => e.stopPropagation()}>
            <div className="custom-select-sheet-handle" />

            <div className="custom-select-options">
              {options.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`custom-select-option ${value === opt.value ? 'selected' : ''}`}
                  onClick={() => handleSelect(opt.value)}
                >
                  {opt.label}
                  {value === opt.value && <span className="custom-select-check">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
