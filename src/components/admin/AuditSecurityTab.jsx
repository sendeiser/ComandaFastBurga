import React from 'react';
import { ShieldAlert, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export default function AuditSecurityTab({ cancelledOrders = [], orders = [] }) {
  const formatMoney = (n) => '$' + Number(n || 0).toLocaleString('es-AR');

  // Find orders delivered with pending transfer
  const unconfirmedTransfers = orders.filter(
    o => o.paymentMethod === 'transferencia' && !o.transferConfirmed
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* SECTION 1: UNCONFIRMED TRANSFERS WARNING */}
      <div 
        className="tactile-card"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={20} style={{ color: unconfirmedTransfers.length > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Transferencias Bancarias Sin Acreditar
            </h3>
          </div>
          <span style={{ 
            fontSize: '0.75rem', 
            fontWeight: 800, 
            padding: '2px 8px', 
            borderRadius: 'var(--radius-full)',
            background: unconfirmedTransfers.length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: unconfirmedTransfers.length > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)'
          }}>
            {unconfirmedTransfers.length} {unconfirmedTransfers.length === 1 ? 'Pendiente' : 'Pendientes'}
          </span>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
          Auditoría de pedidos con transferencias no verificadas en cuenta para evitar comprobantes falsos de clientes.
        </p>

        {unconfirmedTransfers.length === 0 ? (
          <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid var(--border-emerald-highlight)', color: 'var(--accent-emerald)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} />
            <span>Excelente: Todas las transferencias registradas fueron debidamente verificadas y acreditadas.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {unconfirmedTransfers.map(o => (
              <div 
                key={o.id} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  flexWrap: 'wrap',
                  gap: '0.6rem',
                  background: 'var(--bg-main)', 
                  padding: '0.75rem 0.95rem', 
                  borderRadius: 'var(--radius-md)', 
                  border: '1px solid rgba(239, 68, 68, 0.35)' 
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    Orden #{o.orderNumber} — {o.customer?.name || 'Cliente sin nombre'}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Comprobante: <code style={{ color: 'var(--accent-amber)', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '3px' }}>{o.transferProof || 'Sin comprobante'}</code> • {new Date(o.createdAt).toLocaleString('es-AR')}
                  </div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                  <div style={{ fontWeight: 900, color: 'var(--accent-rose)', fontSize: '1.05rem', fontFamily: 'var(--font-heading)' }}>
                    {formatMoney(o.total)}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--accent-rose)', fontWeight: 800, background: 'rgba(239, 68, 68, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>
                    ⚠️ PENDIENTE REVISIÓN
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: CANCELLED / VOIDED ORDERS */}
      <div 
        className="tactile-card"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={20} style={{ color: 'var(--accent-amber)' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Registro de Comandas Anuladas / Canceladas
            </h3>
          </div>
          <span style={{ 
            fontSize: '0.75rem', 
            fontWeight: 800, 
            padding: '2px 8px', 
            borderRadius: 'var(--radius-full)',
            background: 'rgba(245, 158, 11, 0.15)',
            color: 'var(--accent-amber)'
          }}>
            {cancelledOrders.length} {cancelledOrders.length === 1 ? 'Anulada' : 'Anuladas'}
          </span>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
          Control de pedidos cancelados para detectar potenciales fraudes o cobros en mano no registrados.
        </p>

        {cancelledOrders.length === 0 ? (
          <div style={{ background: 'var(--bg-main)', padding: '1.5rem', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', border: '1px solid var(--border-subtle)' }}>
            No se han registrado cancelaciones o anulaciones de pedidos.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {cancelledOrders.map((o, idx) => (
              <div 
                key={o.id || idx} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  flexWrap: 'wrap',
                  gap: '0.6rem',
                  background: 'var(--bg-main)', 
                  padding: '0.75rem 0.95rem', 
                  borderRadius: 'var(--radius-md)', 
                  border: '1px solid var(--border-subtle)' 
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    Orden #{o.orderNumber} — {o.customer?.name || 'Consumidor Final'}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--accent-rose)', fontWeight: 700, marginTop: '2px' }}>
                    Motivo: "{o.cancelReason || 'Anulado por cajero'}"
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Anuló: <strong style={{ color: 'var(--text-secondary)' }}>{o.cancelAuthor || 'Cajero'}</strong> el {new Date(o.cancelledAt).toLocaleString('es-AR')}
                  </div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                  <div style={{ fontWeight: 900, color: 'var(--text-secondary)', fontSize: '1rem', fontFamily: 'var(--font-heading)' }}>
                    {formatMoney(o.total)}
                  </div>
                  <span style={{ fontSize: '0.68rem', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-rose)', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                    ANULADO
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
