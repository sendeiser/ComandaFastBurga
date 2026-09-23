import React from 'react';
import { 
  Flame,
  User,
  LogOut, 
  ShoppingCart, 
  ChefHat, 
  History, 
  UtensilsCrossed, 
  Settings, 
  Maximize2, 
  CheckCircle2, 
  AlertCircle, 
  Cloud, 
  Sun, 
  Moon
} from 'lucide-react';
import { supabaseSync } from '../../services/supabaseClient';

export default function Header({ 
  currentCashier,
  onLogoutCashier,
  currentTab, 
  setCurrentTab, 
  pendingKitchenCount, 
  cashShift, 
  settings,
  theme,
  onToggleTheme,
  onOpenCashModal, 
  onOpenSettings 
}) {
  const isCloudSynced = supabaseSync.isConfigured();

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <>
    <header className="top-header">
      <div className="brand-section">
        <div className="brand-logo-icon">
          <Flame size={22} />
        </div>
        <div>
          <div className="brand-name">
            <span className="brand-name-text">COMANDA</span><span style={{ color: 'var(--accent-amber)' }}>FAST</span>
            <span className="brand-badge">POS & KDS</span>
          </div>
        </div>
      </div>

      <nav className="nav-tabs desktop-nav-tabs">
        <button 
          className={`nav-tab-btn ${currentTab === 'pos' ? 'active' : ''}`}
          onClick={() => setCurrentTab('pos')}
          title="Mostrador de Ventas"
        >
          <ShoppingCart size={17} />
          <span>Mostrador</span>
        </button>

        <button 
          className={`nav-tab-btn ${currentTab === 'kds' ? 'active' : ''}`}
          onClick={() => setCurrentTab('kds')}
          title="Cocina / Pantalla KDS"
        >
          <ChefHat size={17} />
          <span>Cocina</span>
          {pendingKitchenCount > 0 && (
            <span className="nav-badge-count">{pendingKitchenCount}</span>
          )}
        </button>

        <button 
          className={`nav-tab-btn ${currentTab === 'history' ? 'active' : ''}`}
          onClick={() => setCurrentTab('history')}
          title="Historial de Pedidos"
        >
          <History size={17} />
          <span>Historial</span>
        </button>

        <button 
          className={`nav-tab-btn ${currentTab === 'menu' ? 'active' : ''}`}
          onClick={() => setCurrentTab('menu')}
          title="Gestión de Menú y Precios"
        >
          <UtensilsCrossed size={17} />
          <span>Menú</span>
        </button>
      </nav>

      <div className="header-right-actions">
        {/* Cashier Badge & Logout */}
        {currentCashier && (
          <div 
            className="tactile-btn"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              padding: '2px 8px 2px 10px',
              height: '34px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
            }}
            title={`Cajero conectado: ${currentCashier.name} (@${currentCashier.username})`}
          >
            <User size={15} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', maxWidth: '95px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentCashier.name}
            </span>
            <button
              type="button"
              onClick={onLogoutCashier}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '3px 4px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                minWidth: '22px',
                minHeight: '22px'
              }}
              title="Cerrar sesión de cajero"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}

        {/* Shift status pill */}
        {cashShift && !cashShift.isClosed ? (
          <div className="shift-status-pill" onClick={onOpenCashModal} title="Click para ver control de caja">
            <CheckCircle2 size={16} />
            <span className="shift-status-full-text">Caja Abierta (${cashShift.initialCash.toLocaleString('es-AR')})</span>
            <span className="shift-status-short-text">Abierta</span>
          </div>
        ) : (
          <div className="shift-status-pill closed" onClick={onOpenCashModal} title="Click para abrir turno de caja">
            <AlertCircle size={16} />
            <span className="shift-status-full-text">Caja Cerrada</span>
            <span className="shift-status-short-text">Cerrada</span>
          </div>
        )}

        {/* Cloud Status (Desktop Only) */}
        <div 
          className="desktop-only-action"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            color: isCloudSynced ? 'var(--accent-blue)' : 'var(--text-muted)', 
            cursor: 'pointer' 
          }}
          onClick={onOpenSettings}
          title={isCloudSynced ? 'Sincronizado con Supabase Cloud' : 'Operando en modo local (Offline)'}
        >
          <Cloud size={18} />
        </div>

        {/* Theme Toggle Button (Light / Dark) */}
        <button 
          type="button"
          className="qty-btn" 
          onClick={onToggleTheme}
          title={theme === 'light' ? 'Cambiar a Modo Oscuro' : 'Cambiar a Modo Claro'}
          style={{ width: '34px', height: '34px', padding: 0 }}
        >
          {theme === 'light' ? (
            <Moon size={16} style={{ color: 'var(--accent-indigo, #6366f1)' }} />
          ) : (
            <Sun size={16} style={{ color: 'var(--accent-amber)' }} />
          )}
        </button>

        {/* Settings Modal Button */}
        <button 
          type="button"
          className="qty-btn" 
          onClick={onOpenSettings}
          title="Configuración general e impresión"
          style={{ width: '34px', height: '34px', padding: 0 }}
        >
          <Settings size={16} />
        </button>

        {/* Fullscreen Toggle (Desktop Only) */}
        <button 
          type="button"
          className="qty-btn desktop-only-action" 
          onClick={toggleFullscreen}
          title="Pantalla completa"
          style={{ width: '34px', height: '34px', padding: 0 }}
        >
          <Maximize2 size={16} />
        </button>
      </div>
    </header>

    {/* MOBILE BOTTOM NAVIGATION BAR */}
    <nav className="mobile-bottom-nav">
      <button 
        type="button"
        className={`mobile-nav-item ${currentTab === 'pos' ? 'active' : ''}`}
        onClick={() => setCurrentTab('pos')}
      >
        <ShoppingCart size={19} />
        <span>Mostrador</span>
      </button>

      <button 
        type="button"
        className={`mobile-nav-item ${currentTab === 'kds' ? 'active' : ''}`}
        onClick={() => setCurrentTab('kds')}
      >
        <div className="mobile-nav-icon-container">
          <ChefHat size={19} />
          {pendingKitchenCount > 0 && (
            <span className="mobile-nav-badge">{pendingKitchenCount}</span>
          )}
        </div>
        <span>Cocina</span>
      </button>

      <button 
        type="button"
        className={`mobile-nav-item ${currentTab === 'history' ? 'active' : ''}`}
        onClick={() => setCurrentTab('history')}
      >
        <History size={19} />
        <span>Historial</span>
      </button>

      <button 
        type="button"
        className={`mobile-nav-item ${currentTab === 'menu' ? 'active' : ''}`}
        onClick={() => setCurrentTab('menu')}
      >
        <UtensilsCrossed size={19} />
        <span>Menú</span>
      </button>
    </nav>
    </>
  );
}
