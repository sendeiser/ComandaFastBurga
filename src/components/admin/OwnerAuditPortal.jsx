import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ShieldCheck, Bot, BarChart3, DollarSign, ShieldAlert, Sparkles, LogOut, ArrowLeft, Download, Calendar, Printer, Database, Smartphone } from 'lucide-react';
import AuditKpisTab from './AuditKpisTab';
import AuditCashShiftsTab from './AuditCashShiftsTab';
import AuditSecurityTab from './AuditSecurityTab';
import AuditMenuAnalytics from './AuditMenuAnalytics';
import AuditSecuritySettings from './AuditSecuritySettings';
import AdminWhatsAppBot from './bot/AdminWhatsAppBot';
import AdminDatabaseTablesTab from './database/AdminDatabaseTablesTab';
import { auditService } from '../../services/auditService';
import { storageService } from '../../services/storageService';
import { supabaseSync } from '../../services/supabaseClient';
import { authService } from '../../services/authService';

export default function OwnerAuditPortal({ orders = [], onBackToPos, onLogout }) {
  const portalRef = useRef(null);
  const [activeTab, setActiveTab] = useState('kpis'); // 'kpis' | 'shifts' | 'security' | 'menu' | 'settings' | 'bot' | 'database'
  const [botSubTab, setBotSubTab] = useState('connection'); // 'connection' | 'security' | 'templates' | 'flows'

  const handleOpenBot = (subTab = 'connection') => {
    setBotSubTab(subTab);
    setActiveTab('bot');
  };

  // Al cambiar de pestaña, asegurar que la vista comience siempre arriba sin saltos
  useEffect(() => {
    if (portalRef.current) {
      portalRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  }, [activeTab]);

  const [rangeType, setRangeType] = useState('today'); // 'today' | 'yesterday' | 'week' | 'month' | 'all'

  // Turnos históricos
  const [shifts, setShifts] = React.useState(() => storageService.getCashShiftsHistory());
  React.useEffect(() => {
    if (supabaseSync.isConfigured()) {
      supabaseSync.fetchCashShiftsHistory(100).then(cloudShifts => {
        if (cloudShifts && cloudShifts.length > 0) setShifts(cloudShifts);
      });
    }
  }, []);
  // Pedidos cancelados
  const cancelledOrders = useMemo(() => storageService.getCancelledOrders(), []);

  // Filtrado reactivo de órdenes
  const filteredOrders = useMemo(() => {
    return auditService.filterOrdersByRange(orders, rangeType);
  }, [orders, rangeType]);

  // Cálculos consolidados
  const kpis = useMemo(() => {
    return auditService.calculateFinancialKpis(filteredOrders, shifts);
  }, [filteredOrders, shifts]);

  // Analítica de productos
  const productAnalytics = useMemo(() => {
    return auditService.getProductAnalytics(filteredOrders);
  }, [filteredOrders]);

  const user = authService.getCurrentUser();

  const handleExportOrders = () => {
    auditService.exportOrdersToCsv(filteredOrders);
  };

  const handleExportShifts = () => {
    auditService.exportShiftsToCsv(shifts);
  };

  return (
    <div ref={portalRef} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto', paddingRight: '2px' }}>
      {/* EXECUTIVE HEADER */}
      <div 
        className="executive-header tactile-card"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem',
          boxShadow: 'var(--shadow-md)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1.5px solid var(--accent-amber)',
            boxShadow: '0 0 16px var(--accent-amber-glow)',
            flexShrink: 0
          }}>
            <ShieldCheck size={26} style={{ color: 'var(--accent-amber)' }} />
          </div>

          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>Panel de Auditoría & Control del Dueño</span>
              <span style={{ 
                fontSize: '0.68rem', 
                background: 'rgba(16, 185, 129, 0.18)', 
                color: 'var(--accent-emerald)', 
                border: '1px solid var(--border-emerald-highlight)',
                padding: '2px 8px', 
                borderRadius: 'var(--radius-full)', 
                fontWeight: 900,
                letterSpacing: '0.5px'
              }}>
                SESIÓN ACTIVA
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Titular: <strong style={{ color: 'var(--text-primary)' }}>{user?.user || 'Dueño'}</strong> • Centro Financiero & Auditoría
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="executive-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="qty-btn tactile-btn"
            style={{ 
              width: 'auto', 
              padding: '0.45rem 0.85rem', 
              fontSize: '0.82rem', 
              gap: '6px', 
              minHeight: '38px',
              color: '#059669',
              background: 'rgba(16, 185, 129, 0.08)',
              borderColor: 'rgba(16, 185, 129, 0.35)',
              fontWeight: 800
            }}
            onClick={() => handleOpenBot('connection')}
            title="Conexión y Estado de WhatsApp Web"
          >
            <Smartphone size={16} />
            <span>Conexión Bot</span>
          </button>

          <button
            type="button"
            className="qty-btn tactile-btn"
            style={{ 
              width: 'auto', 
              padding: '0.45rem 0.85rem', 
              fontSize: '0.82rem', 
              gap: '6px', 
              minHeight: '38px',
              color: '#d97706',
              background: 'rgba(245, 158, 11, 0.08)',
              borderColor: 'rgba(245, 158, 11, 0.35)',
              fontWeight: 800
            }}
            onClick={() => handleOpenBot('security')}
            title="Seguridad, Escudo Anti-Baneo y Filtro Anti-Spam"
          >
            <ShieldCheck size={16} />
            <span>Seguridad & Anti-Spam</span>
          </button>

          <button
            type="button"
            className="qty-btn tactile-btn"
            style={{ width: 'auto', padding: '0.5rem 0.95rem', fontSize: '0.85rem', gap: '6px', minHeight: '38px' }}
            onClick={onBackToPos}
            title="Volver a la pantalla de ventas"
          >
            <ArrowLeft size={16} />
            <span>Volver al POS</span>
          </button>

          <button
            type="button"
            className="qty-btn tactile-btn"
            style={{ width: 'auto', padding: '0.5rem 0.95rem', fontSize: '0.85rem', gap: '6px', color: 'var(--accent-rose)', borderColor: 'rgba(239, 68, 68, 0.3)', minHeight: '38px' }}
            onClick={onLogout}
            title="Cerrar sesión de administrador"
          >
            <LogOut size={16} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* TOOLBAR: DATE FILTER & EXPORT BUTTONS */}
      {activeTab !== 'bot' && activeTab !== 'database' && (
        <div 
          className="admin-period-bar tactile-card"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          {/* Date Filter Pills */}
          <div 
            className="scrollable-tabs-bar" 
            style={{ 
              alignItems: 'center', 
              gap: '0.4rem', 
              flex: 1, 
              minWidth: 0,
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none'
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', marginRight: '4px', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
              <Calendar size={15} style={{ color: 'var(--accent-amber)' }} /> Período:
            </span>
            {[
              { id: 'today', label: 'Hoy' },
              { id: 'yesterday', label: 'Ayer' },
              { id: 'week', label: 'Últimos 7 Días' },
              { id: 'month', label: 'Este Mes' },
              { id: 'all', label: 'Histórico' }
            ].map(r => (
              <button
                key={r.id}
                type="button"
                className={`cat-pill-btn tactile-btn ${rangeType === r.id ? 'active' : ''}`}
                style={{ fontSize: '0.78rem', height: '32px', padding: '0.35rem 0.75rem', flexShrink: 0, whiteSpace: 'nowrap' }}
                onClick={() => setRangeType(r.id)}
              >
                <span>{r.label}</span>
              </button>
            ))}
          </div>

          {/* CSV Export Button */}
          <button
            type="button"
            className="btn-confirm-order tactile-btn"
            style={{ width: 'auto', height: '36px', fontSize: '0.85rem', padding: '0 1rem', gap: '6px', flexShrink: 0 }}
            onClick={handleExportOrders}
          >
            <Download size={15} />
            <span>Exportar Ventas ({filteredOrders.length})</span>
          </button>
        </div>
      )}

      {/* PORTAL NAVIGATION TABS */}
      <div 
        className="scrollable-tabs-bar" 
        style={{ 
          background: 'var(--bg-card)', 
          padding: '6px', 
          borderRadius: 'var(--radius-lg)', 
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: '4px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          maxWidth: '100%',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        <button
          type="button"
          className={`cat-pill-btn tactile-btn ${activeTab === 'kpis' ? 'active' : ''}`}
          style={{ height: '38px', padding: '0.45rem 0.95rem', gap: '6px', flexShrink: 0, whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('kpis')}
        >
          <BarChart3 size={16} />
          <span>Métricas Financieras</span>
        </button>

        <button
          type="button"
          className={`cat-pill-btn tactile-btn ${activeTab === 'shifts' ? 'active' : ''}`}
          style={{ height: '38px', padding: '0.45rem 0.95rem', gap: '6px', flexShrink: 0, whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('shifts')}
        >
          <DollarSign size={16} />
          <span>Auditoría de Cajas ({shifts.length})</span>
        </button>

        <button
          type="button"
          className={`cat-pill-btn tactile-btn ${activeTab === 'security' ? 'active' : ''}`}
          style={{ height: '38px', padding: '0.45rem 0.95rem', gap: '6px', flexShrink: 0, whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('security')}
        >
          <ShieldAlert size={16} />
          <span>Control Antifraude ({cancelledOrders.length})</span>
        </button>

        <button
          type="button"
          className={`cat-pill-btn tactile-btn ${activeTab === 'menu' ? 'active' : ''}`}
          style={{ height: '38px', padding: '0.45rem 0.95rem', gap: '6px', flexShrink: 0, whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('menu')}
        >
          <Sparkles size={16} />
          <span>Ranking de Menú</span>
        </button>

        <button
          type="button"
          className={`cat-pill-btn tactile-btn ${activeTab === 'bot' ? 'active' : ''}`}
          style={{ height: '38px', padding: '0.45rem 0.95rem', gap: '6px', flexShrink: 0, whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('bot')}
        >
          <Bot size={16} />
          <span>Bot WhatsApp</span>
        </button>

        <button
          type="button"
          className={`cat-pill-btn tactile-btn ${activeTab === 'database' ? 'active' : ''}`}
          style={{ height: '38px', padding: '0.45rem 0.95rem', gap: '6px', flexShrink: 0, whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('database')}
        >
          <Database size={16} />
          <span>Tablas BD</span>
        </button>

        <button
          type="button"
          className={`cat-pill-btn tactile-btn ${activeTab === 'settings' ? 'active' : ''}`}
          style={{ height: '38px', padding: '0.45rem 0.95rem', gap: '6px', flexShrink: 0, whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('settings')}
        >
          <ShieldCheck size={16} />
          <span>Seguridad Dueño</span>
        </button>
      </div>

      {/* TAB CONTENTS */}
      <div style={{ flex: 1 }}>
        {activeTab === 'kpis' && <AuditKpisTab kpis={kpis} onOpenBot={handleOpenBot} />}
        {activeTab === 'shifts' && <AuditCashShiftsTab shifts={shifts} onExportCsv={handleExportShifts} />}
        {activeTab === 'security' && <AuditSecurityTab cancelledOrders={cancelledOrders} orders={orders} />}
        {activeTab === 'menu' && <AuditMenuAnalytics analytics={productAnalytics} />}
        {activeTab === 'bot' && <AdminWhatsAppBot initialTab={botSubTab} />}
        {activeTab === 'database' && <AdminDatabaseTablesTab />}
        {activeTab === 'settings' && <AuditSecuritySettings />}
      </div>
    </div>
  );
}

