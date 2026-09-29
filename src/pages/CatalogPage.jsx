// =========================================================
// CatalogPage.jsx — Página pública del catálogo ComandaFast
// Accesible en #catalog — Diseño estilo Tripp American Burger / ola.click
// =========================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, Menu, Info, X, Clock, MapPin, 
  MessageCircle, ExternalLink, ChevronRight, Check,
  ShoppingBag, ArrowLeft, Plus, Minus, Trash2, Phone,
  Flame, Sparkles, Tag
} from 'lucide-react';
import { supabaseSync, DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY } from '../services/supabaseClient';
import { storageService } from '../services/storageService';
import ProductModal from '../components/catalog/ProductModal';
import '../styles/catalog.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

// ---- helpers ----
function formatPrice(n) {
  return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMesaFromUrl() {
  if (typeof window === 'undefined') return '';
  try {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('mesa')) return searchParams.get('mesa').trim();

    const hash = window.location.hash || '';
    const qIndex = hash.indexOf('?');
    if (qIndex !== -1) {
      const hashParams = new URLSearchParams(hash.substring(qIndex));
      if (hashParams.has('mesa')) return hashParams.get('mesa').trim();
    }
    const mMatch = hash.match(/mesa[=_](\w+)/i);
    if (mMatch) return mMatch[1].trim();
  } catch (_) {}
  return '';
}

