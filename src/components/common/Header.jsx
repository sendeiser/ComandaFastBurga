import React from 'react';
import { Flame, ShoppingCart, ChefHat, DollarSign, History, UtensilsCrossed, Settings, Maximize2, CheckCircle2, AlertCircle, Database, Cloud } from 'lucide-react';
import { printerService } from '../../services/printerService';
import { supabaseSync } from '../../services/supabaseClient';

export default function Header({ 
  currentTab, 
  setCurrentTab, 
  pendingKitchenCount, 
  cashShift, 
  settings,
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
          <Flame size={24} />
        </div>
        <div>
          <div className="brand-name">
            COMANDA<span style={{ color: 'var(--accent-amber)' }}>FAST</span>
            <span className="brand-badge">POS & KDS</span>
          </div>
        </div>
      </div>

      <nav className="nav-tabs">
        <button 
          className={`nav-tab-btn ${currentTab === 'pos' ? 'active' : ''}`}
          onClick={() => setCurrentTab('pos')}
        >
          <ShoppingCart size={18} />
          <span>Mostrador</span>
        </button>

        <button 
          className={`nav-tab-btn ${currentTab === 'kds' ? 'active' : ''}`}
          onClick={() => setCurrentTab('kds')}
        >
          <ChefHat size={18} />
          <span>Cocina / KDS</span>
          {pendingKitchenCount > 0 && (
            <span className="nav-badge-count">{pendingKitchenCount}</span>
          )}
        </button>

        <button 
          className={`nav-tab-btn ${currentTab === 'history' ? 'active' : ''}`}
          onClick={() => setCurrentTab('history')}
        >
          <History size={18} />
          <span>Historial</span>
        </button>

        <button 
          className={`nav-tab-btn ${currentTab === 'menu' ? 'active' : ''}`}
          onClick={() => setCurrentTab('menu')}
        >
          <UtensilsCrossed size={18} />
          <span>Menú</span>
        </button>
      </nav>

      <div className="header-right-actions">
        {/* Cash Drawer Kick Button */}
        <button 
          type="button" 
          className="qty-btn"
          style={{ width: 'auto', padding: '0.4rem 0.75rem', gap: '4px', color: 'var(--accent-emerald)' }}
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
            <span>Caja Abierta (${cashShift.initialCash.toLocaleString('es-AR')})</span>
          </div>
        ) : (
          <div className="shift-status-pill closed" onClick={onOpenCashModal} title="Click para abrir turno de caja">
            <AlertCircle size={16} />
            <span>Caja Cerrada</span>
          </div>
        )}

        {/* Cloud Status */}
        <div 
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

        <button 
          className="nav-tab-btn" 
          onClick={onOpenSettings}
          title="Configuración general e impresión"
          style={{ padding: '0.5rem 0.75rem' }}
        >
          <Settings size={18} />
        </button>

        <button 
          className="nav-tab-btn" 
          onClick={toggleFullscreen}
          title="Pantalla completa"
          style={{ padding: '0.5rem 0.75rem' }}
        >
          <Maximize2 size={18} />
        </button>
      </div>
    </header>
  );
}
