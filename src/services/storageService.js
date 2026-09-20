// =========================================================
// STORAGE SERVICE — LOCAL DATA & PERSISTENCE
// =========================================================

const DEFAULT_PRODUCTS = [
  {
    id: 'prod-1',
    name: 'Burger Clásica',
    category: 'Hamburguesas',
    price: 6500,
    emoji: '🍔',
    description: 'Medallón 150g, lechuga, tomate, queso y mayonesa casera',
    modifiers: ['Sin cebolla', 'Sin tomate', 'Extra Cheddar (+$800)', 'Extra Bacon (+$900)', 'Papas Rústicas']
  },
  {
    id: 'prod-2',
    name: 'Doble Cuarto Cheddar',
    category: 'Hamburguesas',
    price: 8200,
    emoji: '🧀',
    description: 'Doble medallón 300g, 4 fetas de cheddar, cebolla picada y ketchup',
    modifiers: ['Sin cebolla', 'Extra Cheddar (+$800)', 'Doble Bacon (+$1200)', 'Medallón Extra (+$2000)']
  },
  {
    id: 'prod-3',
    name: 'Triple Bacon BBQ',
    category: 'Hamburguesas',
    price: 9800,
    emoji: '🥓',
    description: 'Triple medallón 450g, 6 fetas de cheddar, abundante bacon crocante y salsa BBQ',
    modifiers: ['Sin salsa BBQ', 'Extra Bacon (+$900)', 'Salsa Picante', 'Papas Grandes']
  },
  {
    id: 'prod-4',
    name: 'Crispy Chicken',
    category: 'Hamburguesas',
    price: 7400,
    emoji: '🍗',
    description: 'Pechuga rebozada super crocante, coleslaw, pepinillos y salsa tártara',
    modifiers: ['Sin pepinillos', 'Sin coleslaw', 'Extra Queso (+$800)']
  },
  {
    id: 'prod-5',
    name: 'Burger Veggie Deluxe',
    category: 'Hamburguesas',
    price: 6900,
    emoji: '🌱',
    description: 'Medallón de lentejas y champignones, rúcula, tomate seco y queso provoleta',
    modifiers: ['Vegano sin queso', 'Sin rúcula']
  },
  {
    id: 'prod-6',
    name: 'Papas Fritas Clásicas',
    category: 'Agregados',
    price: 3500,
    emoji: '🍟',
    description: 'Porción grande de papas bastón crocantes',
    modifiers: ['Sin sal', 'Con provenzal']
  },
  {
    id: 'prod-7',
    name: 'Papas Cheddar & Bacon',
    category: 'Agregados',
    price: 4900,
    emoji: '🧀',
    description: 'Papas fritas bañadas en salsa cheddar y lluvia de bacon crocante con verdeo',
    modifiers: ['Sin verdeo', 'Cheddar aparte', 'Doble Bacon (+$900)']
  },
  {
    id: 'prod-8',
    name: 'Aros de Cebolla (x10)',
    category: 'Agregados',
    price: 4200,
    emoji: '🧅',
    description: 'Aros de cebolla rebozados con salsa barbacoa',
    modifiers: ['Con salsa picante', 'Con alioli']
  },
  {
    id: 'prod-9',
    name: 'Coca Cola 500ml',
    category: 'Bebidas',
    price: 2000,
    emoji: '🥤',
    description: 'Botella 500ml bien fría',
    modifiers: ['Fría', 'Natural']
  },
  {
    id: 'prod-10',
    name: 'Sprite 500ml',
    category: 'Bebidas',
    price: 2000,
    emoji: '🍋',
    description: 'Botella 500ml bien fría',
    modifiers: ['Fría', 'Natural']
  },
  {
    id: 'prod-11',
    name: 'Cerveza IPA 473ml',
    category: 'Bebidas',
    price: 3200,
    emoji: '🍺',
    description: 'Lata de cerveza artesanal rubia o IPA',
    modifiers: ['Muy fría']
  },
  {
    id: 'prod-12',
    name: 'Mega Combo Doble + Papas + Bebida',
    category: 'Combos',
    price: 11200,
    emoji: '⭐',
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
  PRODUCTS: 'comandafast_products',
  ORDERS: 'comandafast_orders',
  CASH_SHIFT: 'comandafast_cash_shift',
  CASH_SHIFTS_HISTORY: 'comandafast_cash_shifts_history',
  CANCELLED_ORDERS: 'comandafast_cancelled_orders',
  SETTINGS: 'comandafast_settings',
  ORDER_COUNTER: 'comandafast_order_counter'
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
    return JSON.parse(raw);
  },

  saveProducts(products) {
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
  },

  getOrders() {
    const raw = localStorage.getItem(KEYS.ORDERS);
    return raw ? JSON.parse(raw) : [];
  },

  getNextOrderNumber() {
    let current = parseInt(localStorage.getItem(KEYS.ORDER_COUNTER) || '100', 10);
    current += 1;
    localStorage.setItem(KEYS.ORDER_COUNTER, current.toString());
    return current;
  },

  saveOrder(order) {
    const orders = this.getOrders();
    const newOrder = {
      ...order,
      id: order.id || 'ord-' + Date.now(),
      orderNumber: order.orderNumber || this.getNextOrderNumber(),
      createdAt: order.createdAt || new Date().toISOString(),
      status: order.status || 'pendiente',
      statusTimestamps: {
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

  updateOrderStatus(orderId, newStatus) {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      orders[idx].status = newStatus;
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

  deleteOrder(orderId) {
    let orders = this.getOrders();
    orders = orders.filter(o => o.id !== orderId);
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
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
  }
};
