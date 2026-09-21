import React, { useState, useEffect } from 'react';
import { ChefHat, Clock, CheckCircle2, Play, AlertCircle, Printer, MessageSquare, ShoppingBag, Utensils, RefreshCw } from 'lucide-react';

export default function KitchenDisplay({ 
  orders, 
  onUpdateStatus, 
  onReprintTicket 
}) {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [channelFilter, setChannelFilter] = useState('all');

  // Update timer tick every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  const getElapsedMinutes = (dateString) => {
    if (!dateString) return 0;
    const diffMs = currentTime - new Date(dateString).getTime();
    return Math.floor(diffMs / 60000);
  };

  const activeOrders = orders.filter(o => 
    o.status !== 'entregado' && o.status !== 'cancelado' &&
    (channelFilter === 'all' || o.channel === channelFilter)
  );

  const pendingOrders = activeOrders.filter(o => o.status === 'pendiente');
  const cookingOrders = activeOrders.filter(o => o.status === 'cocina');
  const readyOrders = activeOrders.filter(o => o.status === 'listo');

  const renderOrderCard = (order) => {
    const elapsed = getElapsedMinutes(order.createdAt);
    const isDelayed = elapsed > 25;
    const isWarning = elapsed > 15;

    return (
      <div 
        key={order.id} 
        className={`kds-order-card ${isDelayed ? 'delayed' : ''}`}
      >
        <div className="kds-card-top">
          <div>
            <span className="order-num-badge">#{order.orderNumber}</span>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {new Date(order.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <span className={`order-type-chip ${order.channel}`}>
              {order.channel === 'whatsapp' ? (order.deliveryType === 'local' ? '🛍️ WA RETIRO' : '🛵 WA DELIVERY') :
               order.channel === 'mesa' ? `🍽️ MESA #${order.tableNumber || 'S/N'}` :
               order.channel === 'delivery' ? '🛵 DELIVERY' :
               '🛍️ MOSTRADOR'}
            </span>

            <div className={`kds-timer-chip ${isDelayed ? 'danger' : isWarning ? 'warning' : ''}`}>
              <Clock size={12} />
              <span>{elapsed} min</span>
            </div>
          </div>
        </div>

        {(order.customer?.name || typeof order.customer === 'string') && (
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            👤 Cliente: {typeof order.customer === 'object' ? order.customer.name : order.customer}
            {typeof order.customer === 'object' && order.customer.phone ? ` (${order.customer.phone})` : ''}
          </div>
        )}

        {typeof order.customer === 'object' && order.customer.address && order.deliveryType === 'delivery' && (
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-amber)', marginTop: '2px', fontWeight: 600 }}>
            📍 Envío: {order.customer.address}
          </div>
        )}

        {order.customer?.notes && (
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-amber)', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
            Obs: {order.customer.notes}
          </div>
        )}

        {/* Item List */}
        <div className="kds-items-list">
          {order.items.map((item, idx) => (
            <div key={idx} style={{ marginBottom: '4px' }}>
              <div className="kds-item-line">
                <span className="kds-item-qty">{item.qty || item.quantity || 1}x</span>
                <span>{item.name.toUpperCase()}</span>
              </div>
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="kds-item-mod-list">
                  {item.modifiers.map((m, mi) => (
                    <div key={mi}>• {m}</div>
                  ))}
                </div>
              )}
              {item.notes && (
                <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: '#fca5a5', marginLeft: '1.75rem' }}>
                  Nota: {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {order.status === 'pendiente' && (
            <button 
              className="btn-kds-action to-cooking"
              onClick={() => onUpdateStatus(order.id, 'cocina')}
            >
              <Play size={16} />
              <span>Comenzar a Cocinar</span>
            </button>
          )}

          {order.status === 'cocina' && (
            <button 
              className="btn-kds-action to-ready"
              onClick={() => onUpdateStatus(order.id, 'listo')}
            >
              <CheckCircle2 size={16} />
              <span>Marcar ¡LISTO!</span>
            </button>
          )}

          {order.status === 'listo' && (
            <button 
              className="btn-kds-action to-done"
              onClick={() => onUpdateStatus(order.id, 'entregado')}
            >
              <span>Despachar / Entregado</span>
            </button>
          )}

          <button 
            type="button"
            className="qty-btn"
            style={{ width: '36px', height: '36px' }}
            title="Reimprimir Comanda Cocina"
            onClick={() => onReprintTicket(order, 'kitchen')}
          >
            <Printer size={16} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="kds-container">
      {/* Top Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ChefHat size={22} style={{ color: 'var(--accent-orange)' }} />
          <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>TABLERO KDS EN VIVO</span>
          <span className="brand-badge">{activeOrders.length} activas</span>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button 
            className={`cat-pill-btn ${channelFilter === 'all' ? 'active' : ''}`}
            onClick={() => setChannelFilter('all')}
          >
            Todas
          </button>
          <button 
            className={`cat-pill-btn ${channelFilter === 'whatsapp' ? 'active' : ''}`}
            onClick={() => setChannelFilter('whatsapp')}
          >
            <MessageSquare size={14} /> Delivery
          </button>
          <button 
            className={`cat-pill-btn ${channelFilter === 'mostrador' ? 'active' : ''}`}
            onClick={() => setChannelFilter('mostrador')}
          >
            <ShoppingBag size={14} /> Mostrador
          </button>
          <button 
            className={`cat-pill-btn ${channelFilter === 'mesa' ? 'active' : ''}`}
            onClick={() => setChannelFilter('mesa')}
          >
            <Utensils size={14} /> Mesas
          </button>
        </div>
      </div>

      {/* 3-Column Kanban */}
      <div className="kds-columns-grid">
        {/* Column 1: Pendientes */}
        <div className="kds-column">
          <div className="kds-column-header pending">
            <span>🟡 PENDIENTES ({pendingOrders.length})</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Por iniciar</span>
          </div>
          <div className="kds-cards-list">
            {pendingOrders.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 1rem', fontSize: '0.9rem' }}>
                Sin pedidos en espera
              </div>
            ) : (
              pendingOrders.map(renderOrderCard)
            )}
          </div>
        </div>

        {/* Column 2: En Cocina */}
        <div className="kds-column">
          <div className="kds-column-header cooking">
            <span>🟠 EN COCINA ({cookingOrders.length})</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>En preparación</span>
          </div>
          <div className="kds-cards-list">
            {cookingOrders.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 1rem', fontSize: '0.9rem' }}>
                Cocina libre
              </div>
            ) : (
              cookingOrders.map(renderOrderCard)
            )}
          </div>
        </div>

        {/* Column 3: Listo / Por despachar */}
        <div className="kds-column">
          <div className="kds-column-header ready">
            <span>🟢 LISTO / DESPACHAR ({readyOrders.length})</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Completados</span>
          </div>
          <div className="kds-cards-list">
            {readyOrders.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 1rem', fontSize: '0.9rem' }}>
                Sin pedidos listos pendientes de entrega
              </div>
            ) : (
              readyOrders.map(renderOrderCard)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
