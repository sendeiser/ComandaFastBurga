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
  Keyboard 
} from 'lucide-react';
import { printerService } from '../../services/printerService';
import { supabaseSync } from '../../services/supabaseClient';
import { toastService } from '../../services/toastService';

export default function Header({ 
  currentTab, 
  setCurrentTab, 
  pendingKitchenCount, 
  cashShift, 
  settings,
  onOpenCashModal, 
  onOpenSettings,
  onOpenShortcuts
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
    toastService.success('Comando de apertura de cajón enviado');
  };

  return (
    <header className="top-header">
      {/* BRAND */}
      <div className="brand-section">
        <div className="brand-logo-icon">
          <Flame size={22} />
        </div>
        <div>
          <div className="brand-name">
            COMANDA<span style={{ color: 'var(--accent-amber)' }}>FAST</span>
            <span className="brand-badge">BURGA POS</span>
          </div>
        </div>
      </div>

      {/* TABS */}
      <nav className="nav-tabs">
        <button 
          type="button"
          className={`nav-tab-btn ${currentTab === 'pos' ? 'active' : ''}`}
          onClick={() => setCurrentTab('pos')}
          title="F1 / Mostrador"
        >
          <ShoppingCart size={17} />
          <span>Mostrador</span>
        </button>

        <button 
          type="button"
          className={`nav-tab-btn ${currentTab === 'kds' ? 'active' : ''}`}
          onClick={() => setCurrentTab('kds')}
          title="F2 / Cocina"
        >
          <ChefHat size={17} />
          <span>Cocina / KDS</span>
          {pendingKitchenCount > 0 && (
            <span className="nav-badge-count">{pendingKitchenCount}</span>
          )}
        </button>

        <button 
          type="button"
          className={`nav-tab-btn ${currentTab === 'history' ? 'active' : ''}`}
          onClick={() => setCurrentTab('history')}
          title="F3 / Historial"
        >
          <History size={17} />
          <span>Historial</span>
        </button>

        <button 
          type="button"
          className={`nav-tab-btn ${currentTab === 'menu' ? 'active' : ''}`}
          onClick={() => setCurrentTab('menu')}
          title="F4 / Menú"
        >
          <UtensilsCrossed size={17} />
          <span>Menú</span>
        </button>
      </nav>

      {/* RIGHT ACTIONS */}
      <div className="header-right-actions">
        {/* Open Drawer Button */}
        <button 
          type="button" 
          className="icon-action-btn"
          style={{ width: 'auto', padding: '0 0.75rem', gap: '6px', color: 'var(--accent-emerald)', fontWeight: 700 }}
          onClick={handleOpenDrawer}
          title="Abrir cajón de dinero"
        >
          <DollarSign size={16} />
          <span style={{ fontSize: '0.8rem' }}>Cajón</span>
        </button>

        {/* Shift status pill */}
        {cashShift && !cashShift.isClosed ? (
          <div 
            className="shift-status-pill" 
            onClick={onOpenCashModal} 
            title="Caja Abierta — Click para arqueo y control"
          >
            <CheckCircle2 size={15} />
            <span>Caja: ${cashShift.initialCash.toLocaleString('es-AR')}</span>
          </div>
        ) : (
          <div 
            className="shift-status-pill closed" 
            onClick={onOpenCashModal} 
            title="Caja Cerrada — Click para abrir turno"
          >
            <AlertCircle size={15} />
            <span>Caja Cerrada</span>
          </div>
        )}

        {/* Cloud Status */}
        <div 
          className="icon-action-btn"
          style={{ color: isCloudSynced ? 'var(--accent-blue)' : 'var(--text-muted)' }}
          onClick={onOpenSettings}
          title={isCloudSynced ? 'Sincronizado con Supabase Cloud' : 'Modo Local (Offline-first)'}
        >
          <Cloud size={18} />
        </div>

        {/* Shortcuts button */}
        <button 
          type="button"
          className="icon-action-btn" 
          onClick={onOpenShortcuts}
          title="Atajos de teclado rápidos"
        >
          <Keyboard size={18} />
        </button>

        {/* Settings button */}
        <button 
          type="button"
          className="nav-tab-btn" 
          onClick={onOpenSettings}
          title="Configuración de impresora y sistema"
          style={{ padding: '0.5rem 0.75rem' }}
        >
          <Settings size={18} />
        </button>

        {/* Fullscreen toggle */}
        <button 
          type="button"
          className="icon-action-btn" 
          onClick={toggleFullscreen}
          title="Pantalla completa"
        >
          <Maximize2 size={17} />
        </button>
      </div>
    </header>
  );
}
