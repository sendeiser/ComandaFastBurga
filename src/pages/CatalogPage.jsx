// =========================================================
// CatalogPage.jsx — Página pública del catálogo ComandaFast
// Accesible en #catalog — Diseño estilo Tripp American Burger / ola.click
// =========================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, Menu, Info, X, Clock, MapPin, 
  MessageCircle, ExternalLink, ChevronRight, Check,
  ShoppingBag, ArrowLeft, Plus, Minus, Trash2, Phone,
  Flame, Sparkles, Tag, RefreshCw, ChefHat, CheckCircle2, AlertCircle
} from 'lucide-react';
import { supabaseSync, DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY } from '../services/supabaseClient';
import { storageService } from '../services/storageService';
import { chatbotService } from '../services/chatbotService';
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
    // 1. Buscar en query string estándar (?mesa=X o ?table=X)
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('mesa') && searchParams.get('mesa')) {
      return decodeURIComponent(searchParams.get('mesa')).trim();
    }
    if (searchParams.has('table') && searchParams.get('table')) {
      return decodeURIComponent(searchParams.get('table')).trim();
    }

    // 2. Buscar en hash (#catalog?mesa=X o #mesa=X)
    const hash = window.location.hash || '';
    const qIndex = hash.indexOf('?');
    if (qIndex !== -1) {
      const hashParams = new URLSearchParams(hash.substring(qIndex));
      if (hashParams.has('mesa') && hashParams.get('mesa')) {
        return decodeURIComponent(hashParams.get('mesa')).trim();
      }
      if (hashParams.has('table') && hashParams.get('table')) {
        return decodeURIComponent(hashParams.get('table')).trim();
      }
    }

    // 3. Fallback regex en toda la URL por si viene como #mesa=1, /mesa/1, etc.
    const fullUrl = window.location.href;
    const match = fullUrl.match(/[?&#]mesa=([^&#]+)/i) || fullUrl.match(/#mesa[=_]([^&#]+)/i);
    if (match && match[1]) {
      return decodeURIComponent(match[1]).trim();
    }
  } catch (_) {}
  return '';
}

