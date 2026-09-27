import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Database, Table, Upload, Search, Plus, Edit2, Trash2, Download, RefreshCw, 
  CheckCircle2, AlertTriangle, X, Save, Eye, DollarSign, ShoppingBag, 
  Clock, Store, ArrowUpDown, Filter, ChevronRight, Check, Sparkles,
  Smartphone, MapPin, Tag, FileText, UserCheck, ShieldAlert, Layers,
  ExternalLink, ArrowRight, Package, Receipt, AlertCircle, ChefHat, Bike
} from 'lucide-react';
import { storageService } from '../../../services/storageService';
import CategoryManagementModal from '../../pos/CategoryManagementModal';
import { supabaseSync } from '../../../services/supabaseClient';
import { chatbotService } from '../../../services/chatbotService';

// Helpers seguros para desanidar datos del cliente
function getCustomerName(customer) {
  if (!customer) return 'Cliente sin nombre';
  if (typeof customer === 'object') return customer.name || 'Cliente';
  return String(customer);
}

function getCustomerPhone(order) {
  if (!order) return '';
  if (order.phone) return String(order.phone);
  if (order.customer && typeof order.customer === 'object') return String(order.customer.phone || '');
  return '';
}

function getCustomerAddress(order) {
  if (!order) return '';
  if (order.address) return String(order.address);
  if (order.customer && typeof order.customer === 'object') return String(order.customer.address || '');
  return '';
}

