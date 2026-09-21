import React, { useState, useRef } from 'react';
import { 
  Plus, Edit2, Trash2, Check, UtensilsCrossed, 
  Upload, Image as ImageIcon, Link as LinkIcon, X, 
  Sparkles, Camera, RefreshCw
} from 'lucide-react';

export default function MenuManagement({ products, onSaveProducts }) {
  const [editingProduct, setEditingProduct] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Hamburguesas');
  const [price, setPrice] = useState('');
  const [emoji, setEmoji] = useState('🍔');
  const [image, setImage] = useState('');
  const [imageMode, setImageMode] = useState('upload'); // 'upload' | 'url'
  const [description, setDescription] = useState('');
  const [modifiersStr, setModifiersStr] = useState('');
  const [compressing, setCompressing] = useState(false);

  const fileInputRef = useRef(null);

  const openNew = () => {
    setEditingProduct({ id: null });
    setName('');
    setCategory('Hamburguesas');
    setPrice('');
    setEmoji('🍔');
    setImage('https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80');
    setDescription('');
    setModifiersStr('Sin cebolla, Extra Cheddar (+$800), Extra Bacon (+$900)');
    setImageMode('upload');
  };

  const openEdit = (p) => {
    setEditingProduct(p);
    setName(p.name);
    setCategory(p.category);
    setPrice(p.price.toString());
    setEmoji(p.emoji || '🍔');
    setImage(p.image || '');
    setDescription(p.description || '');
    setModifiersStr((p.modifiers || []).join(', '));
    setImageMode(p.image && p.image.startsWith('data:') ? 'upload' : 'upload');
  };

  // Compresión y conversión de imagen en el navegador (Canvas)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (JPG, PNG, WEBP).');
      return;
    }

    setCompressing(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDimension = 800; // Máximo 800px para nitidez perfecta y tamaño ultraligero

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Compresión optimizada en JPEG
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setImage(compressedDataUrl);
        } catch (err) {
          console.error('Error al comprimir imagen:', err);
          setImage(event.target.result);
        } finally {
          setCompressing(false);
        }
      };
      img.src = event.target.result;
    };

    reader.readAsDataURL(file);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!name.trim() || !price) {
      alert('Completa el nombre y precio del producto.');
      return;
    }

    const modsArray = modifiersStr.split(',').map(m => m.trim()).filter(Boolean);
    const itemData = {
      id: editingProduct.id || 'prod-' + Date.now(),
      name: name.trim(),
      category,
      price: Number(price),
      emoji: emoji || '🍔',
      image: image.trim(),
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.35))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--accent-amber)'
          }}>
            <UtensilsCrossed size={20} style={{ color: 'var(--accent-amber)' }} />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
              ADMINISTRACIÓN DEL MENÚ & FOTOS ({products.length} productos)
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Sube fotos reales para que el Chatbot y WhatsApp muestren las imágenes a los clientes
            </div>
          </div>
        </div>

        <button className="btn-confirm-order" style={{ width: 'auto', padding: '0.5rem 1.15rem', fontSize: '0.85rem', gap: '6px' }} onClick={openNew}>
          <Plus size={18} />
          <span>Nuevo Producto</span>
        </button>
      </div>

      {/* Products Grid Manager */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
        {products.map(prod => (
          <div key={prod.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
              {/* Product Thumbnail (Photo or Emoji) */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {prod.image ? (
                  <img
                    src={prod.image}
                    alt={prod.name}
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '12px',
                      objectFit: 'cover',
                      border: '1.5px solid var(--border-subtle)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '12px',
                    background: 'var(--bg-main)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    {prod.emoji}
                  </div>
                )}
                {prod.image && (
                  <span style={{
                    position: 'absolute',
                    bottom: '-4px',
                    right: '-4px',
                    background: 'var(--bg-card)',
                    borderRadius: '50%',
                    padding: '2px',
                    fontSize: '0.7rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }}>
                    {prod.emoji}
                  </span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {prod.name}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent-amber)', fontWeight: 800, marginTop: '1px' }}>
                  {prod.category}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {prod.description || 'Sin descripción'}
                </div>
              </div>
            </div>

            {prod.modifiers && prod.modifiers.length > 0 && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', background: 'var(--bg-main)', padding: '6px 8px', borderRadius: '6px', lineHeight: '1.3' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Modificadores:</strong> {prod.modifiers.join(', ')}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent-amber)' }}>
                ${prod.price.toLocaleString('es-AR')}
              </span>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  className="qty-btn"
                  onClick={() => openEdit(prod)}
                  title="Editar producto y foto"
                  style={{ width: 'auto', padding: '0 8px', height: '30px', fontSize: '0.75rem', gap: '4px' }}
                >
                  <Edit2 size={13} />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  className="qty-btn"
                  style={{ width: '30px', height: '30px', padding: 0, color: 'var(--accent-rose)' }}
                  onClick={() => handleDelete(prod.id)}
                  title="Eliminar producto"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit/New Modal with Photo Upload */}
      {editingProduct && (
        <div className="modal-overlay" onClick={() => setEditingProduct(null)}>
          <div className="modal-card" style={{ maxWidth: '520px', width: '95%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Camera size={18} style={{ color: 'var(--accent-amber)' }} />
                <span>{editingProduct.id ? 'Editar Producto & Foto' : 'Crear Nuevo Producto'}</span>
              </div>
              <button className="btn-close-modal" onClick={() => setEditingProduct(null)}>✕</button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* PHOTO UPLOAD & PREVIEW SECTION */}
              <div style={{
                background: 'var(--bg-main)',
                border: '1.5px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ImageIcon size={14} style={{ color: 'var(--accent-amber)' }} />
                    <span>Foto del Producto (para Menú y Chatbot)</span>
                  </span>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setImageMode('upload')}
                      style={{
                        background: imageMode === 'upload' ? 'var(--accent-amber)' : 'transparent',
                        color: imageMode === 'upload' ? '#000' : 'var(--text-muted)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      Archivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageMode('url')}
                      style={{
                        background: imageMode === 'url' ? 'var(--accent-amber)' : 'transparent',
                        color: imageMode === 'url' ? '#000' : 'var(--text-muted)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      Enlace URL
                    </button>
                  </div>
                </div>

                {/* IMAGE PREVIEW OR UPLOADER */}
                {image ? (
                  <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', maxHeight: '160px', border: '1px solid var(--border-subtle)' }}>
                    <img
                      src={image}
                      alt="Previsualización"
                      style={{ width: '100%', height: '150px', objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      display: 'flex',
                      gap: '4px'
                    }}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          background: 'rgba(0,0,0,0.7)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <RefreshCw size={12} />
                        <span>Cambiar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setImage('')}
                        style={{
                          background: 'rgba(239, 68, 68, 0.85)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '4px 6px',
                          fontSize: '0.7rem',
                          cursor: 'pointer'
                        }}
                        title="Eliminar foto"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => imageMode === 'upload' && fileInputRef.current?.click()}
                    style={{
                      background: 'var(--bg-card)',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      textAlign: 'center',
                      cursor: imageMode === 'upload' ? 'pointer' : 'default',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Upload size={28} style={{ color: 'var(--accent-amber)' }} />
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {compressing ? 'Comprimiendo y optimizando foto...' : 'Haz clic para subir foto desde tu PC o celular'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Formatos compatibles: JPG, PNG, WEBP (Se optimiza automáticamente)
                    </div>
                  </div>
                )}

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />

                {/* URL Input Mode */}
                {imageMode === 'url' && (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      type="url"
                      className="custom-input-sm"
                      placeholder="Pega enlace de imagen (https://...)"
                      value={image}
                      onChange={e => setImage(e.target.value)}
                      style={{ fontSize: '0.78rem', flex: 1 }}
                    />
                  </div>
                )}
              </div>

              {/* NAME & EMOJI */}
              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Emoji:</label>
                  <input
                    type="text"
                    className="custom-input-sm"
                    style={{ fontSize: '1.2rem', textAlign: 'center' }}
                    value={emoji}
                    onChange={e => setEmoji(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Nombre del Producto:</label>
                  <input
                    type="text"
                    className="custom-input-sm"
                    placeholder="Ej: Burger Doble Bacon"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* CATEGORY & PRICE */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Categoría:</label>
                  <select className="custom-input-sm" value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="Hamburguesas">Hamburguesas</option>
                    <option value="Agregados">Agregados / Papas</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Combos">Combos</option>
                    <option value="Postres">Postres</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Precio ($):</label>
                  <input
                    type="number"
                    className="custom-input-sm"
                    placeholder="Ej: 7500"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Descripción / Ingredientes:</label>
                <input
                  type="text"
                  className="custom-input-sm"
                  placeholder="Detalle de carne, queso, pan..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Agregados & Modificadores (Separados por coma):</label>
                <input
                  type="text"
                  className="custom-input-sm"
                  placeholder="Sin cebolla, Extra Cheddar (+$800), Salsa BBQ"
                  value={modifiersStr}
                  onChange={e => setModifiersStr(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={compressing}
                className="btn-confirm-order"
                style={{ marginTop: '0.5rem', height: '40px' }}
              >
                {compressing ? 'Procesando foto...' : 'Guardar Producto & Foto'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
