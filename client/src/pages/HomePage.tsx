import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import type { Property, Bill } from '../types';
import api from '../lib/api';
import { AddPropertyModal } from '../components/AddPropertyModal';
import { AddBillModal } from '../components/AddBillModal';
import './HomePage.css';

const PROPERTY_EMOJIS = ['🏠', '🏢', '🏗️', '🏬', '🏰', '🏡', '🏦', '🏪'];

export const HomePage: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddBillModal, setShowAddBillModal] = useState(false);
  const navigate = useNavigate();

  const fetchProperties = async () => {
    try {
      const res = await api.get('/properties');
      setProperties(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

  return (
    <Layout>
      <div className="page-content">
        <div className="home-header">
          <h2 className="section-title">הנכסים שלי</h2>
          <button 
            className="btn btn-primary btn-sm global-ocr-btn"
            onClick={() => setShowAddBillModal(true)}
          >
            📸 העלה חשבון מהיר
          </button>
        </div>

        {loading ? (
          <div className="loading-center">
            <div className="spinner" />
            <span>טוען נכסים...</span>
          </div>
        ) : (
          <div className="properties-grid">
            {properties.map((prop, idx) => (
              <div
                key={prop.id}
                className="property-card card card-interactive"
                onClick={() => navigate(`/property/${prop.id}`)}
              >
                <div className="property-emoji">
                  {PROPERTY_EMOJIS[idx % PROPERTY_EMOJIS.length]}
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
        )}
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
