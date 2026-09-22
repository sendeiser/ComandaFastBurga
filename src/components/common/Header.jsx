import React from 'react';
import { 
  Flame, 
  ShoppingCart, 
  ChefHat, 
  DollarSign, 
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
import { printerService } from '../../services/printerService';
import { supabaseSync } from '../../services/supabaseClient';

export default function Header({ 
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

  const handleOpenDrawer = () => {
    printerService.kickCashDrawer(settings);
  };

  return (
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

      <nav className="nav-tabs">
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
        {/* Cash Drawer Kick Button (Desktop Only) */}
        <button 
          type="button" 
          className="qty-btn desktop-only-action"
          style={{ width: 'auto', padding: '0.4rem 0.75rem', gap: '4px', color: 'var(--accent-emerald)', height: '34px' }}
          onClick={handleOpenDrawer}
          title="Abrir cajón de dinero (ESC/POS)"
        >
          <DollarSign size={16} />
          <span>Abrir Cajón</span>
        </button>

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
  );
}
