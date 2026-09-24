import React, { useState, useEffect } from 'react';
import { X, DollarSign, ArrowDownRight, CheckCircle2, AlertTriangle, Printer, Lock, Unlock, User, RotateCcw } from 'lucide-react';
import { authService } from '../../services/authService';
import { storageService } from '../../services/storageService';
import { supabaseSync } from '../../services/supabaseClient';

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

  // Estado para reinicio de contador de órdenes
  const [resetOrderCounterOnOpen, setResetOrderCounterOnOpen] = useState(true);
  const [currentOrderCounter, setCurrentOrderCounter] = useState(() => storageService.getOrderCounter());
  const [isResettingNow, setIsResettingNow] = useState(false);
  const [resetFeedback, setResetFeedback] = useState(null);

  useEffect(() => {
    const updateCounter = () => setCurrentOrderCounter(storageService.getOrderCounter());
    window.addEventListener('comandafast:order-counter-reset', updateCounter);
    window.addEventListener('comandafast:new-order', updateCounter);
    return () => {
      window.removeEventListener('comandafast:order-counter-reset', updateCounter);
      window.removeEventListener('comandafast:new-order', updateCounter);
    };
  }, []);

  const handleDirectResetCounter = async () => {
    if (window.confirm('¿Deseas reiniciar la numeración de pedidos a cero (0) ahora? El próximo pedido en cualquier terminal o app móvil comenzará en #1.')) {
      setIsResettingNow(true);
      const nowIso = new Date().toISOString();
      storageService.resetOrderCounter(0, nowIso);
      setCurrentOrderCounter(0);
      try {
        if (typeof supabaseSync !== 'undefined' && supabaseSync.pushOrderCounterState) {
          await supabaseSync.pushOrderCounterState({ counter: 0, lastResetAt: nowIso });
        }
      } catch (_) {}
      try {
        const botHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
        fetch(`http://${botHost}:3002/api/order-counter/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ counter: 0, lastResetAt: nowIso })
        }).catch(() => {});
      } catch (_) {}
      setIsResettingNow(false);
      setResetFeedback('✅ Contador reiniciado a 0. Próxima orden: #1.');
      setTimeout(() => setResetFeedback(null), 4000);
    }
  };

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
    onOpenShift(initialCashInput, resolvedName, resetOrderCounterOnOpen);
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

            {/* Opción y Botón de Reinicio de Contador de Pedidos a 0 */}
            <div style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem'
            }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={resetOrderCounterOnOpen}
                  onChange={e => setResetOrderCounterOnOpen(e.target.checked)}
                  style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--accent-amber)', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RotateCcw size={15} style={{ color: 'var(--accent-amber)' }} />
                    <span>Reiniciar pedidos a cero (#1) al abrir esta caja</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
                    El próximo pedido comenzará en #1 y se sincronizará automáticamente en la nube (Supabase) para que todas las demás instancias y celulares continúen esa numeración.
                  </div>
                </div>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-subtle)', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Contador actual en sistema: <strong>#{currentOrderCounter}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleDirectResetCounter}
                  disabled={isResettingNow}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '0.35rem 0.75rem',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid var(--accent-amber)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--accent-amber)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  title="Reiniciar contador a 0 de inmediato y sincronizar con la base de datos"
                >
                  <RotateCcw size={12} className={isResettingNow ? 'animate-spin' : ''} />
                  <span>{isResettingNow ? 'Sincronizando...' : 'Reiniciar a 0 ahora'}</span>
                </button>
              </div>

              {resetFeedback && (
                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--accent-emerald)',
                  background: 'rgba(16, 185, 129, 0.12)',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                  {resetFeedback}
                </div>
              )}
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

            {/* Control de Numeración de Pedidos del Turno Activo */}
            <div style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap'
            }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <RotateCcw size={15} style={{ color: 'var(--accent-amber)' }} />
                  <span>Numeración de Pedidos:</span>
                  <span style={{ color: 'var(--accent-amber)' }}>#{currentOrderCounter}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Próxima orden: #{currentOrderCounter + 1})</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Sincronizado con Supabase Cloud. Puedes reiniciar el contador a 0 para que la próxima comanda sea la #1.
                </div>
              </div>
              <button
                type="button"
                onClick={handleDirectResetCounter}
                disabled={isResettingNow}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.45rem 0.85rem',
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid var(--accent-amber)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--accent-amber)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <RotateCcw size={13} className={isResettingNow ? 'animate-spin' : ''} />
                <span>{isResettingNow ? 'Sincronizando...' : 'Reiniciar a 0 ahora'}</span>
              </button>
            </div>
            {resetFeedback && (
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--accent-emerald)',
                background: 'rgba(16, 185, 129, 0.12)',
                padding: '0.4rem 0.6rem',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                {resetFeedback}
              </div>
            )}

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
