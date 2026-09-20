import React, { useState } from 'react';
import { 
  X, 
  DollarSign, 
  CreditCard, 
  Send, 
  Copy, 
  CheckCircle2, 
  Printer, 
  AlertCircle 
} from 'lucide-react';
import { toastService } from '../../services/toastService';

export default function PaymentModal({ 
  total, 
  customer, 
  channel, 
  settings, 
  onConfirm, 
  onClose 
}) {
  const [method, setMethod] = useState('efectivo'); // 'efectivo' | 'transferencia' | 'tarjeta'
  const [cashTendered, setCashTendered] = useState(total.toString());
  const [transferVerified, setTransferVerified] = useState(false);
  const [transferRef, setTransferRef] = useState('');
  const [cardRef, setCardRef] = useState('');

  const alias = settings?.bankAlias || 'burgas.fast.mp';

  // Fast cash presets
  const fastCashPresets = [
    { label: 'Exacto', value: total },
    { label: '$20.000', value: 20000 },
    { label: '$15.000', value: 15000 },
    { label: '$10.000', value: 10000 },
    { label: '$5.000', value: 5000 },
    { label: '$2.000', value: 2000 },
  ].filter(p => p.value >= total || p.label === 'Exacto');

  const cashNumber = parseFloat(cashTendered) || 0;
  const change = Math.max(0, cashNumber - total);

  const handleCopyAlias = () => {
    navigator.clipboard.writeText(alias);
    toastService.success(`Alias '${alias}' copiado al portapapeles 📋`);
  };

  const handleComplete = () => {
    if (method === 'efectivo' && cashNumber < total) {
      toastService.error('El monto entregado en efectivo es menor al total.');
      return;
    }

    onConfirm({
      paymentMethod: method,
      cashTendered: method === 'efectivo' ? cashNumber : null,
      change: method === 'efectivo' ? change : 0,
      transferVerified: method === 'transferencia' ? transferVerified : false,
      transferRef: method === 'transferencia' ? transferRef : null,
      cardRef: method === 'tarjeta' ? cardRef : null
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <DollarSign size={22} style={{ color: 'var(--accent-emerald)' }} />
            <span>Cobro & Método de Pago</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body-scroll">
          {/* TOTAL BANNER */}
          <div 
            style={{ 
              background: 'rgba(10, 15, 26, 0.7)', 
              border: '1px solid var(--border-card)', 
              borderRadius: 'var(--radius-md)', 
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Total de la Comanda:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.75rem', fontWeight: 900, color: 'var(--accent-emerald)' }}>
              ${total.toLocaleString('es-AR')}
            </span>
          </div>

          {/* PAYMENT METHODS SELECTOR */}
          <div className="payment-methods-grid">
            <div 
              className={`payment-method-card ${method === 'efectivo' ? 'active' : ''}`}
              onClick={() => setMethod('efectivo')}
            >
              <DollarSign size={24} />
              <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>Efectivo</span>
            </div>

            <div 
              className={`payment-method-card ${method === 'transferencia' ? 'active' : ''}`}
              onClick={() => setMethod('transferencia')}
            >
              <Send size={24} />
              <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>Transferencia</span>
            </div>

            <div 
              className={`payment-method-card ${method === 'tarjeta' ? 'active' : ''}`}
              onClick={() => setMethod('tarjeta')}
            >
              <CreditCard size={24} />
              <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>Tarjeta / POS</span>
            </div>
          </div>

          {/* METHOD: CASH */}
          {method === 'efectivo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Billetes Rápidos Recibidos:</label>
                <div className="quick-bills-grid">
                  {fastCashPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="quick-bill-btn"
                      onClick={() => setCashTendered(preset.value.toString())}
                    >
                      {preset.label === 'Exacto' ? 'Exacto' : `$${preset.value.toLocaleString('es-AR')}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Efectivo Recibido ($):</label>
                <input 
                  type="number"
                  className="form-input"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 800, textAlign: 'right' }}
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="change-display-box">
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Vuelto al Cliente:</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {cashNumber >= total ? 'Entregar cambio' : 'Falta dinero'}
                  </div>
                </div>
                <div className="change-amount">
                  ${change.toLocaleString('es-AR')}
                </div>
              </div>
            </div>
          )}

          {/* METHOD: TRANSFER */}
          {method === 'transferencia' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div 
                style={{ 
                  background: 'rgba(56, 189, 248, 0.08)', 
                  border: '1px solid rgba(56, 189, 248, 0.25)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 700 }}>ALIAS BANCARIO / CVU:</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 900 }}>{alias}</div>
                </div>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={handleCopyAlias}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.4rem 0.75rem' }}
                >
                  <Copy size={15} />
                  <span>Copiar</span>
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Comprobante / Nro Transacción (Opcional):</label>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="Ej: Op #847291 o últimos 4 dígitos"
                  value={transferRef}
                  onChange={(e) => setTransferRef(e.target.value)}
                />
              </div>

              <label 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.65rem', 
                  padding: '0.75rem', 
                  background: transferVerified ? 'rgba(16, 185, 129, 0.15)' : 'rgba(10, 15, 26, 0.6)',
                  border: `1px solid ${transferVerified ? 'var(--accent-emerald)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <input 
                  type="checkbox"
                  checked={transferVerified}
                  onChange={(e) => setTransferVerified(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent-emerald)' }}
                />
                <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>
                  Comprobante visto y acreditación verificada en cuenta
                </div>
              </label>
            </div>
          )}

          {/* METHOD: CARD */}
          {method === 'tarjeta' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Número de Cupón / Referencia POS:</label>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="Ej: Lote 12 / Cupón 4492"
                  value={cardRef}
                  onChange={(e) => setCardRef(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button 
            className="btn-primary" 
            onClick={handleComplete}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.75rem 1.5rem', background: 'var(--accent-emerald)', color: '#000' }}
          >
            <Printer size={18} />
            <span>Confirmar e Imprimir Comanda</span>
          </button>
        </div>
      </div>
    </div>
  );
}
