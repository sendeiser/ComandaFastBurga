import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Database, Table, Upload, Search, Plus, Edit2, Trash2, Download, RefreshCw, 
  CheckCircle2, AlertTriangle, X, Save, Eye, DollarSign, ShoppingBag, 
  Clock, Store, ArrowUpDown, Filter, ChevronRight, Check, Sparkles,
  Smartphone, MapPin, Tag, FileText, UserCheck, ShieldAlert
} from 'lucide-react';
import { storageService } from '../../../services/storageService';
import CategoryManagementModal from '../../pos/CategoryManagementModal';
import { supabaseSync } from '../../../services/supabaseClient';
import { chatbotService } from '../../../services/chatbotService';

// Funciones seguras para desanidar datos del cliente (string u objeto)
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
  // 1. Estados de Navegación y Tablas
  const [activeTable, setActiveTable] = useState('products'); // 'products' | 'orders' | 'shifts' | 'settings'
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // 2. Datos de Base de Datos
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [settings, setSettings] = useState({});
  const [categoryList, setCategoryList] = useState(() => storageService.getCategories());
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);

  // 3. Modales y Operaciones
  const [editingItem, setEditingItem] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState(null); // { type: 'success' | 'error', text: string }

  // Formulario temporal para edición o creación
  const [formData, setFormData] = useState({});
  const fileInputRef = useRef(null);
  const [compressing, setCompressing] = useState(false);

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

  // Cargar datos
  const loadAllData = useCallback(async () => {
    // Cargar cache local inmediatamente
    setProducts(storageService.getProducts());
    setOrders(storageService.getOrders());
    setShifts(storageService.getCashShiftsHistory());
    setSettings(storageService.getSettings());
    // Luego actualizar desde nube
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
        setShifts(cloudShifts);
      }
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

  // -------------------------------------------------------------
  // FILTRADO DE DATOS
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
        p.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, categoryFilter, searchQuery]);

  const filteredOrders = useMemo(() => {
    let list = [...orders];
    if (statusFilter !== 'all') {
      list = list.filter(o => o.status === statusFilter);
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
  }, [orders, statusFilter, searchQuery]);

  const filteredShifts = useMemo(() => {
    let list = [...shifts];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => 
        s.id?.toLowerCase().includes(q) ||
        s.cashier?.toLowerCase().includes(q) ||
        s.notes?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [shifts, searchQuery]);

    const filteredCategories = useMemo(() => {
    if (!searchQuery) return categoryList;
    const q = searchQuery.toLowerCase();
    return categoryList.filter(c => 
      (c.name || '').toLowerCase().includes(q) || 
      (c.id || '').toLowerCase().includes(q)
    );
  }, [categoryList, searchQuery]);

  const getProductCountForCat = useCallback((catName) => {
    return products.filter(p => (p.category || '').toLowerCase() === (catName || '').toLowerCase()).length;
  }, [products]);

  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [products]);

  // -------------------------------------------------------------
  // ACCIONES CRUD
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
      setFormData({
        id: item.id,
        cashier: item.cashier || '',
        initialCash: item.initialCash || 0,
        countedCash: item.countedCash || 0,
        notes: item.notes || '',
        isClosed: item.isClosed ?? true
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
        category: 'Hamburguesas',
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
          showToast(`✅ Producto "${prodPayload.name}" creado con éxito en BD y Supabase.`);
        } else {
          storageService.updateProduct(editingItem.id, prodPayload);
          supabaseSync.updateProduct(editingItem.id, prodPayload);
          showToast(`✅ Producto "${prodPayload.name}" actualizado con éxito en BD y Supabase.`);
        }

        // Sincronización en vivo con el bot de WhatsApp en segundo plano
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
          showToast(`✅ Comanda registrada en BD y Supabase.`);
        } else {
          storageService.updateOrder(editingItem.id, orderPayload);
          supabaseSync.updateOrder(editingItem.id, orderPayload);
          showToast(`✅ Comanda #${formData.orderNumber || editingItem.id} actualizada en BD y Supabase.`);
        }
      } else if (activeTable === 'shifts') {
        const shiftPayload = {
          cashier: formData.cashier.trim() || 'Cajero',
          initialCash: Number(formData.initialCash) || 0,
          countedCash: Number(formData.countedCash) || 0,
          notes: formData.notes.trim(),
          isClosed: Boolean(formData.isClosed)
        };

        if (isCreating) {
          const newShiftItem = storageService.addCashShiftHistoryItem(shiftPayload);
          supabaseSync.createCashShift({ ...shiftPayload, id: newShiftItem.id, openedAt: newShiftItem.openedAt, closedAt: newShiftItem.closedAt, isClosed: true });
          showToast(`✅ Turno de caja registrado en BD y Supabase.`);
        } else {
          storageService.updateCashShiftHistoryItem(editingItem.id, shiftPayload);
          supabaseSync.updateCashShift(editingItem.id, { ...shiftPayload, isClosed: Boolean(shiftPayload.isClosed) });
          showToast(`✅ Turno de caja modificado en BD y Supabase.`);
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
      showToast('✅ Parámetros de negocio guardados con éxito.');
      loadAllData();
    } catch (err) {
      showToast('❌ Error al guardar configuraciones.', 'error');
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!itemToDelete) return;
    try {
      const botHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
      if (activeTable === 'products') {
        storageService.deleteProduct(itemToDelete.id);
        await supabaseSync.deleteProduct(itemToDelete.id);
        chatbotService.syncWithBaileysServer().catch(() => {});
        showToast(`🗑️ Producto eliminado de la base de datos y Supabase.`);
      } else if (activeTable === 'orders') {
        const idToDelete = itemToDelete.id;
        storageService.deleteOrder(idToDelete);
        setOrders(prev => prev.filter(o => o.id !== idToDelete));
        await Promise.allSettled([
          supabaseSync.deleteOrder(idToDelete),
          fetch(`http://${botHost}:3002/api/orders/${idToDelete}`, { method: 'DELETE' }).catch(() => {})
        ]);
        showToast(`🗑️ Comanda eliminada permanentemente de la Base de Datos.`);
      } else if (activeTable === 'shifts') {
        storageService.deleteCashShiftHistoryItem(itemToDelete.id);
        await supabaseSync.deleteCashShift(itemToDelete.id);
        showToast(`🗑️ Registro de turno eliminado de BD y Supabase.`);
      }
      setItemToDelete(null);
      await loadAllData();
    } catch (err) {
      showToast('❌ Error al eliminar el registro.', 'error');
    }
  };

  const [isClearingOrders, setIsClearingOrders] = useState(false);

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
      showToast('🗑️ Todas las comandas han sido eliminadas permanentemente de la Base de Datos.');
    } catch (e) {
      showToast('❌ Error al vaciar comandas.', 'error');
    } finally {
      setIsClearingOrders(false);
    }
  };

  // -------------------------------------------------------------
  // EXPORTACIONES JSON / CSV
  // -------------------------------------------------------------
  const handleExportJSON = () => {
    const tableData = activeTable === 'products' ? products : activeTable === 'categories' ? categoryList : activeTable === 'orders' ? orders : activeTable === 'shifts' ? shifts : settings;
    const blob = new Blob([JSON.stringify(tableData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comandafast_${activeTable}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`📥 Tabla ${activeTable.toUpperCase()} exportada en JSON.`);
  };

  const formatMoney = (n) => '$' + Number(n || 0).toLocaleString('es-AR');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* TOAST FLOTANTE */}
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
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 700,
          fontSize: '0.85rem',
          animation: 'fade-in 0.2s ease'
        }}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* HEADER DE CONTROL DE TABLAS */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              <Database size={22} style={{ color: 'var(--accent-amber)' }} />
              <span>Gestión de Tablas de Base de Datos</span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Módulo exclusivo del Dueño: visualizá, editá y controlá los registros críticos en tiempo real.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {activeTable !== 'settings' && (
              <button
                type="button"
                onClick={activeTable === 'categories' ? () => setIsCatModalOpen(true) : handleOpenCreate}
                className="btn-confirm-order"
                style={{ height: '36px', padding: '0 14px', fontSize: '0.8rem', gap: '6px' }}
              >
                <Plus size={16} />
                <span>{activeTable === 'categories' ? 'Gestionar / Crear Categoría' : 'Nuevo Registro'}</span>
              </button>
            )}

            {activeTable === 'orders' && orders.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllOrders}
                disabled={isClearingOrders}
                className="cat-pill-btn"
                style={{ height: '36px', padding: '0 12px', fontSize: '0.8rem', gap: '6px', borderColor: 'var(--accent-rose, #ef4444)', color: '#ef4444' }}
                title="Vaciar todas las comandas de la base de datos"
              >
                <Trash2 size={15} />
                <span>{isClearingOrders ? 'Vaciando...' : 'Vaciar Comandas'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportJSON}
              className="cat-pill-btn"
              style={{ height: '36px', padding: '0 12px', fontSize: '0.8rem', gap: '6px' }}
              title="Descargar copia de seguridad en JSON"
            >
              <Download size={15} />
              <span>Exportar JSON</span>
            </button>

            <button
              type="button"
              onClick={loadAllData}
              className="qty-btn"
              style={{ height: '36px', width: '36px', padding: 0 }}
              title="Recargar datos"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* SELECTOR DE TABLAS (CHIPS) */}
        <div className="scrollable-tabs-bar" style={{ gap: '8px', paddingBottom: '4px' }}>
          <button
            type="button"
            className={`cat-pill-btn ${activeTable === 'products' ? 'active' : ''}`}
            onClick={() => { setActiveTable('products'); setSearchQuery(''); }}
            style={{ gap: '6px', fontSize: '0.82rem', padding: '6px 14px', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            <span>🍔 Productos & Menú</span>
            <span style={{ 
              background: activeTable === 'products' ? 'rgba(0,0,0,0.2)' : 'var(--bg-main)', 
              padding: '1px 7px', 
              borderRadius: '10px', 
              fontSize: '0.72rem',
              fontWeight: 800 
            }}>
              {products.length}
            </span>
          </button>

          <button
            type="button"
            className={`cat-pill-btn ${activeTable === 'categories' ? 'active' : ''}`}
            onClick={() => { setActiveTable('categories'); setSearchQuery(''); }}
            style={{ gap: '6px', fontSize: '0.82rem', padding: '6px 14px', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            <span>📁 Categorías</span>
            <span style={{ 
              background: activeTable === 'categories' ? 'rgba(0,0,0,0.2)' : 'var(--bg-main)', 
              padding: '1px 7px', 
              borderRadius: '10px', 
              fontSize: '0.72rem',
              fontWeight: 800 
            }}>
              {categoryList.length}
            </span>
          </button>

          <button
            type="button"
            className={`cat-pill-btn ${activeTable === 'orders' ? 'active' : ''}`}
            onClick={() => { setActiveTable('orders'); setSearchQuery(''); }}
            style={{ gap: '6px', fontSize: '0.82rem', padding: '6px 14px', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            <span>📋 Pedidos & Comandas</span>
            <span style={{ 
              background: activeTable === 'orders' ? 'rgba(0,0,0,0.2)' : 'var(--bg-main)', 
              padding: '1px 7px', 
              borderRadius: '10px', 
              fontSize: '0.72rem',
              fontWeight: 800 
            }}>
              {orders.length}
            </span>
          </button>

          <button
            type="button"
            className={`cat-pill-btn ${activeTable === 'shifts' ? 'active' : ''}`}
            onClick={() => { setActiveTable('shifts'); setSearchQuery(''); }}
            style={{ gap: '6px', fontSize: '0.82rem', padding: '6px 14px', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            <span>💵 Turnos de Caja</span>
            <span style={{ 
              background: activeTable === 'shifts' ? 'rgba(0,0,0,0.2)' : 'var(--bg-main)', 
              padding: '1px 7px', 
              borderRadius: '10px', 
              fontSize: '0.72rem',
              fontWeight: 800 
            }}>
              {shifts.length}
            </span>
          </button>

          <button
            type="button"
            className={`cat-pill-btn ${activeTable === 'settings' ? 'active' : ''}`}
            onClick={() => { setActiveTable('settings'); setSearchQuery(''); }}
            style={{ gap: '6px', fontSize: '0.82rem', padding: '6px 14px', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            <Store size={15} />
            <span>🏪 Configuración del Local</span>
          </button>
        </div>

        {/* BUSCADOR Y FILTROS SECUNDARIOS */}
        {activeTable !== 'settings' && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder={`Buscar en tabla ${activeTable}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                style={{ width: '100%', height: '36px', paddingLeft: '36px', fontSize: '0.8rem' }}
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

            {activeTable === 'products' && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="search-input"
                style={{ height: '36px', fontSize: '0.8rem', minWidth: '160px' }}
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c === 'all' ? 'Todas las categorías' : c}</option>
                ))}
              </select>
            )}

            {activeTable === 'categories' && (
          <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 14px' }}>Categoría</th>
                  <th style={{ padding: '12px 14px' }}>Identificador</th>
                  <th style={{ padding: '12px 14px' }}>Productos Asociados</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No se encontraron categorías coincidentes.
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map(cat => {
                    const count = getProductCountForCat(cat.name);
                    return (
                      <tr key={cat.id || cat.name} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.4rem' }}>{cat.emoji || '📁'}</span>
                            <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{cat.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {cat.id || '-'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            padding: '3px 9px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: count > 0 ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-main)',
                            color: count > 0 ? 'var(--accent-blue, #3b82f6)' : 'var(--text-muted)',
                            border: '1px solid var(--border-subtle)'
                          }}>
                            {count} {count === 1 ? 'producto' : 'productos'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => setIsCatModalOpen(true)}
                            className="qty-btn"
                            style={{ height: '30px', padding: '0 12px', fontSize: '0.75rem', gap: '5px' }}
                            title="Gestionar Categorías"
                          >
                            <Edit2 size={13} />
                            <span>Gestionar</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTable === 'orders' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="search-input"
                style={{ height: '36px', fontSize: '0.8rem', minWidth: '160px' }}
              >
                <option value="all">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="cocina">En Cocina</option>
                <option value="listo">Listo en Mostrador</option>
                <option value="entregado">Entregado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* VISTA TABLA 1: PRODUCTOS                                  */}
      {/* ========================================================= */}
      {activeTable === 'products' && (
        <div className="table-responsive-wrapper">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 14px' }}>Ítem</th>
                  <th style={{ padding: '12px 14px' }}>Categoría</th>
                  <th style={{ padding: '12px 14px' }}>Precio</th>
                  <th style={{ padding: '12px 14px' }}>Modificadores / Extras</th>
                  <th style={{ padding: '12px 14px' }}>Descripción</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No se encontraron productos coincidentes.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(prod => (
                    <tr key={prod.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {prod.image ? (
                            <img 
                              src={prod.image} 
                              alt={prod.name} 
                              style={{ width: '34px', height: '34px', borderRadius: '6px', objectFit: 'cover' }} 
                            />
                          ) : (
                            <span style={{ fontSize: '1.4rem' }}>{prod.emoji || '🍔'}</span>
                          )}
                          <div>
                            <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{prod.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{prod.id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: 'var(--accent-amber)'
                        }}>
                          {prod.category}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 900, color: 'var(--text-primary)' }}>
                        {formatMoney(prod.price)}
                      </td>
                      <td style={{ padding: '12px 14px', maxWidth: '280px' }}>
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
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              +{prod.modifiers.length - 3} más
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {prod.description || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(prod)}
                            className="qty-btn"
                            style={{ height: '30px', padding: '0 8px', gap: '4px', fontSize: '0.75rem' }}
                            title="Editar producto"
                          >
                            <Edit2 size={13} />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setItemToDelete(prod)}
                            className="qty-btn"
                            style={{ height: '30px', width: '30px', padding: 0, color: 'var(--accent-rose)' }}
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
      {/* VISTA TABLA 2: PEDIDOS & COMANDAS                          */}
      {/* ========================================================= */}
      {activeTable === 'orders' && (
        <div className="table-responsive-wrapper">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 14px' }}>Comanda</th>
                  <th style={{ padding: '12px 14px' }}>Cliente / Tel</th>
                  <th style={{ padding: '12px 14px' }}>Canal</th>
                  <th style={{ padding: '12px 14px' }}>Medio de Pago</th>
                  <th style={{ padding: '12px 14px' }}>Total</th>
                  <th style={{ padding: '12px 14px' }}>Estado</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No se encontraron comandas coincidentes.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(order => {
                    const stColor = 
                      order.status === 'entregado' ? '#10b981' :
                      order.status === 'cocina' ? '#f59e0b' :
                      order.status === 'listo' ? '#3b82f6' :
                      order.status === 'cancelado' ? '#ef4444' : '#a855f7';

                    return (
                      <tr key={order.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 900, color: 'var(--text-primary)' }}>
                            #{order.orderNumber || order.id?.slice(-4)}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{getCustomerName(order.customer)}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{getCustomerPhone(order) || 'Sin teléfono'}</div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: 'var(--bg-main)',
                            border: '1px solid var(--border-subtle)'
                          }}>
                            {order.channel === 'whatsapp' ? '💬 WhatsApp' : order.channel === 'delivery' ? '🛵 Delivery' : '🍔 Mostrador'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textTransform: 'capitalize' }}>
                          {order.paymentMethod || 'Efectivo'}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 900, color: 'var(--text-primary)' }}>
                          {formatMoney(order.total)}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            color: stColor,
                            background: `${stColor}22`
                          }}>
                            ● {order.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(order)}
                              className="qty-btn"
                              style={{ height: '30px', padding: '0 8px', gap: '4px', fontSize: '0.75rem' }}
                              title="Editar comanda"
                            >
                              <Edit2 size={13} />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setItemToDelete(order)}
                              className="qty-btn"
                              style={{ height: '30px', width: '30px', padding: 0, color: 'var(--accent-rose)' }}
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
      {/* VISTA TABLA 3: TURNOS DE CAJA                             */}
      {/* ========================================================= */}
      {activeTable === 'shifts' && (
        <div className="table-responsive-wrapper">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 14px' }}>Turno</th>
                  <th style={{ padding: '12px 14px' }}>Cajero</th>
                  <th style={{ padding: '12px 14px' }}>Fondo Inicial</th>
                  <th style={{ padding: '12px 14px' }}>Ventas Efectivo</th>
                  <th style={{ padding: '12px 14px' }}>Declarado</th>
                  <th style={{ padding: '12px 14px' }}>Diferencia</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredShifts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No se encontraron turnos registrados.
                    </td>
                  </tr>
                ) : (
                  filteredShifts.map(shift => {
                    const diff = Number(shift.difference || 0);
                    const diffColor = diff === 0 ? '#10b981' : diff > 0 ? '#3b82f6' : '#ef4444';
                    return (
                      <tr key={shift.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                            {new Date(shift.openedAt).toLocaleDateString()}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {new Date(shift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                          {shift.cashier || 'Cajero'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {formatMoney(shift.initialCash)}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {formatMoney(shift.cashSales)}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 800 }}>
                          {formatMoney(shift.countedCash)}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: 900,
                            color: diffColor,
                            background: `${diffColor}22`
                          }}>
                            {diff === 0 ? 'Exacto $0' : `${diff > 0 ? '+' : ''}${formatMoney(diff)}`}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(shift)}
                              className="qty-btn"
                              style={{ height: '30px', padding: '0 8px', gap: '4px', fontSize: '0.75rem' }}
                              title="Modificar turno"
                            >
                              <Edit2 size={13} />
                              <span>Modificar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setItemToDelete(shift)}
                              className="qty-btn"
                              style={{ height: '30px', width: '30px', padding: 0, color: 'var(--accent-rose)' }}
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
      {/* VISTA TABLA 4: CONFIGURACIÓN DEL LOCAL                    */}
      {/* ========================================================= */}
      {activeTable === 'settings' && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Store size={18} style={{ color: 'var(--accent-amber)' }} />
            <span>Parámetros Operativos del Local</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Nombre del Negocio:
              </label>
              <input
                type="text"
                value={settings.storeName || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, storeName: e.target.value }))}
                className="search-input"
                style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Teléfono / WhatsApp Oficial:
              </label>
              <input
                type="text"
                value={settings.phone || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, phone: e.target.value }))}
                className="search-input"
                style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Dirección del Local:
              </label>
              <input
                type="text"
                value={settings.address || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, address: e.target.value }))}
                className="search-input"
                style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Alias de Mercado Pago / Banco:
              </label>
              <input
                type="text"
                value={settings.aliasMp || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, aliasMp: e.target.value }))}
                className="search-input"
                style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                CBU Bancario:
              </label>
              <input
                type="text"
                value={settings.cbu || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, cbu: e.target.value }))}
                className="search-input"
                style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Costo Base de Envío Delivery ($):
              </label>
              <input
                type="number"
                value={settings.deliveryFee || 0}
                onChange={(e) => setSettings(prev => ({ ...prev, deliveryFee: Number(e.target.value) }))}
                className="search-input"
                style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Pie de Ticket Térmico:
            </label>
            <input
              type="text"
              value={settings.ticketFooter || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, ticketFooter: e.target.value }))}
              placeholder="¡Gracias por elegir ComandaFast Burgers!"
              className="search-input"
              style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={handleSaveSettings}
              className="btn-confirm-order"
              style={{ height: '38px', padding: '0 20px', fontSize: '0.85rem', gap: '6px' }}
            >
              <Save size={16} />
              <span>Guardar Parámetros</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL EDITAR / CREAR REGISTRO                             */}
      {/* ========================================================= */}
      {(editingItem || isCreating) && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(3px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '540px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.5rem',
            boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} style={{ color: 'var(--accent-amber)' }} />
                <span>{isCreating ? `Nuevo Registro en ${activeTable.toUpperCase()}` : `Modificar en ${activeTable.toUpperCase()}`}</span>
              </div>
              <button
                type="button"
                onClick={() => { setEditingItem(null); setIsCreating(false); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* CAMPOS TABLA PRODUCTOS */}
            {activeTable === 'products' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Nombre del Producto:
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Triple Bacon Especial"
                    className="search-input"
                    style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block' }}>
                        Categoría:
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCatModalOpen(true)}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-amber)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700, padding: 0 }}
                      >
                        + Gestionar
                      </button>
                    </div>
                    <select
                      value={formData.category || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="search-input"
                      style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                    >
                      {categoryList.map(c => (
                        <option key={c.id || c.name} value={c.name}>
                          {c.emoji ? `${c.emoji} ` : ''}{c.name}
                        </option>
                      ))}
                      {formData.category && !categoryList.some(c => c.name.toLowerCase() === formData.category.toLowerCase()) && (
                        <option value={formData.category}>{formData.category}</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Precio ($ ARS):
                    </label>
                    <input
                      type="number"
                      value={formData.price || 0}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      className="search-input"
                      style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Emoji / Icono:
                  </label>
                  <input
                    type="text"
                    value={formData.emoji || '🍔'}
                    onChange={(e) => setFormData(prev => ({ ...prev, emoji: e.target.value }))}
                    className="search-input"
                    style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Foto del Producto:
                  </label>
                  {formData.image ? (
                    <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', maxHeight: '160px', border: '1px solid var(--border-subtle)', marginBottom: '8px' }}>
                      <img
                        src={formData.image}
                        alt="Previsualización"
                        style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }}
                      />
                      <div style={{ position: 'absolute', top: '6px', right: '6px', display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            background: 'rgba(0,0,0,0.75)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <RefreshCw size={12} />
                          <span>Cambiar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                          style={{
                            background: 'rgba(239, 68, 68, 0.9)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '4px 6px',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Eliminar foto"
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
                        background: 'var(--bg-card)',
                        borderRadius: '8px',
                        padding: '1rem',
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
                      <Upload size={22} style={{ color: 'var(--accent-amber)' }} />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                        {compressing ? 'Optimizando foto...' : '📷 Subir foto desde el dispositivo / celular'}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        Haz clic aquí para seleccionar imagen JPG, PNG o WEBP
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
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>O URL web:</span>
                    <input
                      type="text"
                      value={formData.image || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                      placeholder="https://..."
                      className="search-input"
                      style={{ flex: 1, height: '32px', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Modificadores / Adicionales (separados por coma):
                  </label>
                  <input
                    type="text"
                    value={formData.modifiersText || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, modifiersText: e.target.value }))}
                    placeholder="Sin cebolla, Extra Cheddar (+$800), Sin tomate"
                    className="search-input"
                    style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Descripción o ingredientes:
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="search-input"
                    style={{ width: '100%', padding: '8px', fontSize: '0.85rem', resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            {/* CAMPOS TABLA PEDIDOS */}
            {activeTable === 'orders' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Estado del Pedido:
                    </label>
                    <select
                      value={formData.status || 'pendiente'}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      className="search-input"
                      style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="cocina">En Cocina</option>
                      <option value="listo">Listo</option>
                      <option value="entregado">Entregado</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Total ($):
                    </label>
                    <input
                      type="number"
                      value={formData.total || 0}
                      onChange={(e) => setFormData(prev => ({ ...prev, total: e.target.value }))}
                      className="search-input"
                      style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Cliente:
                  </label>
                  <input
                    type="text"
                    value={formData.customer || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer: e.target.value }))}
                    className="search-input"
                    style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Teléfono:
                    </label>
                    <input
                      type="text"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="search-input"
                      style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Canal:
                    </label>
                    <select
                      value={formData.channel || 'mostrador'}
                      onChange={(e) => setFormData(prev => ({ ...prev, channel: e.target.value }))}
                      className="search-input"
                      style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                    >
                      <option value="mostrador">Mostrador / Local</option>
                      <option value="delivery">Delivery</option>
                      <option value="whatsapp">WhatsApp Bot</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Dirección de Entrega:
                  </label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="search-input"
                    style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            )}

            {/* CAMPOS TABLA TURNOS */}
            {activeTable === 'shifts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Cajero a Cargo:
                  </label>
                  <input
                    type="text"
                    value={formData.cashier || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, cashier: e.target.value }))}
                    className="search-input"
                    style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Fondo Inicial ($):
                    </label>
                    <input
                      type="number"
                      value={formData.initialCash || 0}
                      onChange={(e) => setFormData(prev => ({ ...prev, initialCash: e.target.value }))}
                      className="search-input"
                      style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Declarado en Arqueo ($):
                    </label>
                    <input
                      type="number"
                      value={formData.countedCash || 0}
                      onChange={(e) => setFormData(prev => ({ ...prev, countedCash: e.target.value }))}
                      className="search-input"
                      style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Notas del Turno:
                  </label>
                  <input
                    type="text"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="search-input"
                    style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            )}

            {/* BOTONES MODAL */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => { setEditingItem(null); setIsCreating(false); }}
                className="qty-btn"
                style={{ height: '36px', padding: '0 14px', fontSize: '0.82rem' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveFormData}
                className="btn-confirm-order"
                style={{ height: '36px', padding: '0 16px', fontSize: '0.82rem', gap: '6px' }}
              >
                <Save size={15} />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL CONFIRMACIÓN DE ELIMINACIÓN                         */}
      {/* ========================================================= */}
      {itemToDelete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(3px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '400px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            textAlign: 'center'
          }}>
            <div style={{ color: 'var(--accent-rose)', display: 'flex', justifyContent: 'center' }}>
              <ShieldAlert size={42} />
            </div>
            <div style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--text-primary)' }}>
              ¿Eliminar registro de la base de datos?
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Esta acción eliminará el registro <strong>{itemToDelete.name || itemToDelete.id || 'seleccionado'}</strong> de la tabla {activeTable.toUpperCase()}.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="qty-btn"
                style={{ height: '34px', padding: '0 14px', fontSize: '0.82rem' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                style={{
                  height: '34px',
                  padding: '0 16px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  background: 'var(--accent-rose)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer'
                }}
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



