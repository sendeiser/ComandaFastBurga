import React, { useState, useEffect, useMemo } from 'react';
import { 
  Variable, Plus, Save, RotateCcw, Download, Search, Check, Copy, 
  Trash2, Sparkles, Building, Store, MapPin, Clock, Phone, Globe, 
  Compass, CreditCard, UserCheck, Hash, FileText, Percent, Hourglass, 
  Timer, Bike, Gift, MessageSquare, AlertTriangle, Moon, CheckCircle2, 
  X, AlertCircle, HelpCircle, Eye
} from 'lucide-react';
import { chatbotService } from '../../../services/chatbotService';
import { BOT_VARIABLE_CATEGORIES, DEFAULT_BOT_VARIABLES } from '../../../services/whatsappBotConstants';

// Map icon string to Lucide component
function renderVariableIcon(iconName, category) {
  const iconProps = { size: 16, style: { flexShrink: 0 } };
  switch (iconName) {
    case 'Store': return <Store {...iconProps} />;
    case 'MapPin': return <MapPin {...iconProps} />;
    case 'Clock': return <Clock {...iconProps} />;
    case 'Phone': return <Phone {...iconProps} />;
    case 'Globe': return <Globe {...iconProps} />;
    case 'Compass': return <Compass {...iconProps} />;
    case 'CreditCard': return <CreditCard {...iconProps} />;
    case 'Building': return <Building {...iconProps} />;
    case 'UserCheck': return <UserCheck {...iconProps} />;
    case 'Hash': return <Hash {...iconProps} />;
    case 'FileText': return <FileText {...iconProps} />;
    case 'Percent': return <Percent {...iconProps} />;
    case 'Hourglass': return <Hourglass {...iconProps} />;
    case 'Timer': return <Timer {...iconProps} />;
    case 'Bike': return <Bike {...iconProps} />;
    case 'Gift': return <Gift {...iconProps} />;
    case 'MessageSquare': return <MessageSquare {...iconProps} />;
    case 'AlertTriangle': return <AlertTriangle {...iconProps} />;
    case 'Moon': return <Moon {...iconProps} />;
    default:
      if (category === 'business') return <Store {...iconProps} />;
      if (category === 'payments') return <CreditCard {...iconProps} />;
      if (category === 'delivery') return <Bike {...iconProps} />;
      if (category === 'messages') return <MessageSquare {...iconProps} />;
      return <Variable {...iconProps} />;
  }
}

