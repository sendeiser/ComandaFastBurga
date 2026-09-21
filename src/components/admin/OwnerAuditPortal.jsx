import React, { useState, useMemo } from 'react';
import { ShieldCheck, Bot, BarChart3, DollarSign, ShieldAlert, Sparkles, LogOut, ArrowLeft, Download, Calendar, Printer } from 'lucide-react';
import AuditKpisTab from './AuditKpisTab';
import AuditCashShiftsTab from './AuditCashShiftsTab';
import AuditSecurityTab from './AuditSecurityTab';
import AuditMenuAnalytics from './AuditMenuAnalytics';
import AuditSecuritySettings from './AuditSecuritySettings';
import AdminWhatsAppBot from './bot/AdminWhatsAppBot';
import { auditService } from '../../services/auditService';
import { storageService } from '../../services/storageService';
import { authService } from '../../services/authService';

export default function OwnerAuditPortal({ orders = [], onBackToPos, onLogout }) {
  const [activeTab, setActiveTab] = useState('kpis'); // 'kpis' | 'shifts' | 'security' | 'menu' | 'settings'
  const [rangeType, setRangeType] = useState('today'); // 'today' | 'yesterday' | 'week' | 'month' | 'all'

  // Turnos históricos
  const shifts = useMemo(() => storageService.getCashShiftsHistory(), []);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto', paddingRight: '4px' }}>
      {/* EXECUTIVE HEADER */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '1rem 1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.4))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--accent-amber)'
          }}>
            <ShieldCheck size={24} style={{ color: 'var(--accent-amber)' }} />
          </div>

          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Panel de Auditoría & Control del Dueño</span>
              <span style={{ fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 800 }}>
                SESIÓN ACTIVA
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Bienvenido, <strong>{user?.user || 'Dueño'}</strong> • Análisis financiero y control operativo
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="qty-btn"
            style={{ width: 'auto', padding: '0.5rem 0.85rem', fontSize: '0.85rem', gap: '6px' }}
            onClick={onBackToPos}
            title="Volver a la pantalla de ventas"
          >
            <ArrowLeft size={16} />
            <span>Volver al POS</span>
          </button>

          <button
            type="button"
            className="qty-btn"
            style={{ width: 'auto', padding: '0.5rem 0.85rem', fontSize: '0.85rem', gap: '6px', color: 'var(--accent-rose)' }}
            onClick={onLogout}
            title="Cerrar sesión de administrador"
          >
            <LogOut size={16} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* TOOLBAR: DATE FILTER & EXPORT BUTTONS */}
      {activeTab !== 'bot' && <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '0.75rem 1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        {/* Date Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', marginRight: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={14} /> Período:
          </span>
          {[
            { id: 'today', label: 'Hoy' },
            { id: 'yesterday', label: 'Ayer' },
            { id: 'week', label: 'Últimos 7 Días' },
            { id: 'month', label: 'Este Mes' },
            { id: 'all', label: 'Histórico Completo' }
          ].map(r => (
            <button
              key={r.id}
              type="button"
              className={`cat-pill-btn ${rangeType === r.id ? 'active' : ''}`}
              style={{ fontSize: '0.78rem', height: '32px', padding: '0.35rem 0.75rem' }}
              onClick={() => setRangeType(r.id)}
            >
              <span>{r.label}</span>
            </button>
          ))}
        </div>

        {/* CSV Export Button */}
        <button
          type="button"
          className="btn-confirm-order"
          style={{ width: 'auto', height: '34px', fontSize: '0.85rem', padding: '0 1rem', gap: '6px' }}
          onClick={handleExportOrders}
        >
          <Download size={15} />
          <span>Exportar Ventas ({filteredOrders.length})</span>
        </button>
      </div>}

      {/* PORTAL NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px', overflowX: 'auto' }}>
        <button
          type="button"
          className={`cat-pill-btn ${activeTab === 'kpis' ? 'active' : ''}`}
          style={{ height: '38px', padding: '0.5rem 1rem', gap: '6px' }}
          onClick={() => setActiveTab('kpis')}
        >
          <BarChart3 size={16} />
          <span>Métricas Financieras</span>
        </button>

        <button
          type="button"
          className={`cat-pill-btn ${activeTab === 'shifts' ? 'active' : ''}`}
          style={{ height: '38px', padding: '0.5rem 1rem', gap: '6px' }}
          onClick={() => setActiveTab('shifts')}
        >
          <DollarSign size={16} />
          <span>Auditoría de Cajas ({shifts.length})</span>
        </button>

        <button
          type="button"
          className={`cat-pill-btn ${activeTab === 'security' ? 'active' : ''}`}
          style={{ height: '38px', padding: '0.5rem 1rem', gap: '6px' }}
          onClick={() => setActiveTab('security')}
        >
          <ShieldAlert size={16} />
          <span>Control Antifraude ({cancelledOrders.length})</span>
        </button>

        <button
          type="button"
          className={`cat-pill-btn ${activeTab === 'menu' ? 'active' : ''}`}
          style={{ height: '38px', padding: '0.5rem 1rem', gap: '6px' }}
          onClick={() => setActiveTab('menu')}
        >
          <Sparkles size={16} />
          <span>Ranking de Menú</span>
        </button>

        <button
          type="button"
          className={`cat-pill-btn ${activeTab === 'bot' ? 'active' : ''}`}
          style={{ height: '38px', padding: '0.5rem 1rem', gap: '6px' }}
          onClick={() => setActiveTab('bot')}
        >
          <Bot size={16} />
          <span>Bot WhatsApp & Lab</span>
        </button>

        <button
          type="button"
          className={`cat-pill-btn ${activeTab === 'settings' ? 'active' : ''}`}
          style={{ height: '38px', padding: '0.5rem 1rem', gap: '6px' }}
          onClick={() => setActiveTab('settings')}
        >
          <ShieldCheck size={16} />
          <span>Seguridad Dueño</span>
        </button>
      </div>

      {/* TAB CONTENTS */}
      <div style={{ flex: 1 }}>
        {activeTab === 'kpis' && <AuditKpisTab kpis={kpis} />}
        {activeTab === 'shifts' && <AuditCashShiftsTab shifts={shifts} onExportCsv={handleExportShifts} />}
        {activeTab === 'security' && <AuditSecurityTab cancelledOrders={cancelledOrders} orders={orders} />}
        {activeTab === 'menu' && <AuditMenuAnalytics analytics={productAnalytics} />}
        {activeTab === 'bot' && <AdminWhatsAppBot />}
        {activeTab === 'settings' && <AuditSecuritySettings />}
      </div>
    </div>
  );
}
