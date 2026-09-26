// =========================================================
// CatalogPage.jsx — Página pública del catálogo ComandaFast
// Accesible en #catalog — Estilo Tripp American Burger / ola.click
// =========================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ProductModal from '../components/catalog/ProductModal';
import '../styles/catalog.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// ---- helpers ----
function formatPrice(n) {
  return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function generateWhatsAppMessage(items, subtotal, serviceType, customerName, customerAddress, customerPhone, deliveryFee, notes) {
  const lines = items.map(item => {
    const mods = [...(item.selectedMods || []).map(m => `  + ${m.name}`),
                  ...(item.selectedOptions || []).map(o => `  → ${o.name}`),
                  item.notes ? `  📝 ${item.notes}` : ''].filter(Boolean);
    return `• ${item.qty}x ${item.name} — ${formatPrice(item.unitPrice * item.qty)}${mods.length ? '\n' + mods.join('\n') : ''}`;
  });

  const total = subtotal + (deliveryFee || 0);

  return `🍔 *Mi Pedido — ComandaFast*\n\n${lines.join('\n')}\n\n` +
    `💵 *Subtotal:* ${formatPrice(subtotal)}\n` +
    (deliveryFee ? `🛵 *Delivery:* ${formatPrice(deliveryFee)}\n` : '') +
    `💰 *TOTAL:* ${formatPrice(total)}\n\n` +
    `🚀 *Tipo de entrega:* ${serviceType === 'delivery' ? 'Delivery 🛵' : 'Para llevar 🏃'}\n` +
    (customerName ? `👤 *Nombre:* ${customerName}\n` : '') +
    (serviceType === 'delivery' && customerAddress ? `📍 *Dirección:* ${customerAddress}\n` : '') +
    (customerPhone ? `📞 *Teléfono:* ${customerPhone}\n` : '') +
    (notes ? `\n📝 *Aclaraciones:* ${notes}\n` : '');
}

// ---- Cart State (simple, no external lib) ----
function useCart() {
  const [items, setItems] = useState([]);
  const totalItems = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);

  const addItem = (product, qty, selectedMods, selectedOptions, notes, unitPriceWithMods) => {
    const extraCost = (selectedMods || []).reduce((s, m) => s + (m.price || 0), 0) +
                      (selectedOptions || []).reduce((s, o) => s + (o.price || 0), 0);
    const finalPrice = unitPriceWithMods ?? (product.price + extraCost);
    const cartItem = {
      cartId: `${product.id}_${Date.now()}`,
      productId: product.id,
      name: product.name,
      emoji: product.emoji || '🍔',
      image: product.image || '',
      category: product.category || '',
      unitPrice: finalPrice,
      basePrice: product.price,
      qty,
      selectedMods: selectedMods || [],
      selectedOptions: selectedOptions || [],
      notes: notes || '',
    };
    setItems(prev => [...prev, cartItem]);
  };

  const updateQty = (cartId, qty) => {
    setItems(prev => qty <= 0 ? prev.filter(i => i.cartId !== cartId) : prev.map(i => i.cartId === cartId ? { ...i, qty } : i));
  };

  const removeItem = (cartId) => setItems(prev => prev.filter(i => i.cartId !== cartId));
  const clearCart = () => setItems([]);

  return { items, totalItems, subtotal, addItem, updateQty, removeItem, clearCart };
}

// ---- Components ----
function Toast({ message }) {
  return message ? <div className="cat-toast">{message}</div> : null;
}

