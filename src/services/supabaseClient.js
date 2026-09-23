// =========================================================
// SUPABASE CLIENT - CLOUD CRUD SERVICE (FUENTE DE VERDAD)
// =========================================================

import { storageService } from './storageService';

export const DEFAULT_SUPABASE_URL = 'https://yqynuvjpipmvurualgtg.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxeW51dmpwaXBtdnVydWFsZ3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MzMyOTgsImV4cCI6MjEwNTUwOTI5OH0.mLO52rFPD384yQHdGlBasrx4QvqXiHYH3zRmJ9Bq2go';

// =========================================================
// HELPERS INTERNOS
// =========================================================
function mapOrderFromDB(o) {
  if (!o) return null;
  return {
    id: o.id,
    orderNumber: o.order_number,
    channel: o.channel || 'mostrador',
    tableNumber: o.table_number || '',
    customer: typeof o.customer === 'object' && o.customer !== null
      ? o.customer
      : { name: o.customer || 'Cliente' },
    items: (Array.isArray(o.items)
      ? o.items
      : (typeof o.items === 'string' ? (() => { try { return JSON.parse(o.items); } catch { return []; } })() : [])
    ).map(i => ({
      id: i.id || `item-${Math.random()}`,
      qty: i.qty || 1,
      name: i.name || '',
      unitPrice: Number(i.unitPrice || i.price) || 0,
      notes: i.notes || '',
      modifiers: i.modifiers || []
    })),
    subtotal: Number(o.subtotal) || Number(o.total) || 0,
    deliveryFee: Number(o.delivery_fee) || 0,
    total: Number(o.total) || 0,
    paymentMethod: o.payment_method || 'efectivo',
    cashPaid: o.cash_paid,
    cashChange: o.cash_change,
    transferProof: o.transfer_proof,
    transferConfirmed: o.transfer_confirmed,
    status: o.status || 'pendiente',
    statusTimestamps: o.status_timestamps || {},
    createdAt: o.created_at,
    updatedAt: o.updated_at ? new Date(o.updated_at).getTime() : (o.created_at ? new Date(o.created_at).getTime() : Date.now())
  };
}

function mapProductFromDB(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    price: Number(p.price),
    emoji: p.emoji || '🍔',
    description: p.description || '',
    modifiers: Array.isArray(p.modifiers) ? p.modifiers : [],
    image: p.image || '',
    is_active: p.is_active !== false
  };
}

function mapCashShiftFromDB(r) {
  if (!r) return null;
  return {
    id: r.id,
    openedAt: r.opened_at,
    closedAt: r.closed_at,
    initialCash: Number(r.initial_cash) || 0,
    countedCash: r.counted_cash !== null && r.counted_cash !== undefined ? Number(r.counted_cash) : null,
    cashierName: r.cashier_name || 'Cajero 1',
    expenses: Array.isArray(r.expenses) ? r.expenses : [],
    notes: r.notes || '',
    isClosed: Boolean(r.is_closed),
    cashSales: Number(r.cash_sales) || 0,
    expectedCash: Number(r.expected_cash) || 0,
    difference: Number(r.difference) || 0,
    updatedAt: r.created_at ? new Date(r.created_at).getTime() : Date.now()
  };
}

function mapOrderToDB(order) {
  return {
    id: order.id,
    order_number: Number(order.orderNumber) || 1,
    channel: order.channel || 'mostrador',
    table_number: order.tableNumber || '',
    customer: typeof order.customer === 'object' && order.customer ? order.customer : { name: order.customer || 'Cliente' },
    items: order.items || [],
    subtotal: Number(order.subtotal) || Number(order.total) || 0,
    delivery_fee: Number(order.deliveryFee) || 0,
    total: Number(order.total) || 0,
    payment_method: order.paymentMethod || 'efectivo',
    cash_paid: order.cashPaid || null,
    cash_change: order.cashChange || null,
    transfer_proof: order.transferProof || null,
    transfer_confirmed: Boolean(order.transferConfirmed),
    status: order.status || 'pendiente',
    status_timestamps: order.statusTimestamps || {},
    created_at: order.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function mapProductToDB(p) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    price: Number(p.price) || 0,
    emoji: p.emoji || '🍔',
    description: p.description || '',
    modifiers: p.modifiers || [],
    is_active: p.is_active !== false,
    updated_at: new Date().toISOString()
  };
}

