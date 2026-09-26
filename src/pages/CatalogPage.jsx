// =========================================================
// CatalogPage.jsx — Página pública del catálogo ComandaFast
// Accesible en #catalog — Diseño estilo Tripp American Burger / ola.click
// =========================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, Menu, Info, X, Clock, MapPin, 
  MessageCircle, ExternalLink, ChevronRight, Check,
  ShoppingBag, ArrowLeft
} from 'lucide-react';
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY } from '../services/supabaseClient';
import { storageService } from '../services/storageService';
import ProductModal from '../components/catalog/ProductModal';
import '../styles/catalog.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

// ---- helpers ----
function formatPrice(n) {
  return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

// ---- Vintage Cartoon Burger Mascot SVG ----
function RetroMascotLogo({ brandName = "BURGA'S" }) {
  const cleanBrand = (brandName || "BURGA'S").trim();
  const parts = cleanBrand.split(' ');
  const topText = (parts[0] || "BURGA'S").toUpperCase();
  const subText = (parts.slice(1).join(' ') || "CHAMICAL").toUpperCase();

  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      <rect width="120" height="120" rx="16" fill="#FFFFFF"/>
      {/* Decorative stars */}
      <path d="M20 25L22 19L27 22L22 24L20 25Z" fill="#b91c1c"/>
      <path d="M98 28L101 22L106 25L101 27L98 28Z" fill="#b91c1c"/>
      <path d="M16 80L18 75L23 77L18 79L16 80Z" fill="#b91c1c"/>
      <path d="M100 78L102 73L107 75L102 77L100 78Z" fill="#b91c1c"/>

      {/* Retro arch text */}
      <text x="60" y="24" textAnchor="middle" fill="#b91c1c" fontFamily="Impact, Arial Black, sans-serif" fontSize="16" fontWeight="900" letterSpacing="0.8">
        {topText}
      </text>

      {/* Top Bun */}
      <path d="M34 50 C34 35, 86 35, 86 50 Z" fill="#E89B35" stroke="#7A3906" strokeWidth="2.5"/>
      {/* Sesame seeds */}
      <ellipse cx="48" cy="42" rx="2.2" ry="1.2" fill="#FFF" transform="rotate(-15 48 42)"/>
      <ellipse cx="60" cy="39" rx="2.2" ry="1.2" fill="#FFF"/>
      <ellipse cx="72" cy="42" rx="2.2" ry="1.2" fill="#FFF" transform="rotate(15 72 42)"/>

      {/* Pie Eyes */}
      <ellipse cx="51" cy="48" rx="4" ry="5.5" fill="#1C1917"/>
      <ellipse cx="69" cy="48" rx="4" ry="5.5" fill="#1C1917"/>
      <circle cx="50" cy="46" r="1.4" fill="#FFF"/>
      <circle cx="68" cy="46" r="1.4" fill="#FFF"/>

      {/* Cartoon smile */}
      <path d="M49 54 Q60 63 71 54" stroke="#1C1917" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
      <ellipse cx="60" cy="59" rx="4.5" ry="2.2" fill="#DC2626"/>

      {/* Cheese layer dripping */}
      <path d="M32 53 L88 53 L83 58 L76 55 L69 61 L60 55 L52 60 L45 55 L38 58 Z" fill="#FACC15" stroke="#CA8A04" strokeWidth="1.5"/>

      {/* Patty */}
      <rect x="32" y="58" width="56" height="8" rx="3" fill="#69300C" stroke="#451A03" strokeWidth="1.5"/>

      {/* Bottom Bun */}
      <path d="M34 66 C34 73, 86 73, 86 66 Z" fill="#E89B35" stroke="#7A3906" strokeWidth="2.5"/>

      {/* Waving cartoon gloves */}
      <path d="M29 55 C21 50, 21 62, 29 63" stroke="#1C1917" strokeWidth="2.5" strokeLinecap="round" fill="#FFF"/>
      <path d="M91 55 C99 50, 99 62, 91 63" stroke="#1C1917" strokeWidth="2.5" strokeLinecap="round" fill="#FFF"/>

      {/* Subtitle */}
      <text x="60" y="86" textAnchor="middle" fill="#b91c1c" fontFamily="Arial, sans-serif" fontSize="6.5" fontWeight="900" letterSpacing="0.8">
        {subText}
      </text>
      <text x="60" y="93" textAnchor="middle" fill="#71717a" fontFamily="Arial, sans-serif" fontSize="4.5" fontWeight="700" letterSpacing="0.3">
        Hamburguesas a la plancha
      </text>

      {/* Micro zigzag decorative banner */}
      <path d="M34 98 L37 101 L40 98 L43 101 L46 98 L49 101 L52 98 L55 101 L58 98 L61 101 L64 98 L67 101 L70 98 L73 101 L76 98 L79 101 L82 98 L86 101" stroke="#b91c1c" strokeWidth="1.6" fill="none"/>
    </svg>
  );
}

