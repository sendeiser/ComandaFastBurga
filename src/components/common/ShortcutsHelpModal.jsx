import React from 'react';
import { Keyboard, X, Zap } from 'lucide-react';

export default function ShortcutsHelpModal({ onClose }) {
  const shortcuts = [
    { key: 'F1 / Alt+1', desc: 'Ir al Mostrador (POS Rápido)' },
    { key: 'F2 / Alt+2', desc: 'Ir a la Pantalla de Cocina (KDS)' },
    { key: 'F3 / Alt+3', desc: 'Ir al Historial de Pedidos' },
    { key: 'F4 / Alt+4', desc: 'Ir a Gestión del Menú' },
    { key: 'Alt + W', desc: 'Abrir Importador Inteligente de WhatsApp' },
    { key: 'Alt + C', desc: 'Abrir Control y Arqueo de Caja' },
    { key: 'Alt + A', desc: 'Abrir Cajón de Dinero (ESC/POS)' },
    { key: 'Alt + P / F9', desc: 'Abrir Cobro / Confirmar Pedido' },
    { key: 'Ctrl + K', desc: 'Buscar Productos en el Catálogo' },
    { key: 'Esc', desc: 'Cerrar cualquier ventana emergente' },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Zap size={22} style={{ color: 'var(--accent-amber)' }} />
            <span>Atajos Rápidos de Teclado</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body-scroll">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {shortcuts.map((s, idx) => (
              <div 
                key={idx} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  background: 'rgba(10, 15, 26, 0.6)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{s.desc}</span>
                <kbd 
                  style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontSize: '0.8rem', 
                    fontWeight: 700,
                    padding: '3px 8px', 
                    background: 'var(--bg-input)', 
                    border: '1px solid var(--border-card)',
                    borderRadius: 'var(--radius-xs)',
                    color: 'var(--accent-amber)'
                  }}
                >
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
