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
    return hash === '#admin' || hash === '#dueno' || hash === '#dueño' || hash === '#auditoria' || search.includes('portal=admin') || search.includes('portal=dueno');
  });

  // Secret URL listener and secret keyboard shortcut (Ctrl + Shift + D)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      const isMatch = hash === '#admin' || hash === '#dueno' || hash === '#dueño' || hash === '#auditoria' || search.includes('portal=admin') || search.includes('portal=dueno');
      setIsOwnerPortalRoute(isMatch);
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    window.addEventListener('popstate', handleHash);

    // Secret shortcut: Ctrl + Shift + D (Dueño)
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

  // Sincronización en tiempo real de pedidos (WhatsApp Bot + Chatbot Lab directo a Cocina)
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

    // 2. Polling activo con backoff inteligente contra el microservicio WhatsApp (puerto 3002)
    let isPolling = false;
    let pollTimer = null;
    let consecutiveOfflineErrors = 0;

    const pollOrders = async () => {
      if (isPolling) return;
      isPolling = true;
      let nextDelay = 2500;

      try {
        const botHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
        const res = await fetch(`http://${botHost}:3002/api/orders/pending`);
        if (res.ok) {
          consecutiveOfflineErrors = 0;
          nextDelay = 2500;
          const data = await res.json();
          if (data && Array.isArray(data.orders) && data.orders.length > 0) {
            const ackIds = [];
            for (const ord of data.orders) {
              const saved = storageService.saveOrder(ord);
              ackIds.push(ord.id);
              if (supabaseSync.isConfigured()) {
                supabaseSync.pushOrder(saved);
              }
            }

            // Actualizar estado de pedidos en el POS
            setOrders(storageService.getOrders());

            // Alerta sonora en cocina y caja
            audioService.playOrderChime();

            // Animación de celebración
            try {
              confetti({
                particleCount: 60,
                spread: 70,
                origin: { y: 0.7 }
              });
            } catch (_) {}

            // Confirmar al servidor que los pedidos ya fueron incorporados
            const botHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
            await fetch(`http://${botHost}:3002/api/orders/ack`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: ackIds })
            });
          }
        } else {
          consecutiveOfflineErrors++;
          if (consecutiveOfflineErrors >= 2) nextDelay = 10000;
        }
      } catch (_) {
        // Microservicio no disponible o inactivo temporalmente: espaciar reintentos a 10s
        consecutiveOfflineErrors++;
        if (consecutiveOfflineErrors >= 2) nextDelay = 10000;
      } finally {
        isPolling = false;
        pollTimer = setTimeout(pollOrders, nextDelay);
      }
    };

    pollTimer = setTimeout(pollOrders, 1500);

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

    if (newStatus === 'listo') {
      audioService.playReadyBell();
    }
  };

  const handleDeleteOrder = (orderId) => {
    storageService.deleteOrder(orderId);
    setOrders(storageService.getOrders());
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
