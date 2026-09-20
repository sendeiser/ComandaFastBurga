import React from 'react';
import { DollarSign, ShoppingBag, TrendingUp, CreditCard, MessageSquare, Utensils, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

export default function AuditKpisTab({ kpis }) {
  const formatMoney = (n) => '$' + Number(n || 0).toLocaleString('es-AR');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 4 MAIN KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {/* Card 1: Facturación Bruta */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>FACTURACIÓN TOTAL</span>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '6px', borderRadius: '8px', color: 'var(--accent-amber)' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-amber)' }}>
            {formatMoney(kpis.grossRevenue)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Subtotal: {formatMoney(kpis.subtotalRevenue)} + Envíos: {formatMoney(kpis.totalDeliveryFees)}
          </div>
        </div>

        {/* Card 2: Total Pedidos */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>TOTAL PEDIDOS</span>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '6px', borderRadius: '8px', color: '#60a5fa' }}>
              <ShoppingBag size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {kpis.totalOrders}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Despachados en el período seleccionado
          </div>
        </div>

        {/* Card 3: Ticket Promedio */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>TICKET PROMEDIO</span>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '6px', borderRadius: '8px', color: 'var(--accent-emerald)' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-emerald)' }}>
            {formatMoney(kpis.avgTicket)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Gasto promedio por cliente / comanda
          </div>
        </div>

        {/* Card 4: Efectivo Neto en Cajón */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>EFECTIVO NETO CAJA</span>
            <div style={{ background: 'rgba(168, 85, 247, 0.15)', padding: '6px', borderRadius: '8px', color: '#c084fc' }}>
              <CreditCard size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {formatMoney(kpis.netCashInHand)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Efvo cobrado {formatMoney(kpis.payments.cash.total)} - Gastos {formatMoney(kpis.totalExpenses)}
          </div>
        </div>
      </div>

      {/* TWO COLUMNS: PAYMENT METHODS & CHANNELS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* Desglose por Medio de Pago */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={18} style={{ color: 'var(--accent-amber)' }} />
            <span>Auditoría por Medios de Pago</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Efectivo */}
            <div style={{ background: 'var(--bg-main)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>💵 Efectivo en Mano</span>
                <span style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{formatMoney(kpis.payments.cash.total)}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {kpis.payments.cash.count} pedidos cobrados en billete
              </div>
            </div>

            {/* Transferencias */}
            <div style={{ background: 'var(--bg-main)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>📱 Transferencias Bancarias / MP</span>
                <span style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--accent-amber)' }}>{formatMoney(kpis.payments.transfer.total)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '6px', fontSize: '0.75rem' }}>
                <div style={{ color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={13} />
                  <span>Acreditadas: {formatMoney(kpis.payments.transfer.confirmed)}</span>
                </div>
                <div style={{ color: kpis.payments.transfer.pending > 0 ? 'var(--accent-rose)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: kpis.payments.transfer.pending > 0 ? 800 : 400 }}>
                  <Clock size={13} />
                  <span>Pendientes: {formatMoney(kpis.payments.transfer.pending)}</span>
                </div>
              </div>
            </div>

            {/* Tarjetas / Posnet */}
            <div style={{ background: 'var(--bg-main)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>💳 Posnet / Tarjetas</span>
                <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#60a5fa' }}>{formatMoney(kpis.payments.card.total)}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {kpis.payments.card.count} transacciones electrónicas
              </div>
            </div>
          </div>
        </div>

        {/* Ventas por Canal */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={18} style={{ color: 'var(--accent-emerald)' }} />
            <span>Ventas por Canal de Despacho</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* WhatsApp / Delivery */}
            <div style={{ background: 'var(--bg-main)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--accent-emerald)' }}>🛵</span> WhatsApp / Delivery
                </span>
                <span style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{formatMoney(kpis.channels.whatsapp.total)}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {kpis.channels.whatsapp.count} pedidos con envío
              </div>
            </div>

            {/* Mostrador / Retiro */}
            <div style={{ background: 'var(--bg-main)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🛍️</span> Retiro en Mostrador
                </span>
                <span style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{formatMoney(kpis.channels.mostrador.total)}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {kpis.channels.mostrador.count} pedidos retirados en tienda
              </div>
            </div>

            {/* Mesa Local */}
            <div style={{ background: 'var(--bg-main)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Utensils size={15} style={{ color: 'var(--accent-amber)' }} /> Salón / Mesa Local
                </span>
                <span style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{formatMoney(kpis.channels.mesa.total)}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {kpis.channels.mesa.count} comandas atendidas en salón
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
