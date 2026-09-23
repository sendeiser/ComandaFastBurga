// =========================================================
// STORAGE SERVICE — LOCAL DATA & PERSISTENCE
// =========================================================


const DEFAULT_CATEGORIES = [
  { id: 'cat-hamburguesas', name: 'Hamburguesas', emoji: '🍔' },
  { id: 'cat-agregados', name: 'Agregados', emoji: '🍟' },
  { id: 'cat-bebidas', name: 'Bebidas', emoji: '🥤' },
  { id: 'cat-combos', name: 'Combos', emoji: '🔥' },
  { id: 'cat-postres', name: 'Postres', emoji: '🍦' }
];

const DEFAULT_PRODUCTS = [
  {
    id: 'prod-1',
    name: 'Burger Clásica',
    category: 'Hamburguesas',
    price: 6500,
    emoji: '🍔',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80',
    description: 'Medallón 150g, lechuga, tomate, queso y mayonesa casera',
    modifiers: ['Sin cebolla', 'Sin tomate', 'Extra Cheddar (+$800)', 'Extra Bacon (+$900)', 'Papas Rústicas']
  },
  {
    id: 'prod-2',
    name: 'Doble Cuarto Cheddar',
    category: 'Hamburguesas',
    price: 8200,
    emoji: '🧀',
    image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=800&auto=format&fit=crop&q=80',
    description: 'Doble medallón 300g, 4 fetas de cheddar, cebolla picada y ketchup',
    modifiers: ['Sin cebolla', 'Extra Cheddar (+$800)', 'Doble Bacon (+$1200)', 'Medallón Extra (+$2000)']
  },
  {
    id: 'prod-3',
    name: 'Triple Bacon BBQ',
    category: 'Hamburguesas',
    price: 9800,
    emoji: '🥓',
    image: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=800&auto=format&fit=crop&q=80',
    description: 'Triple medallón 450g, 6 fetas de cheddar, abundante bacon crocante y salsa BBQ',
    modifiers: ['Sin salsa BBQ', 'Extra Bacon (+$900)', 'Salsa Picante', 'Papas Grandes']
  },
  {
    id: 'prod-4',
    name: 'Crispy Chicken',
    category: 'Hamburguesas',
    price: 7400,
    emoji: '🍗',
    image: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=800&auto=format&fit=crop&q=80',
    description: 'Pechuga rebozada super crocante, coleslaw, pepinillos y salsa tártara',
    modifiers: ['Sin pepinillos', 'Sin coleslaw', 'Extra Queso (+$800)']
  },
  {
    id: 'prod-5',
    name: 'Burger Veggie Deluxe',
    category: 'Hamburguesas',
    price: 6900,
    emoji: '🥑',
    image: 'https://images.unsplash.com/photo-1520072959219-c595dc870360?w=800&auto=format&fit=crop&q=80',
    description: 'Medallón de lentejas y champignones, rúcula, tomate seco y queso provoleta',
    modifiers: ['Vegano sin queso', 'Sin rúcula']
  },
  {
    id: 'prod-6',
    name: 'Papas Fritas Clásicas',
    category: 'Agregados',
    price: 3500,
    emoji: '🍟',
    image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=800&auto=format&fit=crop&q=80',
    description: 'Porción grande de papas bastón crocantes',
    modifiers: ['Sin sal', 'Con provenzal']
  },
  {
    id: 'prod-7',
    name: 'Papas Cheddar & Bacon',
    category: 'Agregados',
    price: 4900,
    emoji: '🧀',
    image: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=800&auto=format&fit=crop&q=80',
    description: 'Papas fritas bañadas en salsa cheddar y lluvia de bacon crocante con verdeo',
    modifiers: ['Sin verdeo', 'Cheddar aparte', 'Doble Bacon (+$900)']
  },
  {
    id: 'prod-8',
    name: 'Aros de Cebolla (x10)',
    category: 'Agregados',
    price: 4200,
    emoji: '🧅',
    image: 'https://images.unsplash.com/photo-1639024471284-0af5676d738d?w=800&auto=format&fit=crop&q=80',
    description: 'Aros de cebolla rebozados con salsa barbacoa',
    modifiers: ['Con salsa picante', 'Con alioli']
  },
  {
    id: 'prod-9',
    name: 'Coca Cola 500ml',
    category: 'Bebidas',
    price: 2000,
    emoji: '🥤',
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&auto=format&fit=crop&q=80',
    description: 'Botella 500ml bien fría',
    modifiers: ['Fría', 'Natural']
  },
  {
    id: 'prod-10',
    name: 'Sprite 500ml',
    category: 'Bebidas',
    price: 2000,
    emoji: '🥤',
    image: 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=800&auto=format&fit=crop&q=80',
    description: 'Botella 500ml bien fría',
    modifiers: ['Fría', 'Natural']
  },
  {
    id: 'prod-11',
    name: 'Cerveza IPA 473ml',
    category: 'Bebidas',
    price: 3200,
    emoji: '🍺',
    image: 'https://images.unsplash.com/photo-1608270191763-71860d5b7808?w=800&auto=format&fit=crop&q=80',
    description: 'Lata de cerveza artesanal rubia o IPA',
    modifiers: ['Muy fría']
  },
  {
    id: 'prod-12',
    name: 'Mega Combo Doble + Papas + Bebida',
    category: 'Combos',
    price: 11200,
    emoji: '🔥',
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop&q=80',
    description: 'Doble Cuarto Cheddar + Papas Fritas + Gaseosa 500ml',
    modifiers: ['Con Coca Cola', 'Con Sprite', 'Con Cerveza (+$1000)', 'Papas con Cheddar (+$1200)']
  }
];

