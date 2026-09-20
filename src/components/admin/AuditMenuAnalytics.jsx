import React from 'react';
import { Trophy, TrendingDown, Sparkles } from 'lucide-react';

export default function AuditMenuAnalytics({ analytics }) {
  const formatMoney = (n) => '$' + Number(n || 0).toLocaleString('es-AR');
  const { topByQty = [], topByRevenue = [], topModifiers = [] } = analytics || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* TOP PRODUCTOS POR UNIDADES */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={18} style={{ color: 'var(--accent-amber)' }} />
            <span>Top Productos Más Vendidos (Volumen)</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {topByQty.slice(0, 7).map((prod, idx) => (
              <div key={prod.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 900, color: idx === 0 ? 'var(--accent-amber)' : 'var(--text-muted)', width: '20px' }}>
                    #{idx + 1}
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{prod.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatMoney(prod.total)} recaudados</div>
                  </div>
                </div>
                <div style={{ fontWeight: 900, color: 'var(--accent-amber)', fontSize: '1.05rem' }}>
                  {prod.qty} <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>u.</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TOP MODIFICADORES Y ADICIONALES */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: 'var(--accent-emerald)' }} />
            <span>Adicionales & Modificadores Populares</span>
          </div>

          {topModifiers.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              No hay modificadores pedidos en este período.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {topModifiers.slice(0, 7).map((mod, idx) => (
                <div key={mod.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800, color: 'var(--accent-emerald)' }}>✦</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{mod.name}</span>
                  </div>
                  <span style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                    {mod.count} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>veces</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
