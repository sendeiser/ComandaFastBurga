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
          onClose={() => setPreviewOrder(null)}
        />
      )}
    </div>
  );
}
