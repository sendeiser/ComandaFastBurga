import React, { useState } from 'react';
import { X, DollarSign, Smartphone, CreditCard, Printer, CheckCircle, Copy, AlertTriangle } from 'lucide-react';

export default function PaymentModal({ 
  cartTotal, 
  settings, 
  onConfirmOrder, 
  onClose 
}) {
  const [method, setMethod] = useState('efectivo'); // 'efectivo' | 'transferencia' | 'tarjeta'
  const [cashPaid, setCashPaid] = useState('');
  const [transferProof, setTransferProof] = useState('');
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const [autoPrint, setAutoPrint] = useState(settings?.autoPrintOnConfirm ?? true);
  const [copiedAlias, setCopiedAlias] = useState(false);

  const numCashPaid = parseFloat(cashPaid) || 0;
  const cashChange = Math.max(0, numCashPaid - cartTotal);

  const copyAlias = () => {
    if (settings?.alias) {
      navigator.clipboard.writeText(settings.alias);
      setCopiedAlias(true);
      setTimeout(() => setCopiedAlias(false), 2000);
    }
  };

  const handleFinalize = () => {
    if (method === 'efectivo' && numCashPaid > 0 && numCashPaid < cartTotal) {
      alert('El monto recibido en efectivo es menor al total del pedido.');
      return;
    }

    onConfirmOrder({
      paymentMethod: method,
      cashPaid: method === 'efectivo' ? numCashPaid : null,
      cashChange: method === 'efectivo' ? cashChange : null,
      transferProof: method === 'transferencia' ? transferProof.trim() : null,
      transferConfirmed: method === 'transferencia' ? transferConfirmed : null,
      autoPrint
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <DollarSign size={24} style={{ color: 'var(--accent-amber)' }} />
            <span>Cobro & Cierre de Pedido</span>
          </div>
          <button className="btn-close-modal" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Total Highlight */}
        <div style={{ 
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(234, 88, 12, 0.15))', 
          border: '1px solid var(--accent-amber)', 
          borderRadius: 'var(--radius-md)', 
          padding: '1rem', 
          textAlign: 'center' 
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>TOTAL A COBRAR</div>
          <div style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--accent-amber)', fontFamily: 'var(--font-heading)' }}>
            ${cartTotal.toLocaleString('es-AR')}
          </div>
        </div>

        {/* Method Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
          <button
            type="button"
            className={`cat-pill-btn ${method === 'efectivo' ? 'active' : ''}`}
            style={{ justifyContent: 'center' }}
            onClick={() => setMethod('efectivo')}
          >
            <DollarSign size={16} />
            <span>Efectivo</span>
          </button>

          <button
            type="button"
            className={`cat-pill-btn ${method === 'transferencia' ? 'active' : ''}`}
            style={{ justifyContent: 'center' }}
            onClick={() => setMethod('transferencia')}
          >
            <Smartphone size={16} />
            <span>Transferencia</span>
          </button>

          <button
            type="button"
            className={`cat-pill-btn ${method === 'tarjeta' ? 'active' : ''}`}
            style={{ justifyContent: 'center' }}
            onClick={() => setMethod('tarjeta')}
          >
            <CreditCard size={16} />
            <span>Tarjeta / Débito</span>
          </button>
        </div>

        {/* EFECTIVO PANEL */}
        {method === 'efectivo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--bg-main)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Paga con cuánto dinero ($):</div>
            <input
              type="number"
              className="custom-input-sm"
              style={{ fontSize: '1.2rem', fontWeight: 800, padding: '0.6rem' }}
              placeholder={`Monto recibido (ej: ${cartTotal})`}
              value={cashPaid}
              onChange={e => setCashPaid(e.target.value)}
              autoFocus
            />

            {/* Quick Cash Buttons */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                className="qty-btn" 
                style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                onClick={() => setCashPaid(cartTotal.toString())}
              >
                Exacto
              </button>
              {[1000, 2000, 5000, 10000, 20000].map(val => (
                <button
                  key={val}
                  type="button"
                  className="qty-btn"
                  style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                  onClick={() => setCashPaid(val.toString())}
                >
                  ${val.toLocaleString('es-AR')}
                </button>
              ))}
            </div>

            {numCashPaid >= cartTotal && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-active)' }}>
                <span style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>VUELTO A ENTREGAR:</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-emerald)' }}>
                  ${cashChange.toLocaleString('es-AR')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* TRANSFERENCIA PANEL */}
        {method === 'transferencia' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--bg-main)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ALIAS MERCADO PAGO / BANCO:</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                  {settings?.alias || 'BURGER.CHAMICAL.MP'}
                </div>
              </div>
              <button 
                type="button"
                className="qty-btn"
                style={{ width: 'auto', padding: '0.4rem 0.75rem', gap: '4px' }}
                onClick={copyAlias}
              >
                <Copy size={14} />
                <span>{copiedAlias ? '¡Copiado!' : 'Copiar'}</span>
              </button>
            </div>

            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                Nro. de Comprobante / Transacción (Opcional):
              </div>
              <input
                type="text"
                className="custom-input-sm"
                placeholder="Ej: 948271842 o Nombre del Titular"
                value={transferProof}
                onChange={e => setTransferProof(e.target.value)}
              />
            </div>

            {/* Toggle de Acreditación */}
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem', 
              background: transferConfirmed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: transferConfirmed ? '1px solid var(--accent-emerald)' : '1px solid var(--accent-rose)',
              padding: '0.75rem', 
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={transferConfirmed}
                onChange={e => setTransferConfirmed(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: 'var(--accent-emerald)' }}
              />
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: transferConfirmed ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                  {transferConfirmed ? '✅ Transferencia Acreditada en Cuenta' : '⚠️ Transferencia Pendiente / No Acreditada'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {transferConfirmed ? 'El dinero ya impactó. Listo para despachar.' : 'Verifica en la app bancaria antes de entregar.'}
                </div>
              </div>
            </label>
          </div>
        )}

        {/* TARJETA PANEL */}
        {method === 'tarjeta' && (
          <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <CreditCard size={32} style={{ color: 'var(--accent-blue)', margin: '0 auto 0.5rem' }} />
            <div style={{ fontWeight: 700, color: '#fff' }}>Cobro con Posnet / Lector de Tarjetas</div>
            <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Pase la tarjeta por la terminal de cobro y confirme.</div>
          </div>
        )}

        {/* Auto Print Checkbox */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={autoPrint}
            onChange={e => setAutoPrint(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: 'var(--accent-amber)' }}
          />
          <Printer size={16} style={{ color: 'var(--accent-amber)' }} />
          <span>Imprimir automáticamente tickets térmicos (Cocina + Cliente)</span>
        </label>

        {/* Confirm Button */}
        <button 
          className="btn-confirm-order"
          onClick={handleFinalize}
        >
          <CheckCircle size={20} />
          <span>Confirmar Venta y Enviar a Cocina</span>
        </button>
      </div>
    </div>
  );
}