export default function AdminBotVariablesTab() {
  const [variables, setVariables] = useState(() => chatbotService.getBotVariables());
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Modal for new custom variable
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarLabel, setNewVarLabel] = useState('');
  const [newVarCategory, setNewVarCategory] = useState('custom');
  const [newVarValue, setNewVarValue] = useState('');
  const [newVarDescription, setNewVarDescription] = useState('');

  // Sync from Supabase Cloud on mount
  useEffect(() => {
    chatbotService.fetchCloudBotVariables().then(cloudVars => {
      if (Array.isArray(cloudVars) && cloudVars.length > 0) {
        setVariables(cloudVars);
      }
    });
  }, []);

  // Listen for external variable updates
  useEffect(() => {
    const handleUpdate = (e) => {
      if (Array.isArray(e.detail)) {
        setVariables(e.detail);
      }
    };
    window.addEventListener('comandafast:bot_variables_updated', handleUpdate);
    return () => window.removeEventListener('comandafast:bot_variables_updated', handleUpdate);
  }, []);

  // Handle value change for an item
  const handleValueChange = (key, newValue) => {
    setVariables(prev => prev.map(v => v.key === key ? { ...v, value: newValue } : v));
    setHasUnsavedChanges(true);
  };

  // Reset a single variable to default
  const handleResetSingle = (key) => {
    const def = DEFAULT_BOT_VARIABLES.find(d => d.key === key);
    if (def) {
      handleValueChange(key, def.defaultValue);
    }
  };

  // Delete custom variable
  const handleDeleteVariable = (key) => {
    if (window.confirm(`¿Estás seguro de eliminar la variable {${key}}?`)) {
      setVariables(prev => prev.filter(v => v.key !== key));
      setHasUnsavedChanges(true);
    }
  };

  // Save all variables
  const handleSaveAll = () => {
    chatbotService.saveBotVariables(variables);
    setHasUnsavedChanges(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Reset all to defaults
  const handleResetAll = () => {
    if (window.confirm('¿Restablecer TODAS las variables del bot a sus valores predeterminados de fábrica?')) {
      const reset = chatbotService.resetBotVariables();
      setVariables(reset);
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  // Copy {key} to clipboard
  const handleCopyKey = (key) => {
    const textToCopy = `{${key}}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Create new custom variable
  const handleCreateVariable = (e) => {
    e.preventDefault();
    const cleanKey = newVarKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!cleanKey) {
      alert('Por favor ingresá una clave válida para la variable (ej: promo_jueves)');
      return;
    }

    if (variables.some(v => v.key === cleanKey)) {
      alert(`Ya existe una variable con la clave {${cleanKey}}`);
      return;
    }

    const newVar = {
      key: cleanKey,
      label: newVarLabel.trim() || cleanKey,
      category: newVarCategory,
      defaultValue: newVarValue,
      value: newVarValue,
      description: newVarDescription.trim() || 'Variable personalizada creada por el dueño',
      icon: 'Sparkles',
      isCustom: true
    };

    const updated = [...variables, newVar];
    setVariables(updated);
    chatbotService.saveBotVariables(updated);

    // Reset modal
    setNewVarKey('');
    setNewVarLabel('');
    setNewVarCategory('custom');
    setNewVarValue('');
    setNewVarDescription('');
    setIsModalOpen(false);

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(variables, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `comandafast_bot_variables_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  // Filtered variables
  const filteredVariables = useMemo(() => {
    return variables.filter(v => {
      const matchCat = activeCategory === 'all' 
        ? true 
        : activeCategory === 'custom' 
          ? (v.isCustom || v.category === 'custom')
          : v.category === activeCategory;
      
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = !term || (
        v.key.toLowerCase().includes(term) ||
        (v.label && v.label.toLowerCase().includes(term)) ||
        (v.description && v.description.toLowerCase().includes(term)) ||
        (String(v.value || '').toLowerCase().includes(term))
      );

      return matchCat && matchSearch;
    });
  }, [variables, activeCategory, searchTerm]);

  // Counts by category
  const categoryCounts = useMemo(() => {
    const counts = { all: variables.length, custom: 0 };
    BOT_VARIABLE_CATEGORIES.forEach(c => { if (c.id !== 'all' && c.id !== 'custom') counts[c.id] = 0; });
    
    variables.forEach(v => {
      if (v.isCustom || v.category === 'custom') {
        counts.custom = (counts.custom || 0) + 1;
      }
      if (counts[v.category] !== undefined && v.category !== 'custom') {
        counts[v.category] = (counts[v.category] || 0) + 1;
      }
    });
    return counts;
  }, [variables]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* HEADER BAR */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-amber)'
            }}>
              <Variable size={18} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
              Variables Globales del Bot
            </h3>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'rgba(34, 197, 94, 0.15)',
              color: 'var(--accent-green, #22c55e)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <CheckCircle2 size={12} /> {variables.length} Activas
            </span>
            {hasUnsavedChanges && (
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <AlertCircle size={12} /> Cambios sin guardar
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Modificá aquí los valores de negocio (horarios, alias, demoras, mensajes). El bot y la IA los usarán automáticamente en todas las respuestas y flujos.
          </p>
        </div>

        {/* TOP ACTION BUTTONS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="qty-btn"
            style={{ width: 'auto', padding: '0.45rem 0.85rem', fontSize: '0.78rem', gap: '6px' }}
            onClick={handleResetAll}
            title="Restablecer todas las variables a valores de fábrica"
          >
            <RotateCcw size={14} />
            <span>Restablecer</span>
          </button>

          <button
            type="button"
            className="qty-btn"
            style={{ width: 'auto', padding: '0.45rem 0.85rem', fontSize: '0.78rem', gap: '6px' }}
            onClick={handleExportJson}
            title="Exportar archivo JSON con todas las variables"
          >
            <Download size={14} />
            <span>Exportar</span>
          </button>

          <button
            type="button"
            className="btn-confirm-order"
            style={{
              width: 'auto',
              padding: '0.45rem 1rem',
              fontSize: '0.8rem',
              gap: '6px',
              background: 'var(--bg-card)',
              border: '1.5px solid var(--accent-amber)',
              color: 'var(--accent-amber)'
            }}
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={15} />
            <span>Nueva Variable</span>
          </button>

          <button
            type="button"
            className="btn-confirm-order"
            style={{
              width: 'auto',
              padding: '0.45rem 1.15rem',
              fontSize: '0.82rem',
              gap: '6px',
              background: saveSuccess ? 'var(--accent-green, #22c55e)' : 'var(--accent-amber)',
              color: '#000',
              fontWeight: 800
            }}
            onClick={handleSaveAll}
          >
            {saveSuccess ? <Check size={16} /> : <Save size={16} />}
            <span>{saveSuccess ? '¡Guardado con éxito!' : 'Guardar Todo'}</span>
          </button>
        </div>
      </div>

      {/* FILTER TABS & SEARCH BAR */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.75rem 1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        {/* Category Pills */}
        <div className="scrollable-tabs-bar" style={{ alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: '260px' }}>
          {BOT_VARIABLE_CATEGORIES.map(cat => {
            const count = categoryCounts[cat.id] || 0;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`cat-pill-btn ${isActive ? 'active' : ''}`}
                style={{ height: '34px', padding: '0 0.85rem', fontSize: '0.8rem', gap: '6px', flexShrink: 0, whiteSpace: 'nowrap' }}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
                <span style={{
                  fontSize: '0.68rem',
                  padding: '1px 6px',
                  borderRadius: '8px',
                  background: isActive ? 'rgba(0,0,0,0.25)' : 'var(--bg-subtle, rgba(255,255,255,0.08))',
                  fontWeight: 800
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '240px', flex: '0 1 300px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-base"
            placeholder="Buscar por {clave}, nombre o valor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              paddingLeft: '32px',
              height: '34px',
              fontSize: '0.8rem',
              borderRadius: 'var(--radius-md)',
              width: '100%'
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* HOW TO USE TIP */}
      <div style={{
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px dashed var(--accent-amber)',
        borderRadius: 'var(--radius-md)',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
        fontSize: '0.78rem',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="var(--accent-amber)" />
          <span>
            <strong>Tip Pro:</strong> Podés hacer click sobre cualquier tag tipo <code style={{ color: 'var(--accent-amber)', fontWeight: 800 }}>{`{alias_banco}`}</code> para copiarlo al portapapeles y pegarlo en cualquier plantilla, mensaje o flujo del bot.
          </span>
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Mostrando {filteredVariables.length} de {variables.length} variables
        </span>
      </div>

      {/* VARIABLES GRID */}
      {filteredVariables.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '3rem 1rem',
          textAlign: 'center',
          color: 'var(--text-muted)'
        }}>
          <Variable size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            No se encontraron variables
          </h4>
          <p style={{ fontSize: '0.82rem', margin: '4px 0 1rem 0' }}>
            Probá con otro término de búsqueda o seleccioná otra categoría.
          </p>
          <button
            type="button"
            className="qty-btn"
            style={{ width: 'auto', padding: '0.4rem 1rem', fontSize: '0.8rem', margin: '0 auto' }}
            onClick={() => { setSearchTerm(''); setActiveCategory('all'); }}
          >
            Limpiar Filtros
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: '1rem'
        }}>
          {filteredVariables.map(variable => {
            const isCopied = copiedKey === variable.key;
            const isMultiline = String(variable.value || '').length > 60 || variable.category === 'messages';
            const isCustom = variable.isCustom || variable.category === 'custom';

            return (
              <div
                key={variable.key}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                }}
              >
                {/* CARD TOP HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{
                      color: 'var(--accent-amber)',
                      background: 'rgba(245, 158, 11, 0.1)',
                      padding: '6px',
                      borderRadius: '6px'
                    }}>
                      {renderVariableIcon(variable.icon, variable.category)}
                    </div>

                    {/* VARIABLE KEY TAG (CLICK TO COPY) */}
                    <button
                      type="button"
                      onClick={() => handleCopyKey(variable.key)}
                      title="Click para copiar la variable al portapapeles"
                      style={{
                        background: isCopied ? 'rgba(34, 197, 94, 0.2)' : 'var(--bg-main)',
                        border: isCopied ? '1px solid var(--accent-green, #22c55e)' : '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        color: isCopied ? 'var(--accent-green, #22c55e)' : 'var(--accent-amber)',
                        fontFamily: 'monospace',
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {isCopied ? <Check size={12} /> : <Copy size={12} />}
                      <span>{`{${variable.key}}`}</span>
                      {isCopied && <span style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>¡Copiado!</span>}
                    </button>
                  </div>

                  {/* CATEGORY BADGE & ACTIONS */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'var(--bg-main)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      {BOT_VARIABLE_CATEGORIES.find(c => c.id === variable.category)?.label || variable.category}
                    </span>

                    {/* DELETE CUSTOM VARIABLE */}
                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteVariable(variable.key)}
                        title="Eliminar variable personalizada"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          padding: '4px',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* LABEL & DESCRIPTION */}
                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {variable.label || variable.key}
                  </h4>
                  {variable.description && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                      {variable.description}
                    </p>
                  )}
                </div>

                {/* EDITABLE INPUT / TEXTAREA */}
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Valor de la Variable:
                  </label>
                  {isMultiline ? (
                    <textarea
                      className="input-base"
                      rows={3}
                      value={variable.value ?? variable.defaultValue ?? ''}
                      onChange={(e) => handleValueChange(variable.key, e.target.value)}
                      placeholder={`Ej: ${variable.defaultValue || ''}`}
                      style={{
                        width: '100%',
                        fontSize: '0.82rem',
                        lineHeight: '1.4',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      className="input-base"
                      value={variable.value ?? variable.defaultValue ?? ''}
                      onChange={(e) => handleValueChange(variable.key, e.target.value)}
                      placeholder={`Ej: ${variable.defaultValue || ''}`}
                      style={{
                        width: '100%',
                        height: '38px',
                        fontSize: '0.82rem'
                      }}
                    />
                  )}
                </div>

                {/* FOOTER: DEFAULT RESTORE BUTTON */}
                {variable.defaultValue && variable.value !== variable.defaultValue && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '6px',
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)'
                  }}>
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                      Fábrica: <span style={{ fontStyle: 'italic' }}>{variable.defaultValue}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleResetSingle(variable.key)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-amber)',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontWeight: 700
                      }}
                    >
                      Restablecer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: CREATE CUSTOM VARIABLE */}
      {isModalOpen && (
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
          <div style={{
            background: 'var(--bg-card)',
            border: '1.5px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '520px',
            padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-amber)'
                }}>
                  <Plus size={18} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                  Nueva Variable Personalizada
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateVariable} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Clave de la Variable (se usará como {'{clave}'}): *
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--accent-amber)', fontWeight: 800 }}>{'{'}</span>
                  <input
                    type="text"
                    required
                    className="input-base"
                    placeholder="ej: promo_dia o clave_wifi"
                    value={newVarKey}
                    onChange={(e) => setNewVarKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    style={{ flex: 1, height: '38px', fontSize: '0.82rem', fontFamily: 'monospace' }}
                  />
                  <span style={{ fontSize: '0.9rem', color: 'var(--accent-amber)', fontWeight: 800 }}>{'}'}</span>
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Solo minúsculas, números y guiones bajos (sin espacios).
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Nombre Amigable / Título: *
                </label>
                <input
                  type="text"
                  required
                  className="input-base"
                  placeholder="ej: Promoción del Día o Clave de Wi-Fi"
                  value={newVarLabel}
                  onChange={(e) => setNewVarLabel(e.target.value)}
                  style={{ width: '100%', height: '38px', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Categoría:
                  </label>
                  <select
                    className="input-base"
                    value={newVarCategory}
                    onChange={(e) => setNewVarCategory(e.target.value)}
                    style={{ width: '100%', height: '38px', fontSize: '0.82rem' }}
                  >
                    <option value="business">🏢 Negocio & Local</option>
                    <option value="payments">💳 Pagos & Bancos</option>
                    <option value="delivery">🛵 Delivery & Tiempos</option>
                    <option value="messages">💬 Mensajes & Avisos</option>
                    <option value="custom">✨ Personalizada General</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Descripción Corta:
                  </label>
                  <input
                    type="text"
                    className="input-base"
                    placeholder="Para qué sirve..."
                    value={newVarDescription}
                    onChange={(e) => setNewVarDescription(e.target.value)}
                    style={{ width: '100%', height: '38px', fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Valor Inicial de la Variable: *
                </label>
                <textarea
                  required
                  className="input-base"
                  rows={3}
                  placeholder="Escribí el texto, precio o mensaje que reemplazará a esta variable..."
                  value={newVarValue}
                  onChange={(e) => setNewVarValue(e.target.value)}
                  style={{ width: '100%', fontSize: '0.82rem', lineHeight: '1.4', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="qty-btn"
                  style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.8rem' }}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-confirm-order"
                  style={{ width: 'auto', padding: '0.45rem 1.25rem', fontSize: '0.82rem', gap: '6px' }}
                >
                  <Plus size={15} />
                  <span>Crear Variable</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
