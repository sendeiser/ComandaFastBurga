import React, { useState } from 'react';
import { X, Plus, Minus, Check } from 'lucide-react';

export default function ItemModifierModal({ product, onAddToCart, onClose }) {
  const [qty, setQty] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState([]);
  const [notes, setNotes] = useState('');

  if (!product) return null;

  const toggleModifier = (mod) => {
    if (selectedModifiers.includes(mod)) {
      setSelectedModifiers(selectedModifiers.filter(m => m !== mod));
    } else {
      setSelectedModifiers([...selectedModifiers, mod]);
    }
  };

  const handleConfirm = () => {
    onAddToCart({
      productId: product.id,
      name: product.name,
      unitPrice: product.price,
      qty: qty,
      modifiers: selectedModifiers,
      notes: notes.trim()
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span>{product.emoji}</span>
            <span>{product.name}</span>
          </div>
          <button className="btn-close-modal" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {product.description}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-main)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontWeight: 700 }}>Cantidad:</span>
          <div className="qty-stepper">
            <button className="qty-btn" onClick={() => setQty(Math.max(1, qty - 1))}><Minus size={14} /></button>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, minWidth: '30px', textAlign: 'center' }}>{qty}</span>
            <button className="qty-btn" onClick={() => setQty(qty + 1)}><Plus size={14} /></button>
          </div>
        </div>

        {product.modifiers && product.modifiers.length > 0 && (
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-amber)', marginBottom: '0.5rem' }}>
              AGREGADOS & MODIFICADORES DE COCINA:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {product.modifiers.map(mod => {
                const active = selectedModifiers.includes(mod);
                return (
                  <button
                    key={mod}
                    type="button"
                    onClick={() => toggleModifier(mod)}
                    style={{
                      background: active ? 'var(--accent-amber)' : 'var(--bg-main)',
                      color: active ? '#000' : 'var(--text-primary)',
                      border: active ? '1px solid var(--accent-amber)' : '1px solid var(--border-active)',
                      padding: '0.5rem 0.85rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.15s'
                    }}
                  >
                    {active && <Check size={14} />}
                    <span>{mod}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            Aclaraciones o Notas para la Cocina:
          </div>
          <input
            type="text"
            className="custom-input-sm"
            placeholder="Ej: Bien cocida, sin mayonesa, salsa aparte..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <button 
          className="btn-confirm-order"
          onClick={handleConfirm}
        >
          <span>Agregar al Pedido (${(product.price * qty).toLocaleString('es-AR')})</span>
        </button>
      </div>
    </div>
  );
}
