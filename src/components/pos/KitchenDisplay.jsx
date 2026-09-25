import React, { useState, useEffect } from 'react';
import { ChefHat, Clock, CheckCircle2, Play, AlertCircle, Printer, MessageSquare, ShoppingBag, Utensils, RefreshCw, XCircle, ArrowLeftRight, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';

export default function KitchenDisplay({ 
  orders, 
  onUpdateStatus, 
  onReprintTicket,
  onReorderOrder
}) {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [channelFilter, setChannelFilter] = useState('all');
  const [notifyingId, setNotifyingId] = useState(null);
  const [mobileColumnTab, setMobileColumnTab] = useState('cocina'); // 'all' | 'pendiente' | 'cocina' | 'listo'

  // Update timer tick every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleNotifyWhatsApp = async (order) => {
    if (notifyingId) return;
    setNotifyingId(order.id);
    try {
      const botHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
      const res = await fetch(`http://${botHost}:3002/api/orders/${order.id}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: order.status, order, force: true })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Notificación de WhatsApp enviada a ${data.jid}`);
      } else {
        alert(`ℹ️ Resultado WhatsApp: ${data.reason === 'bot_disconnected' ? 'Bot desconectado (inicie el bot en el panel Admin)' : data.reason || 'Sin número'}`);
      }
    } catch (_) {
      alert('⚠️ No se pudo conectar al servidor local de WhatsApp (puerto 3002).');
    } finally {
      setNotifyingId(null);
    }
  };

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

  
  const getSafeItems = (items) => {
    if (Array.isArray(items)) return items;
    if (typeof items === 'string') {
      try {
        const parsed = JSON.parse(items);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  };

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="order-num-badge">#{order.orderNumber}</span>
              {order.status === 'pendiente' && onReorderOrder && (
                <div style={{ display: 'inline-flex', gap: '2px' }}>
                  <button 
                    type="button" 
                    className="qty-btn" 
                    style={{ width: '20px', height: '20px', padding: 0 }} 
                    title="Subir prioridad en fila"
                    onClick={() => onReorderOrder(order.id, -1)}
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button 
                    type="button" 
                    className="qty-btn" 
                    style={{ width: '20px', height: '20px', padding: 0 }} 
                    title="Bajar prioridad en fila"
                    onClick={() => onReorderOrder(order.id, 1)}
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>
              )}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '1px' }}>
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
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span>
              👤 {typeof order.customer === 'object' ? order.customer.name : order.customer}
              {typeof order.customer === 'object' && order.customer.phone ? ` (${order.customer.phone})` : ''}
            </span>
            {(order.channel === 'whatsapp' || (order.customer && order.customer.phone)) && (
              <span 
                title={
                  order.notifiedStatuses?.includes(order.status)
                    ? `Notificación de WhatsApp enviada para estado: ${order.status}`
                    : 'Cliente con número de WhatsApp registrado'
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '0.68rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: order.notifiedStatuses?.includes(order.status) ? 'rgba(16, 185, 129, 0.18)' : 'rgba(37, 211, 102, 0.1)',
                  color: order.notifiedStatuses?.includes(order.status) ? '#10b981' : '#25d366',
                  fontWeight: 600,
                  border: '1px solid rgba(37, 211, 102, 0.25)',
                  flexShrink: 0
                }}
              >
                <MessageSquare size={10} />
                {order.notifiedStatuses?.includes(order.status) ? 'WA Notificado' : 'WhatsApp'}
              </span>
            )}
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
          {getSafeItems(order.items).map((item, idx) => (
            <div key={idx} style={{ marginBottom: '4px' }}>
              <div className="kds-item-line">
                <span className="kds-item-qty">{item.qty || item.quantity || 1}x</span>
                <span>{item.name.toUpperCase()}</span>
              </div>
              {Array.isArray(item.modifiers) && item.modifiers.length > 0 && (
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
        <div className="kds-card-actions">
          {order.status === 'pendiente' && (
            <>
              <button 
                type="button"
                className="btn-kds-action to-cooking"
                onClick={() => onUpdateStatus(order.id, 'cocina')}
                title="Comenzar a Cocinar"
              >
                <Play size={13} />
                <span>Cocinar</span>
              </button>
              <button 
                type="button"
                className="kds-btn-cancel"
                title="Cancelar Pedido"
                onClick={() => {
                  if (window.confirm(`¿Estás seguro de CANCELAR el pedido #${order.orderNumber}?`)) {
                    onUpdateStatus(order.id, 'cancelado');
                  }
                }}
              >
                <XCircle size={13} />
                <span>Cancelar</span>
              </button>
            </>
          )}

          {order.status === 'cocina' && (
            <button 
              type="button"
              className="btn-kds-action to-ready"
              onClick={() => onUpdateStatus(order.id, 'listo')}
              title="Marcar pedido como ¡Listo!"
            >
              <CheckCircle2 size={14} />
              <span>¡Listo!</span>
            </button>
          )}

          {order.status === 'listo' && (
            <button 
              type="button"
              className="btn-kds-action to-done"
              onClick={() => onUpdateStatus(order.id, 'entregado')}
              title="Despachar y entregar pedido"
            >
              <CheckCircle2 size={14} />
              <span>Despachar</span>
            </button>
          )}

          {(order.channel === 'whatsapp' || (order.customer && order.customer.phone)) && (
            <button 
              type="button"
              className={`kds-icon-action-btn whatsapp ${notifyingId === order.id ? 'loading' : ''}`}
              disabled={notifyingId === order.id}
              title="Avisar / Reenviar estado por WhatsApp al cliente"
              onClick={() => handleNotifyWhatsApp(order)}
            >
              <MessageSquare size={14} />
            </button>
          )}

          <button 
            type="button"
            className="kds-icon-action-btn"
            title="Reimprimir Comanda Cocina"
            onClick={() => onReprintTicket(order, 'kitchen')}
          >
            <Printer size={14} />
          </button>
        </div>

        {/* Cambiar de lugar rápidamente */}
        <div className="kds-quick-move-bar">
          <span className="kds-quick-move-label">
            <ArrowLeftRight size={11} /> Mover:
          </span>
          <div style={{ display: 'flex', gap: '3px' }}>
            {order.status !== 'pendiente' && (
              <button type="button" className="kds-mini-move-btn" onClick={() => onUpdateStatus(order.id, 'pendiente')}>
                Pendiente
              </button>
            )}
            {order.status !== 'cocina' && (
              <button type="button" className="kds-mini-move-btn" onClick={() => onUpdateStatus(order.id, 'cocina')}>
                Cocina
              </button>
            )}
            {order.status !== 'listo' && (
              <button type="button" className="kds-mini-move-btn" onClick={() => onUpdateStatus(order.id, 'listo')}>
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
      <div className="kds-header-bar">
        <div className="kds-header-title-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <ChefHat size={20} style={{ color: 'var(--accent-orange)', flexShrink: 0 }} />
            <span className="kds-header-title">Tablero KDS en Vivo</span>
          </div>
          <span className="brand-badge">{activeOrders.length} activas</span>
        </div>

        <div className="kds-channel-filters">
          <button 
            type="button"
            className={`cat-pill-btn ${channelFilter === 'all' ? 'active' : ''}`}
            onClick={() => setChannelFilter('all')}
          >
            Todas
          </button>
          <button 
            type="button"
            className={`cat-pill-btn ${channelFilter === 'whatsapp' ? 'active' : ''}`}
            onClick={() => setChannelFilter('whatsapp')}
          >
            <MessageSquare size={13} /> Delivery
          </button>
          <button 
            type="button"
            className={`cat-pill-btn ${channelFilter === 'mostrador' ? 'active' : ''}`}
            onClick={() => setChannelFilter('mostrador')}
          >
            <ShoppingBag size={13} /> Mostrador
          </button>
          <button 
            type="button"
            className={`cat-pill-btn ${channelFilter === 'mesa' ? 'active' : ''}`}
            onClick={() => setChannelFilter('mesa')}
          >
            <Utensils size={13} /> Mesas
          </button>
        </div>
      </div>

      {/* Mobile Column Switcher Tabs */}
      <div className="kds-mobile-tabs-bar">
        <button
          type="button"
          className={`kds-mobile-tab-btn pending ${mobileColumnTab === 'pendiente' ? 'active' : ''}`}
          onClick={() => setMobileColumnTab('pendiente')}
        >
          <span className="kds-tab-dot pending" />
          <span className="kds-tab-label">Pendientes</span>
          <span className="kds-tab-badge">{pendingOrders.length}</span>
        </button>

        <button
          type="button"
          className={`kds-mobile-tab-btn cooking ${mobileColumnTab === 'cocina' ? 'active' : ''}`}
          onClick={() => setMobileColumnTab('cocina')}
        >
          <span className="kds-tab-dot cooking" />
          <span className="kds-tab-label">En Cocina</span>
          <span className="kds-tab-badge">{cookingOrders.length}</span>
        </button>

        <button
          type="button"
          className={`kds-mobile-tab-btn ready ${mobileColumnTab === 'listo' ? 'active' : ''}`}
          onClick={() => setMobileColumnTab('listo')}
        >
          <span className="kds-tab-dot ready" />
          <span className="kds-tab-label">Listos</span>
          <span className="kds-tab-badge">{readyOrders.length}</span>
        </button>
      </div>

      {/* 3-Column Kanban Board */}
      <div className={`kds-columns-grid mobile-${mobileColumnTab}`}>
        {/* Column 1: Pendientes */}
        <div className={`kds-column ${mobileColumnTab !== 'pendiente' ? 'mobile-hidden' : ''}`}>
          <div className="kds-column-header pending">
            <div className="kds-col-header-left">
              <span className="kds-status-indicator pending" />
              <span className="kds-col-header-title">PENDIENTES</span>
              <span className="kds-col-count-badge">{pendingOrders.length}</span>
            </div>
            <span className="kds-col-header-sub">Por iniciar</span>
          </div>
          <div className="kds-cards-list">
            {pendingOrders.length === 0 ? (
              <div className="kds-empty-column">
                <Clock size={28} style={{ opacity: 0.35, marginBottom: '6px' }} />
                <span>Sin pedidos en espera</span>
              </div>
            ) : (
              pendingOrders.map(renderOrderCard)
            )}
          </div>
        </div>

        {/* Column 2: En Cocina */}
        <div className={`kds-column ${mobileColumnTab !== 'cocina' ? 'mobile-hidden' : ''}`}>
          <div className="kds-column-header cooking">
            <div className="kds-col-header-left">
              <span className="kds-status-indicator cooking" />
              <span className="kds-col-header-title">EN COCINA</span>
              <span className="kds-col-count-badge">{cookingOrders.length}</span>
            </div>
            <span className="kds-col-header-sub">En preparación</span>
          </div>
          <div className="kds-cards-list">
            {cookingOrders.length === 0 ? (
              <div className="kds-empty-column">
                <ChefHat size={28} style={{ opacity: 0.35, marginBottom: '6px' }} />
                <span>Cocina libre</span>
              </div>
            ) : (
              cookingOrders.map(renderOrderCard)
            )}
          </div>
        </div>

        {/* Column 3: Listo / Por despachar */}
        <div className={`kds-column ${mobileColumnTab !== 'listo' ? 'mobile-hidden' : ''}`}>
          <div className="kds-column-header ready">
            <div className="kds-col-header-left">
              <span className="kds-status-indicator ready" />
              <span className="kds-col-header-title">LISTO / DESPACHAR</span>
              <span className="kds-col-count-badge">{readyOrders.length}</span>
            </div>
            <span className="kds-col-header-sub">Completados</span>
          </div>
          <div className="kds-cards-list">
            {readyOrders.length === 0 ? (
              <div className="kds-empty-column">
                <CheckCircle2 size={28} style={{ opacity: 0.35, marginBottom: '6px' }} />
                <span>Sin pedidos listos</span>
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

