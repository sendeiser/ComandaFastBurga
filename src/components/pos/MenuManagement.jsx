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
    setImage('');
    setDescription('');
    setModifiersStr('');
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
      if (fileInputRef.current) fileInputRef.current.value = '';
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
          const maxDimension = 600; // Máximo 600px para tamaño liviano y carga ultra rápida

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
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.80);
          setImage(compressedDataUrl);
        } catch (err) {
          console.error('Error al comprimir imagen:', err);
          setImage(event.target.result);
        } finally {
          setCompressing(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      img.onerror = () => {
        setCompressing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
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
    <div className="menu-container">
      {/* BARRA SUPERIOR CON SUB-PESTAÑAS */}
      <div className="menu-header-bar">
        <div className="menu-header-info">
          <div className="menu-header-icon-box">
            <UtensilsCrossed size={20} />
          </div>
          <div>
            <div className="menu-header-title">
              Menú & Categorías
            </div>
            <div className="menu-header-subtitle">
              Gestiona productos, modificadores y fotos
            </div>
          </div>
        </div>

        {/* SELECTOR DE SUB-PESTAÑAS: PRODUCTOS / CATEGORÍAS */}
        <div className="menu-subtabs-control">
          <button
            type="button"
            className={`menu-subtab-btn ${activeSubTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('products')}
          >
            <span>🍔 Productos</span>
            <span className="menu-subtab-badge">
              {products.length}
            </span>
          </button>

          <button
            type="button"
            className={`menu-subtab-btn ${activeSubTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('categories')}
          >
            <span>📁 Categorías</span>
            <span className="menu-subtab-badge">
              {availableCategories.length}
            </span>
          </button>
        </div>

        {/* BOTÓN NUEVO PRODUCTO */}
        {activeSubTab === 'products' && (
          <button
            type="button"
            className="btn-confirm-order btn-new-product"
            onClick={openNew}
          >
            <Plus size={17} />
            <span>Nuevo Producto</span>
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* VISTA 1: GESTIÓN DE PRODUCTOS                             */}
      {/* ========================================================= */}
      {activeSubTab === 'products' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, minHeight: 0 }}>
          
          {/* BARRA DE BÚSQUEDA Y FILTRO DE CATEGORÍAS */}
          <div className="menu-filter-bar">
            <div className="search-input-wrapper">
              <Search size={16} className="search-icon-inside" />
              <input
                type="text"
                placeholder="Buscar por nombre o ingrediente..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* PÍLDORAS DE FILTRADO POR CATEGORÍA */}
            <div className="category-scroll-pills">
              <button
                type="button"
                className={`cat-pill-btn ${selectedFilterCategory === 'Todas' ? 'active' : ''}`}
                onClick={() => setSelectedFilterCategory('Todas')}
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
            <div className="menu-empty-state">
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
            <div className="menu-products-grid">
              {filteredProducts.map(prod => (
                <div key={prod.id} className="menu-product-card">
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    {/* Thumbnail del Producto (Foto o Emoji) */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      {prod.image ? (
                        <img
                          src={prod.image}
                          alt={prod.name}
                          className="menu-card-img"
                        />
                      ) : (
                        <div className="menu-card-emoji-box">
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
                      <div className="menu-card-title">
                        {prod.name}
                      </div>
                      <div className="menu-card-cat">
                        {prod.category}
                      </div>
                      <div className="menu-card-desc">
                        {prod.description || 'Sin descripción'}
                      </div>
                    </div>
                  </div>

                  {prod.modifiers && prod.modifiers.length > 0 && (
                    <div className="menu-card-mods">
                      <strong style={{ color: 'var(--text-primary)' }}>Modificadores:</strong> {prod.modifiers.join(', ')}
                    </div>
                  )}

                  <div className="menu-card-footer">
                    <span className="menu-card-price">
                      ${Number(prod.price || 0).toLocaleString('es-AR')}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn-edit-item"
                        onClick={() => openEdit(prod)}
                        title="Editar Producto & Foto"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-delete-item"
                        onClick={() => handleDelete(prod.id)}
                        title="Eliminar Producto"
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
                    <span>Foto del Producto</span>
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
                      gap: '6px'
                    }}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          background: 'rgba(0,0,0,0.75)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '5px 9px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <RefreshCw size={13} />
                        <span>Cambiar Foto</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setImage('')}
                        style={{
                          background: 'rgba(239, 68, 68, 0.9)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Eliminar foto"
                      >
                        <X size={13} />
                        <span>Quitar</span>
                      </button>
                    </div>
                  </div>
                ) : imageMode === 'upload' ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: 'var(--bg-card)',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      border: '1px dashed var(--accent-amber)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'border-color 0.2s'
                    }}
                  >
                    <Upload size={28} style={{ color: 'var(--accent-amber)' }} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                      {compressing ? 'Procesando y optimizando imagen...' : '📷 Subir foto desde este dispositivo / celular'}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Toca aquí para seleccionar foto (JPG, PNG, WEBP)
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <input
                      type="url"
                      placeholder="https://ejemplo.com/hamburguesa.jpg"
                      value={image}
                      onChange={e => setImage(e.target.value)}
                      className="custom-input-sm"
                      style={{ width: '100%', padding: '0.6rem 0.75rem', fontSize: '0.82rem' }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Ingresa una URL directa a la imagen en internet.
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
