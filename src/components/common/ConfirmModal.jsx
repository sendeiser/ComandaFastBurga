import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, XCircle, X, Check } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  title = '¿Confirmar acción?',
  message = '',
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  variant = 'danger', // 'danger' | 'warning' | 'info'
  icon = null,
  onConfirm,
  onCancel,
  loading = false
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          iconColor: '#ef4444',
          iconBg: 'rgba(239, 68, 68, 0.12)',
          iconBorder: 'rgba(239, 68, 68, 0.25)',
          confirmBtnBg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          confirmBtnShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
          DefaultIcon: Trash2
        };
      case 'warning':
        return {
          iconColor: '#f59e0b',
          iconBg: 'rgba(245, 158, 11, 0.12)',
          iconBorder: 'rgba(245, 158, 11, 0.25)',
          confirmBtnBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          confirmBtnShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
          DefaultIcon: AlertTriangle
        };
      default:
        return {
          iconColor: '#3b82f6',
          iconBg: 'rgba(59, 130, 246, 0.12)',
          iconBorder: 'rgba(59, 130, 246, 0.25)',
          confirmBtnBg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          confirmBtnShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
          DefaultIcon: AlertTriangle
        };
    }
  };

  const vStyles = getVariantStyles();
  const IconComponent = icon || vStyles.DefaultIcon;

  return (
    <div 
      className="modal-overlay" 
      style={{ 
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 99999
      }} 
      onClick={onCancel}
    >
      <div
        className="modal-card"
        style={{
          maxWidth: '430px',
          width: '100%',
          padding: '1.45rem',
          borderRadius: '20px',
          background: 'var(--bg-card, #ffffff)',
          border: '1.5px solid var(--border-subtle, rgba(0,0,0,0.08))',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.28)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.15rem'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: vStyles.iconBg,
            border: `1.5px solid ${vStyles.iconBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: vStyles.iconColor,
            flexShrink: 0
          }}>
            <IconComponent size={24} />
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingTop: '2px' }}>
            <h3 style={{ 
              margin: '0 0 6px 0', 
              fontSize: '1.12rem', 
              fontWeight: 800, 
              color: 'var(--text-primary, #1e293b)',
              lineHeight: 1.3
            }}>
              {title}
            </h3>
            {message && (
              <p style={{ 
                margin: 0, 
                fontSize: '0.84rem', 
                color: 'var(--text-secondary, #64748b)', 
                lineHeight: 1.45 
              }}>
                {message}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="btn-close-modal"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'rgba(0,0,0,0.04)',
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '10px', 
          marginTop: '0.4rem',
          paddingTop: '0.85rem',
          borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.06))'
        }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              height: '38px',
              padding: '0 16px',
              borderRadius: '12px',
              border: '1.5px solid var(--border-subtle, #cbd5e1)',
              background: 'transparent',
              color: 'var(--text-primary, #334155)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              height: '38px',
              padding: '0 18px',
              borderRadius: '12px',
              border: 'none',
              background: vStyles.confirmBtnBg,
              boxShadow: vStyles.confirmBtnShadow,
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
