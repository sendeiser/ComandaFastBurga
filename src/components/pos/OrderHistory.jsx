import React, { useState } from 'react';
import { Search, Printer, Trash2, CheckCircle2, Clock, MessageSquare, ShoppingBag, Utensils } from 'lucide-react';

export default function OrderHistory({ 
  orders, 
  onViewTickets, 
  onDeleteOrder 
}) {
  const [search, setSearch] = useState('');
  const [filterChannel, setFilterChannel] = useState('all');

  const filteredOrders = orders.filter(o => {
    const matchSearch = o.orderNumber.toString().includes(search) ||
                        (o.customer?.name && o.customer.name.toLowerCase().includes(search.toLowerCase())) ||
                        (o.customer?.phone && o.customer.phone.includes(search));
    const matchChannel = filterChannel === 'all' || o.channel === filterChannel;
    return matchSearch && matchChannel;
  });

  const totalRevenue = filteredOrders
    .filter(o => o.status !== 'cancelado')
    .reduce((acc, o) => acc + o.total, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Top Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="search-input-wrapper" style={{ minWidth: '280px' }}>
          <Search size={18} className="search-icon-inside" />
          <input 
            type="text" 
            placeholder="Buscar por n° de orden, cliente, teléfono..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`cat-pill-btn ${filterChannel === 'all' ? 'active' : ''}`} onClick={() => setFilterChannel('all')}>Todos</button>
          <button className={`cat-pill-btn ${filterChannel === 'whatsapp' ? 'active' : ''}`} onClick={() => setFilterChannel('whatsapp')}>Delivery</button>
          <button className={`cat-pill-btn ${filterChannel === 'mostrador' ? 'active' : ''}`} onClick={() => setFilterChannel('mostrador')}>Mostrador</button>
          <button className={`cat-pill-btn ${filterChannel === 'mesa' ? 'active' : ''}`} onClick={() => setFilterChannel('mesa')}>Mesas</button>
        </div>

        <div style={{ background: 'var(--bg-main)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', fontWeight: 800, color: 'var(--accent-amber)' }}>
          Total Facturado: ${totalRevenue.toLocaleString('es-AR')}
        </div>
      </div>

      {/* Orders Table */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden', flex: 1, overflowY: 'auto' }}>
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
              filteredOrders.map(order => (
                <tr key={order.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 900, color: 'var(--text-primary)', fontSize: '1rem' }}>
                    #{order.orderNumber}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                    {new Date(order.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span className={`order-type-chip ${order.channel}`}>
                      {order.channel === 'whatsapp' ? '🛵 Delivery' : order.channel === 'mesa' ? `🍽️ Mesa #${order.tableNumber}` : '🛍️ Mostrador'}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{order.customer?.name || 'Consumidor Final'}</div>
                    {order.customer?.address && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{order.customer.address}</div>}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', maxWidth: '240px' }}>
                    {order.items.map(i => `${i.qty}x ${i.name}`).join(', ')}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 900, color: 'var(--accent-amber)' }}>
                    ${order.total.toLocaleString('es-AR')}
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 700, 
                      padding: '2px 6px', 
                      borderRadius: '4px',
                      background: order.paymentMethod === 'efectivo' ? 'rgba(16, 185, 129, 0.15)' : order.paymentMethod === 'transferencia' ? 'rgba(96, 165, 250, 0.15)' : 'rgba(192, 132, 252, 0.15)',
                      color: order.paymentMethod === 'efectivo' ? 'var(--accent-emerald)' : order.paymentMethod === 'transferencia' ? '#60a5fa' : '#c084fc'
                    }}>
                      {order.paymentMethod?.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 700, 
                      padding: '2px 8px', 
                      borderRadius: 'var(--radius-full)',
                      background: order.status === 'entregado' ? 'rgba(16, 185, 129, 0.2)' : order.status === 'cocina' ? 'rgba(234, 88, 12, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: order.status === 'entregado' ? 'var(--accent-emerald)' : order.status === 'cocina' ? 'var(--accent-orange)' : 'var(--accent-amber)'
                    }}>
                      {order.status?.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                      <button 
                        className="qty-btn"
                        title="Ver / Reimprimir Tickets"
                        onClick={() => onViewTickets(order)}
                      >
                        <Printer size={15} />
                      </button>
                      <button 
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
