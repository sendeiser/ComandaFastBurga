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
import CashierLogin from './components/pos/CashierLogin';
import { chatbotService } from './services/chatbotService';
import { authService } from './services/authService';
import { storageService } from './services/storageService';
import { audioService } from './services/audioService';
import { printerService } from './services/printerService';
import { supabaseSync } from './services/supabaseClient';

const isLocalEnv = () => {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  const isLocalHost = h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') || h.startsWith('10.');
  const isHttp = window.location.protocol === 'http:';
  return isLocalHost && isHttp;
};

export default function App() {
  const [currentTab, setCurrentTab] = useState('pos'); // 'pos' | 'kds' | 'history' | 'menu'
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cashShift, setCashShift] = useState(null);
  const [settings, setSettings] = useState(null);
  const [currentCashier, setCurrentCashier] = useState(() => authService.getCurrentCashier());

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

  // Theme state ('light' as primary default | 'dark')
  const [theme, setTheme] = useState(() => {
    const initialized = localStorage.getItem('comandafast_theme_primary_v1');
    if (!initialized) {
      localStorage.setItem('comandafast_theme_primary_v1', 'true');
      localStorage.setItem('comandafast_theme', 'light');
      return 'light';
    }
    return localStorage.getItem('comandafast_theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = theme + '-theme';
    localStorage.setItem('comandafast_theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // CARGA INICIAL CLOUD-FIRST: La nube es la fuente de verdad
  useEffect(() => {
    // Mostrar cache local inmediatamente para UI responsiva
    setProducts(storageService.getProducts());
    setOrders(storageService.getOrders());
    setCashShift(storageService.getCashShift());
    setSettings(storageService.getSettings());

    // Luego reemplazar con datos reales de la nube
    (async () => {
      if (!supabaseSync.isConfigured()) return;

      const [
        cloudProds, 
        cloudOrders, 
        cloudShift, 
        cloudSettings, 
        cloudCashiers, 
        cloudBotVars, 
        latestOrderNum,
        cloudCategories,
        cloudTemplates,
        cloudFlows
      ] = await Promise.all([
        supabaseSync.fetchProducts(),
        supabaseSync.fetchOrders(300),
        supabaseSync.fetchLatestCashShift(),
        supabaseSync.fetchSettings(),
        supabaseSync.fetchCashiers(),
        supabaseSync.fetchBotVariables(),
        supabaseSync.fetchLatestOrderNumber(),
        supabaseSync.fetchCategories(),
        supabaseSync.fetchBotTemplates(),
        supabaseSync.fetchBotFlows()
      ]);

      if (latestOrderNum && latestOrderNum > 0) {
        storageService.updateOrderCounterIfHigher(latestOrderNum);
      }

      if (Array.isArray(cloudProds) && cloudProds.length > 0) {
        setProducts(cloudProds);
        storageService.saveProducts(cloudProds);
      }

      if (cloudOrders && cloudOrders.length > 0) {
        const validOrders = cloudOrders.filter(o => o && !storageService.isOrderDeleted(o.id));
        storageService.saveOrdersBatch(validOrders);
        setOrders(storageService.getOrders());
      }

      if (cloudShift) {
        storageService.saveCashShift(cloudShift);
        setCashShift(cloudShift);
      }

      if (cloudSettings) {
        storageService.saveSettings(cloudSettings);
        setSettings(cloudSettings);
      }

      if (Array.isArray(cloudCashiers) && cloudCashiers.length > 0) {
        authService.syncCashiersFromCloud(cloudCashiers);
      }

      if (Array.isArray(cloudCategories) && cloudCategories.length > 0) {
        storageService.saveCategories(cloudCategories);
      }

      if (cloudBotVars) {
        chatbotService.saveBotVariables(cloudBotVars);
      }

      if (cloudTemplates) {
        chatbotService.saveSettings(cloudTemplates);
      }

      if (Array.isArray(cloudFlows) && cloudFlows.length > 0) {
        chatbotService.saveCustomFlows(cloudFlows);
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
    const handleCashShiftChange = () => setCashShift(storageService.getCashShift());
    window.addEventListener('comandafast:cash-shift-change', handleCashShiftChange);

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

        // A. Consultar Servidor Local LAN (puerto 3002) solo en red local / HTTP
        if (isLocalEnv()) {
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
        }

        // B. Consultar Supabase Cloud (SIEMPRE — fuente de verdad global)
        if (supabaseSync.isConfigured()) {
          try {
            const fetched = await supabaseSync.fetchRecentOrders(150);
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
          if (!ord || !ord.id) continue;
          if (storageService.isOrderDeleted(ord.id)) {
            // Asegurar que el servidor local lo elimine si todavía lo retenía
            if (isLocalEnv()) {
              fetch(`http://${botHost}:3002/api/orders/${ord.id}`, { method: 'DELETE' }).catch(() => {});
            }
            continue;
          }
          mergedMap.set(ord.id, { ...ord, _source: 'local' });
        }

        for (const cord of cloudOrders) {
          if (!cord || !cord.id) continue;
          if (storageService.isOrderDeleted(cord.id)) {
            // Asegurar que Supabase lo elimine si todavía lo devolvió
            supabaseSync.deleteOrder(cord.id).catch(() => {});
            continue;
          }
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
            if (ord && ord.orderNumber) {
              storageService.updateOrderCounterIfHigher(ord.orderNumber, ord.createdAt);
            }
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

          // D. Sincronización de borrado: Si Supabase es la fuente de verdad y devolvió órdenes activas,
          // podar del almacenamiento local las órdenes que ya fueron eliminadas permanentemente en la nube.
          if (supabaseSync.isConfigured() && cloudOrders.length > 0) {
            const cloudIds = new Set(cloudOrders.map(c => c.id));
            const localList = storageService.getOrders();
            const now = Date.now();
            let localPruned = false;

            const remainingLocal = localList.filter(o => {
              if (!o || !o.id) return false;
              if (cloudIds.has(o.id)) return true;
              const age = now - (o.createdAt ? new Date(o.createdAt).getTime() : now);
              if (age < 40000) return true;
              storageService.markOrderDeleted(o.id);
              localPruned = true;
              return false;
            });

            if (localPruned) {
              try {
                localStorage.setItem('comandafast_orders', JSON.stringify(remainingLocal));
                setOrders(remainingLocal);
              } catch (_) {}
            }
          }

          // D2. Actualizar vista React con estado actual de localStorage (merge)
          if (hasChanges) {
            setOrders([...storageService.getOrders()]);
          }

          if (hasNewPending) {
            audioService.playOrderChime();
            try {
              confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
            } catch (_) {}
          }
        }

        // E. Sincronización de Caja Abierta (Cash Shift) en tiempo real con Supabase
        try {
          let cloudShifts = [];
          if (supabaseSync.isConfigured()) {
            cloudShifts = await supabaseSync.fetchCashShifts(25);
          }

          let remoteActiveShift = cloudShifts.find(s => !s.isClosed) || null;

          if (!remoteActiveShift && localServerOnline) {
            try {
              const csRes = await fetch(`http://${botHost}:3002/api/cash-shift`);
              if (csRes.ok) {
                const csData = await csRes.json();
                if (csData && csData.cashShift && !csData.cashShift.isClosed) {
                  remoteActiveShift = csData.cashShift;
                }
              }
            } catch (_) {}
          }

          if (cloudShifts.length > 0) {
            storageService.syncCashShiftsFromCloud(cloudShifts);
          }

          const localShift = storageService.getCashShift();

          if (remoteActiveShift) {
            // Caso 1: Hay un turno activo abierto en la base de datos
            if (!localShift || localShift.id !== remoteActiveShift.id || localShift.isClosed) {
              storageService.saveCashShift(remoteActiveShift);
              setCashShift(remoteActiveShift);
            } else if (localShift && remoteActiveShift.id === localShift.id) {
              if ((remoteActiveShift.expenses?.length || 0) > (localShift.expenses?.length || 0)) {
                storageService.saveCashShift(remoteActiveShift);
                setCashShift(remoteActiveShift);
              }
            }
          } else {
            // Caso 2: En la base de datos NO hay turno abierto (Caja Cerrada)
            if (localShift && !localShift.isClosed) {
              const closedMatch = cloudShifts.find(s => s.id === localShift.id) || cloudShifts[0];
              const closedShift = {
                ...localShift,
                isClosed: true,
                closedAt: closedMatch?.closedAt || new Date().toISOString(),
                countedCash: closedMatch?.countedCash !== undefined && closedMatch?.countedCash !== null ? closedMatch.countedCash : localShift.initialCash,
                difference: closedMatch?.difference !== undefined && closedMatch?.difference !== null ? closedMatch.difference : 0,
                notes: closedMatch?.notes || localShift.notes
              };
              storageService.saveCashShift(closedShift);
              setCashShift(closedShift);

              const history = storageService.getCashShiftsHistory();
              if (!history.some(h => h.id === closedShift.id)) {
                history.unshift(closedShift);
                storageService.saveCashShiftsHistory(history);
              }
            }
          }
        } catch (_) {}

        // F. Sincronización en tiempo real del estado del contador de órdenes desde la Nube
        if (supabaseSync.isConfigured()) {
          try {
            await supabaseSync.fetchOrderCounterState();
          } catch (_) {}
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
      window.removeEventListener('comandafast:cash-shift-change', handleCashShiftChange);
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, []);

  const handleReorderOrder = (orderId, direction) => {
    const updated = storageService.reorderOrders(orderId, direction);
    setOrders(updated);
  };

  const pendingKitchenCount = orders.filter(o => o.status === 'pendiente' || o.status === 'cocina').length;

  // Handlers
  const handleSaveOrder = async (orderData) => {
    if (!cashShift || cashShift.isClosed) {
      alert('⚠️ La caja está cerrada. Debes abrir el turno de caja antes de registrar un pedido.');
      setIsCashModalOpen(true);
      return;
    }

    // Sincronizar número correlativo con la DB para continuar desde el último pedido realizado
    if (!orderData.orderNumber) {
      orderData.orderNumber = await storageService.getNextOrderNumberAsync();
    }

    const savedOrder = storageService.saveOrder(orderData);
    setOrders(storageService.getOrders());
    
    // Sync to Supabase CLOUD (fuente de verdad)
    supabaseSync.createOrder(savedOrder);

    // Sync to Local WhatsApp Bot / LAN Microservice (puerto 3002) solo en red local
    if (isLocalEnv()) {
      try {
        const botHost = window.location.hostname || 'localhost';
        fetch(`http://${botHost}:3002/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(savedOrder)
        }).catch(() => {});
      } catch (_) {}
    }

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
    const updatedOrder = storageService.updateOrderStatus(orderId, newStatus);
    setOrders(storageService.getOrders());
    // Push status + timestamps directamente a Supabase
    supabaseSync.updateOrderStatus(orderId, newStatus, updatedOrder?.statusTimestamps || {});

    // Sync status to Local Server (puerto 3002) solo en red local
    if (isLocalEnv()) {
      try {
        const botHost = window.location.hostname || 'localhost';
        fetch(`http://${botHost}:3002/api/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus, order: updatedOrder })
        }).catch(() => {});
      } catch (_) {}
    }

    if (newStatus === 'listo') {
      audioService.playReadyBell();
    }
  };

  const handleDeleteOrder = async (orderId) => {
    storageService.deleteOrder(orderId);
    setOrders(storageService.getOrders());
    // Eliminar permanentemente de Supabase Cloud y del servidor local de forma segura
    const promises = [supabaseSync.deleteOrder(orderId)];
    if (isLocalEnv()) {
      const botHost = window.location.hostname || 'localhost';
      promises.push(fetch(`http://${botHost}:3002/api/orders/${orderId}`, { method: 'DELETE' }).catch(() => {}));
    }
    await Promise.allSettled(promises);
  };

  const handleSaveProducts = async (newProducts) => {
    // Detectar productos eliminados para purgarlos permanentemente de Supabase Cloud
    const currentIds = new Set(newProducts.map(p => p.id));
    const deletedProducts = products.filter(p => p && p.id && !currentIds.has(p.id));
    for (const del of deletedProducts) {
      supabaseSync.deleteProduct(del.id).catch(() => {});
    }

    storageService.saveProducts(newProducts);
    setProducts(newProducts);
    // Upsert completo a Supabase Cloud (fuente de verdad de productos)
    await supabaseSync.pushProducts(newProducts);
  };

  const handleSaveSettings = (newSettings) => {
    storageService.saveSettings(newSettings);
    setSettings(newSettings);
    supabaseSync.saveSettings(newSettings);
  };

  const handleCashierLoginSuccess = (cashier) => {
    setCurrentCashier(cashier);
  };

  const handleLogoutCashier = () => {
    authService.logoutCashier();
    setCurrentCashier(null);
  };

  // Cash Handlers (Sincronización Total con Supabase y Red Local)
  const handleOpenShift = async (initialAmount, cashierName, resetCounter = false) => {
    const activeCashierName = currentCashier?.name || cashierName || 'Cajero 1';
    const shift = storageService.openCashShift(initialAmount, activeCashierName);
    setCashShift(shift);

    // Reiniciar contador de órdenes a 0 y sincronizar con la nube si se solicitó al abrir caja
    if (resetCounter) {
      const nowIso = new Date().toISOString();
      storageService.resetOrderCounter(0, nowIso);
      if (supabaseSync.isConfigured()) {
        try {
          await supabaseSync.pushOrderCounterState({ counter: 0, lastResetAt: nowIso });
        } catch (_) {}
      }
      if (isLocalEnv()) {
        try {
          const botHost = window.location.hostname || 'localhost';
          fetch(`http://${botHost}:3002/api/order-counter/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ counter: 0, lastResetAt: nowIso })
          }).catch(() => {});
        } catch (_) {}
      }
    }

    if (supabaseSync.isConfigured()) {
      try {
        await supabaseSync.pushCashShift(shift);
      } catch (_) {}
    }
    if (isLocalEnv()) {
      try {
        const botHost = window.location.hostname || 'localhost';
        fetch(`http://${botHost}:3002/api/cash-shift`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cashShift: shift })
        }).catch(() => {});
      } catch (_) {}
    }
  };

  const handleAddExpense = async (amount, reason) => {
    const shift = storageService.addCashExpense(amount, reason);
    setCashShift(shift);
    if (supabaseSync.isConfigured() && shift) {
      try {
        await supabaseSync.pushCashShift(shift);
      } catch (_) {}
    }
    if (isLocalEnv()) {
      try {
        const botHost = window.location.hostname || 'localhost';
        fetch(`http://${botHost}:3002/api/cash-shift`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cashShift: shift })
        }).catch(() => {});
      } catch (_) {}
    }
  };

  const handleCloseShift = async (countedCash, notes) => {
    const shift = storageService.closeCashShift(countedCash, notes);
    setCashShift(shift);
    if (supabaseSync.isConfigured() && shift) {
      try {
        await supabaseSync.pushCashShift(shift);
      } catch (_) {}
    }
    if (isLocalEnv()) {
      try {
        const botHost = window.location.hostname || 'localhost';
        fetch(`http://${botHost}:3002/api/cash-shift`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cashShift: shift })
        }).catch(() => {});
      } catch (_) {}
    }
  };

  const handleRefreshAllSystem = async () => {
    // ACTUALIZAR DIRECTO DESDE LA BASE DE DATOS (Supabase Cloud - 100% Fuente de Verdad)
    if (supabaseSync && supabaseSync.isConfigured()) {
      try {
        const [
          cloudProds, 
          cloudOrders, 
          cloudShift, 
          cloudSettings, 
          cloudCashiers, 
          cloudBotVars, 
          latestOrderNum, 
          cloudShiftsHistory,
          cloudCategories,
          cloudTemplates,
          cloudFlows
        ] = await Promise.allSettled([
          supabaseSync.fetchProducts(),
          supabaseSync.fetchOrders(500),
          supabaseSync.fetchLatestCashShift(),
          supabaseSync.fetchSettings(),
          supabaseSync.fetchCashiers(),
          supabaseSync.fetchBotVariables(),
          supabaseSync.fetchLatestOrderNumber(),
          supabaseSync.fetchCashShifts(100),
          supabaseSync.fetchCategories(),
          supabaseSync.fetchBotTemplates(),
          supabaseSync.fetchBotFlows()
        ]);

        if (latestOrderNum.status === 'fulfilled' && latestOrderNum.value && latestOrderNum.value > 0) {
          storageService.updateOrderCounterIfHigher(latestOrderNum.value);
        }

        if (cloudProds.status === 'fulfilled' && Array.isArray(cloudProds.value) && cloudProds.value.length > 0) {
          setProducts(cloudProds.value);
          storageService.saveProducts(cloudProds.value);
        }

        if (cloudOrders.status === 'fulfilled' && Array.isArray(cloudOrders.value)) {
          const validOrders = cloudOrders.value.filter(o => o && !storageService.isOrderDeleted(o.id));
          storageService.saveOrdersBatch(validOrders);
          setOrders(storageService.getOrders());
        }

        if (cloudShift.status === 'fulfilled' && cloudShift.value) {
          storageService.saveCashShift(cloudShift.value);
          setCashShift(cloudShift.value);
        }

        if (cloudShiftsHistory.status === 'fulfilled' && Array.isArray(cloudShiftsHistory.value) && cloudShiftsHistory.value.length > 0) {
          storageService.syncCashShiftsFromCloud(cloudShiftsHistory.value);
        }

        if (cloudSettings.status === 'fulfilled' && cloudSettings.value) {
          storageService.saveSettings(cloudSettings.value);
          setSettings(cloudSettings.value);
        }

        if (cloudCashiers.status === 'fulfilled' && Array.isArray(cloudCashiers.value) && cloudCashiers.value.length > 0) {
          authService.syncCashiersFromCloud(cloudCashiers.value);
        }

        if (cloudCategories.status === 'fulfilled' && Array.isArray(cloudCategories.value) && cloudCategories.value.length > 0) {
          storageService.saveCategories(cloudCategories.value);
        }

        if (cloudBotVars.status === 'fulfilled' && cloudBotVars.value) {
          chatbotService.saveBotVariables(cloudBotVars.value);
        }

        if (cloudTemplates.status === 'fulfilled' && cloudTemplates.value) {
          chatbotService.saveSettings(cloudTemplates.value);
        }

        if (cloudFlows.status === 'fulfilled' && Array.isArray(cloudFlows.value) && cloudFlows.value.length > 0) {
          chatbotService.saveCustomFlows(cloudFlows.value);
        }
      } catch (err) {
        console.warn('[handleRefreshAllSystem] Error actualizando base de datos:', err);
      }
    }

    // 2. Sincronizar desde Servidor Local LAN (solo si estamos en red local / HTTP)
    if (isLocalEnv()) {
      try {
        const botHost = window.location.hostname || 'localhost';
        const [ordersRes, shiftRes] = await Promise.allSettled([
          fetch(`http://${botHost}:3002/api/orders?since=0`).then(r => r.ok ? r.json() : null),
          fetch(`http://${botHost}:3002/api/cash-shift`).then(r => r.ok ? r.json() : null)
        ]);

        if (ordersRes.status === 'fulfilled' && ordersRes.value?.orders && Array.isArray(ordersRes.value.orders)) {
          const validOrders = ordersRes.value.orders.filter(o => o && !storageService.isOrderDeleted(o.id));
          storageService.saveOrdersBatch(validOrders);
        }

        if (shiftRes.status === 'fulfilled' && shiftRes.value?.cashShift) {
          storageService.saveCashShift(shiftRes.value.cashShift);
          setCashShift(shiftRes.value.cashShift);
        }
      } catch (_) {}
    }

    // 3. Forzar actualización de estados locales de React con los datos de BD
    setOrders(storageService.getOrders());
    setProducts(storageService.getProducts());
    setCashShift(storageService.getCashShift());
    setSettings(storageService.getSettings());

    // 4. Notificar a toda la aplicación mediante CustomEvents
    window.dispatchEvent(new CustomEvent('comandafast:orders_updated'));
    window.dispatchEvent(new CustomEvent('comandafast:shifts_updated'));
    window.dispatchEvent(new CustomEvent('comandafast:cash-shift-change'));
    window.dispatchEvent(new CustomEvent('comandafast:categories_updated'));
    window.dispatchEvent(new CustomEvent('comandafast:products_updated'));
    window.dispatchEvent(new CustomEvent('comandafast:system_refreshed'));
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
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onRefreshSystem={handleRefreshAllSystem}
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

  // CASHIER LOGIN GATE: Solo pueden entrar los cajeros con credenciales válidas
  if (!currentCashier) {
    return (
      <CashierLogin 
        onLoginSuccess={handleCashierLoginSuccess}
        onOpenOwner={() => {
          window.location.hash = '#dueno';
          setIsOwnerPortalRoute(true);
        }}
      />
    );
  }

  return (
    <div className="app-layout">
      <Header 
        currentCashier={currentCashier}
        onLogoutCashier={handleLogoutCashier}
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
            cashShift={cashShift}
            onOpenCashModal={() => setIsCashModalOpen(true)}
          />
        )}

        {currentTab === 'kds' && (
          <KitchenDisplay 
            orders={orders}
            onUpdateStatus={handleUpdateOrderStatus}
            onReprintTicket={(order, type) => setPreviewOrder(order)}
            onReorderOrder={handleReorderOrder}
          />
        )}

        {currentTab === 'history' && (
          <OrderHistory 
            orders={orders}
            onViewTickets={(order) => setPreviewOrder(order)}
            onDeleteOrder={handleDeleteOrder}
            onUpdateStatus={handleUpdateOrderStatus}
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
          currentCashier={currentCashier}
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




