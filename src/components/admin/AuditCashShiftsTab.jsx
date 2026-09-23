import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Download, ArrowUpRight } from 'lucide-react';

export default function AuditCashShiftsTab({ shifts, onExportCsv }) {
  const [expandedShiftId, setExpandedShiftId] = useState(null);
  const formatMoney = (n) => '$' + Number(n || 0).toLocaleString('es-AR');

  const toggleExpand = (id) => {
    setExpandedShiftId(prev => (prev === id ? null : id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Auditoría de Cajas y Arqueos Ciegos</span>
            <span style={{ fontSize: '0.72rem', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 800 }}>
              {shifts.length} {shifts.length === 1 ? 'Turno' : 'Turnos'}
            </span>
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Control histórico de fondos iniciales, ventas en efectivo y discrepancias detectadas al cierre.
          </p>
        </div>

        <button
          type="button"
          className="qty-btn tactile-btn"
          style={{ width: 'auto', padding: '0.5rem 0.95rem', fontSize: '0.82rem', gap: '6px' }}
          onClick={onExportCsv}
        >
          <Download size={15} />
          <span>Exportar Turnos CSV</span>
        </button>
      </div>

      {shifts.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', padding: '3rem 1.5rem', borderRadius: 'var(--radius-lg)', textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
          No hay registros de turnos de caja cerrados todavía.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {shifts.map(shift => {
            const isExpanded = expandedShiftId === shift.id;
            const diff = Number(shift.difference) || 0;
            const isExact = diff === 0;
            const isShortage = diff < 0; // Faltante
            const isSurplus = diff > 0; // Sobrante
            const totalExp = (shift.expenses || []).reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

            return (
              <div
                key={shift.id}
                className="tactile-card"
                style={{
                  background: 'var(--bg-card)',
                  border: isShortage ? '1px solid rgba(239, 68, 68, 0.35)' : isExact ? '1px solid var(--border-subtle)' : '1px solid rgba(245, 158, 11, 0.35)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)'
                }}
              >
                {/* Main Shift Row Header */}
                <div
                  onClick={() => toggleExpand(shift.id)}
                  style={{
                    padding: '0.9rem 1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    background: isShortage ? 'rgba(239, 68, 68, 0.04)' : 'transparent'
                  }}
                >
                  {/* Top line: Cashier info & Chevron */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: isShortage ? 'rgba(239, 68, 68, 0.15)' : isExact ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: isShortage ? 'var(--accent-rose)' : isExact ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isShortage ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
                      </div>

                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          Turno: {shift.cashierName || 'Cajero'}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {shift.openedAt ? new Date(shift.openedAt).toLocaleDateString('es-AR') : ''} • {shift.openedAt ? new Date(shift.openedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''} {shift.closedAt ? `a ${new Date(shift.closedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : '(Abierto)'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {/* Desktop only discrepancy badge */}
                      <div className="desktop-only-action" style={{
                        padding: '0.3rem 0.75rem',
                        borderRadius: 'var(--radius-full)',
                        fontWeight: 900,
                        fontSize: '0.78rem',
                        background: isExact ? 'rgba(16, 185, 129, 0.15)' : isShortage ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: isExact ? 'var(--accent-emerald)' : isShortage ? 'var(--accent-rose)' : 'var(--accent-amber)',
                        border: `1px solid ${isExact ? 'rgba(16, 185, 129, 0.3)' : isShortage ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
                      }}>
                        {isExact ? '✅ EXACTO' : isShortage ? `⚠️ FALTANTE ${formatMoney(diff)}` : `🟢 SOBRANTE +${formatMoney(diff)}`}
                      </div>

                      <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>

                  {/* Responsive Metrics Bar */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.5rem',
                    background: 'var(--bg-main)',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>FONDO + VENTAS</div>
                      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {formatMoney((shift.initialCash || 0) + (shift.cashSales || 0))}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>DECLARADO (CIEGO)</div>
                      <div style={{ fontWeight: 900, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {formatMoney(shift.countedCash)}
                      </div>
                    </div>

                    {/* Mobile visible status badge */}
                    <div className="mobile-only-action" style={{ display: 'none', alignItems: 'center' }}>
                      <span style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: 'var(--radius-full)',
                        fontWeight: 900,
                        fontSize: '0.74rem',
                        background: isExact ? 'rgba(16, 185, 129, 0.15)' : isShortage ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: isExact ? 'var(--accent-emerald)' : isShortage ? 'var(--accent-rose)' : 'var(--accent-amber)',
                        border: `1px solid ${isExact ? 'rgba(16, 185, 129, 0.3)' : isShortage ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
                      }}>
                        {isExact ? '✅ EXACTO' : isShortage ? `⚠️ ${formatMoney(diff)}` : `🟢 +${formatMoney(diff)}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '1rem', background: 'var(--bg-main)' }}>
                    <div className="shift-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.65rem', marginBottom: '0.75rem' }}>
                      <div style={{ background: 'var(--bg-card)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Fondo Inicial:</span>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{formatMoney(shift.initialCash)}</div>
                      </div>
                      <div style={{ background: 'var(--bg-card)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Ventas Efectivo:</span>
                        <div style={{ fontWeight: 800, color: 'var(--accent-emerald)', fontSize: '0.9rem' }}>+{formatMoney(shift.cashSales)}</div>
                      </div>
                      <div style={{ background: 'var(--bg-card)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Egresos Caja Chica:</span>
                        <div style={{ fontWeight: 800, color: 'var(--accent-rose)', fontSize: '0.9rem' }}>-{formatMoney(totalExp)}</div>
                      </div>
                      <div style={{ background: 'var(--bg-card)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Teórico Esperado:</span>
                        <div style={{ fontWeight: 900, color: 'var(--accent-amber)', fontSize: '0.9rem' }}>{formatMoney(shift.expectedCash)}</div>
                      </div>
                    </div>

                    {shift.notes && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.22)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem' }}>
                        <strong style={{ color: 'var(--accent-amber)' }}>Nota de Cierre:</strong> "{shift.notes}"
                      </div>
                    )}

                    {/* Expenses detail */}
                    {shift.expenses && shift.expenses.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
                          Retiros / Gastos de Caja Chica ({shift.expenses.length}):
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {shift.expenses.map(e => (
                            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', background: 'var(--bg-card)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                              <span>• {e.reason} <span style={{ color: 'var(--text-muted)' }}>({new Date(e.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs)</span></span>
                              <strong style={{ color: 'var(--accent-rose)' }}>-{formatMoney(e.amount)}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
