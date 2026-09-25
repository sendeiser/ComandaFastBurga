import React, { useState, useMemo, useEffect, useRef } from 'react';
import { storageService } from '../../services/storageService';
import { Search, ShoppingBag, Plus, Minus, RotateCcw, GripVertical, Trash2, Send, MessageSquare, Utensils, DollarSign, Sparkles, Image as ImageIcon, Lock, AlertCircle } from 'lucide-react';
import ItemModifierModal from './ItemModifierModal';
import PaymentModal from './PaymentModal';
import WhatsAppImportModal from './WhatsAppImportModal';
import { printerService } from '../../services/printerService';

export default function FastOrderPad({ 
  products, 
  settings, 
  onSaveOrder,
  cashShift,
  onOpenCashModal
}) {
  const isCashOpen = Boolean(cashShift && !cashShift.isClosed);
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductForModal, setSelectedProductForModal] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isWhatsAppImportOpen, setIsWhatsAppImportOpen] = useState(false);

  // Toggle para ver fotos de productos en Mostrador (por defecto activado)
  const [showPhotos, setShowPhotos] = useState(() => {
    try {
      const saved = localStorage.getItem('comandafast_pos_show_photos');
      return saved !== null ? saved === 'true' : true;
    } catch (_) {
      return true;
    }
  });

  const toggleShowPhotos = () => {
    setShowPhotos(prev => {
      const next = !prev;
      try {
        localStorage.setItem('comandafast_pos_show_photos', String(next));
      } catch (_) {}
      return next;
    });
  };

  // Ancho manual ajustable del panel de pedido/confirmación (en px)
  const [cartWidth, setCartWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('comandafast_pos_cart_width');
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 320 && parsed <= 900) {
        return parsed;
      }
    } catch (_) {}
    return 430;
  });

  const isDraggingRef = useRef(false);
  const startDragRef = useRef({ startX: 0, startWidth: 430 });
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDownResize = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startDragRef.current = {
      startX: e.clientX,
      startWidth: cartWidth
    };
    setIsDragging(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  const handleTouchStartResize = (e) => {
    if (e.touches && e.touches.length > 0) {
      isDraggingRef.current = true;
      startDragRef.current = {
        startX: e.touches[0].clientX,
        startWidth: cartWidth
      };
      setIsDragging(true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const delta = startDragRef.current.startX - e.clientX;
      const maxW = Math.min(850, Math.floor(window.innerWidth * 0.7));
      const nextWidth = Math.max(320, Math.min(startDragRef.current.startWidth + delta, maxW));
      setCartWidth(nextWidth);
    };

    const handleTouchMove = (e) => {
      if (!isDraggingRef.current || !e.touches || e.touches.length === 0) return;
      const delta = startDragRef.current.startX - e.touches[0].clientX;
      const maxW = Math.min(850, Math.floor(window.innerWidth * 0.7));
      const nextWidth = Math.max(320, Math.min(startDragRef.current.startWidth + delta, maxW));
      setCartWidth(nextWidth);
    };

    const handleStopDrag = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        setCartWidth(curr => {
          try {
            localStorage.setItem('comandafast_pos_cart_width', String(curr));
          } catch (_) {}
          return curr;
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleStopDrag);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleStopDrag);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleStopDrag);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleStopDrag);
    };
  }, []);

  const handleStepWidth = (delta) => {
    setCartWidth(prev => {
      const maxW = Math.min(850, Math.floor(window.innerWidth * 0.7));
      const next = Math.max(320, Math.min(prev + delta, maxW));
      try {
        localStorage.setItem('comandafast_pos_cart_width', String(next));
      } catch (_) {}
      return next;
    });
  };

  const handleResetWidth = () => {
    const defaultW = 430;
    setCartWidth(defaultW);
    try {
      localStorage.setItem('comandafast_pos_cart_width', String(defaultW));
    } catch (_) {}
  };

  // Mobile tab state ('catalog' or 'cart') - only affects mobile screens <= 768px
  const [mobileTab, setMobileTab] = useState('catalog');

  // Cart State
  const [cartItems, setCartItems] = useState([]);
  const [channel, setChannel] = useState('whatsapp'); // 'whatsapp' | 'mostrador' | 'mesa'
  const [tableNumber, setTableNumber] = useState('1');
  const [customer, setCustomer] = useState({
    name: '',
    address: '',
    phone: '',
    notes: ''
  });
  const [deliveryFee, setDeliveryFee] = useState(settings?.deliveryDefaultFee || 1000);

  // System & Dynamic Categories list
  const [systemCategories, setSystemCategories] = useState(() => storageService.getCategories());

  useEffect(() => {
    const handleUpdate = () => setSystemCategories(storageService.getCategories());
    window.addEventListener('comandafast:categories_updated', handleUpdate);
    return () => window.removeEventListener('comandafast:categories_updated', handleUpdate);
  }, []);

  const categories = useMemo(() => {
    const fromProds = products.map(p => p.category).filter(Boolean);
    const fromSystem = systemCategories.map(c => c.name);
    return ['Todas', ...new Set([...fromSystem, ...fromProds])];
  }, [products, systemCategories]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'Todas' || p.category === selectedCategory;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart calculations
  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + (item.unitPrice * item.qty), 0);
  }, [cartItems]);

  const effectiveDelivery = channel === 'whatsapp' ? (Number(deliveryFee) || 0) : 0;
  const total = subtotal + effectiveDelivery;
  const totalItemsCount = useMemo(() => cartItems.reduce((acc, i) => acc + i.qty, 0), [cartItems]);

  // Handlers
  const handleAddDirect = (product) => {
    if (!isCashOpen) {
      onOpenCashModal?.();
      return;
    }
    setSelectedProductForModal(product);
  };

  const handleAddToCartFromModal = (cartItem) => {
    setCartItems(prev => {
      const idx = prev.findIndex(i => 
        i.productId === cartItem.productId && 
        JSON.stringify(i.modifiers) === JSON.stringify(cartItem.modifiers) &&
        i.notes === cartItem.notes
      );
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx].qty += cartItem.qty;
        return updated;
      }
      return [...prev, { ...cartItem, id: 'item-' + Date.now() + '-' + Math.random() }];
    });
  };

  const updateItemQty = (index, delta) => {
    setCartItems(prev => {
      const updated = [...prev];
      const newQty = updated[index].qty + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      }
      updated[index].qty = newQty;
      return updated;
    });
  };

  const removeItem = (index) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCartItems([]);
    setCustomer({ name: '', address: '', phone: '', notes: '' });
  };

  const handleOpenPayment = () => {
    if (!isCashOpen) {
      onOpenCashModal?.();
      return;
    }
    if (cartItems.length === 0) {
      alert('El pedido está vacío. Agrega productos primero.');
      return;
    }
    setIsPaymentModalOpen(true);
  };

  const handleCompleteOrder = (paymentData) => {
    const orderPayload = {
      channel,
      tableNumber: channel === 'mesa' ? tableNumber : null,
      customer,
      items: cartItems,
      subtotal,
      deliveryFee: effectiveDelivery,
      total,
      ...paymentData
    };

    onSaveOrder(orderPayload);
    setIsPaymentModalOpen(false);
    clearCart();
    setMobileTab('catalog');
  };

  const handleApplyWhatsAppImport = (parsed) => {
    setChannel('whatsapp');
    setCustomer({
      name: parsed.customer?.name || '',
      address: parsed.customer?.address || '',
      phone: parsed.customer?.phone || '',
      notes: ''
    });
    setCartItems(parsed.items.map(it => {
      const match = products.find(p => p.id === it.productId);
      return { 
        ...it, 
        image: it.image || match?.image || '',
        emoji: it.emoji || match?.emoji || '🍔',
        id: 'item-' + Date.now() + '-' + Math.random() 
      };
    }));
  };

  const handleKickDrawer = () => {
    printerService.kickCashDrawer(settings);
  };

  return (
    <div 
      className="pos-container"
      style={{ '--pos-cart-width': `${cartWidth}px` }}
    >
      {/* MOBILE SWITCHER TABS (Only visible on screens <= 768px via CSS) */}
      <div className="pos-mobile-tabs">
        <button 
          type="button" 
          className={`pos-mobile-tab-btn ${mobileTab === 'catalog' ? 'active' : ''}`}
          onClick={() => setMobileTab('catalog')}
        >
          <span>🍔 Menú ({filteredProducts.length})</span>
        </button>
        <button 
          type="button" 
          className={`pos-mobile-tab-btn ${mobileTab === 'cart' ? 'active' : ''}`}
          onClick={() => setMobileTab('cart')}
        >
          <span>🛒 Pedido ({totalItemsCount})</span>
          {total > 0 && <span style={{ fontWeight: 800 }}>${total.toLocaleString('es-AR')}</span>}
        </button>
      </div>

      {/* LEFT: PRODUCTS CATALOG */}
      <div className={`pos-catalog-panel ${mobileTab === 'catalog' ? 'mobile-active' : ''}`}>
        {/* STICKY SEARCH & CATEGORIES HEADER */}
        <div className="catalog-sticky-header">
          <div className="search-filter-bar">
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon-inside" />
              <input 
                type="text" 
                placeholder="Buscar hamburguesa, bebida, combo..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="search-filter-actions">
              <button 
                type="button" 
                className={`cat-pill-btn ${showPhotos ? 'active' : ''}`}
                onClick={toggleShowPhotos}
                title={showPhotos ? 'Ocultar fotos (modo compacto)' : 'Mostrar fotos de productos'}
                style={{ gap: '6px' }}
              >
                <ImageIcon size={16} />
                <span>{showPhotos ? 'Fotos' : 'Sin fotos'}</span>
              </button>

              <button 
                type="button" 
                className="cat-pill-btn"
                style={{ background: 'linear-gradient(135deg, #15803d, #16a34a)', color: '#fff', border: 'none', gap: '6px' }}
                onClick={() => {
                  if (!isCashOpen) {
                    onOpenCashModal?.();
                    return;
                  }
                  setIsWhatsAppImportOpen(true);
                }}
                title="Pegar y parsear texto de WhatsApp"
              >
                <Sparkles size={16} />
                <span>Pegar WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="category-scroll-pills">
            {categories.map(cat => {
              const matched = systemCategories.find(c => c.name === cat);
              const label = cat === 'Todas' ? '✨ Todas' : `${matched?.emoji || '📁'} ${cat}`;
              return (
                <button
                  key={cat}
                  type="button"
                  className={`cat-pill-btn ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* AVISO VISUAL CUANDO LA CAJA ESTÁ CERRADA */}
        {!isCashOpen && (
          <div className="pos-cash-closed-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="pos-cash-closed-icon-box">
                <Lock size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 800, color: '#f87171', fontSize: '0.95rem' }}>
                  Caja Cerrada — Abre el turno para comenzar a tomar pedidos
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Para registrar ventas en mostrador, delivery o mesas, abre la caja con el monto inicial.
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-open-cash-action"
              onClick={onOpenCashModal}
            >
              <DollarSign size={16} />
              <span>Abrir Turno de Caja</span>
            </button>
          </div>
        )}

        {/* Products Grid */}
        <div className="product-grid">
          {filteredProducts.map(prod => (
            <div 
              key={prod.id} 
              className={`product-card ${!showPhotos ? 'compact' : ''}`}
              onClick={() => handleAddDirect(prod)}
              title={!isCashOpen ? 'Caja cerrada — Haz clic para abrir el turno de caja' : 'Haz clic para agregar al pedido'}
            >
              <div>
                {showPhotos ? (
                  <div className="product-card-media">
                    {prod.image ? (
                      <img 
                        src={prod.image} 
                        alt={prod.name} 
                        className="product-card-img"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fb = e.currentTarget.parentElement?.querySelector('.product-card-fallback');
                          if (fb) fb.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="product-card-fallback"
                      style={{ display: prod.image ? 'none' : 'flex' }}
                    >
                      <span className="product-emoji-icon">{prod.emoji || '🍔'}</span>
                    </div>
                    {prod.emoji && prod.image && (
                      <span className="product-card-emoji-badge">{prod.emoji}</span>
                    )}
                  </div>
                ) : (
                  <div className="product-emoji-icon">{prod.emoji || '🍔'}</div>
                )}

                <div className="product-name">{prod.name}</div>
                <div className="product-desc">{prod.description}</div>
              </div>
              <div className="product-footer">
                <div className="product-price">${prod.price.toLocaleString('es-AR')}</div>
                <div className="product-add-badge">
                  <Plus size={18} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Floating Cart Summary Bar for Mobile */}
        {cartItems.length > 0 && (
          <div className="pos-mobile-cart-bar" onClick={() => setMobileTab('cart')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingBag size={18} style={{ color: 'var(--accent-amber)' }} />
              <span style={{ fontWeight: 700 }}>{totalItemsCount} ítems</span>
              <span style={{ color: 'var(--accent-emerald)', fontWeight: 800 }}>${total.toLocaleString('es-AR')}</span>
            </div>
            <span style={{ fontWeight: 800, color: 'var(--accent-amber)', fontSize: '0.85rem' }}>
              Ver Pedido ➔
            </span>
          </div>
        )}
      </div>

      {/* DRAGGABLE RESIZER HANDLE (Desktop only) */}
      <div 
        className={`pos-resizer-handle ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDownResize}
        onTouchStart={handleTouchStartResize}
        onDoubleClick={handleResetWidth}
        title="Arrastra para cambiar el ancho del pedido (Doble clic para restaurar 430px)"
        role="separator"
        aria-orientation="vertical"
        aria-label="Ajustar ancho del panel de pedido"
      >
        <div className="pos-resizer-line" />
        <div className="pos-resizer-grip">
          <GripVertical size={13} />
        </div>
        {isDragging && (
          <div className="pos-resizer-tooltip">
            {cartWidth}px
          </div>
        )}
      </div>

      {/* RIGHT: LIVE CART & TICKET PAD */}
      <div className={`pos-cart-panel ${mobileTab === 'cart' ? 'mobile-active' : ''} ${cartWidth < 410 ? 'compact-cart-width' : ''}`}>
        <div className="cart-header">
          {/* Mobile Back Button to return to menu */}
          <button 
            type="button" 
            className="mobile-back-btn"
            onClick={() => setMobileTab('catalog')}
          >
            ← Volver al Menú
          </button>

          {/* Top Bar with Title & Manual Width Controls */}
          <div className="cart-header-top-bar">
            <div className="cart-header-top-title">
              <ShoppingBag size={15} className="cart-title-icon" />
              <span>Pedido en Curso</span>
              {totalItemsCount > 0 && (
                <span className="cart-badge-count">{totalItemsCount}</span>
              )}
            </div>

            <div className="cart-width-controls" title="Ajustar ancho manualmente">
              <button
                type="button"
                className="cart-width-btn"
                onClick={() => handleStepWidth(-30)}
                title="Reducir ancho ( -30px )"
              >
                <Minus size={12} />
              </button>
              <span 
                className="cart-width-label" 
                title="Doble clic para restaurar (430px)"
                onDoubleClick={handleResetWidth}
              >
                {cartWidth}px
              </span>
              <button
                type="button"
                className="cart-width-btn"
                onClick={() => handleStepWidth(30)}
                title="Aumentar ancho ( +30px )"
              >
                <Plus size={12} />
              </button>
              <button
                type="button"
                className="cart-width-btn reset-btn"
                onClick={handleResetWidth}
                title="Restablecer ancho por defecto (430px)"
              >
                <RotateCcw size={11} />
              </button>
            </div>
          </div>

          {/* Channel Selector */}
          <div className="channel-selector">
            <button 
              type="button"
              className={`channel-btn whatsapp ${channel === 'whatsapp' ? 'active' : ''}`}
              onClick={() => setChannel('whatsapp')}
              title="WhatsApp / Pedido Delivery"
            >
              <MessageSquare size={cartWidth < 410 ? 14 : 16} />
              <span className="channel-label-desktop">{cartWidth < 410 ? 'Delivery' : 'WhatsApp / Delivery'}</span>
              <span className="channel-label-mobile">Delivery</span>
            </button>

            <button 
              type="button"
              className={`channel-btn ${channel === 'mostrador' ? 'active' : ''}`}
              onClick={() => setChannel('mostrador')}
              title="Venta en Mostrador"
            >
              <ShoppingBag size={cartWidth < 410 ? 14 : 16} />
              <span>Mostrador</span>
            </button>

            <button 
              type="button"
              className={`channel-btn ${channel === 'mesa' ? 'active' : ''}`}
              onClick={() => setChannel('mesa')}
              title="Consumo en Mesa Local"
            >
              <Utensils size={cartWidth < 410 ? 14 : 16} />
              <span className="channel-label-desktop">{cartWidth < 410 ? 'Mesa' : 'Mesa Local'}</span>
              <span className="channel-label-mobile">Mesa</span>
            </button>
          </div>

          {/* Contextual Fields */}
          {channel === 'whatsapp' && (
            <div className="customer-fields-bar">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <input 
                  type="text" 
                  className="custom-input-sm" 
                  placeholder="Nombre del Cliente"
                  value={customer.name}
                  onChange={e => setCustomer({ ...customer, name: e.target.value })}
                />
                <input 
                  type="text" 
                  className="custom-input-sm" 
                  placeholder="Teléfono / WhatsApp"
                  value={customer.phone}
                  onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                />
              </div>
              <input 
                type="text" 
                className="custom-input-sm" 
                placeholder="Dirección de Entrega (Calle y Nº)"
                value={customer.address}
                onChange={e => setCustomer({ ...customer, address: e.target.value })}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '0.4rem' }}>
                <input 
                  type="text" 
                  className="custom-input-sm" 
                  placeholder="Aclaración / Obs. envío"
                  value={customer.notes}
                  onChange={e => setCustomer({ ...customer, notes: e.target.value })}
                />
                <input 
                  type="number" 
                  className="custom-input-sm" 
                  placeholder="Envío ($)"
                  value={deliveryFee}
                  onChange={e => setDeliveryFee(e.target.value)}
                />
              </div>
            </div>
          )}

          {channel === 'mostrador' && (
            <div className="customer-fields-bar">
              <input 
                type="text" 
                className="custom-input-sm" 
                placeholder="Nombre o Nº de Llamador para retirar"
                value={customer.name}
                onChange={e => setCustomer({ ...customer, name: e.target.value })}
              />
            </div>
          )}

          {channel === 'mesa' && (
            <div className="customer-fields-bar" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Número de Mesa:</span>
              <select 
                className="custom-input-sm" 
                style={{ width: '100px' }}
                value={tableNumber}
                onChange={e => setTableNumber(e.target.value)}
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12,15,20].map(n => (
                  <option key={n} value={n}>Mesa #{n}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Cart Items List */}
        <div className="cart-items-scroll">
          {cartItems.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 1rem' }}>
              <ShoppingBag size={48} style={{ opacity: 0.3, margin: '0 auto 0.75rem' }} />
              <div style={{ fontWeight: 700 }}>El pedido está vacío</div>
              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Toca los productos de la izquierda para agregarlos.</div>
            </div>
          ) : (
            cartItems.map((item, idx) => (
              <div key={item.id || idx} className="cart-item-row">
                <div className="cart-item-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    {item.image ? (
                      <img 
                        src={item.image} 
                        alt={item.name} 
                        className="cart-item-thumb"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : item.emoji ? (
                      <span className="cart-item-thumb-emoji">{item.emoji}</span>
                    ) : null}
                    <span className="cart-item-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </span>
                  </div>
                  <span className="cart-item-price">${(item.unitPrice * item.qty).toLocaleString('es-AR')}</span>
                </div>

                {item.modifiers && item.modifiers.length > 0 && (
                  <div className="cart-item-modifiers">
                    {item.modifiers.map(m => (
                      <span key={m} className="modifier-chip">{m}</span>
                    ))}
                  </div>
                )}

                {item.notes && (
                  <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--accent-amber)' }}>
                    Nota: {item.notes}
                  </div>
                )}

                <div className="cart-item-controls">
                  <div className="qty-stepper">
                    <button className="qty-btn" onClick={() => updateItemQty(idx, -1)}>-</button>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>{item.qty}</span>
                    <button className="qty-btn" onClick={() => updateItemQty(idx, 1)}>+</button>
                  </div>
                  <button 
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', padding: '4px' }}
                    onClick={() => removeItem(idx)}
                    title="Quitar item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Footer */}
        <div className="cart-footer">
          <div className="cart-totals-breakdown">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal:</span>
              <span style={{ fontWeight: 700 }}>${subtotal.toLocaleString('es-AR')}</span>
            </div>
            {channel === 'whatsapp' && effectiveDelivery > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#60a5fa' }}>
                <span>Costo de Envío:</span>
                <span style={{ fontWeight: 700 }}>+${effectiveDelivery.toLocaleString('es-AR')}</span>
              </div>
            )}
            <div className="total-row-highlight">
              <span>TOTAL:</span>
              <span style={{ color: 'var(--accent-amber)' }}>${total.toLocaleString('es-AR')}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 48px', gap: '0.5rem' }}>
            <button 
              className="btn-confirm-order"
              style={!isCashOpen ? {
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.16), rgba(220, 38, 38, 0.28))',
                color: '#fca5a5',
                border: '1.5px solid rgba(239, 68, 68, 0.45)',
                boxShadow: 'none',
                cursor: 'pointer'
              } : undefined}
              disabled={isCashOpen && cartItems.length === 0}
              onClick={!isCashOpen ? onOpenCashModal : handleOpenPayment}
            >
              {!isCashOpen ? (
                <>
                  <Lock size={18} />
                  <span>Abre la Caja para Cobrar</span>
                </>
              ) : (
                <>
                  <Send size={20} />
                  <span>Confirmar Pedido & Cobrar</span>
                </>
              )}
            </button>

            <button 
              type="button"
              className="qty-btn"
              style={{ width: '100%', height: 'auto', background: 'var(--bg-main)', border: '1px solid var(--border-active)' }}
              title="Abrir Cajón de Dinero (ESC/POS)"
              onClick={handleKickDrawer}
            >
              <DollarSign size={18} style={{ color: 'var(--accent-emerald)' }} />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedProductForModal && (
        <ItemModifierModal 
          product={selectedProductForModal}
          onAddToCart={handleAddToCartFromModal}
          onClose={() => setSelectedProductForModal(null)}
        />
      )}

      {isPaymentModalOpen && (
        <PaymentModal 
          cartTotal={total}
          total={total}
          customer={customer}
          channel={channel}
          settings={settings}
          onConfirmOrder={handleCompleteOrder}
          onConfirm={handleCompleteOrder}
          onClose={() => setIsPaymentModalOpen(false)}
        />
      )}

      {isWhatsAppImportOpen && (
        <WhatsAppImportModal 
          products={products}
          onApplyOrder={handleApplyWhatsAppImport}
          onApply={handleApplyWhatsAppImport}
          onClose={() => setIsWhatsAppImportOpen(false)}
        />
      )}
    </div>
  );
}
