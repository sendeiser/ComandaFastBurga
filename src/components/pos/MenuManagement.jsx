import React, { useState, useRef, useEffect, useMemo } from 'react';
import CategoryManagementModal from './CategoryManagementModal';
import { storageService } from '../../services/storageService';
import { 
  Plus, Edit2, Trash2, Check, UtensilsCrossed, 
  Upload, Image as ImageIcon, Link as LinkIcon, X, 
  Sparkles, Camera, RefreshCw, Layers, Search, Filter
} from 'lucide-react';

export default function MenuManagement({ products = [], onSaveProducts }) {
  // Sub-pestaña activa dentro del módulo de Menú
  const [activeSubTab, setActiveSubTab] = useState('products'); // 'products' | 'categories'

  // Estados de edición de producto
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

  // Estados de filtrado y categorías
  const [availableCategories, setAvailableCategories] = useState(() => storageService.getCategories());
  const [selectedFilterCategory, setSelectedFilterCategory] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handleCatsUpdated = () => setAvailableCategories(storageService.getCategories());
    window.addEventListener('comandafast:categories_updated', handleCatsUpdated);
    return () => window.removeEventListener('comandafast:categories_updated', handleCatsUpdated);
  }, []);

  const fileInputRef = useRef(null);

  const openNew = () => {
    setEditingProduct({ id: null });
    setName('');
    const defaultCat = availableCategories[0]?.name || 'Hamburguesas';
    const defaultEmoji = availableCategories[0]?.emoji || '🍔';
    setCategory(defaultCat);
    setPrice('');
    setEmoji(defaultEmoji);
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
      img.onerror = () => {
        setCompressing(false);
        alert('No se pudo procesar la imagen seleccionada.');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!name.trim() || !price) {
      alert('Por favor completa el nombre y el precio.');
      return;
    }

    const modsArray = modifiersStr
      .split(',')
      .map(m => m.trim())
      .filter(Boolean);

    const itemData = {
      id: editingProduct.id || 'prod-' + Date.now(),
      name: name.trim(),
      category,
      price: parseFloat(price) || 0,
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

  // Filtrado de productos
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCat = selectedFilterCategory === 'Todas' || (p.category || '').toLowerCase() === selectedFilterCategory.toLowerCase();
      const matchesQuery = !searchQuery.trim() || 
        (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesQuery;
    });
  }, [products, selectedFilterCategory, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* BARRA SUPERIOR CON SUB-PESTAÑAS */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-card)',
        padding: '1rem 1.25rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.35))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--accent-amber)'
          }}>
            <UtensilsCrossed size={22} style={{ color: 'var(--accent-amber)' }} />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
              MÓDULO DE MENÚ & CATEGORÍAS
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Gestiona los productos, fotos, modificadores y categorías disponibles en la plataforma
            </div>
          </div>
        </div>

        {/* SELECTOR DE SUB-PESTAÑAS: PRODUCTOS / CATEGORÍAS */}
        <div style={{
          display: 'flex',
          gap: '6px',
          background: 'var(--bg-main)',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)'
        }}>
          <button
            type="button"
            onClick={() => setActiveSubTab('products')}
            style={{
              padding: '7px 16px',
              borderRadius: '9px',
              border: 'none',
              background: activeSubTab === 'products' ? 'var(--accent-amber)' : 'transparent',
              color: activeSubTab === 'products' ? '#000' : 'var(--text-secondary)',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <span>🍔 Productos</span>
            <span style={{
              background: activeSubTab === 'products' ? 'rgba(0,0,0,0.18)' : 'var(--bg-card)',
              color: activeSubTab === 'products' ? '#000' : 'var(--text-muted)',
              padding: '2px 7px',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 900
            }}>
              {products.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('categories')}
            style={{
              padding: '7px 16px',
              borderRadius: '9px',
              border: 'none',
              background: activeSubTab === 'categories' ? 'var(--accent-amber)' : 'transparent',
              color: activeSubTab === 'categories' ? '#000' : 'var(--text-secondary)',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Layers size={16} />
            <span>📁 Categorías</span>
            <span style={{
              background: activeSubTab === 'categories' ? 'rgba(0,0,0,0.18)' : 'var(--bg-card)',
              color: activeSubTab === 'categories' ? '#000' : 'var(--text-muted)',
              padding: '2px 7px',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 900
            }}>
              {availableCategories.length}
            </span>
          </button>
        </div>

        {/* BOTÓN NUEVO PRODUCTO (SOLO EN SUB-PESTAÑA PRODUCTOS) */}
        {activeSubTab === 'products' && (
          <button
            className="btn-confirm-order"
            style={{ width: 'auto', padding: '0.55rem 1.25rem', fontSize: '0.85rem', gap: '6px' }}
            onClick={openNew}
          >
            <Plus size={18} />
            <span>Nuevo Producto</span>
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* VISTA 1: GESTIÓN DE PRODUCTOS                             */}
      {/* ========================================================= */}
      {activeSubTab === 'products' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, minHeight: 0 }}>
          
          {/* BARRA DE BÚSQUEDA Y FILTRO DE CATEGORÍAS */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            background: 'var(--bg-card)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '340px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar por nombre o ingredientes..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="search-input"
                style={{ width: '100%', height: '36px', paddingLeft: '32px', fontSize: '0.82rem' }}
              />
            </div>

            {/* PÍLDORAS DE FILTRADO POR CATEGORÍA */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', flex: '2 1 300px', paddingBottom: '2px' }}>
              <button
                type="button"
                className={`cat-pill-btn ${selectedFilterCategory === 'Todas' ? 'active' : ''}`}
                onClick={() => setSelectedFilterCategory('Todas')}
                style={{ fontSize: '0.78rem', height: '32px', padding: '0 12px', flexShrink: 0 }}
              >
                Todas ({products.length})
              </button>
              {availableCategories.map(cat => {
                const count = products.filter(p => (p.category || '').toLowerCase() === (cat.name || '').toLowerCase()).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`cat-pill-btn ${selectedFilterCategory.toLowerCase() === (cat.name || '').toLowerCase() ? 'active' : ''}`}
                    onClick={() => setSelectedFilterCategory(cat.name)}
                    style={{ fontSize: '0.78rem', height: '32px', padding: '0 12px', flexShrink: 0, gap: '4px' }}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.name}</span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* GRILLA DE PRODUCTOS */}
          {filteredProducts.length === 0 ? (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '3rem 1.5rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              margin: 'auto 0'
            }}>
              <UtensilsCrossed size={36} style={{ color: 'var(--text-muted)' }} />
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                No se encontraron productos
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {searchQuery || selectedFilterCategory !== 'Todas' 
                  ? 'Intenta restablecer la búsqueda o el filtro de categoría.'
                  : 'Aún no hay productos en el menú. ¡Crea el primero!'}
              </p>
              {(searchQuery || selectedFilterCategory !== 'Todas') && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setSelectedFilterCategory('Todas'); }}
                  className="cat-pill-btn"
                  style={{ height: '32px', padding: '0 12px', fontSize: '0.8rem' }}
                >
                  Ver Todos los Productos
                </button>
              )}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1rem',
              overflowY: 'auto',
              flex: 1,
              paddingRight: '4px'
            }}>
              {filteredProducts.map(prod => (
                <div
                  key={prod.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                    {/* Thumbnail del Producto (Foto o Emoji) */}
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
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn-edit-item"
                        onClick={() => openEdit(prod)}
                        title="Editar Producto & Foto"
                        style={{ height: '32px', width: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="btn-delete-item"
                        onClick={() => handleDelete(prod.id)}
                        title="Eliminar Producto"
                        style={{ height: '32px', width: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* VISTA 2: GESTIÓN DE CATEGORÍAS (INLINE)                   */}
      {/* ========================================================= */}
      {activeSubTab === 'categories' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <CategoryManagementModal
            isInline={true}
            products={products}
            onProductsUpdated={onSaveProducts}
          />
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL CREAR / EDITAR PRODUCTO & FOTO                     */}
      {/* ========================================================= */}
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
              {/* SECCIÓN FOTO DEL PRODUCTO */}
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

                {/* PREVISUALIZACIÓN O SUBIDA */}
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
                    <Upload size={24} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                      {compressing ? 'Procesando y optimizando imagen...' : 'Haz clic para subir foto desde tu dispositivo'}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      JPG, PNG o WEBP (se optimiza automáticamente)
                    </span>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />

                {imageMode === 'url' && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <input
                      type="url"
                      placeholder="https://ejemplo.com/hamburguesa.jpg"
                      value={image}
                      onChange={e => setImage(e.target.value)}
                      className="custom-input-sm"
                      style={{ flex: 1 }}
                    />
                  </div>
                )}
              </div>

              {/* CAMPOS DEL PRODUCTO */}
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Nombre del Producto:</label>
                <input
                  type="text"
                  required
                  className="custom-input-sm"
                  placeholder="Ej: Hamburguesa Doble Cheddar"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Emoji:</label>
                  <input
                    type="text"
                    className="custom-input-sm"
                    value={emoji}
                    onChange={e => setEmoji(e.target.value)}
                    style={{ textAlign: 'center', fontSize: '1.2rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Categoría:</label>
                  <select
                    className="custom-input-sm"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                  >
                    {availableCategories.map(c => (
                      <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Precio ($):</label>
                  <input
                    type="number"
                    required
                    className="custom-input-sm"
                    placeholder="8000"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
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