function ProductCard({ product, onOpen }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div className="cat-product-card" onClick={() => onOpen(product)}>
      <div className="cat-product-card-info">
        <div className="cat-product-card-name">{product.name}</div>
        {product.description && (
          <div className="cat-product-card-desc">{product.description}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 }}>
          <span className="cat-product-card-price">{formatPrice(product.price)}</span>
          {product.originalPrice && (
            <span className="cat-product-card-original-price">{formatPrice(product.originalPrice)}</span>
          )}
          {product.discountBadge && (
            <span className="cat-product-card-badge">{product.discountBadge}</span>
          )}
          {product.freeShipping && (
            <span className="cat-product-card-badge" style={{ color: '#22c55e', background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.3)' }}>
              Envío gratis
            </span>
          )}
        </div>
      </div>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {product.image && !imgError ? (
          <div className="cat-product-card-image-wrap">
            <img
              className="cat-product-card-image"
              src={product.image}
              alt={product.name}
              onError={() => setImgError(true)}
              loading="lazy"
            />
          </div>
        ) : (
          <div className="cat-product-card-emoji">{product.emoji || '🍔'}</div>
        )}
        <button
          className="cat-add-btn"
          onClick={(e) => { e.stopPropagation(); onOpen(product); }}
          aria-label={`Agregar ${product.name}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function UpsellCard({ product, onAdd }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div className="cat-upsell-card" onClick={() => onAdd(product)}>
      <div className="cat-upsell-card-image">
        {product.image && !imgError ? (
          <img
            src={product.image}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <span style={{ fontSize: '2rem' }}>{product.emoji || '🥤'}</span>
        )}
      </div>
      <button
        className="cat-upsell-add-btn"
        onClick={(e) => { e.stopPropagation(); onAdd(product); }}
        aria-label={`Agregar ${product.name}`}
      >
        +
      </button>
      <div className="cat-upsell-card-info">
        <div className="cat-upsell-card-name">{product.name}</div>
        <div className="cat-upsell-card-price">{formatPrice(product.price)}</div>
      </div>
    </div>
  );
}

function CartItemRow({ item, onUpdateQty, onRemove }) {
  const [imgError, setImgError] = useState(false);
  const modLabels = [
    ...(item.selectedMods || []).map(m => m.name),
    ...(item.selectedOptions || []).map(o => o.name),
  ].join(', ');

  return (
    <div className="cat-cart-item">
      <div className="cat-cart-item-image">
        {item.image && !imgError ? (
          <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} onError={() => setImgError(true)} />
        ) : (
          <span>{item.emoji}</span>
        )}
      </div>
      <div className="cat-cart-item-info">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
          <span className="cat-cart-item-name" style={{ flex: 1 }}>{item.name}</span>
          <button className="cat-cart-delete-btn" onClick={() => onRemove(item.cartId)} aria-label="Eliminar">🗑</button>
        </div>
        {modLabels && <div className="cat-cart-item-mods">↓ {modLabels}</div>}
        {item.notes && <div className="cat-cart-item-mods">📝 {item.notes}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <div className="cat-cart-item-qty-controls">
            <button className="cat-cart-qty-btn" onClick={() => onUpdateQty(item.cartId, item.qty - 1)}>−</button>
            <span className="cat-cart-qty-value">{item.qty}</span>
            <button className="cat-cart-qty-btn" onClick={() => onUpdateQty(item.cartId, item.qty + 1)}>+</button>
          </div>
          <span className="cat-cart-item-price">{formatPrice(item.unitPrice * item.qty)}</span>
        </div>
      </div>
    </div>
  );
}

// ---- BUSINESS SETTINGS ----
const DEFAULT_SETTINGS = {
  nombre_local: 'ComandaFast Burgers',
  direccion: 'Av. Belgrano 1234, Centro',
  horarios: 'Miércoles a Domingos de 19:30 a 00:30 hs',
  telefono_whatsapp: '',
  alias_banco: '',
  costo_envio: 1500,
  catalogo_instagram: '',
  catalogo_whatsapp: '',
};

function isOpen(horarios) {
  // Simple open check: always show open for demo (can be enhanced with real schedule parsing)
  const now = new Date();
  const day = now.getDay(); // 0=Sunday
  const hour = now.getHours();
  // Miércoles a Domingo = days 3,4,5,6,0
  const openDays = [0, 3, 4, 5, 6];
  const inTime = hour >= 19 || (hour === 0 && now.getMinutes() < 30);
  const lateNight = hour < 1;
  return openDays.includes(day) && (hour >= 19 || lateNight);
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function CatalogPage({ onClose }) {
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI State
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [view, setView] = useState('catalog'); // 'catalog' | 'cart' | 'checkout'
  const [serviceType, setServiceType] = useState(null); // 'takeaway' | 'delivery'
  const [toast, setToast] = useState('');
  const [logoError, setLogoError] = useState(false);

  // Checkout form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  const cart = useCart();
  const sectionRefs = useRef({});
  const navRef = useRef(null);
  const toastTimer = useRef(null);

  // ---- Load products and settings from Supabase ----
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
          // Dev fallback: use demo data
          setProducts(DEMO_PRODUCTS);
          setLoading(false);
          return;
        }

        const [prodsRes, settingsRes, imagesRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/products?select=*&order=category.asc,name.asc`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
          }),
          fetch(`${SUPABASE_URL}/rest/v1/bot_config?id=eq.variables&limit=1`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
          }),
          fetch(`${SUPABASE_URL}/rest/v1/system_settings?id=eq.product_images&select=data`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
          }),
        ]);

        let imagesMap = {};
        if (imagesRes.ok) {
          const imgRows = await imagesRes.json();
          if (Array.isArray(imgRows) && imgRows.length > 0) imagesMap = imgRows[0].data || {};
        }

        if (prodsRes.ok) {
          const raw = await prodsRes.json();
          const prods = (Array.isArray(raw) ? raw : [])
            .filter(p => p && p.is_active !== false)
            .map(p => ({
              id: p.id,
              name: p.name,
              category: p.category || 'Hamburguesas',
              price: Number(p.price) || 0,
              originalPrice: p.original_price ? Number(p.original_price) : null,
              discountBadge: p.discount_badge || null,
              freeShipping: Boolean(p.free_shipping),
              emoji: p.emoji || '🍔',
              description: p.description || '',
              modifiers: Array.isArray(p.modifiers) ? p.modifiers : [],
              image: p.image || imagesMap[p.id] || '',
            }));
          setProducts(prods.length > 0 ? prods : DEMO_PRODUCTS);
        } else {
          setProducts(DEMO_PRODUCTS);
        }

        if (settingsRes.ok) {
          const sRows = await settingsRes.json();
          if (Array.isArray(sRows) && sRows.length > 0 && Array.isArray(sRows[0].data)) {
            const varMap = {};
            sRows[0].data.forEach(v => { if (v.key) varMap[v.key] = v.value ?? v.defaultValue; });
            setSettings(prev => ({ ...prev, ...varMap }));
          }
        }
      } catch (err) {
        console.warn('[CatalogPage] Error cargando datos:', err.message);
        setProducts(DEMO_PRODUCTS);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // ---- Categories ----
  const categories = [...new Set(products.map(p => p.category))];

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0]);
    }
  }, [categories]);

  // ---- Filtered products ----
  const filteredProducts = searchQuery.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : products;

  const grouped = categories.reduce((acc, cat) => {
    const items = filteredProducts.filter(p => p.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  // ---- Upsell products (bebidas/papas complementarias) ----
  const upsellCategories = ['Bebidas', 'Papas', 'Postres', 'Extras'];
  const upsellProducts = products.filter(p =>
    upsellCategories.some(cat => (p.category || '').toLowerCase().includes(cat.toLowerCase()))
  ).slice(0, 6);

  // ---- Scroll to category ----
  const scrollToCategory = (cat) => {
    setActiveCategory(cat);
    setSearchQuery('');
    setShowSearch(false);
    const ref = sectionRefs.current[cat];
    if (ref) {
      const offset = 130; // header + nav height
      const top = ref.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  // ---- Toast ----
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  }, []);

  // ---- Add to cart handler ----
  const handleAddToCart = (product, qty, selectedMods, selectedOptions, notes, unitPrice) => {
    cart.addItem(product, qty, selectedMods, selectedOptions, notes, unitPrice);
    showToast(`✅ ${product.name} agregado`);
  };

  // ---- Quick add (for upsell) ----
  const handleQuickAdd = (product) => {
    cart.addItem(product, 1, [], [], '', product.price);
    showToast(`✅ ${product.name} agregado`);
  };

  // ---- Send order via WhatsApp ----
  const handleSendOrder = () => {
    if (!customerName.trim()) {
      showToast('⚠️ Ingresá tu nombre');
      return;
    }
    if (serviceType === 'delivery' && !customerAddress.trim()) {
      showToast('⚠️ Ingresá tu dirección');
      return;
    }

    const waPhone = (settings.telefono_whatsapp || settings.telefono_contacto || '')
      .replace(/\D/g, '');
    const deliveryFee = serviceType === 'delivery' ? (Number(settings.costo_envio) || 1500) : 0;

    const message = generateWhatsAppMessage(
      cart.items,
      cart.subtotal,
      serviceType,
      customerName,
      customerAddress,
      customerPhone,
      deliveryFee,
      orderNotes,
    );

    const waUrl = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
    cart.clearCart();
    setView('catalog');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setOrderNotes('');
    setServiceType(null);
    showToast('🎉 Pedido enviado por WhatsApp');
  };

  const businessOpen = isOpen(settings.horarios);

  // ---- Instagram & WA links ----
  const igHandle = settings.catalogo_instagram || '';
  const waPhone = (settings.telefono_whatsapp || settings.telefono_contacto || '').replace(/\D/g, '');

  // ============================================================
  // RENDER VIEWS
  // ============================================================

  if (loading) {
    return (
      <div className="catalog-app" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="cat-loading">
          <div className="cat-spinner" />
          Cargando carta...
        </div>
      </div>
    );
  }

  // ---- CHECKOUT VIEW ----
  if (view === 'checkout') {
    const deliveryFee = serviceType === 'delivery' ? (Number(settings.costo_envio) || 1500) : 0;
    return (
      <div className="catalog-app">
        <div className="cat-checkout-page">
          <div className="cat-cart-header">
            <button className="cat-cart-back-btn" onClick={() => setView('cart')}>
              ← Volver al carrito
            </button>
          </div>
          <h2 className="cat-checkout-title">
            {serviceType === 'delivery' ? '🛵 Delivery' : '🏃 Para llevar'}
          </h2>

          {/* Summary */}
          <div className="cat-checkout-summary">
            {cart.items.map(item => (
              <div key={item.cartId} className="cat-checkout-summary-item">
                <span>{item.qty}x {item.name}</span>
                <span>{formatPrice(item.unitPrice * item.qty)}</span>
              </div>
            ))}
            <div className="cat-divider" />
            {deliveryFee > 0 && (
              <div className="cat-checkout-summary-item">
                <span>Costo de envío</span>
                <span>{formatPrice(deliveryFee)}</span>
              </div>
            )}
            <div className="cat-checkout-summary-total">
              <span>Total</span>
              <span>{formatPrice(cart.subtotal + deliveryFee)}</span>
            </div>
          </div>

          {/* Form */}
          <div className="cat-form-group">
            <label className="cat-form-label">Nombre *</label>
            <input className="cat-form-input" placeholder="Tu nombre" value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>
          <div className="cat-form-group">
            <label className="cat-form-label">Teléfono</label>
            <input className="cat-form-input" placeholder="Número de contacto" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} type="tel" />
          </div>
          {serviceType === 'delivery' && (
            <div className="cat-form-group">
              <label className="cat-form-label">Dirección de entrega *</label>
              <input className="cat-form-input" placeholder="Calle, número, barrio" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
            </div>
          )}
          <div className="cat-form-group">
            <label className="cat-form-label">Aclaraciones del pedido</label>
            <textarea className="cat-form-textarea" placeholder="Sin picante, con extra salsa, etc." value={orderNotes} onChange={e => setOrderNotes(e.target.value)} />
          </div>

          <button className="cat-send-order-btn" onClick={handleSendOrder}>
            <span style={{ fontSize: '1.2rem' }}>💬</span>
            Enviar pedido por WhatsApp
          </button>
        </div>
        <Toast message={toast} />
      </div>
    );
  }

  // ---- CART VIEW ----
  if (view === 'cart') {
    return (
      <div className="catalog-app">
        <div className="cat-cart-page">
          <div className="cat-cart-header">
            <button className="cat-cart-back-btn" onClick={() => setView('catalog')}>
              ← Atrás
            </button>
            <span className="cat-cart-total-top">Su carrito {formatPrice(cart.subtotal)}</span>
          </div>

          {cart.items.length === 0 ? (
            <div className="cat-empty">
              <div className="cat-empty-icon">🛒</div>
              <div className="cat-empty-text">Tu carrito está vacío.<br/>Explorá la carta y agregá lo que quieras.</div>
              <button
                style={{ marginTop: 16, background: 'var(--cat-red)', color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}
                onClick={() => setView('catalog')}
              >
                Ver carta
              </button>
            </div>
          ) : (
            <>
              {cart.items.map(item => (
                <CartItemRow
                  key={item.cartId}
                  item={item}
                  onUpdateQty={cart.updateQty}
                  onRemove={cart.removeItem}
                />
              ))}

              {/* Upsell */}
              {upsellProducts.length > 0 && (
                <div className="cat-upsell-section">
                  <div className="cat-upsell-title">Complementa tu pedido</div>
                  <div className="cat-upsell-carousel">
                    {upsellProducts.map(p => (
                      <UpsellCard key={p.id} product={p} onAdd={() => { handleQuickAdd(p); }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Service selector */}
              <div className="cat-service-selector">
                <div className="cat-service-label">Seleccioná el tipo de servicio:</div>
                <div className="cat-service-btns">
                  <button
                    className="cat-service-btn"
                    onClick={() => { setServiceType('takeaway'); setView('checkout'); }}
                  >
                    <span className="cat-service-btn-icon">🏃</span>
                    Para llevar
                    <span className="cat-service-btn-sub">Retirar en el local</span>
                  </button>
                  <button
                    className="cat-service-btn"
                    onClick={() => { setServiceType('delivery'); setView('checkout'); }}
                  >
                    <span className="cat-service-btn-icon">🛵</span>
                    A domicilio
                    <span className="cat-service-btn-sub">Delivery</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        <Toast message={toast} />
      </div>
    );
  }

  // ---- CATALOG VIEW ----
  return (
    <div className="catalog-app">
      {/* HEADER */}
      <div className="cat-header">
        <div className="cat-header-banner">
          <span className="cat-header-banner-title">{settings.nombre_local || 'ComandaFast Burgers'}</span>
        </div>
        <div className="cat-header-info">
          <div className="cat-logo-emoji">🍔</div>
          <div className="cat-business-info">
            <div className="cat-business-name">
              {settings.nombre_local || 'ComandaFast Burgers'}
              <span className={`cat-status-badge ${businessOpen ? 'open' : 'closed'}`}>
                <span className="cat-status-dot" />
                {businessOpen ? 'Abierto' : 'Cerrado'}
              </span>
            </div>
            {settings.direccion && (
              <div className="cat-business-address">
                📍 {settings.direccion}
              </div>
            )}
          </div>
          <div className="cat-header-actions">
            {waPhone && (
              <a
                className="cat-icon-btn"
                href={`https://wa.me/${waPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                title="WhatsApp"
              >
                💬
              </a>
            )}
            {igHandle && (
              <a
                className="cat-icon-btn"
                href={`https://instagram.com/${igHandle.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Instagram"
              >
                📸
              </a>
            )}
            {onClose && (
              <button className="cat-icon-btn" onClick={onClose} title="Cerrar catálogo">
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CATEGORY NAV */}
      <div className="cat-category-nav">
        <div className="cat-category-nav-inner" ref={navRef}>
          <button className="cat-search-btn" onClick={() => setShowSearch(s => !s)} aria-label="Buscar">
            🔍
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              className={`cat-category-tab ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => scrollToCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* SEARCH */}
      {showSearch && (
        <div className="cat-search-bar">
          <div className="cat-search-input-wrap">
            <span className="cat-search-icon">🔍</span>
            <input
              className="cat-search-input"
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>
      )}

      {/* CLOSED BANNER */}
      {!businessOpen && (
        <div className="cat-closed-banner">
          🌙 El local está cerrado ahora. Horarios: {settings.horarios}
        </div>
      )}

      {/* MAIN CATALOG */}
      <div className="cat-main">
        {Object.keys(grouped).length === 0 ? (
          <div className="cat-empty">
            <div className="cat-empty-icon">🔍</div>
            <div className="cat-empty-text">No encontramos productos para "{searchQuery}"</div>
          </div>
        ) : (
          Object.entries(grouped).map(([cat, prods]) => (
            <div
              key={cat}
              className="cat-section"
              ref={el => { sectionRefs.current[cat] = el; }}
              id={`cat-section-${cat}`}
            >
              <h2 className="cat-section-title">{cat}</h2>
              <div className="cat-product-grid">
                {prods.map(p => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onOpen={setSelectedProduct}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* PRODUCT MODAL */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* CART FAB */}
      {cart.totalItems > 0 && (
        <button className="cat-cart-fab" onClick={() => setView('cart')}>
          <span className="cat-cart-fab-qty">{cart.totalItems}</span>
          Ver pedido
          <span style={{ marginLeft: 'auto' }}>{formatPrice(cart.subtotal)}</span>
        </button>
      )}

      <Toast message={toast} />
    </div>
  );
}

// ---- DEMO DATA (when no Supabase configured) ----
const DEMO_PRODUCTS = [
  {
    id: 'demo-1', name: 'Doble Smash Clásica', category: 'Hamburguesas',
    price: 12500, emoji: '🍔', description: 'Doble medallón smashado, cheddar americano, pepinillos, mostaza y ketchup.',
    modifiers: [
      { name: 'Extras', type: 'increment', items: [
        { name: 'Extra Cheddar', price: 800 }, { name: 'Extra Bacon', price: 900 }, { name: 'Extra Medallón', price: 2400 }
      ]},
      { name: 'Elige tu salsa', type: 'select', maxSelect: 1, items: [
        { name: 'Ketchup', price: 0 }, { name: 'Mostaza', price: 0 }, { name: 'BBQ', price: 0 }, { name: 'Ajo', price: 0 }
      ]}
    ], image: '', originalPrice: null, discountBadge: null, freeShipping: false
  },
  {
    id: 'demo-2', name: 'Crispy Smash', category: 'Hamburguesas',
    price: 13500, emoji: '🍗', description: 'Medallón crocante, cheddar x3, mayonesa de ajo, cebolla crispy y bacon.',
    modifiers: [], image: '', originalPrice: null, discountBadge: null, freeShipping: false
  },
  {
    id: 'demo-3', name: 'Combo Cuadrilla', category: 'Combos',
    price: 18500, emoji: '🍟', description: '4 Dobles Cheeseburgers + 2 Papas Grandes.',
    modifiers: [], image: '', originalPrice: 22000, discountBadge: '15% OFF', freeShipping: true
  },
  {
    id: 'demo-4', name: 'Combo 2x1 Miércoles', category: 'Combos',
    price: 14000, emoji: '🎉', description: '2 Smash Clásicas + papas incluidas. Solo miércoles y jueves.',
    modifiers: [], image: '', originalPrice: null, discountBadge: '2x1', freeShipping: false
  },
  {
    id: 'demo-5', name: 'Papas con Cheddar', category: 'Papas',
    price: 4500, emoji: '🍟', description: 'Porción generosa de papas fritas bañadas en cheddar líquido.',
    modifiers: [], image: '', originalPrice: null, discountBadge: null, freeShipping: false
  },
  {
    id: 'demo-6', name: 'Aros de Cebolla', category: 'Papas',
    price: 4000, emoji: '🧅', description: 'Aros de cebolla rebozados y fritos al momento.',
    modifiers: [], image: '', originalPrice: null, discountBadge: null, freeShipping: false
  },
  {
    id: 'demo-7', name: 'Coca Cola 500ml', category: 'Bebidas',
    price: 2500, emoji: '🥤', description: '', modifiers: [], image: '', originalPrice: null, discountBadge: null, freeShipping: false
  },
  {
    id: 'demo-8', name: 'Agua Mineral', category: 'Bebidas',
    price: 1800, emoji: '💧', description: '', modifiers: [], image: '', originalPrice: null, discountBadge: null, freeShipping: false
  },
];
