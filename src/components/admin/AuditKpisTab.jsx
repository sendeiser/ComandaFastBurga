import React, { useState, useMemo } from 'react';
import { 
  DollarSign, ShoppingBag, TrendingUp, CreditCard, MessageSquare, 
  Utensils, CheckCircle2, Clock, ArrowUpRight, Calendar, Filter, 
  ChevronRight, Award, Zap, AlertTriangle, Layers, Percent, X, RefreshCw, BarChart2,
  Flame, Timer, ShieldCheck, ArrowDownRight, Truck
} from 'lucide-react';
import { auditService } from '../../services/auditService';

export default function AuditKpisTab({
  kpis,
  orders = [],
  allOrders = [],
  shifts = [],
  rangeType = 'today',
  setRangeType,
  selectedShiftId = 'all',
  setSelectedShiftId,
  selectedShift = null,
  customStart = '',
  setCustomStart,
  customEnd = '',
  setCustomEnd,
  onOpenBot
}) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [activeDonutSegment, setActiveDonutSegment] = useState(null);

  const formatMoney = (n) => '$' + Number(n || 0).toLocaleString('es-AR');

  const gross = kpis.grossRevenue || 0;
  const cashShare = gross > 0 ? Math.round(((kpis.payments?.cash?.total || 0) / gross) * 100) : 0;
  const transferShare = gross > 0 ? Math.round(((kpis.payments?.transfer?.total || 0) / gross) * 100) : 0;
  const cardShare = gross > 0 ? Math.round(((kpis.payments?.card?.total || 0) / gross) * 100) : 0;

  const waShare = gross > 0 ? Math.round(((kpis.channels?.whatsapp?.total || 0) / gross) * 100) : 0;
  const mostradorShare = gross > 0 ? Math.round(((kpis.channels?.mostrador?.total || 0) / gross) * 100) : 0;
  const mesaShare = gross > 0 ? Math.round(((kpis.channels?.mesa?.total || 0) / gross) * 100) : 0;

  // Analítica adicional
  const hourlyData = useMemo(() => {
    return auditService.getHourlyDistribution(orders);
  }, [orders]);

  const trendData = useMemo(() => {
    return auditService.getSalesTrend(orders, rangeType, Boolean(selectedShift));
  }, [orders, rangeType, selectedShift]);

  const productAnalytics = useMemo(() => {
    return auditService.getProductAnalytics(orders);
  }, [orders]);

  // SVG Trend Chart calculations
  const trendMaxRev = useMemo(() => {
    return Math.max(...trendData.map(d => d.revenue), 1000);
  }, [trendData]);

  const trendChartWidth = 720;
  const trendChartHeight = 220;
  const chartPadding = { left: 60, right: 35, top: 25, bottom: 35 };

  const trendPoints = useMemo(() => {
    const usableW = trendChartWidth - chartPadding.left - chartPadding.right;
    const usableH = trendChartHeight - chartPadding.top - chartPadding.bottom;
    const len = trendData.length;

    return trendData.map((d, i) => {
      const x = chartPadding.left + (len === 1 ? usableW / 2 : (i / (len - 1)) * usableW);
      const y = chartPadding.top + usableH - (d.revenue / trendMaxRev) * usableH;
      return { ...d, x, y };
    });
  }, [trendData, trendMaxRev]);

  const trendPathD = useMemo(() => {
    if (trendPoints.length === 0) return '';
    if (trendPoints.length === 1) {
      return `M ${chartPadding.left} ${trendPoints[0].y} L ${trendChartWidth - chartPadding.right} ${trendPoints[0].y}`;
    }
    return trendPoints.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      // Curva suave cúbica
      const prev = trendPoints[i - 1];
      const cx1 = prev.x + (pt.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (pt.x - prev.x) / 2;
      const cy2 = pt.y;
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
    }, '');
  }, [trendPoints]);

  const trendAreaD = useMemo(() => {
    if (!trendPathD || trendPoints.length === 0) return '';
    const bottomY = trendChartHeight - chartPadding.bottom;
    const firstX = trendPoints[0].x;
    const lastX = trendPoints[trendPoints.length - 1].x;
    return `${trendPathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [trendPathD, trendPoints]);

  // Donut chart calculations (Circunferencia = 2 * PI * R)
  const donutR = 62;
  const donutCirc = 2 * Math.PI * donutR;
  const cashDash = (cashShare / 100) * donutCirc;
  const transferDash = (transferShare / 100) * donutCirc;
  const cardDash = (cardShare / 100) * donutCirc;

  // Max product for ranking bar width
  const maxProdQty = useMemo(() => {
    return Math.max(...(productAnalytics.topByQty.slice(0, 5).map(p => p.qty)), 1);
  }, [productAnalytics]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* 1. BARRA DE FILTROS AVANZADA: FECHAS Y TURNOS DE CAJA */}
      <div 
        className="tactile-card"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          
          {/* Quick Date Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px', marginRight: '4px' }}>
              <Calendar size={15} style={{ color: 'var(--accent-amber)' }} /> Período:
            </span>
            {[
              { id: 'today', label: 'Hoy' },
              { id: 'yesterday', label: 'Ayer' },
              { id: 'week', label: '7 Días' },
              { id: 'month', label: 'Este Mes' },
              { id: 'custom', label: 'Personalizado' },
              { id: 'all', label: 'Histórico' }
            ].map(r => (
              <button
                key={r.id}
                type="button"
                className={`cat-pill-btn tactile-btn ${rangeType === r.id ? 'active' : ''}`}
                style={{ 
                  fontSize: '0.76rem', 
                  height: '30px', 
                  padding: '0.25rem 0.65rem',
                  fontWeight: rangeType === r.id ? 900 : 700
                }}
                onClick={() => {
                  setRangeType(r.id);
                  if (selectedShiftId !== 'all') setSelectedShiftId('all');
                }}
              >
                <span>{r.label}</span>
              </button>
            ))}
          </div>

          {/* Turno Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <DollarSign size={15} style={{ color: 'var(--accent-emerald)' }} /> Turno de Caja:
            </span>
            
            <select
              value={selectedShiftId}
              onChange={(e) => setSelectedShiftId(e.target.value)}
              className="search-input"
              style={{
                height: '32px',
                fontSize: '0.78rem',
                padding: '0 8px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                color: selectedShiftId !== 'all' ? 'var(--accent-amber)' : 'var(--text-primary)',
                borderColor: selectedShiftId !== 'all' ? 'var(--accent-amber)' : 'var(--border-subtle)',
                background: 'var(--bg-main)',
                maxWidth: '260px'
              }}
            >
              <option value="all">🏛️ Todos los turnos</option>
              {shifts.map(s => {
                const isAct = !s.isClosed && s.closedAt == null;
                const d = s.openedAt ? new Date(s.openedAt).toLocaleDateString('es-AR') : '';
                const h = s.openedAt ? new Date(s.openedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';
                const name = s.cashierName || s.cashier || 'Cajero';
                return (
                  <option key={s.id} value={s.id}>
                    {isAct ? '🟢 [EN CURSO] ' : '📁 '} {d} {h}hs — {name}
                  </option>
                );
              })}
            </select>

            {(selectedShiftId !== 'all' || rangeType === 'custom') && (
              <button
                type="button"
                className="qty-btn tactile-btn"
                style={{ height: '32px', padding: '0 8px', fontSize: '0.75rem', gap: '4px' }}
                onClick={() => {
                  setSelectedShiftId('all');
                  setRangeType('today');
                  setCustomStart('');
                  setCustomEnd('');
                }}
                title="Restablecer filtros a Hoy"
              >
                <X size={13} />
                <span>Restablecer</span>
              </button>
            )}
          </div>
        </div>

        {/* Custom date range inputs when 'custom' is active */}
        {rangeType === 'custom' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            paddingTop: '0.6rem',
            borderTop: '1px dashed var(--border-subtle)',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Desde:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="search-input"
              style={{ height: '30px', fontSize: '0.78rem', padding: '0 8px', width: '140px' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Hasta:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="search-input"
              style={{ height: '30px', fontSize: '0.78rem', padding: '0 8px', width: '140px' }}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--accent-amber)', fontWeight: 700 }}>
              {orders.length} comandas en este rango
            </span>
          </div>
        )}

        {/* Active Filter Chips Notification */}
        {selectedShift && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.5rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
              <span style={{
                background: !selectedShift.isClosed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: !selectedShift.isClosed ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                fontSize: '0.68rem',
                fontWeight: 900,
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                {!selectedShift.isClosed ? 'TURNO ACTIVO' : 'TURNO ARCHIVADO'}
              </span>
              <span>
                Cajero: <strong style={{ color: 'var(--text-primary)' }}>{selectedShift.cashierName || 'Cajero'}</strong> • Apertura: <strong>{new Date(selectedShift.openedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</strong>
                {selectedShift.closedAt ? ` a ${new Date(selectedShift.closedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs` : ' (En curso)'}
              </span>
            </div>

            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-amber)' }}>
              {orders.length} Comandas de este turno • {formatMoney(kpis.grossRevenue)}
            </div>
          </div>
        )}
      </div>

      {/* 2. MAIN 5 KPI METRIC CARDS */}
      <div className="audit-kpis-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
        
        {/* Card 1: Facturación Bruta */}
        <div 
          className="tactile-card"
          style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-subtle)', 
            borderTop: '3px solid var(--accent-amber)',
            borderRadius: 'var(--radius-md)', 
            padding: '1.1rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.35rem',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
              FACTURACIÓN BRUTA
            </span>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '5px', borderRadius: '8px', color: 'var(--accent-amber)' }}>
              <DollarSign size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-amber)', fontFamily: 'var(--font-heading)' }}>
            {formatMoney(kpis.grossRevenue)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Subtotal: {formatMoney(kpis.subtotalRevenue)} • Fletes: {formatMoney(kpis.totalDeliveryFees)}
          </div>
        </div>

        {/* Card 2: Total Pedidos & Tasa de Éxito */}
        <div 
          className="tactile-card"
          style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-subtle)', 
            borderTop: '3px solid var(--accent-blue)',
            borderRadius: 'var(--radius-md)', 
            padding: '1.1rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.35rem',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
              TOTAL COMANDAS
            </span>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '5px', borderRadius: '8px', color: '#60a5fa' }}>
              <ShoppingBag size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span>{kpis.totalOrders}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 800 }}>
              {kpis.completionRate}% éxito
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {kpis.activeOrdersCount || kpis.totalOrders} completadas • {kpis.cancelledOrdersCount || 0} canceladas
          </div>
        </div>

        {/* Card 3: Ticket Promedio */}
        <div 
          className="tactile-card"
          style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-subtle)', 
            borderTop: '3px solid var(--accent-emerald)',
            borderRadius: 'var(--radius-md)', 
            padding: '1.1rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.35rem',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
              TICKET PROMEDIO
            </span>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '5px', borderRadius: '8px', color: 'var(--accent-emerald)' }}>
              <TrendingUp size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-emerald)', fontFamily: 'var(--font-heading)' }}>
            {formatMoney(kpis.avgTicket)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Gasto medio por cliente • {kpis.totalItemsCount || 0} platos servidos
          </div>
        </div>

        {/* Card 4: Efectivo Neto en Mano */}
        <div 
          className="tactile-card"
          style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-subtle)', 
            borderTop: '3px solid #c084fc',
            borderRadius: 'var(--radius-md)', 
            padding: '1.1rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.35rem',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
              EFECTIVO NETO CAJA
            </span>
            <div style={{ background: 'rgba(168, 85, 247, 0.15)', padding: '5px', borderRadius: '8px', color: '#c084fc' }}>
              <CreditCard size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            {formatMoney(kpis.netCashInHand)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Cobrado {formatMoney(kpis.payments?.cash?.total)} • Gastos -{formatMoney(kpis.totalExpenses)}
          </div>
        </div>

        {/* Card 5: Tiempos de Cocina y Despacho */}
        <div 
          className="tactile-card"
          style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-subtle)', 
            borderTop: '3px solid #f97316',
            borderRadius: 'var(--radius-md)', 
            padding: '1.1rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.35rem',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
              TIEMPO DESPACHO
            </span>
            <div style={{ background: 'rgba(249, 115, 22, 0.15)', padding: '5px', borderRadius: '8px', color: '#f97316' }}>
              <Timer size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f97316', fontFamily: 'var(--font-heading)' }}>
            ~{kpis.avgPrepTimeMin || 18}m
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Cocina: ~{kpis.avgPrepTimeMin || 18}m • Entrega final: ~{kpis.avgDeliveryTimeMin || 32}m
          </div>
        </div>
      </div>

      {/* 3. GRÁFICA 1: CURVA Y TENDENCIA DE FACTURACIÓN (Interactive SVG Area Chart) */}
      <div 
        className="tactile-card"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} style={{ color: 'var(--accent-amber)' }} />
              <span>Curva de Evolución y Tendencia de Ventas</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Comportamiento dinámico de la facturación en el período analizado
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {hoveredPoint ? (
              <span style={{ fontSize: '0.78rem', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', padding: '3px 9px', borderRadius: 'var(--radius-full)', fontWeight: 800 }}>
                {hoveredPoint.label}: {formatMoney(hoveredPoint.revenue)} ({hoveredPoint.count} pedidos)
              </span>
            ) : (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Pasa el cursor por los puntos para ver detalles
              </span>
            )}
          </div>
        </div>

        {/* SVG Area Chart */}
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <svg 
            viewBox={`0 0 ${trendChartWidth} ${trendChartHeight}`}
            style={{ width: '100%', height: 'auto', minWidth: '480px', display: 'block' }}
          >
            <defs>
              <linearGradient id="areaGradientAmber" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid horizontal lines */}
            {[0.2, 0.5, 0.8].map((ratio, idx) => {
              const y = chartPadding.top + (trendChartHeight - chartPadding.top - chartPadding.bottom) * ratio;
              const val = Math.round(trendMaxRev * (1 - ratio));
              return (
                <g key={idx}>
                  <line 
                    x1={chartPadding.left} 
                    y1={y} 
                    x2={trendChartWidth - chartPadding.right} 
                    y2={y} 
                    stroke="var(--border-subtle)" 
                    strokeDasharray="3 4" 
                    strokeWidth="1"
                  />
                  <text 
                    x={chartPadding.left - 8} 
                    y={y + 4} 
                    fill="var(--text-muted)" 
                    fontSize="10" 
                    textAnchor="end"
                  >
                    ${(val / 1000).toFixed(0)}k
                  </text>
                </g>
              );
            })}

            {/* Base line */}
            <line 
              x1={chartPadding.left} 
              y1={trendChartHeight - chartPadding.bottom} 
              x2={trendChartWidth - chartPadding.right} 
              y2={trendChartHeight - chartPadding.bottom} 
              stroke="var(--border-subtle)" 
              strokeWidth="1"
            />

            {/* Shaded Area */}
            {trendAreaD && (
              <path 
                d={trendAreaD} 
                fill="url(#areaGradientAmber)" 
              />
            )}

            {/* Stroke Line */}
            {trendPathD && (
              <path 
                d={trendPathD} 
                fill="none" 
                stroke="var(--accent-amber)" 
                strokeWidth="3" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            )}

            {/* Points & Labels */}
            {trendPoints.map((pt, idx) => {
              const isHovered = hoveredPoint && hoveredPoint.label === pt.label;
              return (
                <g 
                  key={idx}
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle 
                    cx={pt.x} 
                    cy={pt.y} 
                    r={isHovered ? 7 : 4.5} 
                    fill={isHovered ? '#ffffff' : 'var(--accent-amber)'} 
                    stroke="var(--accent-amber)" 
                    strokeWidth={isHovered ? 3 : 2} 
                    style={{ transition: 'all 0.15s ease' }}
                  />
                  {/* X Axis Label */}
                  <text 
                    x={pt.x} 
                    y={trendChartHeight - 12} 
                    fill={isHovered ? 'var(--accent-amber)' : 'var(--text-muted)'} 
                    fontSize="10" 
                    fontWeight={isHovered ? '800' : '600'}
                    textAnchor="middle"
                  >
                    {pt.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* 4. TWO COLUMNS: HORARIOS PICO (RUSH HOURS) & DESGLOSE DE PAGOS (DONUT CHART) */}
      <div className="audit-sub-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        
        {/* Gráfica 2: Horarios Pico & Saturación de Cocina */}
        <div 
          className="tactile-card"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame size={18} style={{ color: '#f97316' }} />
              <span style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>Horarios Pico de Venta</span>
            </div>
            <span style={{ fontSize: '0.72rem', background: 'rgba(249, 115, 22, 0.15)', color: '#f97316', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 800 }}>
              RUSH HOUR: {hourlyData.peakHour}
            </span>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Distribución del volumen de comandas a lo largo de las franjas horarias
          </div>

          {/* Bar Chart Bars */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '140px', padding: '0 4px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
            {hourlyData.hoursList.map((item, idx) => {
              const maxCount = Math.max(...hourlyData.hoursList.map(h => h.count), 1);
              const heightPct = Math.round((item.count / maxCount) * 100);
              const isHovered = hoveredBar && hoveredBar.label === item.label;

              return (
                <div 
                  key={idx}
                  onMouseEnter={() => setHoveredBar(item)}
                  onMouseLeave={() => setHoveredBar(null)}
                  style={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    height: '100%', 
                    justifyContent: 'flex-end',
                    cursor: 'pointer'
                  }}
                >
                  <div 
                    style={{ 
                      width: '100%', 
                      height: `${Math.max(heightPct, 6)}%`, 
                      background: item.isPeak 
                        ? 'var(--accent-amber)' 
                        : isHovered ? '#60a5fa' : 'rgba(59, 130, 246, 0.35)', 
                      borderRadius: '4px 4px 1px 1px',
                      transition: 'all 0.2s ease',
                      boxShadow: item.isPeak ? '0 0 10px rgba(245, 158, 11, 0.4)' : 'none'
                    }}
                  />
                  <span style={{ fontSize: '0.64rem', color: isHovered || item.isPeak ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: '4px', fontWeight: item.isPeak ? 900 : 600 }}>
                    {item.label.slice(0, 2)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Hover details for Rush Hours */}
          <div style={{ minHeight: '36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-main)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.78rem' }}>
            {hoveredBar ? (
              <>
                <span>Franja <strong>{hoveredBar.label} hs</strong>:</span>
                <span style={{ color: 'var(--accent-amber)', fontWeight: 800 }}>
                  {hoveredBar.count} pedidos • {formatMoney(hoveredBar.revenue)} ({hoveredBar.percentage}%)
                </span>
              </>
            ) : (
              <>
                <span style={{ color: 'var(--text-muted)' }}>Concentración pico:</span>
                <span style={{ fontWeight: 800, color: '#f97316' }}>
                  {hourlyData.peakOrders} comandas a las {hourlyData.peakHour} ({hourlyData.peakPercentage}% del total)
                </span>
              </>
            )}
          </div>
        </div>

        {/* Gráfica 3: Desglose de Medios de Pago (Interactive Donut Chart con %) */}
        <div 
          className="tactile-card"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} style={{ color: 'var(--accent-amber)' }} />
              <span style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>Medios de Pago & Cobranza</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>PARTICIPACIÓN</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            {/* SVG Donut */}
            <div style={{ position: 'relative', width: '130px', height: '130px', flexShrink: 0 }}>
              <svg viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                {/* Background Ring */}
                <circle 
                  cx="80" 
                  cy="80" 
                  r={donutR} 
                  fill="none" 
                  stroke="var(--border-subtle)" 
                  strokeWidth="18" 
                />
                {/* Cash Segment */}
                {cashShare > 0 && (
                  <circle 
                    cx="80" 
                    cy="80" 
                    r={donutR} 
                    fill="none" 
                    stroke="var(--accent-amber)" 
                    strokeWidth="18" 
                    strokeDasharray={`${cashDash} ${donutCirc}`}
                    strokeDashoffset="0"
                    style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
                    onMouseEnter={() => setActiveDonutSegment('cash')}
                    onMouseLeave={() => setActiveDonutSegment(null)}
                  />
                )}
                {/* Transfer Segment */}
                {transferShare > 0 && (
                  <circle 
                    cx="80" 
                    cy="80" 
                    r={donutR} 
                    fill="none" 
                    stroke="var(--accent-emerald)" 
                    strokeWidth="18" 
                    strokeDasharray={`${transferDash} ${donutCirc}`}
                    strokeDashoffset={-cashDash}
                    style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
                    onMouseEnter={() => setActiveDonutSegment('transfer')}
                    onMouseLeave={() => setActiveDonutSegment(null)}
                  />
                )}
                {/* Card Segment */}
                {cardShare > 0 && (
                  <circle 
                    cx="80" 
                    cy="80" 
                    r={donutR} 
                    fill="none" 
                    stroke="#3b82f6" 
                    strokeWidth="18" 
                    strokeDasharray={`${cardDash} ${donutCirc}`}
                    strokeDashoffset={-(cashDash + transferDash)}
                    style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
                    onMouseEnter={() => setActiveDonutSegment('card')}
                    onMouseLeave={() => setActiveDonutSegment(null)}
                  />
                )}
              </svg>

              {/* Center Value */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
              }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                  {activeDonutSegment === 'cash' ? `${cashShare}%` : activeDonutSegment === 'transfer' ? `${transferShare}%` : activeDonutSegment === 'card' ? `${cardShare}%` : '100%'}
                </span>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {activeDonutSegment || 'COBRADO'}
                </span>
              </div>
            </div>

            {/* Legend & Breakdown */}
            <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* Efectivo */}
              <div 
                style={{ 
                  background: activeDonutSegment === 'cash' ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-main)', 
                  padding: '6px 10px', 
                  borderRadius: 'var(--radius-sm)', 
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
                onMouseEnter={() => setActiveDonutSegment('cash')}
                onMouseLeave={() => setActiveDonutSegment(null)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-amber)' }} />
                  <span>💵 Efectivo</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ fontSize: '0.85rem' }}>{formatMoney(kpis.payments?.cash?.total)}</strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--accent-amber)', marginLeft: '4px', fontWeight: 800 }}>({cashShare}%)</span>
                </div>
              </div>

              {/* Transferencias */}
              <div 
                style={{ 
                  background: activeDonutSegment === 'transfer' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-main)', 
                  padding: '6px 10px', 
                  borderRadius: 'var(--radius-sm)', 
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
                onMouseEnter={() => setActiveDonutSegment('transfer')}
                onMouseLeave={() => setActiveDonutSegment(null)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-emerald)' }} />
                  <span>📱 Transf. / MP</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ fontSize: '0.85rem' }}>{formatMoney(kpis.payments?.transfer?.total)}</strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', marginLeft: '4px', fontWeight: 800 }}>({transferShare}%)</span>
                </div>
              </div>

              {/* Tarjetas */}
              <div 
                style={{ 
                  background: activeDonutSegment === 'card' ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-main)', 
                  padding: '6px 10px', 
                  borderRadius: 'var(--radius-sm)', 
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
                onMouseEnter={() => setActiveDonutSegment('card')}
                onMouseLeave={() => setActiveDonutSegment(null)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                  <span>💳 Posnet / Tarj.</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ fontSize: '0.85rem' }}>{formatMoney(kpis.payments?.card?.total)}</strong>
                  <span style={{ fontSize: '0.72rem', color: '#60a5fa', marginLeft: '4px', fontWeight: 800 }}>({cardShare}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Transfer status audit note */}
          {(kpis.payments?.transfer?.pending || 0) > 0 && (
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.73rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-rose)', fontWeight: 700 }}>
              <Clock size={13} />
              <span>Hay {formatMoney(kpis.payments?.transfer?.pending)} en transferencias pendientes de verificación de comprobante.</span>
            </div>
          )}
        </div>
      </div>

      {/* 5. TWO COLUMNS: CANALES DE VENTA & TOP PRODUCTOS ESTRELLA */}
      <div className="audit-sub-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        
        {/* Canales de Despacho */}
        <div 
          className="tactile-card"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} style={{ color: 'var(--accent-emerald)' }} />
              <span style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>Canales de Despacho</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>TICKET PROMEDIO</span>
          </div>

          {/* Delivery WhatsApp */}
          <div style={{ background: 'var(--bg-main)', padding: '0.75rem 0.95rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🛵</span> Delivery WhatsApp
              </span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--text-primary)' }}>{formatMoney(kpis.channels?.whatsapp?.total)}</span>
                <span style={{ fontSize: '0.74rem', color: 'var(--accent-emerald)', marginLeft: '6px', fontWeight: 800 }}>({waShare}%)</span>
              </div>
            </div>
            <div style={{ height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden', margin: '6px 0 4px' }}>
              <div style={{ width: `${waShare}%`, height: '100%', background: 'var(--accent-emerald)', borderRadius: '2px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <span>{kpis.channels?.whatsapp?.count || 0} pedidos a domicilio</span>
              <span>Ticket prom: <strong>{formatMoney(kpis.channels?.whatsapp?.avg)}</strong></span>
            </div>
          </div>

          {/* Retiro en Mostrador */}
          <div style={{ background: 'var(--bg-main)', padding: '0.75rem 0.95rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🛍️</span> Retiro en Mostrador
              </span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--text-primary)' }}>{formatMoney(kpis.channels?.mostrador?.total)}</span>
                <span style={{ fontSize: '0.74rem', color: 'var(--accent-amber)', marginLeft: '6px', fontWeight: 800 }}>({mostradorShare}%)</span>
              </div>
            </div>
            <div style={{ height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden', margin: '6px 0 4px' }}>
              <div style={{ width: `${mostradorShare}%`, height: '100%', background: 'var(--accent-amber)', borderRadius: '2px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <span>{kpis.channels?.mostrador?.count || 0} pedidos takeaway</span>
              <span>Ticket prom: <strong>{formatMoney(kpis.channels?.mostrador?.avg)}</strong></span>
            </div>
          </div>

          {/* Mesa Local */}
          <div style={{ background: 'var(--bg-main)', padding: '0.75rem 0.95rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Utensils size={14} style={{ color: 'var(--accent-amber)' }} /> Salón / Mesa Local
              </span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--text-primary)' }}>{formatMoney(kpis.channels?.mesa?.total)}</span>
                <span style={{ fontSize: '0.74rem', color: '#a855f7', marginLeft: '6px', fontWeight: 800 }}>({mesaShare}%)</span>
              </div>
            </div>
            <div style={{ height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden', margin: '6px 0 4px' }}>
              <div style={{ width: `${mesaShare}%`, height: '100%', background: '#a855f7', borderRadius: '2px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <span>{kpis.channels?.mesa?.count || 0} comandas en mesas</span>
              <span>Ticket prom: <strong>{formatMoney(kpis.channels?.mesa?.avg)}</strong></span>
            </div>
          </div>
        </div>

        {/* Top 5 Productos Más Vendidos */}
        <div 
          className="tactile-card"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={18} style={{ color: 'var(--accent-amber)' }} />
              <span style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>Top 5 Platos Estrella</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>VOLUMEN</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {productAnalytics.topByQty.slice(0, 5).map((prod, idx) => {
              const pct = Math.round((prod.qty / maxProdQty) * 100);

              return (
                <div key={idx} style={{ background: 'var(--bg-main)', padding: '0.55rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                      #{idx + 1} {prod.name}
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ color: 'var(--accent-amber)' }}>{prod.qty} un.</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px' }}>({formatMoney(prod.total)})</span>
                    </div>
                  </div>
                  <div style={{ height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden', marginTop: '5px' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: idx === 0 ? 'var(--accent-amber)' : 'var(--accent-blue)', borderRadius: '2px' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top Modificadores */}
          {productAnalytics.topModifiers && productAnalytics.topModifiers.length > 0 && (
            <div style={{ marginTop: '0.2rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Agregados y Modificadores más pedidos:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {productAnalytics.topModifiers.slice(0, 4).map((mod, idx) => (
                  <span 
                    key={idx}
                    style={{ 
                      fontSize: '0.68rem', 
                      background: 'rgba(245, 158, 11, 0.1)', 
                      color: 'var(--accent-amber)', 
                      border: '1px solid rgba(245, 158, 11, 0.25)', 
                      padding: '2px 6px', 
                      borderRadius: '10px', 
                      fontWeight: 700 
                    }}
                  >
                    {mod.name} ({mod.count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
