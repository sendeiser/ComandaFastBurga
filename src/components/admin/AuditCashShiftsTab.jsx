import React, { useState } from 'react';
import { DollarSign, CheckCircle, AlertTriangle, AlertCircle, Calendar, User, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { auditService } from '../../services/auditService';

export default function AuditCashShiftsTab({ shifts, onExportCsv }) {
  const [expandedShiftId, setExpandedShiftId] = useState(null);
  const formatMoney = (n) => '$' + Number(n || 0).toLocaleString('es-AR');

  const toggleExpand = (id) => {
    setExpandedShiftId(prev => (prev === id ? null : id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Auditoría de Cajas y Arqueos Ciegos ({shifts.length} turnos)
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Control histórico de fondos iniciales, ventas en efectivo y discrepancias detectadas al cierre.
          </p>
        </div>

        <button
          type="button"
          className="qty-btn"
          style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          onClick={onExportCsv}
        >
          📥 Exportar Turnos a CSV
        </button>
      </div>

      {shifts.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', padding: '3rem', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-muted)' }}>
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
                style={{
                  background: 'var(--bg-card)',
                  border: isShortage ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  transition: 'all 0.2s'
                }}
              >
                {/* Main Shift Row Header */}
                <div
                  onClick={() => toggleExpand(shift.id)}
                  style={{
                    padding: '1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    background: isShortage ? 'rgba(239, 68, 68, 0.04)' : 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      background: isShortage ? 'rgba(239, 68, 68, 0.15)' : isExact ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: isShortage ? 'var(--accent-rose)' : isExact ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {isShortage ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                    </div>

                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        Turno: {shift.cashierName || 'Cajero'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {shift.openedAt ? new Date(shift.openedAt).toLocaleDateString('es-AR') : ''} • {shift.openedAt ? new Date(shift.openedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''} a {shift.closedAt ? new Date(shift.closedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'Abierto'}
                      </div>
                    </div>
                  </div>

                  {/* Numbers columns */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fondo + Ventas</div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {formatMoney((shift.initialCash || 0) + (shift.cashSales || 0))}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Declarado (Ciego)</div>
                      <div style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--text-primary)' }}>
                        {formatMoney(shift.countedCash)}
                      </div>
                    </div>

                    {/* Discrepancy Pill */}
                    <div style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: 'var(--radius-full)',
                      fontWeight: 900,
                      fontSize: '0.8rem',
                      background: isExact ? 'rgba(16, 185, 129, 0.15)' : isShortage ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: isExact ? 'var(--accent-emerald)' : isShortage ? 'var(--accent-rose)' : 'var(--accent-amber)',
                      border: `1px solid ${isExact ? 'rgba(16, 185, 129, 0.3)' : isShortage ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
                    }}>
                      {isExact ? '✅ EXACTO' : isShortage ? `⚠️ FALTANTE ${formatMoney(diff)}` : `🟢 SOBRANTE +${formatMoney(diff)}`}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '1rem', background: 'var(--bg-main)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fondo Inicial:</span>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{formatMoney(shift.initialCash)}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ventas Efvo Teóricas:</span>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{formatMoney(shift.cashSales)}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Egresos Caja Chica:</span>
                        <div style={{ fontWeight: 800, color: 'var(--accent-rose)' }}>-{formatMoney(totalExp)}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Efectivo Teórico Esperado:</span>
                        <div style={{ fontWeight: 900, color: 'var(--accent-amber)' }}>{formatMoney(shift.expectedCash)}</div>
                      </div>
                    </div>

                    {shift.notes && (
                      <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                        Nota del cajero: "{shift.notes}"
                      </div>
                    )}

                    {/* Expenses detail */}
                    {shift.expenses && shift.expenses.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                          Retiros / Gastos de Caja Chica ({shift.expenses.length}):
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {shift.expenses.map(e => (
                            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', background: 'var(--bg-card)', padding: '4px 8px', borderRadius: '4px' }}>
                              <span>• {e.reason} ({new Date(e.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs)</span>
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
