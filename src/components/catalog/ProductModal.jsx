// =========================================================
// ProductModal.jsx — Modal de detalle de producto con modificadores
// Estilo: Tripp American Burger / ola.click dark mode
// =========================================================

import React, { useState, useEffect } from 'react';

function formatPrice(n) {
  return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function ProductModal({ product, onClose, onAddToCart }) {
  const [qty, setQty] = useState(1);
  const [selectedMods, setSelectedMods] = useState([]); // toppings incrementales
  const [selectedOptions, setSelectedOptions] = useState([]); // opciones checkbox (salsas)
  const [notes, setNotes] = useState('');
  const [imageError, setImageError] = useState(false);

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
          <button className="cat-modal-back-btn" onClick={onClose} aria-label="Cerrar">
            ‹
          </button>
          <h2 className="cat-modal-title">{product.name}</h2>
          <div style={{ width: 28 }} />
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
              {product.originalPrice && (
                <span className="cat-product-card-original-price">
                  {formatPrice(product.originalPrice)}
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
                        className={`cat-mod-increment-btn ${isSelected ? 'active' : ''}`}
                        onClick={() => handleToggleMod(group.name, item)}
                        aria-label={isSelected ? 'Quitar' : 'Agregar'}
                      >
                        {isSelected ? '✓' : '+'}
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
                        key={ii}
                        className={`cat-mod-checkbox ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleToggleOption(group.name, item)}
                      >
                        <span className="cat-mod-checkbox-icon">
                          {isSelected ? '✓' : ''}
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
          <div className="cat-qty-control">
            <button
              className="cat-qty-btn"
              onClick={() => setQty(q => Math.max(1, q - 1))}
              aria-label="Menos"
            >
              −
            </button>
            <span className="cat-qty-value">{qty}</span>
            <button
              className="cat-qty-btn"
              onClick={() => setQty(q => q + 1)}
              aria-label="Más"
            >
              +
            </button>
          </div>
          <button className="cat-add-to-cart-btn" onClick={handleAdd}>
            Agregar {formatPrice(totalPrice)}
          </button>
        </div>
      </div>
    </div>
  );
}
