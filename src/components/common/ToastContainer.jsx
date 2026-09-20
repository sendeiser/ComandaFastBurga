import React, { useState, useEffect } from 'react';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import { toastService } from '../../services/toastService';

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = toastService.subscribe((newToast) => {
      setToasts(prev => [...prev, newToast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, newToast.duration || 3200);
    });

    return () => unsubscribe();
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast-card ${toast.type}`}>
          {toast.type === 'success' && <CheckCircle2 size={18} style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} />}
          {toast.type === 'info' && <Info size={18} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />}
          {toast.type === 'warning' && <AlertTriangle size={18} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />}
          {toast.type === 'error' && <XCircle size={18} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />}
          
          <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600 }}>{toast.message}</span>
          
          <button 
            type="button"
            onClick={() => removeToast(toast.id)} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '2px' }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