const DEFAULT_SETTINGS = {
  businessName: 'BURGER & CO. CHAMICAL',
  slogan: 'Hamburguesas Artesanales & Delivery Rápido',
  address: 'Av. Rivadavia 450, Chamical, La Rioja',
  phone: '+54 9 3826 45-6789',
  alias: 'BURGER.CHAMICAL.MP',
  cbu: '0000003100045678901234',
  ticketWidth: '58mm', // '58mm' | '80mm'
  ticketTheme: 'classic', // 'classic' | 'modern' | 'minimal' | 'street'
  ticketCustomFooter: '¡Gracias por su compra!\nComandaFast Gastronomía',
  ticketShowSlogan: true,
  ticketShowAddress: true,
  ticketShowPhone: true,
  ticketShowAlias: true,
  ticketShowCustomer: true,
  autoPrintOnConfirm: true,
  soundAlerts: true,
  deliveryDefaultFee: 1000,
  printerServerUrl: 'http://localhost:3001/print'
};

const KEYS = {
  CATEGORIES: 'comandafast_categories',
  CASHIERS: 'comandafast_cashiers',
  CURRENT_CASHIER: 'comandafast_current_cashier',
  PRODUCTS: 'comandafast_products',
  ORDERS: 'comandafast_orders',
  DELETED_ORDER_IDS: 'comandafast_deleted_order_ids',
  CASH_SHIFT: 'comandafast_cash_shift',
  CASH_SHIFTS_HISTORY: 'comandafast_cash_shifts_history',
  CANCELLED_ORDERS: 'comandafast_cancelled_orders',
  SETTINGS: 'comandafast_settings',
  ORDER_COUNTER: 'comandafast_order_counter',
  ORDER_COUNTER_DATE: 'comandafast_order_counter_date'
};


const SAMPLE_MOCK_SHIFTS = [
  {
    id: 'shift-prev-1',
    openedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    closedAt: new Date(Date.now() - 86400000 * 2 + 1000 * 60 * 60 * 6).toISOString(),
    initialCash: 15000,
    cashierName: 'Sofía Gomez',
    cashSales: 78500,
    expenses: [
      { id: 'exp-1', amount: 3500, reason: 'Compra de hielo y servilletas', timestamp: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString() }
    ],
    countedCash: 90000,
    expectedCash: 90000,
    difference: 0,
    notes: 'Turno sin novedades, arqueo exacto',
    isClosed: true
  },
  {
    id: 'shift-prev-2',
    openedAt: new Date(Date.now() - 86400000).toISOString(),
    closedAt: new Date(Date.now() - 86400000 + 1000 * 60 * 60 * 7).toISOString(),
    initialCash: 20000,
    cashierName: 'Lucas Martínez',
    cashSales: 94200,
    expenses: [
      { id: 'exp-2', amount: 5000, reason: 'Adelanto cadete de delivery', timestamp: new Date(Date.now() - 86400000 + 7200000).toISOString() }
    ],
    countedCash: 108200,
    expectedCash: 109200,
    difference: -1000,
    notes: 'Diferencia de $1.000 en cambio al cerrar',
    isClosed: true
  }
];

