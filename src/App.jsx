import React, { useState, useEffect } from 'react';
import Header from './components/common/Header';
import ToastContainer from './components/common/ToastContainer';
import ShortcutsHelpModal from './components/common/ShortcutsHelpModal';
import FastOrderPad from './components/pos/FastOrderPad';
import KitchenDisplay from './components/pos/KitchenDisplay';
import OrderHistory from './components/pos/OrderHistory';
import MenuManagement from './components/pos/MenuManagement';
import CashControlModal from './components/pos/CashControlModal';
import SettingsModal from './components/pos/SettingsModal';
import TicketPreviewModal from './components/pos/TicketPreviewModal';

import { storageService } from './services/storageService';
import { printerService } from './services/printerService';
import { supabaseSync } from './services/supabaseClient';
import { audioService } from './services/audioService';
import { toastService } from './services/toastService';

export default function App() {
  const [currentTab, setCurrentTab] = useState('pos'); // 'pos' | 'kds' | 'history' | 'menu'
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cashShift, setCashShift] = useState(null);
  const [settings, setSettings] = useState(null);

  // Modals state
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [previewOrder, setPreviewOrder] = useState(null);

  // Initialize data
  useEffect(() => {
    storageService.init();
    setProducts(storageService.getProducts());
    setOrders(storageService.getOrders());
    setCashShift(storageService.getCurrentCashShift());
    setSettings(storageService.getSettings());

    // Initialize Supabase realtime sync
    supabaseSync.init(
      (newOrder) => {
        setOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);
        audioService.playOrderChime();
        toastService.info(`Nueva orden #${newOrder.orderNumber} recibida`);
      },
      (orderId, status) => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      }
    );
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape closes modals
      if (e.key === 'Escape') {
        setIsCashModalOpen(false);
        setIsSettingsModalOpen(false);
        setIsShortcutsModalOpen(false);
        setPreviewOrder(null);
        return;
      }

      // F1 - F4 Navigation
      if (e.key === 'F1' || (e.altKey && e.key === '1')) { e.preventDefault(); setCurrentTab('pos'); }
      if (e.key === 'F2' || (e.altKey && e.key === '2')) { e.preventDefault(); setCurrentTab('kds'); }
      if (e.key === 'F3' || (e.altKey && e.key === '3')) { e.preventDefault(); setCurrentTab('history'); }
      if (e.key === 'F4' || (e.altKey && e.key === '4')) { e.preventDefault(); setCurrentTab('menu'); }

      // Alt+C for Cash Modal
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setIsCashModalOpen(prev => !prev);
      }

      // Alt+A for Drawer Kick
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (settings) printerService.kickCashDrawer(settings);
        toastService.success('Cajón de dinero abierto');
      }

      // Question mark or F10 for shortcuts
      if (e.key === 'F10' || (e.key === '?' && document.activeElement.tagName !== 'INPUT')) {
        e.preventDefault();
        setIsShortcutsModalOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings]);

  // Pending orders in kitchen
  const pendingKitchenCount = orders.filter(o => o.status === 'pendiente' || o.status === 'en_cocina').length;

  // Order Handlers
  const handleSaveOrder = (orderData) => {
    const savedOrder = storageService.saveOrder(orderData);
    setOrders(storageService.getOrders());

    // Sound chime
    audioService.playOrderChime();

    // Push to Supabase
    supabaseSync.pushOrder(savedOrder);

    // Auto print thermal ticket if enabled
    if (settings?.autoPrintOrders) {
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
    toastService.info('Orden eliminada');
  };

  const handleSaveProducts = (newProducts) => {
    storageService.saveProducts(newProducts);
    setProducts(newProducts);
    supabaseSync.pushProducts(newProducts);
    toastService.success('Menú actualizado correctamente');
  };

  const handleSaveSettings = (newSettings) => {
    storageService.saveSettings(newSettings);
    setSettings(newSettings);
    toastService.success('Ajustes guardados');
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
        onOpenCashModal={() => setIsCashModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
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

      {isShortcutsModalOpen && (
        <ShortcutsHelpModal 
          onClose={() => setIsShortcutsModalOpen(false)}
        />
      )}

      {/* FLOATING TOAST NOTIFICATIONS */}
      <ToastContainer />
    </div>
  );
}
