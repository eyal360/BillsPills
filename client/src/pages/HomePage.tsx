import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import type { Property, Bill } from '../types';
import api from '../lib/api';
import { AddPropertyModal } from '../components/AddPropertyModal';
import { AddBillModal } from '../components/AddBillModal';
import { PillLoader } from '../components/PillLoader';
import './HomePage.css';

const PROPERTY_EMOJIS = ['🏠', '🏢', '🏗️', '🏬', '🏰', '🏡', '🏦', '🏪'];

export const HomePage: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDataFetched, setIsDataFetched] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddBillModal, setShowAddBillModal] = useState(false);
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
      console.error(err);
      setLoading(false); // Immediate exit on error
    }
  };

  useEffect(() => { fetchProperties(); }, []);

  const handlePropertyAdded = (property: Property) => {
    setProperties(prev => [property, ...prev]);
    setShowAddModal(false);
  };

  const handleBillAdded = (bill: Bill) => {
    // Navigate to the property page after adding a bill globally
    navigate(`/property/${bill.property_id}`);
    setShowAddBillModal(false);
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
            onClick={() => setShowAddBillModal(true)}
          >
            העלאת חשבון חדש
          </button>
        </div>

        <div className="properties-grid">
          {properties.map((prop, idx) => (
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
            onClick={() => setShowAddModal(true)}
            aria-label="הוסף נכס חדש"
          >
            <div className="add-icon">+</div>
            <div className="text-sm font-semibold">נכס חדש</div>
          </button>
        </div>
      </div>

      {showAddModal && (
        <AddPropertyModal
          onClose={() => setShowAddModal(false)}
          onAdded={handlePropertyAdded}
        />
      )}

      {showAddBillModal && (
        <AddBillModal
          allProperties={properties}
          onClose={() => setShowAddBillModal(false)}
          onAdded={handleBillAdded}
        />
      )}
    </Layout>
  );
};