export const storageService = {
  init() {
    this.getProducts();
    this.getSettings();
    return true;
  },

  getCurrentCashShift() {
    return this.getCashShift();
  },
  getProducts() {
    const raw = localStorage.getItem(KEYS.PRODUCTS);
    if (!raw) {
      localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
      return DEFAULT_PRODUCTS;
    }
    try {
      const prods = JSON.parse(raw);
      let updated = false;
      const enriched = prods.map(p => {
        if (!p.image) {
          const match = DEFAULT_PRODUCTS.find(dp => dp.id === p.id || dp.name.toLowerCase() === p.name.toLowerCase());
          if (match && match.image) {
            updated = true;
            return { ...p, image: match.image };
          }
        }
        return p;
      });
      if (updated) {
        localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(enriched));
        return enriched;
      }
      return prods;
    } catch (_) {
      return DEFAULT_PRODUCTS;
    }
  },

  saveProducts(products) {
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
  },

  getOrders() {
    const raw = localStorage.getItem(KEYS.ORDERS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const deleted = this.getDeletedOrderIds();
      if (deleted.size > 0) {
        return parsed.filter(o => o && o.id && !deleted.has(String(o.id)));
      }
      return parsed;
    } catch (_) {
      return [];
    }
  },

  getNextOrderNumber() {
    const settings = this.getSettings();
    const today = new Date().toLocaleDateString('en-CA');
    const lastDate = localStorage.getItem(KEYS.ORDER_COUNTER_DATE);

    if (settings.resetDailyOrderNumber !== false && lastDate !== today) {
      localStorage.setItem(KEYS.ORDER_COUNTER_DATE, today);
      localStorage.setItem(KEYS.ORDER_COUNTER, '0');
    }

    let current = parseInt(localStorage.getItem(KEYS.ORDER_COUNTER) || '0', 10);
    current += 1;
    localStorage.setItem(KEYS.ORDER_COUNTER, current.toString());
    return current;
  },

  resetOrderCounter(val = 0) {
    localStorage.setItem(KEYS.ORDER_COUNTER, val.toString());
    localStorage.setItem(KEYS.ORDER_COUNTER_DATE, new Date().toLocaleDateString('en-CA'));
    return val;
  },

  reorderOrders(orderId, direction) {
    const orders = this.getOrders();
    const target = orders.find(o => o.id === orderId);
    if (!target) return orders;

    const sameStatusIndices = [];
    orders.forEach((o, i) => {
      if (o.status === target.status) sameStatusIndices.push(i);
    });

    const currentPos = sameStatusIndices.findIndex(i => orders[i].id === orderId);
    if (currentPos === -1) return orders;

    const newPos = currentPos + direction;
    if (newPos < 0 || newPos >= sameStatusIndices.length) return orders;

    const idx1 = sameStatusIndices[currentPos];
    const idx2 = sameStatusIndices[newPos];

    const temp = orders[idx1];
    orders[idx1] = orders[idx2];
    orders[idx2] = temp;

    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('comandafast:new-order', { detail: orders }));
    }
    return orders;
  },

  saveOrder(order) {
    if (!order || !order.id) return null;
    if (this.isOrderDeleted(order.id)) {
      return null;
    }
    const orders = this.getOrders();
    const id = order.id || 'ord-' + Date.now();
    const idx = orders.findIndex(o => o.id === id);
    if (idx !== -1) {
      orders[idx] = { 
        ...orders[idx], 
        ...order,
        updatedAt: order.updatedAt || Date.now()
      };
      localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
      return orders[idx];
    }

    const newOrder = {
      ...order,
      id,
      orderNumber: order.orderNumber || this.getNextOrderNumber(),
      createdAt: order.createdAt || new Date().toISOString(),
      updatedAt: order.updatedAt || Date.now(),
      status: order.status || 'pendiente',
      statusTimestamps: order.statusTimestamps || {
        createdAt: new Date().toISOString(),
        cookingAt: null,
        readyAt: null,
        deliveredAt: null
      }
    };
    orders.unshift(newOrder);
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
    return newOrder;
  },

  saveOrdersBatch(batch) {
    if (!Array.isArray(batch) || batch.length === 0) return this.getOrders();
    const deleted = this.getDeletedOrderIds();
    let orders = this.getOrders();
    for (const ord of batch) {
      if (!ord || !ord.id) continue;
      if (deleted.has(String(ord.id))) continue;
      const idx = orders.findIndex(o => o.id === ord.id);
      if (idx !== -1) {
        orders[idx] = {
          ...orders[idx],
          ...ord,
          updatedAt: ord.updatedAt || Date.now()
        };
      } else {
        orders.unshift({
          ...ord,
          orderNumber: ord.orderNumber || (Math.floor(Date.now() % 1000) + 1),
          createdAt: ord.createdAt || new Date().toISOString(),
          updatedAt: ord.updatedAt || Date.now(),
          status: ord.status || 'pendiente',
          statusTimestamps: ord.statusTimestamps || {
            createdAt: new Date().toISOString(),
            cookingAt: null,
            readyAt: null,
            deliveredAt: null
          }
        });
      }
    }
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
    return orders;
  },

  updateOrderStatus(orderId, newStatus) {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      orders[idx].status = newStatus;
      orders[idx].updatedAt = Date.now();
      if (!orders[idx].statusTimestamps) {
        orders[idx].statusTimestamps = {};
      }
      if (newStatus === 'cocina') orders[idx].statusTimestamps.cookingAt = new Date().toISOString();
      if (newStatus === 'listo') orders[idx].statusTimestamps.readyAt = new Date().toISOString();
      if (newStatus === 'entregado') orders[idx].statusTimestamps.deliveredAt = new Date().toISOString();
      
      localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
      return orders[idx];
    }
    return null;
  },

  getDeletedOrderIds() {
    try {
      const raw = localStorage.getItem(KEYS.DELETED_ORDER_IDS);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (_) {
      return new Set();
    }
  },

  isOrderDeleted(orderId) {
    if (!orderId) return false;
    const deleted = this.getDeletedOrderIds();
    return deleted.has(String(orderId));
  },

  markOrderDeleted(orderId) {
    if (!orderId) return;
    try {
      const deleted = this.getDeletedOrderIds();
      deleted.add(String(orderId));
      const arr = Array.from(deleted);
      const trimmed = arr.length > 500 ? arr.slice(-500) : arr;
      localStorage.setItem(KEYS.DELETED_ORDER_IDS, JSON.stringify(trimmed));
    } catch (_) {}
  },

  deleteOrder(orderId) {
    if (!orderId) return;
    this.markOrderDeleted(orderId);
    let orders = this.getOrders();
    orders = orders.filter(o => String(o.id) !== String(orderId));
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('comandafast:orders_updated', { detail: { orders } }));
    }
  },


  // ==========================================
  // GESTIÓN DE CATEGORÍAS
  // ==========================================
  getCategories() {
    let cats = [];
    const raw = localStorage.getItem(KEYS.CATEGORIES);
    if (raw) {
      try {
        cats = JSON.parse(raw);
      } catch (_) {}
    }
    if (!Array.isArray(cats) || cats.length === 0) {
      cats = [...DEFAULT_CATEGORIES];
    }
    // Asegurar que categorías existentes en productos estén contempladas
    const prods = this.getProducts();
    const existingNames = new Set(cats.map(c => typeof c === 'string' ? c.toLowerCase() : c.name.toLowerCase()));
    let hasNew = false;
    for (const p of prods) {
      if (p.category && !existingNames.has(p.category.toLowerCase())) {
        cats.push({
          id: 'cat-' + p.category.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          name: p.category,
          emoji: '📁'
        });
        existingNames.add(p.category.toLowerCase());
        hasNew = true;
      }
    }
    if (hasNew || !raw) {
      localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(cats));
    }
    return cats.map(c => typeof c === 'string' ? { id: 'cat-' + c.toLowerCase(), name: c, emoji: '📁' } : c);
  },

  saveCategories(categories) {
    if (!Array.isArray(categories)) return;
    localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('comandafast:categories_updated', { detail: { categories } }));
    }
  },

  addCategory(name, emoji = '📁') {
    const trimmed = String(name || '').trim();
    if (!trimmed) return { success: false, error: 'El nombre de la categoría no puede estar vacío.' };
    const current = this.getCategories();
    if (current.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, error: `La categoría "${trimmed}" ya existe.` };
    }
    const newCat = {
      id: 'cat-' + Date.now(),
      name: trimmed,
      emoji: emoji || '📁'
    };
    const updated = [...current, newCat];
    this.saveCategories(updated);
    return { success: true, category: newCat, categories: updated };
  },

  updateCategory(oldName, newName, newEmoji) {
    const oldTrimmed = String(oldName || '').trim();
    const newTrimmed = String(newName || '').trim();
    if (!oldTrimmed || !newTrimmed) return { success: false, error: 'Nombres inválidos.' };

    const current = this.getCategories();
    const idx = current.findIndex(c => c.name.toLowerCase() === oldTrimmed.toLowerCase());
    if (idx === -1) return { success: false, error: 'Categoría no encontrada.' };

    if (oldTrimmed.toLowerCase() !== newTrimmed.toLowerCase()) {
      if (current.some((c, i) => i !== idx && c.name.toLowerCase() === newTrimmed.toLowerCase())) {
        return { success: false, error: `Ya existe otra categoría con el nombre "${newTrimmed}".` };
      }
    }

    current[idx] = {
      ...current[idx],
      name: newTrimmed,
      emoji: newEmoji !== undefined ? newEmoji : (current[idx].emoji || '📁')
    };
    this.saveCategories(current);

    // Actualizar en cascada todos los productos que pertenecían a la categoría vieja
    const prods = this.getProducts();
    let prodsChanged = false;
    const updatedProds = prods.map(p => {
      if (p.category && p.category.toLowerCase() === oldTrimmed.toLowerCase()) {
        prodsChanged = true;
        return { ...p, category: newTrimmed };
      }
      return p;
    });

    if (prodsChanged) {
      this.saveProducts(updatedProds);
    }

    return { success: true, category: current[idx], categories: current, updatedProducts: updatedProds, prodsChanged };
  },

  deleteCategory(categoryName, fallbackCategory = 'General') {
    const targetName = String(categoryName || '').trim();
    if (!targetName) return { success: false, error: 'Nombre inválido.' };

    let current = this.getCategories();
    current = current.filter(c => c.name.toLowerCase() !== targetName.toLowerCase());

    if (current.length === 0) {
      current.push({ id: 'cat-general', name: 'General', emoji: '📁' });
    }
    this.saveCategories(current);

    // Reasignar productos huérfanos a la categoría de respaldo
    const prods = this.getProducts();
    let prodsChanged = false;
    const fallback = fallbackCategory || 'General';
    const updatedProds = prods.map(p => {
      if (p.category && p.category.toLowerCase() === targetName.toLowerCase()) {
        prodsChanged = true;
        return { ...p, category: fallback };
      }
      return p;
    });

    if (prodsChanged) {
      this.saveProducts(updatedProds);
    }

    return { success: true, categories: current, updatedProducts: updatedProds, prodsChanged };
  },

  // CASH SHIFTS (Control de Caja)
  getCashShift() {
    const raw = localStorage.getItem(KEYS.CASH_SHIFT);
    return raw ? JSON.parse(raw) : null;
  },

  openCashShift(initialCash = 0, cashierName = 'Cajero 1') {
    const shift = {
      id: 'shift-' + Date.now(),
      openedAt: new Date().toISOString(),
      closedAt: null,
      initialCash: Number(initialCash),
      cashierName,
      expenses: [],
      notes: '',
      isClosed: false
    };
    localStorage.setItem(KEYS.CASH_SHIFT, JSON.stringify(shift));
    return shift;
  },

  addCashExpense(amount, reason) {
    const shift = this.getCashShift();
    if (!shift || shift.isClosed) return null;
    shift.expenses.push({
      id: 'exp-' + Date.now(),
      amount: Number(amount),
      reason,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(KEYS.CASH_SHIFT, JSON.stringify(shift));
    return shift;
  },

  getCashShiftsHistory() {
    const raw = localStorage.getItem(KEYS.CASH_SHIFTS_HISTORY);
    if (!raw) {
      localStorage.setItem(KEYS.CASH_SHIFTS_HISTORY, JSON.stringify(SAMPLE_MOCK_SHIFTS));
      return SAMPLE_MOCK_SHIFTS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return SAMPLE_MOCK_SHIFTS;
    }
  },

  saveCashShift(shift) {
    localStorage.setItem(KEYS.CASH_SHIFT, JSON.stringify(shift));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('comandafast:cash-shift-change', { detail: shift }));
    }
    return shift;
  },

  closeCashShift(countedCash, notes = '') {
    const shift = this.getCashShift();
    if (!shift) return null;
    const now = new Date().toISOString();
    shift.closedAt = now;
    shift.countedCash = Number(countedCash);
    shift.notes = notes;
    shift.isClosed = true;

    // Calcular ventas en efectivo durante este turno
    const orders = this.getOrders();
    const shiftOrders = orders.filter(o => {
      const t = new Date(o.createdAt);
      return t >= new Date(shift.openedAt) && t <= new Date(now) && o.paymentMethod === 'efectivo';
    });
    const cashSales = shiftOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalExpenses = (shift.expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const expected = (Number(shift.initialCash) || 0) + cashSales - totalExpenses;
    const difference = Number(countedCash) - expected;

    shift.cashSales = cashSales;
    shift.expectedCash = expected;
    shift.difference = difference;

    localStorage.setItem(KEYS.CASH_SHIFT, JSON.stringify(shift));

    // Guardar en historial inmutable de turnos
    const history = this.getCashShiftsHistory();
    history.unshift({ ...shift });
    localStorage.setItem(KEYS.CASH_SHIFTS_HISTORY, JSON.stringify(history));

    return shift;
  },

  // AUDITORÍA DE ANULACIONES / SEGURIDAD
  getCancelledOrders() {
    const raw = localStorage.getItem(KEYS.CANCELLED_ORDERS);
    return raw ? JSON.parse(raw) : [];
  },

  cancelOrder(orderId, reason = 'Cancelado por solicitud de cliente', author = 'Cajero') {
    const orders = this.getOrders();
    const orderToCancel = orders.find(o => o.id === orderId);
    if (!orderToCancel) return false;

    // Registrar en cancelaciones
    const cancelled = this.getCancelledOrders();
    cancelled.unshift({
      ...orderToCancel,
      cancelledAt: new Date().toISOString(),
      cancelReason: reason,
      cancelAuthor: author
    });
    localStorage.setItem(KEYS.CANCELLED_ORDERS, JSON.stringify(cancelled));

    // Remover de órdenes activas
    const updated = orders.filter(o => o.id !== orderId);
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(updated));
    return true;
  },

  // SETTINGS
  getSettings() {
    const raw = localStorage.getItem(KEYS.SETTINGS);
    if (!raw) {
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      return DEFAULT_SETTINGS;
    }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  },

  saveSettings(settings) {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  },

  exportBackup() {
    return JSON.stringify({
      products: this.getProducts(),
      orders: this.getOrders(),
      cashShift: this.getCashShift(),
      settings: this.getSettings()
    }, null, 2);
  },

  importBackup(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.products) localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(data.products));
      if (data.orders) localStorage.setItem(KEYS.ORDERS, JSON.stringify(data.orders));
      if (data.cashShift) localStorage.setItem(KEYS.CASH_SHIFT, JSON.stringify(data.cashShift));
      if (data.settings) localStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  // =========================================================
  // GESTIÓN DIRECTA DE TABLAS (PARA EL PANEL DEL DUEÑO)
  // =========================================================

  updateProduct(id, updatedFields) {
    const products = this.getProducts();
    const idx = products.findIndex(p => p.id === id);
    if (idx !== -1) {
      products[idx] = { ...products[idx], ...updatedFields };
      this.saveProducts(products);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('comandafast:products_updated', { detail: products }));
      }
      return products[idx];
    }
    return null;
  },

  deleteProduct(id) {
    let products = this.getProducts();
    products = products.filter(p => p.id !== id);
    this.saveProducts(products);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('comandafast:products_updated', { detail: products }));
    }
    return true;
  },

  addProduct(newProduct) {
    const products = this.getProducts();
    const item = {
      ...newProduct,
      id: newProduct.id || 'prod-' + Date.now(),
      price: Number(newProduct.price) || 0,
      modifiers: Array.isArray(newProduct.modifiers) ? newProduct.modifiers : []
    };
    products.push(item);
    this.saveProducts(products);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('comandafast:products_updated', { detail: products }));
    }
    return item;
  },

  updateOrder(id, updatedFields) {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === id);
    if (idx !== -1) {
      orders[idx] = { ...orders[idx], ...updatedFields };
      if (updatedFields.total !== undefined) {
        orders[idx].total = Number(updatedFields.total);
      }
      localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('comandafast:orders_updated', { detail: orders }));
      }
      return orders[idx];
    }
    return null;
  },

  updateCashShiftHistoryItem(id, updatedFields) {
    const history = this.getCashShiftsHistory();
    const idx = history.findIndex(s => s.id === id);
    if (idx !== -1) {
      history[idx] = { ...history[idx], ...updatedFields };
      if (updatedFields.initialCash !== undefined || updatedFields.countedCash !== undefined) {
        const initial = Number(history[idx].initialCash) || 0;
        const sales = Number(history[idx].cashSales) || 0;
        const counted = Number(history[idx].countedCash) || 0;
        const expected = Number(history[idx].expectedCash) || (initial + sales);
        history[idx].difference = counted - expected;
      }
      localStorage.setItem(KEYS.CASH_SHIFTS_HISTORY, JSON.stringify(history));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('comandafast:shifts_updated', { detail: history }));
      }
      return history[idx];
    }
    return null;
  },

  deleteCashShiftHistoryItem(id) {
    let history = this.getCashShiftsHistory();
    history = history.filter(s => s.id !== id);
    localStorage.setItem(KEYS.CASH_SHIFTS_HISTORY, JSON.stringify(history));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('comandafast:shifts_updated', { detail: history }));
    }
    return true;
  },

  addCashShiftHistoryItem(newShift) {
    const history = this.getCashShiftsHistory();
    const item = {
      ...newShift,
      id: newShift.id || 'shift-' + Date.now(),
      openedAt: newShift.openedAt || new Date().toISOString(),
      closedAt: newShift.closedAt || new Date().toISOString(),
      initialCash: Number(newShift.initialCash) || 0,
      countedCash: Number(newShift.countedCash) || 0,
      expectedCash: Number(newShift.expectedCash) || Number(newShift.initialCash) || 0,
      difference: Number(newShift.difference) || 0,
      isClosed: true
    };
    history.unshift(item);
    localStorage.setItem(KEYS.CASH_SHIFTS_HISTORY, JSON.stringify(history));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('comandafast:shifts_updated', { detail: history }));
    }
    return item;
  },


  // --- CASHIERS (Gestión local y caché de cuentas de cajeros) ---
  getCashiers() {
    try {
      const data = localStorage.getItem(KEYS.CASHIERS);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveCashiers(cashiers) {
    try {
      localStorage.setItem(KEYS.CASHIERS, JSON.stringify(cashiers || []));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('comandafast:cashiers_updated', { detail: cashiers }));
      }
    } catch (e) {
      console.error('[Storage] Error saving cashiers:', e);
    }
  },

  addCashier(cashier) {
    const list = this.getCashiers();
    const existingIdx = list.findIndex(c => c.id === cashier.id || c.username === cashier.username);
    if (existingIdx !== -1) {
      list[existingIdx] = { ...list[existingIdx], ...cashier, updatedAt: new Date().toISOString() };
    } else {
      list.push({ ...cashier, createdAt: cashier.createdAt || new Date().toISOString() });
    }
    this.saveCashiers(list);
    return cashier;
  },

  getCurrentCashier() {
    try {
      const data = localStorage.getItem(KEYS.CURRENT_CASHIER);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  setCurrentCashier(cashier) {
    try {
      if (!cashier) {
        localStorage.removeItem(KEYS.CURRENT_CASHIER);
      } else {
        localStorage.setItem(KEYS.CURRENT_CASHIER, JSON.stringify(cashier));
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('comandafast:cashier_changed', { detail: cashier }));
      }
    } catch (e) {
      console.error('[Storage] Error setting current cashier:', e);
    }
  },

  clearCurrentCashier() {
    this.setCurrentCashier(null);
  },

};
