import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit, Archive, Trash2, ArchiveRestore, Share2 } from 'lucide-react';
import type { Property } from '../types';
import api from '../lib/api';
import { useDialog } from '../contexts/DialogContext';
import { useAuth } from '../contexts/AuthContext';
import { AddPropertyModal } from './AddPropertyModal';
import { SharePropertyModal } from './SharePropertyModal';
import './PropertyMenu.css';

interface PropertyMenuProps {
  property: Property;
  onUpdate: (updated: Property) => void;
  onDelete: (id: string) => void;
}

export const PropertyMenu: React.FC<PropertyMenuProps> = ({ property, onUpdate, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const { confirm } = useDialog();
  const { user } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);
  const [alignRight, setAlignRight] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwner = user?.id === property.user_id;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);

      // Edge detection: if too close to right edge, align right (dropdown grows left)
      if (menuRef.current) {
        const rect = menuRef.current.getBoundingClientRect();
        if (rect.left + 220 > window.innerWidth) {
          setAlignRight(true);
        } else {
          setAlignRight(false);
        }
      }
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowEditModal(true);
    setShowMenu(false);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowShareModal(true);
    setShowMenu(false);
  };

  const handleArchiveToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const isArchiving = !property.is_archived;

    const confirmResult = await confirm({
      title: isArchiving ? 'העברת נכס לארכיון' : 'החזרת נכס מהארכיון',
      message: isArchiving
        ? 'האם בטוח? פעולה זו תהפוך את הנכס ללא פעיל, אך כל המידע יישמר ותוכל לבטל זאת בכל עת.'
        : 'האם ברצונך להחזיר את הנכס לנכסים הפעילים?',
      icon: isArchiving ? '📦' : '🏠',
      actions: [
        { label: isArchiving ? 'העבר לארכיון' : 'שחזר הארכיון', type: 'primary' },
        { label: 'ביטול', type: 'ghost' }
      ]
    });

    if (confirmResult !== 0) return;

    try {
      const res = await api.put(`/properties/${property.id}`, {
        ...property,
        is_archived: isArchiving
      });
      onUpdate(res.data);
      setShowMenu(false);
    } catch (err) {
      console.error(err);
    }
  };

  const executeDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/properties/${property.id}`);
      onDelete(property.id);
    } catch (err) {
      console.error(err);
      setIsDeleting(false);
    }
  };

  const handleDeleteAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);

    const result = await confirm({
      title: 'מחיקת נכס',
      message: (
        <>
          מחיקת <strong>{property.name}</strong> תמחוק לצמיתות את כל היסטוריית החשבונות והתשלומים שלו.
          <br /><br />
          מומלץ להעביר לארכיון במקום.
        </>
      ),
      icon: '⚠️',
      actions: [
        { label: 'העבר לארכיון (מומלץ)', type: 'primary' },
        { label: 'מחק לצמיתות', type: 'danger' },
        { label: 'ביטול', type: 'ghost' }
      ]
    });

    if (result === 0) {
      handleArchiveToggle(e);
    } else if (result === 1) {
      executeDelete();
    }
  };

  return (
    <div className={`property-menu-container ${showMenu ? 'menu-open' : ''}`} ref={menuRef}>
      <button
        className="property-card-menu-btn"
        onClick={toggleMenu}
        aria-label="תפריט נכס"
      >
        <MoreVertical size={20} />
      </button>

      {showMenu && (
        <div className={`property-dropdown ${alignRight ? 'align-right' : ''}`}>
          <button className="dropdown-item" onClick={handleEdit}>
            <Edit size={16} />
            <span>עריכת נכס</span>
          </button>
          <button className="dropdown-item" onClick={handleArchiveToggle}>
            {property.is_archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
            <span>{property.is_archived ? 'שחזור מהארכיון' : 'העברה לארכיון'}</span>
          </button>
          
          {isOwner && (
            <button className="dropdown-item" onClick={handleShare}>
              <Share2 size={16} />
              <span>שיתוף נכס</span>
            </button>
          )}

          <div className="dropdown-divider" />
          <button className="dropdown-item delete" onClick={handleDeleteAction}>
            <Trash2 size={16} />
            <span>מחק נכס</span>
          </button>
        </div>
      )}

      {showEditModal && (
        <AddPropertyModal
          onClose={() => setShowEditModal(false)}
          onAdded={(updated: Property) => {
            onUpdate(updated);
            setShowEditModal(false);
          }}
          editingProperty={property}
        />
      )}

      {showShareModal && (
        <SharePropertyModal
          propertyId={property.id}
          propertyName={property.name}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {isDeleting && (
        <div className="modal-backdrop" style={{ 
          zIndex: 20000, 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          textAlign: 'center',
          backdropFilter: 'blur(8px)',
          background: 'rgba(0,0,0,0.5)'
        }}>
          <div className="spinner" style={{ width: 60, height: 60, borderWidth: 4, marginBottom: '24px' }} />
          <h3 style={{ color: 'white', fontWeight: 800 }}>מוחק נכס...</h3>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>נא לא לסגור את הדף</p>
        </div>
      )}
    </div>
  );
};
