import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Check, UtensilsCrossed } from 'lucide-react';

export default function MenuManagement({ products, onSaveProducts }) {
  const [editingProduct, setEditingProduct] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Hamburguesas');
  const [price, setPrice] = useState('');
  const [emoji, setEmoji] = useState('🍔');
  const [description, setDescription] = useState('');
  const [modifiersStr, setModifiersStr] = useState('');

  const openNew = () => {
    setEditingProduct({ id: null });
    setName('');
    setCategory('Hamburguesas');
    setPrice('');
    setEmoji('🍔');
    setDescription('');
    setModifiersStr('Sin cebolla, Extra Cheddar (+$800), Extra Bacon (+$900)');
  };

  const openEdit = (p) => {
    setEditingProduct(p);
    setName(p.name);
    setCategory(p.category);
    setPrice(p.price.toString());
    setEmoji(p.emoji || '🍔');
    setDescription(p.description || '');
    setModifiersStr((p.modifiers || []).join(', '));
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!name || !price) {
      alert('Completa el nombre y precio del producto.');
      return;
    }

    const modsArray = modifiersStr.split(',').map(m => m.trim()).filter(Boolean);
    const itemData = {
      id: editingProduct.id || 'prod-' + Date.now(),
      name: name.trim(),
      category,
      price: Number(price),
      emoji,
      description: description.trim(),
      modifiers: modsArray
    };

    if (editingProduct.id) {
      onSaveProducts(products.map(p => p.id === editingProduct.id ? itemData : p));
    } else {
      onSaveProducts([...products, itemData]);
    }
    setEditingProduct(null);
  };

  const handleDelete = (id) => {
    if (confirm('¿Eliminar este producto del menú?')) {
      onSaveProducts(products.filter(p => p.id !== id));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UtensilsCrossed size={22} style={{ color: 'var(--accent-amber)' }} />
          <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>ADMINISTRACIÓN DEL MENÚ ({products.length} productos)</span>
        </div>

        <button className="btn-confirm-order" style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={openNew}>
          <Plus size={18} />
          <span>Nuevo Producto</span>
        </button>
      </div>

      {/* Products Grid Manager */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', overflowY: 'auto', flex: 1 }}>
        {products.map(prod => (
          <div key={prod.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '2rem' }}>{prod.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{prod.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-amber)', fontWeight: 700 }}>{prod.category}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{prod.description}</div>
              </div>
            </div>

            {prod.modifiers && prod.modifiers.length > 0 && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--bg-main)', padding: '6px 8px', borderRadius: '4px' }}>
                <strong>Modificadores:</strong> {prod.modifiers.join(', ')}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent-amber)' }}>
                ${prod.price.toLocaleString('es-AR')}
              </span>

              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button className="qty-btn" onClick={() => openEdit(prod)} title="Editar"><Edit2 size={15} /></button>
                <button className="qty-btn" style={{ color: 'var(--accent-rose)' }} onClick={() => handleDelete(prod.id)} title="Eliminar"><Trash2 size={15} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit/New Modal */}
      {editingProduct && (
        <div className="modal-overlay" onClick={() => setEditingProduct(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editingProduct.id ? 'Editar Producto' : 'Crear Nuevo Producto'}</div>
              <button className="btn-close-modal" onClick={() => setEditingProduct(null)}>✕</button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Emoji:</label>
                  <input type="text" className="custom-input-sm" style={{ fontSize: '1.2rem', textAlign: 'center' }} value={emoji} onChange={e => setEmoji(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nombre:</label>
                  <input type="text" className="custom-input-sm" placeholder="Ej: Burger Doble Bacon" value={name} onChange={e => setName(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Categoría:</label>
                  <select className="custom-input-sm" value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="Hamburguesas">Hamburguesas</option>
                    <option value="Agregados">Agregados / Papas</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Combos">Combos</option>
                    <option value="Postres">Postres</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Precio ($):</label>
                  <input type="number" className="custom-input-sm" placeholder="Ej: 7500" value={price} onChange={e => setPrice(e.target.value)} required />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Descripción:</label>
                <input type="text" className="custom-input-sm" placeholder="Detalle de ingredientes..." value={description} onChange={e => setDescription(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Agregados & Modificadores (Separados por coma):</label>
                <input type="text" className="custom-input-sm" placeholder="Sin cebolla, Extra Cheddar (+$800), Salsa BBQ" value={modifiersStr} onChange={e => setModifiersStr(e.target.value)} />
              </div>

              <button type="submit" className="btn-confirm-order" style={{ marginTop: '0.5rem' }}>
                Guardar Producto
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
