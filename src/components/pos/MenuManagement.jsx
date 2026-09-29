import React, { useState, useRef, useEffect, useMemo } from 'react';
import CategoryManagementModal from './CategoryManagementModal';
import ConfirmModal from '../common/ConfirmModal';
import { storageService } from '../../services/storageService';
import { 
  Plus, Edit2, Trash2, Check, UtensilsCrossed, 
  Upload, Image as ImageIcon, Link as LinkIcon, X, 
  Sparkles, Camera, RefreshCw, Layers, Search, Filter,
  QrCode
} from 'lucide-react';

export default function MenuManagement({ products = [], onSaveProducts, onOpenCatalogQR }) {
  // Sub-pestaña activa dentro del módulo de Menú
  const [activeSubTab, setActiveSubTab] = useState('products'); // 'products' | 'categories'

  // Estados de edición de producto
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteProductTarget, setDeleteProductTarget] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Hamburguesas');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [discountBadge, setDiscountBadge] = useState('');
  const [freeShipping, setFreeShipping] = useState(false);
  const [emoji, setEmoji] = useState('🍔');
  const [image, setImage] = useState('');
  const [imageMode, setImageMode] = useState('upload'); // 'upload' | 'url'
  const [description, setDescription] = useState('');
  const [modifiersStr, setModifiersStr] = useState('');
  const [compressing, setCompressing] = useState(false);
  const [available, setAvailable] = useState(true);
  const [stock, setStock] = useState('');

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
    const defaultCat = availableCategories[0]?.name || 'Promos';
    const defaultEmoji = availableCategories[0]?.emoji || '🏷️';
    setCategory(defaultCat);
    setPrice('');
    setOriginalPrice('');
    setDiscountBadge('');
    setFreeShipping(false);
    setEmoji(defaultEmoji);
    setImage('');
    setDescription('');
    setModifiersStr('');
    setAvailable(true);
    setStock('');
    setImageMode('upload');
  };

  const openEdit = (p) => {
    setEditingProduct(p);
    setName(p.name);
    setCategory(p.category);
    setPrice(p.price.toString());
    setOriginalPrice(p.originalPrice ? p.originalPrice.toString() : '');
    setDiscountBadge(p.discountBadge || '');
    setFreeShipping(Boolean(p.freeShipping));
    setEmoji(p.emoji || '🍔');
    setImage(p.image || '');
    setDescription(p.description || '');
    setModifiersStr((p.modifiers || []).join(', '));
    setAvailable(p.available !== false && p.is_active !== false);
    setStock(p.stock !== undefined && p.stock !== null ? p.stock.toString() : '');
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
      originalPrice: originalPrice ? parseFloat(originalPrice) : null,
      discountBadge: discountBadge.trim() || null,
      freeShipping: Boolean(freeShipping),
      emoji: emoji || '🍔',
      image: image.trim(),
      description: description.trim(),
      modifiers: modsArray,
      available: Boolean(available),
      is_active: Boolean(available),
      stock: stock.trim() !== '' && !isNaN(parseInt(stock, 10)) ? parseInt(stock, 10) : null
    };

    if (editingProduct.id) {
      onSaveProducts(products.map(p => p.id === editingProduct.id ? itemData : p));
    } else {
      onSaveProducts([...products, itemData]);
    }
    setEditingProduct(null);
  };

  const handleToggleStock = (e, prod) => {
    e.stopPropagation();
    const isCurrentlyAvail = prod.available !== false && prod.is_active !== false && (prod.stock === null || prod.stock === undefined || prod.stock > 0);
    const updated = products.map(p => {
      if (p.id !== prod.id) return p;
      if (isCurrentlyAvail) {
        return { ...p, available: false, is_active: false, stock: 0 };
      } else {
        return { 
          ...p, 
          available: true, 
          is_active: true, 
          stock: (p.stock !== null && p.stock !== undefined && p.stock <= 0) ? null : p.stock 
        };
      }
    });
    onSaveProducts(updated);
  };

  const handleDelete = (prod) => {
    setDeleteProductTarget(prod);
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

        {/* ACCIONES: QR CARTA DIGITAL & NUEVO PRODUCTO */}
        <div className="menu-header-actions">
          <button
            type="button"
            className="cat-pill-btn btn-menu-qr"
            onClick={onOpenCatalogQR}
            title="Generar código QR y flyer imprimible en PDF de la carta digital"
          >
            <QrCode size={15} />
            <span className="menu-btn-text-full">QR Carta Digital</span>
            <span className="menu-btn-text-short">QR</span>
          </button>

          {/* BOTÓN NUEVO PRODUCTO */}
          {activeSubTab === 'products' && (
            <button
              type="button"
              className="btn-confirm-order btn-new-product"
              onClick={openNew}
            >
              <Plus size={16} />
              <span className="menu-btn-text-full">Nuevo Producto</span>
              <span className="menu-btn-text-short">Nuevo</span>
            </button>
          )}
        </div>
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
              {filteredProducts.map(prod => {
                const isAvailable = prod.available !== false && prod.is_active !== false && (prod.stock === null || prod.stock === undefined || prod.stock > 0);
                return (
                <div 
                  key={prod.id} 
                  className="menu-product-card"
                  style={!isAvailable ? { opacity: 0.72, border: '1px dashed #ef4444' } : {}}
                >
                  <div className="menu-card-top">
                    {/* Thumbnail del Producto (Foto o Emoji) */}
                    <div className="menu-card-thumb-wrap">
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
                        <span className="menu-card-emoji-badge">
                          {prod.emoji}
                        </span>
                      )}
                    </div>

                    <div className="menu-card-info-wrap">
                      <div className="menu-card-title">
                        {prod.name}
                      </div>
                      <div className="menu-card-cat">
                        {prod.category}
                      </div>
                      {(prod.freeShipping || prod.discountBadge || !isAvailable) && (
                        <div className="product-card-promo-tags">
                          {!isAvailable && (
                            <span style={{
                              background: '#ef4444',
                              color: '#fff',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 800
                            }}>
                              🔴 AGOTADO
                            </span>
                          )}
                          {prod.freeShipping && isAvailable && (
                            <span className="badge-promo-free-shipping">🛵 Envío Gratis</span>
                          )}
                          {prod.discountBadge && isAvailable && (
                            <span className="badge-promo-tag">🏷️ {prod.discountBadge}</span>
                          )}
                        </div>
                      )}
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
                    <div className="menu-card-price-wrap">
                      {prod.originalPrice && Number(prod.originalPrice) > Number(prod.price) && (
                        <span className="menu-card-orig-price">
                          ${Number(prod.originalPrice).toLocaleString('es-AR')}
                        </span>
                      )}
                      <span className="menu-card-price">
                        ${Number(prod.price || 0).toLocaleString('es-AR')}
                      </span>
                    </div>
                    <div className="menu-card-actions">
                      {/* Alternativa 1: Botón rápido de 1 click para pausar o activar stock */}
                      <button
                        type="button"
                        className="btn-quick-stock"
                        onClick={(e) => handleToggleStock(e, prod)}
                        title={isAvailable ? 'Click para marcar como AGOTADO' : 'Click para reactivar en stock'}
                        style={{
                          border: isAvailable ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(239, 68, 68, 0.6)',
                          background: isAvailable ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.15)',
                          color: isAvailable ? '#10b981' : '#ef4444'
                        }}
                      >
                        <span className="stock-dot">{isAvailable ? '🟢' : '🔴'}</span>
                        <span className="stock-text-full">
                          {isAvailable 
                            ? (prod.stock !== null && prod.stock !== undefined ? `Stock: ${prod.stock}` : 'En Stock') 
                            : 'Agotado'}
                        </span>
                        <span className="stock-text-short">
                          {isAvailable ? 'Stock' : 'Sin'}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="btn-edit-item"
                        onClick={() => openEdit(prod)}
                        title="Editar Producto & Foto"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn-delete-item"
                        onClick={() => handleDelete(prod)}
                        title="Eliminar Producto"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
              })}
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
        <div className="modal-overlay product-edit-modal-overlay" onClick={() => setEditingProduct(null)}>
          <div className="modal-card product-edit-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header product-edit-modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={19} style={{ color: 'var(--accent-amber)' }} />
                <span>{editingProduct.id ? 'Editar Producto & Foto' : 'Crear Nuevo Producto'}</span>
              </div>
              <button type="button" className="btn-close-modal" onClick={() => setEditingProduct(null)}>✕</button>
            </div>

            <form onSubmit={handleSave} className="product-edit-form">
              <div className="product-edit-scroll-body">
                {/* SECCIÓN FOTO DEL PRODUCTO */}
                <div className="product-edit-photo-card">
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
                          padding: '2px 8px',
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
                          padding: '2px 8px',
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
                    <div className="product-edit-photo-preview-wrap">
                      <img
                        src={image}
                        alt="Previsualización"
                        className="product-edit-photo-preview-img"
                      />
                      <div className="product-edit-photo-actions-overlay">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="btn-photo-action-change"
                        >
                          <RefreshCw size={13} />
                          <span>Cambiar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setImage('')}
                          className="btn-photo-action-remove"
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
                      className="product-edit-photo-dropzone"
                    >
                      <Upload size={26} style={{ color: 'var(--accent-amber)' }} />
                      <span className="dropzone-text-title">
                        {compressing ? 'Procesando imagen...' : 'Subir foto desde este dispositivo / celular'}
                      </span>
                      <span className="dropzone-text-sub">
                        Toca aquí para elegir foto o sacar con la cámara (JPG, PNG, WEBP)
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
              <div className="product-form-field">
                <label className="product-form-label">Nombre del Producto:</label>
                <input
                  type="text"
                  required
                  className="custom-input-sm product-form-input"
                  placeholder="Ej: Hamburguesa Doble Cheddar"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div className="product-form-meta-grid">
                <div className="product-form-field field-category">
                  <label className="product-form-label">Categoría:</label>
                  <select
                    className="custom-input-sm product-form-input"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                  >
                    {availableCategories.map(c => (
                      <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="product-form-field field-emoji">
                  <label className="product-form-label">Emoji:</label>
                  <input
                    type="text"
                    className="custom-input-sm product-form-input product-form-emoji-input"
                    value={emoji}
                    onChange={e => setEmoji(e.target.value)}
                  />
                </div>

                <div className="product-form-field field-price">
                  <label className="product-form-label">Precio ($):</label>
                  <input
                    type="number"
                    required
                    className="custom-input-sm product-form-input"
                    placeholder="8000"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                  />
                </div>
              </div>

              {/* SECCIÓN CONFIGURACIÓN DE PROMO Y DESCUENTOS */}
              <div className="product-form-promo-card">
                <div className="product-form-section-title text-amber">
                  <span>🏷️ Configuración de Promoción / Descuento (Opcional)</span>
                </div>

                <div className="product-form-promo-grid">
                  <div className="product-form-field">
                    <label className="product-form-label">
                      Precio antes / Tachado ($):
                    </label>
                    <input
                      type="number"
                      className="custom-input-sm product-form-input"
                      placeholder="Ej: 18500"
                      value={originalPrice}
                      onChange={e => setOriginalPrice(e.target.value)}
                    />
                  </div>

                  <div className="product-form-field">
                    <label className="product-form-label">
                      Etiqueta Promo:
                    </label>
                    <input
                      type="text"
                      className="custom-input-sm product-form-input"
                      placeholder="Ej: 25% OFF, 2x1..."
                      value={discountBadge}
                      onChange={e => setDiscountBadge(e.target.value)}
                    />
                  </div>
                </div>

                <label className="product-form-checkbox-label">
                  <input
                    type="checkbox"
                    checked={freeShipping}
                    onChange={e => setFreeShipping(e.target.checked)}
                    className="product-form-checkbox"
                  />
                  <span>🛵 <strong>Incluye Envío Gratis</strong> (Bonifica el delivery a $0 en POS y WhatsApp)</span>
                </label>
              </div>

              {/* SECCIÓN DISPONIBILIDAD Y CONTROL DE STOCK */}
              <div className={`product-form-stock-card ${available ? 'stock-active' : 'stock-inactive'}`}>
                <div className="product-form-section-title stock-header">
                  <span>📦 Disponibilidad & Control de Stock</span>
                  <span className={`stock-badge ${available ? 'badge-active' : 'badge-inactive'}`}>
                    {available ? '🟢 Activo en Menú' : '🔴 Agotado / Pausado'}
                  </span>
                </div>

                <label className="product-form-checkbox-label">
                  <input
                    type="checkbox"
                    checked={available}
                    onChange={e => setAvailable(e.target.checked)}
                    className="product-form-checkbox"
                  />
                  <span><strong>Producto Disponible para la Venta</strong> (Si lo desmarcas, se muestra como Agotado en WhatsApp y Carta Digital)</span>
                </label>

                <div className="product-form-field">
                  <label className="product-form-label">
                    Stock límite (Opcional - dejar vacío para ilimitado):
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="custom-input-sm product-form-input"
                    placeholder="Ej: 15 (se descuenta automáticamente al confirmar pedidos)"
                    value={stock}
                    onChange={e => setStock(e.target.value)}
                    disabled={!available}
                  />
                  <span className="product-form-hint">
                    💡 Cuando el stock llega a 0, el producto se marca como Agotado y desaparece de las alertas de promos.
                  </span>
                </div>
              </div>

              <div className="product-form-field">
                <label className="product-form-label">Descripción / Ingredientes:</label>
                <input
                  type="text"
                  className="custom-input-sm product-form-input"
                  placeholder="Detalle de carne, queso, pan..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div className="product-form-field">
                <label className="product-form-label">Agregados & Modificadores (Separados por coma):</label>
                <input
                  type="text"
                  className="custom-input-sm product-form-input"
                  placeholder="Sin cebolla, Extra Cheddar (+$800), Salsa BBQ"
                  value={modifiersStr}
                  onChange={e => setModifiersStr(e.target.value)}
                />
              </div>
            </div> {/* Fin de product-edit-scroll-body */}

            <div className="product-edit-footer">
              <button
                type="button"
                className="btn-cancel-product"
                onClick={() => setEditingProduct(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={compressing}
                className="btn-confirm-order btn-save-product-submit"
              >
                {compressing ? 'Procesando foto...' : (editingProduct.id ? '💾 Guardar Cambios' : '➕ Crear Producto')}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINACIÓN DE PRODUCTO */}
      <ConfirmModal
        isOpen={!!deleteProductTarget}
        title={`¿Eliminar "${deleteProductTarget?.name || 'producto'}"?`}
        message={`¿Estás seguro de que deseas eliminar este producto del menú? Ya no estará disponible para pedidos en mostrador, delivery ni en WhatsApp.`}
        confirmText="Sí, Eliminar Producto"
        cancelText="Cancelar"
        variant="danger"
        icon={Trash2}
        onConfirm={() => {
          if (deleteProductTarget) {
            onSaveProducts(products.filter(p => p.id !== deleteProductTarget.id));
            setDeleteProductTarget(null);
          }
        }}
        onCancel={() => setDeleteProductTarget(null)}
      />
    </div>
  );
}
