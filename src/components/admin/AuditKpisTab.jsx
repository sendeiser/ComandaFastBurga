import React from 'react';
import { DollarSign, ShoppingBag, TrendingUp, CreditCard, MessageSquare, Utensils, CheckCircle2, Clock, ArrowUpRight, Smartphone, ShieldCheck, Bot } from 'lucide-react';

export default function AuditKpisTab({ kpis, onOpenBot }) {
  const formatMoney = (n) => '$' + Number(n || 0).toLocaleString('es-AR');

  const gross = kpis.grossRevenue || 0;
  const cashShare = gross > 0 ? Math.round(((kpis.payments?.cash?.total || 0) / gross) * 100) : 0;
  const transferShare = gross > 0 ? Math.round(((kpis.payments?.transfer?.total || 0) / gross) * 100) : 0;
  const cardShare = gross > 0 ? Math.round(((kpis.payments?.card?.total || 0) / gross) * 100) : 0;

  const waShare = gross > 0 ? Math.round(((kpis.channels?.whatsapp?.total || 0) / gross) * 100) : 0;
  const mostradorShare = gross > 0 ? Math.round(((kpis.channels?.mostrador?.total || 0) / gross) * 100) : 0;
  const mesaShare = gross > 0 ? Math.round(((kpis.channels?.mesa?.total || 0) / gross) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* QUICK ACCESS: BOT CONNECTION & SECURITY */}
      <div 
        className="tactile-card"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(37, 211, 102, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#16a34a',
            flexShrink: 0
          }}>
            <Bot size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
              Gestión Rápida de WhatsApp Bot
            </div>
            <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
              Acceso directo a la vinculación QR de WhatsApp y a la configuración de protección anti-baneo y spam.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="cat-pill-btn active"
            onClick={() => onOpenBot && onOpenBot('connection')}
            style={{
              height: '38px',
              padding: '0 1.1rem',
              fontSize: '0.82rem',
              fontWeight: 800,
              gap: '7px',
              background: '#10b981',
              borderColor: '#059669',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Smartphone size={16} />
            <span>Conexión de Bot (QR)</span>
          </button>

          <button
            type="button"
            className="cat-pill-btn"
            onClick={() => onOpenBot && onOpenBot('security')}
            style={{
              height: '38px',
              padding: '0 1.1rem',
              fontSize: '0.82rem',
              fontWeight: 800,
              gap: '7px',
              background: '#ffffff',
              border: '1.5px solid #d97706',
              color: '#b45309',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ShieldCheck size={16} color="#d97706" />
            <span>Seguridad & Filtro Anti-Spam</span>
          </button>
        </div>
      </div>

      {/* 4 MAIN KPI CARDS */}
      <div className="audit-kpis-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
        {/* Card 1: Facturación Bruta */}
        <div 
          className="tactile-card"
          style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-subtle)', 
            borderTop: '3px solid var(--accent-amber)',
            borderRadius: 'var(--radius-md)', 
            padding: '1.2rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.4rem',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
              FACTURACIÓN TOTAL
            </span>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '6px', borderRadius: '10px', color: 'var(--accent-amber)' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--accent-amber)', fontFamily: 'var(--font-heading)' }}>
            {formatMoney(kpis.grossRevenue)}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Subtotal: {formatMoney(kpis.subtotalRevenue)} • Envíos: {formatMoney(kpis.totalDeliveryFees)}
          </div>
        </div>

        {/* Card 2: Total Pedidos */}
        <div 
          className="tactile-card"
          style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-subtle)', 
            borderTop: '3px solid var(--accent-blue)',
            borderRadius: 'var(--radius-md)', 
            padding: '1.2rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.4rem',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
              TOTAL PEDIDOS
            </span>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '6px', borderRadius: '10px', color: '#60a5fa' }}>
              <ShoppingBag size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            {kpis.totalOrders}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Comandas despachadas en el período
          </div>
        </div>

        {/* Card 3: Ticket Promedio */}
        <div 
          className="tactile-card"
          style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-subtle)', 
            borderTop: '3px solid var(--accent-emerald)',
            borderRadius: 'var(--radius-md)', 
            padding: '1.2rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.4rem',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
              TICKET PROMEDIO
            </span>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '6px', borderRadius: '10px', color: 'var(--accent-emerald)' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--accent-emerald)', fontFamily: 'var(--font-heading)' }}>
            {formatMoney(kpis.avgTicket)}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Gasto promedio por comanda cerrada
          </div>
        </div>

        {/* Card 4: Efectivo Neto en Cajón */}
        <div 
          className="tactile-card"
          style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-subtle)', 
            borderTop: '3px solid #c084fc',
            borderRadius: 'var(--radius-md)', 
            padding: '1.2rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.4rem',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
              EFECTIVO NETO CAJA
            </span>
            <div style={{ background: 'rgba(168, 85, 247, 0.15)', padding: '6px', borderRadius: '10px', color: '#c084fc' }}>
              <CreditCard size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            {formatMoney(kpis.netCashInHand)}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Cobrado {formatMoney(kpis.payments?.cash?.total)} • Gastos -{formatMoney(kpis.totalExpenses)}
          </div>
        </div>
      </div>

      {/* TWO COLUMNS: PAYMENT METHODS & CHANNELS */}
      <div className="audit-sub-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {/* Desglose por Medio de Pago */}
        <div 
          className="tactile-card"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}
        >
          <div style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} style={{ color: 'var(--accent-amber)' }} />
              <span>Auditoría de Pagos</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>PARTICIPACIÓN</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Efectivo */}
            <div style={{ background: 'var(--bg-main)', padding: '0.75rem 0.95rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>💵 Efectivo en Mano</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{formatMoney(kpis.payments?.cash?.total)}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 800 }}>({cashShare}%)</span>
                </div>
              </div>
              <div style={{ height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden', margin: '6px 0 4px' }}>
                <div style={{ width: `${cashShare}%`, height: '100%', background: 'var(--accent-amber)', borderRadius: '2px' }} />
              </div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                {kpis.payments?.cash?.count || 0} pedidos cobrados con billetes
              </div>
            </div>

            {/* Transferencias */}
            <div style={{ background: 'var(--bg-main)', padding: '0.75rem 0.95rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>📱 Transferencias / MP</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--accent-amber)' }}>{formatMoney(kpis.payments?.transfer?.total)}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 800 }}>({transferShare}%)</span>
                </div>
              </div>
              <div style={{ height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden', margin: '6px 0 4px' }}>
                <div style={{ width: `${transferShare}%`, height: '100%', background: 'var(--accent-emerald)', borderRadius: '2px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '4px', fontSize: '0.73rem' }}>
                <div style={{ color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} />
                  <span>Acreditadas: {formatMoney(kpis.payments?.transfer?.confirmed)}</span>
                </div>
                <div style={{ color: (kpis.payments?.transfer?.pending || 0) > 0 ? 'var(--accent-rose)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: (kpis.payments?.transfer?.pending || 0) > 0 ? 800 : 400 }}>
                  <Clock size={12} />
                  <span>Pendientes: {formatMoney(kpis.payments?.transfer?.pending)}</span>
                </div>
              </div>
            </div>

            {/* Tarjetas / Posnet */}
            <div style={{ background: 'var(--bg-main)', padding: '0.75rem 0.95rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>💳 Posnet / Tarjetas</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 900, fontSize: '1.05rem', color: '#60a5fa' }}>{formatMoney(kpis.payments?.card?.total)}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 800 }}>({cardShare}%)</span>
                </div>
              </div>
              <div style={{ height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden', margin: '6px 0 4px' }}>
                <div style={{ width: `${cardShare}%`, height: '100%', background: '#3b82f6', borderRadius: '2px' }} />
              </div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                {kpis.payments?.card?.count || 0} transacciones electrónicas
              </div>
            </div>
          </div>
        </div>

        {/* Ventas por Canal */}
        <div 
          className="tactile-card"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}
        >
          <div style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} style={{ color: 'var(--accent-emerald)' }} />
              <span>Canales de Despacho</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>VOLUMEN</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* WhatsApp / Delivery */}
            <div style={{ background: 'var(--bg-main)', padding: '0.75rem 0.95rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--accent-emerald)' }}>🛵</span> Delivery WhatsApp
                </span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{formatMoney(kpis.channels?.whatsapp?.total)}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 800 }}>({waShare}%)</span>
                </div>
              </div>
              <div style={{ height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden', margin: '6px 0 4px' }}>
                <div style={{ width: `${waShare}%`, height: '100%', background: 'var(--accent-emerald)', borderRadius: '2px' }} />
              </div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                {kpis.channels?.whatsapp?.count || 0} pedidos enviados a domicilio
              </div>
            </div>

            {/* Mostrador / Retiro */}
            <div style={{ background: 'var(--bg-main)', padding: '0.75rem 0.95rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🛍️</span> Retiro en Mostrador
                </span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{formatMoney(kpis.channels?.mostrador?.total)}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 800 }}>({mostradorShare}%)</span>
                </div>
              </div>
              <div style={{ height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden', margin: '6px 0 4px' }}>
                <div style={{ width: `${mostradorShare}%`, height: '100%', background: 'var(--accent-amber)', borderRadius: '2px' }} />
              </div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                {kpis.channels?.mostrador?.count || 0} pedidos preparados para takeaway
              </div>
            </div>

            {/* Mesa Local */}
            <div style={{ background: 'var(--bg-main)', padding: '0.75rem 0.95rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Utensils size={15} style={{ color: 'var(--accent-amber)' }} /> Salón / Mesa Local
                </span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{formatMoney(kpis.channels?.mesa?.total)}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 800 }}>({mesaShare}%)</span>
                </div>
              </div>
              <div style={{ height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden', margin: '6px 0 4px' }}>
                <div style={{ width: `${mesaShare}%`, height: '100%', background: '#a855f7', borderRadius: '2px' }} />
              </div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                {kpis.channels?.mesa?.count || 0} comandas servidas en mesas
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
