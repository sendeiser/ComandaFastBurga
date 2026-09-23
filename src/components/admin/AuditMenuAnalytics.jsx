import React from 'react';
import { Trophy, Sparkles } from 'lucide-react';

export default function AuditMenuAnalytics({ analytics }) {
  const formatMoney = (n) => '$' + Number(n || 0).toLocaleString('es-AR');
  const { topByQty = [], topModifiers = [] } = analytics || {};

  const maxQty = topByQty.length > 0 ? Math.max(...topByQty.map(p => p.qty || 1)) : 1;
  const maxMod = topModifiers.length > 0 ? Math.max(...topModifiers.map(m => m.count || 1)) : 1;

  const getRankBadge = (idx) => {
    if (idx === 0) return { label: '🥇 #1', color: 'var(--accent-amber)', bg: 'rgba(245, 158, 11, 0.15)' };
    if (idx === 1) return { label: '🥈 #2', color: '#cbd5e1', bg: 'rgba(203, 213, 225, 0.15)' };
    if (idx === 2) return { label: '🥉 #3', color: '#d97706', bg: 'rgba(217, 119, 6, 0.15)' };
    return { label: `#${idx + 1}`, color: 'var(--text-muted)', bg: 'transparent' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {/* TOP PRODUCTOS POR UNIDADES */}
        <div 
          className="tactile-card"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}
        >
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trophy size={18} style={{ color: 'var(--accent-amber)' }} />
              <span>Top Productos Más Vendidos</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>POR VOLUMEN</span>
          </div>

          {topByQty.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              No hay ventas registradas en el período seleccionado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {topByQty.slice(0, 7).map((prod, idx) => {
                const rank = getRankBadge(idx);
                const percent = Math.min(100, Math.round((prod.qty / maxQty) * 100));

                return (
                  <div 
                    key={prod.name} 
                    style={{ 
                      background: 'var(--bg-main)', 
                      padding: '0.75rem 0.95rem', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--border-subtle)' 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          fontWeight: 900, 
                          color: rank.color, 
                          background: rank.bg,
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '0.8rem',
                          minWidth: '28px',
                          textAlign: 'center'
                        }}>
                          {rank.label}
                        </span>
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{prod.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatMoney(prod.total)} recaudados</div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 900, color: 'var(--accent-amber)', fontSize: '1.05rem', fontFamily: 'var(--font-heading)' }}>
                        {prod.qty} <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>u.</span>
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${percent}%`, height: '100%', background: idx === 0 ? 'var(--amber-gradient)' : 'var(--accent-amber)', borderRadius: '2px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* TOP MODIFICADORES Y ADICIONALES */}
        <div 
          className="tactile-card"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}
        >
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} style={{ color: 'var(--accent-emerald)' }} />
              <span>Adicionales & Modificadores</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>FRECUENCIA</span>
          </div>

          {topModifiers.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              No hay modificadores pedidos en este período.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {topModifiers.slice(0, 7).map((mod, idx) => {
                const percent = Math.min(100, Math.round((mod.count / maxMod) * 100));

                return (
                  <div 
                    key={mod.name} 
                    style={{ 
                      background: 'var(--bg-main)', 
                      padding: '0.75rem 0.95rem', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--border-subtle)' 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, color: 'var(--accent-emerald)' }}>✦</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{mod.name}</span>
                      </div>
                      <span style={{ fontWeight: 900, color: 'var(--accent-emerald)', fontSize: '0.95rem', fontFamily: 'var(--font-heading)' }}>
                        {mod.count} <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>veces</span>
                      </span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${percent}%`, height: '100%', background: 'var(--accent-emerald)', borderRadius: '2px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