export default function AdminDatabaseTablesTab() {
  // 1. Estados de Navegación y Filtros
  const [activeTable, setActiveTable] = useState('products'); // 'products' | 'categories' | 'orders' | 'shifts' | 'settings'
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [sortBy, setSortBy] = useState('default');

  // 2. Datos de Base de Datos
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [settings, setSettings] = useState({});
  const [categoryList, setCategoryList] = useState(() => storageService.getCategories());
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 3. Modales y Operaciones
  const [editingItem, setEditingItem] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState(null); // { type: 'success' | 'error', text: string }

  // Formulario temporal para edición o creación
  const [formData, setFormData] = useState({});
  const fileInputRef = useRef(null);
  const [compressing, setCompressing] = useState(false);
  const [isClearingOrders, setIsClearingOrders] = useState(false);

  // Carga de imágenes con compresión en canvas
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (JPG, PNG, WEBP).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setCompressing(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDimension = 600;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.80);
          setFormData(prev => ({ ...prev, image: compressedDataUrl }));
        } catch (err) {
          console.error('Error al comprimir imagen:', err);
          setFormData(prev => ({ ...prev, image: event.target.result }));
        } finally {
          setCompressing(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      img.onerror = () => {
        setCompressing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        alert('No se pudo procesar la imagen seleccionada.');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Cargar datos desde almacenamiento local y sincronizar con la nube
  const loadAllData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setProducts(storageService.getProducts());
      setOrders(storageService.getOrders());
      setShifts(storageService.getCashShiftsHistory());
      setSettings(storageService.getSettings());
      setCategoryList(storageService.getCategories());

      if (supabaseSync.isConfigured()) {
        const [cloudProds, cloudOrders, cloudShifts] = await Promise.all([
          supabaseSync.fetchProducts(),
          supabaseSync.fetchOrders(500),
          supabaseSync.fetchCashShiftsHistory(100)
        ]);
        if (cloudProds && cloudProds.length > 0) {
          storageService.saveProducts(cloudProds);
          setProducts(cloudProds);
        }
        if (cloudOrders && cloudOrders.length > 0) {
          const validOrders = cloudOrders.filter(o => o && !storageService.isOrderDeleted(o.id));
          storageService.saveOrdersBatch(validOrders);
          setOrders(storageService.getOrders());
        }
        if (cloudShifts && cloudShifts.length > 0) {
          const mergedShifts = storageService.syncCashShiftsFromCloud(cloudShifts);
          setShifts(mergedShifts);
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();

    const handleDataUpdate = () => {
      loadAllData();
      setCategoryList(storageService.getCategories());
    };
    window.addEventListener('comandafast:categories_updated', handleDataUpdate);
    window.addEventListener('comandafast:products_updated', handleDataUpdate);
    window.addEventListener('comandafast:orders_updated', handleDataUpdate);
    window.addEventListener('comandafast:shifts_updated', handleDataUpdate);

    return () => {
      window.removeEventListener('comandafast:categories_updated', handleDataUpdate);
      window.removeEventListener('comandafast:products_updated', handleDataUpdate);
      window.removeEventListener('comandafast:orders_updated', handleDataUpdate);
      window.removeEventListener('comandafast:shifts_updated', handleDataUpdate);
    };
  }, [loadAllData]);

  const showToast = (text, type = 'success') => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const formatMoney = (n) => '$' + Number(n || 0).toLocaleString('es-AR');

  const getProductCountForCat = useCallback((catName) => {
    return products.filter(p => (p.category || '').toLowerCase() === (catName || '').toLowerCase()).length;
  }, [products]);

  // Lista única de categorías de los productos
  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [products]);

  // -------------------------------------------------------------
  // FILTRADO Y ORDENAMIENTO DE DATOS
  // -------------------------------------------------------------
  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (categoryFilter !== 'all') {
      list = list.filter(p => p.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => 
        p.name?.toLowerCase().includes(q) || 
        p.id?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        (p.modifiers || []).some(m => m.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'price-desc') {
      list.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (sortBy === 'price-asc') {
      list.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (sortBy === 'name-asc') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return list;
  }, [products, categoryFilter, searchQuery, sortBy]);

  const filteredCategories = useMemo(() => {
    let list = [...categoryList];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => 
        (c.name || '').toLowerCase().includes(q) || 
        (c.id || '').toLowerCase().includes(q)
      );
    }

    if (sortBy === 'count-desc') {
      list.sort((a, b) => getProductCountForCat(b.name) - getProductCountForCat(a.name));
    } else if (sortBy === 'name-asc') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return list;
  }, [categoryList, searchQuery, sortBy, getProductCountForCat]);

  const filteredOrders = useMemo(() => {
    let list = [...orders];
    if (statusFilter !== 'all') {
      list = list.filter(o => o.status === statusFilter);
    }
    if (channelFilter !== 'all') {
      list = list.filter(o => o.channel === channelFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(o => {
        const custName = getCustomerName(o.customer).toLowerCase();
        const custPhone = getCustomerPhone(o).toLowerCase();
        const custAddress = getCustomerAddress(o).toLowerCase();
        return (
          o.id?.toLowerCase().includes(q) ||
          String(o.orderNumber || '').includes(q) ||
          custName.includes(q) ||
          custPhone.includes(q) ||
          custAddress.includes(q)
        );
      });
    }
    return list;
  }, [orders, statusFilter, channelFilter, searchQuery]);

  const filteredShifts = useMemo(() => {
    let list = [...shifts];
    if (shiftFilter === 'open') {
      list = list.filter(s => !s.isClosed && s.closedAt == null);
    } else if (shiftFilter === 'closed') {
      list = list.filter(s => s.isClosed || s.closedAt != null);
    } else if (shiftFilter === 'diff') {
      list = list.filter(s => {
        const diff = Number(s.difference);
        return !isNaN(diff) && diff !== 0;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => 
        s.id?.toLowerCase().includes(q) ||
        (s.cashier || s.cashierName || s.cashier_name || '').toLowerCase().includes(q) ||
        (s.notes || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [shifts, shiftFilter, searchQuery]);

  // -------------------------------------------------------------
  // ACCIONES CRUD Y MANIPULACIÓN
  // -------------------------------------------------------------
  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setIsCreating(false);
    if (activeTable === 'categories') {
      setIsCatModalOpen(true);
      return;
    } else if (activeTable === 'products') {
      setFormData({
        id: item.id,
        name: item.name || '',
        category: item.category || 'Hamburguesas',
        price: item.price || 0,
        emoji: item.emoji || '🍔',
        description: item.description || '',
        image: item.image || '',
        modifiersText: (item.modifiers || []).join(', ')
      });
    } else if (activeTable === 'orders') {
      setFormData({
        id: item.id,
        orderNumber: item.orderNumber || '',
        customer: getCustomerName(item.customer),
        phone: getCustomerPhone(item),
        address: getCustomerAddress(item),
        channel: item.channel || 'mostrador',
        paymentMethod: item.paymentMethod || 'efectivo',
        status: item.status || 'pendiente',
        total: item.total || 0
      });
    } else if (activeTable === 'shifts') {
      const cashierVal = item.cashierName || item.cashier || item.cashier_name || 'Cajero';
      let cleanNotes = item.notes || '';
      cleanNotes = cleanNotes.replace(/\[AUDIT:\s*\{.*?\}\]\s*/, '').trim();

      setFormData({
        id: item.id,
        cashier: cashierVal,
        initialCash: item.initialCash ?? item.initial_cash ?? 0,
        countedCash: item.countedCash ?? item.counted_cash ?? 0,
        notes: cleanNotes,
        isClosed: item.isClosed !== undefined ? Boolean(item.isClosed) : Boolean(item.closedAt || item.closed_at)
      });
    }
  };

  const handleOpenCreate = () => {
    setIsCreating(true);
    setEditingItem(null);
    if (activeTable === 'products') {
      setFormData({
        id: 'prod-' + Date.now(),
        name: '',
        category: categoryList[0]?.name || 'Hamburguesas',
        price: 8000,
        emoji: '🍔',
        description: '',
        image: '',
        modifiersText: 'Sin cebolla, Extra Cheddar (+$800), Extra Bacon (+$900)'
      });
    } else if (activeTable === 'orders') {
      setFormData({
        id: 'ord-' + Date.now(),
        orderNumber: storageService.getNextOrderNumber(),
        customer: '',
        phone: '',
        address: 'Mostrador / Local',
        channel: 'mostrador',
        paymentMethod: 'efectivo',
        status: 'pendiente',
        total: 8000
      });
    } else if (activeTable === 'shifts') {
      setFormData({
        id: 'shift-' + Date.now(),
        cashier: 'Cajero Principal',
        initialCash: 10000,
        countedCash: 10000,
        notes: 'Turno registrado manualmente por Dueño',
        isClosed: true
      });
    }
  };

  const handleSaveFormData = async () => {
    try {
      if (activeTable === 'products') {
        const rawMods = (formData.modifiersText || '')
          .split(',')
          .map(m => m.trim())
          .filter(Boolean);

        const prodPayload = {
          name: formData.name.trim(),
          category: formData.category,
          price: Number(formData.price) || 0,
          emoji: formData.emoji || '🍔',
          description: formData.description.trim(),
          image: formData.image.trim(),
          modifiers: rawMods
        };

        if (isCreating) {
          const newProd = { ...prodPayload, id: 'prod-' + Date.now() };
          storageService.addProduct(newProd);
          supabaseSync.createProduct(newProd);
          showToast(`✅ Producto "${prodPayload.name}" creado con éxito.`);
        } else {
          storageService.updateProduct(editingItem.id, prodPayload);
          supabaseSync.updateProduct(editingItem.id, prodPayload);
          showToast(`✅ Producto "${prodPayload.name}" actualizado.`);
        }

        chatbotService.syncWithBaileysServer().catch(() => {});
      } else if (activeTable === 'orders') {
        const orderPayload = {
          customer: formData.customer.trim() || 'Cliente',
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          channel: formData.channel,
          paymentMethod: formData.paymentMethod,
          status: formData.status,
          total: Number(formData.total) || 0
        };

        if (isCreating) {
          const newOrd = storageService.saveOrder({
            ...orderPayload,
            items: [{ name: 'Pedido Manual', price: orderPayload.total, qty: 1, unitPrice: orderPayload.total }]
          });
          supabaseSync.createOrder(newOrd);
          showToast(`✅ Comanda registrada con éxito.`);
        } else {
          storageService.updateOrder(editingItem.id, orderPayload);
          supabaseSync.updateOrder(editingItem.id, orderPayload);
          showToast(`✅ Comanda #${formData.orderNumber || editingItem.id} actualizada.`);
        }
      } else if (activeTable === 'shifts') {
        const cashierVal = formData.cashier?.trim() || 'Cajero';
        const initialVal = Number(formData.initialCash) || 0;
        const countedVal = Number(formData.countedCash) || 0;
        const notesVal = formData.notes?.trim() || '';
        const isClosedVal = formData.isClosed !== undefined ? Boolean(formData.isClosed) : true;

        const shiftPayload = {
          cashier: cashierVal,
          cashierName: cashierVal,
          initialCash: initialVal,
          countedCash: countedVal,
          notes: notesVal,
          isClosed: isClosedVal
        };

        if (isCreating) {
          const newShiftItem = storageService.addCashShiftHistoryItem(shiftPayload);
          supabaseSync.createCashShift({
            ...shiftPayload,
            id: newShiftItem.id,
            openedAt: newShiftItem.openedAt,
            closedAt: newShiftItem.closedAt,
            isClosed: isClosedVal
          });
          showToast(`✅ Turno de caja creado.`);
        } else {
          storageService.updateCashShiftHistoryItem(editingItem.id, shiftPayload);
          supabaseSync.updateCashShift(editingItem.id, {
            ...shiftPayload,
            initialCash: initialVal,
            cashierName: cashierVal,
            isClosed: isClosedVal
          });
          showToast(`✅ Turno de caja actualizado.`);
        }
      }

      setEditingItem(null);
      setIsCreating(false);
      loadAllData();
    } catch (err) {
      showToast('❌ Ocurrió un error al guardar el registro.', 'error');
    }
  };

  const handleSaveSettings = () => {
    try {
      storageService.saveSettings(settings);
      if (supabaseSync && supabaseSync.isConfigured()) {
        supabaseSync.saveSettings(settings);
      }
      showToast('✅ Parámetros guardados con éxito.');
      loadAllData();
    } catch (err) {
      showToast('❌ Error al guardar configuraciones.', 'error');
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!itemToDelete) return;
    try {
      const isLocal = typeof window !== 'undefined' && window.location.protocol === 'http:' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const botHost = isLocal ? window.location.hostname : 'localhost';
      if (activeTable === 'products') {
        storageService.deleteProduct(itemToDelete.id);
        await supabaseSync.deleteProduct(itemToDelete.id);
        chatbotService.syncWithBaileysServer().catch(() => {});
        showToast(`🗑️ Producto eliminado de la base de datos.`);
      } else if (activeTable === 'orders') {
        const idToDelete = itemToDelete.id;
        storageService.deleteOrder(idToDelete);
        setOrders(prev => prev.filter(o => o.id !== idToDelete));
        const promises = [supabaseSync.deleteOrder(idToDelete)];
        if (isLocal) {
          promises.push(fetch(`http://${botHost}:3002/api/orders/${idToDelete}`, { method: 'DELETE' }).catch(() => {}));
        }
        await Promise.allSettled(promises);
        showToast(`🗑️ Comanda eliminada permanentemente.`);
      } else if (activeTable === 'shifts') {
        storageService.deleteCashShiftHistoryItem(itemToDelete.id);
        await supabaseSync.deleteCashShift(itemToDelete.id);
        showToast(`🗑️ Turno eliminado.`);
      }
      setItemToDelete(null);
      await loadAllData();
    } catch (err) {
      showToast('❌ Error al eliminar el registro.', 'error');
    }
  };

  const handleClearAllOrders = async () => {
    if (!window.confirm('⚠️ ¿Estás seguro de que deseas VACIAR TODAS LAS COMANDAS de la base de datos y de la aplicación? Esta acción no se puede deshacer.')) {
      return;
    }
    setIsClearingOrders(true);
    try {
      const botHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
      localStorage.setItem('comandafast_orders', JSON.stringify([]));
      setOrders([]);
      await Promise.allSettled([
        supabaseSync.clearAllOrders(),
        fetch(`http://${botHost}:3002/api/orders`, { method: 'DELETE' }).catch(() => {})
      ]);
      showToast('🗑️ Todas las comandas han sido eliminadas.');
    } catch (e) {
      showToast('❌ Error al vaciar comandas.', 'error');
    } finally {
      setIsClearingOrders(false);
    }
  };

  const handleExportJSON = () => {
    const tableData = activeTable === 'products' ? products : activeTable === 'categories' ? categoryList : activeTable === 'orders' ? orders : activeTable === 'shifts' ? shifts : settings;
    const blob = new Blob([JSON.stringify(tableData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comandafast_${activeTable}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`📥 Tabla ${activeTable.toUpperCase()} exportada.`);
  };

  // Cambio rápido de estado de pedido desde el modal de inspección
  const handleUpdateOrderStatusQuick = (orderId, newStatus) => {
    try {
      const updated = storageService.updateOrderStatus(orderId, newStatus);
      if (updated) {
        supabaseSync.updateOrder(orderId, { status: newStatus }).catch(() => {});
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        if (viewingOrder && viewingOrder.id === orderId) {
          setViewingOrder(prev => ({ ...prev, status: newStatus }));
        }
        showToast(`Comanda actualizada a estado "${newStatus.toUpperCase()}"`);
      }
    } catch (err) {
      showToast('Error al actualizar estado', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* TOAST FLOTANTE DE FEEDBACK */}
      {feedbackMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: feedbackMsg.type === 'success' ? '#10b981' : '#ef4444',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 800,
          fontSize: '0.85rem'
        }}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* HEADER CARD: CONTROL PRINCIPAL & ACCIONES                 */}
      {/* ========================================================= */}
      <div className="admin-table-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-amber)',
                border: '1px solid rgba(245, 158, 11, 0.3)'
              }}>
                <Database size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                  Gestión de Tablas de Base de Datos
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Registros en vivo:
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                    {products.length} productos
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>•</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                    {categoryList.length} categorías
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>•</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-purple)' }}>
                    {orders.length} pedidos
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>•</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                    {shifts.length} turnos
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* BOTONES DE ACCIÓN SUPERIOR */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {activeTable !== 'settings' && (
              <button
                type="button"
                onClick={activeTable === 'categories' ? () => setIsCatModalOpen(true) : handleOpenCreate}
                className="admin-btn admin-btn-primary"
                style={{ height: '36px', padding: '0 14px', gap: '6px' }}
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>
                  {activeTable === 'categories' ? 'Gestionar Categorías' : 
                   activeTable === 'products' ? 'Nuevo Producto' :
                   activeTable === 'orders' ? 'Nueva Comanda' : 'Nuevo Turno'}
                </span>
              </button>
            )}

            {activeTable === 'orders' && orders.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllOrders}
                disabled={isClearingOrders}
                className="admin-btn admin-btn-danger"
                style={{ height: '36px', padding: '0 12px' }}
                title="Vaciar todas las comandas de la base de datos"
              >
                <Trash2 size={15} />
                <span>{isClearingOrders ? 'Vaciando...' : 'Vaciar Comandas'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportJSON}
              className="admin-btn"
              style={{ height: '36px' }}
              title="Descargar copia de seguridad en JSON"
            >
              <Download size={15} />
              <span>Exportar JSON</span>
            </button>

            <button
              type="button"
              onClick={loadAllData}
              disabled={isRefreshing}
              className="admin-btn admin-btn-icon-only"
              style={{ height: '36px', width: '36px' }}
              title="Recargar datos de la BD"
            >
              <RefreshCw size={15} className={isRefreshing ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* SELECTOR DE TABLAS (CHIPS NAVEGABLES) */}
        <div className="scrollable-tabs-bar" style={{ gap: '8px', marginTop: '1.25rem', paddingBottom: '4px' }}>
          {[
            { id: 'products', label: '🍔 Productos & Menú', count: products.length },
            { id: 'categories', label: '📁 Categorías', count: categoryList.length },
            { id: 'orders', label: '📋 Pedidos & Comandas', count: orders.length },
            { id: 'shifts', label: '💵 Turnos de Caja', count: shifts.length },
            { id: 'settings', label: '🏪 Configuración del Local', isSettings: true }
          ].map(tab => {
            const isActive = activeTable === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTable(tab.id);
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                  setChannelFilter('all');
                }}
                className={`cat-pill-btn tactile-btn ${isActive ? 'active' : ''}`}
                style={{
                  height: '36px',
                  padding: '0 14px',
                  fontSize: '0.8rem',
                  gap: '8px',
                  border: isActive ? '1px solid var(--accent-amber)' : '1px solid var(--border-subtle)',
                  background: isActive ? 'var(--accent-amber)' : 'var(--bg-main)',
                  color: isActive ? '#0b0f19' : 'var(--text-secondary)',
                  fontWeight: isActive ? 900 : 700,
                  whiteSpace: 'nowrap'
                }}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span style={{
                    background: isActive ? 'rgba(0,0,0,0.25)' : 'var(--bg-card)',
                    color: isActive ? '#0b0f19' : 'var(--text-muted)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '0.72rem',
                    fontWeight: 900
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* KPI OVERVIEW STRIP: MINI MÉTRICAS POR TABLA               */}
      {/* ========================================================= */}
      {activeTable === 'products' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
          <div className="admin-stat-chip">
            <div className="admin-stat-chip-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)' }}>
              <ShoppingBag size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Total Productos</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)' }}>{products.length}</div>
            </div>
          </div>
          <div className="admin-stat-chip">
            <div className="admin-stat-chip-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)' }}>
              <Layers size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Categorías</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)' }}>{categoryList.length}</div>
            </div>
          </div>
          <div className="admin-stat-chip">
            <div className="admin-stat-chip-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>
              <DollarSign size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Precio Promedio</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent-emerald)' }}>
                {formatMoney(products.length > 0 ? products.reduce((s, p) => s + (Number(p.price) || 0), 0) / products.length : 0)}
              </div>
            </div>
          </div>
          <div className="admin-stat-chip">
            <div className="admin-stat-chip-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-purple)' }}>
              <Upload size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Con Foto Cargada</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                {products.filter(p => p.image).length} / {products.length}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTable === 'categories' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
          <div className="admin-stat-chip">
            <div className="admin-stat-chip-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)' }}>
              <Layers size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Categorías Totales</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)' }}>{categoryList.length}</div>
            </div>
          </div>
          <div className="admin-stat-chip">
            <div className="admin-stat-chip-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>
              <CheckCircle2 size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Con Productos</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                {categoryList.filter(c => getProductCountForCat(c.name) > 0).length}
              </div>
            </div>
          </div>
          <div className="admin-stat-chip">
            <div className="admin-stat-chip-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)' }}>
              <ShoppingBag size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Total Productos en Menú</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent-blue)' }}>{products.length}</div>
            </div>
          </div>
        </div>
      )}

      {activeTable === 'orders' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
          <div className="admin-stat-chip">
            <div className="admin-stat-chip-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)' }}>
              <Receipt size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Total Comandas</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)' }}>{orders.length}</div>
            </div>
          </div>
          <div className="admin-stat-chip">
            <div className="admin-stat-chip-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>
              <DollarSign size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Facturación Acumulada</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent-emerald)' }}>
                {formatMoney(orders.reduce((sum, o) => o.status !== 'cancelado' ? sum + (Number(o.total) || 0) : sum, 0))}
              </div>
            </div>
          </div>
          <div className="admin-stat-chip">
            <div className="admin-stat-chip-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)' }}>
              <CheckCircle2 size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Entregadas con Éxito</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                {orders.filter(o => o.status === 'entregado').length}
              </div>
            </div>
          </div>
          <div className="admin-stat-chip">
            <div className="admin-stat-chip-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-rose)' }}>
              <AlertCircle size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Canceladas</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent-rose)' }}>
                {orders.filter(o => o.status === 'cancelado').length}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTable === 'shifts' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
          <div className="admin-stat-chip">
            <div className="admin-stat-chip-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)' }}>
              <Clock size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Turnos Auditados</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)' }}>{shifts.length}</div>
            </div>
          </div>
          <div className="admin-stat-chip">
            <div className="admin-stat-chip-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>
              <UserCheck size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Turnos en Curso</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent-emerald)' }}>
                {shifts.filter(s => !s.isClosed && s.closedAt == null).length}
              </div>
            </div>
          </div>
          <div className="admin-stat-chip">
            <div className="admin-stat-chip-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)' }}>
              <DollarSign size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Efectivo Declarado</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent-blue)' }}>
                {formatMoney(shifts.reduce((s, sh) => s + (Number(sh.countedCash ?? sh.counted_cash) || 0), 0))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* BARRA DE BÚSQUEDA Y FILTROS SECUNDARIOS                   */}
      {/* ========================================================= */}
      {activeTable !== 'settings' && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          {/* Buscador */}
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={`Buscar en ${activeTable}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              style={{ width: '100%', height: '36px', paddingLeft: '36px', fontSize: '0.8rem', background: 'var(--bg-main)' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtros específicos por tabla */}
          {activeTable === 'products' && (
            <>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="search-input"
                style={{ height: '36px', fontSize: '0.8rem', minWidth: '150px', background: 'var(--bg-main)' }}
              >
                <option value="all">Todas las categorías</option>
                {categoryList.map(c => (
                  <option key={c.id || c.name} value={c.name}>{c.emoji ? `${c.emoji} ` : ''}{c.name}</option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="search-input"
                style={{ height: '36px', fontSize: '0.8rem', minWidth: '130px', background: 'var(--bg-main)' }}
              >
                <option value="default">Orden habitual</option>
                <option value="price-desc">Mayor precio</option>
                <option value="price-asc">Menor precio</option>
                <option value="name-asc">Nombre A-Z</option>
              </select>
            </>
          )}

          {activeTable === 'categories' && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="search-input"
              style={{ height: '36px', fontSize: '0.8rem', minWidth: '150px', background: 'var(--bg-main)' }}
            >
              <option value="default">Orden original</option>
              <option value="count-desc">Más productos</option>
              <option value="name-asc">Nombre A-Z</option>
            </select>
          )}

          {activeTable === 'orders' && (
            <>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="search-input"
                style={{ height: '36px', fontSize: '0.8rem', minWidth: '140px', background: 'var(--bg-main)' }}
              >
                <option value="all">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="cocina">En Cocina</option>
                <option value="listo">Listo</option>
                <option value="entregado">Entregado</option>
                <option value="cancelado">Cancelado</option>
              </select>

              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="search-input"
                style={{ height: '36px', fontSize: '0.8rem', minWidth: '140px', background: 'var(--bg-main)' }}
              >
                <option value="all">Todos los canales</option>
                <option value="whatsapp">💬 WhatsApp</option>
                <option value="delivery">🛵 Delivery</option>
                <option value="mostrador">🍔 Mostrador</option>
              </select>
            </>
          )}

          {activeTable === 'shifts' && (
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="search-input"
              style={{ height: '36px', fontSize: '0.8rem', minWidth: '140px', background: 'var(--bg-main)' }}
            >
              <option value="all">Todos los turnos</option>
              <option value="open">🟢 Solo abiertos</option>
              <option value="closed">📁 Solo cerrados</option>
              <option value="diff">⚠️ Con diferencias</option>
            </select>
          )}

          {/* Badge de registros coincidentes */}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {activeTable === 'products' && `Mostrando ${filteredProducts.length} de ${products.length}`}
            {activeTable === 'categories' && `Mostrando ${filteredCategories.length} de ${categoryList.length}`}
            {activeTable === 'orders' && `Mostrando ${filteredOrders.length} de ${orders.length}`}
            {activeTable === 'shifts' && `Mostrando ${filteredShifts.length} de ${shifts.length}`}
          </span>
        </div>
      )}

      {/* ========================================================= */}
      {/* VISTA TABLA 1: PRODUCTOS & MENÚ                           */}
      {/* ========================================================= */}
      {activeTable === 'products' && (
        <div className="admin-table-card">
          <div className="admin-table-wrapper">
            <table className="admin-table-modern">
              <thead>
                <tr>
                  <th>Ítem / Producto</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Modificadores / Extras</th>
                  <th>Descripción</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Package size={36} style={{ opacity: 0.35, marginBottom: '8px' }} />
                      <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>No se encontraron productos coincidentes</div>
                      <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Prueba con otro término de búsqueda o limpia los filtros.</div>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(prod => (
                    <tr key={prod.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {prod.image ? (
                            <img 
                              src={prod.image} 
                              alt={prod.name} 
                              style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-subtle)' }} 
                            />
                          ) : (
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '8px',
                              background: 'var(--bg-main)',
                              border: '1px solid var(--border-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.4rem'
                            }}>
                              {prod.emoji || '🍔'}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{prod.name}</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{prod.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 9px',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: 'var(--accent-amber)',
                          border: '1px solid rgba(245, 158, 11, 0.3)'
                        }}>
                          {prod.category}
                        </span>
                      </td>
                      <td style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                        {formatMoney(prod.price)}
                      </td>
                      <td style={{ maxWidth: '260px' }}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {(prod.modifiers || []).slice(0, 3).map((m, idx) => (
                            <span key={idx} style={{
                              background: 'var(--bg-main)',
                              border: '1px solid var(--border-subtle)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              color: 'var(--text-secondary)'
                            }}>
                              {m}
                            </span>
                          ))}
                          {(prod.modifiers || []).length > 3 && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                              +{prod.modifiers.length - 3} más
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.76rem' }}>
                        {prod.description || '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(prod)}
                            className="admin-btn"
                            style={{ height: '30px', padding: '0 8px', fontSize: '0.74rem' }}
                            title="Editar producto"
                          >
                            <Edit2 size={13} />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setItemToDelete(prod)}
                            className="admin-btn admin-btn-danger admin-btn-icon-only"
                            style={{ height: '30px', width: '30px' }}
                            title="Eliminar producto"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VISTA TABLA 2: CATEGORÍAS                                 */}
      {/* ========================================================= */}
      {activeTable === 'categories' && (
        <div className="admin-table-card">
          <div className="admin-table-wrapper">
            <table className="admin-table-modern">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Identificador</th>
                  <th>Productos Asociados</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Layers size={36} style={{ opacity: 0.35, marginBottom: '8px' }} />
                      <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>No se encontraron categorías coincidentes</div>
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map(cat => {
                    const count = getProductCountForCat(cat.name);
                    return (
                      <tr key={cat.id || cat.name}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '8px',
                              background: 'var(--bg-main)',
                              border: '1px solid var(--border-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.4rem'
                            }}>
                              {cat.emoji || '📁'}
                            </div>
                            <div>
                              <span style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                                {cat.name}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: '0.74rem',
                            color: 'var(--text-secondary)',
                            background: 'var(--bg-main)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-subtle)'
                          }}>
                            {cat.id || '-'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTable('products');
                              setCategoryFilter(cat.name);
                            }}
                            title={`Ver los ${count} productos de ${cat.name}`}
                            style={{
                              background: count > 0 ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-main)',
                              color: count > 0 ? 'var(--accent-blue)' : 'var(--text-muted)',
                              border: count > 0 ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid var(--border-subtle)',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <span>{count} {count === 1 ? 'producto' : 'productos'}</span>
                            <ArrowRight size={12} />
                          </button>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTable('products');
                                setCategoryFilter(cat.name);
                              }}
                              className="admin-btn"
                              style={{ height: '30px', padding: '0 8px', fontSize: '0.74rem' }}
                              title="Filtrar productos de esta categoría"
                            >
                              <Eye size={13} />
                              <span>Ver Menú</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setIsCatModalOpen(true)}
                              className="admin-btn"
                              style={{ height: '30px', padding: '0 9px', fontSize: '0.74rem', gap: '4px' }}
                              title="Gestionar y editar categorías"
                            >
                              <Edit2 size={13} />
                              <span>Gestionar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VISTA TABLA 3: PEDIDOS & COMANDAS                          */}
      {/* ========================================================= */}
      {activeTable === 'orders' && (
        <div className="admin-table-card">
          <div className="admin-table-wrapper">
            <table className="admin-table-modern">
              <thead>
                <tr>
                  <th>Comanda</th>
                  <th>Cliente & Contacto</th>
                  <th>Canal</th>
                  <th>Medio de Pago</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Receipt size={36} style={{ opacity: 0.35, marginBottom: '8px' }} />
                      <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>No se encontraron comandas coincidentes</div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(order => {
                    const stColor = 
                      order.status === 'entregado' ? '#10b981' :
                      order.status === 'cocina' ? '#f59e0b' :
                      order.status === 'listo' ? '#3b82f6' :
                      order.status === 'cancelado' ? '#ef4444' : '#a855f7';

                    const phone = getCustomerPhone(order);
                    const cleanPhone = phone.replace(/[^0-9]/g, '');

                    return (
                      <tr key={order.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              background: 'var(--bg-main)',
                              border: '1px solid var(--border-subtle)',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontWeight: 900,
                              fontSize: '0.85rem',
                              color: 'var(--text-primary)'
                            }}>
                              #{order.orderNumber || order.id?.slice(-4)}
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' hs' : ''}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{getCustomerName(order.customer)}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {phone ? (
                              <a
                                href={`https://wa.me/${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--accent-emerald)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 700 }}
                              >
                                <Smartphone size={12} />
                                <span>{phone}</span>
                              </a>
                            ) : (
                              <span>Sin teléfono</span>
                            )}
                          </div>
                          {getCustomerAddress(order) && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                              <MapPin size={11} />
                              <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {getCustomerAddress(order)}
                              </span>
                            </div>
                          )}
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            background: order.channel === 'whatsapp' ? 'rgba(16, 185, 129, 0.15)' : order.channel === 'delivery' ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-main)',
                            color: order.channel === 'whatsapp' ? 'var(--accent-emerald)' : order.channel === 'delivery' ? 'var(--accent-amber)' : 'var(--text-primary)',
                            border: '1px solid var(--border-subtle)'
                          }}>
                            {order.channel === 'whatsapp' ? '💬 WhatsApp' : order.channel === 'delivery' ? '🛵 Delivery' : '🍔 Mostrador'}
                          </span>
                        </td>
                        <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                          {order.paymentMethod || 'Efectivo'}
                        </td>
                        <td style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                          {formatMoney(order.total)}
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 9px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: 900,
                            color: stColor,
                            background: `${stColor}22`,
                            border: `1px solid ${stColor}44`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: stColor }}></span>
                            <span>{order.status}</span>
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setViewingOrder(order)}
                              className="admin-btn admin-btn-primary"
                              style={{ height: '30px', padding: '0 9px', fontSize: '0.74rem' }}
                              title="Ver ítems y detalles completos"
                            >
                              <Eye size={13} />
                              <span>Ver</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(order)}
                              className="admin-btn"
                              style={{ height: '30px', padding: '0 8px', fontSize: '0.74rem' }}
                              title="Editar comanda"
                            >
                              <Edit2 size={13} />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setItemToDelete(order)}
                              className="admin-btn admin-btn-danger admin-btn-icon-only"
                              style={{ height: '30px', width: '30px' }}
                              title="Eliminar comanda"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VISTA TABLA 4: TURNOS DE CAJA                             */}
      {/* ========================================================= */}
      {activeTable === 'shifts' && (
        <div className="admin-table-card">
          <div className="admin-table-wrapper">
            <table className="admin-table-modern">
              <thead>
                <tr>
                  <th>Turno & Horario</th>
                  <th>Cajero a Cargo</th>
                  <th>Fondo Inicial</th>
                  <th>Ventas Efectivo</th>
                  <th>Declarado</th>
                  <th>Diferencia Auditada</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredShifts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Clock size={36} style={{ opacity: 0.35, marginBottom: '8px' }} />
                      <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>No se encontraron turnos registrados</div>
                    </td>
                  </tr>
                ) : (
                  filteredShifts.map(shift => {
                    const openDate = shift.openedAt || shift.opened_at;
                    const closeDate = shift.closedAt || shift.closed_at;
                    const isClosed = shift.isClosed !== undefined
                      ? Boolean(shift.isClosed)
                      : Boolean(closeDate || (shift.countedCash !== null && shift.countedCash !== undefined));

                    const cashierName = shift.cashierName || shift.cashier || shift.cashier_name || 'Cajero';
                    const initialCash = Number(shift.initialCash ?? shift.initial_cash ?? 0);

                    let salesCash = Number(shift.cashSales ?? shift.cash_sales ?? 0);
                    if (salesCash === 0 && openDate) {
                      const startTime = new Date(openDate).getTime();
                      const endTime = closeDate ? new Date(closeDate).getTime() : Date.now();
                      const matchingOrders = orders.filter(o => {
                        if (o.paymentMethod !== 'efectivo' || o.status === 'cancelado') return false;
                        const ordTime = o.createdAt ? new Date(o.createdAt).getTime() : 0;
                        return ordTime >= startTime && ordTime <= endTime;
                      });
                      salesCash = matchingOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                    }

                    const counted = (shift.countedCash !== null && shift.countedCash !== undefined)
                      ? Number(shift.countedCash)
                      : (shift.counted_cash !== null && shift.counted_cash !== undefined ? Number(shift.counted_cash) : null);

                    const expenses = Array.isArray(shift.expenses)
                      ? shift.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
                      : 0;

                    const expectedCash = (shift.expectedCash !== undefined && shift.expectedCash !== null && Number(shift.expectedCash) !== 0)
                      ? Number(shift.expectedCash)
                      : (initialCash + salesCash - expenses);

                    let diff = null;
                    if (counted !== null && (isClosed || counted > 0)) {
                      if (shift.difference !== undefined && shift.difference !== null && Number(shift.difference) !== 0) {
                        diff = Number(shift.difference);
                      } else {
                        diff = counted - expectedCash;
                      }
                    }

                    const diffColor = diff === null ? 'var(--text-muted)' : diff === 0 ? '#10b981' : diff > 0 ? '#3b82f6' : '#ef4444';

                    return (
                      <tr key={shift.id}>
                        <td>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{openDate ? new Date(openDate).toLocaleDateString('es-AR') : 'Sin fecha'}</span>
                            {!isClosed ? (
                              <span style={{
                                fontSize: '0.62rem',
                                background: 'rgba(245, 158, 11, 0.18)',
                                color: 'var(--accent-amber)',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontWeight: 900
                              }}>
                                ABIERTO
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '0.62rem',
                                background: 'var(--bg-main)',
                                color: 'var(--text-muted)',
                                border: '1px solid var(--border-subtle)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontWeight: 700
                              }}>
                                CERRADO
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {openDate ? new Date(openDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' hs' : ''}
                            {closeDate ? ` a ${new Date(closeDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs` : ''}
                          </div>
                        </td>
                        <td style={{ fontWeight: 700 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <UserCheck size={14} style={{ color: 'var(--text-muted)' }} />
                            <span>{cashierName}</span>
                          </div>
                        </td>
                        <td>
                          {formatMoney(initialCash)}
                        </td>
                        <td style={{ color: salesCash > 0 ? 'var(--accent-emerald)' : 'inherit', fontWeight: salesCash > 0 ? 800 : 400 }}>
                          {formatMoney(salesCash)}
                        </td>
                        <td style={{ fontWeight: 800 }}>
                          {counted !== null ? (
                            formatMoney(counted)
                          ) : (
                            <span style={{ color: 'var(--accent-amber)', fontStyle: 'italic', fontSize: '0.75rem', fontWeight: 700 }}>
                              En curso...
                            </span>
                          )}
                        </td>
                        <td>
                          {diff === null ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>-</span>
                          ) : (
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '0.72rem',
                              fontWeight: 900,
                              color: diffColor,
                              background: diff === 0 ? 'rgba(16, 185, 129, 0.15)' : diff > 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              border: `1px solid ${diff === 0 ? 'rgba(16, 185, 129, 0.3)' : diff > 0 ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                            }}>
                              {diff === 0 ? 'Exacto $0' : `${diff > 0 ? '+' : ''}${formatMoney(diff)}`}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(shift)}
                              className="admin-btn"
                              style={{ height: '30px', padding: '0 9px', fontSize: '0.74rem' }}
                              title="Modificar turno"
                            >
                              <Edit2 size={13} />
                              <span>Modificar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setItemToDelete(shift)}
                              className="admin-btn admin-btn-danger admin-btn-icon-only"
                              style={{ height: '30px', width: '30px' }}
                              title="Eliminar turno"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VISTA TABLA 5: CONFIGURACIÓN DEL LOCAL                    */}
      {/* ========================================================= */}
      {activeTable === 'settings' && (
        <div className="admin-table-card" style={{ padding: '1.5rem', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.98rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Store size={20} style={{ color: 'var(--accent-amber)' }} />
              <span>Parámetros Operativos del Local</span>
            </div>
            <button
              type="button"
              onClick={handleSaveSettings}
              className="admin-btn admin-btn-primary"
              style={{ height: '36px', padding: '0 16px', gap: '6px' }}
            >
              <Save size={15} />
              <span>Guardar Cambios</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Nombre del Negocio:
              </label>
              <input
                type="text"
                value={settings.storeName || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, storeName: e.target.value }))}
                className="search-input"
                style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Teléfono / WhatsApp Oficial:
              </label>
              <input
                type="text"
                value={settings.phone || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, phone: e.target.value }))}
                className="search-input"
                style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Dirección del Local:
              </label>
              <input
                type="text"
                value={settings.address || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, address: e.target.value }))}
                className="search-input"
                style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Alias de Mercado Pago / Transferencia:
              </label>
              <input
                type="text"
                value={settings.aliasMp || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, aliasMp: e.target.value }))}
                className="search-input"
                style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                CBU Bancario:
              </label>
              <input
                type="text"
                value={settings.cbu || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, cbu: e.target.value }))}
                className="search-input"
                style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Costo Base de Delivery ($ ARS):
              </label>
              <input
                type="number"
                value={settings.deliveryFee || 0}
                onChange={(e) => setSettings(prev => ({ ...prev, deliveryFee: Number(e.target.value) }))}
                className="search-input"
                style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Pie de Ticket Térmico:
            </label>
            <input
              type="text"
              value={settings.ticketFooter || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, ticketFooter: e.target.value }))}
              placeholder="¡Gracias por elegir ComandaFast Burgers!"
              className="search-input"
              style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
            />
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL EDITAR / CREAR REGISTRO                             */}
      {/* ========================================================= */}
      {(editingItem || isCreating) && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-sheet">
            <div className="admin-modal-header">
              <div style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} style={{ color: 'var(--accent-amber)' }} />
                <span>
                  {isCreating ? `Nuevo Registro en ${activeTable.toUpperCase()}` : `Modificar en ${activeTable.toUpperCase()}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => { setEditingItem(null); setIsCreating(false); }}
                className="admin-btn admin-btn-icon-only"
                style={{ height: '32px', width: '32px' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="admin-modal-body">
              {/* CAMPOS TABLA PRODUCTOS */}
              {activeTable === 'products' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Nombre del Producto:
                    </label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ej: Triple Bacon Especial"
                      className="search-input"
                      style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                          Categoría:
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsCatModalOpen(true)}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-amber)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 800, padding: 0 }}
                        >
                          + Gestionar
                        </button>
                      </div>
                      <select
                        value={formData.category || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                        className="search-input"
                        style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
                      >
                        {categoryList.map(c => (
                          <option key={c.id || c.name} value={c.name}>
                            {c.emoji ? `${c.emoji} ` : ''}{c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Precio ($ ARS):
                      </label>
                      <input
                        type="number"
                        value={formData.price || 0}
                        onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                        className="search-input"
                        style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Emoji / Icono:
                    </label>
                    <input
                      type="text"
                      value={formData.emoji || '🍔'}
                      onChange={(e) => setFormData(prev => ({ ...prev, emoji: e.target.value }))}
                      className="search-input"
                      style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
                    />
                  </div>

                  {/* UPLOADER DE FOTO */}
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Foto del Producto:
                    </label>
                    {formData.image ? (
                      <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', maxHeight: '160px', border: '1px solid var(--border-subtle)', marginBottom: '8px' }}>
                        <img
                          src={formData.image}
                          alt="Previsualización"
                          style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }}
                        />
                        <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="admin-btn"
                            style={{ height: '30px', padding: '0 8px', fontSize: '0.72rem', background: 'rgba(0,0,0,0.8)' }}
                          >
                            <RefreshCw size={12} />
                            <span>Cambiar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                            className="admin-btn admin-btn-danger"
                            style={{ height: '30px', padding: '0 8px', fontSize: '0.72rem' }}
                          >
                            <X size={12} />
                            <span>Quitar</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          background: 'var(--bg-main)',
                          borderRadius: '10px',
                          padding: '1.25rem',
                          textAlign: 'center',
                          cursor: 'pointer',
                          border: '1px dashed var(--accent-amber)',
                          marginBottom: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Upload size={24} style={{ color: 'var(--accent-amber)' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                          {compressing ? 'Optimizando foto...' : '📷 Subir foto desde este dispositivo'}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Haz clic para elegir JPG, PNG o WEBP
                        </span>
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>O URL web:</span>
                      <input
                        type="text"
                        value={formData.image || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                        placeholder="https://..."
                        className="search-input"
                        style={{ flex: 1, height: '34px', fontSize: '0.8rem', background: 'var(--bg-main)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Modificadores / Extras (separados por coma):
                    </label>
                    <input
                      type="text"
                      value={formData.modifiersText || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, modifiersText: e.target.value }))}
                      placeholder="Sin cebolla, Extra Cheddar (+$800), Sin tomate"
                      className="search-input"
                      style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Descripción o ingredientes:
                    </label>
                    <textarea
                      rows={3}
                      value={formData.description || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="search-input"
                      style={{ width: '100%', padding: '8px', fontSize: '0.85rem', resize: 'vertical', background: 'var(--bg-main)' }}
                    />
                  </div>
                </div>
              )}

              {/* CAMPOS TABLA PEDIDOS */}
              {activeTable === 'orders' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Estado del Pedido:
                      </label>
                      <select
                        value={formData.status || 'pendiente'}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                        className="search-input"
                        style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="cocina">En Cocina</option>
                        <option value="listo">Listo</option>
                        <option value="entregado">Entregado</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Total ($ ARS):
                      </label>
                      <input
                        type="number"
                        value={formData.total || 0}
                        onChange={(e) => setFormData(prev => ({ ...prev, total: e.target.value }))}
                        className="search-input"
                        style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Cliente:
                    </label>
                    <input
                      type="text"
                      value={formData.customer || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, customer: e.target.value }))}
                      className="search-input"
                      style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Teléfono:
                      </label>
                      <input
                        type="text"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        className="search-input"
                        style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Canal:
                      </label>
                      <select
                        value={formData.channel || 'mostrador'}
                        onChange={(e) => setFormData(prev => ({ ...prev, channel: e.target.value }))}
                        className="search-input"
                        style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
                      >
                        <option value="mostrador">Mostrador / Local</option>
                        <option value="delivery">Delivery</option>
                        <option value="whatsapp">WhatsApp Bot</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Dirección de Entrega:
                    </label>
                    <input
                      type="text"
                      value={formData.address || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      className="search-input"
                      style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
                    />
                  </div>
                </div>
              )}

              {/* CAMPOS TABLA TURNOS */}
              {activeTable === 'shifts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Cajero a Cargo:
                    </label>
                    <input
                      type="text"
                      value={formData.cashier || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, cashier: e.target.value }))}
                      className="search-input"
                      style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Fondo Inicial ($):
                      </label>
                      <input
                        type="number"
                        value={formData.initialCash || 0}
                        onChange={(e) => setFormData(prev => ({ ...prev, initialCash: e.target.value }))}
                        className="search-input"
                        style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Declarado en Arqueo ($):
                      </label>
                      <input
                        type="number"
                        value={formData.countedCash || 0}
                        onChange={(e) => setFormData(prev => ({ ...prev, countedCash: e.target.value }))}
                        className="search-input"
                        style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Estado del Turno:
                      </label>
                      <select
                        value={formData.isClosed ? 'cerrado' : 'abierto'}
                        onChange={(e) => setFormData(prev => ({ ...prev, isClosed: e.target.value === 'cerrado' }))}
                        className="search-input"
                        style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
                      >
                        <option value="cerrado">Cerrado (Arqueado)</option>
                        <option value="abierto">Abierto (En curso)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Notas del Turno:
                      </label>
                      <input
                        type="text"
                        value={formData.notes || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Sin observaciones"
                        className="search-input"
                        style={{ width: '100%', height: '38px', fontSize: '0.85rem', background: 'var(--bg-main)' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                onClick={() => { setEditingItem(null); setIsCreating(false); }}
                className="admin-btn"
                style={{ height: '36px', padding: '0 14px' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveFormData}
                className="admin-btn admin-btn-primary"
                style={{ height: '36px', padding: '0 16px', gap: '6px' }}
              >
                <Save size={15} />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DETALLES & INSPECCIÓN RÁPIDA DE COMANDA              */}
      {/* ========================================================= */}
      {viewingOrder && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-sheet" style={{ maxWidth: '620px' }}>
            <div className="admin-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: 'var(--accent-blue)',
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  <Receipt size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                    Comanda #{viewingOrder.orderNumber || viewingOrder.id?.slice(-4)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {viewingOrder.createdAt ? new Date(viewingOrder.createdAt).toLocaleString('es-AR') : 'Fecha no especificada'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingOrder(null)}
                className="admin-btn admin-btn-icon-only"
                style={{ height: '32px', width: '32px' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="admin-modal-body" style={{ gap: '1.25rem' }}>
              {/* DATOS DEL CLIENTE & ESTADO */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', background: 'var(--bg-main)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>CLIENTE</div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                    {getCustomerName(viewingOrder.customer)}
                  </div>
                  {getCustomerPhone(viewingOrder) && (
                    <a
                      href={`https://wa.me/${getCustomerPhone(viewingOrder).replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontWeight: 700 }}
                    >
                      <Smartphone size={13} />
                      <span>{getCustomerPhone(viewingOrder)}</span>
                    </a>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>ENTREGA Y PAGO</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    Canal: <span style={{ textTransform: 'capitalize' }}>{viewingOrder.channel || 'Mostrador'}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Pago: <span style={{ textTransform: 'capitalize' }}>{viewingOrder.paymentMethod || 'Efectivo'}</span>
                  </div>
                </div>

                {getCustomerAddress(viewingOrder) && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>DIRECCIÓN DE ENTREGA</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                      <MapPin size={13} style={{ color: 'var(--accent-amber)' }} />
                      <span>{getCustomerAddress(viewingOrder)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ÍTEMS DE LA COMANDA */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Ítems del Pedido ({Array.isArray(viewingOrder.items) ? viewingOrder.items.length : 0})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                  {Array.isArray(viewingOrder.items) && viewingOrder.items.length > 0 ? (
                    viewingOrder.items.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--bg-main)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)'
                      }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            <span style={{ color: 'var(--accent-amber)', marginRight: '6px' }}>{item.qty || 1}x</span>
                            <span>{item.name}</span>
                          </div>
                          {Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0 && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {item.selectedModifiers.join(', ')}
                            </div>
                          )}
                          {item.notes && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--accent-rose)', fontStyle: 'italic', marginTop: '2px' }}>
                              Nota: {item.notes}
                            </div>
                          )}
                        </div>
                        <div style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                          {formatMoney((item.price || item.unitPrice || 0) * (item.qty || 1))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Sin desglose de ítems guardado en este registro.
                    </div>
                  )}
                </div>
              </div>

              {/* TOTAL & CAMBIO RÁPIDO DE ESTADO */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'var(--bg-input, #0e1626)',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)'
              }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-secondary)' }}>Total Final Comanda:</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent-emerald)' }}>
                  {formatMoney(viewingOrder.total)}
                </span>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  CAMBIAR ESTADO DE LA COMANDA:
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'pendiente', label: 'Pendiente', color: '#a855f7' },
                    { id: 'cocina', label: 'Cocina', color: '#f59e0b' },
                    { id: 'listo', label: 'Listo', color: '#3b82f6' },
                    { id: 'entregado', label: 'Entregado', color: '#10b981' },
                    { id: 'cancelado', label: 'Cancelado', color: '#ef4444' }
                  ].map(st => {
                    const isCurrent = viewingOrder.status === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleUpdateOrderStatusQuick(viewingOrder.id, st.id)}
                        className="admin-btn"
                        style={{
                          flex: 1,
                          minWidth: '85px',
                          height: '34px',
                          fontSize: '0.75rem',
                          background: isCurrent ? st.color : 'var(--bg-main)',
                          color: isCurrent ? '#ffffff' : 'var(--text-secondary)',
                          borderColor: isCurrent ? st.color : 'var(--border-subtle)',
                          fontWeight: isCurrent ? 900 : 700
                        }}
                      >
                        {isCurrent && <Check size={13} strokeWidth={3} />}
                        <span>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                onClick={() => setViewingOrder(null)}
                className="admin-btn admin-btn-primary"
                style={{ height: '36px', padding: '0 20px' }}
              >
                Cerrar Visor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL CONFIRMACIÓN DE ELIMINACIÓN                         */}
      {/* ========================================================= */}
      {itemToDelete && (
        <div className="admin-modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="admin-modal-sheet" style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div className="admin-modal-body" style={{ alignItems: 'center', padding: '2rem 1.5rem', gap: '1rem' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-rose)',
                border: '1px solid rgba(239, 68, 68, 0.35)'
              }}>
                <ShieldAlert size={32} />
              </div>

              <div>
                <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  ¿Eliminar registro de la Base de Datos?
                </div>
                <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Esta acción eliminará de forma permanente el ítem{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {itemToDelete.name || `#${itemToDelete.orderNumber}` || itemToDelete.id}
                  </strong>{' '}
                  de la tabla {activeTable.toUpperCase()}. No se puede deshacer.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="admin-btn"
                  style={{ flex: 1, height: '38px', fontSize: '0.82rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirmed}
                  className="admin-btn admin-btn-danger"
                  style={{ flex: 1, height: '38px', fontSize: '0.82rem', fontWeight: 900 }}
                >
                  Confirmar Eliminación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GESTIÓN DE CATEGORÍAS */}
      {isCatModalOpen && (
        <CategoryManagementModal
          products={products}
          onProductsUpdated={(updatedProds) => {
            setProducts(updatedProds);
            setCategoryList(storageService.getCategories());
          }}
          onClose={() => {
            setIsCatModalOpen(false);
            setCategoryList(storageService.getCategories());
            loadAllData();
          }}
        />
      )}
    </div>
  );
}
