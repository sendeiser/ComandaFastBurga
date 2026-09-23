import React, { useState, useMemo, useEffect } from 'react';
import { storageService } from '../../services/storageService';
import { Search, ShoppingBag, Plus, Trash2, Send, MessageSquare, Utensils, DollarSign, Sparkles } from 'lucide-react';
import ItemModifierModal from './ItemModifierModal';
import PaymentModal from './PaymentModal';
import WhatsAppImportModal from './WhatsAppImportModal';
import { printerService } from '../../services/printerService';

export default function FastOrderPad({ 
  products, 
  settings, 
  onSaveOrder 
}) {
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductForModal, setSelectedProductForModal] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isWhatsAppImportOpen, setIsWhatsAppImportOpen] = useState(false);

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
    setCartItems(parsed.items.map(it => ({ ...it, id: 'item-' + Date.now() + '-' + Math.random() })));
  };

  const handleKickDrawer = () => {
    printerService.kickCashDrawer(settings);
  };

  return (
    <div className="pos-container">
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

            <button 
              type="button" 
              className="cat-pill-btn"
              style={{ background: 'linear-gradient(135deg, #15803d, #16a34a)', color: '#fff', border: 'none', gap: '6px' }}
              onClick={() => setIsWhatsAppImportOpen(true)}
              title="Pegar y parsear texto de WhatsApp"
            >
              <Sparkles size={16} />
              <span>Pegar WhatsApp</span>
            </button>
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

        {/* Products Grid */}
        <div className="product-grid">
          {filteredProducts.map(prod => (
            <div 
              key={prod.id} 
              className="product-card"
              onClick={() => handleAddDirect(prod)}
            >
              <div>
                <div className="product-emoji-icon">{prod.emoji || '🍔'}</div>
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

      {/* RIGHT: LIVE CART & TICKET PAD */}
      <div className={`pos-cart-panel ${mobileTab === 'cart' ? 'mobile-active' : ''}`}>
        <div className="cart-header">
          {/* Mobile Back Button to return to menu */}
          <button 
            type="button" 
            className="mobile-back-btn"
            onClick={() => setMobileTab('catalog')}
          >
            ← Volver al Menú
          </button>

          {/* Channel Selector */}
          <div className="channel-selector">
            <button 
              type="button"
              className={`channel-btn whatsapp ${channel === 'whatsapp' ? 'active' : ''}`}
              onClick={() => setChannel('whatsapp')}
            >
              <MessageSquare size={16} />
              <span>WhatsApp / Delivery</span>
            </button>

            <button 
              type="button"
              className={`channel-btn ${channel === 'mostrador' ? 'active' : ''}`}
              onClick={() => setChannel('mostrador')}
            >
              <ShoppingBag size={16} />
              <span>Mostrador</span>
            </button>

            <button 
              type="button"
              className={`channel-btn ${channel === 'mesa' ? 'active' : ''}`}
              onClick={() => setChannel('mesa')}
            >
              <Utensils size={16} />
              <span>Mesa Local</span>
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
                  <span className="cart-item-title">{item.name}</span>
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
              disabled={cartItems.length === 0}
              onClick={handleOpenPayment}
            >
              <Send size={20} />
              <span>Confirmar Pedido & Cobrar</span>
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