function mapCashShiftToDB(shift) {
  return {
    id: shift.id,
    opened_at: shift.openedAt,
    closed_at: shift.closedAt || null,
    initial_cash: Number(shift.initialCash) || 0,
    counted_cash: shift.countedCash !== undefined && shift.countedCash !== null ? Number(shift.countedCash) : null,
    cashier_name: shift.cashierName || 'Cajero 1',
    expenses: shift.expenses || [],
    notes: shift.notes || '',
    is_closed: Boolean(shift.isClosed)
  };
}


function mapCashierFromDB(r) {
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    pin: r.pin,
    name: r.name,
    role: r.role || 'cajero',
    isActive: r.is_active !== undefined ? Boolean(r.is_active) : true,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

function mapCashierToDB(c) {
  return {
    id: c.id,
    username: c.username,
    pin: c.pin,
    name: c.name,
    role: c.role || 'cajero',
    is_active: c.isActive !== undefined ? Boolean(c.isActive) : true,
    updated_at: new Date().toISOString()
  };
}

// =========================================================
// CLIENTE PRINCIPAL
// =========================================================
export const supabaseSync = {
  getCredentials() {
    const settings = storageService.getSettings();
    return {
      url: settings?.supabaseUrl || DEFAULT_SUPABASE_URL,
      anonKey: settings?.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY
    };
  },

  isConfigured() {
    const { url, anonKey } = this.getCredentials();
    return Boolean(url && anonKey && url.startsWith('http'));
  },

  _headers(extra = {}) {
    const { anonKey } = this.getCredentials();
    return {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
      ...extra
    };
  },

  _url(table, query = '') {
    const { url } = this.getCredentials();
    return `${url}/rest/v1/${table}${query ? '?' + query : ''}`;
  },

  // ===================== ORDERS =====================

  async fetchOrders(limit = 300) {
    if (!this.isConfigured()) return [];
    try {
      const res = await fetch(this._url('orders', `order=created_at.desc&limit=${limit}`), {
        headers: this._headers()
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows)) {
          return rows.map(mapOrderFromDB).filter(o => o && !storageService.isOrderDeleted(o.id));
        }
      }
    } catch (_) {}
    return [];
  },

  // Alias legacy
  async fetchRecentOrders(limit = 150) {
    return this.fetchOrders(limit);
  },

  async createOrder(order) {
    if (!this.isConfigured()) return;
    try {
      const res = await fetch(this._url('orders'), {
        method: 'POST',
        headers: this._headers({ 'Prefer': 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify(mapOrderToDB(order))
      });
      if (res.ok) {
        const rows = await res.json();
        return Array.isArray(rows) ? mapOrderFromDB(rows[0]) : null;
      }
    } catch (e) {
      console.warn('[Supabase] createOrder error:', e);
    }
    return null;
  },

  // Alias legacy
  async pushOrder(order) {
    return this.createOrder(order);
  },

  async updateOrder(orderId, patchData) {
    if (!this.isConfigured()) return;
    try {
      const dbPatch = {};
      if (patchData.status !== undefined) dbPatch.status = patchData.status;
      if (patchData.statusTimestamps !== undefined) dbPatch.status_timestamps = patchData.statusTimestamps;
      if (patchData.transferConfirmed !== undefined) dbPatch.transfer_confirmed = patchData.transferConfirmed;
      if (patchData.transferProof !== undefined) dbPatch.transfer_proof = patchData.transferProof;
      if (patchData.items !== undefined) dbPatch.items = patchData.items;
      if (patchData.total !== undefined) dbPatch.total = patchData.total;
      if (patchData.subtotal !== undefined) dbPatch.subtotal = patchData.subtotal;
      if (patchData.paymentMethod !== undefined) dbPatch.payment_method = patchData.paymentMethod;
      dbPatch.updated_at = new Date().toISOString();

      await fetch(this._url('orders', `id=eq.${orderId}`), {
        method: 'PATCH',
        headers: this._headers(),
        body: JSON.stringify(dbPatch)
      });
    } catch (e) {
      console.warn('[Supabase] updateOrder error:', e);
    }
  },

  async updateOrderStatus(orderId, status, extraTimestamps = {}) {
    if (!this.isConfigured()) return;
    try {
      const patch = {
        status,
        updated_at: new Date().toISOString()
      };
      if (Object.keys(extraTimestamps).length > 0) {
        patch.status_timestamps = extraTimestamps;
      }
      await fetch(this._url('orders', `id=eq.${orderId}`), {
        method: 'PATCH',
        headers: this._headers(),
        body: JSON.stringify(patch)
      });
    } catch (e) {
      console.warn('[Supabase] updateOrderStatus error:', e);
    }
  },

  async deleteOrder(orderId) {
    if (!this.isConfigured() || !orderId) return false;
    try {
      const cleanId = String(orderId).trim();
      const res = await fetch(this._url('orders', `id=eq.${encodeURIComponent(cleanId)}`), {
        method: 'DELETE',
        headers: this._headers({ 'Prefer': 'return=representation' })
      });
      if (res.ok) {
        console.log(`[Supabase] Orden ${cleanId} eliminada permanentemente de la nube.`);
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[Supabase] deleteOrder error:', e);
      return false;
    }
  },

  async clearAllOrders() {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(this._url('orders', 'id=neq.dummy_never_matches'), {
        method: 'DELETE',
        headers: this._headers({ 'Prefer': 'return=representation' })
      });
      return res.ok;
    } catch (e) {
      console.warn('[Supabase] clearAllOrders error:', e);
      return false;
    }
  },

  async pushOrdersBatch(orders) {
    if (!this.isConfigured() || !Array.isArray(orders) || orders.length === 0) return;
    try {
      const rows = orders.map(mapOrderToDB);
      await fetch(this._url('orders'), {
        method: 'POST',
        headers: this._headers({ 'Prefer': 'resolution=merge-duplicates' }),
        body: JSON.stringify(rows)
      });
    } catch (e) {
      console.warn('[Supabase] pushOrdersBatch error:', e);
    }
  },

  // ===================== PRODUCTS =====================

  async fetchProducts() {
    if (!this.isConfigured()) return null;
    try {
      const res = await fetch(this._url('products', 'order=name.asc'), {
        headers: this._headers()
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          return rows.map(mapProductFromDB);
        }
      }
    } catch (e) {
      console.warn('[Supabase] fetchProducts error:', e);
    }
    return null;
  },

  async createProduct(product) {
    if (!this.isConfigured()) return;
    try {
      await fetch(this._url('products'), {
        method: 'POST',
        headers: this._headers({ 'Prefer': 'resolution=merge-duplicates' }),
        body: JSON.stringify(mapProductToDB(product))
      });
    } catch (e) {
      console.warn('[Supabase] createProduct error:', e);
    }
  },

  async updateProduct(id, patchData) {
    if (!this.isConfigured()) return;
    try {
      const dbPatch = { updated_at: new Date().toISOString() };
      if (patchData.name !== undefined) dbPatch.name = patchData.name;
      if (patchData.category !== undefined) dbPatch.category = patchData.category;
      if (patchData.price !== undefined) dbPatch.price = Number(patchData.price);
      if (patchData.emoji !== undefined) dbPatch.emoji = patchData.emoji;
      if (patchData.description !== undefined) dbPatch.description = patchData.description;
      if (patchData.modifiers !== undefined) dbPatch.modifiers = patchData.modifiers;
      if (patchData.image !== undefined) dbPatch.image = patchData.image;
      if (patchData.is_active !== undefined) dbPatch.is_active = patchData.is_active;

      await fetch(this._url('products', `id=eq.${id}`), {
        method: 'PATCH',
        headers: this._headers(),
        body: JSON.stringify(dbPatch)
      });
    } catch (e) {
      console.warn('[Supabase] updateProduct error:', e);
    }
  },

  async deleteProduct(id) {
    if (!this.isConfigured()) return;
    try {
      await fetch(this._url('products', `id=eq.${id}`), {
        method: 'DELETE',
        headers: this._headers()
      });
    } catch (e) {
      console.warn('[Supabase] deleteProduct error:', e);
    }
  },

  async pushProducts(products) {
    if (!this.isConfigured()) return;
    try {
      const rows = products.map(mapProductToDB);
      await fetch(this._url('products'), {
        method: 'POST',
        headers: this._headers({ 'Prefer': 'resolution=merge-duplicates' }),
        body: JSON.stringify(rows)
      });
    } catch (e) {
      console.warn('[Supabase] pushProducts error:', e);
    }
  },

  // ===================== CASH SHIFTS =====================

  async fetchActiveCashShift() {
    if (!this.isConfigured()) return null;
    try {
      const res = await fetch(this._url('cash_shifts', 'is_closed=eq.false&order=opened_at.desc&limit=1'), {
        headers: this._headers()
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) return mapCashShiftFromDB(rows[0]);
      }
    } catch (_) {}
    return null;
  },

  async fetchLatestCashShift() {
    if (!this.isConfigured()) return null;
    try {
      const res = await fetch(this._url('cash_shifts', 'order=opened_at.desc&limit=1'), {
        headers: this._headers()
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) return mapCashShiftFromDB(rows[0]);
      }
    } catch (_) {}
    return null;
  },

  async fetchCashShiftsHistory(limit = 50) {
    if (!this.isConfigured()) return [];
    try {
      const res = await fetch(this._url('cash_shifts', `order=opened_at.desc&limit=${limit}`), {
        headers: this._headers()
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows)) return rows.map(mapCashShiftFromDB);
      }
    } catch (_) {}
    return [];
  },

  async createCashShift(shift) {
    if (!this.isConfigured() || !shift) return;
    try {
      await fetch(this._url('cash_shifts'), {
        method: 'POST',
        headers: this._headers({ 'Prefer': 'resolution=merge-duplicates' }),
        body: JSON.stringify(mapCashShiftToDB(shift))
      });
    } catch (e) {
      console.warn('[Supabase] createCashShift error:', e);
    }
  },

  // Alias legacy
  async pushCashShift(shift) {
    return this.createCashShift(shift);
  },

  async updateCashShift(id, patchData) {
    if (!this.isConfigured()) return;
    try {
      const dbPatch = {};
      if (patchData.expenses !== undefined) dbPatch.expenses = patchData.expenses;
      if (patchData.closedAt !== undefined) dbPatch.closed_at = patchData.closedAt;
      if (patchData.countedCash !== undefined) dbPatch.counted_cash = patchData.countedCash !== null ? Number(patchData.countedCash) : null;
      if (patchData.isClosed !== undefined) dbPatch.is_closed = patchData.isClosed;
      if (patchData.notes !== undefined) dbPatch.notes = patchData.notes;

      await fetch(this._url('cash_shifts', `id=eq.${id}`), {
        method: 'PATCH',
        headers: this._headers(),
        body: JSON.stringify(dbPatch)
      });
    } catch (e) {
      console.warn('[Supabase] updateCashShift error:', e);
    }
  },

  async deleteCashShift(id) {
    if (!this.isConfigured()) return;
    try {
      await fetch(this._url('cash_shifts', `id=eq.${id}`), {
        method: 'DELETE',
        headers: this._headers()
      });
    } catch (e) {
      console.warn('[Supabase] deleteCashShift error:', e);
    }
  },

  
  // ===================== CASHIERS CRUD =====================

  async fetchCashiers() {
    if (!this.isConfigured()) return [];
    try {
      const res = await fetch(this._url('cashiers', 'order=name.asc'), { headers: this._headers() });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows)) return rows.map(mapCashierFromDB);
      }
    } catch (_) {}
    return [];
  },

  async createCashier(cashier) {
    if (!this.isConfigured() || !cashier) return null;
    try {
      const res = await fetch(this._url('cashiers'), {
        method: 'POST',
        headers: this._headers({ 'Prefer': 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify(mapCashierToDB(cashier))
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) && data[0] ? mapCashierFromDB(data[0]) : cashier;
      }
    } catch (e) {
      console.warn('[Supabase] createCashier error:', e);
    }
    return cashier;
  },

  async updateCashier(id, patch) {
    if (!this.isConfigured()) return;
    try {
      const dbPatch = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.username !== undefined) dbPatch.username = patch.username;
      if (patch.pin !== undefined) dbPatch.pin = patch.pin;
      if (patch.role !== undefined) dbPatch.role = patch.role;
      if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;
      dbPatch.updated_at = new Date().toISOString();

      await fetch(this._url('cashiers', `id=eq.${id}`), {
        method: 'PATCH',
        headers: this._headers(),
        body: JSON.stringify(dbPatch)
      });
    } catch (e) {
      console.warn('[Supabase] updateCashier error:', e);
    }
  },

  async deleteCashier(id) {
    if (!this.isConfigured()) return;
    try {
      await fetch(this._url('cashiers', `id=eq.${id}`), {
        method: 'DELETE',
        headers: this._headers()
      });
    } catch (e) {
      console.warn('[Supabase] deleteCashier error:', e);
    }
  },

  // ===================== SYSTEM SETTINGS =====================

  async fetchSettings() {
    if (!this.isConfigured()) return null;
    try {
      const res = await fetch(this._url('system_settings', 'id=eq.general&limit=1'), { headers: this._headers() });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0 && rows[0].data) {
          return rows[0].data;
        }
      }
    } catch (_) {}
    return null;
  },

  async saveSettings(settingsData) {
    if (!this.isConfigured() || !settingsData) return;
    try {
      await fetch(this._url('system_settings'), {
        method: 'POST',
        headers: this._headers({ 'Prefer': 'resolution=merge-duplicates' }),
        body: JSON.stringify({
          id: 'general',
          data: settingsData,
          updated_at: new Date().toISOString()
        })
      });
      console.log('[Supabase] Configuraciones del sistema sincronizadas en la nube.');
    } catch (e) {
      console.warn('[Supabase] saveSettings error:', e);
    }
  },


  // ===================== CATEGORIES =====================

  async fetchCategories() {
    if (!this.isConfigured()) return [];
    try {
      const res = await fetch(this._url('system_settings', 'id=eq.categories&limit=1'), { headers: this._headers() });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0 && rows[0].data && Array.isArray(rows[0].data.categories)) {
          return rows[0].data.categories;
        }
      }
    } catch (_) {}
    return [];
  },

  async saveCategories(categories) {
    if (!this.isConfigured() || !Array.isArray(categories)) return;
    try {
      await fetch(this._url('system_settings'), {
        method: 'POST',
        headers: this._headers({ 'Prefer': 'resolution=merge-duplicates' }),
        body: JSON.stringify({
          id: 'categories',
          data: { categories },
          updated_at: new Date().toISOString()
        })
      });
      console.log('[Supabase] Categorías sincronizadas en la nube.');
    } catch (e) {
      console.warn('[Supabase] saveCategories error:', e);
    }
  },

  // ===================== BOT & AI CONFIG =====================

  async fetchBotConfig(key) {
    if (!this.isConfigured() || !key) return null;
    try {
      const res = await fetch(this._url('bot_config', `id=eq.${key}&limit=1`), { headers: this._headers() });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0 && rows[0].data) {
          return rows[0].data;
        }
      }
    } catch (_) {}
    return null;
  },

  async saveBotConfig(key, data) {
    if (!this.isConfigured() || !key || !data) return;
    try {
      await fetch(this._url('bot_config'), {
        method: 'POST',
        headers: this._headers({ 'Prefer': 'resolution=merge-duplicates' }),
        body: JSON.stringify({
          id: key,
          data,
          updated_at: new Date().toISOString()
        })
      });
      console.log(`[Supabase] Bot config '${key}' sincronizado en la nube.`);
    } catch (e) {
      console.warn(`[Supabase] saveBotConfig '${key}' error:`, e);
    }
  },

  async fetchBotVariables() {
    return this.fetchBotConfig('variables');
  },

  async saveBotVariables(variables) {
    return this.saveBotConfig('variables', variables);
  },

  async fetchAiConfig() {
    return this.fetchBotConfig('ai_config');
  },

  async saveAiConfig(config) {
    return this.saveBotConfig('ai_config', config);
  },

  async fetchBotFlows() {
    return this.fetchBotConfig('flows');
  },

  async saveBotFlows(flows) {
    return this.saveBotConfig('flows', flows);
  },

  async fetchBotTemplates() {
    return this.fetchBotConfig('templates');
  },

  async saveBotTemplates(templates) {
    return this.saveBotConfig('templates', templates);
  },

// ===================== REALTIME POLLING INIT =====================

  init(onNewOrder, onStatusChange) {
    if (!this.isConfigured()) return () => {};

    let lastChecked = new Date(Date.now() - 60000).toISOString();

    const poll = async () => {
      if (!this.isConfigured()) return;
      try {
        const queryUrl = this._url('orders', `created_at=gt.${encodeURIComponent(lastChecked)}&order=created_at.asc`);
        const res = await fetch(queryUrl, { headers: this._headers() });
        if (res.ok) {
          const orders = await res.json();
          if (Array.isArray(orders) && orders.length > 0) {
            lastChecked = new Date().toISOString();
            orders.forEach(o => {
              const mapped = mapOrderFromDB(o);
              if (mapped && !storageService.isOrderDeleted(mapped.id) && typeof onNewOrder === 'function') {
                onNewOrder(mapped);
              }
            });
          }
        }
      } catch (_) {}
    };

    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }
};