// ---- Product Card (Exact Tripp Layout) ----
function ProductCard({ product, onOpen }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div className="cat-product-card" onClick={() => onOpen(product)}>
      <div className="cat-product-card-info">
        <div className="cat-product-card-name">{product.name.toUpperCase()}</div>
        {product.description && (
          <div className="cat-product-card-desc">{product.description.toUpperCase()}</div>
        )}
        <div className="cat-product-card-price-wrap">
          <span className="cat-product-card-price">{formatPrice(product.price)}</span>
          {product.originalPrice && (
            <span className="cat-product-card-original-price">{formatPrice(product.originalPrice)}</span>
          )}
          {product.discountBadge && (
            <span className="cat-product-card-badge">{product.discountBadge}</span>
          )}
          {product.freeShipping && (
            <span className="cat-product-card-badge free-shipping">
              Envío gratis
            </span>
          )}
        </div>
      </div>

      <div className="cat-product-card-image-box">
        {product.image && !imgError ? (
          <img
            className="cat-product-card-image"
            src={product.image}
            alt={product.name}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="cat-product-card-emoji">{product.emoji || '🍔'}</div>
        )}
        <button
          type="button"
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
  nombre_local: "Burga's Chamical",
  direccion: 'Av. Perón 145 (frente al super x día)',
  horarios: 'Miércoles a Domingos de 19:30 a 00:30 hs',
  telefono_whatsapp: '5493826451122',
  telefono_contacto: '5493826451122',
  costo_envio: 1500,
  envio_gratis_desde: 25000,
  catalogo_instagram: 'burgas.chamical',
  alias_banco: 'burga.chamical.nx',
  banco: 'Mercado Pago',
  titular: "Burga's Chamical"
};

// ---- DEFAULT PRODUCTS (Burga's Chamical) ----
const DEMO_PRODUCTS = [
  {
    id: 'prod-1790375950513', name: 'Clasica', category: 'Promos',
    price: 7000, emoji: '🍔', description: 'Medallón simple, cheddar, lechuga, tomate, cebolla y aderezos',
    modifiers: [
      { name: 'Opciones', type: 'select', items: [
        { name: 'Sin cebolla', price: 0 }, { name: 'Sin tomate', price: 0 }, { name: 'Sin lechuga', price: 0 }
      ]}
    ],
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
    originalPrice: 8500, discountBadge: null, freeShipping: true
  },
  {
    id: 'prod-1790376094216', name: 'DOÑA BURGA', category: 'Promos',
    price: 9000, emoji: '🏷️', description: 'Doble medallón, cheddar, cebolla caramelizada, bacon, mayonesa, ketchup y lactonesa.',
    modifiers: [
      { name: 'Extras', type: 'increment', items: [
        { name: 'Medallón extra', price: 4000 }, { name: 'Extra Bacon', price: 1500 }
      ]}
    ],
    image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80',
    originalPrice: 11000, discountBadge: 'PROMO', freeShipping: true
  },
  {
    id: 'prod-1789951532547', name: '4x4', category: 'Hamburguesas',
    price: 15000, emoji: '🍔', description: '4 medallones, cheddar, lechuga, tomate y salsa big.',
    modifiers: [],
    image: 'https://images.unsplash.com/photo-1583032015879-6799008bcff0?w=600&auto=format&fit=crop&q=80',
    originalPrice: null, discountBadge: null, freeShipping: false
  },
  {
    id: 'prod-1789951532548', name: 'BAJONERA', category: 'Hamburguesas',
    price: 11500, emoji: '🍔', description: 'Triple medallón, cuádruple cheddar americano, panceta crocante y barbacoa.',
    modifiers: [],
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80',
    originalPrice: null, discountBadge: null, freeShipping: false
  },
  {
    id: 'prod-papas-1', name: 'Papas con Cheddar y Bacon', category: 'Agregados',
    price: 6500, emoji: '🍟', description: 'Papas bastón crocantes con lluvia de panceta y cheddar fundido.',
    modifiers: [],
    image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&auto=format&fit=crop&q=80',
    originalPrice: null, discountBadge: null, freeShipping: false
  },
  {
    id: 'prod-beb-1', name: 'Coca Cola 500ml', category: 'Bebidas',
    price: 2500, emoji: '🥤', description: 'Línea Coca Cola fría 500ml',
    modifiers: [],
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=80',
    originalPrice: null, discountBadge: null, freeShipping: false
  }
];