function generateWhatsAppMessage(items, subtotal, serviceType, customerName, customerAddress, customerPhone, deliveryFee, notes, paymentMethod = 'efectivo', tableNumber = '', orderNumber = '') {
  const lines = items.map(item => {
    const mods = [...(item.selectedMods || []).map(m => `  + ${m.name}`),
                  ...(item.selectedOptions || []).map(o => `  → ${o.name}`),
                  item.onlyTakeaway ? '  🛍️ [Solo Retiro en Local]' : '',
                  item.notes ? `  📝 ${item.notes}` : ''].filter(Boolean);
    return `• ${item.qty}x ${item.name} — ${formatPrice(item.unitPrice * item.qty)}${mods.length ? '\n' + mods.join('\n') : ''}`;
  });

  const total = subtotal + (deliveryFee || 0);
  const cleanMesa = tableNumber ? (tableNumber.toLowerCase().startsWith('mesa') ? tableNumber : `Mesa ${tableNumber}`) : '';
  const orderNumStr = orderNumber ? ` #${orderNumber}` : '';

  // Mensaje corto y directo para pedidos en mesa / salón (adjuntar comprobante de pago)
  if (serviceType === 'dine_in') {
    const mesaLabel = cleanMesa || 'En Mesa';
    const isGenericMesaName = customerName && mesaLabel && customerName.trim().toLowerCase() === mesaLabel.trim().toLowerCase();
    const showCustomerName = customerName && !isGenericMesaName ? customerName.trim() : '';

    return `🍔 *Pedido${orderNumStr} — ${mesaLabel}*\n\n` +
      `${lines.join('\n')}\n\n` +
      `💰 *TOTAL:* ${formatPrice(total)}\n` +
      `🪑 *Mesa:* ${mesaLabel}\n` +
      (showCustomerName ? `👤 *Nombre:* ${showCustomerName}\n` : '') +
      (notes ? `📝 *Aclaraciones:* ${notes}\n` : '') +
      `\n📎 *Adjunto comprobante:* 👇`;
  }

  // Mensaje completo para Delivery y Para Llevar
  const paymentLabel = paymentMethod === 'transferencia' ? 'Transferencia Bancaria / MP 🏦' : 'Efectivo 💵';
  const deliveryTypeLabel = serviceType === 'delivery' ? 'Delivery con cadete 🛵' : 'Para llevar / Mostrador 🏃';

  return `🍔 *Mi Pedido${orderNumStr} — ComandaFast*\n\n${lines.join('\n')}\n\n` +
    `💵 *Subtotal:* ${formatPrice(subtotal)}\n` +
    (deliveryFee ? `🛵 *Delivery:* ${formatPrice(deliveryFee)}\n` : '') +
    `💰 *TOTAL:* ${formatPrice(total)}\n\n` +
    `🚀 *Tipo de entrega:* ${deliveryTypeLabel}\n` +
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
      onlyTakeaway: Boolean(product.onlyTakeaway),
      freeShipping: Boolean(product.freeShipping),
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
          {product.onlyTakeaway && !isSoldOut && (
            <span className="cat-product-card-badge takeaway-only">
              🛍️ Solo Retiro
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
        {item.onlyTakeaway && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(139, 92, 246, 0.14)',
            color: '#c084fc',
            border: '1px solid rgba(139, 92, 246, 0.35)',
            borderRadius: '4px',
            padding: '2px 6px',
            fontSize: '0.68rem',
            fontWeight: 700,
            marginTop: '3px'
          }}>
            🛍️ Solo Retiro en Local
          </div>
        )}
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
      const botSettings = chatbotService.getSettings();
      if (local && typeof local === 'object') {
        const merged = { ...DEFAULT_SETTINGS, menu_mode: botSettings.menu_mode || 'catalog_direct', ...local };
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
      return { ...DEFAULT_SETTINGS, menu_mode: botSettings.menu_mode || 'catalog_direct' };
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
  const [view, setView] = useState('catalog'); // 'catalog' | 'cart' | 'checkout' | 'order_status'
  const initialMesa = getMesaFromUrl();
  const [tableNumber, setTableNumber] = useState(initialMesa);
  const [isQrTable, setIsQrTable] = useState(Boolean(initialMesa));
  const [serviceType, setServiceType] = useState(initialMesa ? 'dine_in' : null); // 'dine_in' | 'takeaway' | 'delivery'
  const [toast, setToast] = useState('');
  const [logoError, setLogoError] = useState(false);

  // Pedido activo de mesa para seguimiento en vivo y reordenar
  const [activeTableOrder, setActiveTableOrder] = useState(() => {
    try {
      const saved = localStorage.getItem('comandafast_active_table_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        const age = Date.now() - new Date(parsed.createdAt || 0).getTime();
        if (age < 12 * 60 * 60 * 1000) {
          return parsed;
        }
      }
    } catch (_) {}
    return null;
  });
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);

  // Escuchar cambios de URL por si se entra con ?mesa=X
  useEffect(() => {
    const handleUrlMesa = () => {
      const uMesa = getMesaFromUrl();
      if (uMesa) {
        setTableNumber(uMesa);
        setIsQrTable(true);
        setServiceType('dine_in');
      }
    };
    handleUrlMesa();
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
  const [orderSuccessData, setOrderSuccessData] = useState(null);
  const [showOrderSuccessModal, setShowOrderSuccessModal] = useState(false);
  const [copiedAlias, setCopiedAlias] = useState(false);

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

        const [prodsRes, settingsRes, imagesRes, metaRes, botTemplatesRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/products?select=*&order=category.asc,name.asc`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
          }),
          fetch(`${SUPABASE_URL}/rest/v1/bot_config?id=eq.variables&limit=1`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
          }),
          fetch(`${SUPABASE_URL}/rest/v1/system_settings?id=eq.product_images&select=data`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
          }),
          fetch(`${SUPABASE_URL}/rest/v1/system_settings?id=eq.product_metadata&select=data`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
          }),
          fetch(`${SUPABASE_URL}/rest/v1/bot_config?id=eq.templates&limit=1`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
          })
        ]);

        let imagesMap = {};
        if (imagesRes.ok) {
          const imgRows = await imagesRes.json();
          if (Array.isArray(imgRows) && imgRows.length > 0) imagesMap = imgRows[0].data || {};
        }

        let metaMap = {};
        if (metaRes && metaRes.ok) {
          const metaRows = await metaRes.json();
          if (Array.isArray(metaRows) && metaRows.length > 0) metaMap = metaRows[0].data || {};
        }

        if (prodsRes.ok) {
          const raw = await prodsRes.json();
          // Keep ALL products including sold-out so they show with AGOTADO badge
          const prods = (Array.isArray(raw) ? raw : [])
            .filter(p => p)
            .map(p => {
              const meta = metaMap[p.id] || {};
              const isAvailable = meta.available !== undefined ? meta.available : (p.is_active !== false);
              const stockVal = meta.stock !== undefined && meta.stock !== null && !isNaN(Number(meta.stock)) ? Number(meta.stock) : null;
              return {
                id: p.id,
                name: p.name,
                category: p.category || 'Hamburguesas',
                price: Number(p.price) || 0,
                originalPrice: meta.originalPrice ? Number(meta.originalPrice) : (p.original_price ? Number(p.original_price) : null),
                discountBadge: meta.discountBadge || p.discount_badge || null,
                freeShipping: meta.freeShipping !== undefined ? Boolean(meta.freeShipping) : Boolean(p.free_shipping),
                onlyTakeaway: meta.onlyTakeaway !== undefined ? Boolean(meta.onlyTakeaway) : Boolean(p.only_takeaway),
                emoji: p.emoji || '🍔',
                description: p.description || '',
                modifiers: Array.isArray(p.modifiers) ? p.modifiers : [],
                image: p.image || imagesMap[p.id] || '',
                // Preserve availability fields so AGOTADO badge works
                is_active: p.is_active !== false,
                available: isAvailable,
                stock: stockVal,
              };
            });
          if (prods.length > 0) {
            setProducts(prods);
            try { storageService.saveProducts(prods); } catch (_) {}
          }
        }

        let updatedSettings = {};
        if (settingsRes.ok) {
          const sRows = await settingsRes.json();
          if (Array.isArray(sRows) && sRows.length > 0 && Array.isArray(sRows[0].data)) {
            const varMap = {};
            sRows[0].data.forEach(v => { if (v.key) varMap[v.key] = v.value ?? v.defaultValue; });
            updatedSettings = { ...varMap };
          }
        }

        if (botTemplatesRes && botTemplatesRes.ok) {
          const tRows = await botTemplatesRes.json();
          if (Array.isArray(tRows) && tRows.length > 0 && tRows[0].data) {
            const tData = tRows[0].data;
            if (tData.menu_mode) updatedSettings.menu_mode = tData.menu_mode;
            if (tData.bank_alias) updatedSettings.alias_banco = tData.bank_alias;
            if (tData.bank_name) updatedSettings.banco = tData.bank_name;
            if (tData.bank_holder) updatedSettings.titular = tData.bank_holder;
            if (tData.bank_cbu) updatedSettings.cbu = tData.bank_cbu;
          }
        }

        if (Object.keys(updatedSettings).length > 0) {
          setSettings(prev => {
            const final = { ...prev, ...updatedSettings };
            try { storageService.saveSettings(final); } catch (_) {}
            return final;
          });
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

  // ---- Sincronización en tiempo real del pedido de la mesa ----
  const refreshOrderStatus = useCallback(async (showNotification = false) => {
    if (!activeTableOrder || !activeTableOrder.id) return;
    setIsRefreshingStatus(true);
    try {
      // 1. Chequear local
      const localOrders = storageService.getOrders();
      const localMatch = localOrders.find(o => o.id === activeTableOrder.id);
      let newest = localMatch || null;

      // 2. Chequear Supabase Cloud (fuente de verdad global)
      if (supabaseSync.isConfigured()) {
        const cloudMatch = await supabaseSync.fetchOrderById(activeTableOrder.id);
        if (cloudMatch) {
          newest = cloudMatch;
        }
      }

      if (newest) {
        setActiveTableOrder(prev => {
          const updated = { ...prev, ...newest };
          try {
            localStorage.setItem('comandafast_active_table_order', JSON.stringify(updated));
            storageService.saveOrder(updated);
          } catch (_) {}
          return updated;
        });
        if (showNotification) {
          showToast('✅ Estado actualizado');
        }
      }
    } catch (e) {
      console.warn('[CatalogPage] Error refrescando pedido de mesa:', e);
    } finally {
      setIsRefreshingStatus(false);
    }
  }, [activeTableOrder, showToast]);

  // Polling automático cada 3 segundos si el pedido está en curso
  useEffect(() => {
    if (!activeTableOrder || !activeTableOrder.id) return;
    if (activeTableOrder.status === 'entregado' || activeTableOrder.status === 'cancelado') return;

    const interval = setInterval(() => {
      refreshOrderStatus(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeTableOrder?.id, activeTableOrder?.status, refreshOrderStatus]);

  // ---- Enviar pedido de mesa directo a la Base de Datos / Cocina (sin WhatsApp) ----
  const handleSendDineInOrder = async () => {
    if (!tableNumber.trim()) {
      showToast('⚠️ Ingresá tu número de mesa');
      return;
    }
    if (cart.items.length === 0) {
      showToast('⚠️ Tu carrito está vacío');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const nextNum = await storageService.getNextOrderNumberAsync();
      const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const cleanTable = tableNumber.trim();
      const resolvedCustomerName = customerName.trim() || (cleanTable.toLowerCase().startsWith('mesa') ? cleanTable : `Mesa ${cleanTable}`);

      const orderPayload = {
        id: orderId,
        orderNumber: nextNum,
        channel: 'mesa',
        tableNumber: cleanTable,
        customer: {
          name: resolvedCustomerName,
          phone: customerPhone.trim() || '',
          notes: orderNotes.trim()
        },
        items: cart.items.map(item => ({
          id: item.productId || item.cartId,
          productId: item.productId,
          name: item.name,
          qty: item.qty,
          unitPrice: item.unitPrice,
          basePrice: item.basePrice || item.unitPrice,
          selectedMods: item.selectedMods || [],
          selectedOptions: item.selectedOptions || [],
          notes: item.notes || '',
          emoji: item.emoji || '🍔',
          image: item.image || ''
        })),
        subtotal: cart.subtotal,
        deliveryFee: 0,
        total: cart.subtotal,
        paymentMethod: paymentMethod || 'efectivo',
        status: 'pendiente',
        statusTimestamps: {
          pendiente: new Date().toISOString(),
          createdAt: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        updatedAt: Date.now()
      };

      // 1. Guardar localmente
      storageService.saveOrder(orderPayload);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('comandafast:new-order', { detail: orderPayload }));
      }

      // 2. Enviar a Supabase Cloud (notifica inmediatamente a Cocina y POS en tiempo real)
      if (supabaseSync.isConfigured()) {
        try {
          await supabaseSync.createOrder(orderPayload);
        } catch (supaErr) {
          console.warn('[CatalogPage] Error enviando pedido a Supabase:', supaErr);
        }
      }

      // 3. Notificar al servidor LAN si está disponible
      try {
        if (typeof window !== 'undefined' && window.location) {
          const botHost = window.location.hostname || 'localhost';
          fetch(`http://${botHost}:3002/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload)
          }).catch(() => {});
        }
      } catch (_) {}

      // 4. Guardar pedido activo en estado y localStorage
      setActiveTableOrder(orderPayload);
      try {
        localStorage.setItem('comandafast_active_table_order', JSON.stringify(orderPayload));
      } catch (_) {}

      // 5. Si eligió transferencia, abrir WhatsApp automáticamente con los datos de la mesa y lo pedido para adjuntar el comprobante
      if (paymentMethod === 'transferencia') {
        const waPhone = formatWhatsAppPhone(settings.telefono_whatsapp || settings.telefono_contacto);
        const waMsg = generateWhatsAppMessage(
          cart.items,
          cart.subtotal,
          'dine_in',
          resolvedCustomerName,
          '',
          customerPhone,
          0,
          orderNotes,
          'transferencia',
          cleanTable,
          nextNum
        );
        const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`;
        try {
          window.open(waUrl, '_blank');
        } catch (_) {}
      }

      // 6. Limpiar carrito y mostrar pantalla de seguimiento
      cart.clearCart();
      setOrderNotes('');
      setView('order_status');
      if (paymentMethod === 'transferencia') {
        showToast('🚀 ¡Pedido enviado! Se abrió WhatsApp para adjuntar comprobante');
      } else {
        showToast('🚀 ¡Pedido enviado a cocina con éxito!');
      }
    } catch (err) {
      console.error('[CatalogPage] Error enviando pedido a cocina:', err);
      showToast('❌ Ocurrió un error al enviar el pedido. Intentá nuevamente.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // ---- Send order via WhatsApp (Takeaway / Delivery) ----
  const handleSendOrder = async () => {
    if (serviceType === 'dine_in') {
      return handleSendDineInOrder();
    }

    if (!customerName.trim()) {
      showToast('⚠️ Ingresá tu nombre y apellido');
      return;
    }

    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      showToast('⚠️ Ingresá tu número de WhatsApp para recibir la confirmación de tu pedido');
      return;
    }
    if (cleanPhone.length < 10 && !cleanPhone.startsWith('54')) {
      showToast('⚠️ Ingresá tu número con código de área (ej: 3826 430159 sin el 0 ni el 15)');
      return;
    }

    if (serviceType === 'delivery') {
      const hasTakeawayOnly = cart.items.some(item => item.onlyTakeaway);
      if (hasTakeawayOnly) {
        showToast('⚠️ Tu carrito contiene productos exclusivos para retirar por el local.');
        return;
      }
      if (!customerAddress.trim()) {
        showToast('⚠️ Ingresá tu dirección de entrega');
        return;
      }
    }

    setIsSubmittingOrder(true);
    try {
      const nextNum = await storageService.getNextOrderNumberAsync();
      const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const deliveryFee = serviceType === 'delivery' ? (Number(settings.costo_envio) || 1500) : 0;
      const totalAmount = cart.subtotal + deliveryFee;

      const orderPayload = {
        id: orderId,
        orderNumber: nextNum,
        channel: serviceType === 'delivery' ? 'delivery' : 'mostrador',
        tableNumber: '',
        customer: {
          name: customerName.trim(),
          phone: customerPhone.trim() || '',
          address: serviceType === 'delivery' ? customerAddress.trim() : 'Retiro en Local (Mostrador)',
          notes: orderNotes.trim()
        },
        items: cart.items.map(item => ({
          id: item.productId || item.cartId,
          productId: item.productId,
          name: item.name,
          qty: item.qty,
          unitPrice: item.unitPrice,
          basePrice: item.basePrice || item.unitPrice,
          selectedMods: item.selectedMods || [],
          selectedOptions: item.selectedOptions || [],
          notes: item.notes || '',
          emoji: item.emoji || '🍔',
          image: item.image || '',
          onlyTakeaway: Boolean(item.onlyTakeaway),
          freeShipping: Boolean(item.freeShipping)
        })),
        subtotal: cart.subtotal,
        deliveryFee: deliveryFee,
        total: totalAmount,
        paymentMethod: paymentMethod || 'efectivo',
        status: 'pendiente',
        statusTimestamps: {
          pendiente: new Date().toISOString(),
          createdAt: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        updatedAt: Date.now(),
        source: 'catalogo_online'
      };

      // 1. Guardar localmente y notificar al POS de inmediato
      storageService.saveOrder(orderPayload);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('comandafast:new-order', { detail: orderPayload }));
      }

      // 2. Enviar a Supabase Cloud (notifica inmediatamente a Cocina y POS en tiempo real)
      if (supabaseSync.isConfigured()) {
        try {
          await supabaseSync.createOrder(orderPayload);
        } catch (supaErr) {
          console.warn('[CatalogPage] Error enviando pedido a Supabase:', supaErr);
        }
      }

      // 3. Notificar al servidor LAN si está disponible
      try {
        if (typeof window !== 'undefined' && window.location) {
          const botHost = window.location.hostname || 'localhost';
          fetch(`http://${botHost}:3002/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload)
          }).catch(() => {});
        }
      } catch (_) {}

      // 4. Generar enlace de WhatsApp
      const waPhone = formatWhatsAppPhone(settings.telefono_whatsapp || settings.telefono_contacto);
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
        tableNumber,
        nextNum
      );

      const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;

      const isDirectMode = settings.menu_mode === 'catalog_direct' || Boolean(customerPhone.trim());

      if (isDirectMode) {
        // Modo directo: la orden ya ingresó al POS y cocina. El Bot le envía el WhatsApp al cliente.
        setOrderSuccessData({
          orderNumber: nextNum,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerAddress: serviceType === 'delivery' ? customerAddress.trim() : 'Retiro en Local (Mostrador)',
          serviceType,
          paymentMethod: paymentMethod || 'efectivo',
          total: totalAmount,
          subtotal: cart.subtotal,
          deliveryFee,
          items: [...cart.items],
          waUrl
        });
        setShowOrderSuccessModal(true);
      } else {
        // Modo clásico: abrir WhatsApp directamente
        try {
          window.open(waUrl, '_blank');
        } catch (_) {}
      }

      cart.clearCart();
      setView('catalog');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setOrderNotes('');
      setPaymentMethod('efectivo');

      const urlMesa = getMesaFromUrl();
      if (!urlMesa) {
        setTableNumber('');
        setServiceType(null);
      } else {
        setServiceType('dine_in');
      }
      showToast(`🎉 ¡Pedido #${nextNum} enviado a cocina con éxito!`);
    } catch (err) {
      console.error('[CatalogPage] Error al procesar pedido:', err);
      showToast('❌ Ocurrió un error al procesar el pedido.');
    } finally {
      setIsSubmittingOrder(false);
    }
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
              <label className="cat-form-label">Ubicación asignada en el local</label>
              {isQrTable ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1.5px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: 'var(--cat-text)',
                  fontWeight: 800,
                  fontSize: '0.95rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.2rem' }}>🍽️</span>
                    <span>{tableNumber.toLowerCase().startsWith('mesa') ? tableNumber : `Mesa ${tableNumber}`}</span>
                  </div>
                  <span style={{
                    fontSize: '0.7rem',
                    background: '#dc2626',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontWeight: 700
                  }}>
                    Asignada por QR
                  </span>
                </div>
              ) : (
                <input 
                  className="cat-form-input" 
                  placeholder="Ej: Mesa 4, Barra, Patio 2..." 
                  value={tableNumber} 
                  onChange={e => setTableNumber(e.target.value)} 
                  autoFocus={!tableNumber}
                />
              )}
            </div>
          )}
          <div className="cat-form-group">
            <label className="cat-form-label">Nombre y Apellido *</label>
            <input className="cat-form-input" placeholder="Tu nombre" value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>
          {serviceType !== 'dine_in' ? (
            <div className="cat-form-group">
              <label className="cat-form-label">
                Teléfono / WhatsApp * <span style={{ fontSize: '0.74rem', fontWeight: 500, color: '#38bdf8' }}>(Para avisos de cocina y entrega)</span>
              </label>
              <input 
                className="cat-form-input" 
                placeholder="Ej: 3826 430159 (con código de área)" 
                value={customerPhone} 
                onChange={e => setCustomerPhone(e.target.value)} 
                type="tel" 
                required
              />
            </div>
          ) : (
            <div className="cat-form-group">
              <label className="cat-form-label">
                Teléfono / WhatsApp <span style={{ fontSize: '0.74rem', fontWeight: 400, color: '#94a3b8' }}>(Opcional)</span>
              </label>
              <input 
                className="cat-form-input" 
                placeholder="Ej: 3826 430159" 
                value={customerPhone} 
                onChange={e => setCustomerPhone(e.target.value)} 
                type="tel" 
              />
            </div>
          )}
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
                {serviceType === 'dine_in' ? (
                  <div>
                    <div style={{ marginBottom: 6 }}>
                      💳 <strong>Alias:</strong> <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, fontWeight: 800, color: '#fff' }}>{settings.alias_banco || 'burga.chamical.nx'}</code> ({settings.banco || 'Mercado Pago'})
                    </div>
                    <div>
                      📲 <strong>Importante:</strong> Al confirmar, tu pedido se enviará a cocina y se abrirá WhatsApp con el detalle de tu mesa para que puedas adjuntar tu comprobante de pago.
                    </div>
                  </div>
                ) : (
                  'ℹ️ Al enviar el pedido recibirás el Alias y CBU por WhatsApp para transferir y adjuntar el comprobante.'
                )}
              </div>
            )}
          </div>

          <div className="cat-form-group">
            <label className="cat-form-label">Aclaraciones o notas del pedido</label>
            <textarea className="cat-form-textarea" placeholder="Ej: Timbre blanco, sin cebolla, etc." value={orderNotes} onChange={e => setOrderNotes(e.target.value)} />
          </div>

          {serviceType === 'dine_in' ? (
            <button 
              type="button" 
              className="cat-send-dinein-btn" 
              onClick={handleSendDineInOrder}
              disabled={isSubmittingOrder}
              style={paymentMethod === 'transferencia' ? { background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', boxShadow: '0 6px 24px rgba(22, 163, 74, 0.45)' } : {}}
            >
              {isSubmittingOrder ? (
                <>
                  <div className="cat-spinner-sm" />
                  <span>Enviando pedido a cocina...</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '1.25rem' }}>{paymentMethod === 'transferencia' ? '📲' : '🚀'}</span>
                  <span>{paymentMethod === 'transferencia' ? 'Confirmar y Enviar Comprobante por WhatsApp' : 'Confirmar y Enviar a Cocina'}</span>
                </>
              )}
            </button>
          ) : (
            <button type="button" className="cat-send-order-btn" onClick={handleSendOrder}>
              <MessageCircle size={20} />
              Enviar pedido por WhatsApp
            </button>
          )}
        </div>
        <Toast message={toast} />
      </div>
    );
  }

  // ---- ORDER STATUS VIEW (SEGUIMIENTO EN VIVO EN MESA) ----
  if (view === 'order_status') {
    if (!activeTableOrder) {
      return (
        <div className="catalog-app">
          <div className="cat-order-status-page">
            <div className="cat-status-top-bar">
              <button type="button" className="cat-cart-back-btn" onClick={() => setView('catalog')}>
                <ArrowLeft size={16} /> Volver a la carta
              </button>
            </div>
            <div className="cat-empty" style={{ marginTop: 40 }}>
              <div className="cat-empty-icon">🍽️</div>
              <div className="cat-empty-text">No tenés ningún pedido activo en este momento.</div>
              <button
                style={{ marginTop: 16, background: '#ef4444', color: 'white', border: 'none', borderRadius: 10, padding: '12px 24px', cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem' }}
                onClick={() => setView('catalog')}
              >
                VER CARTA
              </button>
            </div>
          </div>
          <Toast message={toast} />
        </div>
      );
    }

    const currentStatus = activeTableOrder.status || 'pendiente';
    const cleanTable = activeTableOrder.tableNumber ? (activeTableOrder.tableNumber.toLowerCase().startsWith('mesa') ? activeTableOrder.tableNumber : `Mesa ${activeTableOrder.tableNumber}`) : 'En Salón';
    const orderCreatedAt = activeTableOrder.createdAt ? new Date(activeTableOrder.createdAt) : new Date();
    const orderTimeFormatted = orderCreatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Step configuration
    const stepsConfig = [
      { key: 'pendiente', label: 'Pedido recibido', desc: 'Pedido ingresado al sistema', icon: '📋' },
      { key: 'cocina', label: 'En cocina', desc: 'Preparando y marchando tu pedido a la plancha', icon: '👨‍🍳' },
      { key: 'listo', label: 'Listo para servir', desc: 'Salió de cocina y va en camino a tu mesa', icon: '🍽️' },
      { key: 'entregado', label: 'Entregado en mesa', desc: '¡Servido! Que disfrutes tu comida', icon: '✅' },
    ];

    const statusOrderMap = { pendiente: 0, cocina: 1, listo: 2, entregado: 3, cancelado: -1 };
    const currentStepIndex = statusOrderMap[currentStatus] ?? 0;

    return (
      <div className="catalog-app">
        <div className="cat-order-status-page">
          {/* Top Bar */}
          <div className="cat-status-top-bar">
            <button type="button" className="cat-cart-back-btn" onClick={() => setView('catalog')}>
              <ArrowLeft size={16} /> Volver a la carta
            </button>
            <button 
              type="button" 
              className="cat-refresh-status-btn" 
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.78rem' }}
              onClick={() => refreshOrderStatus(true)}
              disabled={isRefreshingStatus}
            >
              <RefreshCw size={14} className={isRefreshingStatus ? 'cat-spinner-sm' : ''} />
              <span>{isRefreshingStatus ? 'Actualizando...' : 'Actualizar'}</span>
            </button>
          </div>

          {/* Hero Card */}
          <div className="cat-status-hero-card">
            <div className="cat-status-hero-header">
              <div className="cat-status-table-pill">
                <span>🍽️</span>
                <span>{cleanTable}</span>
              </div>
              <div className="cat-status-order-num">
                #{activeTableOrder.orderNumber}
              </div>
            </div>

            {/* Current Status Highlight */}
            {currentStatus === 'cancelado' ? (
              <div className="cat-status-current-badge" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.1)' }}>
                <span className="cat-status-current-icon">❌</span>
                <div>
                  <div className="cat-status-current-title" style={{ color: '#ef4444' }}>Pedido Cancelado</div>
                  <div className="cat-status-current-desc">Este pedido fue cancelado. Por favor consultá al personal o al mozo en el salón.</div>
                </div>
              </div>
            ) : currentStatus === 'entregado' ? (
              <div className="cat-status-current-badge" style={{ borderColor: 'rgba(34, 197, 94, 0.4)', background: 'rgba(34, 197, 94, 0.1)' }}>
                <span className="cat-status-current-icon">🎉</span>
                <div>
                  <div className="cat-status-current-title" style={{ color: '#4ade80' }}>¡Pedido Entregado!</div>
                  <div className="cat-status-current-desc">¡A disfrutar! Si necesitas pedir algo más o una segunda ronda, podés hacerlo cuando gustes.</div>
                </div>
              </div>
            ) : currentStatus === 'listo' ? (
              <div className="cat-status-current-badge" style={{ borderColor: 'rgba(34, 197, 94, 0.4)', background: 'rgba(34, 197, 94, 0.1)' }}>
                <span className="cat-status-current-icon">🍽️</span>
                <div>
                  <div className="cat-status-current-title" style={{ color: '#4ade80' }}>¡Tu pedido está listo!</div>
                  <div className="cat-status-current-desc">Salió de cocina y el personal lo está llevando a tu mesa.</div>
                </div>
              </div>
            ) : currentStatus === 'cocina' ? (
              <div className="cat-status-current-badge" style={{ borderColor: 'rgba(249, 115, 22, 0.4)', background: 'rgba(249, 115, 22, 0.1)' }}>
                <span className="cat-status-current-icon">👨‍🍳</span>
                <div>
                  <div className="cat-status-current-title" style={{ color: '#fb923c' }}>En preparación en cocina</div>
                  <div className="cat-status-current-desc">El equipo de cocina está cocinando y armando tus hamburguesas a la plancha.</div>
                </div>
              </div>
            ) : (
              <div className="cat-status-current-badge" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.08)' }}>
                <span className="cat-status-current-icon">⏳</span>
                <div>
                  <div className="cat-status-current-title" style={{ color: '#f87171' }}>Pedido recibido en el sistema</div>
                  <div className="cat-status-current-desc">Tu pedido ya está en la pantalla del salón. En instantes comienza la preparación en cocina.</div>
                </div>
              </div>
            )}

            <div className="cat-status-meta-info">
              <span>👤 {activeTableOrder.customer?.name || cleanTable}</span>
              <span>🕒 Hora del pedido: {orderTimeFormatted} hs</span>
            </div>
          </div>

          {/* Stepper Card */}
          {currentStatus !== 'cancelado' && (
            <div className="cat-status-stepper">
              <div className="cat-status-stepper-title">Progreso de tu pedido</div>
              <div className="cat-step-list">
                {stepsConfig.map((s, idx) => {
                  const isDone = currentStepIndex > idx;
                  const isActive = currentStepIndex === idx;
                  const isUpcoming = currentStepIndex < idx;

                  return (
                    <div key={s.key} className="cat-step-item">
                      {idx < stepsConfig.length - 1 && (
                        <div className={`cat-step-line ${isDone ? 'done' : ''}`} />
                      )}
                      <div className={`cat-step-circle ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                        {isDone ? '✓' : idx + 1}
                      </div>
                      <div className="cat-step-content">
                        <div className={`cat-step-label ${isUpcoming ? 'upcoming' : ''}`}>
                          {s.icon} {s.label}
                        </div>
                        <div className="cat-step-desc">
                          {s.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Order Summary Details */}
          <div className="cat-checkout-summary" style={{ marginTop: 0 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff', marginBottom: 12, textTransform: 'uppercase' }}>
              Detalle del pedido
            </div>
            {(activeTableOrder.items || []).map((item, i) => (
              <div key={item.id || item.cartId || i} className="cat-checkout-summary-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <strong>{item.qty}x {item.name}</strong>
                  <span>{formatPrice(item.unitPrice * item.qty)}</span>
                </div>
                {item.selectedMods && item.selectedMods.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--cat-text-muted)', paddingLeft: 12 }}>
                    + {item.selectedMods.map(m => m.name).join(', ')}
                  </div>
                )}
                {item.selectedOptions && item.selectedOptions.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--cat-text-muted)', paddingLeft: 12 }}>
                    → {item.selectedOptions.map(o => o.name).join(', ')}
                  </div>
                )}
                {item.notes && (
                  <div style={{ fontSize: '0.75rem', color: '#fed7aa', paddingLeft: 12 }}>
                    📝 {item.notes}
                  </div>
                )}
              </div>
            ))}

            <div className="cat-divider" />
            <div className="cat-checkout-summary-total">
              <span>Total a abonar</span>
              <span>{formatPrice(activeTableOrder.total || activeTableOrder.subtotal || 0)}</span>
            </div>

            <div style={{ marginTop: 14, fontSize: '0.8rem', color: 'var(--cat-text-muted)', background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: 10 }}>
              {activeTableOrder.paymentMethod === 'transferencia' ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong>Forma de pago:</strong>
                    <span style={{ color: '#4ade80', fontWeight: 800, fontSize: '0.78rem' }}>🏦 Transferencia</span>
                  </div>
                  <div className="cat-alias-box">
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>Alias: </span>
                      <strong style={{ color: '#fff', fontSize: '0.88rem' }}>{settings.alias_banco || 'burga.chamical.nx'}</strong>
                      <span style={{ fontSize: '0.72rem', color: '#a1a1aa', marginLeft: 4 }}>({settings.banco || 'Mercado Pago'})</span>
                    </div>
                    <button
                      type="button"
                      className="cat-alias-copy-btn"
                      onClick={() => {
                        try {
                          navigator.clipboard.writeText(settings.alias_banco || 'burga.chamical.nx');
                          showToast('📋 Alias copiado al portapapeles');
                        } catch (_) {}
                      }}
                    >
                      Copiar
                    </button>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: 4 }}>
                    Adjuntá tu comprobante por WhatsApp para validar el pago de tu pedido en el salón.
                  </div>
                </div>
              ) : (
                <div>
                  <strong>Forma de pago:</strong> Efectivo 💵<br/>
                  Abonás en la mesa al mozo o al finalizar en caja.
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="cat-status-actions">
            {activeTableOrder.paymentMethod === 'transferencia' && (
              <button
                type="button"
                className="cat-send-proof-btn"
                onClick={() => {
                  const waPhone = formatWhatsAppPhone(settings.telefono_whatsapp || settings.telefono_contacto);
                  const cleanTable = activeTableOrder.tableNumber ? (activeTableOrder.tableNumber.toLowerCase().startsWith('mesa') ? activeTableOrder.tableNumber : `Mesa ${activeTableOrder.tableNumber}`) : '';
                  const waMsg = generateWhatsAppMessage(
                    activeTableOrder.items || [],
                    activeTableOrder.subtotal || activeTableOrder.total || 0,
                    'dine_in',
                    activeTableOrder.customer?.name || cleanTable,
                    '',
                    activeTableOrder.customer?.phone || '',
                    0,
                    activeTableOrder.customer?.notes || '',
                    'transferencia',
                    cleanTable,
                    activeTableOrder.orderNumber || ''
                  );
                  window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`, '_blank');
                }}
              >
                <MessageCircle size={20} />
                <span>Enviar comprobante por WhatsApp</span>
              </button>
            )}

            <button
              type="button"
              className="cat-order-more-btn"
              onClick={() => {
                setServiceType('dine_in');
                setView('catalog');
              }}
            >
              <span>🍔</span>
              <span>Pedir algo más / Agregar a la mesa</span>
            </button>

            <button
              type="button"
              className="cat-refresh-status-btn"
              onClick={() => refreshOrderStatus(true)}
              disabled={isRefreshingStatus}
            >
              <RefreshCw size={16} className={isRefreshingStatus ? 'cat-spinner-sm' : ''} />
              <span>{isRefreshingStatus ? 'Comprobando estado...' : 'Actualizar estado del pedido'}</span>
            </button>
          </div>
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

              {/* Service selector or Direct Continue if QR table */}
              {isQrTable ? (
                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1.5px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: 12,
                    padding: '12px 16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.5rem' }}>🍽️</span>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--cat-text)', fontSize: '0.92rem' }}>
                          Consumo en {tableNumber.toLowerCase().startsWith('mesa') ? tableNumber : `Mesa ${tableNumber}`}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--cat-text-muted)' }}>
                          Pedido directo a la mesa
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.72rem', background: '#dc2626', color: '#fff', padding: '3px 8px', borderRadius: 8, fontWeight: 700 }}>
                      QR Activo
                    </span>
                  </div>

                  <button
                    type="button"
                    style={{
                      width: '100%',
                      padding: '14px 20px',
                      background: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 12,
                      fontWeight: 800,
                      fontSize: '1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)'
                    }}
                    onClick={() => {
                      setServiceType('dine_in');
                      setView('checkout');
                    }}
                  >
                    <span>Continuar con el pedido</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              ) : (
                <div className="cat-service-selector">
                  {cart.items.some(item => item.onlyTakeaway) && (
                    <div className="cat-takeaway-only-alert">
                      <span className="cat-takeaway-only-alert-icon">🛍️</span>
                      <div>
                        <div className="cat-takeaway-only-alert-title">¡Promo Exclusiva para Retirar!</div>
                        <div className="cat-takeaway-only-alert-desc">
                          Tu pedido incluye productos o promos que son <strong>exclusivas para retirar por el local</strong>. La opción de delivery no está disponible.
                        </div>
                      </div>
                    </div>
                  )}
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
                      className={`cat-service-btn ${serviceType === 'delivery' ? 'active' : ''} ${cart.items.some(item => item.onlyTakeaway) ? 'disabled-btn' : ''}`}
                      disabled={cart.items.some(item => item.onlyTakeaway)}
                      onClick={() => {
                        if (cart.items.some(item => item.onlyTakeaway)) {
                          showToast('🛍️ Tu pedido tiene promos exclusivas para retiro por el local.');
                          return;
                        }
                        setServiceType('delivery');
                        setView('checkout');
                      }}
                      title={cart.items.some(item => item.onlyTakeaway) ? 'No disponible para delivery (promo exclusivo retiro)' : ''}
                    >
                      <span className="cat-service-btn-icon">🛵</span>
                      A domicilio
                      <span className="cat-service-btn-sub">
                        {cart.items.some(item => item.onlyTakeaway) ? 'No disponible p/ esta promo' : 'Envío con cadete'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
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
              {!isQrTable && (
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
              )}
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

          {activeTableOrder && activeTableOrder.status !== 'cancelado' && (
            <button
              type="button"
              onClick={() => setView('order_status')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1.5px solid rgba(239, 68, 68, 0.45)',
                borderRadius: 20,
                padding: '4px 12px',
                fontSize: '0.8rem',
                fontWeight: 800,
                color: '#f87171',
                cursor: 'pointer'
              }}
            >
              <span className={`cat-active-order-pulse ${activeTableOrder.status === 'cocina' ? 'orange' : ''}`} style={{ width: 8, height: 8 }} />
              <span>Pedido #{activeTableOrder.orderNumber}: {activeTableOrder.status === 'cocina' ? 'En cocina' : activeTableOrder.status === 'listo' ? 'Listo' : activeTableOrder.status === 'entregado' ? 'Entregado' : 'Recibido'}</span>
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

      {/* 5.1 FLOATING ACTIVE TABLE ORDER BANNER */}
      {activeTableOrder && activeTableOrder.status !== 'cancelado' && (
        <div 
          className="cat-active-order-banner" 
          style={{ bottom: cart.totalItems > 0 ? '90px' : '24px' }}
          onClick={() => setView('order_status')}
        >
          <div className="cat-active-order-banner-left">
            <span className={`cat-active-order-pulse ${activeTableOrder.status === 'cocina' ? 'orange' : ''}`} />
            <div className="cat-active-order-text">
              <strong>{activeTableOrder.tableNumber?.toLowerCase().startsWith('mesa') ? activeTableOrder.tableNumber : `Mesa ${activeTableOrder.tableNumber}`} • Pedido #{activeTableOrder.orderNumber}</strong>
              <small>
                {activeTableOrder.status === 'pendiente' && '⏳ Pedido recibido en el sistema'}
                {activeTableOrder.status === 'cocina' && '👨‍🍳 En preparación en cocina'}
                {activeTableOrder.status === 'listo' && '🍽️ ¡Listo para servir en tu mesa!'}
                {activeTableOrder.status === 'entregado' && '✅ Entregado a la mesa'}
              </small>
            </div>
          </div>
          <button type="button" className="cat-active-order-btn">
            Ver estado ➔
          </button>
        </div>
      )}

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

      {/* 10. MODAL DE CONFIRMACIÓN DIRECTA AL POS Y WHATSAPP BOT */}
      {showOrderSuccessModal && orderSuccessData && (
        <div 
          className="cat-modal-overlay" 
          style={{ 
            zIndex: 9999, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '16px',
            backgroundColor: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(8px)'
          }} 
          onClick={() => setShowOrderSuccessModal(false)}
        >
          <div 
            className="cat-order-success-modal"
            style={{
              background: '#161e26',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '24px',
              maxWidth: '460px',
              width: '100%',
              padding: '26px 22px',
              color: '#fff',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8)',
              position: 'relative',
              animation: 'catModalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header Icon */}
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <div style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.4))',
                border: '2px solid #10b981',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#34d399',
                fontSize: '2.2rem',
                boxShadow: '0 0 30px rgba(16, 185, 129, 0.35)'
              }}>
                ✓
              </div>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 900, marginTop: '14px', color: '#fff', letterSpacing: '-0.02em' }}>
                ¡Pedido #{orderSuccessData.orderNumber} Recibido!
              </h2>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginTop: '4px', lineHeight: 1.4 }}>
                Tu comanda ya ingresó al sistema de nuestra cocina y caja.
              </p>
            </div>

            {/* Aviso Bot WhatsApp */}
            <div style={{
              background: 'rgba(37, 211, 102, 0.1)',
              border: '1px solid rgba(37, 211, 102, 0.28)',
              borderRadius: '14px',
              padding: '12px 14px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <MessageCircle size={22} style={{ color: '#25D366', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.82rem', color: '#e2e8f0', lineHeight: 1.45 }}>
                <strong style={{ color: '#34d399', display: 'block', marginBottom: '2px' }}>
                  Aviso automático por WhatsApp
                </strong>
                {orderSuccessData.customerPhone ? (
                  <span>
                    El bot de WhatsApp te envió un mensaje a <strong>{orderSuccessData.customerPhone}</strong> con la confirmación del pedido.
                  </span>
                ) : (
                  <span>
                    Nuestra cocina ya tiene tu pedido en marcha. ¡Te avisaremos cuando esté listo!
                  </span>
                )}
              </div>
            </div>

            {/* Instrucciones de Pago */}
            {orderSuccessData.paymentMethod === 'transferencia' ? (
              <div style={{
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '14px 16px',
                marginBottom: '20px'
              }}>
                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#f59e0b', fontWeight: 800, marginBottom: '8px' }}>
                  💳 Datos para Transferencia Bancaria
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', background: 'rgba(0,0,0,0.3)', padding: '10px 12px', borderRadius: '10px' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Alias CBU / CVU</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                      {settings.alias_banco || settings.bank_alias || 'Burgachamical.nx'}
                    </div>
                  </div>
                  <button
                    type="button"
                    style={{
                      background: copiedAlias ? '#10b981' : 'rgba(255, 255, 255, 0.12)',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '7px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                    onClick={() => {
                      const alias = settings.alias_banco || settings.bank_alias || 'Burgachamical.nx';
                      navigator.clipboard.writeText(alias);
                      setCopiedAlias(true);
                      setTimeout(() => setCopiedAlias(false), 2500);
                    }}
                  >
                    {copiedAlias ? '¡Copiado! ✓' : 'Copiar'}
                  </button>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                  <div>• <strong>Banco / Billetera:</strong> {settings.banco || settings.bank_name || 'Naranja X'}</div>
                  <div>• <strong>Titular:</strong> {settings.titular || settings.bank_holder || "Braian Carlos Zarate San Felipe"}</div>
                  <div>• <strong>Total a transferir:</strong> ${Number(orderSuccessData.total).toLocaleString('es-AR')}</div>
                </div>
                <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '8px', fontStyle: 'italic' }}>
                  📸 Podés adjuntar el comprobante directamente en el chat de WhatsApp.
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '14px 16px',
                marginBottom: '20px'
              }}>
                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#10b981', fontWeight: 800, marginBottom: '6px' }}>
                  💵 Pago en Efectivo
                </div>
                <div style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                  Abonás <strong>${Number(orderSuccessData.total).toLocaleString('es-AR')}</strong> al {orderSuccessData.serviceType === 'delivery' ? 'recibir tu pedido' : 'retirar en el local'}.
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {orderSuccessData.waUrl && (
                <a
                  href={orderSuccessData.waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: '#25D366',
                    color: '#fff',
                    textDecoration: 'none',
                    borderRadius: '14px',
                    padding: '13px',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 16px rgba(37, 211, 102, 0.4)'
                  }}
                >
                  <MessageCircle size={20} />
                  <span>Abrir WhatsApp con el Local</span>
                </a>
              )}
              <button
                type="button"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  borderRadius: '14px',
                  padding: '12px',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  cursor: 'pointer'
                }}
                onClick={() => setShowOrderSuccessModal(false)}
              >
                Volver a la Carta
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
}


