import React from 'react';
import { ShieldAlert, AlertCircle, Clock, Trash2, CheckCircle2, User } from 'lucide-react';

export default function AuditSecurityTab({ cancelledOrders = [], orders = [] }) {
  const formatMoney = (n) => '$' + Number(n || 0).toLocaleString('es-AR');

  // Find orders delivered with pending transfer
  const unconfirmedTransfers = orders.filter(
    o => o.paymentMethod === 'transferencia' && !o.transferConfirmed
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* SECTION 1: UNCONFIRMED TRANSFERS WARNING */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
          <AlertCircle size={20} style={{ color: unconfirmedTransfers.length > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Transferencias Bancarias Sin Acreditar ({unconfirmedTransfers.length})
          </h3>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
          Pedidos despachados donde el empleado no confirmó el ingreso de dinero en cuenta bancaria. Riesgo de comprobantes falsos de clientes.
        </p>

        {unconfirmedTransfers.length === 0 ? (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={16} />
            <span>Excelente: Todas las transferencias registradas fueron debidamente acreditadas en cuenta.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {unconfirmedTransfers.map(o => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    Orden #{o.orderNumber} — {o.customer?.name || 'Cliente sin nombre'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Comprobante declarado: <code>{o.transferProof || 'Sin comprobante'}</code> • {new Date(o.createdAt).toLocaleString('es-AR')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 900, color: 'var(--accent-rose)', fontSize: '1rem' }}>
                    {formatMoney(o.total)}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--accent-rose)', fontWeight: 800 }}>
                    ⚠️ PENDIENTE DE REVISIÓN
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: CANCELLED / VOIDED ORDERS */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
          <ShieldAlert size={20} style={{ color: 'var(--accent-amber)' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Registro de Pedidos Anulados / Cancelados ({cancelledOrders.length})
          </h3>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
          Auditoría de comandas eliminadas para prevenir que un empleado cobre en efectivo y anule la orden para sustraer dinero.
        </p>

        {cancelledOrders.length === 0 ? (
          <div style={{ background: 'var(--bg-main)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No se han registrado cancelaciones o anulaciones de pedidos.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {cancelledOrders.map((o, idx) => (
              <div key={o.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    Orden #{o.orderNumber} — {o.customer?.name || 'Consumidor Final'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-rose)', fontWeight: 700 }}>
                    Motivo: "{o.cancelReason || 'Anulado por cajero'}"
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Anuló: <strong>{o.cancelAuthor || 'Cajero'}</strong> el {new Date(o.cancelledAt).toLocaleString('es-AR')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 900, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    {formatMoney(o.total)}
                  </div>
                  <span style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-rose)', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
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
