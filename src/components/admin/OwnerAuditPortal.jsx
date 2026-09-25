import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, Bot, BarChart3, DollarSign, ShieldAlert, Sparkles, LogOut, 
  ArrowLeft, Download, Calendar, Printer, Database, Smartphone,
  ChevronLeft, ChevronRight, ChevronDown, Check, Sun, Moon, RefreshCw
} from 'lucide-react';
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

export default function OwnerAuditPortal({ orders = [], onBackToPos, onLogout, theme, onToggleTheme, onRefreshSystem }) {
  const portalRef = useRef(null);
  const [activeTab, setActiveTab] = useState('kpis'); // 'kpis' | 'shifts' | 'security' | 'menu' | 'settings' | 'bot' | 'database'
  const [botSubTab, setBotSubTab] = useState('connection'); // 'connection' | 'security' | 'templates' | 'flows'

  // Sidebar collapse state (persisted in localStorage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('cf_admin_sidebar_collapsed') === 'true';
    } catch (_) {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('cf_admin_sidebar_collapsed', String(next));
      } catch (_) {}
      return next;
    });
  };

  // Mobile coupled accordion state
  const [isMobileAccordionOpen, setIsMobileAccordionOpen] = useState(false);

  const handleOpenBot = (subTab = 'connection') => {
    setBotSubTab(subTab);
    setActiveTab('bot');
    setIsMobileAccordionOpen(false);
  };

  // Al cambiar de pestaña, asegurar que la vista comience siempre arriba y colapsar acordeón móvil
  useEffect(() => {
    if (portalRef.current) {
      portalRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    setIsMobileAccordionOpen(false);
  }, [activeTab]);

  const [rangeType, setRangeType] = useState('today'); // 'today' | 'yesterday' | 'week' | 'month' | 'all'

  // Turnos históricos y pedidos cancelados reactivos
  const [shifts, setShifts] = useState(() => storageService.getCashShiftsHistory());
  const [cancelledOrders, setCancelledOrders] = useState(() => storageService.getCancelledOrders());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setShifts(storageService.getCashShiftsHistory());
      setCancelledOrders(storageService.getCancelledOrders());
    };
    window.addEventListener('comandafast:shifts_updated', handleUpdate);
    window.addEventListener('comandafast:cash-shift-change', handleUpdate);
    window.addEventListener('comandafast:orders_updated', handleUpdate);
    window.addEventListener('comandafast:system_refreshed', handleUpdate);

    if (supabaseSync && supabaseSync.isConfigured()) {
      supabaseSync.fetchCashShifts(50).then(cloudShifts => {
        if (Array.isArray(cloudShifts) && cloudShifts.length > 0) {
          const merged = storageService.syncCashShiftsFromCloud(cloudShifts);
          setShifts(merged);
        }
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener('comandafast:shifts_updated', handleUpdate);
      window.removeEventListener('comandafast:cash-shift-change', handleUpdate);
      window.removeEventListener('comandafast:orders_updated', handleUpdate);
      window.removeEventListener('comandafast:system_refreshed', handleUpdate);
    };
  }, []);

  const handleRefreshSystem = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshSuccess(false);

    try {
      if (onRefreshSystem) {
        await onRefreshSystem();
      } else {
        if (supabaseSync && supabaseSync.isConfigured()) {
          const cloudShifts = await supabaseSync.fetchCashShifts(50);
          if (Array.isArray(cloudShifts) && cloudShifts.length > 0) {
            storageService.syncCashShiftsFromCloud(cloudShifts);
          }
        }
        window.dispatchEvent(new CustomEvent('comandafast:orders_updated'));
        window.dispatchEvent(new CustomEvent('comandafast:shifts_updated'));
      }
      setShifts(storageService.getCashShiftsHistory());
      setCancelledOrders(storageService.getCancelledOrders());
      setRefreshSuccess(true);
      setTimeout(() => {
        setRefreshSuccess(false);
      }, 2500);
    } catch (err) {
      console.error('Error al recargar el sistema:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

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

  // Definición unificada de módulos de navegación
  const navItems = useMemo(() => [
    {
      id: 'kpis',
      label: 'Métricas Financieras',
      shortLabel: 'Métricas',
      icon: BarChart3,
      badge: null,
      badgeColor: null
    },
    {
      id: 'shifts',
      label: 'Auditoría de Cajas',
      shortLabel: 'Cajas',
      icon: DollarSign,
      badge: shifts.length > 0 ? shifts.length : null,
      badgeColor: 'var(--accent-amber)'
    },
    {
      id: 'security',
      label: 'Control Antifraude',
      shortLabel: 'Antifraude',
      icon: ShieldAlert,
      badge: cancelledOrders.length > 0 ? cancelledOrders.length : null,
      badgeColor: cancelledOrders.length > 0 ? 'var(--accent-rose)' : null
    },
    {
      id: 'menu',
      label: 'Ranking de Menú',
      shortLabel: 'Menú',
      icon: Sparkles,
      badge: null,
      badgeColor: null
    },
    {
      id: 'bot',
      label: 'Bot WhatsApp',
      shortLabel: 'Bot WA',
      icon: Bot,
      badge: 'IA',
      badgeColor: 'var(--accent-emerald)'
    },
    {
      id: 'database',
      label: 'Tablas BD',
      shortLabel: 'Tablas',
      icon: Database,
      badge: null,
      badgeColor: null
    },
    {
      id: 'settings',
      label: 'Seguridad Dueño',
      shortLabel: 'Seguridad',
      icon: ShieldCheck,
      badge: null,
      badgeColor: null
    }
  ], [shifts.length, cancelledOrders.length]);

  const currentNavItem = useMemo(() => {
    return navItems.find(item => item.id === activeTab) || navItems[0];
  }, [navItems, activeTab]);

  const CurrentNavIcon = currentNavItem.icon;

  return (
    <div ref={portalRef} className="admin-portal-wrapper" style={{ overflowY: 'auto', paddingRight: '2px' }}>
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
              padding: '0.45rem 0.95rem', 
              fontSize: '0.82rem', 
              gap: '7px', 
              minHeight: '38px',
              color: refreshSuccess ? '#059669' : 'var(--accent-amber, #f59e0b)',
              background: refreshSuccess ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.08)',
              borderColor: refreshSuccess ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.35)',
              fontWeight: 800,
              boxShadow: isRefreshing ? '0 0 12px var(--accent-amber-glow)' : 'none',
              transition: 'all 0.2s ease',
              cursor: isRefreshing ? 'wait' : 'pointer'
            }}
            onClick={handleRefreshSystem}
            disabled={isRefreshing}
            title="Recargar y sincronizar todos los datos del sistema en tiempo real (pedidos, turnos de caja, productos y ajustes)"
          >
            <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
            <span>
              {isRefreshing ? 'Actualizando...' : refreshSuccess ? '¡Sistema Actualizado!' : 'Recargar'}
            </span>
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

          {onToggleTheme && (
            <button
              type="button"
              className="qty-btn tactile-btn theme-toggle-btn"
              style={{ 
                width: 'auto', 
                padding: '0.45rem 0.85rem', 
                fontSize: '0.82rem', 
                gap: '6px', 
                minHeight: '38px',
                color: theme === 'dark' ? '#f59e0b' : '#0f172a',
                background: theme === 'dark' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(15, 23, 42, 0.05)',
                borderColor: theme === 'dark' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(15, 23, 42, 0.2)',
                fontWeight: 800
              }}
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun size={16} style={{ color: 'var(--accent-amber)' }} />
                  <span>Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon size={16} style={{ color: '#0f172a' }} />
                  <span>Modo Oscuro</span>
                </>
              )}
            </button>
          )}

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

      {/* ADMIN PORTAL MAIN BODY */}
      <div className="admin-portal-layout">
        {/* DESKTOP COLLAPSIBLE SIDEBAR */}
        <aside className={`admin-sidebar ${isSidebarCollapsed ? 'collapsed' : 'expanded'}`}>
          <div className="admin-sidebar-header">
            {!isSidebarCollapsed && (
              <span className="admin-sidebar-header-title">MÓDULOS ADMIN</span>
            )}
            <button
              type="button"
              className="admin-sidebar-toggle-btn tactile-btn"
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? "Expandir menú de navegación" : "Colapsar menú lateral"}
              aria-label={isSidebarCollapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
            >
              {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          <nav className="admin-sidebar-nav">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`admin-sidebar-item tactile-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <div className="admin-sidebar-item-icon-wrap">
                    <Icon size={18} />
                    {isSidebarCollapsed && item.badge !== null && (
                      <span 
                        className="admin-sidebar-dot-badge" 
                        style={{ background: item.badgeColor || 'var(--accent-amber)' }}
                        title={`${item.label}: ${item.badge}`}
                      />
                    )}
                  </div>

                  {!isSidebarCollapsed && (
                    <span className="admin-sidebar-item-label">{item.label}</span>
                  )}

                  {!isSidebarCollapsed && item.badge !== null && (
                    <span 
                      className="admin-nav-item-badge"
                      style={{ 
                        backgroundColor: item.badgeColor ? `${item.badgeColor}22` : 'rgba(245, 158, 11, 0.15)',
                        color: item.badgeColor || 'var(--accent-amber)',
                        borderColor: item.badgeColor ? `${item.badgeColor}44` : 'rgba(245, 158, 11, 0.3)'
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {!isSidebarCollapsed && (
            <div className="admin-sidebar-footer">
              <span className="admin-sidebar-footer-text">ComandaFast Admin</span>
            </div>
          )}
        </aside>

        {/* MAIN VIEWPORT */}
        <div className="admin-main-viewport">
          {/* MOBILE COUPLED ACCORDION NAVIGATION */}
          <div className="admin-mobile-accordion-container">
            <button
              type="button"
              className={`admin-mobile-accordion-trigger tactile-btn ${isMobileAccordionOpen ? 'active' : ''}`}
              onClick={() => setIsMobileAccordionOpen(prev => !prev)}
              aria-expanded={isMobileAccordionOpen}
            >
              <div className="admin-accordion-trigger-left">
                <div className="admin-accordion-icon-box">
                  <CurrentNavIcon size={18} style={{ color: 'var(--accent-amber)' }} />
                </div>
                <div className="admin-accordion-meta">
                  <span className="admin-accordion-subtitle">Módulo activo</span>
                  <div className="admin-accordion-title-wrap">
                    <span className="admin-accordion-title">{currentNavItem.label}</span>
                    {currentNavItem.badge !== null && (
                      <span 
                        className="admin-nav-item-badge"
                        style={{ 
                          fontSize: '0.68rem',
                          padding: '1px 6px',
                          backgroundColor: currentNavItem.badgeColor ? `${currentNavItem.badgeColor}22` : 'rgba(245, 158, 11, 0.15)',
                          color: currentNavItem.badgeColor || 'var(--accent-amber)',
                          borderColor: currentNavItem.badgeColor ? `${currentNavItem.badgeColor}44` : 'rgba(245, 158, 11, 0.3)'
                        }}
                      >
                        {currentNavItem.badge}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="admin-accordion-trigger-right">
                <span className="admin-accordion-hint">Navegar</span>
                <ChevronDown 
                  size={18} 
                  className={`admin-accordion-chevron ${isMobileAccordionOpen ? 'rotated' : ''}`} 
                />
              </div>
            </button>

            {/* Accordion Unfolded Menu (Coupled) */}
            <div className={`admin-mobile-accordion-content ${isMobileAccordionOpen ? 'expanded' : ''}`}>
              <div className="admin-mobile-accordion-list">
                {navItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`admin-accordion-item-btn tactile-btn ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileAccordionOpen(false);
                      }}
                    >
                      <div className="admin-accordion-item-main">
                        <Icon size={18} className="admin-accordion-item-icon" />
                        <span className="admin-accordion-item-text">{item.label}</span>
                      </div>

                      <div className="admin-accordion-item-end">
                        {item.badge !== null && (
                          <span 
                            className="admin-nav-item-badge"
                            style={{ 
                              fontSize: '0.68rem',
                              padding: '1px 6px',
                              backgroundColor: item.badgeColor ? `${item.badgeColor}22` : 'rgba(245, 158, 11, 0.15)',
                              color: item.badgeColor || 'var(--accent-amber)',
                              borderColor: item.badgeColor ? `${item.badgeColor}44` : 'rgba(245, 158, 11, 0.3)'
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                        {isActive && (
                          <Check size={16} style={{ color: 'var(--accent-amber)' }} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
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

          {/* TAB CONTENTS */}
          <div className="admin-tab-content-container" style={{ flex: 1 }}>
            {activeTab === 'kpis' && <AuditKpisTab kpis={kpis} onOpenBot={handleOpenBot} />}
            {activeTab === 'shifts' && <AuditCashShiftsTab shifts={shifts} onExportCsv={handleExportShifts} />}
            {activeTab === 'security' && <AuditSecurityTab cancelledOrders={cancelledOrders} orders={orders} />}
            {activeTab === 'menu' && <AuditMenuAnalytics analytics={productAnalytics} />}
            {activeTab === 'bot' && <AdminWhatsAppBot initialTab={botSubTab} />}
            {activeTab === 'database' && <AdminDatabaseTablesTab />}
            {activeTab === 'settings' && <AuditSecuritySettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