function generateWhatsAppMessage(items, subtotal, serviceType, customerName, customerAddress, customerPhone, deliveryFee, notes, paymentMethod = 'efectivo', tableNumber = '') {
  const lines = items.map(item => {
    const mods = [...(item.selectedMods || []).map(m => `  + ${m.name}`),
                  ...(item.selectedOptions || []).map(o => `  → ${o.name}`),
                  item.notes ? `  📝 ${item.notes}` : ''].filter(Boolean);
    return `• ${item.qty}x ${item.name} — ${formatPrice(item.unitPrice * item.qty)}${mods.length ? '\n' + mods.join('\n') : ''}`;
  });

  const total = subtotal + (deliveryFee || 0);
  const paymentLabel = paymentMethod === 'transferencia' ? 'Transferencia Bancaria / MP 🏦' : 'Efectivo 💵';

  let deliveryTypeLabel = 'Para llevar / Mostrador 🏃';
  if (serviceType === 'delivery') {
    deliveryTypeLabel = 'Delivery con cadete 🛵';
  } else if (serviceType === 'dine_in') {
    deliveryTypeLabel = 'Comer en el Local / En Mesa 🍽️';
  }

  return `🍔 *Mi Pedido — ComandaFast*\n\n${lines.join('\n')}\n\n` +
    `💵 *Subtotal:* ${formatPrice(subtotal)}\n` +
    (deliveryFee ? `🛵 *Delivery:* ${formatPrice(deliveryFee)}\n` : '') +
    `💰 *TOTAL:* ${formatPrice(total)}\n\n` +
    `🚀 *Tipo de entrega:* ${deliveryTypeLabel}\n` +
    (serviceType === 'dine_in' && tableNumber ? `🪑 *Mesa:* Mesa ${tableNumber.replace(/^mesa\s*/i, '')}\n` : '') +
    `💳 *Forma de pago:* ${paymentLabel}\n` +
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
  const isPromo = Boolean(product.discountBadge) || (product.category || '').toLowerCase().includes('promo');
  const hasDiscount = Boolean(product.originalPrice && Number(product.originalPrice) > Number(product.price));
  const discountPercent = hasDiscount ? Math.round(((Number(product.originalPrice) - Number(product.price)) / Number(product.originalPrice)) * 100) : 0;
  const isSoldOut = product.available === false || product.is_active === false || (product.stock !== null && product.stock !== undefined && Number(product.stock) <= 0);

  return (
    <div 
      className={`cat-product-card ${isSoldOut ? 'sold-out' : ''}`} 
      onClick={() => {
        if (!isSoldOut) onOpen(product);
      }}
      style={isSoldOut ? { opacity: 0.65, cursor: 'not-allowed' } : {}}
    >
      <div className="cat-product-card-info">
        <div className="cat-product-card-name">{product.name.toUpperCase()}</div>
        {product.description && (
          <div className="cat-product-card-desc">{product.description.toUpperCase()}</div>
        )}
        <div className="cat-product-card-price-wrap">
          <span className="cat-product-card-price">{formatPrice(product.price)}</span>
          {hasDiscount && (
            <span className="cat-product-card-original-price">{formatPrice(product.originalPrice)}</span>
          )}
          {hasDiscount && discountPercent > 0 && (
            <span className="cat-product-card-discount-tag">-{discountPercent}%</span>
          )}
          {isSoldOut ? (
            <span className="cat-product-card-badge" style={{ background: '#ef4444', color: '#fff', fontWeight: 800 }}>
              🔴 AGOTADO
            </span>
          ) : isPromo ? (
            <span className="cat-product-card-badge promo-badge">
              {product.discountBadge || '🔥 PROMO'}
            </span>
          ) : null}
          {product.freeShipping && !isSoldOut && (
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
        {!isSoldOut ? (
          <button
            type="button"
            className="cat-add-btn"
            onClick={(e) => { e.stopPropagation(); onOpen(product); }}
            aria-label={`Agregar ${product.name}`}
          >
            <Plus size={16} />
          </button>
        ) : (
          <div style={{
            position: 'absolute',
            bottom: '6px',
            right: '6px',
            background: 'rgba(239, 68, 68, 0.9)',
            color: '#fff',
            fontSize: '0.65rem',
            fontWeight: 800,
            padding: '3px 6px',
            borderRadius: '12px'
          }}>
            AGOTADO
          </div>
        )}
      </div>
    </div>
  );
}

function UpsellCard({ product, onAdd }) {
  const [imgError, setImgError] = useState(false);
  const isSoldOut = product.available === false || product.is_active === false || (product.stock !== null && product.stock !== undefined && Number(product.stock) <= 0);
  if (isSoldOut) return null;
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
            decoding="async"
          />
        ) : (
          <span style={{ fontSize: '2rem' }}>{product.emoji || '🥤'}</span>
        )}
      </div>
      <button
        type="button"
        className="cat-upsell-add-btn"
        onClick={(e) => { e.stopPropagation(); onAdd(product); }}
        aria-label={`Agregar ${product.name}`}
      >
        <Plus size={14} />
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
          <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} onError={() => setImgError(true)} loading="lazy" decoding="async" />
        ) : (
          <span>{item.emoji}</span>
        )}
      </div>
      <div className="cat-cart-item-info">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span className="cat-cart-item-name" style={{ flex: 1 }}>{item.name}</span>
          <button type="button" className="cat-cart-delete-btn" onClick={() => onRemove(item.cartId)} aria-label="Eliminar del carrito" title="Eliminar">
            <Trash2 size={15} />
          </button>
        </div>
        {modLabels && <div className="cat-cart-item-mods">↓ {modLabels}</div>}
        {item.notes && <div className="cat-cart-item-mods">📝 {item.notes}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <div className="cat-cart-item-qty-controls">
            <button type="button" className="cat-cart-qty-btn" onClick={() => onUpdateQty(item.cartId, item.qty - 1)} aria-label="Disminuir cantidad">
              <Minus size={13} />
            </button>
            <span className="cat-cart-qty-value">{item.qty}</span>
            <button type="button" className="cat-cart-qty-btn" onClick={() => onUpdateQty(item.cartId, item.qty + 1)} aria-label="Aumentar cantidad">
              <Plus size={13} />
            </button>
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
  telefono_whatsapp: '5493826430159',
  telefono_contacto: '+54 9 3826 43-0159',
  costo_envio: 1500,
  envio_gratis_desde: 25000,
  catalogo_instagram: 'burga_chamical',
  alias_banco: 'burga.chamical.nx',
  banco: 'Mercado Pago',
  titular: "Burga's Chamical"
};

