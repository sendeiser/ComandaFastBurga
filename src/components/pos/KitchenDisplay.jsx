import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChefHat, Clock, CheckCircle2, Play, AlertCircle, Printer, 
  MessageSquare, ShoppingBag, Utensils, RefreshCw, XCircle, 
  ArrowLeftRight, ChevronUp, ChevronDown, RotateCcw, Maximize2, 
  Minimize2, Flame, Volume2, VolumeX, X, Sparkles
} from 'lucide-react';
import ConfirmModal from '../common/ConfirmModal';
import { supabaseSync } from '../../services/supabaseClient';
import { audioService } from '../../services/audioService';

export default function KitchenDisplay({ 
  orders = [], 
  onUpdateStatus, 
  onReprintTicket,
  onReorderOrder,
  isZenMode = false,
  onToggleZenMode
}) {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [channelFilter, setChannelFilter] = useState('all');
  const [notifyingId, setNotifyingId] = useState(null);
  const [mobileColumnTab, setMobileColumnTab] = useState('activas'); // 'activas' | 'cocina' | 'pendiente' | 'listo'
  const [cancelModalOrder, setCancelModalOrder] = useState(null);
  const [showGrillModal, setShowGrillModal] = useState(false);
  
  // Audio mute preference for kitchen
  const [isAudioMuted, setIsAudioMuted] = useState(() => {
    try {
      return localStorage.getItem('comandafast_kitchen_mute') === 'true';
    } catch (_) {
      return false;
    }
  });

  const toggleAudioMute = () => {
    setIsAudioMuted(prev => {
      const next = !prev;
      try {
        localStorage.setItem('comandafast_kitchen_mute', String(next));
      } catch (_) {}
      return next;
    });
  };

  // Update timer tick every 10 seconds for real-time minutes
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  // Haptic feedback trigger for tactile confirmation on touch devices
  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(35);
      } catch (_) {}
    }
  };

  // Status change handler with audio & vibration
  const handleActionStatus = (orderId, newStatus, extraData) => {
    triggerHaptic();
    if (!isAudioMuted) {
      if (newStatus === 'cocina') {
        audioService.playOrderChime();
      } else if (newStatus === 'listo') {
        audioService.playReadyBell();
      }
    }
    onUpdateStatus(orderId, newStatus, extraData);
  };

  const handleNotifyWhatsApp = async (order) => {
    if (notifyingId) return;
    setNotifyingId(order.id);
    let handled = false;
    try {
      const botHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`http://${botHost}:3002/api/orders/${order.id}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: order.status, order, force: true }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      handled = true;
      if (data.success) {
        alert(`✅ Notificación de WhatsApp enviada a ${data.jid}`);
      } else {
        alert(`ℹ️ Resultado WhatsApp: ${data.reason === 'bot_disconnected' ? 'Bot desconectado (inicie el bot en el servidor de WhatsApp)' : data.reason || 'Sin número'}`);
      }
    } catch (_) {
      // Direct local fetch failed (e.g. running on Netlify HTTPS or cross-device)
    }

    if (!handled) {
      try {
        const forceTime = new Date().toISOString();
        const currentTimestamps = order.statusTimestamps || {};
        await supabaseSync.updateOrderStatus(order.id, order.status, {
          ...currentTimestamps,
          forceNotifyAt: forceTime
        });
        alert('🔔 Solicitud de aviso enviada a WhatsApp vía la nube. El bot lo despachará en segundos.');
      } catch (err2) {
        alert('⚠️ No se pudo enviar la solicitud de notificación por WhatsApp.');
      }
    }
    setNotifyingId(null);
  };

  const getElapsedMinutes = (dateString) => {
    if (!dateString) return 0;
    const diffMs = currentTime - new Date(dateString).getTime();
    return Math.floor(diffMs / 60000);
  };

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

  // Orders filtering
  const activeOrders = useMemo(() => {
    return orders.filter(o => 
      o.status !== 'entregado' && o.status !== 'cancelado' &&
      (channelFilter === 'all' || o.channel === channelFilter)
    );
  }, [orders, channelFilter]);

  const pendingOrders = useMemo(() => activeOrders.filter(o => o.status === 'pendiente'), [activeOrders]);
  const cookingOrders = useMemo(() => activeOrders.filter(o => o.status === 'cocina'), [activeOrders]);
  const readyOrders = useMemo(() => activeOrders.filter(o => o.status === 'listo'), [activeOrders]);

  // Channel counts for filters
  const channelCounts = useMemo(() => {
    const nonDelivered = orders.filter(o => o.status !== 'entregado' && o.status !== 'cancelado');
    return {
      all: nonDelivered.length,
      mesa: nonDelivered.filter(o => o.channel === 'mesa').length,
      delivery: nonDelivered.filter(o => o.channel === 'delivery' || (o.channel === 'whatsapp' && o.deliveryType !== 'local')).length,
      mostrador: nonDelivered.filter(o => o.channel === 'mostrador' || (o.channel === 'whatsapp' && o.deliveryType === 'local')).length
    };
  }, [orders]);

  // Aggregated Grill / Kitchen Summary (items currently to cook across cooking + pending)
  const grillSummary = useMemo(() => {
    const map = {};
    let totalItems = 0;
    const relevantOrders = orders.filter(o => 
      (o.status === 'cocina' || o.status === 'pendiente') &&
      (channelFilter === 'all' || o.channel === channelFilter)
    );

    relevantOrders.forEach(order => {
      const items = getSafeItems(order.items);
      const isMesa = order.channel === 'mesa';
      const channelLabel = isMesa 
        ? `Mesa ${order.tableNumber || 'S/N'}` 
        : `Ord #${order.orderNumber}`;

      items.forEach(item => {
        const name = (item.name || 'Sin nombre').trim();
        const qty = Number(item.qty || item.quantity || 1);
        totalItems += qty;

        const key = name.toLowerCase();
        if (!map[key]) {
          map[key] = {
            name,
            totalQty: 0,
            cookingQty: 0,
            pendingQty: 0,
            notes: []
          };
        }
        map[key].totalQty += qty;
        if (order.status === 'cocina') map[key].cookingQty += qty;
        if (order.status === 'pendiente') map[key].pendingQty += qty;

        if (item.notes) {
          map[key].notes.push(`${channelLabel}: ⚠️ ${item.notes}`);
        }
        if (Array.isArray(item.modifiers) && item.modifiers.length > 0) {
          map[key].notes.push(`${channelLabel}: + ${item.modifiers.join(', ')}`);
        }
      });
    });

    const list = Object.values(map).sort((a, b) => b.totalQty - a.totalQty);
    return { list, totalItems };
  }, [orders, channelFilter]);

  // Live formatted time for kitchen clock
  const liveClockString = new Date(currentTime).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const renderOrderCard = (order) => {
    const elapsed = getElapsedMinutes(order.createdAt);
    const isDelayed = elapsed > 25;
    const isWarning = elapsed > 15;
    const isCooking = order.status === 'cocina';
    const isReady = order.status === 'listo';
    const isPending = order.status === 'pendiente';

    // Channel label & styling
    const cleanTable = order.tableNumber ? (order.tableNumber.toLowerCase().startsWith('mesa') ? order.tableNumber.toUpperCase() : `MESA ${order.tableNumber}`) : 'SALÓN';
    const channelLabel = order.channel === 'whatsapp' 
      ? (order.deliveryType === 'local' ? '🛍️ WA RETIRO' : '🛵 WA DELIVERY')
      : order.channel === 'mesa' ? `🍽️ ${cleanTable}`
      : order.channel === 'delivery' ? '🛵 DELIVERY'
      : '🛍️ MOSTRADOR';

    return (
      <div 
        key={order.id} 
        className={`kds-order-card ${isDelayed ? 'delayed' : ''} ${isCooking ? 'is-cooking-card' : ''} ${isReady ? 'is-ready-card' : ''}`}
      >
        {/* CARD TOP BAR */}
        <div className="kds-card-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="order-num-badge">#{order.orderNumber}</span>
            {isPending && onReorderOrder && (
              <div className="kds-reorder-btns" style={{ display: 'inline-flex', gap: 2 }}>
                <button 
                  type="button" 
                  className="qty-btn" 
                  style={{ width: 22, height: 22, padding: 0 }} 
                  title="Subir prioridad en cola"
                  onClick={() => onReorderOrder(order.id, -1)}
                >
                  <ChevronUp size={13} />
                </button>
                <button 
                  type="button" 
                  className="qty-btn" 
                  style={{ width: 22, height: 22, padding: 0 }} 
                  title="Bajar prioridad en cola"
                  onClick={() => onReorderOrder(order.id, 1)}
                >
                  <ChevronDown size={13} />
                </button>
              </div>
            )}
            <span className="kds-card-clock">
              {new Date(order.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={`order-type-chip ${order.channel}`}>
              {channelLabel}
            </span>

            <div className={`kds-timer-chip ${isDelayed ? 'danger' : isWarning ? 'warning' : ''}`}>
              <Clock size={12} />
              <span>{elapsed}m</span>
            </div>
          </div>
        </div>

        {/* CUSTOMER & DESTINATION INFO */}
        {(order.customer?.name || typeof order.customer === 'string') && (
          <div className="kds-customer-row">
            <span className="kds-customer-name">
              👤 {typeof order.customer === 'object' ? order.customer.name : order.customer}
              {typeof order.customer === 'object' && order.customer.phone && (
                <span className="kds-customer-phone"> • {order.customer.phone}</span>
              )}
            </span>
            {typeof order.customer === 'object' && order.customer.address && order.deliveryType === 'delivery' && (
              <span className="kds-delivery-address">📍 {order.customer.address}</span>
            )}
          </div>
        )}

        {/* HIGH VISIBILITY CRITICAL OBSERVATIONS / NOTES */}
        {order.customer?.notes && (
          <div className="kds-critical-notes">
            <AlertCircle size={15} style={{ flexShrink: 0, color: '#f59e0b' }} />
            <span><strong>ACLARACIÓN:</strong> {order.customer.notes}</span>
          </div>
        )}

        {/* TRANSFER PAYMENT NOTICE */}
        {order.paymentMethod === 'transferencia' && (
          <div className={`kds-pay-badge ${order.paymentConfirmed || order.paymentStatus === 'pagado' ? 'paid' : order.paymentStatus === 'comprobante_recibido' ? 'proof' : 'waiting'}`}>
            {order.paymentConfirmed || order.paymentStatus === 'pagado' ? (
              <span>✅ Transferencia Acreditada</span>
            ) : order.paymentStatus === 'comprobante_recibido' ? (
              <span>📸 Comprobante Recibido • Por Validar</span>
            ) : (
              <span>⏳ Esperando Comprobante Transferencia</span>
            )}
          </div>
        )}

        {/* ITEMS LIST (HIGH CONTRAST & LEGIBILITY) */}
        <div className="kds-items-list">
          {getSafeItems(order.items).map((item, idx) => (
            <div key={idx} className="kds-item-block">
              <div className="kds-item-line">
                <span className="kds-item-qty">{item.qty || item.quantity || 1}x</span>
                <span className="kds-item-name">{item.name.toUpperCase()}</span>
              </div>
              {Array.isArray(item.modifiers) && item.modifiers.length > 0 && (
                <div className="kds-item-mod-list">
                  {item.modifiers.map((m, mi) => (
                    <span key={mi} className="kds-mod-tag">+ {m}</span>
                  ))}
                </div>
              )}
              {Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0 && (
                <div className="kds-item-mod-list">
                  {item.selectedOptions.map((o, oi) => (
                    <span key={oi} className="kds-mod-tag">→ {o.name || o}</span>
                  ))}
                </div>
              )}
              {item.notes && (
                <div className="kds-item-note-tag">
                  ⚠️ NOTA: {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* PRIMARY TOUCH ACTION BUTTONS */}
        <div className="kds-card-actions">
          {isPending && (
            <>
              {order.paymentMethod === 'transferencia' && !(order.paymentConfirmed || order.paymentStatus === 'pagado') ? (
                <button 
                  type="button"
                  className="btn-kds-action big-touch"
                  style={{
                    background: order.paymentStatus === 'comprobante_recibido'
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: '#ffffff'
                  }}
                  onClick={() => handleActionStatus(order.id, 'cocina', {
                    paymentConfirmed: true,
                    paymentStatus: 'pagado',
                    paymentConfirmedAt: new Date().toISOString()
                  })}
                  title="Confirmar transferencia y mandar a cocina"
                >
                  <CheckCircle2 size={16} />
                  <span>{order.paymentStatus === 'comprobante_recibido' ? 'Validar y Cocinar' : 'Confirmar Pago'}</span>
                </button>
              ) : (
                <button 
                  type="button"
                  className="btn-kds-action to-cooking big-touch"
                  onClick={() => handleActionStatus(order.id, 'cocina')}
                  title="Empezar a cocinar en plancha"
                >
                  <Play size={16} fill="currentColor" />
                  <span>EMPEZAR A COCINAR</span>
                </button>
              )}
              <button 
                type="button"
                className="kds-btn-cancel"
                title="Cancelar Pedido"
                onClick={() => setCancelModalOrder(order)}
              >
                <XCircle size={15} />
              </button>
            </>
          )}

          {isCooking && (
            <button 
              type="button"
              className="btn-kds-action to-ready big-touch"
              onClick={() => handleActionStatus(order.id, 'listo')}
              title="Marcar pedido como ¡Listo para servir/entregar!"
            >
              <CheckCircle2 size={18} />
              <span>✅ ¡MARCAR LISTO!</span>
            </button>
          )}

          {isReady && (
            <button 
              type="button"
              className="btn-kds-action to-done big-touch"
              onClick={() => handleActionStatus(order.id, 'entregado')}
              title="Despachar y finalizar pedido"
            >
              <CheckCircle2 size={18} />
              <span>📦 DESPACHAR Y ENTREGAR</span>
            </button>
          )}
        </div>

        {/* SECONDARY UTILITY BAR */}
        <div className="kds-quick-move-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="kds-quick-move-label">
              <ArrowLeftRight size={11} /> Mover:
            </span>
            {!isPending && (
              <button type="button" className="kds-mini-move-btn" onClick={() => handleActionStatus(order.id, 'pendiente')}>
                Pendiente
              </button>
            )}
            {!isCooking && (
              <button type="button" className="kds-mini-move-btn" onClick={() => handleActionStatus(order.id, 'cocina')}>
                Cocina
              </button>
            )}
            {!isReady && (
              <button type="button" className="kds-mini-move-btn" onClick={() => handleActionStatus(order.id, 'listo')}>
                Listo
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {(order.channel === 'whatsapp' || (order.customer && order.customer.phone)) && (
              <button 
                type="button"
                className={`kds-icon-action-btn whatsapp ${notifyingId === order.id ? 'loading' : ''}`}
                disabled={notifyingId === order.id}
                title="Reenviar estado al WhatsApp del cliente"
                onClick={() => handleNotifyWhatsApp(order)}
              >
                <MessageSquare size={13} />
              </button>
            )}

            <button 
              type="button"
              className="kds-icon-action-btn"
              title="Reimprimir Comanda Cocina"
              onClick={() => onReprintTicket(order, 'kitchen')}
            >
              <Printer size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`kds-container ${isZenMode ? 'zen-mode' : ''}`}>
      {/* 1. TOP HEADER BAR (COMPACT & ULTRA CLEAN) */}
      <div className="kds-header-bar">
        <div className="kds-header-left">
          <div className="kds-title-glow-box">
            <ChefHat size={19} className="kds-chef-icon" />
            <div>
              <div className="kds-header-title">
                {isZenMode ? 'MODO COCINA' : 'COCINA EN VIVO'}
              </div>
              <div className="kds-header-clock">
                ⏱️ {liveClockString} hs
              </div>
            </div>
          </div>

          <div className="kds-count-pills-row">
            <span className="kds-count-pill cooking">
              🔥 {cookingOrders.length} en fuego
            </span>
            <span className="kds-count-pill pending">
              ⏳ {pendingOrders.length} en espera
            </span>
            {readyOrders.length > 0 && (
              <span className="kds-count-pill ready">
                ✅ {readyOrders.length} listos
              </span>
            )}
          </div>
        </div>

        <div className="kds-header-right">
          {/* GRILL / PLANCHA SUMMARY BUTTON */}
          <button 
            type="button"
            className="kds-grill-summary-btn"
            onClick={() => setShowGrillModal(true)}
            title="Ver resumen consolidado de hamburguesas y guarniciones en plancha"
          >
            <Flame size={15} />
            <span>Plancha ({grillSummary.totalItems})</span>
          </button>

          {/* AUDIO ALERTS TOGGLE */}
          <button 
            type="button"
            className={`kds-topbar-btn ${isAudioMuted ? 'muted' : ''}`}
            onClick={toggleAudioMute}
            title={isAudioMuted ? 'Alertas de sonido desactivadas (Clic para activar)' : 'Alertas de sonido activadas'}
          >
            {isAudioMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          {/* FULLSCREEN / ZEN MODE TOGGLE */}
          {onToggleZenMode && (
            <button 
              type="button"
              className={`kds-zen-toggle-btn ${isZenMode ? 'active' : ''}`}
              onClick={onToggleZenMode}
              title={isZenMode ? 'Salir del Modo Cocina Enfocado' : 'Activar Modo Cocina Pantalla Completa (Oculta barras y maximiza espacio)'}
            >
              {isZenMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              <span>{isZenMode ? 'Salir' : 'Modo Cocina'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. CHANNELS FILTER ROW */}
      <div className="kds-channel-filters-row">
        <button 
          type="button"
          className={`kds-channel-pill ${channelFilter === 'all' ? 'active' : ''}`}
          onClick={() => setChannelFilter('all')}
        >
          Todas ({channelCounts.all})
        </button>
        <button 
          type="button"
          className={`kds-channel-pill ${channelFilter === 'mesa' ? 'active' : ''}`}
          onClick={() => setChannelFilter('mesa')}
        >
          <Utensils size={13} /> Mesas ({channelCounts.mesa})
        </button>
        <button 
          type="button"
          className={`kds-channel-pill ${channelFilter === 'delivery' ? 'active' : ''}`}
          onClick={() => setChannelFilter('delivery')}
        >
          <MessageSquare size={13} /> Delivery ({channelCounts.delivery})
        </button>
        <button 
          type="button"
          className={`kds-channel-pill ${channelFilter === 'mostrador' ? 'active' : ''}`}
          onClick={() => setChannelFilter('mostrador')}
        >
          <ShoppingBag size={13} /> Retiro ({channelCounts.mostrador})
        </button>
      </div>

      {/* 3. MOBILE VIEW SWITCHER TABS */}
      <div className="kds-mobile-tabs-bar">
        <button
          type="button"
          className={`kds-mobile-tab-btn active-all ${mobileColumnTab === 'activas' ? 'active' : ''}`}
          onClick={() => setMobileColumnTab('activas')}
        >
          <Flame size={14} style={{ color: 'var(--accent-orange)' }} />
          <span className="kds-tab-label">En Marcha</span>
          <span className="kds-tab-badge">{cookingOrders.length + pendingOrders.length}</span>
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
          className={`kds-mobile-tab-btn pending ${mobileColumnTab === 'pendiente' ? 'active' : ''}`}
          onClick={() => setMobileColumnTab('pendiente')}
        >
          <span className="kds-tab-dot pending" />
          <span className="kds-tab-label">En Espera</span>
          <span className="kds-tab-badge">{pendingOrders.length}</span>
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

      {/* 4. MAIN BOARD: RESPONSIVE COLUMNS / MOBILE VIEW */}
      {/* MOBILE COMBINED VIEW: 'ACTIVAS' (Cocina + Pendientes in continuous stream) */}
      <div className={`kds-mobile-activas-stream ${mobileColumnTab !== 'activas' ? 'mobile-hidden' : ''}`}>
        {cookingOrders.length === 0 && pendingOrders.length === 0 ? (
          <div className="kds-empty-column">
            <CheckCircle2 size={36} style={{ opacity: 0.35, marginBottom: 8, color: '#10b981' }} />
            <strong style={{ fontSize: '1rem', color: '#fff' }}>¡Cocina despejada!</strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
              No hay pedidos pendientes ni en preparación en este momento.
            </span>
          </div>
        ) : (
          <>
            {cookingOrders.length > 0 && (
              <div className="kds-stream-section">
                <div className="kds-stream-header cooking">
                  <span>🔥 EN PREPARACIÓN ({cookingOrders.length})</span>
                </div>
                <div className="kds-cards-list">
                  {cookingOrders.map(renderOrderCard)}
                </div>
              </div>
            )}

            {pendingOrders.length > 0 && (
              <div className="kds-stream-section">
                <div className="kds-stream-header pending">
                  <span>⏳ EN ESPERA / POR INICIAR ({pendingOrders.length})</span>
                </div>
                <div className="kds-cards-list">
                  {pendingOrders.map(renderOrderCard)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 3-COLUMN KANBAN BOARD FOR DESKTOP / AND SINGLE COLUMN FOR OTHER MOBILE TABS */}
      <div className={`kds-columns-grid ${mobileColumnTab === 'activas' ? 'mobile-activas-hidden' : `mobile-${mobileColumnTab}`}`}>
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
                <Clock size={28} style={{ opacity: 0.35, marginBottom: 6 }} />
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
            <span className="kds-col-header-sub">En fuego / plancha</span>
          </div>
          <div className="kds-cards-list">
            {cookingOrders.length === 0 ? (
              <div className="kds-empty-column">
                <ChefHat size={28} style={{ opacity: 0.35, marginBottom: 6 }} />
                <span>Cocina libre</span>
              </div>
            ) : (
              cookingOrders.map(renderOrderCard)
            )}
          </div>
        </div>

        {/* Column 3: Listo / Despachar */}
        <div className={`kds-column ${mobileColumnTab !== 'listo' ? 'mobile-hidden' : ''}`}>
          <div className="kds-column-header ready">
            <div className="kds-col-header-left">
              <span className="kds-status-indicator ready" />
              <span className="kds-col-header-title">LISTO / SERVIR</span>
              <span className="kds-col-count-badge">{readyOrders.length}</span>
            </div>
            <span className="kds-col-header-sub">Por despachar</span>
          </div>
          <div className="kds-cards-list">
            {readyOrders.length === 0 ? (
              <div className="kds-empty-column">
                <CheckCircle2 size={28} style={{ opacity: 0.35, marginBottom: 6 }} />
                <span>Sin pedidos listos</span>
              </div>
            ) : (
              readyOrders.map(renderOrderCard)
            )}
          </div>
        </div>
      </div>

      {/* 5. RESUMEN DE PLANCHA MODAL / BOTTOM SHEET */}
      {showGrillModal && (
        <div className="cat-modal-overlay" onClick={() => setShowGrillModal(false)}>
          <div className="kds-grill-modal-card" onClick={e => e.stopPropagation()}>
            <div className="kds-grill-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="kds-grill-modal-icon">🔥</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#fff' }}>
                    Resumen de Plancha & Freidora
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-amber)', fontWeight: 700 }}>
                    {grillSummary.totalItems} ítems en marcha ({cookingOrders.length} en fuego • {pendingOrders.length} en espera)
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                className="cat-sheet-close-btn" 
                onClick={() => setShowGrillModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="kds-grill-modal-body">
              {grillSummary.list.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--text-muted)' }}>
                  No hay ítems pendientes de cocinar en este momento.
                </div>
              ) : (
                <div className="kds-grill-grid">
                  {grillSummary.list.map((item, idx) => (
                    <div key={idx} className="kds-grill-item-card">
                      <div className="kds-grill-item-top">
                        <span className="kds-grill-qty-badge">{item.totalQty}x</span>
                        <span className="kds-grill-item-name">{item.name.toUpperCase()}</span>
                      </div>
                      <div className="kds-grill-item-split">
                        {item.cookingQty > 0 && (
                          <span className="kds-grill-split-cooking">🔥 {item.cookingQty} en cocina</span>
                        )}
                        {item.pendingQty > 0 && (
                          <span className="kds-grill-split-pending">⏳ {item.pendingQty} en espera</span>
                        )}
                      </div>
                      {item.notes.length > 0 && (
                        <div className="kds-grill-notes-list">
                          {item.notes.map((n, ni) => (
                            <div key={ni} className="kds-grill-note-pill">{n}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="kds-grill-modal-footer">
              <button 
                type="button" 
                className="kds-grill-close-btn"
                onClick={() => setShowGrillModal(false)}
              >
                Cerrar Resumen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL DE CONFIRMACIÓN PARA CANCELAR PEDIDO */}
      <ConfirmModal
        isOpen={!!cancelModalOrder}
        title={`¿Cancelar el pedido #${cancelModalOrder?.orderNumber || ''}?`}
        message={`¿Estás seguro de que deseas cancelar la comanda de ${cancelModalOrder?.customer?.name || 'este cliente'}? Esta orden pasará a estado CANCELADO.`}
        confirmText="Sí, Cancelar Pedido"
        cancelText="Volver"
        variant="danger"
        icon={XCircle}
        onConfirm={() => {
          if (cancelModalOrder) {
            handleActionStatus(cancelModalOrder.id, 'cancelado');
            setCancelModalOrder(null);
          }
        }}
        onCancel={() => setCancelModalOrder(null)}
      />
    </div>
  );
}
