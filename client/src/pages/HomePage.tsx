import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import type { Property, Bill } from '../types';
import api from '../lib/api';
import { AddPropertyModal } from '../components/AddPropertyModal';
import { AddBillModal } from '../components/AddBillModal';
import { PillLoader } from '../components/PillLoader';
import { useBillProcess } from '../contexts/BillProcessContext';
import { ChevronDown, ChevronUp } from 'lucide-react';
import './HomePage.css';

const PROPERTY_EMOJIS = ['🏠', '🏢', '🏗️', '🏬', '🏰', '🏡', '🏦', '🏪'];

export const HomePage: React.FC = () => {
  const { processes, activeProcessId, openModal } = useBillProcess();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDataFetched, setIsDataFetched] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [initialPropertyName, setInitialPropertyName] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const navigate = useNavigate();

  const fetchProperties = async () => {
    const startTime = Date.now();
    try {
      const res = await api.get('/properties');
      setProperties(res.data);

      const elapsed = Date.now() - startTime;
      const minWait = 2000;
      const remaining = Math.max(0, minWait - elapsed);

      setTimeout(() => {
        setIsDataFetched(true);
      }, remaining);

    } catch (err) {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProperties(); }, []);

  const handlePropertyAdded = (property: Property) => {
    setProperties(prev => [property, ...prev]);
    setShowAddModal(false);
    setInitialPropertyName('');
  };

  const handleBillAdded = (bill: Bill) => {
    navigate(`/property/${bill.property_id}`);
  };

  const onRequestAddProperty = (name: string) => {
    setInitialPropertyName(name);
    setShowAddModal(true);
  };

  const handleAddBillClick = () => {
    openModal('new');
  };

  if (loading) return (
    <div className="loading-overlay" style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(15, 10, 30, 0.8)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <PillLoader
        demo={!isDataFetched}
        loadingProgress={isDataFetched ? 80 : 20}
        isCompleting={isDataFetched}
        onComplete={() => setLoading(false)}
      />
    </div>
  );

  return (
    <Layout>
      <div className="page-content">
        <div className="home-header">
          <button
            className="btn btn-primary global-ocr-btn"
            onClick={handleAddBillClick}
            disabled={Object.values(processes).length >= 5}
            style={{ zIndex: 10 }}
          >
            העלאת חשבון חדש
          </button>
        </div>

        <div className="properties-grid">
          {properties.filter(p => !p.is_archived).map((prop, idx) => (
            <div
              key={prop.id}
              className="property-card card card-interactive"
              onClick={() => navigate(`/property/${prop.id}`)}
            >
              <div className="property-emoji">
                {prop.icon || PROPERTY_EMOJIS[idx % PROPERTY_EMOJIS.length]}
              </div>
              <div className="property-name">{prop.name}</div>
              {prop.address && (
                <div className="property-address">{prop.address}</div>
              )}
            </div>
          ))}

          <button
            className="add-property-card"
            onClick={() => { setInitialPropertyName(''); setShowAddModal(true); }}
            aria-label="הוסף נכס חדש"
          >
            <div className="add-icon">+</div>
            <div className="text-sm font-semibold">נכס חדש</div>
          </button>
        </div>

        {properties.some(p => p.is_archived) && (
          <div className="archive-section">
            <div
              className="archive-header"
              onClick={() => setShowArchived(!showArchived)}
            >
              <div className="archive-divider-line"></div>
              <div className="archive-title" dir="rtl">
                <span>ארכיון ({properties.filter(p => p.is_archived).length})</span>
                {showArchived ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </div>
              <div className="archive-divider-line"></div>
            </div>

            {showArchived && (
              <div className="properties-grid archived">
                {properties.filter(p => p.is_archived).map((prop, idx) => (
                  <div
                    key={prop.id}
                    className="property-card card card-interactive archived"
                    onClick={() => navigate(`/property/${prop.id}`)}
                  >
                    <div className="property-emoji">
                      {prop.icon || PROPERTY_EMOJIS[idx % PROPERTY_EMOJIS.length]}
                    </div>
                    <div className="property-name">{prop.name}</div>
                    {prop.address && (
                      <div className="property-address">{prop.address}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddPropertyModal
          initialName={initialPropertyName}
          onClose={() => { setShowAddModal(false); setInitialPropertyName(''); }}
          onAdded={handlePropertyAdded}
        />
      )}

      {activeProcessId && (
        <AddBillModal
          allProperties={properties}
          onRequestAddProperty={onRequestAddProperty}
          onClose={() => { }}
          onAdded={handleBillAdded}
        />
      )}
    </Layout>
  );
};
