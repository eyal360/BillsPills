import React from 'react';
import { useBillProcess, type BillProcessState } from '../contexts/BillProcessContext';
import './FloatingProcessManager.css';

export const FloatingProcessManager: React.FC = () => {
  const { processes, removeProcess, openModal } = useBillProcess();

  const activeProcesses = Object.values(processes).filter(p => p.minimized);

  if (activeProcesses.length === 0) return null;

  return (
    <div className="floating-icons-container">
      {activeProcesses.map((process, index) => (
        <FloatingIcon 
          key={process.id} 
          process={process} 
          index={index} 
          onRemove={() => removeProcess(process.id)}
          onExpand={() => openModal(process.id)}
        />
      ))}
    </div>
  );
};

interface IconProps {
  process: BillProcessState;
  index: number;
  onRemove: () => void;
  onExpand: () => void;
}

const FloatingIcon: React.FC<IconProps> = ({ process, onRemove, onExpand }) => {
  const isReady = process.step === 'idle' || process.step === 'completed';
  const isProcessing = process.isProcessing && !isReady;

  return (
    <div className="process-icon-wrapper">
      {isReady && (
        <div className="finish-bubble">סיימתי!</div>
      )}
      <div 
        className={`floating-process-icon ${isReady ? 'ready' : ''} ${isProcessing ? 'processing' : ''}`}
        onClick={onExpand}
      >
        <div className="icon-content">
          <span style={{ fontSize: '1.5rem' }}>🧾</span>
        </div>
        
        {isProcessing && (
          <div className="spinning-loader" />
        )}
        
        {process.error && (
          <div className="error-dot" title={process.error}>!</div>
        )}

        <button className="remove-btn" onClick={(e) => { e.stopPropagation(); onRemove(); }}>✕</button>
      </div>
    </div>
  );
};
