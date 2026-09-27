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

  // Filtrar órdenes de un turno de caja específico
  filterOrdersByShift(orders = [], shift = null) {
    if (!shift) return orders;
    const start = shift.openedAt ? new Date(shift.openedAt).getTime() : 0;
    const end = shift.closedAt ? new Date(shift.closedAt).getTime() : Date.now();

    return orders.filter(order => {
      const orderTime = new Date(order.createdAt || Date.now()).getTime();
      return orderTime >= start && orderTime <= end;
    });
  },

  // KPIs Financieros Consolidados con Estadísticas de Eficiencia
  calculateFinancialKpis(orders = [], shifts = []) {
    const totalOrders = orders.length;
    const activeOrders = orders.filter(o => o.status !== 'cancelado');
    const cancelledOrders = orders.filter(o => o.status === 'cancelado');

    const grossRevenue = activeOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const subtotalRevenue = activeOrders.reduce((sum, o) => sum + (Number(o.subtotal) || Number(o.total) || 0), 0);
    const totalDeliveryFees = activeOrders.reduce((sum, o) => sum + (Number(o.deliveryFee) || 0), 0);
    const avgTicket = activeOrders.length > 0 ? Math.round(grossRevenue / activeOrders.length) : 0;
    const completionRate = totalOrders > 0 ? Math.round((activeOrders.length / totalOrders) * 100) : 100;

    // Desglose de pagos (solo comandas válidas/activas)
    const payments = {
      cash: { total: 0, count: 0 },
      transfer: { total: 0, count: 0, confirmed: 0, pending: 0 },
      card: { total: 0, count: 0 }
    };

    activeOrders.forEach(o => {
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
      whatsapp: { total: 0, count: 0, avg: 0 },
      mostrador: { total: 0, count: 0, avg: 0 },
      mesa: { total: 0, count: 0, avg: 0 }
    };

    activeOrders.forEach(o => {
      const tot = Number(o.total) || 0;
      const ch = o.channel || 'whatsapp';
      if (channels[ch]) {
        channels[ch].total += tot;
        channels[ch].count += 1;
      }
    });

    Object.keys(channels).forEach(ch => {
      if (channels[ch].count > 0) {
        channels[ch].avg = Math.round(channels[ch].total / channels[ch].count);
      }
    });

    // Total de egresos de caja
    const totalExpenses = shifts.reduce((sum, s) => {
      const exp = (s.expenses || []).reduce((sub, e) => sub + (Number(e.amount) || 0), 0);
      return sum + exp;
    }, 0);

    // Tiempos promedio de cocina y entrega
    let totalPrepMinutes = 0;
    let prepCount = 0;
    let totalDeliveryMinutes = 0;
    let deliveryCount = 0;

    activeOrders.forEach(o => {
      const ts = o.statusTimestamps || {};
      const created = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      const ready = ts.readyAt ? new Date(ts.readyAt).getTime() : 0;
      const delivered = ts.deliveredAt ? new Date(ts.deliveredAt).getTime() : 0;

      if (created > 0 && ready > created) {
        const mins = Math.round((ready - created) / 60000);
        if (mins > 0 && mins < 240) {
          totalPrepMinutes += mins;
          prepCount++;
        }
      }

      if (created > 0 && delivered > created) {
        const mins = Math.round((delivered - created) / 60000);
        if (mins > 0 && mins < 360) {
          totalDeliveryMinutes += mins;
          deliveryCount++;
        }
      }
    });

    const avgPrepTimeMin = prepCount > 0 ? Math.round(totalPrepMinutes / prepCount) : 18;
    const avgDeliveryTimeMin = deliveryCount > 0 ? Math.round(totalDeliveryMinutes / deliveryCount) : 32;

    const totalItemsCount = activeOrders.reduce((sum, o) => {
      return sum + (o.items || []).reduce((sub, i) => sub + (Number(i.qty) || 1), 0);
    }, 0);

    return {
      totalOrders,
      activeOrdersCount: activeOrders.length,
      cancelledOrdersCount: cancelledOrders.length,
      completionRate,
      grossRevenue,
      subtotalRevenue,
      totalDeliveryFees,
      avgTicket,
      payments,
      channels,
      totalExpenses,
      netCashInHand: payments.cash.total - totalExpenses,
      totalItemsCount,
      avgPrepTimeMin,
      avgDeliveryTimeMin
    };
  },

  // Distribución de ventas y comandas por hora (Horarios Pico / Rush Hours)
  getHourlyDistribution(orders = []) {
    const validOrders = orders.filter(o => o.status !== 'cancelado');
    const hoursMap = {};
    for (let h = 0; h < 24; h++) {
      hoursMap[h] = { hour: h, count: 0, revenue: 0 };
    }

    validOrders.forEach(o => {
      const d = new Date(o.createdAt || Date.now());
      const h = d.getHours();
      hoursMap[h].count += 1;
      hoursMap[h].revenue += Number(o.total) || 0;
    });

    // Identificar hora pico
    let maxCount = 0;
    let peakHour = 21;
    Object.values(hoursMap).forEach(item => {
      if (item.count > maxCount) {
        maxCount = item.count;
        peakHour = item.hour;
      }
    });

    // Filtrar franjas horarias con actividad o las horas gastronómicas habituales (11hs a 02hs)
    const hoursList = [];
    // Recorrer 11 a 23 y 0 a 2
    const relevantHours = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2];
    const totalRev = validOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);

    relevantHours.forEach(h => {
      const data = hoursMap[h] || { hour: h, count: 0, revenue: 0 };
      const pct = totalRev > 0 ? Math.round((data.revenue / totalRev) * 100) : 0;
      hoursList.push({
        hour: h,
        label: `${String(h).padStart(2, '0')}:00`,
        count: data.count,
        revenue: data.revenue,
        percentage: pct,
        isPeak: h === peakHour && maxCount > 0
      });
    });

    return {
      hoursList,
      peakHour: maxCount > 0 ? `${String(peakHour).padStart(2, '0')}:00 hs` : 'Sin datos',
      peakOrders: maxCount,
      peakPercentage: totalRev > 0 && maxCount > 0 ? Math.round((hoursMap[peakHour].revenue / totalRev) * 100) : 0
    };
  },

  // Tendencia de Ventas (Evolución diaria u horaria para gráfica de curva)
  getSalesTrend(orders = [], rangeType = 'today', isSingleShift = false) {
    const validOrders = orders.filter(o => o.status !== 'cancelado');
    const isSingleDayOrShift = rangeType === 'today' || rangeType === 'yesterday' || isSingleShift;

    if (isSingleDayOrShift) {
      // Agrupar por franja horaria de 2 horas
      const slots = [
        { label: '12:00', start: 11, end: 13, revenue: 0, count: 0 },
        { label: '14:00', start: 13, end: 15, revenue: 0, count: 0 },
        { label: '16:00', start: 15, end: 17, revenue: 0, count: 0 },
        { label: '18:00', start: 17, end: 19, revenue: 0, count: 0 },
        { label: '20:00', start: 19, end: 21, revenue: 0, count: 0 },
        { label: '22:00', start: 21, end: 23, revenue: 0, count: 0 },
        { label: '00:00', start: 23, end: 25, revenue: 0, count: 0 }
      ];

      validOrders.forEach(o => {
        const d = new Date(o.createdAt || Date.now());
        const h = d.getHours();
        const slot = slots.find(s => {
          if (s.end === 25) return h === 23 || h === 0;
          return h >= s.start && h < s.end;
        });
        if (slot) {
          slot.revenue += Number(o.total) || 0;
          slot.count += 1;
        }
      });

      return slots;
    }

    // Agrupar por días
    const daysMap = {};
    validOrders.forEach(o => {
      const d = new Date(o.createdAt || Date.now());
      const dayKey = d.toISOString().slice(0, 10); // YYYY-MM-DD
      const shortLabel = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric' });
      if (!daysMap[dayKey]) {
        daysMap[dayKey] = { label: shortLabel, fullDate: dayKey, revenue: 0, count: 0 };
      }
      daysMap[dayKey].revenue += Number(o.total) || 0;
      daysMap[dayKey].count += 1;
    });

    const list = Object.values(daysMap).sort((a, b) => a.fullDate.localeCompare(b.fullDate));
    return list.length > 0 ? list : [{ label: 'Hoy', fullDate: new Date().toISOString().slice(0,10), revenue: 0, count: 0 }];
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
