// =========================================================
// SUPABASE CLIENT & REAL-TIME SYNC SERVICE
// =========================================================

import { storageService } from './storageService';

export const supabaseSync = {
  getCredentials() {
    const settings = storageService.getSettings();
    return {
      url: settings?.supabaseUrl || '',
      anonKey: settings?.supabaseAnonKey || ''
    };
  },

  isConfigured() {
    const { url, anonKey } = this.getCredentials();
    return Boolean(url && anonKey && url.startsWith('http'));
  },

  init(onNewOrder, onStatusChange) {
    if (!this.isConfigured()) return () => {};

    let lastChecked = new Date(Date.now() - 60000).toISOString();

    const poll = async () => {
      if (!this.isConfigured()) return;
      const { url, anonKey } = this.getCredentials();
      try {
        const queryUrl = url + '/rest/v1/orders?created_at=gt.' + encodeURIComponent(lastChecked) + '&order=created_at.asc';
        const res = await fetch(queryUrl, {
          headers: {
            'apikey': anonKey,
            'Authorization': 'Bearer ' + anonKey
          }
        });
        if (res.ok) {
          const orders = await res.json();
          if (Array.isArray(orders) && orders.length > 0) {
            lastChecked = new Date().toISOString();
            orders.forEach(o => {
              if (typeof onNewOrder === 'function') {
                onNewOrder({
                  id: o.id,
                  orderNumber: o.order_number,
                  channel: o.channel,
                  tableNumber: o.table_number,
                  customer: o.customer,
                  items: o.items || [],
                  subtotal: Number(o.subtotal) || 0,
                  deliveryFee: Number(o.delivery_fee) || 0,
                  total: Number(o.total) || 0,
                  paymentMethod: o.payment_method,
                  cashPaid: o.cash_paid,
                  cashChange: o.cash_change,
                  transferProof: o.transfer_proof,
                  transferConfirmed: o.transfer_confirmed,
                  status: o.status || 'pendiente',
                  statusTimestamps: o.status_timestamps || {},
                  createdAt: o.created_at
                });
              }
            });
          }
        }
      } catch (e) {
        // Silently skip if offline
      }
    };

    const intervalId = setInterval(poll, 12000);
    return () => clearInterval(intervalId);
  },

  async testConnection(url, anonKey) {
    try {
      const res = await fetch(url + '/rest/v1/products?select=id&limit=1', {
        headers: {
          'apikey': anonKey,
          'Authorization': 'Bearer ' + anonKey
        }
      });
      return res.ok;
    } catch (e) {
      console.error('Supabase connection test failed:', e);
      return false;
    }
  },

  // OBTENER PRODUCTOS DE SUPABASE
  async fetchProducts() {
    if (!this.isConfigured()) return null;
    const { url, anonKey } = this.getCredentials();
    try {
      const res = await fetch(url + '/rest/v1/products?select=*&is_active=eq.true&order=category.asc', {
        headers: {
          'apikey': anonKey,
          'Authorization': 'Bearer ' + anonKey
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map(p => ({
            id: p.id,
            name: p.name,
            category: p.category,
            price: Number(p.price),
            emoji: p.emoji || '🍔',
            description: p.description || '',
            modifiers: Array.isArray(p.modifiers) ? p.modifiers : []
          }));
        }
      }
    } catch (e) {
      console.warn('Error trayendo productos de Supabase (usando base local):', e);
    }
    return null;
  },

  // GUARDAR / SINCRONIZAR PRODUCTO EN SUPABASE
  async pushProducts(products) {
    if (!this.isConfigured()) return;
    const { url, anonKey } = this.getCredentials();
    try {
      const rows = products.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        emoji: p.emoji || '🍔',
        description: p.description || '',
        modifiers: p.modifiers || [],
        is_active: true,
        updated_at: new Date().toISOString()
      }));

      await fetch(url + '/rest/v1/products', {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Authorization': 'Bearer ' + anonKey,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(rows)
      });
    } catch (e) {
      console.warn('Error subiendo productos a Supabase:', e);
    }
  },

  // ÓRDENES
  async pushOrder(order) {
    if (!this.isConfigured()) return;
    const { url, anonKey } = this.getCredentials();
    try {
      await fetch(url + '/rest/v1/orders', {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Authorization': 'Bearer ' + anonKey,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: order.id,
          order_number: order.orderNumber,
          channel: order.channel,
          table_number: order.tableNumber,
          customer: order.customer,
          items: order.items,
          subtotal: order.subtotal,
          delivery_fee: order.deliveryFee,
          total: order.total,
          payment_method: order.paymentMethod,
          cash_paid: order.cashPaid,
          cash_change: order.cashChange,
          transfer_proof: order.transferProof,
          transfer_confirmed: order.transferConfirmed,
          status: order.status,
          status_timestamps: order.statusTimestamps,
          created_at: order.createdAt
        })
      });
    } catch (e) {
      console.warn('Error syncing order to Supabase:', e);
    }
  },

  async updateOrderStatus(orderId, status) {
    if (!this.isConfigured()) return;
    const { url, anonKey } = this.getCredentials();
    try {
      await fetch(url + '/rest/v1/orders?id=eq.' + orderId, {
        method: 'PATCH',
        headers: {
          'apikey': anonKey,
          'Authorization': 'Bearer ' + anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, updated_at: new Date().toISOString() })
      });
    } catch (e) {
      console.warn('Error updating status in Supabase:', e);
    }
  }
};
