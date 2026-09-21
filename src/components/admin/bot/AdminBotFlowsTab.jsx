// =========================================================
// GESTOR Y DISEÑADOR DE FLUJOS CONVERSACIONALES Y CONDICIONES
// ComandaFast WhatsApp Bot Builder
// =========================================================

import React, { useState, useMemo } from 'react';
import { 
  GitBranch, Plus, Search, Tag, Edit3, Copy, Trash2, CheckCircle2, 
  RotateCcw, Sparkles, Utensils, PartyPopper, Truck, UserCheck, 
  MessageSquare, Layers, Image as ImageIcon, Eye, X, Check, 
  AlertCircle, Play, FlaskConical, CheckCheck, Upload, Link
} from 'lucide-react';
import { 
  FLOW_CATEGORIES, 
  FLOW_MATCH_TYPES, 
  FLOW_SCOPES, 
  DEFAULT_CUSTOM_FLOWS 
} from '../../../services/whatsappBotConstants';
import { chatbotService } from '../../../services/chatbotService';

export default function AdminBotFlowsTab({ flows = [], onSaveFlows, onTestInLab }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingFlow, setEditingFlow] = useState(null); // null o flow object
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [notification, setNotification] = useState(null); // { type: 'success' | 'info', message: string }
  const [newKeywordInput, setNewKeywordInput] = useState('');

  // Icono por categoría
  const getCategoryIcon = (catId) => {
    switch (catId) {
      case 'promociones': return <Sparkles size={14} style={{ color: '#f59e0b' }} />;
      case 'dietas': return <Utensils size={14} style={{ color: '#10b981' }} />;
      case 'eventos': return <PartyPopper size={14} style={{ color: '#a855f7' }} />;
      case 'envios': return <Truck size={14} style={{ color: '#3b82f6' }} />;
      case 'atencion': return <UserCheck size={14} style={{ color: '#ec4899' }} />;
      default: return <MessageSquare size={14} style={{ color: '#64748b' }} />;
    }
  };

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Filtrado reactivo de flujos
  const filteredFlows = useMemo(() => {
    return flows.filter(flow => {
      const matchCat = selectedCategory === 'all' || flow.category === selectedCategory;
      const term = searchTerm.toLowerCase().trim();
      if (!term) return matchCat;

      const matchName = (flow.name || '').toLowerCase().includes(term);
      const matchKeywords = (flow.condition?.keywords || []).some(k => k.toLowerCase().includes(term));
      const matchResponse = (flow.action?.response || '').toLowerCase().includes(term);

      return matchCat && (matchName || matchKeywords || matchResponse);
    });
  }, [flows, selectedCategory, searchTerm]);

  // Toggle Activar/Pausar flujo
  const handleToggleActive = (flowId) => {
    const updated = flows.map(f => {
      if (f.id === flowId) {
        return { ...f, enabled: !f.enabled };
      }
      return f;
    });
    onSaveFlows(updated);
    const target = updated.find(f => f.id === flowId);
    showToast(`Flujo "${target.name}" ${target.enabled ? 'activado' : 'pausado'}.`);
  };

  // Iniciar Creación de nuevo flujo
  const handleOpenCreateModal = () => {
    setEditingFlow({
      isNew: true,
      id: 'flow-' + Date.now(),
      name: 'Nuevo Flujo Automático',
      category: 'promociones',
      enabled: true,
      priority: 5,
      condition: {
        type: 'contains_any',
        keywords: ['promocion', 'descuento'],
        scope: 'always'
      },
      action: {
        type: 'reply_text',
        response: '🍔 *¡Hola {cliente}!* Escribí aquí la respuesta que dará tu bot cuando el cliente escriba alguna de las palabras clave.',
        imageUrl: '',
        suggestedChips: ['Ver Menú', 'Comprar']
      },
      stats: { triggerCount: 0, lastTriggered: null }
    });
    setNewKeywordInput('');
  };

  // Iniciar Edición de flujo existente
  const handleOpenEditModal = (flow) => {
    setEditingFlow({
      isNew: false,
      ...flow,
      condition: {
        type: flow.condition?.type || 'contains_any',
        keywords: [...(flow.condition?.keywords || [])],
        scope: flow.condition?.scope || 'always'
      },
      action: {
        type: flow.action?.type || 'reply_text',
        response: flow.action?.response || '',
        imageUrl: flow.action?.imageUrl || '',
        suggestedChips: [...(flow.action?.suggestedChips || [])]
      }
    });
    setNewKeywordInput('');
  };

  // Duplicar un flujo
  const handleDuplicateFlow = (flow) => {
    const duplicated = {
      ...flow,
      id: 'flow-' + Date.now(),
      name: `${flow.name} (Copia)`,
      stats: { triggerCount: 0, lastTriggered: null }
    };
    const updated = [duplicated, ...flows];
    onSaveFlows(updated);
    showToast(`Flujo duplicado con éxito como "${duplicated.name}".`);
  };

  // Eliminar un flujo
  const handleDeleteFlow = (flowId) => {
    const target = flows.find(f => f.id === flowId);
    const updated = flows.filter(f => f.id !== flowId);
    onSaveFlows(updated);
    setDeleteConfirmId(null);
    showToast(`Flujo "${target?.name || 'eliminado'}" borrado correctamente.`, 'info');
  };

  // Restablecer flujos a los valores sugeridos por defecto
  const handleResetDefaults = () => {
    if (window.confirm('¿Restablecer los 6 flujos gastronómicos sugeridos de ComandaFast? Se conservarán los flujos existentes y se restaurarán los predeterminados.')) {
      const reset = chatbotService.resetCustomFlows();
      onSaveFlows(reset);
      showToast('Flujos sugeridos restablecidos con éxito.');
    }
  };

  // Guardar Cambios del Modal
  const handleSaveModal = (e) => {
    e?.preventDefault();
    if (!editingFlow.name?.trim()) {
      alert('Por favor asigná un nombre al flujo.');
      return;
    }
    if (!editingFlow.condition?.keywords || editingFlow.condition.keywords.length === 0) {
      alert('Por favor agregá al menos una palabra clave disparadora.');
      return;
    }
    if (!editingFlow.action?.response?.trim()) {
      alert('Por favor redactá el mensaje de respuesta para el cliente.');
      return;
    }

    let updatedList;
    if (editingFlow.isNew) {
      const { isNew, ...cleanFlow } = editingFlow;
      updatedList = [cleanFlow, ...flows];
      showToast(`Flujo "${cleanFlow.name}" creado con éxito.`);
    } else {
      const { isNew, ...cleanFlow } = editingFlow;
      updatedList = flows.map(f => f.id === cleanFlow.id ? cleanFlow : f);
      showToast(`Flujo "${cleanFlow.name}" actualizado con éxito.`);
    }

    onSaveFlows(updatedList);
    setEditingFlow(null);
  };

  // Manejo de chips de palabras clave
  const handleAddKeyword = (kw) => {
    const clean = (kw || newKeywordInput).trim().toLowerCase();
    if (!clean) return;

    const currentKws = editingFlow.condition.keywords || [];
    if (!currentKws.includes(clean)) {
      setEditingFlow(prev => ({
        ...prev,
        condition: {
          ...prev.condition,
          keywords: [...currentKws, clean]
        }
      }));
    }
    setNewKeywordInput('');
  };

  const handleRemoveKeyword = (kwToRemove) => {
    setEditingFlow(prev => ({
      ...prev,
      condition: {
        ...prev.condition,
        keywords: (prev.condition.keywords || []).filter(k => k !== kwToRemove)
      }
    }));
  };

  // Subir imagen en Base64 para el flujo
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert('La imagen no debe superar los 8 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setEditingFlow(prev => ({
        ...prev,
        action: {
          ...prev.action,
          imageUrl: reader.result
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
      {/* TOAST NOTIFICATION */}
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: notification.type === 'info' ? 'var(--accent-rose)' : 'var(--accent-emerald)',
          color: '#fff',
          padding: '0.75rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.88rem',
          fontWeight: 800,
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <CheckCircle2 size={18} />
          <span>{notification.message}</span>
        </div>
      )}

      {/* HEADER & ACTION BAR */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.15rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.4))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--accent-amber)'
              }}>
                <GitBranch size={20} style={{ color: 'var(--accent-amber)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                  Diseñador de Flujos Conversacionales y Condiciones
                </h3>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Creá respuestas automáticas, modificá condiciones de palabras clave y despachá fotos por WhatsApp.
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="qty-btn"
              style={{ width: 'auto', padding: '0.45rem 0.85rem', fontSize: '0.78rem', gap: '6px' }}
              onClick={handleResetDefaults}
              title="Restablecer sugeridos gastronómicos"
            >
              <RotateCcw size={14} />
              <span>Restablecer Sugeridos</span>
            </button>

            <button
              type="button"
              className="btn-confirm-order"
              style={{
                width: 'auto',
                padding: '0.5rem 1.15rem',
                fontSize: '0.84rem',
                gap: '6px',
                background: 'linear-gradient(135deg, var(--accent-amber), #d97706)',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
              }}
              onClick={handleOpenCreateModal}
            >
              <Plus size={16} />
              <span>Crear Nuevo Flujo</span>
            </button>
          </div>
        </div>

        {/* SEARCH AND CATEGORY FILTER TABS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Categories */}
          <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '2px', flex: 1, minWidth: '280px' }}>
            {FLOW_CATEGORIES.map(cat => {
              const count = cat.id === 'all' 
                ? flows.length 
                : flows.filter(f => f.category === cat.id).length;
              const isActive = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`cat-pill-btn ${isActive ? 'active' : ''}`}
                  style={{
                    fontSize: '0.75rem',
                    height: '30px',
                    padding: '0 10px',
                    gap: '6px',
                    borderColor: isActive ? 'var(--accent-amber)' : undefined
                  }}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.id !== 'all' && getCategoryIcon(cat.id)}
                  <span>{cat.label}</span>
                  <span style={{
                    fontSize: '0.65rem',
                    background: isActive ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    padding: '1px 5px',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 800
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar por nombre o keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              style={{
                width: '100%',
                height: '32px',
                paddingLeft: '32px',
                paddingRight: '24px',
                fontSize: '0.78rem',
                borderRadius: 'var(--radius-md)'
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FLOWS CARDS GRID */}
      {filteredFlows.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px dashed var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '3rem 1.5rem',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <GitBranch size={40} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          <h4 style={{ color: 'var(--text-primary)', margin: 0 }}>No se encontraron flujos con ese filtro</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', maxWidth: '400px', margin: 0 }}>
            Podés buscar con otra palabra o hacer clic en "Crear Nuevo Flujo" para sumar un nuevo disparador.
          </p>
          <button
            type="button"
            className="cat-pill-btn active"
            style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', marginTop: '0.5rem' }}
            onClick={handleOpenCreateModal}
          >
            <Plus size={14} />
            <span>Crear Flujo Ahora</span>
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '1rem'
        }}>
          {filteredFlows.map(flow => {
            const isDeleting = deleteConfirmId === flow.id;
            const matchTypeObj = FLOW_MATCH_TYPES.find(m => m.id === flow.condition?.type) || FLOW_MATCH_TYPES[0];
            const scopeObj = FLOW_SCOPES.find(s => s.id === flow.condition?.scope) || FLOW_SCOPES[0];

            return (
              <div
                key={flow.id}
                style={{
                  background: 'var(--bg-card)',
                  border: flow.enabled ? '1px solid var(--border-subtle)' : '1px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  boxShadow: flow.enabled ? 'var(--shadow-sm)' : 'none',
                  opacity: flow.enabled ? 1 : 0.65,
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {/* CARD HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {getCategoryIcon(flow.category)}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.94rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                        {flow.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span style={{
                          fontSize: '0.65rem',
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: 'var(--text-muted)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}>
                          {flow.category}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          • Prioridad {flow.priority || 5}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ACTIVE SWITCH */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(flow.id)}
                    style={{
                      background: flow.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                      border: flow.enabled ? '1px solid var(--accent-emerald)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-full)',
                      padding: '3px 10px',
                      fontSize: '0.7rem',
                      fontWeight: 900,
                      color: flow.enabled ? 'var(--accent-emerald)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease'
                    }}
                    title={flow.enabled ? 'Pausar flujo' : 'Activar flujo'}
                  >
                    <span style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: flow.enabled ? 'var(--accent-emerald)' : 'var(--text-muted)'
                    }} />
                    <span>{flow.enabled ? 'ACTIVO' : 'PAUSADO'}</span>
                  </button>
                </div>

                {/* CONDICIONES & DISPARADORES */}
                <div style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.65rem 0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Tag size={12} />
                      <span>Condición: {matchTypeObj.label}</span>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {scopeObj.label.split(' ')[0]} {scopeObj.label.split(' ')[1]}
                    </span>
                  </div>

                  {/* Keywords Chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {(flow.condition?.keywords || []).map(kw => (
                      <span
                        key={kw}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '4px',
                          padding: '1px 6px',
                          fontSize: '0.7rem',
                          color: 'var(--text-primary)',
                          fontWeight: 700
                        }}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                {/* RESPUESTA PREVIEW (WHATSAPP BUBBLE) */}
                <div style={{
                  background: 'linear-gradient(135deg, #0b3c33, #062e27)',
                  border: '1px solid rgba(37, 211, 102, 0.25)',
                  borderRadius: '10px 10px 10px 2px',
                  padding: '0.75rem 0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.3)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.64rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 800, textTransform: 'uppercase' }}>
                      Respuesta del Bot en WhatsApp:
                    </span>
                    {flow.action?.imageUrl && (
                      <span style={{ fontSize: '0.64rem', background: 'rgba(37, 211, 102, 0.2)', color: '#25D366', padding: '1px 5px', borderRadius: '4px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <ImageIcon size={10} /> Foto adjunta
                      </span>
                    )}
                  </div>

                  {/* Optional Image thumbnail */}
                  {flow.action?.imageUrl && (
                    <div style={{ width: '100%', height: '80px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <img src={flow.action.imageUrl} alt="Adjunto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}

                  <div style={{
                    color: '#e9edef',
                    fontSize: '0.78rem',
                    lineHeight: '1.4',
                    maxHeight: '90px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit'
                  }}>
                    {flow.action?.response}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '2px', fontSize: '0.62rem', color: '#8696a0' }}>
                    <span>19:30</span>
                    <CheckCheck size={12} style={{ color: '#53bdeb' }} />
                  </div>
                </div>

                {/* CARD FOOTER ACTIONS */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className="qty-btn"
                      style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.74rem', gap: '4px' }}
                      onClick={() => handleOpenEditModal(flow)}
                      title="Modificar flujo y condiciones"
                    >
                      <Edit3 size={13} />
                      <span>Modificar</span>
                    </button>

                    <button
                      type="button"
                      className="qty-btn"
                      style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.74rem', gap: '4px' }}
                      onClick={() => handleDuplicateFlow(flow)}
                      title="Duplicar flujo"
                    >
                      <Copy size={13} />
                      <span>Duplicar</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    {isDeleting ? (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteFlow(flow.id)}
                          style={{
                            background: 'var(--accent-rose)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          ¿Borrar?
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="qty-btn"
                        style={{ width: '30px', height: '30px', padding: 0 }}
                        onClick={() => setDeleteConfirmId(flow.id)}
                        title="Eliminar este flujo"
                      >
                        <Trash2 size={13} style={{ color: 'var(--accent-rose)' }} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onTestInLab?.(flow)}
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: 'var(--accent-emerald)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Probar en el simulador de chat"
                    >
                      <FlaskConical size={13} />
                      <span>Probar</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREAR / MODIFICAR FLUJO CONVERSACIONAL */}
      {/* ========================================================= */}
      {editingFlow && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.78)',
          backdropFilter: 'blur(5px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '740px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
            overflow: 'hidden'
          }}>
            {/* MODAL HEADER */}
            <div style={{
              background: 'var(--bg-sidebar)',
              borderBottom: '1px solid var(--border-subtle)',
              padding: '1rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, var(--accent-amber), #d97706)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <GitBranch size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                    {editingFlow.isNew ? '✨ Crear Nuevo Flujo Conversacional' : `✏️ Modificar Flujo: ${editingFlow.name}`}
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Configurá el disparador, las condiciones de coincidencia y la respuesta con foto.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingFlow(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* MODAL BODY (FORM) */}
            <form onSubmit={handleSaveModal} style={{ overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* SECCIÓN 1: DATOS GENERALES */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 110px', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Nombre del Flujo:
                  </label>
                  <input
                    type="text"
                    required
                    value={editingFlow.name}
                    onChange={(e) => setEditingFlow({ ...editingFlow, name: e.target.value })}
                    placeholder="Ej: Promociones 2x1, Opciones Sin TACC..."
                    className="search-input"
                    style={{ width: '100%', height: '36px', fontSize: '0.84rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Categoría:
                  </label>
                  <select
                    value={editingFlow.category}
                    onChange={(e) => setEditingFlow({ ...editingFlow, category: e.target.value })}
                    className="search-input"
                    style={{ width: '100%', height: '36px', fontSize: '0.82rem' }}
                  >
                    {FLOW_CATEGORIES.filter(c => c.id !== 'all').map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Estado:
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditingFlow({ ...editingFlow, enabled: !editingFlow.enabled })}
                    style={{
                      width: '100%',
                      height: '36px',
                      background: editingFlow.enabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: editingFlow.enabled ? '1px solid var(--accent-emerald)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      color: editingFlow.enabled ? 'var(--accent-emerald)' : 'var(--text-muted)',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    {editingFlow.enabled ? '🟢 Activo' : '⚪ Pausado'}
                  </button>
                </div>
              </div>

              {/* SECCIÓN 2: CONDICIONES DE ACTIVACIÓN (TRIGGERS) */}
              <div style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem'
              }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 900, color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Tag size={15} />
                  <span>Condiciones y Disparadores (Triggers)</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Tipo de Coincidencia:
                    </label>
                    <select
                      value={editingFlow.condition.type}
                      onChange={(e) => setEditingFlow({
                        ...editingFlow,
                        condition: { ...editingFlow.condition, type: e.target.value }
                      })}
                      className="search-input"
                      style={{ width: '100%', height: '34px', fontSize: '0.8rem' }}
                    >
                      {FLOW_MATCH_TYPES.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Ámbito de Activación:
                    </label>
                    <select
                      value={editingFlow.condition.scope}
                      onChange={(e) => setEditingFlow({
                        ...editingFlow,
                        condition: { ...editingFlow.condition, scope: e.target.value }
                      })}
                      className="search-input"
                      style={{ width: '100%', height: '34px', fontSize: '0.8rem' }}
                    >
                      {FLOW_SCOPES.map(s => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Input de palabras clave */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Palabras Clave o Frases Disparadoras (Escribí una palabra y presioná Enter):
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      value={newKeywordInput}
                      onChange={(e) => setNewKeywordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddKeyword();
                        }
                      }}
                      placeholder="Ej: promo, 2x1, cumpleaños, celíaco..."
                      className="search-input"
                      style={{ flex: 1, height: '34px', fontSize: '0.82rem' }}
                    />
                    <button
                      type="button"
                      className="qty-btn"
                      style={{ width: 'auto', padding: '0 12px', fontSize: '0.78rem', gap: '4px' }}
                      onClick={() => handleAddKeyword()}
                    >
                      <Plus size={14} />
                      <span>Agregar</span>
                    </button>
                  </div>

                  {/* Chips de keywords activas */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                    {(editingFlow.condition.keywords || []).map(kw => (
                      <span
                        key={kw}
                        style={{
                          background: 'rgba(245, 158, 11, 0.15)',
                          border: '1px solid var(--accent-amber)',
                          color: 'var(--accent-amber)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>{kw}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyword(kw)}
                          style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    {(editingFlow.condition.keywords || []).length === 0 && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--accent-rose)', fontStyle: 'italic' }}>
                        ⚠️ Agregá al menos una palabra clave para que el bot pueda activar este flujo.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* SECCIÓN 3: RESPUESTA DEL BOT & IMAGEN */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Mensaje de Respuesta en WhatsApp (Formato con asteriscos *negrita* y emojis):
                  </label>
                </div>

                {/* Variable Pills */}
                <div style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.45rem 0.65rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800 }}>Insertar variable:</span>
                  {['{cliente}', '{horarios}', '{direccion}', '{alias_banco}', '{banco}', '{titular}', '{catalogo_lista}'].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setEditingFlow(prev => ({
                        ...prev,
                        action: {
                          ...prev.action,
                          response: (prev.action.response || '') + ' ' + v
                        }
                      }))}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        padding: '1px 6px',
                        fontSize: '0.68rem',
                        color: 'var(--accent-blue)',
                        cursor: 'pointer'
                      }}
                      title="Hacer clic para insertar en el texto"
                    >
                      {v}
                    </button>
                  ))}
                </div>

                {/* Textarea */}
                <textarea
                  required
                  rows={5}
                  value={editingFlow.action.response}
                  onChange={(e) => setEditingFlow({
                    ...editingFlow,
                    action: { ...editingFlow.action, response: e.target.value }
                  })}
                  className="search-input"
                  style={{
                    width: '100%',
                    fontFamily: 'monospace',
                    fontSize: '0.84rem',
                    lineHeight: '1.45',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    resize: 'vertical'
                  }}
                  placeholder="Redactá la respuesta del bot..."
                />

                {/* Imagen adjunta opcional */}
                <div style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <ImageIcon size={13} />
                    <span>Foto o Flyer Adjunto (Opcional - El bot la enviará por WhatsApp con el texto):</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <Upload size={13} />
                      <span>Subir Imagen</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                    </label>

                    <div style={{ position: 'relative', flex: 1 }}>
                      <Link size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        value={editingFlow.action.imageUrl}
                        onChange={(e) => setEditingFlow({
                          ...editingFlow,
                          action: { ...editingFlow.action, imageUrl: e.target.value }
                        })}
                        placeholder="O pegá un link directo a una imagen (https://...)"
                        className="search-input"
                        style={{ width: '100%', height: '32px', paddingLeft: '28px', fontSize: '0.76rem' }}
                      />
                    </div>

                    {editingFlow.action.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setEditingFlow({
                          ...editingFlow,
                          action: { ...editingFlow.action, imageUrl: '' }
                        })}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer' }}
                        title="Quitar imagen"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  {editingFlow.action.imageUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <img
                        src={editingFlow.action.imageUrl}
                        alt="Vista previa"
                        style={{ width: '60px', height: '60px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border-subtle)' }}
                      />
                      <span style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>
                        ✓ Imagen vinculada correctamente
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* SECCIÓN 4: VISTA PREVIA EN VIVO */}
              <div style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem'
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Vista previa en WhatsApp del cliente:
                </div>
                <div style={{
                  background: 'linear-gradient(135deg, #005c4b, #025143)',
                  color: '#fff',
                  padding: '0.75rem 0.85rem',
                  borderRadius: '10px 10px 10px 2px',
                  fontSize: '0.8rem',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)'
                }}>
                  {editingFlow.action.imageUrl && (
                    <div style={{ width: '100%', height: '110px', borderRadius: '6px', overflow: 'hidden', marginBottom: '8px', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                      <img src={editingFlow.action.imageUrl} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  {chatbotService.interpolateTemplate(editingFlow.action.response || '', chatbotService.getResolvedVariables({ name: 'Sofía' }))}
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.5rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid var(--border-subtle)'
              }}>
                <button
                  type="button"
                  className="qty-btn"
                  style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.82rem' }}
                  onClick={() => setEditingFlow(null)}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="btn-confirm-order"
                  style={{ width: 'auto', padding: '0.5rem 1.25rem', fontSize: '0.84rem', gap: '6px' }}
                >
                  <Check size={16} />
                  <span>Guardar Flujo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
