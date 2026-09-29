// =========================================================
// ProductModal.jsx — Modal de detalle de producto con modificadores
// Estilo: Tripp American Burger / ola.click dark mode
// =========================================================

import React, { useState, useEffect } from 'react';
import { Plus, Minus, ArrowLeft, Check } from 'lucide-react';

function formatPrice(n) {
  return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function ProductModal({ product, onClose, onAddToCart }) {
  const [qty, setQty] = useState(1);
  const [selectedMods, setSelectedMods] = useState([]); // toppings incrementales
  const [selectedOptions, setSelectedOptions] = useState([]); // opciones checkbox (salsas)
  const [notes, setNotes] = useState('');
  const [imageError, setImageError] = useState(false);

  // Sold-out check
  const isSoldOut = product.available === false || product.is_active === false ||
    (product.stock !== null && product.stock !== undefined && Number(product.stock) <= 0);

  // Grupos de modificadores del producto
  const modifierGroups = Array.isArray(product.modifiers) ? product.modifiers : [];

  // Separar grupos por tipo: 'increment' (toppings) vs 'select' (opciones únicas/múltiples)
  const incrementGroups = modifierGroups.filter(g => g.type === 'increment' || (!g.type && g.items));
  const selectGroups = modifierGroups.filter(g => g.type === 'select' || g.type === 'checkbox');

  // Costo extra total de modificadores
  const extraCost = selectedMods.reduce((s, m) => s + (m.price || 0) * (m.qty || 1), 0) +
                    selectedOptions.reduce((s, o) => s + (o.price || 0), 0);

  const totalPrice = (product.price + extraCost) * qty;

  // Cerrar con Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Prevenir scroll del body
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleToggleMod = (groupName, item) => {
    setSelectedMods(prev => {
      const exists = prev.find(m => m.groupName === groupName && m.name === item.name);
      if (exists) {
        return prev.filter(m => !(m.groupName === groupName && m.name === item.name));
      }
      return [...prev, { groupName, name: item.name, price: item.price || 0, qty: 1 }];
    });
  };

  const handleToggleOption = (groupName, item) => {
    setSelectedOptions(prev => {
      const exists = prev.find(o => o.groupName === groupName && o.name === item.name);
      if (exists) {
        return prev.filter(o => !(o.groupName === groupName && o.name === item.name));
      }
      return [...prev, { groupName, name: item.name, price: item.price || 0 }];
    });
  };

  const handleAdd = () => {
    onAddToCart(product, qty, selectedMods, selectedOptions, notes, product.price + extraCost);
    onClose();
  };

  return (
    <div className="cat-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cat-modal">
        {/* Header */}
        <div className="cat-modal-header">
          <button type="button" className="cat-modal-back-btn" onClick={onClose} aria-label="Cerrar">
            <ArrowLeft size={18} />
          </button>
          <h2 className="cat-modal-title">{product.name}</h2>
          <div style={{ width: 36 }} />
        </div>

        {/* Body */}
        <div className="cat-modal-body">
          {/* Imagen */}
          <div className="cat-modal-image-col">
            {product.image && !imageError ? (
              <img
                className="cat-modal-product-image"
                src={product.image}
                alt={product.name}
                onError={() => setImageError(true)}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="cat-modal-product-emoji">
                {product.emoji || '🍔'}
              </div>
            )}
          </div>

          {/* Info y modificadores */}
          <div className="cat-modal-info-col">
            {product.description && (
              <p className="cat-modal-product-desc">{product.description}</p>
            )}
            <div className="cat-modal-product-price">
              {formatPrice(product.price)}
              {product.originalPrice && Number(product.originalPrice) > Number(product.price) && (
                <span className="cat-product-card-original-price">
                  {formatPrice(product.originalPrice)}
                </span>
              )}
              {(product.discountBadge || (product.category || '').toLowerCase().includes('promo')) && (
                <span className="cat-modal-promo-badge">
                  🔥 PROMO DEL DÍA
                </span>
              )}
            </div>

            {/* Grupos de toppings incrementales */}
            {incrementGroups.map((group, gi) => (
              <div key={gi} className="cat-mod-group">
                <div className="cat-mod-group-header">
                  <div>
                    <div className="cat-mod-group-title">{group.name || 'Extras'}</div>
                    {group.subtitle && (
                      <div className="cat-mod-group-subtitle">{group.subtitle}</div>
                    )}
                    {group.maxSelect && (
                      <div className="cat-mod-group-subtitle">
                        Seleccioná hasta {group.maxSelect} {group.maxSelect === 1 ? 'opción' : 'opciones'}
                      </div>
                    )}
                  </div>
                  <span className="cat-mod-group-toggle">∨</span>
                </div>
                {(group.items || []).map((item, ii) => {
                  const isSelected = selectedMods.some(
                    m => m.groupName === group.name && m.name === item.name
                  );
                  return (
                    <div key={ii} className="cat-mod-increment-row">
                      <div>
                        <div className="cat-mod-increment-name">{item.name}</div>
                        {item.price > 0 && (
                          <div className="cat-mod-increment-price">+ {formatPrice(item.price)}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        className={`cat-mod-increment-btn ${isSelected ? 'active' : ''}`}
                        onClick={() => handleToggleMod(group.name, item)}
                        aria-label={isSelected ? 'Quitar' : 'Agregar'}
                      >
                        {isSelected ? <Check size={14} /> : <Plus size={14} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Grupos de opciones tipo checkbox (salsas, punto de cocción, etc.) */}
            {selectGroups.map((group, gi) => (
              <div key={gi} className="cat-mod-group">
                <div className="cat-mod-group-header">
                  <div>
                    <div className="cat-mod-group-title">{group.name || 'Opciones'}</div>
                    {group.maxSelect && (
                      <div className="cat-mod-group-subtitle">
                        Seleccioná hasta {group.maxSelect} {group.maxSelect === 1 ? 'opción' : 'opciones'}
                      </div>
                    )}
                  </div>
                  <span className="cat-mod-group-toggle">∨</span>
                </div>
                <div className="cat-mod-checkbox-grid">
                  {(group.items || []).map((item, ii) => {
                    const isSelected = selectedOptions.some(
                      o => o.groupName === group.name && o.name === item.name
                    );
                    return (
                      <button
                        type="button"
                        key={ii}
                        className={`cat-mod-checkbox ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleToggleOption(group.name, item)}
                      >
                        <span className="cat-mod-checkbox-icon">
                          {isSelected ? <Check size={12} /> : null}
                        </span>
                        {item.name}
                        {item.price > 0 && ` (+${formatPrice(item.price)})`}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Comentarios */}
            <div style={{ marginTop: 8 }}>
              <label className="cat-comments-label">Comentarios</label>
              <textarea
                className="cat-comments-textarea"
                placeholder="Sin cebolla, extra sal, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Footer: cantidad + agregar */}
        <div className="cat-modal-footer">
          {isSoldOut ? (
            <button
              type="button"
              disabled
              style={{
                flex: 1,
                padding: '14px 20px',
                borderRadius: 12,
                fontSize: '0.95rem',
                fontWeight: 800,
                background: 'rgba(239,68,68,0.12)',
                color: '#ef4444',
                border: '2px solid rgba(239,68,68,0.4)',
                cursor: 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              🔴 Producto Agotado
              <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.8 }}>(hasta agotar stock)</span>
            </button>
          ) : (
            <>
              <div className="cat-modal-qty-selector cat-qty-control">
                <button
                  type="button"
                  className="cat-modal-qty-btn cat-qty-btn"
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  aria-label="Disminuir cantidad"
                >
                  <Minus size={18} />
                </button>
                <span className="cat-modal-qty-val cat-qty-value">{qty}</span>
                <button
                  type="button"
                  className="cat-modal-qty-btn cat-qty-btn"
                  onClick={() => setQty(q => q + 1)}
                  aria-label="Aumentar cantidad"
                >
                  <Plus size={18} />
                </button>
              </div>
              <button type="button" className="cat-modal-add-btn cat-add-to-cart-btn" onClick={handleAdd}>
                <span>Agregar</span>
                <span className="cat-modal-add-price">{formatPrice(totalPrice)}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
