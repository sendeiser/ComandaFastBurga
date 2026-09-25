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
      freeShipping: Boolean(product.freeShipping),
      qty: qty,
      modifiers: selectedModifiers,
      notes: notes.trim(),
      image: product.image,
      emoji: product.emoji
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-card" 
        style={{ 
          maxWidth: '430px', 
          padding: '1.1rem', 
          gap: '0.75rem', 
          borderRadius: '16px' 
        }} 
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header" style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            {product.image ? (
              <img 
                src={product.image} 
                alt={product.name} 
                style={{ 
                  width: '46px', 
                  height: '46px', 
                  borderRadius: '10px', 
                  objectFit: 'cover', 
                  border: '1px solid var(--border-subtle)',
                  flexShrink: 0
                }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <span style={{ fontSize: '1.75rem', lineHeight: 1, flexShrink: 0 }}>{product.emoji || '🍔'}</span>
            )}
            <div style={{ minWidth: 0 }}>
              <div className="modal-title" style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.2 }}>
                {product.name}
              </div>
              {product.description && (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '2px', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {product.description}
                </div>
              )}
            </div>
          </div>
          <button className="btn-close-modal" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-main)', padding: '0.45rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Cantidad:</span>
          <div className="qty-stepper">
            <button className="qty-btn" style={{ width: '28px', height: '28px' }} onClick={() => setQty(Math.max(1, qty - 1))}><Minus size={13} /></button>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, minWidth: '26px', textAlign: 'center' }}>{qty}</span>
            <button className="qty-btn" style={{ width: '28px', height: '28px' }} onClick={() => setQty(qty + 1)}><Plus size={13} /></button>
          </div>
        </div>

        {product.modifiers && product.modifiers.length > 0 && (
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-amber)', marginBottom: '0.35rem', letterSpacing: '0.02em' }}>
              AGREGADOS & MODIFICADORES:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
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
                      padding: '0.35rem 0.7rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      transition: 'all 0.15s'
                    }}
                  >
                    {active && <Check size={13} />}
                    <span>{mod}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            Aclaraciones o Notas para Cocina:
          </div>
          <input
            type="text"
            className="custom-input-sm"
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.65rem' }}
            placeholder="Ej: Bien cocida, sin mayonesa, salsa aparte..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <button 
          className="btn-confirm-order"
          style={{ height: '42px', fontSize: '0.9rem' }}
          onClick={handleConfirm}
        >
          <span>Agregar al Pedido (${(product.price * qty).toLocaleString('es-AR')})</span>
        </button>
      </div>
    </div>
  );
}
