import React, { useState } from 'react';
import { X, DollarSign, ArrowDownRight, CheckCircle2, AlertTriangle, Printer, Lock, Unlock, User } from 'lucide-react';
import { authService } from '../../services/authService';

export default function CashControlModal({ 
  cashShift, 
  orders, 
  currentCashier,
  onOpenShift, 
  onAddExpense, 
  onCloseShift, 
  onClose 
}) {
  const activeCashier = currentCashier || authService.getCurrentCashier();
  const [initialCashInput, setInitialCashInput] = useState('');
  const [cashierNameInput, setCashierNameInput] = useState(activeCashier?.name || 'Cajero 1');
  
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseReason, setExpenseReason] = useState('');

  const [countedCashInput, setCountedCashInput] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [isClosingConfirm, setIsClosingConfirm] = useState(false);

  // Calculate totals for active shift
  const shiftOrders = orders.filter(o => {
    if (!cashShift || cashShift.isClosed) return false;
    return new Date(o.createdAt) >= new Date(cashShift.openedAt);
  });

  const cashSales = shiftOrders
    .filter(o => o.paymentMethod === 'efectivo' && o.status !== 'cancelado')
    .reduce((acc, o) => acc + o.total, 0);

  const transferSales = shiftOrders
    .filter(o => o.paymentMethod === 'transferencia' && o.status !== 'cancelado')
    .reduce((acc, o) => acc + o.total, 0);

  const cardSales = shiftOrders
    .filter(o => o.paymentMethod === 'tarjeta' && o.status !== 'cancelado')
    .reduce((acc, o) => acc + o.total, 0);

  const totalExpenses = (cashShift?.expenses || []).reduce((acc, e) => acc + e.amount, 0);

  const expectedCashInDrawer = (cashShift?.initialCash || 0) + cashSales - totalExpenses;
  const totalShiftRevenue = cashSales + transferSales + cardSales;

  const countedCashNum = parseFloat(countedCashInput) || 0;
  const cashDifference = countedCashNum - expectedCashInDrawer;

  const handleOpen = () => {
    if (!initialCashInput && initialCashInput !== '0') {
      alert('Ingresa el monto de fondo de caja inicial.');
      return;
    }
    const resolvedName = activeCashier?.name || cashierNameInput.trim() || 'Cajero 1';
    onOpenShift(initialCashInput, resolvedName);
  };

  const handleAddExpense = (e) => {
    e.preventDefault();
    if (!expenseAmount || !expenseReason) {
      alert('Completa el monto y motivo del retiro de caja.');
      return;
    }
    onAddExpense(expenseAmount, expenseReason.trim());
    setExpenseAmount('');
    setExpenseReason('');
  };

  const handleCloseShift = () => {
    if (!countedCashInput && countedCashInput !== '0') {
      alert('Ingresa el dinero físico contado en caja para hacer el arqueo.');
      return;
    }
    onCloseShift(countedCashNum, closeNotes);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <DollarSign size={24} style={{ color: 'var(--accent-amber)' }} />
            <span>Control de Caja & Arqueo de Turno</span>
          </div>
          <button className="btn-close-modal" onClick={onClose}><X size={20} /></button>
        </div>

        {/* IF SHIFT IS CLOSED -> OPEN FORM */}
        {!cashShift || cashShift.isClosed ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--accent-rose)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <Lock size={28} style={{ color: 'var(--accent-rose)' }} />
              <div>
                <div style={{ fontWeight: 800, color: 'var(--accent-rose)' }}>LA CAJA SE ENCUENTRA CERRADA</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Abre un nuevo turno de caja para comenzar a facturar y registrar movimientos.</div>
              </div>
            </div>

            {/* Si ya hay un cajero logueado con su cuenta, se asigna automáticamente y se muestra solo como referencia */}
            {activeCashier ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.75rem', 
                background: 'var(--bg-main)', 
                padding: '0.75rem 1rem', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--border-subtle)' 
              }}>
                <div style={{ 
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '50%', 
                  background: 'rgba(245, 158, 11, 0.15)', 
                  color: 'var(--accent-amber)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <User size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Cajero Responsable (Automático)
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {activeCashier.name} {activeCashier.username ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>(@{activeCashier.username})</span> : ''}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Nombre de Cajero / Turno:</label>
                <input
                  type="text"
                  className="custom-input-sm"
                  placeholder="Ej: Turno Noche - Martín"
                  value={cashierNameInput}
                  onChange={e => setCashierNameInput(e.target.value)}
                />
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Fondo Inicial de Caja ($ Efectivo):</label>
              <input
                type="number"
                className="custom-input-sm"
                style={{ fontSize: '1.2rem', fontWeight: 800, padding: '0.6rem', marginTop: '4px' }}
                placeholder="Ej: 5000"
                value={initialCashInput}
                onChange={e => setInitialCashInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleOpen();
                  }
                }}
                autoFocus
              />
            </div>

            <button 
              className="btn-confirm-order"
              style={{ background: 'var(--accent-emerald)', color: '#000' }}
              onClick={handleOpen}
            >
              <Unlock size={20} />
              <span>Abrir Turno de Caja</span>
            </button>
          </div>
        ) : (
          /* IF SHIFT IS OPEN -> LIVE DASHBOARD & CLOSE */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Shift Info Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TURNO ACTIVO:</div>
                <div style={{ fontWeight: 800, color: 'var(--accent-emerald)' }}>{cashShift.cashierName}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>APERTURA:</div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {new Date(cashShift.openedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} ({new Date(cashShift.openedAt).toLocaleDateString('es-AR')})
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ background: 'var(--bg-main)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>FONDO INICIAL:</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>${cashShift.initialCash.toLocaleString('es-AR')}</div>
              </div>

              <div style={{ background: 'var(--bg-main)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>VENTAS EN EFECTIVO:</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent-emerald)' }}>+${cashSales.toLocaleString('es-AR')}</div>
              </div>

              <div style={{ background: 'var(--bg-main)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>TRANSFERENCIAS ACREDITADAS:</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#60a5fa' }}>${transferSales.toLocaleString('es-AR')}</div>
              </div>

              <div style={{ background: 'var(--bg-main)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>VENTAS CON TARJETA:</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#c084fc' }}>${cardSales.toLocaleString('es-AR')}</div>
              </div>
            </div>

            {/* Cash in Drawer Calculated */}
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--accent-amber)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-amber)', fontWeight: 800 }}>EFECTIVO TEÓRICO EN CAJÓN:</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(Fondo Inicial + Efectivo Cobrado - Egresos)</div>
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-amber)', fontFamily: 'var(--font-heading)' }}>
                ${expectedCashInDrawer.toLocaleString('es-AR')}
              </div>
            </div>

            {/* Quick Expense Form */}
            <form onSubmit={handleAddExpense} style={{ background: 'var(--bg-main)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-rose)' }}>Registrar Retiro / Gasto de Caja:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 100px', gap: '0.4rem' }}>
                <input 
                  type="number"
                  className="custom-input-sm"
                  placeholder="Monto ($)"
                  value={expenseAmount}
                  onChange={e => setExpenseAmount(e.target.value)}
                />
                <input 
                  type="text"
                  className="custom-input-sm"
                  placeholder="Motivo (ej: hielo, panadería...)"
                  value={expenseReason}
                  onChange={e => setExpenseReason(e.target.value)}
                />
                <button type="submit" className="qty-btn" style={{ width: '100%', height: 'auto', background: 'var(--accent-rose)', color: '#fff', border: 'none', fontSize: '0.8rem' }}>
                  Retirar
                </button>
              </div>

              {cashShift.expenses && cashShift.expenses.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Egresos del turno: {cashShift.expenses.map(e => `-$${e.amount} (${e.reason})`).join(', ')} (Total: -${totalExpenses})
                </div>
              )}
            </form>

            {/* Close Shift Accordion / Form */}
            {!isClosingConfirm ? (
              <button 
                type="button"
                className="btn-kds-action to-done"
                style={{ background: 'var(--accent-rose)', color: '#fff' }}
                onClick={() => setIsClosingConfirm(true)}
              >
                <Lock size={18} />
                <span>Proceder al Cierre de Turno y Arqueo</span>
              </button>
            ) : (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--accent-rose)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontWeight: 800, color: 'var(--accent-rose)' }}>ARQUEO DE CAJA FINAL</div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Dinero Físico Real Contado en Cajón ($):</label>
                  <input
                    type="number"
                    className="custom-input-sm"
                    style={{ fontSize: '1.2rem', fontWeight: 800, padding: '0.5rem', marginTop: '4px' }}
                    placeholder={`Esperado: ${expectedCashInDrawer}`}
                    value={countedCashInput}
                    onChange={e => setCountedCashInput(e.target.value)}
                    autoFocus
                  />
                </div>

                {countedCashInput !== '' && (
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: cashDifference === 0 ? 'var(--accent-emerald)' : cashDifference > 0 ? '#60a5fa' : 'var(--accent-rose)' }}>
                    {cashDifference === 0 ? '✅ Cuadre Exacto (Sin diferencias)' :
                     cashDifference > 0 ? `Sobran: +$${cashDifference.toLocaleString('es-AR')}` :
                     `Faltan: -$${Math.abs(cashDifference).toLocaleString('es-AR')}`}
                  </div>
                )}

                <input
                  type="text"
                  className="custom-input-sm"
                  placeholder="Notas de cierre (Opcional)"
                  value={closeNotes}
                  onChange={e => setCloseNotes(e.target.value)}
                />

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    type="button" 
                    className="btn-confirm-order"
                    style={{ background: 'var(--accent-rose)', color: '#fff' }}
                    onClick={handleCloseShift}
                  >
                    Confirmar Cierre de Turno
                  </button>
                  <button 
                    type="button" 
                    className="qty-btn"
                    style={{ width: 'auto', padding: '0.5rem 1rem' }}
                    onClick={() => setIsClosingConfirm(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
