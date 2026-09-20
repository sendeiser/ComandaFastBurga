import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChefHat, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  Printer, 
  Bike, 
  Store, 
  Layers, 
  Volume2, 
  VolumeX, 
  Sparkles 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toastService } from '../../services/toastService';

export default function KitchenDisplay({ 
  orders, 
  onUpdateStatus, 
  onReprintTicket 
}) {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Live timer tick every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Filter Active orders
  const activeOrders = useMemo(() => {
    return orders.filter(o => o.status !== 'entregado');
  }, [orders]);

  const pendingOrders = activeOrders.filter(o => o.status === 'pendiente');
  const cookingOrders = activeOrders.filter(o => o.status === 'en_cocina');
  const readyOrders = activeOrders.filter(o => o.status === 'listo');

  const getElapsedMinutes = (createdAt) => {
    const start = new Date(createdAt).getTime();
    return Math.floor((currentTime - start) / 60000);
  };

  const getTimerBadge = (minutes) => {
    if (minutes < 10) {
      return { class: 'green', text: `${minutes}m` };
    }
    if (minutes < 20) {
      return { class: 'yellow', text: `${minutes}m` };
    }
    return { class: 'red', text: `${minutes}m (DEMORA)` };
  };

  const handleAdvance = (order, nextStatus) => {
    onUpdateStatus(order.id, nextStatus);

    if (nextStatus === 'listo') {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 }
        });
      } catch(e) {}
      toastService.success(`¡Orden #${order.orderNumber} lista para entrega! 🔔`);
    } else if (nextStatus === 'en_cocina') {
      toastService.info(`Orden #${order.orderNumber} en marcha a los fuegos 🍳`);
    } else if (nextStatus === 'entregado') {
      toastService.success(`Orden #${order.orderNumber} entregada y archivada ✅`);
    }
  };

  return (
    <div className="kds-container">
      {/* KDS TOP TOOLBAR */}
      <div className="kds-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ChefHat size={24} style={{ color: 'var(--accent-amber)' }} />
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 900 }}>
            Pantalla de Cocina (KDS)
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 700 }}>
            <span style={{ color: 'var(--accent-rose)' }}>Pendientes: {pendingOrders.length}</span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span style={{ color: 'var(--accent-amber)' }}>En Cocina: {cookingOrders.length}</span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span style={{ color: 'var(--accent-emerald)' }}>Listos: {readyOrders.length}</span>
          </div>

          <button 
            type="button" 
            className="icon-action-btn"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Sonido Activado' : 'Sonido Silenciado'}
          >
            {soundEnabled ? <Volume2 size={18} style={{ color: 'var(--accent-emerald)' }} /> : <VolumeX size={18} />}
          </button>
        </div>
      </div>

      {/* 3 COLUMNS KANBAN BOARD */}
      <div className="kds-board-grid">
        {/* COLUMN 1: PENDIENTES */}
        <div className="kds-column">
          <div className="kds-column-header pending">
            <span>🔴 Pendientes</span>
            <span className="nav-badge-count" style={{ background: 'var(--accent-rose)' }}>{pendingOrders.length}</span>
          </div>

          <div className="kds-cards-scroll">
            {pendingOrders.map(order => {
              const minutes = getElapsedMinutes(order.createdAt);
              const timer = getTimerBadge(minutes);

              return (
                <div key={order.id} className={`kds-order-card ${minutes >= 20 ? 'delayed' : ''}`}>
                  <div className="kds-order-top">
                    <div className="kds-order-num">#{order.orderNumber}</div>
                    <div className={`kds-timer-badge ${timer.class}`}>
                      <Clock size={12} />
                      <span>{timer.text}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {order.channel === 'whatsapp' && <><Bike size={13} /> <span>Delivery: {order.customer?.name || 'S/N'}</span></>}
                    {order.channel === 'mostrador' && <><Store size={13} /> <span>Mostrador</span></>}
                    {order.channel === 'mesa' && <><Layers size={13} /> <span>Mesa Nº {order.tableNumber}</span></>}
                  </div>

                  <div className="kds-items-list">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="kds-item-row">
                        <span className="kds-item-qty">{it.qty}x</span>
                        <div style={{ flex: 1 }}>
                          <span className="kds-item-title">{it.name}</span>
                          {it.modifiers && it.modifiers.length > 0 && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--accent-amber)' }}>
                              {it.modifiers.map(m => m.name).join(', ')}
                            </div>
                          )}
                          {it.notes && (
                            <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontStyle: 'italic' }}>
                              "{it.notes}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="kds-action-bar">
                    <button 
                      type="button" 
                      className="icon-action-btn"
                      onClick={() => onReprintTicket(order, 'kitchen')}
                      title="Imprimir comanda de cocina"
                    >
                      <Printer size={15} />
                    </button>

                    <button 
                      type="button" 
                      className="kds-btn-advance to-cooking"
                      onClick={() => handleAdvance(order, 'en_cocina')}
                    >
                      <span>A Cocina</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMN 2: EN COCINA */}
        <div className="kds-column">
          <div className="kds-column-header cooking">
            <span>🟡 En Cocina</span>
            <span className="nav-badge-count" style={{ background: 'var(--accent-amber)', color: '#000' }}>{cookingOrders.length}</span>
          </div>

          <div className="kds-cards-scroll">
            {cookingOrders.map(order => {
              const minutes = getElapsedMinutes(order.createdAt);
              const timer = getTimerBadge(minutes);

              return (
                <div key={order.id} className={`kds-order-card ${minutes >= 20 ? 'delayed' : ''}`}>
                  <div className="kds-order-top">
                    <div className="kds-order-num">#{order.orderNumber}</div>
                    <div className={`kds-timer-badge ${timer.class}`}>
                      <Clock size={12} />
                      <span>{timer.text}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {order.channel === 'whatsapp' && <><Bike size={13} /> <span>Delivery: {order.customer?.name || 'S/N'}</span></>}
                    {order.channel === 'mostrador' && <><Store size={13} /> <span>Mostrador</span></>}
                    {order.channel === 'mesa' && <><Layers size={13} /> <span>Mesa Nº {order.tableNumber}</span></>}
                  </div>

                  <div className="kds-items-list">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="kds-item-row">
                        <span className="kds-item-qty">{it.qty}x</span>
                        <div style={{ flex: 1 }}>
                          <span className="kds-item-title">{it.name}</span>
                          {it.modifiers && it.modifiers.length > 0 && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--accent-amber)' }}>
                              {it.modifiers.map(m => m.name).join(', ')}
                            </div>
                          )}
                          {it.notes && (
                            <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontStyle: 'italic' }}>
                              "{it.notes}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="kds-action-bar">
                    <button 
                      type="button" 
                      className="icon-action-btn"
                      onClick={() => onReprintTicket(order, 'kitchen')}
                      title="Imprimir comanda de cocina"
                    >
                      <Printer size={15} />
                    </button>

                    <button 
                      type="button" 
                      className="kds-btn-advance to-ready"
                      onClick={() => handleAdvance(order, 'listo')}
                    >
                      <CheckCircle2 size={15} />
                      <span>¡Listo / Servir!</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMN 3: LISTOS PARA ENTREGA */}
        <div className="kds-column">
          <div className="kds-column-header ready">
            <span>🟢 Listos para Entrega</span>
            <span className="nav-badge-count" style={{ background: 'var(--accent-emerald)' }}>{readyOrders.length}</span>
          </div>

          <div className="kds-cards-scroll">
            {readyOrders.map(order => (
              <div key={order.id} className="kds-order-card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                <div className="kds-order-top">
                  <div className="kds-order-num" style={{ color: 'var(--accent-emerald)' }}>#{order.orderNumber}</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 800 }}>¡EMPAQUETADO!</span>
                </div>

                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                  {order.channel === 'whatsapp' && `🛵 Delivery: ${order.customer?.address || 'Sin dirección'}`}
                  {order.channel === 'mostrador' && '🏪 Llamar a Mostrador'}
                  {order.channel === 'mesa' && `🍽️ Llevar a Mesa Nº ${order.tableNumber}`}
                </div>

                <div className="kds-action-bar">
                  <button 
                    type="button" 
                    className="icon-action-btn"
                    onClick={() => onReprintTicket(order, 'customer')}
                    title="Imprimir ticket cliente"
                  >
                    <Printer size={15} />
                  </button>

                  <button 
                    type="button" 
                    className="btn-secondary"
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}
                    onClick={() => handleAdvance(order, 'entregado')}
                  >
                    Marcar Entregado
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