// Check if open now based on schedule string
function isOpen(horariosStr) {
  if (!horariosStr) return true;
  return true; // por defecto abierto
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function CatalogPage({ onClose }) {
  const [products, setProducts] = useState(() => {
    try {
      const local = storageService.getProducts();
      if (Array.isArray(local) && local.length > 0) {
        const active = local.filter(p => p.is_active !== false);
        if (active.length > 0) return active;
      }
      return DEMO_PRODUCTS;
    } catch (_) {
      return DEMO_PRODUCTS;
    }
  });
  const [settings, setSettings] = useState(() => {
    try {
      const local = storageService.getSettings();
      return local && typeof local === 'object' ? { ...DEFAULT_SETTINGS, ...local } : DEFAULT_SETTINGS;
    } catch (_) {
      return DEFAULT_SETTINGS;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI State
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showCategoriesDrawer, setShowCategoriesDrawer] = useState(false);
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
      try {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
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
          if (prods.length > 0) {
            setProducts(prods);
          }
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
        console.warn('[CatalogPage] Error cargando datos de Supabase:', err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // ---- Categories (Sort Combos first if exists, like in the screenshot) ----
  const rawCategories = [...new Set(products.map(p => p.category))];
  const categories = rawCategories.sort((a, b) => {
    if (a.toLowerCase() === 'combos') return -1;
    if (b.toLowerCase() === 'combos') return 1;
    if (a.toLowerCase().includes('burger') || a.toLowerCase().includes('hamburguesa')) return -1;
    if (b.toLowerCase().includes('burger') || b.toLowerCase().includes('hamburguesa')) return 1;
    return a.localeCompare(b);
  });

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  // Auto-scroll the active tab into view in the horizontal nav
  useEffect(() => {
    if (!activeCategory || !navRef.current) return;
    const container = navRef.current;
    const activeBtn = container.querySelector('.cat-nav-tab-item.active');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeCategory]);

  // ---- Scroll Spy: IntersectionObserver to update active category on scroll ----
  const isManualScroll = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (isManualScroll.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cat = Object.keys(sectionRefs.current).find(
              k => sectionRefs.current[k] === entry.target
            );
            if (cat && cat !== activeCategory) {
              setActiveCategory(cat);
            }
          }
        }
      },
      { rootMargin: '-90px 0px -70% 0px', threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach(el => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [products, activeCategory]);


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

  // ---- Upsell products ----
  const upsellCategories = ['Bebidas', 'Papas', 'Postres', 'Extras'];
  const upsellProducts = products.filter(p =>
    upsellCategories.some(cat => (p.category || '').toLowerCase().includes(cat.toLowerCase()))
  ).slice(0, 6);

  // ---- Scroll to category ----
  const scrollToCategory = (cat) => {
    isManualScroll.current = true;
    setActiveCategory(cat);
    setSearchQuery('');
    setShowSearch(false);
    setShowCategoriesDrawer(false);
    const ref = sectionRefs.current[cat];
    if (ref) {
      const offset = 80; // sticky nav height
      const top = ref.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    // Re-enable scroll spy after smooth scroll finishes
    setTimeout(() => { isManualScroll.current = false; }, 800);
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
  const igHandle = settings.catalogo_instagram || '';
  const waPhone = (settings.telefono_whatsapp || settings.telefono_contacto || '').replace(/\D/g, '');
  const brandBannerTitle = (settings.nombre_local || "BURGA'S CHAMICAL").toUpperCase();

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
              <ArrowLeft size={16} /> Volver al carrito
            </button>
          </div>
          <h2 className="cat-checkout-title">
            {serviceType === 'delivery' ? '🛵 Entrega por Delivery' : '🏃 Retiro en el Local'}
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
            <label className="cat-form-label">Nombre y Apellido *</label>
            <input className="cat-form-input" placeholder="Tu nombre" value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>
          <div className="cat-form-group">
            <label className="cat-form-label">Teléfono de contacto</label>
            <input className="cat-form-input" placeholder="Ej: 3826..." value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} type="tel" />
          </div>
          {serviceType === 'delivery' && (
            <div className="cat-form-group">
              <label className="cat-form-label">Dirección exacta de entrega *</label>
              <input className="cat-form-input" placeholder="Calle, número, entrecalles o piso" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
            </div>
          )}
          <div className="cat-form-group">
            <label className="cat-form-label">Aclaraciones o notas del pedido</label>
            <textarea className="cat-form-textarea" placeholder="Ej: Timbre blanco, sin cebolla, etc." value={orderNotes} onChange={e => setOrderNotes(e.target.value)} />
          </div>

          <button className="cat-send-order-btn" onClick={handleSendOrder}>
            <MessageCircle size={20} />
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
              <ArrowLeft size={16} /> Seguir pidiendo
            </button>
            <span className="cat-cart-total-top">Total: {formatPrice(cart.subtotal)}</span>
          </div>

          {cart.items.length === 0 ? (
            <div className="cat-empty">
              <div className="cat-empty-icon">🛒</div>
              <div className="cat-empty-text">Tu carrito está vacío.<br/>Explorá la carta y agregá lo que quieras.</div>
              <button
                style={{ marginTop: 16, background: '#ef4444', color: 'white', border: 'none', borderRadius: 10, padding: '12px 24px', cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem' }}
                onClick={() => setView('catalog')}
              >
                VER CARTA
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
                <div className="cat-service-label">Seleccioná cómo recibirás tu pedido:</div>
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
                    <span className="cat-service-btn-sub">Envío con cadete</span>
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

  // ============================================================
  // CATALOG VIEW (Exact Tripp American Burger Style)
  // ============================================================
  return (
    <div className="catalog-app">
      {/* 1. RETRO CHECKERBOARD BANNER */}
      <div className="cat-header-banner">
        <div className="cat-header-banner-inner">
          {/* Top-left: White Pill Status Badge */}
          <div className="cat-banner-status-badge">
            <span className={`cat-status-dot-circle ${businessOpen ? 'open' : 'closed'}`} />
            <span>{businessOpen ? 'Abierto' : 'Cerrado'}</span>
          </div>

          {/* Center: Retro Brand Typography */}
          <div className="cat-banner-center-title">
            {brandBannerTitle}
          </div>

          {/* Top-right: Optional Close button */}
          {onClose && (
            <button 
              type="button" 
              className="cat-banner-close-btn" 
              onClick={onClose} 
              title="Cerrar catálogo"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* 2. CENTERED AVATAR LOGO (Overlapping the banner) */}
      <div className="cat-header-avatar-wrap">
        {settings.logo_url || settings.logo ? (
          <img 
            src={settings.logo_url || settings.logo} 
            alt="Logo" 
            className="cat-header-avatar-img"
            onError={() => setLogoError(true)}
          />
        ) : (
          <RetroMascotLogo brandName={settings.nombre_local || "BURGA'S CHAMICAL"} />
        )}
      </div>

      {/* 3. STORE HEADER INFO */}
      <div className="cat-store-info-section">
        <h1 className="cat-store-title">
          {settings.nombre_local || "Burga's Chamical"}
        </h1>
        <div className="cat-store-location">
          <MapPin size={15} style={{ flexShrink: 0 }} />
          <span>{settings.direccion || 'Av. Perón 145 (frente al super x día)'}</span>
        </div>
        <button 
          type="button"
          className="cat-store-info-btn"
          onClick={() => setShowInfoModal(true)}
        >
          <Info size={17} />
          <span>Información</span>
        </button>
      </div>

      {/* 4. STICKY CATEGORY NAVIGATION BAR */}
      <div className="cat-sticky-nav-bar">
        <div className="cat-sticky-nav-inner">
          <button 
            type="button"
            className="cat-nav-square-btn"
            onClick={() => setShowSearch(s => !s)}
            title="Buscar hamburguesas"
            aria-label="Buscar"
          >
            <Search size={18} />
          </button>
          <button 
            type="button"
            className="cat-nav-square-btn"
            onClick={() => setShowCategoriesDrawer(true)}
            title="Ver todas las categorías"
            aria-label="Menú categorías"
          >
            <Menu size={18} />
          </button>
          <div className="cat-nav-tabs-scroll" ref={navRef}>
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                className={`cat-nav-tab-item ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => scrollToCategory(cat)}
              >
                {cat.toUpperCase()}
                {activeCategory === cat && <span className="cat-nav-tab-indicator" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SEARCH BAR (Toggled) */}
      {showSearch && (
        <div className="cat-search-bar">
          <div className="cat-search-input-wrap">
            <span className="cat-search-icon"><Search size={16} /></span>
            <input
              className="cat-search-input"
              placeholder="Buscar burgers, combos, papas..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#999', cursor: 'pointer' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* CLOSED NOTICE */}
      {!businessOpen && (
        <div className="cat-closed-banner">
          🌙 En este momento estamos descansando. Horarios de cocina: {settings.horarios}
        </div>
      )}

      {/* 5. MAIN PRODUCT LISTING */}
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
              <h2 className="cat-section-title">{cat.toUpperCase()}</h2>
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

      {/* 6. FLOATING MOBILE CART BAR */}
      {cart.totalItems > 0 && (
        <div className="cat-floating-cart-bar">
          <button 
            type="button"
            className="cat-floating-cart-btn"
            onClick={() => setView('cart')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="cat-floating-cart-badge">{cart.totalItems}</span>
              <span>Ver pedido</span>
            </div>
            <span>{formatPrice(cart.subtotal)}</span>
          </button>
        </div>
      )}

      {/* 7. PRODUCT DETAIL MODAL */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* 8. INFORMATION MODAL */}
      {showInfoModal && (
        <div className="cat-modal-overlay" onClick={() => setShowInfoModal(false)}>
          <div className="cat-info-sheet" onClick={e => e.stopPropagation()}>
            <div className="cat-info-sheet-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden' }}>
                  <RetroMascotLogo brandName={settings.nombre_local || "BURGA'S CHAMICAL"} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>{settings.nombre_local || "Burga's Chamical"}</h3>
                  <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 600 }}>● Abierto ahora</span>
                </div>
              </div>
              <button 
                type="button"
                className="cat-sheet-close-btn"
                onClick={() => setShowInfoModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="cat-info-sheet-body">
              <div className="cat-info-item">
                <Clock size={18} className="cat-info-item-icon" />
                <div>
                  <div className="cat-info-item-title">Horarios de Cocina</div>
                  <div className="cat-info-item-desc">{settings.horarios}</div>
                </div>
              </div>

              <div className="cat-info-item">
                <MapPin size={18} className="cat-info-item-icon" />
                <div>
                  <div className="cat-info-item-title">Ubicación y Retiro</div>
                  <div className="cat-info-item-desc">{settings.direccion}</div>
                </div>
              </div>

              <div className="cat-info-item">
                <ShoppingBag size={18} className="cat-info-item-icon" />
                <div>
                  <div className="cat-info-item-title">Modalidades de Pedido</div>
                  <div className="cat-info-item-desc">Take Away (Retiro en local) y Delivery a domicilio.</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                {waPhone && (
                  <a 
                    href={`https://wa.me/${waPhone}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="cat-info-action-link whatsapp"
                  >
                    <MessageCircle size={18} />
                    <span>Contactar por WhatsApp</span>
                  </a>
                )}
                {igHandle && (
                  <a 
                    href={`https://instagram.com/${igHandle.replace('@', '')}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="cat-info-action-link instagram"
                  >
                    <span style={{ fontSize: '1.1rem' }}>📸</span>
                    <span>Seguinos en Instagram (@{igHandle.replace('@', '')})</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. CATEGORIES DRAWER */}
      {showCategoriesDrawer && (
        <div className="cat-modal-overlay" onClick={() => setShowCategoriesDrawer(false)}>
          <div className="cat-drawer-sheet" onClick={e => e.stopPropagation()}>
            <div className="cat-drawer-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 900, textTransform: 'uppercase', color: '#fff' }}>Categorías</h3>
              <button 
                type="button"
                className="cat-sheet-close-btn"
                onClick={() => setShowCategoriesDrawer(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="cat-drawer-body">
              {categories.map(cat => {
                const count = products.filter(p => p.category === cat).length;
                const isCurrent = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`cat-drawer-item ${isCurrent ? 'active' : ''}`}
                    onClick={() => scrollToCategory(cat)}
                  >
                    <span style={{ fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase' }}>
                      {cat}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="cat-drawer-badge">{count}</span>
                      <ChevronRight size={16} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
}


