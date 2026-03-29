import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import type { Property, Bill } from '../types';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { AddPropertyModal } from '../components/AddPropertyModal';
import { AddBillModal } from '../components/AddBillModal';
import { PillLoader } from '../components/PillLoader';
import { useBillProcess } from '../contexts/BillProcessContext';
import { ChevronDown, ChevronUp } from 'lucide-react';
import './HomePage.css';

import { PropertyMenu } from '../components/PropertyMenu';
import { useDialog } from '../contexts/DialogContext';

const PROPERTY_EMOJIS = ['🏠', '🏢', '🏗️', '🏬', '🏰', '🏡', '🏦', '🏪'];

export const HomePage: React.FC = () => {
  const { processes, activeProcessId, openModal, updateProcess } = useBillProcess();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDataFetched, setIsDataFetched] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [initialPropertyName, setInitialPropertyName] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const { confirm, alert } = useDialog();
  const [onboardingActive, setOnboardingActive] = useState(false);
  const [suspendedProcessId, setSuspendedProcessId] = useState<string | null>(null);
  const { user } = useAuth();
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

  useEffect(() => {
    const onboardingKey = `onboarding_completed_${user?.id}`;
    if (isDataFetched && properties.length === 0 && user?.id && !localStorage.getItem(onboardingKey)) {
      const showOnboarding = async () => {
        const confirmed = await confirm({
          title: 'ברוכים הבאים!',
          message: 'נמאס לך מהבלאגן בחשבונות הבית?\nיש לנו את התרופה!',
          actions: [
            { label: 'יאללה, בוא נתחיל!', type: 'primary' }
          ]
        });

        if (confirmed === 0) {
          setOnboardingActive(true);
          setShowAddModal(true);
        } else {
          // If dismissed early, show tip and finish
          localStorage.setItem(`onboarding_completed_${user?.id}`, 'true');
          await alert(
            'נהדר, אנחנו מוכנים!',
            'מעכשיו תוכל להעלות חשבונות חדשים בקלות על ידי לחיצה על כפתור \'הוסף חשבון במהירות\' הכחול שבראש העמוד.',
            '🎉'
          );
        }
      };
      showOnboarding();
    }
  }, [isDataFetched, properties.length, user?.id]);

  const handlePropertyAdded = (property: Property) => {
    setProperties(prev => {
      const exists = prev.find(p => p.id === property.id);
      if (exists) {
        return prev.map(p => p.id === property.id ? property : p);
      }
      return [property, ...prev];
    });
    setShowAddModal(false);
    setInitialPropertyName('');
    
    // If we had a bill process waiting for this property, resume it
    if (suspendedProcessId) {
      updateProcess(suspendedProcessId, { propertyId: property.id });
      setTimeout(() => {
        openModal(suspendedProcessId);
        setSuspendedProcessId(null);
      }, 500);
      return;
    }

    if (onboardingActive) {
      setTimeout(async () => {
        const nextAction = await confirm({
          title: 'הוספת נכס אחר?',
          message: 'הנכס נוסף בהצלחה!\nהאם ברצונך להוסיף נכס נוסף כעת?',
          actions: [
            { label: 'הוסף נכס נוסף', type: 'primary' },
            { label: 'לא תודה', type: 'ghost' }
          ]
        });

        if (nextAction === 0) {
          setShowAddModal(true);
        } else {
          setOnboardingActive(false);
          localStorage.setItem(`onboarding_completed_${user?.id}`, 'true');
          // Small delay before final tip to ensure smooth transition
          setTimeout(() => {
            alert(
              'נהדר, אנחנו מוכנים!',
              'מעכשיו תוכל להעלות חשבונות חדשים בקלות על ידי לחיצה על כפתור \'הוסף חשבון במהירות\' הכחול שבראש העמוד.',
              '🎉'
            );
          }, 100);
        }
      }, 500);
    }
  };

  const handlePropertyDeleted = (id: string) => {
    setProperties(prev => prev.filter(p => p.id !== id));
  };

  const handleBillAdded = (bill: Bill) => {
    navigate(`/property/${bill.property_id}`);
  };

  const onRequestAddProperty = (name: string, processId?: string) => {
    setInitialPropertyName(name);
    if (processId) setSuspendedProcessId(processId);
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
            הוסף חשבון במהירות
          </button>
        </div>

        <div className="properties-grid">
          {properties.filter(p => !p.is_archived).map((prop, idx) => (
            <div
              key={prop.id}
              className="property-card card card-interactive"
              onClick={() => navigate(`/property/${prop.id}`)}
            >
              <PropertyMenu
                property={prop}
                onUpdate={handlePropertyAdded}
                onDelete={handlePropertyDeleted}
              />
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
                    <PropertyMenu
                      property={prop}
                      onUpdate={handlePropertyAdded}
                      onDelete={handlePropertyDeleted}
                    />
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
