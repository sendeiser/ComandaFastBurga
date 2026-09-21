import React, { useState, useEffect } from 'react';
import { 
  Bot, FlaskConical, Settings, ShieldCheck, QrCode, 
  Smartphone, CheckCircle2, Save, RotateCcw, Plus, 
  Trash2, Copy, Check, Info, Zap, AlertCircle, RefreshCw
} from 'lucide-react';
import AdminChatbotLab from './AdminChatbotLab';
import { ALL_TEMPLATE_NODES, DEFAULT_TEMPLATES, DEFAULT_CHATBOT_KEYWORDS } from '../../../services/whatsappBotConstants';
import { chatbotService } from '../../../services/chatbotService';

export default function AdminWhatsAppBot() {
  const [activeTab, setActiveTab] = useState('test_lab'); // 'test_lab' | 'templates' | 'security' | 'connection'
  const [settings, setSettings] = useState(chatbotService.getSettings());
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Template editor
  const [templateFilterCategory, setTemplateFilterCategory] = useState('all'); // 'all' | 'menu' | 'buy_flow' | 'notifications'
  const [selectedNodeId, setSelectedNodeId] = useState('template_menu');
  const [currentNodeText, setCurrentNodeText] = useState(settings.template_menu || DEFAULT_TEMPLATES.template_menu);

  // Security editor
  const [newKeyword, setNewKeyword] = useState('');
  const [newIgnoredPhone, setNewIgnoredPhone] = useState('');
  const [newIgnoredLabel, setNewIgnoredLabel] = useState('');

  // Connection tab state
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected' | 'qr_ready' | 'connected'
  const [qrCodeData, setQrCodeData] = useState(null);

  useEffect(() => {
    setCurrentNodeText(settings[selectedNodeId] || DEFAULT_TEMPLATES[selectedNodeId] || '');
  }, [selectedNodeId, settings]);

  const handleSaveSettings = () => {
    const updated = {
      ...settings,
      [selectedNodeId]: currentNodeText
    };
    setSettings(updated);
    chatbotService.saveSettings(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetTemplate = () => {
    const defaultVal = DEFAULT_TEMPLATES[selectedNodeId] || '';
    setCurrentNodeText(defaultVal);
    const updated = { ...settings, [selectedNodeId]: defaultVal };
    setSettings(updated);
    chatbotService.saveSettings(updated);
  };

  const handleAddKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (!kw) return;
    if (!settings.chatbot_keywords.includes(kw)) {
      const updated = { ...settings, chatbot_keywords: [...settings.chatbot_keywords, kw] };
      setSettings(updated);
      chatbotService.saveSettings(updated);
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kwToRemove) => {
    const updated = {
      ...settings,
      chatbot_keywords: settings.chatbot_keywords.filter(k => k !== kwToRemove)
    };
    setSettings(updated);
    chatbotService.saveSettings(updated);
  };

  const handleAddIgnoredNumber = () => {
    if (!newIgnoredPhone.trim()) return;
    const item = {
      id: 'ign-' + Date.now(),
      phone: newIgnoredPhone.trim(),
      label: newIgnoredLabel.trim() || 'Contacto Personal'
    };
    const updated = {
      ...settings,
      ignored_numbers: [...(settings.ignored_numbers || []), item]
    };
    setSettings(updated);
    chatbotService.saveSettings(updated);
    setNewIgnoredPhone('');
    setNewIgnoredLabel('');
  };

  const handleRemoveIgnoredNumber = (id) => {
    const updated = {
      ...settings,
      ignored_numbers: (settings.ignored_numbers || []).filter(i => i.id !== id)
    };
    setSettings(updated);
    chatbotService.saveSettings(updated);
  };

  const handleSimulateQr = () => {
    setConnectionStatus('qr_ready');
    setQrCodeData('https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=COMANDAFAST-WHATSAPP-BOT-CONNECT-' + Date.now());
  };

  const handleSimulateConnect = () => {
    setConnectionStatus('connected');
    setQrCodeData(null);
  };

  const handleSimulateDisconnect = () => {
    setConnectionStatus('disconnected');
    setQrCodeData(null);
  };

  const filteredNodes = ALL_TEMPLATE_NODES.filter(n => {
    if (templateFilterCategory === 'all') return true;
    return n.category === templateFilterCategory;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', height: '100%' }}>
      {/* BOT MANAGER SUBHEADER TABS */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.5rem 0.85rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`cat-pill-btn ${activeTab === 'test_lab' ? 'active' : ''}`}
            style={{ height: '34px', padding: '0.4rem 0.85rem', gap: '6px' }}
            onClick={() => setActiveTab('test_lab')}
          >
            <FlaskConical size={15} />
            <span>🧪 Laboratorio de Pruebas (Lab)</span>
          </button>

          <button
            type="button"
            className={`cat-pill-btn ${activeTab === 'templates' ? 'active' : ''}`}
            style={{ height: '34px', padding: '0.4rem 0.85rem', gap: '6px' }}
            onClick={() => setActiveTab('templates')}
          >
            <Bot size={15} />
            <span>📝 Plantillas & Flujos (Bot Studio)</span>
          </button>

          <button
            type="button"
            className={`cat-pill-btn ${activeTab === 'security' ? 'active' : ''}`}
            style={{ height: '34px', padding: '0.4rem 0.85rem', gap: '6px' }}
            onClick={() => setActiveTab('security')}
          >
            <ShieldCheck size={15} />
            <span>🛡️ Seguridad & Filtro Anti-Spam</span>
          </button>

          <button
            type="button"
            className={`cat-pill-btn ${activeTab === 'connection' ? 'active' : ''}`}
            style={{ height: '34px', padding: '0.4rem 0.85rem', gap: '6px' }}
            onClick={() => setActiveTab('connection')}
          >
            <Smartphone size={15} />
            <span>📱 Conexión WhatsApp Web</span>
          </button>
        </div>

        {/* Global Save Indicator */}
        {saveSuccess && (
          <span style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={16} /> Ajustes guardados
          </span>
        )}
      </div>

      {/* TAB CONTENT: CHATBOT LAB */}
      {activeTab === 'test_lab' && (
        <div style={{ flex: 1 }}>
          <AdminChatbotLab />
        </div>
      )}

      {/* TAB CONTENT: TEMPLATES STUDIO */}
      {activeTab === 'templates' && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem',
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: '1rem',
          flex: 1,
          minHeight: '520px'
        }}>
          {/* LEFT: NODES LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {/* Category Filter */}
            <div style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto', paddingBottom: '4px' }}>
              {[
                { id: 'all', label: 'Todas' },
                { id: 'menu', label: 'Menú' },
                { id: 'buy_flow', label: 'Comanda' },
                { id: 'notifications', label: 'Cocina KDS' }
              ].map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`cat-pill-btn ${templateFilterCategory === c.id ? 'active' : ''}`}
                  style={{ fontSize: '0.7rem', height: '26px', padding: '0 8px' }}
                  onClick={() => setTemplateFilterCategory(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', overflowY: 'auto', flex: 1 }}>
              {filteredNodes.map(node => {
                const isSelected = selectedNodeId === node.id;
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    style={{
                      background: isSelected ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-main)',
                      border: isSelected ? '1.5px solid var(--accent-amber)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.6rem 0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: isSelected ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
                      {node.label}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {node.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: TEMPLATE TEXTAREA & PREVIEW */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                  {ALL_TEMPLATE_NODES.find(n => n.id === selectedNodeId)?.label}
                </h4>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Clave: <code>{selectedNodeId}</code>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  className="qty-btn"
                  style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.75rem', gap: '4px' }}
                  onClick={handleResetTemplate}
                  title="Restablecer plantilla a su valor de fábrica"
                >
                  <RotateCcw size={13} />
                  <span>Restablecer</span>
                </button>
                <button
                  type="button"
                  className="btn-confirm-order"
                  style={{ width: 'auto', padding: '0.4rem 1rem', fontSize: '0.78rem', gap: '6px' }}
                  onClick={handleSaveSettings}
                >
                  <Save size={14} />
                  <span>Guardar Plantilla</span>
                </button>
              </div>
            </div>

            {/* Variable Tags Pills */}
            <div style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.5rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800 }}>Variables disponibles:</span>
              {['{cliente}', '{pedido_id}', '{total}', '{direccion}', '{alias_banco}', '{banco}', '{titular}', '{cbu}', '{horarios}', '{catalogo_lista}', '{carrito_items}', '{subtotal}'].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCurrentNodeText(prev => prev + ' ' + v)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '4px',
                    padding: '1px 6px',
                    fontSize: '0.68rem',
                    color: 'var(--accent-blue)',
                    cursor: 'pointer'
                  }}
                  title="Insertar variable"
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Textarea Editor */}
            <textarea
              className="search-input"
              value={currentNodeText}
              onChange={(e) => setCurrentNodeText(e.target.value)}
              style={{
                flex: 1,
                minHeight: '220px',
                fontFamily: 'monospace',
                fontSize: '0.84rem',
                lineHeight: '1.45',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                resize: 'vertical'
              }}
            />

            {/* LIVE PREVIEW BOX */}
            <div style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem'
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>
                Vista previa en WhatsApp del cliente:
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #005c4b, #025143)',
                color: '#fff',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.4'
              }}>
                {chatbotService.interpolateTemplate(currentNodeText, chatbotService.getResolvedVariables({ name: 'Sofía' }, settings))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: SECURITY & ANTI-SPAM */}
      {activeTab === 'security' && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
              Filtro Anti-Spam & Detección Inteligente de Palabras Clave
            </h4>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Evita que el bot responda mensajes personales o interrupciones en conversaciones con amigos o familiares en el mismo WhatsApp.
            </div>
          </div>

          {/* TOGGLE: REQUIRE KEYWORDS */}
          <div style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Activar Filtro Anti-Spam de ComandaFast
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                El bot solo responderá si el mensaje contiene alguna de las palabras clave gastronómicas de la lista.
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.require_keywords_for_chatbot}
              onChange={(e) => {
                const updated = { ...settings, require_keywords_for_chatbot: e.target.checked };
                setSettings(updated);
                chatbotService.saveSettings(updated);
              }}
              style={{ width: '20px', height: '20px', accentColor: 'var(--accent-amber)', cursor: 'pointer' }}
            />
          </div>

          {/* KEYWORDS TAG LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
              Palabras Clave Autorizadas ({settings.chatbot_keywords?.length || 0})
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="search-input"
                placeholder="Nueva palabra clave (ej: burger, delivery)..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                style={{ width: '260px', height: '32px', fontSize: '0.8rem' }}
              />
              <button
                type="button"
                className="cat-pill-btn active"
                style={{ height: '32px', padding: '0 0.85rem', fontSize: '0.78rem' }}
                onClick={handleAddKeyword}
              >
                <Plus size={14} />
                <span>Agregar</span>
              </button>
            </div>

            <div style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.4rem',
              maxHeight: '160px',
              overflowY: 'auto'
            }}>
              {(settings.chatbot_keywords || []).map(kw => (
                <span
                  key={kw}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-full)',
                    padding: '2px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {kw}
                  <Trash2
                    size={12}
                    style={{ color: 'var(--accent-rose)', cursor: 'pointer' }}
                    onClick={() => handleRemoveKeyword(kw)}
                  />
                </span>
              ))}
            </div>
          </div>

          {/* IGNORED NUMBERS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
              Números Ignorados (Lista Negra Personal)
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="search-input"
                placeholder="Número de teléfono (ej: 3826507711)..."
                value={newIgnoredPhone}
                onChange={(e) => setNewIgnoredPhone(e.target.value)}
                style={{ width: '220px', height: '32px', fontSize: '0.8rem' }}
              />
              <input
                type="text"
                className="search-input"
                placeholder="Etiqueta (ej: Juan Hermano)..."
                value={newIgnoredLabel}
                onChange={(e) => setNewIgnoredLabel(e.target.value)}
                style={{ width: '200px', height: '32px', fontSize: '0.8rem' }}
              />
              <button
                type="button"
                className="cat-pill-btn active"
                style={{ height: '32px', padding: '0 0.85rem', fontSize: '0.78rem' }}
                onClick={handleAddIgnoredNumber}
              >
                <Plus size={14} />
                <span>Bloquear Número</span>
              </button>
            </div>

            {settings.ignored_numbers?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {settings.ignored_numbers.map(n => (
                  <div
                    key={n.id}
                    style={{
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.45rem 0.75rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.8rem'
                    }}
                  >
                    <div>
                      <strong>{n.phone}</strong> — <span style={{ color: 'var(--text-muted)' }}>{n.label}</span>
                    </div>
                    <button
                      type="button"
                      className="qty-btn"
                      style={{ width: 'auto', padding: '2px 8px', fontSize: '0.72rem', color: 'var(--accent-rose)' }}
                      onClick={() => handleRemoveIgnoredNumber(n.id)}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: WHATSAPP CONNECTION */}
      {activeTab === 'connection' && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: '1.5rem',
          alignItems: 'center'
        }}>
          {/* QR CODE BOX */}
          <div style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            textAlign: 'center'
          }}>
            <div style={{
              width: '200px',
              height: '200px',
              background: '#fff',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              overflow: 'hidden'
            }}>
              {connectionStatus === 'connected' ? (
                <div style={{ color: '#25D366', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={56} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                    ¡WhatsApp Conectado!
                  </span>
                </div>
              ) : qrCodeData ? (
                <img src={qrCodeData} alt="Código QR WhatsApp" style={{ width: '100%', height: '100%' }} />
              ) : (
                <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <QrCode size={56} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Código QR Desconectado</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {connectionStatus !== 'connected' ? (
                <>
                  <button
                    type="button"
                    className="cat-pill-btn active"
                    style={{ height: '34px', padding: '0 1rem', fontSize: '0.8rem', gap: '6px' }}
                    onClick={handleSimulateQr}
                  >
                    <QrCode size={14} />
                    <span>Generar QR</span>
                  </button>
                  <button
                    type="button"
                    className="btn-confirm-order"
                    style={{ width: 'auto', height: '34px', padding: '0 1rem', fontSize: '0.8rem', background: '#25D366', gap: '6px' }}
                    onClick={handleSimulateConnect}
                  >
                    <CheckCircle2 size={14} />
                    <span>Simular Vinculado</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="qty-btn"
                  style={{ width: 'auto', height: '34px', padding: '0 1rem', fontSize: '0.8rem', color: 'var(--accent-rose)', gap: '6px' }}
                  onClick={handleSimulateDisconnect}
                >
                  <Trash2 size={14} />
                  <span>Desvincular WhatsApp</span>
                </button>
              )}
            </div>
          </div>

          {/* INSTRUCTIONS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                Vincular WhatsApp de ComandaFast con el Teléfono del Local
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
                Conecta tu número oficial mediante la tecnología Multi-Dispositivo de WhatsApp. El bot responderá de manera desatendida mientras tu teléfono sigue funcionando normalmente.
              </p>
            </div>

            <div style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-amber)' }}>
                Pasos para conectar:
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                1. Abre <strong>WhatsApp</strong> en el teléfono de la hamburguesería.<br />
                2. Toca el menú de tres puntos (Android) o Ajustes (iPhone) y selecciona <strong>Dispositivos vinculados</strong>.<br />
                3. Toca <strong>Vincular un dispositivo</strong> y apunta la cámara al código QR de la izquierda.<br />
                4. ¡Listo! Las comandas recibidas ingresarán automáticamente a la cocina de ComandaFast.
              </div>
            </div>

            <div style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid var(--accent-blue)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.4'
            }}>
              💡 <strong>Servidor Standalone Baileys:</strong> También incluimos el script <code>server/whatsappBotServer.js</code> y el lanzador <code>INICIAR_BOT_WHATSAPP.bat</code> para ejecutar el servicio en segundo plano con conexión 24/7 sin costos de APIs externas.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
