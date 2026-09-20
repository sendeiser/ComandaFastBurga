// =========================================================
// AUDIT SERVICE — CÁLCULO DE KPIS Y REPORTES DE AUDITORÍA
// =========================================================

export const auditService = {
  // Filtrar órdenes por rango de fechas
  filterOrdersByRange(orders = [], rangeType = 'today', customStart = null, customEnd = null) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return orders.filter(order => {
      const orderDate = new Date(order.createdAt || Date.now());

      switch (rangeType) {
        case 'today':
          return orderDate >= startOfToday;
        case 'yesterday': {
          const startOfYesterday = new Date(startOfToday);
          startOfYesterday.setDate(startOfYesterday.getDate() - 1);
          return orderDate >= startOfYesterday && orderDate < startOfToday;
        }
        case 'week': {
          const sevenDaysAgo = new Date(startOfToday);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return orderDate >= sevenDaysAgo;
        }
        case 'month': {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return orderDate >= startOfMonth;
        }
        case 'custom': {
          if (!customStart) return true;
          const s = new Date(customStart + 'T00:00:00');
          const e = customEnd ? new Date(customEnd + 'T23:59:59') : new Date();
          return orderDate >= s && orderDate <= e;
        }
        case 'all':
        default:
          return true;
      }
    });
  },

  // KPIs Financieros Consolidados
  calculateFinancialKpis(orders = [], shifts = []) {
    const totalOrders = orders.length;
    const grossRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const subtotalRevenue = orders.reduce((sum, o) => sum + (Number(o.subtotal) || 0), 0);
    const totalDeliveryFees = orders.reduce((sum, o) => sum + (Number(o.deliveryFee) || 0), 0);
    const avgTicket = totalOrders > 0 ? Math.round(grossRevenue / totalOrders) : 0;

    // Desglose de pagos
    const payments = {
      cash: { total: 0, count: 0 },
      transfer: { total: 0, count: 0, confirmed: 0, pending: 0 },
      card: { total: 0, count: 0 }
    };

    orders.forEach(o => {
      const tot = Number(o.total) || 0;
      const m = o.paymentMethod || 'efectivo';
      if (m === 'efectivo') {
        payments.cash.total += tot;
        payments.cash.count += 1;
      } else if (m === 'transferencia') {
        payments.transfer.total += tot;
        payments.transfer.count += 1;
        if (o.transferConfirmed) {
          payments.transfer.confirmed += tot;
        } else {
          payments.transfer.pending += tot;
        }
      } else if (m === 'tarjeta') {
        payments.card.total += tot;
        payments.card.count += 1;
      }
    });

    // Desglose de canales
    const channels = {
      whatsapp: { total: 0, count: 0 },
      mostrador: { total: 0, count: 0 },
      mesa: { total: 0, count: 0 }
    };

    orders.forEach(o => {
      const tot = Number(o.total) || 0;
      const ch = o.channel || 'whatsapp';
      if (channels[ch]) {
        channels[ch].total += tot;
        channels[ch].count += 1;
      }
    });

    // Total de egresos de caja
    const totalExpenses = shifts.reduce((sum, s) => {
      const exp = (s.expenses || []).reduce((sub, e) => sub + (Number(e.amount) || 0), 0);
      return sum + exp;
    }, 0);

    return {
      totalOrders,
      grossRevenue,
      subtotalRevenue,
      totalDeliveryFees,
      avgTicket,
      payments,
      channels,
      totalExpenses,
      netCashInHand: payments.cash.total - totalExpenses
    };
  },

  // Ranking de Productos y Modificadores
  getProductAnalytics(orders = []) {
    const productMap = {};
    const modifierMap = {};

    orders.forEach(o => {
      (o.items || []).forEach(item => {
        const name = item.name || 'Producto';
        const qty = Number(item.qty) || 1;
        const total = (Number(item.unitPrice) || 0) * qty;

        if (!productMap[name]) {
          productMap[name] = { name, qty: 0, total: 0, ordersCount: 0 };
        }
        productMap[name].qty += qty;
        productMap[name].total += total;
        productMap[name].ordersCount += 1;

        if (item.modifiers && Array.isArray(item.modifiers)) {
          item.modifiers.forEach(mod => {
            modifierMap[mod] = (modifierMap[mod] || 0) + qty;
          });
        }
      });
    });

    const products = Object.values(productMap);
    const topByQty = [...products].sort((a, b) => b.qty - a.qty);
    const topByRevenue = [...products].sort((a, b) => b.total - a.total);
    const topModifiers = Object.entries(modifierMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return { topByQty, topByRevenue, topModifiers };
  },

  // Exportar Ventas a CSV
  exportOrdersToCsv(orders = []) {
    const headers = ['Orden #', 'Fecha', 'Hora', 'Canal', 'Cliente', 'Direccion', 'Telefono', 'Metodo Pago', 'Estado Transf', 'Subtotal', 'Envio', 'Total', 'Items'];
    const rows = orders.map(o => {
      const date = new Date(o.createdAt || Date.now());
      const dateStr = date.toLocaleDateString('es-AR');
      const timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      const itemsSummary = (o.items || []).map(i => `${i.qty}x ${i.name}`).join('; ');

      return [
        o.orderNumber || '',
        dateStr,
        timeStr,
        (o.channel || '').toUpperCase(),
        `"${(o.customer?.name || 'Consumidor Final').replace(/"/g, '""')}"`,
        `"${(o.customer?.address || '').replace(/"/g, '""')}"`,
        `"${(o.customer?.phone || '').replace(/"/g, '""')}"`,
        (o.paymentMethod || '').toUpperCase(),
        o.paymentMethod === 'transferencia' ? (o.transferConfirmed ? 'ACREDITADA' : 'PENDIENTE') : 'N/A',
        o.subtotal || 0,
        o.deliveryFee || 0,
        o.total || 0,
        `"${itemsSummary.replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = '﻿' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comandafast_auditoria_ventas_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Exportar Turnos y Arqueos a CSV
  exportShiftsToCsv(shifts = []) {
    const headers = ['ID Turno', 'Apertura', 'Cierre', 'Cajero', 'Fondo Inicial', 'Ventas Efvo Teórico', 'Egresos', 'Teórico Esperado', 'Efectivo Declarado (Ciego)', 'Diferencia', 'Estado', 'Notas'];
    const rows = shifts.map(s => {
      const opened = s.openedAt ? new Date(s.openedAt).toLocaleString('es-AR') : '';
      const closed = s.closedAt ? new Date(s.closedAt).toLocaleString('es-AR') : 'Abierto';
      const initial = Number(s.initialCash) || 0;
      const cashSales = Number(s.cashSales) || 0;
      const totalExp = (s.expenses || []).reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
      const expected = initial + cashSales - totalExp;
      const counted = s.countedCash !== null && s.countedCash !== undefined ? Number(s.countedCash) : null;
      const diff = counted !== null ? counted - expected : 0;
      const status = counted === null ? 'EN CURSO' : diff === 0 ? 'EXACTO' : diff > 0 ? `SOBRANTE (+$${diff})` : `FALTANTE (-$${Math.abs(diff)})`;

      return [
        s.id || '',
        `"${opened}"`,
        `"${closed}"`,
        `"${s.cashierName || 'Cajero'}"`,
        initial,
        cashSales,
        totalExp,
        expected,
        counted !== null ? counted : 'N/A',
        diff,
        `"${status}"`,
        `"${(s.notes || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = '﻿' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comandafast_auditoria_cajas_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
};