function formatWhatsAppPhone(phone) {
  if (!phone) return '5493826430159';
  let clean = String(phone).replace(/\D/g, '');
  if (!clean) return '5493826430159';
  if (clean.startsWith('0')) clean = clean.substring(1);
  if (clean.startsWith('549')) return clean;
  if (clean.startsWith('54')) return '549' + clean.substring(2);
  if (clean.startsWith('9')) return '54' + clean;
  return '549' + clean;
}

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
export default function CatalogPage({ initialCashShift }) {
  const [isCashOpen, setIsCashOpen] = useState(() => {
    if (initialCashShift) return !initialCashShift.isClosed;
    try {
      const local = storageService.getCashShift();
      if (local) return !local.isClosed;
    } catch (_) {}
    return false;
  });

  const [products, setProducts] = useState(() => {
    try {
      const local = storageService.getProducts();
      // Keep ALL products including sold-out (is_active: false) so they render with AGOTADO badge
      if (Array.isArray(local) && local.length > 0) return local;
      return DEMO_PRODUCTS;
    } catch (_) {
      return DEMO_PRODUCTS;
    }
  });
  const [settings, setSettings] = useState(() => {
    try {
      const local = storageService.getSettings();
      if (local && typeof local === 'object') {
        const merged = { ...DEFAULT_SETTINGS, ...local };
        if (merged.telefono_whatsapp === '5493826451122' || !merged.telefono_whatsapp) {
          merged.telefono_whatsapp = DEFAULT_SETTINGS.telefono_whatsapp;
        }
        if (merged.telefono_contacto === '5493826451122' || merged.telefono_contacto === '+54 9 3826 40-1234' || !merged.telefono_contacto) {
          merged.telefono_contacto = DEFAULT_SETTINGS.telefono_contacto;
        }
        if (merged.catalogo_instagram === 'burgas.chamical' || !merged.catalogo_instagram) {
          merged.catalogo_instagram = DEFAULT_SETTINGS.catalogo_instagram;
        }
        return merged;
      }
      return DEFAULT_SETTINGS;
    } catch (_) {
      return DEFAULT_SETTINGS;
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const local = storageService.getProducts();
      return !(Array.isArray(local) && local.length > 0);
    } catch (_) {
      return true;
    }
  });
  const [error, setError] = useState(null);

  // UI State
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showCategoriesDrawer, setShowCategoriesDrawer] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [view, setView] = useState('catalog'); // 'catalog' | 'cart' | 'checkout'
  const initialMesa = getMesaFromUrl();
  const [tableNumber, setTableNumber] = useState(initialMesa);
  const [serviceType, setServiceType] = useState(initialMesa ? 'dine_in' : null); // 'dine_in' | 'takeaway' | 'delivery'
  const [toast, setToast] = useState('');
  const [logoError, setLogoError] = useState(false);

  // Escuchar cambios de URL por si se entra con ?mesa=X
  useEffect(() => {
    const handleUrlMesa = () => {
      const uMesa = getMesaFromUrl();
      if (uMesa) {
        setTableNumber(uMesa);
        setServiceType('dine_in');
      }
    };
    window.addEventListener('hashchange', handleUrlMesa);
    window.addEventListener('popstate', handleUrlMesa);
    return () => {
      window.removeEventListener('hashchange', handleUrlMesa);
      window.removeEventListener('popstate', handleUrlMesa);
    };
  }, []);

  // Checkout form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo'); // 'efectivo' | 'transferencia'

  const cart = useCart();
  const sectionRefs = useRef({});
  const navRef = useRef(null);
  const toastTimer = useRef(null);

  // ---- Sincronización en tiempo real del estado de Caja (Abierto / Cerrado) ----
  useEffect(() => {
    let isMounted = true;

    async function checkCashStatus() {
      try {
        const active = await supabaseSync.fetchActiveCashShift();
        if (!isMounted) return;

        if (active && !active.isClosed) {
          setIsCashOpen(true);
          return;
        }

        const latest = await supabaseSync.fetchLatestCashShift();
        if (!isMounted) return;

        if (latest) {
          setIsCashOpen(!latest.isClosed);
        } else {
          const local = storageService.getCashShift();
          setIsCashOpen(Boolean(local && !local.isClosed));
        }
      } catch (_) {
        try {
          const local = storageService.getCashShift();
          if (isMounted) setIsCashOpen(Boolean(local && !local.isClosed));
        } catch (_) {}
      }
    }

    checkCashStatus();

    const interval = setInterval(checkCashStatus, 15000);

    const handleShiftEvent = () => checkCashStatus();
    window.addEventListener('comandafast:cash-shift-change', handleShiftEvent);
    window.addEventListener('comandafast:shifts_updated', handleShiftEvent);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('comandafast:cash-shift-change', handleShiftEvent);
      window.removeEventListener('comandafast:shifts_updated', handleShiftEvent);
    };
  }, [initialCashShift]);

  useEffect(() => {
    if (initialCashShift) {
      setIsCashOpen(!initialCashShift.isClosed);
    }
  }, [initialCashShift]);

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
          // Keep ALL products including sold-out so they show with AGOTADO badge
          const prods = (Array.isArray(raw) ? raw : [])
            .filter(p => p)
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
              // Preserve availability fields so AGOTADO badge works
              is_active: p.is_active !== false,
              available: p.available !== undefined ? p.available !== false : p.is_active !== false,
              stock: (p.stock !== undefined && p.stock !== null && !isNaN(Number(p.stock))) ? Number(p.stock) : null,
            }));
          if (prods.length > 0) {
            setProducts(prods);
            try { storageService.saveProducts(prods); } catch (_) {}
          }
        }

        if (settingsRes.ok) {
          const sRows = await settingsRes.json();
          if (Array.isArray(sRows) && sRows.length > 0 && Array.isArray(sRows[0].data)) {
            const varMap = {};
            sRows[0].data.forEach(v => { if (v.key) varMap[v.key] = v.value ?? v.defaultValue; });
            setSettings(prev => {
              const updated = { ...prev, ...varMap };
              try { storageService.saveSettings(updated); } catch (_) {}
              return updated;
            });
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

  // ---- Categories (Sort Promos first, then Combos, then Burgers) ----
  const rawCategories = [...new Set(products.map(p => p.category))];
  const categories = rawCategories.sort((a, b) => {
    const isPromoA = (a || '').toLowerCase().includes('promo') ? 0 : 1;
    const isPromoB = (b || '').toLowerCase().includes('promo') ? 0 : 1;
    if (isPromoA !== isPromoB) return isPromoA - isPromoB;

    if (a.toLowerCase() === 'combos') return -1;
    if (b.toLowerCase() === 'combos') return 1;
    if (a.toLowerCase().includes('burger') || a.toLowerCase().includes('hamburguesa')) return -1;
    if (b.toLowerCase().includes('burger') || b.toLowerCase().includes('hamburguesa')) return 1;
    return a.localeCompare(b);
  });

  // ---- Promos del Día (Productos en categoría Promos o con descuento activo) ----
  const promoProducts = products.filter(p => 
    (p.category || '').toLowerCase().includes('promo') ||
    Boolean(p.discountBadge) ||
    Boolean(p.originalPrice && Number(p.originalPrice) > Number(p.price))
  );

  // Helper to check if a product is sold out (consistent logic)
  const isProductSoldOut = (p) => p && (
    p.available === false ||
    p.is_active === false ||
    (p.stock !== null && p.stock !== undefined && Number(p.stock) <= 0)
  );

  const allPromosSoldOut = promoProducts.length > 0 && promoProducts.every(p => isProductSoldOut(p));
  const activePromosCount = promoProducts.filter(p => !isProductSoldOut(p)).length;

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

    // Auto-scroll the nav button horizontally into view
    if (navRef.current) {
      const activeBtn = navRef.current.querySelector(`[data-cat="${cat}"]`);
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }

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
    if (serviceType === 'dine_in' && !tableNumber.trim()) {
      showToast('⚠️ Ingresá tu número de mesa');
      return;
    }
    if (serviceType === 'delivery' && !customerAddress.trim()) {
      showToast('⚠️ Ingresá tu dirección');
      return;
    }

    const waPhone = formatWhatsAppPhone(settings.telefono_whatsapp || settings.telefono_contacto);
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
      paymentMethod,
      tableNumber
    );

    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
    cart.clearCart();
    setView('catalog');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setOrderNotes('');
    setPaymentMethod('efectivo');
    // Si la mesa vino por URL se conserva, sino se limpia
    const urlMesa = getMesaFromUrl();
    if (!urlMesa) {
      setTableNumber('');
      setServiceType(null);
    } else {
      setServiceType('dine_in');
    }
    showToast('🎉 Pedido enviado por WhatsApp');
  };

  const businessOpen = isCashOpen;
  const igHandle = settings.catalogo_instagram || 'burga_chamical';
  const waPhone = formatWhatsAppPhone(settings.telefono_whatsapp || settings.telefono_contacto);
  const displayPhone = settings.telefono_contacto || '+54 9 3826 43-0159';
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
            <button type="button" className="cat-cart-back-btn" onClick={() => setView('cart')}>
              <ArrowLeft size={16} /> Volver al carrito
            </button>
            <span className="cat-cart-total-top">{formatPrice(cart.subtotal + deliveryFee)}</span>
          </div>
          <h2 className="cat-checkout-title">
            {serviceType === 'delivery' 
              ? '🛵 Entrega por Delivery' 
              : serviceType === 'dine_in' 
                ? '🍽️ Consumo en el Local / En Mesa' 
                : '🏃 Retiro en el Local (Mostrador)'}
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
          {serviceType === 'dine_in' && (
            <div className="cat-form-group">
              <label className="cat-form-label">Número de Mesa o Ubicación en el Local *</label>
              <input 
                className="cat-form-input" 
                placeholder="Ej: Mesa 4, Barra, Patio 2..." 
                value={tableNumber} 
                onChange={e => setTableNumber(e.target.value)} 
                autoFocus={!tableNumber}
              />
            </div>
          )}
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
          {/* Selector de Forma de Pago */}
          <div className="cat-form-group">
            <label className="cat-form-label">Forma de Pago *</label>
            <div className="cat-payment-options">
              <button
                type="button"
                className={`cat-payment-btn ${paymentMethod === 'efectivo' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('efectivo')}
              >
                <span className="cat-payment-icon">💵</span>
                <div className="cat-payment-text">
                  <strong>Efectivo</strong>
                  <small>{serviceType === 'delivery' ? 'Abonás al recibir' : serviceType === 'dine_in' ? 'Abonás en mesa o en caja' : 'Abonás al retirar'}</small>
                </div>
                {paymentMethod === 'efectivo' && <Check size={16} className="cat-payment-check" />}
              </button>

              <button
                type="button"
                className={`cat-payment-btn ${paymentMethod === 'transferencia' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('transferencia')}
              >
                <span className="cat-payment-icon">🏦</span>
                <div className="cat-payment-text">
                  <strong>Transferencia</strong>
                  <small>Alias / CBU</small>
                </div>
                {paymentMethod === 'transferencia' && <Check size={16} className="cat-payment-check" />}
              </button>
            </div>
            {paymentMethod === 'transferencia' && (
              <div className="cat-payment-notice">
                ℹ️ Al enviar el pedido recibirás el Alias y CBU por WhatsApp para transferir y adjuntar el comprobante.
              </div>
            )}
          </div>

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
            <button type="button" className="cat-cart-back-btn" onClick={() => setView('catalog')}>
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
                    type="button"
                    className={`cat-service-btn ${serviceType === 'dine_in' ? 'active' : ''}`}
                    onClick={() => { setServiceType('dine_in'); setView('checkout'); }}
                  >
                    <span className="cat-service-btn-icon">🍽️</span>
                    En el local
                    <span className="cat-service-btn-sub">Mesa o salón</span>
                  </button>
                  <button
                    type="button"
                    className={`cat-service-btn ${serviceType === 'takeaway' ? 'active' : ''}`}
                    onClick={() => { setServiceType('takeaway'); setView('checkout'); }}
                  >
                    <span className="cat-service-btn-icon">🏃</span>
                    Para llevar
                    <span className="cat-service-btn-sub">Retirar en el local</span>
                  </button>
                  <button
                    type="button"
                    className={`cat-service-btn ${serviceType === 'delivery' ? 'active' : ''}`}
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
          <div className={`cat-banner-status-badge ${isCashOpen ? 'open' : 'closed'}`}>
            <span className={`cat-status-dot-circle ${isCashOpen ? 'open' : 'closed'}`} />
            <span>{isCashOpen ? 'Abierto' : 'Cerrado'}</span>
          </div>

          {/* Center: Retro Brand Typography */}
          <div className="cat-banner-center-title">
            {brandBannerTitle}
          </div>
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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          <button 
            type="button"
            className="cat-store-info-btn"
            onClick={() => setShowInfoModal(true)}
          >
            <Info size={17} />
            <span>Información</span>
          </button>

          {tableNumber ? (
            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1.5px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 20,
                padding: '4px 12px',
                fontSize: '0.82rem',
                fontWeight: 800,
                color: '#b91c1c'
              }}
            >
              <span>🍽️ {tableNumber.toLowerCase().startsWith('mesa') ? tableNumber : `Mesa ${tableNumber}`}</span>
              <button
                type="button"
                onClick={() => {
                  const newMesa = window.prompt('Modificar tu número de mesa o barra:', tableNumber);
                  if (newMesa !== null) {
                    setTableNumber(newMesa.trim());
                    if (newMesa.trim()) setServiceType('dine_in');
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#71717a',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textDecoration: 'underline',
                  padding: 0
                }}
                title="Modificar mesa"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                const chosen = window.prompt('¿En qué mesa o ubicación estás sentado? (Ej: 1, 4, Barra)');
                if (chosen && chosen.trim()) {
                  setTableNumber(chosen.trim());
                  setServiceType('dine_in');
                  showToast(`🍽️ Asignada ${chosen.trim().toLowerCase().startsWith('mesa') ? chosen.trim() : `Mesa ${chosen.trim()}`}`);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'var(--cat-surface)',
                border: '1px solid var(--cat-border-strong)',
                borderRadius: 20,
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--cat-text-muted)',
                cursor: 'pointer'
              }}
            >
              <span>🍽️ ¿Estás en el local?</span>
            </button>
          )}
        </div>
      </div>

      {/* 3.1 CARTELITO / BANNER DE PROMOS DEL DÍA */}
      {promoProducts.length > 0 && (
        <div className="cat-promos-banner-wrap">
          <div className="cat-promos-banner" style={allPromosSoldOut ? { opacity: 0.85, borderColor: 'rgba(239,68,68,0.4)' } : {}}>
            <div className="cat-promos-banner-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div className="cat-promos-badge" style={allPromosSoldOut ? { background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)' } : {}}>
                  {allPromosSoldOut ? (
                    <span style={{ fontSize: '0.75rem' }}>⚠️</span>
                  ) : (
                    <Flame size={14} className="cat-flame-icon" />
                  )}
                  <span>PROMOS DEL DÍA</span>
                </div>
                <span className="cat-promos-badge-sub" style={allPromosSoldOut ? { color: '#ef4444' } : {}}>
                  {allPromosSoldOut ? '🔴 AGOTADAS (válido hasta agotar stock)' : '¡Imperdibles de hoy! 🔥'}
                </span>
              </div>
              <button 
                type="button" 
                className="cat-promos-banner-action"
                onClick={() => {
                  const promoCat = categories.find(c => c.toLowerCase().includes('promo')) || categories[0];
                  scrollToCategory(promoCat);
                }}
              >
                Ver todas ➔
              </button>
            </div>
            <div className="cat-promos-items-scroll">
              {promoProducts.map(p => {
                const hasDiscount = Boolean(p.originalPrice && Number(p.originalPrice) > Number(p.price));
                const chipSoldOut = isProductSoldOut(p);
                return (
                  <div 
                    key={p.id} 
                    className="cat-promo-chip"
                    onClick={() => { if (!chipSoldOut) setSelectedProduct(p); }}
                    role="button"
                    tabIndex={0}
                    style={chipSoldOut ? { opacity: 0.6, cursor: 'not-allowed', filter: 'grayscale(0.4)' } : {}}
                  >
                    <div className="cat-promo-chip-media" style={{ position: 'relative' }}>
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="cat-promo-chip-img" loading="lazy" />
                      ) : (
                        <span className="cat-promo-chip-emoji">{p.emoji || '🍔'}</span>
                      )}
                      {chipSoldOut && (
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: 'rgba(0,0,0,0.45)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: 'inherit'
                        }}>
                          <span style={{ fontSize: '0.6rem', fontWeight: 900, color: '#fff', background: 'rgba(239,68,68,0.9)', padding: '2px 5px', borderRadius: 8 }}>AGOTADA</span>
                        </div>
                      )}
                    </div>
                    <div className="cat-promo-chip-info">
                      <span className="cat-promo-chip-name">{p.name}</span>
                      <div className="cat-promo-chip-prices">
                        <span className="cat-promo-chip-price">{formatPrice(p.price)}</span>
                        {hasDiscount && (
                          <span className="cat-promo-chip-old-price">{formatPrice(p.originalPrice)}</span>
                        )}
                      </div>
                    </div>
                    {chipSoldOut ? (
                      <div
                        style={{
                          padding: '5px 10px',
                          borderRadius: 20,
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          background: 'rgba(239,68,68,0.15)',
                          color: '#ef4444',
                          border: '1px solid rgba(239,68,68,0.4)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        🔴 Agotada
                      </div>
                    ) : (
                      <button 
                        type="button" 
                        className="cat-promo-chip-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProduct(p);
                        }}
                      >
                        Pedir
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
            {categories.map(cat => {
              const isPromoCat = cat.toLowerCase().includes('promo');
              return (
                <button
                  key={cat}
                  data-cat={cat}
                  type="button"
                  className={`cat-nav-tab-item ${activeCategory === cat ? 'active' : ''} ${isPromoCat ? 'is-promo-tab' : ''}`}
                  onClick={() => scrollToCategory(cat)}
                >
                  {cat.toUpperCase()}
                  {activeCategory === cat && <span className="cat-nav-tab-indicator" />}
                </button>
              );
            })}
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
      {!isCashOpen && (
        <div className="cat-closed-banner">
          🌙 En este momento la caja del local está cerrada. Horarios de cocina: {settings.horarios}
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
          Object.entries(grouped).map(([cat, prods]) => {
            const isPromoCat = cat.toLowerCase().includes('promo');
            return (
              <div
                key={cat}
                className="cat-section"
                ref={el => { sectionRefs.current[cat] = el; }}
                id={`cat-section-${cat}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h2 className="cat-section-title" style={{ marginBottom: 0 }}>
                    {isPromoCat ? `🔥 ${cat.toUpperCase()}` : cat.toUpperCase()}
                  </h2>
                  {isPromoCat && (
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#f97316', background: 'rgba(249, 115, 22, 0.12)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(249, 115, 22, 0.3)', textTransform: 'uppercase' }}>
                      ⚡ Especiales de Hoy
                    </span>
                  )}
                </div>

                {isPromoCat && (() => {
                  const sectionPromos = prods;
                  const allSectionSoldOut = sectionPromos.length > 0 && sectionPromos.every(p => isProductSoldOut(p));
                  return allSectionSoldOut ? (
                    <div className="cat-promos-section-callout" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }}>
                      <span style={{ flexShrink: 0 }}>⚠️</span>
                      <span style={{ color: '#ef4444' }}>¡Promociones agotadas por el momento (válido únicamente hasta agotar stock)! Disfrutá del resto de nuestra carta recién salida de la plancha. 🔥</span>
                    </div>
                  ) : (
                    <div className="cat-promos-section-callout">
                      <Flame size={16} style={{ color: '#f97316', flexShrink: 0 }} />
                      <span>🔥 ¡Promociones especiales del día! Calidad 100% smashada a precio promocional.</span>
                    </div>
                  );
                })()}

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
            );
          })
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
                  <span style={{ fontSize: '0.75rem', color: isCashOpen ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                    ● {isCashOpen ? 'Abierto ahora' : 'Cerrado ahora'}
                  </span>
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
                  <div className="cat-info-item-title">Estado y Horarios</div>
                  <div className="cat-info-item-desc" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                    <span className={`cat-status-dot-circle ${isCashOpen ? 'open' : 'closed'}`} />
                    <span style={{ color: isCashOpen ? '#22c55e' : '#ef4444' }}>
                      {isCashOpen ? 'Caja abierta (Tomando pedidos)' : 'Caja cerrada (Fuera de turno)'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--cat-text-muted)', marginTop: 3 }}>
                    Horarios de atención: {settings.horarios}
                  </div>
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
                <Phone size={18} className="cat-info-item-icon" />
                <div>
                  <div className="cat-info-item-title">WhatsApp de Contacto</div>
                  <div className="cat-info-item-desc">{displayPhone}</div>
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
                    <span>Contactar por WhatsApp ({displayPhone})</span>
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


