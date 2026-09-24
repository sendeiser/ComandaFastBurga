import React, { useState } from 'react';
import { Search, Printer, Trash2, CheckCircle2, Clock, MessageSquare, ShoppingBag, Utensils, XCircle, DollarSign, Calendar } from 'lucide-react';

export default function OrderHistory({ 
  orders = [], 
  onViewTickets, 
  onDeleteOrder,
  onUpdateStatus
}) {
  const [search, setSearch] = useState('');
  const [filterChannel, setFilterChannel] = useState('all');

  const filteredOrders = orders.filter(o => {
    const matchSearch = (o.orderNumber != null ? o.orderNumber.toString() : (o.id || "")).includes(search) ||
                        (o.customer?.name && o.customer.name.toLowerCase().includes(search.toLowerCase())) ||
                        (o.customer?.phone && o.customer.phone.includes(search));
    const matchChannel = filterChannel === 'all' || o.channel === filterChannel;
    return matchSearch && matchChannel;
  });

  const totalRevenue = filteredOrders
    .filter(o => o.status !== 'cancelado')
    .reduce((acc, o) => acc + (Number(o.total) || 0), 0);

  const getChannelLabel = (channel, deliveryType, tableNumber) => {
    if (channel === 'whatsapp') {
      return deliveryType === 'local' ? '🛍️ WA Retiro' : '🛵 WA Delivery';
    }
    if (channel === 'mesa') {
      return `🍽️ Mesa #${tableNumber || 'S/N'}`;
    }
    if (channel === 'delivery') {
      return '🛵 Delivery';
    }
    return '🛍️ Mostrador';
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'entregado':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: 'var(--accent-emerald)', label: 'ENTREGADO' };
      case 'cocina':
        return { bg: 'rgba(234, 88, 12, 0.15)', text: 'var(--accent-orange)', label: 'EN COCINA' };
      case 'listo':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: 'var(--accent-emerald)', label: 'LISTO' };
      case 'cancelado':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', label: 'CANCELADO' };
      default:
        return { bg: 'rgba(245, 158, 11, 0.15)', text: 'var(--accent-amber)', label: 'PENDIENTE' };
    }
  };

  const getPaymentBadge = (method) => {
    const m = (method || 'efectivo').toLowerCase();
    if (m === 'efectivo') {
      return { bg: 'rgba(16, 185, 129, 0.15)', text: 'var(--accent-emerald)', label: '💵 EFECTIVO' };
    }
    if (m === 'transferencia') {
      return { bg: 'rgba(96, 165, 250, 0.15)', text: '#60a5fa', label: '💳 TRANSFERENCIA' };
    }
    return { bg: 'rgba(192, 132, 252, 0.15)', text: '#c084fc', label: `💳 ${m.toUpperCase()}` };
  };

  return (
    <div className="order-history-container">
      {/* Top Filter Bar */}
      <div className="history-header-bar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon-inside" />
          <input 
            type="text" 
            placeholder="Buscar por n° de orden, cliente, tel..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="history-channel-pills">
          <button 
            type="button" 
            className={`cat-pill-btn ${filterChannel === 'all' ? 'active' : ''}`} 
            onClick={() => setFilterChannel('all')}
          >
            Todos
          </button>
          <button 
            type="button" 
            className={`cat-pill-btn ${filterChannel === 'whatsapp' ? 'active' : ''}`} 
            onClick={() => setFilterChannel('whatsapp')}
          >
            <MessageSquare size={13} /> Delivery
          </button>
          <button 
            type="button" 
            className={`cat-pill-btn ${filterChannel === 'mostrador' ? 'active' : ''}`} 
            onClick={() => setFilterChannel('mostrador')}
          >
            <ShoppingBag size={13} /> Mostrador
          </button>
          <button 
            type="button" 
            className={`cat-pill-btn ${filterChannel === 'mesa' ? 'active' : ''}`} 
            onClick={() => setFilterChannel('mesa')}
          >
            <Utensils size={13} /> Mesas
          </button>
        </div>

        <div className="history-total-badge">
          <span className="history-total-label">Facturado:</span>
          <span className="history-total-amount">${totalRevenue.toLocaleString('es-AR')}</span>
        </div>
      </div>

      {/* DESKTOP TABLE VIEW (Visible on >= 769px) */}
      <div className="order-history-desktop-table">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '0.85rem 1rem' }}>Orden</th>
              <th style={{ padding: '0.85rem 1rem' }}>Fecha/Hora</th>
              <th style={{ padding: '0.85rem 1rem' }}>Canal</th>
              <th style={{ padding: '0.85rem 1rem' }}>Cliente / Destino</th>
              <th style={{ padding: '0.85rem 1rem' }}>Items</th>
              <th style={{ padding: '0.85rem 1rem' }}>Total</th>
              <th style={{ padding: '0.85rem 1rem' }}>Medio de Pago</th>
              <th style={{ padding: '0.85rem 1rem' }}>Estado</th>
              <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No se encontraron pedidos registrados.
                </td>
              </tr>
            ) : (
              filteredOrders.map(order => {
                const statusStyle = getStatusBadgeStyle(order.status);
                const payStyle = getPaymentBadge(order.paymentMethod);

                return (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 900, color: 'var(--text-primary)', fontSize: '1rem' }}>
                      #{order.orderNumber ?? order.id?.slice?.(-4)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                          {new Date(order.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {new Date(order.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className={`order-type-chip ${order.channel}`}>
                        {getChannelLabel(order.channel, order.deliveryType, order.tableNumber)}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {typeof order.customer === 'object' ? (order.customer?.name || 'Consumidor Final') : (order.customer || 'Consumidor Final')}
                      </div>
                      {typeof order.customer === 'object' && order.customer?.address && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{order.customer.address}</div>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', maxWidth: '240px' }}>
                      {Array.isArray(order.items) ? order.items.map(i => `${i.qty || i.quantity || 1}x ${i.name}`).join(', ') : ''}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 900, color: 'var(--accent-amber)' }}>
                      ${Number(order.total || 0).toLocaleString('es-AR')}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 700, 
                        padding: '2px 6px', 
                        borderRadius: '4px',
                        background: payStyle.bg,
                        color: payStyle.text
                      }}>
                        {payStyle.label}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 700, 
                        padding: '2px 8px', 
                        borderRadius: 'var(--radius-full)',
                        background: statusStyle.bg,
                        color: statusStyle.text
                      }}>
                        {statusStyle.label}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        {(order.status === 'pendiente' || order.status === 'cocina') && (
                          <button 
                            type="button"
                            className="qty-btn"
                            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.08)' }}
                            title="Cancelar Orden Pendiente"
                            onClick={() => {
                              if (window.confirm(`¿Cancelar la orden pendiente #${order.orderNumber}?`)) {
                                if (onUpdateStatus) {
                                  onUpdateStatus(order.id, 'cancelado');
                                }
                              }
                            }}
                          >
                            <XCircle size={15} />
                          </button>
                        )}
                        <button 
                          type="button"
                          className="qty-btn"
                          title="Ver / Reimprimir Tickets"
                          onClick={() => onViewTickets(order)}
                        >
                          <Printer size={15} />
                        </button>
                        <button 
                          type="button"
                          className="qty-btn"
                          style={{ color: 'var(--accent-rose)' }}
                          title="Eliminar Registro"
                          onClick={() => {
                            if (confirm(`¿Eliminar la orden #${order.orderNumber}?`)) {
                              onDeleteOrder(order.id);
                            }
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARDS VIEW (Visible on <= 768px) */}
      <div className="order-history-mobile-list">
        {filteredOrders.length === 0 ? (
          <div className="history-mobile-empty">
            <Clock size={32} style={{ opacity: 0.35, marginBottom: '6px' }} />
            <span>No se encontraron pedidos registrados</span>
          </div>
        ) : (
          filteredOrders.map(order => {
            const statusStyle = getStatusBadgeStyle(order.status);
            const payStyle = getPaymentBadge(order.paymentMethod);
            const customerName = typeof order.customer === 'object' ? (order.customer?.name || 'Consumidor Final') : (order.customer || 'Consumidor Final');
            const customerAddress = typeof order.customer === 'object' ? order.customer?.address : null;
            const itemsSummary = Array.isArray(order.items) 
              ? order.items.map(i => `${i.qty || i.quantity || 1}x ${i.name}`).join(' • ')
              : '';

            return (
              <div key={order.id} className="history-order-card">
                {/* Top Row: Order Number + Channel + Status + Time */}
                <div className="history-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="history-card-ordernum">#{order.orderNumber ?? order.id?.slice?.(-4)}</span>
                    <span className={`order-type-chip ${order.channel}`}>
                      {getChannelLabel(order.channel, order.deliveryType, order.tableNumber)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span 
                      className="history-status-badge"
                      style={{ background: statusStyle.bg, color: statusStyle.text }}
                    >
                      {statusStyle.label}
                    </span>
                  </div>
                </div>

                {/* Subheader: Date & Time */}
                <div className="history-card-meta">
                  <Calendar size={12} />
                  <span>
                    {new Date(order.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    {' · '}
                    {new Date(order.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                  </span>
                </div>

                {/* Customer & Address */}
                <div className="history-card-customer">
                  <div className="history-customer-name">
                    👤 {customerName}
                  </div>
                  {customerAddress && (
                    <div className="history-customer-address">
                      📍 {customerAddress}
                    </div>
                  )}
                </div>

                {/* Items & Payment Preview */}
                {itemsSummary && (
                  <div className="history-card-items">
                    {itemsSummary}
                  </div>
                )}

                {/* Bottom Row: Total + Payment + Actions */}
                <div className="history-card-footer">
                  <div>
                    <span className="history-card-total">
                      ${Number(order.total || 0).toLocaleString('es-AR')}
                    </span>
                    <span 
                      className="history-pay-chip"
                      style={{ background: payStyle.bg, color: payStyle.text, marginLeft: '6px' }}
                    >
                      {payStyle.label}
                    </span>
                  </div>

                  <div className="history-card-actions">
                    {(order.status === 'pendiente' || order.status === 'cocina') && (
                      <button 
                        type="button"
                        className="qty-btn"
                        style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.08)', height: '34px', width: '34px' }}
                        title="Cancelar Orden"
                        onClick={() => {
                          if (window.confirm(`¿Cancelar la orden pendiente #${order.orderNumber}?`)) {
                            if (onUpdateStatus) {
                              onUpdateStatus(order.id, 'cancelado');
                            }
                          }
                        }}
                      >
                        <XCircle size={15} />
                      </button>
                    )}
                    <button 
                      type="button"
                      className="qty-btn"
                      style={{ height: '34px', width: '34px' }}
                      title="Ver / Reimprimir Tickets"
                      onClick={() => onViewTickets(order)}
                    >
                      <Printer size={15} />
                    </button>
                    <button 
                      type="button"
                      className="qty-btn"
                      style={{ color: 'var(--accent-rose)', height: '34px', width: '34px' }}
                      title="Eliminar Registro"
                      onClick={() => {
                        if (confirm(`¿Eliminar la orden #${order.orderNumber}?`)) {
                          onDeleteOrder(order.id);
                        }
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
