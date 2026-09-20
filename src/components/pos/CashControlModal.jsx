import React, { useState, useMemo } from 'react';
import { 
  X, 
  DollarSign, 
  Lock, 
  Unlock, 
  TrendingDown, 
  Calculator, 
  AlertTriangle, 
  CheckCircle2, 
  FileText 
} from 'lucide-react';
import { toastService } from '../../services/toastService';

export default function CashControlModal({ 
  cashShift, 
  orders, 
  onOpenShift, 
  onAddExpense, 
  onCloseShift, 
  onClose 
}) {
  const [initialCashInput, setInitialCashInput] = useState('10000');
  const [cashierName, setCashierName] = useState('Cajero Principal');

  // Expense form
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseReason, setExpenseReason] = useState('');

  // Bill counter state for cash counting
  const [billCounts, setBillCounts] = useState({
    20000: 0,
    10000: 0,
    2000: 0,
    1000: 0,
    500: 0,
    200: 0,
    100: 0
  });

  const [closeNotes, setCloseNotes] = useState('');

  // Calculate counted physical cash from bill counter
  const totalCountedCash = useMemo(() => {
    return Object.entries(billCounts).reduce((sum, [denom, count]) => {
      return sum + (Number(denom) * (Number(count) || 0));
    }, 0);
  }, [billCounts]);

  // Calculate sales from orders during shift
  const shiftMetrics = useMemo(() => {
    if (!cashShift || cashShift.isClosed) return { cashSales: 0, transferSales: 0, cardSales: 0, totalSales: 0 };

    const shiftOrders = orders.filter(o => {
      const oTime = new Date(o.createdAt).getTime();
      const sTime = new Date(cashShift.openedAt).getTime();
      return oTime >= sTime;
    });

    let cashSales = 0;
    let transferSales = 0;
    let cardSales = 0;

    shiftOrders.forEach(o => {
      if (o.paymentMethod === 'efectivo') cashSales += o.total;
      else if (o.paymentMethod === 'transferencia') transferSales += o.total;
      else if (o.paymentMethod === 'tarjeta') cardSales += o.total;
    });

    const totalExpenses = (cashShift.expenses || []).reduce((acc, e) => acc + e.amount, 0);
    const expectedCashInDrawer = cashShift.initialCash + cashSales - totalExpenses;

    return {
      cashSales,
      transferSales,
      cardSales,
      totalSales: cashSales + transferSales + cardSales,
      totalExpenses,
      expectedCashInDrawer,
      orderCount: shiftOrders.length
    };
  }, [cashShift, orders]);

  const cashDifference = totalCountedCash - (shiftMetrics.expectedCashInDrawer || 0);

  const handleOpen = () => {
    const val = parseFloat(initialCashInput) || 0;
    onOpenShift(val, cashierName);
    toastService.success(`Turno de caja abierto con $${val.toLocaleString('es-AR')}`);
    onClose();
  };

  const handleAddExpenseSubmit = () => {
    const amt = parseFloat(expenseAmount);
    if (!amt || amt <= 0 || !expenseReason) {
      toastService.warning('Ingresa un monto y motivo válido para el retiro de caja.');
      return;
    }
    onAddExpense(amt, expenseReason);
    setExpenseAmount('');
    setExpenseReason('');
    toastService.info(`Retiro de $${amt.toLocaleString('es-AR')} registrado`);
  };

  const handleCloseShiftSubmit = () => {
    if (totalCountedCash === 0) {
      if (!window.confirm('El monto de billetes contados es $0. ¿Confirmar cierre igualmente?')) return;
    }
    onCloseShift(totalCountedCash, closeNotes);
    toastService.success('Turno de caja cerrado con arqueo guardado 🔒');
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <DollarSign size={22} style={{ color: 'var(--accent-amber)' }} />
            <span>Control de Caja & Arqueo Ciego</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body-scroll">
          {/* CASE 1: NO OPEN SHIFT */}
          {(!cashShift || cashShift.isClosed) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1rem 0' }}>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={48} style={{ color: 'var(--accent-rose)' }} />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.35rem', fontWeight: 800 }}>
                  La Caja se Encuentra Cerrada
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Ingresa el fondo inicial de cambio en efectivo para comenzar a facturar.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Nombre del Responsable / Cajero:</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Fondo Inicial en Efectivo ($):</label>
                <input 
                  type="number" 
                  className="form-input"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '1.35rem', fontWeight: 800 }}
                  value={initialCashInput}
                  onChange={(e) => setInitialCashInput(e.target.value)}
                />
              </div>

              <button 
                type="button"
                className="btn-primary"
                style={{ padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={handleOpen}
              >
                <Unlock size={18} />
                <span>Abrir Turno de Caja</span>
              </button>
            </div>
          ) : (
            /* CASE 2: ACTIVE SHIFT */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* SHIFT SUMMARY CARDS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(10, 15, 26, 0.6)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Fondo Inicial:</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    ${cashShift.initialCash.toLocaleString('es-AR')}
                  </div>
                </div>

                <div style={{ background: 'rgba(10, 15, 26, 0.6)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)' }}>Ventas Efectivo:</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
                    ${shiftMetrics.cashSales.toLocaleString('es-AR')}
                  </div>
                </div>

                <div style={{ background: 'rgba(10, 15, 26, 0.6)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-blue)' }}>Transferencias:</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
                    ${shiftMetrics.transferSales.toLocaleString('es-AR')}
                  </div>
                </div>

                <div style={{ background: 'rgba(10, 15, 26, 0.6)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-rose)' }}>Gastos / Retiros:</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-rose)' }}>
                    -${shiftMetrics.totalExpenses.toLocaleString('es-AR')}
                  </div>
                </div>
              </div>

              {/* EXPENSE LOGGER */}
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingDown size={16} style={{ color: 'var(--accent-rose)' }} />
                  <span>Registrar Retiro de Caja / Gasto Vario</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="number"
                    className="form-input"
                    style={{ width: '130px', fontFamily: 'var(--font-mono)' }}
                    placeholder="Monto ($)"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                  />
                  <input 
                    type="text"
                    className="form-input"
                    style={{ flex: 1 }}
                    placeholder="Motivo (Ej: Compra de hielo, verdulería, flete)"
                    value={expenseReason}
                    onChange={(e) => setExpenseReason(e.target.value)}
                  />
                  <button type="button" className="btn-secondary" onClick={handleAddExpenseSubmit}>
                    Registrar
                  </button>
                </div>
              </div>

              {/* BILL COUNTER FOR BLIND AUDIT */}
              <div style={{ background: 'rgba(10, 15, 26, 0.6)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-amber)' }}>
                  <Calculator size={16} />
                  <span>Conteo Rápido de Billetes Físicos (Para Arqueo)</span>
                </div>

                <div className="bill-counter-grid">
                  {Object.keys(billCounts).reverse().map(denom => (
                    <div key={denom} className="bill-counter-row">
                      <span className="bill-label">${Number(denom).toLocaleString('es-AR')} x</span>
                      <input 
                        type="number"
                        min="0"
                        className="bill-input"
                        value={billCounts[denom] || ''}
                        placeholder="0"
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setBillCounts({ ...billCounts, [denom]: val });
                        }}
                      />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '70px', textAlign: 'right' }}>
                        = ${(Number(denom) * (billCounts[denom] || 0)).toLocaleString('es-AR')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* ARQUEO COMPARISON */}
                <div 
                  style={{ 
                    marginTop: '1rem', 
                    padding: '0.85rem', 
                    background: 'rgba(15, 23, 42, 0.8)', 
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Efectivo Contado:</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--accent-emerald)' }}>
                      ${totalCountedCash.toLocaleString('es-AR')}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Efectivo Esperado:</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.35rem', fontWeight: 800 }}>
                      ${shiftMetrics.expectedCashInDrawer.toLocaleString('es-AR')}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Diferencia:</div>
                    <div 
                      style={{ 
                        fontFamily: 'var(--font-mono)', 
                        fontSize: '1.35rem', 
                        fontWeight: 900, 
                        color: cashDifference === 0 ? 'var(--accent-emerald)' : (cashDifference > 0 ? 'var(--accent-blue)' : 'var(--accent-rose)') 
                      }}
                    >
                      {cashDifference > 0 ? `+$${cashDifference.toLocaleString('es-AR')} (Sobrante)` : 
                       (cashDifference < 0 ? `-$${Math.abs(cashDifference).toLocaleString('es-AR')} (Faltante)` : '$0 (Exacto)')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {cashShift && !cashShift.isClosed && (
          <div className="modal-footer">
            <button className="btn-secondary" onClick={onClose}>
              Cerrar Ventana
            </button>
            <button 
              className="btn-primary" 
              onClick={handleCloseShiftSubmit}
              style={{ background: 'var(--accent-rose)', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Lock size={16} />
              <span>Finalizar y Cerrar Turno de Caja</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
