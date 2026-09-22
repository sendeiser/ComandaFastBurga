import React, { useState, useEffect } from 'react';
import { ChefHat, Clock, CheckCircle2, Play, AlertCircle, Printer, MessageSquare, ShoppingBag, Utensils, RefreshCw, XCircle, ArrowLeftRight, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="order-num-badge">#{order.orderNumber}</span>
              {order.status === 'pendiente' && onReorderOrder && (
                <div style={{ display: 'inline-flex', gap: '2px' }}>
                  <button 
                    type="button" 
                    className="qty-btn" 
                    style={{ width: '22px', height: '22px', padding: 0 }} 
                    title="Subir prioridad en fila"
                    onClick={() => onReorderOrder(order.id, -1)}
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button 
                    type="button" 
                    className="qty-btn" 
                    style={{ width: '22px', height: '22px', padding: 0 }} 
                    title="Bajar prioridad en fila"
                    onClick={() => onReorderOrder(order.id, 1)}
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>
              )}
            </div>
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
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {order.status === 'pendiente' && (
            <>
              <button 
                type="button"
                className="btn-kds-action to-cooking"
                style={{ flex: 1 }}
                onClick={() => onUpdateStatus(order.id, 'cocina')}
              >
                <Play size={16} />
                <span>Comenzar a Cocinar</span>
              </button>
              <button 
                type="button"
                className="qty-btn"
                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.08)', width: 'auto', padding: '0 8px', height: '36px', fontSize: '0.78rem', gap: '4px' }}
                title="Cancelar Pedido"
                onClick={() => {
                  if (window.confirm(`¿Estás seguro de CANCELAR el pedido #${order.orderNumber}?`)) {
                    onUpdateStatus(order.id, 'cancelado');
                  }
                }}
              >
                <XCircle size={15} />
                <span>Cancelar</span>
              </button>
            </>
          )}

          {order.status === 'cocina' && (
            <>
              <button 
                type="button"
                className="qty-btn"
                style={{ height: '36px', padding: '0 8px', fontSize: '0.78rem', gap: '4px' }}
                title="Volver a Pendientes"
                onClick={() => onUpdateStatus(order.id, 'pendiente')}
              >
                <RotateCcw size={14} />
                <span>A Pendiente</span>
              </button>
              <button 
                type="button"
                className="btn-kds-action to-ready"
                style={{ flex: 1 }}
                onClick={() => onUpdateStatus(order.id, 'listo')}
              >
                <CheckCircle2 size={16} />
                <span>Marcar ¡LISTO!</span>
              </button>
            </>
          )}

          {order.status === 'listo' && (
            <>
              <button 
                type="button"
                className="qty-btn"
                style={{ height: '36px', padding: '0 8px', fontSize: '0.78rem', gap: '4px' }}
                title="Volver a Cocina"
                onClick={() => onUpdateStatus(order.id, 'cocina')}
              >
                <RotateCcw size={14} />
                <span>A Cocina</span>
              </button>
              <button 
                type="button"
                className="btn-kds-action to-done"
                style={{ flex: 1 }}
                onClick={() => onUpdateStatus(order.id, 'entregado')}
              >
                <span>Despachar / Entregado</span>
              </button>
            </>
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

        {/* Cambiar de lugar rápidamente */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed var(--border-subtle)', fontSize: '0.72rem' }}>
          <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <ArrowLeftRight size={12} /> Mover lugar:
          </span>
          <div style={{ display: 'flex', gap: '3px' }}>
            {order.status !== 'pendiente' && (
              <button type="button" className="cat-pill-btn" style={{ height: '20px', fontSize: '0.68rem', padding: '0 6px' }} onClick={() => onUpdateStatus(order.id, 'pendiente')}>
                Pendiente
              </button>
            )}
            {order.status !== 'cocina' && (
              <button type="button" className="cat-pill-btn" style={{ height: '20px', fontSize: '0.68rem', padding: '0 6px' }} onClick={() => onUpdateStatus(order.id, 'cocina')}>
                Cocina
              </button>
            )}
            {order.status !== 'listo' && (
              <button type="button" className="cat-pill-btn" style={{ height: '20px', fontSize: '0.68rem', padding: '0 6px' }} onClick={() => onUpdateStatus(order.id, 'listo')}>
                Listo
              </button>
            )}
          </div>
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
