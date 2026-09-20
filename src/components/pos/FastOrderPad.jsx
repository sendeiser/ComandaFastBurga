import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  ShoppingBag, 
  Plus, 
  Trash2, 
  Send, 
  MessageSquare, 
  Utensils, 
  DollarSign, 
  Sparkles, 
  Bike, 
  Store, 
  Layers,
  ChevronRight,
  Sliders,
  Columns,
  Maximize2,
  X,
  CreditCard
} from 'lucide-react';
import ItemModifierModal from './ItemModifierModal';
import PaymentModal from './PaymentModal';
import WhatsAppImportModal from './WhatsAppImportModal';
import { toastService } from '../../services/toastService';

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

  // Layout mode: 'sidebar' (Al Lado) vs 'modal' (En Modal flotante/drawer)
  const [layoutMode, setLayoutMode] = useState(() => {
    return localStorage.getItem('comandafast_layout_mode') || 'sidebar';
  });

  // Modal drawer state when in 'modal' mode
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  const searchInputRef = useRef(null);

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

  // Switch layout mode and persist
  const handleToggleLayout = (mode) => {
    setLayoutMode(mode);
    localStorage.setItem('comandafast_layout_mode', mode);
    toastService.info(mode === 'sidebar' ? 'Modo Comanda: Al Lado (Fijo)' : 'Modo Comanda: En Modal Flotante');
  };

  // Global search shortcut Ctrl+K or /
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && document.activeElement.tagName !== 'INPUT')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // F9 or Alt+P opens checkout or cart modal
      if (e.key === 'F9' || (e.altKey && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        if (cartItems.length > 0) {
          if (layoutMode === 'modal') {
            setIsCartDrawerOpen(true);
          } else {
            handleOpenPayment();
          }
        } else {
          toastService.warning('La comanda está vacía.');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems, layoutMode]);

  // Categories list
  const categories = useMemo(() => {
    return ['Todas', ...new Set(products.map(p => p.category))];
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'Todas' || p.category === selectedCategory;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart count by productId for quick badges
  const cartCounts = useMemo(() => {
    const counts = {};
    cartItems.forEach(item => {
      counts[item.productId] = (counts[item.productId] || 0) + item.qty;
    });
    return counts;
  }, [cartItems]);

  // Cart calculations
  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + (item.unitPrice * item.qty), 0);
  }, [cartItems]);

  const effectiveDelivery = channel === 'whatsapp' ? (Number(deliveryFee) || 0) : 0;
  const total = subtotal + effectiveDelivery;

  // Handlers
  const handleProductCardClick = (product) => {
    if (product.modifiers && product.modifiers.length > 0) {
      setSelectedProductForModal(product);
    } else {
      handleAddDirectItem(product);
    }
  };

  const handleAddDirectItem = (product) => {
    setCartItems(prev => {
      const idx = prev.findIndex(i => i.productId === product.id && (!i.modifiers || i.modifiers.length === 0));
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx].qty += 1;
        return updated;
      }
      return [...prev, {
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        qty: 1,
        modifiers: [],
        notes: ''
      }];
    });
    toastService.success(`+1 ${product.name} agregado`);
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
      return [...prev, { ...cartItem, id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5) }];
    });
    toastService.success(`+${cartItem.qty} ${cartItem.name} agregado`);
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
    if (cartItems.length > 0) {
      setCartItems([]);
      setCustomer({ name: '', address: '', phone: '', notes: '' });
      toastService.info('Comanda limpiada');
      setIsCartDrawerOpen(false);
    }
  };

  const handleOpenPayment = () => {
    if (cartItems.length === 0) {
      toastService.warning('La comanda está vacía. Selecciona productos primero.');
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
    setIsCartDrawerOpen(false);
    clearCart();
    toastService.success('¡Comanda confirmada y enviada a cocina! 🚀');
  };

  const handleApplyWhatsAppImport = (parsed) => {
    setChannel('whatsapp');
    setCustomer({
      name: parsed.customer?.name || '',
      address: parsed.customer?.address || '',
      phone: parsed.customer?.phone || '',
      notes: ''
    });
    setCartItems(parsed.items.map(it => ({ ...it, id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5) })));
    toastService.success('Pedido importado desde WhatsApp ✨');
    if (layoutMode === 'modal') {
      setIsCartDrawerOpen(true);
    }
  };

  // Reusable Cart Content Component (Used both in Sidebar and in Modal)
  const renderCartContent = (isModal = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* CART HEADER */}
      <div className="cart-header">
        <div className="cart-title">
          <ShoppingBag size={20} style={{ color: 'var(--accent-amber)' }} />
          <span>Comanda Actual</span>
          {cartItems.length > 0 && (
            <span className="product-in-cart-badge" style={{ position: 'static' }}>
              {cartItems.reduce((sum, i) => sum + i.qty, 0)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {cartItems.length > 0 && (
            <button 
              type="button"
              className="icon-action-btn"
              onClick={clearCart}
              title="Vaciar comanda"
              style={{ color: 'var(--accent-rose)' }}
            >
              <Trash2 size={16} />
            </button>
          )}

          {isModal && (
            <button 
              type="button"
              className="modal-close-btn"
              onClick={() => setIsCartDrawerOpen(false)}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* CHANNEL SELECTOR */}
      <div className="channel-selector-bar">
        <button 
          type="button"
          className={`channel-btn ${channel === 'whatsapp' ? 'active' : ''}`}
          onClick={() => setChannel('whatsapp')}
        >
          <Bike size={15} />
          <span>Delivery</span>
        </button>

        <button 
          type="button"
          className={`channel-btn ${channel === 'mostrador' ? 'active' : ''}`}
          onClick={() => setChannel('mostrador')}
        >
          <Store size={15} />
          <span>Mostrador</span>
        </button>

        <button 
          type="button"
          className={`channel-btn ${channel === 'mesa' ? 'active' : ''}`}
          onClick={() => setChannel('mesa')}
        >
          <Layers size={15} />
          <span>Mesa</span>
        </button>
      </div>

      {/* QUICK TOOLBAR: WHATSAPP PARSER */}
      <div className="cart-quick-toolbar">
        <button 
          type="button"
          className="btn-whatsapp-import"
          onClick={() => setIsWhatsAppImportOpen(true)}
          title="Pegar mensaje de WhatsApp (Alt+W)"
        >
          <MessageSquare size={16} />
          <span>Importar de WhatsApp</span>
        </button>
      </div>

      {/* CUSTOMER INFO FOR DELIVERY OR MESA */}
      {channel === 'whatsapp' && (
        <div className="cart-customer-box">
          <input 
            type="text"
            className="cart-customer-input"
            placeholder="Nombre del Cliente..."
            value={customer.name}
            onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
          />
          <input 
            type="text"
            className="cart-customer-input"
            placeholder="Dirección / Calle y Número..."
            value={customer.address}
            onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
          />
        </div>
      )}

      {channel === 'mesa' && (
        <div className="cart-customer-box" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Mesa Nº:</span>
          <input 
            type="number"
            className="cart-customer-input"
            style={{ width: '80px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 800 }}
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
          />
        </div>
      )}

      {/* CART ITEMS LIST */}
      <div className="cart-items-scroll">
        {cartItems.length === 0 ? (
          <div className="cart-empty-state">
            <ShoppingBag size={42} style={{ opacity: 0.3 }} />
            <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>La comanda está vacía</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Haz clic en los productos para agregarlos o importa un mensaje de WhatsApp.</p>
          </div>
        ) : (
          cartItems.map((item, idx) => (
            <div key={item.id || idx} className="cart-item-card">
              <div className="cart-item-row">
                <div className="cart-item-name">{item.name}</div>
                <div className="cart-item-price">
                  ${(item.unitPrice * item.qty).toLocaleString('es-AR')}
                </div>
              </div>

              {item.modifiers && item.modifiers.length > 0 && (
                <div className="cart-item-modifiers">
                  {item.modifiers.map((mod, mIdx) => (
                    <span key={mIdx} className="modifier-pill">
                      {mod.name} {mod.price > 0 ? `(+$${mod.price})` : ''}
                    </span>
                  ))}
                </div>
              )}

              {item.notes && (
                <div className="cart-item-notes">
                  "{item.notes}"
                </div>
              )}

              <div className="cart-item-row" style={{ marginTop: '4px' }}>
                <div className="cart-item-stepper">
                  <button 
                    type="button" 
                    className="stepper-btn" 
                    onClick={() => updateItemQty(idx, -1)}
                  >
                    -
                  </button>
                  <span className="stepper-qty">{item.qty}</span>
                  <button 
                    type="button" 
                    className="stepper-btn" 
                    onClick={() => updateItemQty(idx, 1)}
                  >
                    +
                  </button>
                </div>

                <button 
                  type="button" 
                  className="icon-action-btn"
                  style={{ width: '26px', height: '26px', border: 'none', color: 'var(--text-muted)' }}
                  onClick={() => removeItem(idx)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CART FOOTER / CHECKOUT */}
      <div className="cart-footer">
        <div className="cart-summary-lines">
          <div className="summary-row">
            <span>Subtotal Productos:</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>${subtotal.toLocaleString('es-AR')}</span>
          </div>

          {channel === 'whatsapp' && (
            <div className="summary-row">
              <span>Costo de Envío:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>${effectiveDelivery.toLocaleString('es-AR')}</span>
            </div>
          )}

          <div className="summary-row total">
            <span>Total a Cobrar:</span>
            <span className="total-amount">${total.toLocaleString('es-AR')}</span>
          </div>
        </div>

        <button 
          type="button"
          className="btn-checkout-primary"
          disabled={cartItems.length === 0}
          onClick={handleOpenPayment}
        >
          <DollarSign size={20} />
          <span>Cobrar / Confirmar Pedido</span>
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="pos-container">
      {/* LEFT: PRODUCTS CATALOG (Takes full width if layoutMode is modal, or flex 1 if sidebar) */}
      <div className="pos-catalog-panel">
        <div className="search-filter-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="search-input-wrapper" style={{ flex: 1 }}>
              <Search size={18} />
              <input 
                ref={searchInputRef}
                type="text"
                className="search-input"
                placeholder="Buscar hamburguesas, bebidas, agregados... (Ctrl+K)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* LAYOUT VIEW MODE TOGGLE (Al Lado vs En Modal) */}
            <div className="layout-mode-toggle" title="Elegir disposición de comanda">
              <button 
                type="button"
                className={`layout-mode-btn ${layoutMode === 'sidebar' ? 'active' : ''}`}
                onClick={() => handleToggleLayout('sidebar')}
                title="Mostrar comanda fija al lado"
              >
                <Columns size={14} />
                <span>Al Lado</span>
              </button>

              <button 
                type="button"
                className={`layout-mode-btn ${layoutMode === 'modal' ? 'active' : ''}`}
                onClick={() => handleToggleLayout('modal')}
                title="Mostrar comanda en modal flotante / pantalla completa"
              >
                <Maximize2 size={14} />
                <span>En Modal</span>
              </button>
            </div>
          </div>

          <div className="category-chips-scroll">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* PRODUCTS GRID */}
        <div className="products-grid-scroll">
          {filteredProducts.map(product => {
            const countInCart = cartCounts[product.id] || 0;
            return (
              <div 
                key={product.id}
                className="product-card"
                onClick={() => handleProductCardClick(product)}
              >
                {countInCart > 0 && (
                  <div className="product-in-cart-badge">
                    {countInCart}x
                  </div>
                )}

                <div className="product-card-top">
                  <span className="product-category-tag">{product.category}</span>
                  {product.modifiers && product.modifiers.length > 0 && (
                    <button
                      type="button"
                      className="icon-action-btn"
                      style={{ width: '24px', height: '24px', border: 'none' }}
                      title="Personalizar modificadores"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProductForModal(product);
                      }}
                    >
                      <Sliders size={13} style={{ color: 'var(--accent-amber)' }} />
                    </button>
                  )}
                </div>

                <div className="product-card-title">{product.name}</div>
                {product.description && (
                  <div className="product-card-desc">{product.description}</div>
                )}

                <div className="product-card-bottom">
                  <div className="product-card-price">
                    ${product.price.toLocaleString('es-AR')}
                  </div>
                  <div className="product-card-add-btn">
                    <Plus size={18} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* OPTION 1: RIGHT SIDEBAR CART ('AL LADO') */}
      {layoutMode === 'sidebar' && (
        <aside className="pos-cart-sidebar">
          {renderCartContent(false)}
        </aside>
      )}

      {/* OPTION 2: FLOATING CART BAR (when in 'modal' mode) */}
      {layoutMode === 'modal' && cartItems.length > 0 && (
        <div className="floating-cart-bar">
          <div className="floating-cart-info">
            <span className="floating-cart-badge">
              {cartItems.reduce((sum, i) => sum + i.qty, 0)} ítems
            </span>
            <span className="floating-cart-total">
              ${total.toLocaleString('es-AR')}
            </span>
          </div>

          <button 
            type="button"
            className="btn-open-cart-modal"
            onClick={() => setIsCartDrawerOpen(true)}
          >
            <ShoppingBag size={18} />
            <span>Ver Comanda / Cobrar</span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* OPTION 2: SLIDE-OVER DRAWER MODAL (when opened in 'modal' mode) */}
      {layoutMode === 'modal' && isCartDrawerOpen && (
        <div className="cart-drawer-backdrop" onClick={() => setIsCartDrawerOpen(false)}>
          <div className="cart-drawer-panel" onClick={e => e.stopPropagation()}>
            {renderCartContent(true)}
          </div>
        </div>
      )}

      {/* MODALS */}
      {selectedProductForModal && (
        <ItemModifierModal 
          product={selectedProductForModal}
          onAddToCart={handleAddToCartFromModal}
          onClose={() => setSelectedProductForModal(null)}
        />
      )}

      {isPaymentModalOpen && (
        <PaymentModal 
          total={total}
          customer={customer}
          channel={channel}
          settings={settings}
          onConfirm={handleCompleteOrder}
          onClose={() => setIsPaymentModalOpen(false)}
        />
      )}

      {isWhatsAppImportOpen && (
        <WhatsAppImportModal 
          products={products}
          onApply={handleApplyWhatsAppImport}
          onClose={() => setIsWhatsAppImportOpen(false)}
        />
      )}
    </div>
  );
}
