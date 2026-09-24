import React, { useState, useEffect } from 'react';
import { FolderPlus, Edit2, Trash2, Check, X, Layers, AlertCircle, Save, ArrowRight } from 'lucide-react';
import { storageService } from '../../services/storageService';
import { supabaseSync } from '../../services/supabaseClient';

const QUICK_EMOJIS = [
  '🍔', '🍟', '🍕', '🥤', '🍺', '🔥', 
  '🌮', '🥪', '🍦', '☕', '🥗', '🍰', 
  '🌭', '🍣', '🥟', '🍩', '🍗', '🍷'
];

export default function CategoryManagementModal({ products = [], onProductsUpdated, onClose, isInline = false }) {
  const [categories, setCategories] = useState(() => storageService.getCategories());
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('🍔');
  
  // Estado para edición en línea
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');

  // Estado para confirmación de borrado
  const [deletingCat, setDeletingCat] = useState(null);
  const [fallbackCategory, setFallbackCategory] = useState('General');

  // Mensaje de feedback temporal
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    const handleUpdate = () => setCategories(storageService.getCategories());
    window.addEventListener('comandafast:categories_updated', handleUpdate);
    return () => window.removeEventListener('comandafast:categories_updated', handleUpdate);
  }, []);

  const showFeedback = (text, type = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  const getProductCount = (categoryName) => {
    if (!Array.isArray(products)) return 0;
    return products.filter(p => p && p.category && p.category.toLowerCase() === categoryName.toLowerCase()).length;
  };

  // Crear categoría
  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const res = storageService.addCategory(newName.trim(), newEmoji);
    if (!res.success) {
      showFeedback(res.error, 'error');
      return;
    }

    setCategories(res.categories);
    setNewName('');
    supabaseSync.saveCategories(res.categories).catch(() => {});
    showFeedback(`Categoría "${res.category.name}" agregada con éxito.`);
  };

  // Iniciar edición
  const startEdit = (cat) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditEmoji(cat.emoji || '📁');
  };

  // Guardar edición
  const handleSaveEdit = (cat) => {
    if (!editName.trim()) return;

    const res = storageService.updateCategory(cat.name, editName.trim(), editEmoji);
    if (!res.success) {
      showFeedback(res.error, 'error');
      return;
    }

    setCategories(res.categories);
    setEditingId(null);
    supabaseSync.saveCategories(res.categories).catch(() => {});

    if (res.prodsChanged && res.updatedProducts) {
      if (typeof onProductsUpdated === 'function') {
        onProductsUpdated(res.updatedProducts);
      }
      supabaseSync.pushProducts(res.updatedProducts).catch(() => {});
      showFeedback(`Categoría renombrada y ${getProductCount(editName)} productos actualizados.`);
    } else {
      showFeedback(`Categoría actualizada.`);
    }
  };

  // Confirmar eliminación
  const handleConfirmDelete = () => {
    if (!deletingCat) return;

    const res = storageService.deleteCategory(deletingCat.name, fallbackCategory);
    if (!res.success) {
      showFeedback(res.error, 'error');
      return;
    }

    setCategories(res.categories);
    supabaseSync.saveCategories(res.categories).catch(() => {});

    if (res.prodsChanged && res.updatedProducts) {
      if (typeof onProductsUpdated === 'function') {
        onProductsUpdated(res.updatedProducts);
      }
      supabaseSync.pushProducts(res.updatedProducts).catch(() => {});
      showFeedback(`Categoría eliminada y productos reasignados a "${fallbackCategory}".`);
    } else {
      showFeedback(`Categoría "${deletingCat.name}" eliminada.`);
    }

    setDeletingCat(null);
  };

  const cardContent = (
    <div style={{
      background: 'var(--bg-card, #1e293b)',
      border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
      borderRadius: '16px',
      width: '100%',
      maxWidth: isInline ? '100%' : '680px',
      maxHeight: isInline ? 'none' : '90vh',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: isInline ? 'var(--shadow-sm)' : '0 20px 40px rgba(0,0,0,0.5)',
      overflow: 'hidden'
    }}>
        {/* MODAL HEADER */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-amber, #f59e0b)'
            }}>
              <Layers size={22} />
            </div>
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary, #fff)' }}>
                Gestión de Categorías del Menú
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
                Agrega, renombra o elimina categorías para organizar tus productos en el POS
              </div>
            </div>
          </div>

          {!isInline && onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary, #94a3b8)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* FEEDBACK TOAST */}
        {feedback && (
          <div style={{
            padding: '8px 16px',
            background: feedback.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
            borderBottom: `1px solid ${feedback.type === 'error' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
            color: feedback.type === 'error' ? '#f87171' : '#34d399',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {feedback.type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
            <span>{feedback.text}</span>
          </div>
        )}

        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* FORMULARIO AGREGAR NUEVA CATEGORÍA */}
          <form onSubmit={handleAddCategory} style={{
            background: 'var(--bg-main, #0f172a)',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-amber, #f59e0b)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FolderPlus size={16} />
              <span>Crear Nueva Categoría</span>
            </div>

            <div className="category-form-grid">
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Emoji</label>
                <input
                  type="text"
                  value={newEmoji}
                  onChange={e => setNewEmoji(e.target.value)}
                  maxLength={4}
                  style={{
                    width: '100%',
                    height: '38px',
                    textAlign: 'center',
                    fontSize: '1.3rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Nombre de la Categoría</label>
                <input
                  type="text"
                  placeholder="Ej: Pizzas, Empanadas, Cafetería..."
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 12px',
                    fontSize: '0.9rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }}
                  required
                />
              </div>

              <div className="btn-add-cat-cell" style={{ alignSelf: 'flex-end' }}>
                <button
                  type="submit"
                  style={{
                    height: '38px',
                    width: '100%',
                    padding: '0 16px',
                    background: 'var(--accent-amber)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 900,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <FolderPlus size={16} />
                  <span>Agregar</span>
                </button>
              </div>
            </div>

            {/* Quick Emoji Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '4px' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>Sugerencias:</span>
              {QUICK_EMOJIS.map(em => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setNewEmoji(em)}
                  style={{
                    background: newEmoji === em ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255,255,255,0.06)',
                    border: newEmoji === em ? '1px solid var(--accent-amber, #f59e0b)' : '1px solid transparent',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    fontSize: '1rem',
                    lineHeight: '1.2'
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
          </form>

          {/* LISTADO DE CATEGORÍAS */}
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-secondary, #cbd5e1)', marginBottom: '8px' }}>
              Categorías Activas ({categories.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {categories.map((cat) => {
                const count = getProductCount(cat.name);
                const isEditing = editingId === cat.id;

                if (isEditing) {
                  return (
                    <div key={cat.id} style={{
                      background: 'var(--bg-main, #0f172a)',
                      border: '1.5px solid var(--accent-amber, #f59e0b)',
                      borderRadius: '10px',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <input
                        type="text"
                        value={editEmoji}
                        onChange={e => setEditEmoji(e.target.value)}
                        maxLength={4}
                        style={{
                          width: '44px',
                          height: '34px',
                          textAlign: 'center',
                          fontSize: '1.2rem',
                          background: 'var(--bg-card, #1e293b)',
                          border: '1px solid var(--border-subtle, rgba(255,255,255,0.2))',
                          borderRadius: '6px',
                          color: '#fff'
                        }}
                      />
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        style={{
                          flex: 1,
                          height: '34px',
                          padding: '0 10px',
                          fontSize: '0.9rem',
                          background: 'var(--bg-card, #1e293b)',
                          border: '1px solid var(--border-subtle, rgba(255,255,255,0.2))',
                          borderRadius: '6px',
                          color: '#fff'
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(cat)}
                        style={{
                          background: 'var(--accent-emerald, #10b981)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 700
                        }}
                      >
                        <Save size={14} />
                        <span>Guardar</span>
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={cat.id} className="category-item-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.3rem' }}>{cat.emoji || '📁'}</span>
                      <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {cat.name}
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: count > 0 ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-card)',
                        color: count > 0 ? 'var(--accent-amber)' : 'var(--text-muted)',
                        border: count > 0 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-subtle)'
                      }}>
                        {count} {count === 1 ? 'producto' : 'productos'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => startEdit(cat)}
                        title="Modificar nombre y emoji de la categoría"
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          border: 'none',
                          color: 'var(--text-secondary, #cbd5e1)',
                          cursor: 'pointer',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}
                      >
                        <Edit2 size={13} />
                        <span>Editar</span>
                      </button>

                      <button
                        onClick={() => {
                          setDeletingCat(cat);
                          const remaining = categories.filter(c => c.id !== cat.id);
                          setFallbackCategory(remaining[0]?.name || 'General');
                        }}
                        title="Eliminar categoría"
                        style={{
                          background: 'rgba(239, 68, 68, 0.12)',
                          border: 'none',
                          color: '#f87171',
                          cursor: 'pointer',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* MODAL SECUNDARIO DE CONFIRMACIÓN DE BORRADO */}
        {deletingCat && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            zIndex: 10
          }}>
            <div style={{
              background: 'var(--bg-card, #1e293b)',
              border: '1.5px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '14px',
              padding: '1.5rem',
              maxWidth: '460px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 15px 30px rgba(0,0,0,0.6)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f87171' }}>
                <AlertCircle size={24} />
                <span style={{ fontSize: '1.1rem', fontWeight: 900 }}>
                  ¿Eliminar categoría "${deletingCat.name}"?
                </span>
              </div>

              {getProductCount(deletingCat.name) > 0 ? (
                <div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #cbd5e1)', margin: 0, lineHeight: '1.4' }}>
                    Esta categoría tiene <strong style={{ color: 'var(--accent-amber, #f59e0b)' }}>${getProductCount(deletingCat.name)} producto(s)</strong> asignados.
                    Para no dejarlos huérfanos, serán reasignados automáticamente a:
                  </p>
                  
                  <div style={{ marginTop: '10px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      Reasignar productos a:
                    </label>
                    <select
                      value={fallbackCategory}
                      onChange={e => setFallbackCategory(e.target.value)}
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        background: 'var(--bg-main, #0f172a)',
                        color: '#fff',
                        border: '1px solid var(--border-subtle, rgba(255,255,255,0.2))',
                        fontSize: '0.85rem',
                        fontWeight: 700
                      }}
                    >
                      {categories.filter(c => c.id !== deletingCat.id).map(c => (
                        <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>
                      ))}
                      <option value="General">📁 General (Nueva)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #cbd5e1)', margin: 0 }}>
                  Esta categoría no tiene productos asignados. Se eliminará del menú inmediatamente.
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setDeletingCat(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 900,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Confirmar Eliminación
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL FOOTER */}
        {!isInline && onClose && (
          <div style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: 'none',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
  );

  if (isInline) {
    return cardContent;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }}>
      {cardContent}
    </div>
  );
}
