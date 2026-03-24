import { createContext, useContext, useState, type ReactNode, useCallback } from 'react';

export type ProcessStep = 'idle' | 'analyzing' | 'extracting' | 'completed';

export interface BillProcessState {
  id: string;
  isProcessing: boolean;
  isCompleting: boolean;
  step: ProcessStep;
  progress: number;
  averageDuration: number;
  startTime?: number; // timestamp
  propertyId?: string;
  billId?: string;
  minimized: boolean;
  error?: string;
  ocrResult?: any;
  embedding?: number[];
  actualDuration?: number;
}

interface BillProcessContextType {
  processes: Record<string, BillProcessState>;
  activeProcessId: string | 'new' | null;
  openModal: (id?: string) => void;
  closeModal: () => void;
  setAverageDuration: (duration: number) => void;
  addProcess: (propertyId?: string) => string;
  updateProcess: (id: string, updates: Partial<BillProcessState>) => void;
  completeProcess: (id: string, billId: string, propertyId: string) => void;
  removeProcess: (id: string) => void;
  resetAll: () => void;
}

const BillProcessContext = createContext<BillProcessContextType | undefined>(undefined);

export const BillProcessProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [processes, setProcesses] = useState<Record<string, BillProcessState>>({});
  const [averageDuration, setAverageDurationState] = useState(20000);
  const [activeProcessId, setActiveProcessId] = useState<string | 'new' | null>(null);

  const setAverageDuration = useCallback((duration: number) => {
    setAverageDurationState(duration);
  }, []);

  const openModal = useCallback((id?: string) => {
    setActiveProcessId(id || 'new');
    if (id) {
      setProcesses(prev => {
        if (!prev[id]) return prev;
        return {
          ...prev,
          [id]: { ...prev[id], minimized: false }
        };
      });
    }
  }, []);

  const closeModal = useCallback(() => {
    setActiveProcessId(null);
  }, []);

  const addProcess = useCallback((propertyId?: string) => {
    const id = Math.random().toString(36).substring(7);
    setProcesses(prev => {
      // Limit to 5
      if (Object.keys(prev).length >= 5) return prev;
      
      return {
        ...prev,
        [id]: {
          id,
          isProcessing: true,
          isCompleting: false,
          step: 'analyzing',
          progress: 5,
          startTime: Date.now(),
          propertyId,
          minimized: false,
          averageDuration
        }
      };
    });
    // When starting a new process via the modal, we update the activeProcessId
    setActiveProcessId(id);
    return id;
  }, [averageDuration]);

  const updateProcess = useCallback((id: string, updates: Partial<BillProcessState>) => {
    setProcesses(prev => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], ...updates }
      };
    });
  }, []);

  const completeProcess = useCallback((id: string, billId: string, propertyId: string) => {
    setProcesses(prev => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: {
          ...prev[id],
          isProcessing: true,
          isCompleting: true,
          step: 'completed',
          progress: 100,
          billId,
          propertyId
        }
      };
    });
  }, []);

  const removeProcess = useCallback((id: string) => {
    setProcesses(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (activeProcessId === id) setActiveProcessId(null);
  }, [activeProcessId]);

  const resetAll = useCallback(() => {
    setProcesses({});
    setActiveProcessId(null);
  }, []);

  return (
    <BillProcessContext.Provider value={{ 
      processes, 
      activeProcessId,
      openModal,
      closeModal,
      setAverageDuration, 
      addProcess, 
      updateProcess, 
      completeProcess, 
      removeProcess,
      resetAll 
    }}>
      {children}
    </BillProcessContext.Provider>
  );
};

export const useBillProcess = () => {
  const context = useContext(BillProcessContext);
  if (context === undefined) {
    throw new Error('useBillProcess must be used within a BillProcessProvider');
  }
  return context;
};
