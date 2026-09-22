import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import Header from './components/common/Header';
import FastOrderPad from './components/pos/FastOrderPad';
import KitchenDisplay from './components/pos/KitchenDisplay';
import CashControlModal from './components/pos/CashControlModal';
import TicketPreviewModal from './components/pos/TicketPreviewModal';
import OrderHistory from './components/pos/OrderHistory';
import MenuManagement from './components/pos/MenuManagement';
import SettingsModal from './components/pos/SettingsModal';
import OwnerAuditPortal from './components/admin/OwnerAuditPortal';
import OwnerLogin from './components/admin/OwnerLogin';
import { authService } from './services/authService';
import { storageService } from './services/storageService';
import { audioService } from './services/audioService';
import { printerService } from './services/printerService';
import { supabaseSync } from './services/supabaseClient';

export default function App() {
  const [currentTab, setCurrentTab] = useState('pos'); // 'pos' | 'kds' | 'history' | 'menu'
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cashShift, setCashShift] = useState(null);
  const [settings, setSettings] = useState(null);

  // Owner authentication & secret portal state
  const [isOwnerAuthenticated, setIsOwnerAuthenticated] = useState(() => authService.isAuthenticated());
  const [isOwnerPortalRoute, setIsOwnerPortalRoute] = useState(() => {
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return hash === '#admin' || hash === '#dueno' || hash === '#dueÃ±o' || hash === '#auditoria' || search.includes('portal=admin') || search.includes('portal=dueno');
  });

  // Secret URL listener and secret keyboard shortcut (Ctrl + Shift + D)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      const isMatch = hash === '#admin' || hash === '#dueno' || hash === '#dueÃ±o' || hash === '#auditoria' || search.includes('portal=admin') || search.includes('portal=dueno');
      setIsOwnerPortalRoute(isMatch);
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    window.addEventListener('popstate', handleHash);

    // Secret shortcut: Ctrl + Shift + D (DueÃ±o)
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd' || e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setIsOwnerPortalRoute(prev => {
          const next = !prev;
          if (next) {
            window.location.hash = '#dueno';
          } else {
            window.location.hash = '';
          }
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('popstate', handleHash);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleExitOwnerPortal = () => {
    window.location.hash = '';
    setIsOwnerPortalRoute(false);
    setCurrentTab('pos');
  };

  const handleOwnerLogout = () => {
    authService.logout();
    setIsOwnerAuthenticated(false);
    handleExitOwnerPortal();
  };

  // Modals
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [previewOrder, setPreviewOrder] = useState(null);

  // Theme state ('dark' | 'light')
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('comandafast_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = theme + '-theme';
    localStorage.setItem('comandafast_theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Load initial data (Local first, then try Cloud)
  useEffect(() => {
    const localProds = storageService.getProducts();
    setProducts(localProds);
    setOrders(storageService.getOrders());
    setCashShift(storageService.getCashShift());
    setSettings(storageService.getSettings());

    // Try fetching from Supabase if configured
    (async () => {
      if (supabaseSync.isConfigured()) {
        const cloudProds = await supabaseSync.fetchProducts();
        if (cloudProds && cloudProds.length > 0) {
          setProducts(cloudProds);
          storageService.saveProducts(cloudProds);
        }
      }
    })();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F1') { e.preventDefault(); setCurrentTab('pos'); }
      if (e.key === 'F2') { e.preventDefault(); setCurrentTab('kds'); }
      if (e.key === 'F3') { e.preventDefault(); setCurrentTab('history'); }
      if (e.key === 'F4') { e.preventDefault(); setCurrentTab('menu'); }
      if (e.key === 'F5') { e.preventDefault(); setIsCashModalOpen(true); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // SincronizaciÃ³n en tiempo real de pedidos (WhatsApp Bot + Chatbot Lab directo a Cocina)
  useEffect(() => {
    // 1. Escuchar pedidos inyectados internamente desde el Chatbot Lab
    const handleInternalOrder = () => {
      setOrders(storageService.getOrders());
      audioService.playOrderChime();
    };
    window.addEventListener('comandafast:new-order', handleInternalOrder);

    const handleStorageChange = (e) => {
      if (e.key === 'comandafast_orders') {
        setOrders(storageService.getOrders());
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 2. POLLING HIBRIDO — SINCRONIZACION BIDIRECCIONAL COMPLETA
    // Web<->Web, App<->Web, Web<->App: Supabase Cloud es la fuente de verdad global.
    let isPolling = false;
    let pollTimer = null;
    let consecutiveOfflineErrors = 0;

    const STATUS_PRIORITY = { pendiente: 0, cocina: 1, listo: 2, entregado: 3, cancelado: 4 };

    const getTs = (ord) => {
      if (ord.updatedAt && typeof ord.updatedAt === 'number') return ord.updatedAt;
      if (ord.updatedAt) return new Date(ord.updatedAt).getTime();
      if (ord.createdAt) return new Date(ord.createdAt).getTime();
      return 0;
    };

    const pollOrders = async () => {
      if (isPolling) return;
      isPolling = true;
      let nextDelay = 2000;

      try {
        const localOrders = [];
        const cloudOrders = [];
        const botHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
        let localServerOnline = false;

        // A. Consultar Servidor Local LAN (puerto 3002)
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          const res = await fetch(`http://${botHost}:3002/api/orders`, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            consecutiveOfflineErrors = 0;
            localServerOnline = true;
            const data = await res.json();
            if (data && Array.isArray(data.orders)) {
              for (const ord of data.orders) {
                if (ord && ord.id) localOrders.push(ord);
              }
            }
          }
        } catch (_) {}

        // B. Consultar Supabase Cloud (SIEMPRE — fuente de verdad global)
        if (supabaseSync.isConfigured()) {
          try {
            const fetched = await supabaseSync.fetchRecentOrders(50);
            if (Array.isArray(fetched)) {
              for (const cord of fetched) {
                if (cord && cord.id) cloudOrders.push(cord);
              }
            }
          } catch (_) {}
        }

        // C. MERGE INTELIGENTE: para cada ID, quedarse con la version mas reciente
        const mergedMap = new Map();

        for (const ord of localOrders) {
          mergedMap.set(ord.id, { ...ord, _source: 'local' });
        }

        for (const cord of cloudOrders) {
          const existing = mergedMap.get(cord.id);
          if (!existing) {
            mergedMap.set(cord.id, { ...cord, _source: 'cloud' });
          } else {
            const cloudTs = getTs(cord);
            const localTs = getTs(existing);
            const cloudPrio = STATUS_PRIORITY[cord.status] ?? -1;
            const localPrio = STATUS_PRIORITY[existing.status] ?? -1;
            if (cloudTs > localTs || (cloudTs === localTs && cloudPrio > localPrio)) {
              mergedMap.set(cord.id, { ...cord, _source: 'cloud' });
            }
          }
        }

        if (mergedMap.size > 0) {
          const currentOrders = storageService.getOrders();
          let hasNewPending = false;
          let hasChanges = false;

          for (const ord of mergedMap.values()) {
            const existing = currentOrders.find(o => o.id === ord.id);
            if (!existing) {
              // NUEVO PEDIDO DETECTADO
              const saved = storageService.saveOrder(ord);
              if (ord.status === 'pendiente' || ord.status === 'cocina') {
                hasNewPending = true;
              }
              hasChanges = true;

              // Cross-sync: nube -> servidor local
              if (ord._source === 'cloud' && localServerOnline) {
                try {
                  fetch(`http://${botHost}:3002/api/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(saved)
                  }).catch(() => {});
                } catch (_) {}
              }
              // Cross-sync: servidor local -> nube
              if (ord._source === 'local' && supabaseSync.isConfigured()) {
                supabaseSync.pushOrder(saved).catch(() => {});
              }

            } else if (existing.status !== ord.status) {
              // CAMBIO DE ESTADO DETECTADO
              const ordPrio = STATUS_PRIORITY[ord.status] ?? -1;
              const existPrio = STATUS_PRIORITY[existing.status] ?? -1;
              const ordTs = getTs(ord);
              const existTs = getTs(existing);

              if (ordTs > existTs || ordPrio > existPrio) {
                storageService.updateOrderStatus(ord.id, ord.status);
                hasChanges = true;

                if (ord.status === 'listo' && existing.status !== 'listo') {
                  audioService.playReadyBell();
                }

                // Cross-sync del cambio de estado
                if (ord._source === 'cloud' && localServerOnline) {
                  try {
                    fetch(`http://${botHost}:3002/api/orders/${ord.id}/status`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: ord.status })
                    }).catch(() => {});
                  } catch (_) {}
                }
                if (ord._source === 'local' && supabaseSync.isConfigured()) {
                  supabaseSync.updateOrderStatus(ord.id, ord.status).catch(() => {});
                }
              }
            }
          }

          if (hasChanges) {
            setOrders(storageService.getOrders());
          }

          if (hasNewPending) {
            audioService.playOrderChime();
            try {
              confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
            } catch (_) {}
          }
        }
      } catch (_) {
        consecutiveOfflineErrors++;
        if (consecutiveOfflineErrors >= 2) nextDelay = 5000;
      } finally {
        isPolling = false;
        pollTimer = setTimeout(pollOrders, nextDelay);
      }
    };

    pollTimer = setTimeout(pollOrders, 800);

    return () => {
      window.removeEventListener('comandafast:new-order', handleInternalOrder);
      window.removeEventListener('storage', handleStorageChange);
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, []);

  const pendingKitchenCount = orders.filter(o => o.status === 'pendiente' || o.status === 'cocina').length;

  // Handlers
  const handleSaveOrder = (orderData) => {
    const savedOrder = storageService.saveOrder(orderData);
    setOrders(storageService.getOrders());
    
    // Sync to Supabase in background
    supabaseSync.pushOrder(savedOrder);

    // Sync to Local WhatsApp Bot / LAN Microservice (puerto 3002) para replicaciÃ³n instantÃ¡nea a celulares Android
    try {
      const botHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
      fetch(`http://${botHost}:3002/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedOrder)
      }).catch(() => {});
    } catch (_) {}

    // Audio feedback
    audioService.playOrderChime();

    // Celebration confetti
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 }
      });
    } catch (e) {}

    // Auto open cash drawer if cash sale
    if (orderData.paymentMethod === 'efectivo') {
      printerService.kickCashDrawer(settings);
    }

    // Auto print or show preview
    if (orderData.autoPrint) {
      const kitchenHtml = printerService.getKitchenTicketHtml(savedOrder, settings);
      const customerHtml = printerService.getCustomerTicketHtml(savedOrder, settings);
      printerService.printHtml(`
        ${kitchenHtml}
        <div style="page-break-after: always; height: 16px;"></div>
        ${customerHtml}
      `);
    }
  };

  const handleUpdateOrderStatus = (orderId, newStatus) => {
    storageService.updateOrderStatus(orderId, newStatus);
    setOrders(storageService.getOrders());
    supabaseSync.updateOrderStatus(orderId, newStatus);

    // Sync status to Local Server (puerto 3002) para reflejar cambios en celulares conectados
    try {
      const botHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
      fetch(`http://${botHost}:3002/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      }).catch(() => {});
    } catch (_) {}

    if (newStatus === 'listo') {
      audioService.playReadyBell();
    }
  };

  const handleDeleteOrder = (orderId) => {
    storageService.deleteOrder(orderId);
    setOrders(storageService.getOrders());
    if (supabaseSync.isConfigured()) {
      supabaseSync.deleteOrder(orderId);
    }
    try {
      const botHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
      fetch(`http://${botHost}:3002/api/orders/${orderId}`, { method: 'DELETE' }).catch(() => {});
    } catch (_) {}
  };

  const handleSaveProducts = (newProducts) => {
    storageService.saveProducts(newProducts);
    setProducts(newProducts);
    // Sync to Supabase
    supabaseSync.pushProducts(newProducts);
  };

  const handleSaveSettings = (newSettings) => {
    storageService.saveSettings(newSettings);
    setSettings(newSettings);
  };

  // Cash Handlers
  const handleOpenShift = (initialAmount, cashierName) => {
    const shift = storageService.openCashShift(initialAmount, cashierName);
    setCashShift(shift);
  };

  const handleAddExpense = (amount, reason) => {
    const shift = storageService.addCashExpense(amount, reason);
    setCashShift(shift);
  };

  const handleCloseShift = (countedCash, notes) => {
    const shift = storageService.closeCashShift(countedCash, notes);
    setCashShift(shift);
  };

  if (!settings) return null;

  // SECRET OWNER AUDIT PORTAL (Completely independent page without POS header)
  if (isOwnerPortalRoute) {
    return (
      <div className="owner-portal-fullscreen" style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-primary)', padding: '1rem', overflowY: 'auto' }}>
        {isOwnerAuthenticated ? (
          <OwnerAuditPortal 
            orders={orders}
            onBackToPos={handleExitOwnerPortal}
            onLogout={handleOwnerLogout}
          />
        ) : (
          <OwnerLogin 
            onLoginSuccess={() => setIsOwnerAuthenticated(true)}
            onBackToPos={handleExitOwnerPortal}
          />
        )}
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Header 
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        pendingKitchenCount={pendingKitchenCount}
        cashShift={cashShift}
        settings={settings}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenCashModal={() => setIsCashModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      <main className="main-content">
        {currentTab === 'pos' && (
          <FastOrderPad 
            products={products}
            settings={settings}
            onSaveOrder={handleSaveOrder}
          />
        )}

        {currentTab === 'kds' && (
          <KitchenDisplay 
            orders={orders}
            onUpdateStatus={handleUpdateOrderStatus}
            onReprintTicket={(order, type) => setPreviewOrder(order)}
          />
        )}

        {currentTab === 'history' && (
          <OrderHistory 
            orders={orders}
            onViewTickets={(order) => setPreviewOrder(order)}
            onDeleteOrder={handleDeleteOrder}
          />
        )}

        {currentTab === 'menu' && (
          <MenuManagement 
            products={products}
            onSaveProducts={handleSaveProducts}
          />
        )}
      </main>

      {/* MODALS */}
      {isCashModalOpen && (
        <CashControlModal 
          cashShift={cashShift}
          orders={orders}
          onOpenShift={handleOpenShift}
          onAddExpense={handleAddExpense}
          onCloseShift={handleCloseShift}
          onClose={() => setIsCashModalOpen(false)}
        />
      )}

      {isSettingsModalOpen && (
        <SettingsModal 
          settings={settings}
          onSaveSettings={handleSaveSettings}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      )}

      {previewOrder && (
        <TicketPreviewModal 
          order={previewOrder}
          settings={settings}
          onUpdateSettings={setSettings}
          onClose={() => setPreviewOrder(null)}
        />
      )}
    </div>
  );
}
