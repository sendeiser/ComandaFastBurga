import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Bot, Play, RotateCcw, Send, CheckCheck, Sparkles, 
  ShoppingBag, ShieldAlert, Cpu, UserCheck, Eye, 
  Image as ImageIcon, PhoneCall, MoreVertical, Plus,
  CheckCircle2, ArrowRight, Zap, RefreshCw, Layers
} from 'lucide-react';
import { TEST_PERSONAS, DEFAULT_TEST_SUITES, DEFAULT_TEMPLATES } from '../../../services/whatsappBotConstants';
import { chatbotService } from '../../../services/chatbotService';
import { storageService } from '../../../services/storageService';

export default function AdminChatbotLab() {
  const [products, setProducts] = useState([]);
  const [selectedPersona, setSelectedPersona] = useState(TEST_PERSONAS[0]);
  const [sandboxMode, setSandboxMode] = useState(true);
  const [simulationSpeed, setSimulationSpeed] = useState('normal'); // 'fast' | 'normal' | 'human'
  const [activeTab, setActiveTab] = useState('inspector'); // 'inspector' | 'catalog'

  // Suites automáticas
  const [runningSuiteId, setRunningSuiteId] = useState(null);
  const [currentSuiteStep, setCurrentSuiteStep] = useState(0);

  // Chatbot State
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [inputText, setInputText] = useState('');
  const chatContainerRef = useRef(null);

  // Historial de mensajes
  const [chatHistory, setChatHistory] = useState([
    {
      id: 'init-1',
      sender: 'bot',
      text: DEFAULT_TEMPLATES.template_menu.replace('{cliente}', 'Sofía'),
      time: '19:30',
      status: 'read'
    }
  ]);

  // Sesión conversacional en vivo
  const [sessionState, setSessionState] = useState({
    step: 'IDLE',
    items: [],
    subtotal: 0,
    total: 0,
    shippingMethod: 'local',
    shippingAddress: '',
    shippingName: 'Sofía González',
    paymentMethod: 'efectivo',
    pendingProduct: null
  });

  // Notificación de inyección
  const [injectedAlert, setInjectedAlert] = useState(null);

  // Cargar productos de ComandaFast desde la Base de Datos
  const loadDatabaseCatalog = useCallback(async () => {
    try {
      const loaded = await chatbotService.getDatabaseProducts();
      setProducts(loaded);
    } catch (_) {
      setProducts(storageService.getProducts());
    }
  }, []);

  useEffect(() => {
    loadDatabaseCatalog();
  }, [loadDatabaseCatalog]);

    // Scroll automático (exclusivamente dentro del contenedor interno del chat, sin mover la pantalla)
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isBotTyping]);

  // Cambiar persona de prueba
  const handleSelectPersona = (persona) => {
    setSelectedPersona(persona);
    setRunningSuiteId(null);
    setCurrentSuiteStep(0);
    setSessionState({
      step: 'IDLE',
      items: [],
      subtotal: 0,
      total: 0,
      shippingMethod: 'local',
      shippingAddress: '',
      shippingName: persona.name,
      paymentMethod: 'efectivo',
      pendingProduct: null
    });
    setChatHistory([
      {
        id: 'init-' + Date.now(),
        sender: 'bot',
        text: chatbotService.interpolateTemplate(DEFAULT_TEMPLATES.template_menu, { cliente: persona.name }),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'read'
      }
    ]);
  };

  // Enviar mensaje del usuario y procesar respuesta del bot
  const handleSendMessage = useCallback(async (textToSend) => {
    const message = (textToSend || inputText).trim();
    if (!message) return;

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // 1. Agregar mensaje del usuario a la pantalla
    const userMsg = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: message,
      time: userTime,
      status: 'delivered'
    };

    setChatHistory(prev => [...prev, userMsg]);
    setInputText('');
    setIsBotTyping(true);

    // Calcular demora según velocidad de simulación
    const delayMs = simulationSpeed === 'fast' ? 300 : simulationSpeed === 'human' ? 1400 : 700;
    
    setTimeout(() => {
      // 2. Computar respuesta del bot
      const { reply, image, newState, systemNote, generatedOrder } = chatbotService.computeBotResponse(
        message,
        sessionState,
        selectedPersona,
        { availableProducts: products, sandboxMode }
      );

      setSessionState(newState);
      setIsBotTyping(false);

      if (generatedOrder) {
        setInjectedAlert(`¡Comanda ${generatedOrder.code} inyectada a Cocina KDS y POS con éxito!`);
        setTimeout(() => setInjectedAlert(null), 5000);
      }

      // 3. Agregar respuesta del bot
      const botMsg = {
        id: 'bot-' + Date.now(),
        sender: 'bot',
        text: reply,
        image: image || null,
        systemNote: !!systemNote,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'read'
      };

      setChatHistory(prev => [...prev, botMsg]);
    }, delayMs);
  }, [inputText, sessionState, selectedPersona, products, sandboxMode, simulationSpeed]);

  // Ejecución automática de suites paso a paso
  useEffect(() => {
    if (!runningSuiteId) return;

    const suite = DEFAULT_TEST_SUITES.find(s => s.id === runningSuiteId);
    if (!suite) return;

    if (currentSuiteStep >= suite.steps.length) {
      setRunningSuiteId(null);
      setCurrentSuiteStep(0);
      return;
    }

    const nextStepText = suite.steps[currentSuiteStep];
    const timer = setTimeout(() => {
      handleSendMessage(nextStepText);
      setCurrentSuiteStep(prev => prev + 1);
    }, simulationSpeed === 'fast' ? 800 : 1800);

    return () => clearTimeout(timer);
  }, [runningSuiteId, currentSuiteStep, simulationSpeed, handleSendMessage]);

  const handleStartSuite = (suiteId) => {
    handleSelectPersona(selectedPersona);
    setRunningSuiteId(suiteId);
    setCurrentSuiteStep(0);
  };

  // Inyectar orden manualmente desde el inspector
  const handleManualInject = () => {
    if (sessionState.items.length === 0) return;
    const order = chatbotService.injectOrderToPos({
      items: sessionState.items,
      customer: {
        name: sessionState.shippingName || selectedPersona.name,
        phone: selectedPersona.phone,
        address: sessionState.shippingAddress
      },
      paymentMethod: sessionState.paymentMethod,
      shippingMethod: sessionState.shippingMethod
    });

    if (order) {
      setInjectedAlert(`¡Comanda ${order.code} enviada de inmediato a Cocina KDS y POS!`);
      setTimeout(() => setInjectedAlert(null), 5000);
    }
  };

  const handleResetChat = () => {
    handleSelectPersona(selectedPersona);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', height: '100%', minHeight: '620px' }}>
      {/* HEADER: LAB BANNER & CONTROLS */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.85rem 1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.2), rgba(18, 140, 126, 0.35))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #25D366'
          }}>
            <Bot size={22} style={{ color: '#25D366' }} />
          </div>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Chatbot Lab — Laboratorio de Pruebas WhatsApp</span>
              <span style={{ fontSize: '0.68rem', background: sandboxMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: sandboxMode ? 'var(--accent-blue)' : 'var(--accent-rose)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 800 }}>
                {sandboxMode ? 'MODO SANDBOX SEGURO' : 'MODO PRODUCCIÓN (IMPACTA POS)'}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Simula conversaciones en tiempo real, ejecuta suites automáticas y valida la toma de comandas gastronómicas.
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Speed Selector */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main)', padding: '2px 6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', gap: '4px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Velocidad:</span>
            {[
              { id: 'fast', label: 'Rápida' },
              { id: 'normal', label: 'Normal' },
              { id: 'human', label: 'Humana' }
            ].map(s => (
              <button
                key={s.id}
                type="button"
                className={`cat-pill-btn ${simulationSpeed === s.id ? 'active' : ''}`}
                style={{ fontSize: '0.7rem', height: '24px', padding: '0 6px' }}
                onClick={() => setSimulationSpeed(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Sandbox Toggle */}
          <button
            type="button"
            className="qty-btn"
            style={{
              width: 'auto',
              padding: '0.35rem 0.75rem',
              fontSize: '0.78rem',
              gap: '6px',
              background: sandboxMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              borderColor: sandboxMode ? 'var(--accent-blue)' : 'var(--accent-rose)',
              color: sandboxMode ? 'var(--accent-blue)' : 'var(--accent-rose)'
            }}
            onClick={() => setSandboxMode(!sandboxMode)}
            title="Alternar entre modo simulación o registrar pedidos reales en el POS"
          >
            <Cpu size={14} />
            <span>{sandboxMode ? 'Sandbox: Activo' : 'POS Real: ACTIVO'}</span>
          </button>

          {/* Sync DB Button */}
          <button
            type="button"
            className="qty-btn"
            style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.78rem', gap: '4px' }}
            onClick={async () => {
              await loadDatabaseCatalog();
              setInjectedAlert('¡Catálogo y fotos sincronizados desde la Base de Datos!');
              setTimeout(() => setInjectedAlert(null), 3500);
            }}
            title="Sincronizar productos y fotos desde la Base de Datos"
          >
            <RefreshCw size={14} />
            <span>Sincronizar BD</span>
          </button>

          {/* Reset Button */}
          <button
            type="button"
            className="qty-btn"
            style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.78rem', gap: '4px' }}
            onClick={handleResetChat}
            title="Reiniciar chat actual"
          >
            <RotateCcw size={14} />
            <span>Reiniciar</span>
          </button>
        </div>
      </div>

      {/* ALERT NOTIFICATION */}
      {injectedAlert && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid var(--accent-emerald)',
          color: 'var(--accent-emerald)',
          borderRadius: 'var(--radius-md)',
          padding: '0.65rem 1rem',
          fontSize: '0.85rem',
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'slideIn 0.2s ease-out'
        }}>
          <CheckCircle2 size={18} />
          <span>{injectedAlert}</span>
        </div>
      )}

      {/* 3-COLUMN MAIN LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr 310px', gap: '0.85rem', flex: 1, minHeight: '560px' }}>
        
        {/* =========================================================
            LEFT COLUMN: PERSONAS & AUTOMATED TEST SUITES
        ========================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          
          {/* PERSONAS CARDS */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              👤 Personas de Prueba ({TEST_PERSONAS.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {TEST_PERSONAS.map(p => {
                const isSelected = selectedPersona.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPersona(p)}
                    style={{
                      background: isSelected ? 'rgba(37, 211, 102, 0.08)' : 'var(--bg-main)',
                      border: isSelected ? '1.5px solid #25D366' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.5rem 0.65rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: p.avatarBg,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '0.75rem',
                        flexShrink: 0
                      }}>
                        {p.name[0]}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: isSelected ? '#25D366' : 'var(--text-muted)' }}>
                          {p.role} • {p.phone}
                        </div>
                      </div>
                      {p.hasActiveOrder && (
                        <span style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.2)', color: 'var(--accent-amber)', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>
                          {p.activeOrderId}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AUTOMATED TEST SUITES */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            flex: 1,
            overflowY: 'auto'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⚡ Test Suites Automáticas
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {DEFAULT_TEST_SUITES.map(suite => {
                const isRunning = runningSuiteId === suite.id;
                return (
                  <div
                    key={suite.id}
                    style={{
                      background: isRunning ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-main)',
                      border: isRunning ? '1.5px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.55rem 0.65rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.3rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {suite.title}
                      </span>
                      <span style={{ fontSize: '0.65rem', background: suite.badgeColor, color: suite.textColor, padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                        {suite.badge}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: '1.2' }}>
                      {suite.description}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                        {isRunning ? `Paso ${currentSuiteStep}/${suite.steps.length}...` : `${suite.steps.length} pasos`}
                      </span>
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => handleStartSuite(suite.id)}
                        className="cat-pill-btn active"
                        style={{
                          height: '24px',
                          padding: '0 8px',
                          fontSize: '0.68rem',
                          gap: '4px',
                          background: isRunning ? 'var(--text-muted)' : 'var(--accent-blue)'
                        }}
                      >
                        <Play size={10} />
                        <span>{isRunning ? 'Ejecutando' : 'Probar'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* =========================================================
            CENTER COLUMN: WHATSAPP WEB CHAT SIMULATOR
        ========================================================= */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)'
        }}>
          
          {/* WHATSAPP WEB HEADER */}
          <div style={{
            background: 'var(--bg-sidebar)',
            borderBottom: '1px solid var(--border-subtle)',
            padding: '0.65rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: selectedPersona.avatarBg,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '0.9rem'
              }}>
                {selectedPersona.name[0]}
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {selectedPersona.name}
                </div>
                <div style={{ fontSize: '0.72rem', color: isBotTyping ? '#25D366' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {isBotTyping ? 'escribiendo...' : 'en línea'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                className="qty-btn"
                style={{ width: '32px', height: '32px', padding: 0 }}
                onClick={handleResetChat}
                title="Limpiar conversación"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* CHAT MESSAGES CONTAINER */}
          <div 
            ref={chatContainerRef}
            style={{
            flex: 1,
            padding: '1rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            background: 'rgba(0, 0, 0, 0.08)'
          }}>
            {chatHistory.map(msg => {
              const isUser = msg.sender === 'user';
              if (msg.systemNote) {
                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: 'center',
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: 'var(--accent-rose)',
                      padding: '0.45rem 0.85rem',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      maxWidth: '85%',
                      textAlign: 'center',
                      lineHeight: '1.3'
                    }}
                  >
                    {msg.text}
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '78%',
                    background: isUser 
                      ? 'linear-gradient(135deg, #005c4b, #025143)' 
                      : 'var(--bg-main)',
                    color: isUser ? '#e9edef' : 'var(--text-primary)',
                    border: isUser ? 'none' : '1px solid var(--border-subtle)',
                    borderRadius: isUser ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                    padding: '0.55rem 0.75rem',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                    fontSize: '0.82rem',
                    position: 'relative'
                  }}
                >
                  {/* Foto adjunta si la hay */}
                  {msg.image && (
                    <div style={{ marginBottom: '0.4rem', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <img 
                        src={msg.image} 
                        alt="Producto o Comprobante" 
                        style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', display: 'block' }} 
                      />
                    </div>
                  )}

                  {/* Texto con saltos de línea y negritas WhatsApp */}
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.35' }}>
                    {msg.text}
                  </div>

                  {/* Hora y checks */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '3px', marginTop: '2px', fontSize: '0.65rem', color: isUser ? '#8696a0' : 'var(--text-muted)' }}>
                    <span>{msg.time}</span>
                    {isUser && <CheckCheck size={12} style={{ color: '#53bdeb' }} />}
                  </div>
                </div>
              );
            })}

            {/* BOT TYPING INDICATOR */}
            {isBotTyping && (
              <div style={{
                alignSelf: 'flex-start',
                background: 'var(--bg-main)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px 10px 10px 2px',
                padding: '0.45rem 0.75rem',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span className="typing-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#25D366' }} />
                <span>ComandaFast está escribiendo...</span>
              </div>
            )}

            
          </div>

          {/* QUICK ACTION CHIPS */}
          <div style={{
            background: 'var(--bg-sidebar)',
            borderTop: '1px solid var(--border-subtle)',
            padding: '0.4rem 0.65rem',
            display: 'flex',
            gap: '0.35rem',
            overflowX: 'auto',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, whiteSpace: 'nowrap' }}>
              Atajos:
            </span>
            {[
              { label: '1️⃣ Estado Pedido', val: '1' },
              { label: '2️⃣ Alias Banco', val: '2' },
              { label: '3️⃣ Horarios', val: '3' },
              { label: '4️⃣ Carta Hamburguesas', val: '4' },
              { label: '🍔 Comprar 1', val: '1' },
              { label: '🚫 Sin cebolla', val: 'sin cebolla' },
              { label: '🧀 Extra cheddar', val: 'extra cheddar' },
              { label: '🛵 Delivery', val: '2' },
              { label: '👍 Confirmar (SI)', val: 'si' },
              { label: '📸 Comprobante', val: '[ENVIAR FOTO COMPROBANTE]' }
            ].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                className="qty-btn"
                style={{
                  width: 'auto',
                  height: '24px',
                  padding: '0 8px',
                  fontSize: '0.68rem',
                  whiteSpace: 'nowrap',
                  background: 'var(--bg-card)'
                }}
                onClick={() => handleSendMessage(chip.val)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* MESSAGE INPUT BAR */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
            style={{
              background: 'var(--bg-main)',
              borderTop: '1px solid var(--border-subtle)',
              padding: '0.6rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <input
              type="text"
              className="search-input"
              placeholder="Escribe un mensaje de WhatsApp (o haz clic en los atajos)..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              style={{ flex: 1, height: '38px', fontSize: '0.84rem' }}
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="btn-confirm-order"
              style={{
                width: '42px',
                height: '38px',
                padding: 0,
                background: inputText.trim() ? '#25D366' : 'var(--text-muted)',
                color: '#fff',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: inputText.trim() ? 'pointer' : 'default'
              }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* =========================================================
            RIGHT COLUMN: LIVE SESSION & CART INSPECTOR
        ========================================================= */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* TAB HEADER */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-main)' }}>
            <button
              type="button"
              onClick={() => setActiveTab('inspector')}
              style={{
                flex: 1,
                padding: '0.65rem',
                fontSize: '0.78rem',
                fontWeight: 800,
                background: activeTab === 'inspector' ? 'var(--bg-card)' : 'transparent',
                color: activeTab === 'inspector' ? 'var(--accent-amber)' : 'var(--text-muted)',
                border: 'none',
                borderBottom: activeTab === 'inspector' ? '2px solid var(--accent-amber)' : 'none',
                cursor: 'pointer'
              }}
            >
              Inspector de Sesión
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              style={{
                flex: 1,
                padding: '0.65rem',
                fontSize: '0.78rem',
                fontWeight: 800,
                background: activeTab === 'catalog' ? 'var(--bg-card)' : 'transparent',
                color: activeTab === 'catalog' ? 'var(--accent-amber)' : 'var(--text-muted)',
                border: 'none',
                borderBottom: activeTab === 'catalog' ? '2px solid var(--accent-amber)' : 'none',
                cursor: 'pointer'
              }}
            >
              Menú Digital ({products.length})
            </button>
          </div>

          {/* TAB CONTENT: INSPECTOR */}
          {activeTab === 'inspector' && (
            <div style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, overflowY: 'auto' }}>
              {/* STEP STATUS BADGE */}
              <div style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.55rem 0.75rem'
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                  PASO ACTUAL DE LA MÁQUINA
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#25D366', marginTop: '2px' }}>
                  {sessionState.step}
                </div>
              </div>

              {/* CART ITEMS BREAKDOWN */}
              <div style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.65rem 0.75rem',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-secondary)' }}>
                    🛒 COMANDA DETECTADA ({sessionState.items.length})
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--accent-amber)' }}>
                    ${sessionState.total.toLocaleString('es-AR')}
                  </span>
                </div>

                {sessionState.items.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
                    Sin items en el carrito.<br />Escribe <strong>comprar</strong> o pulsa un atajo.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', overflowY: 'auto', maxHeight: '180px' }}>
                    {sessionState.items.map((it, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: '0.75rem',
                          background: 'var(--bg-card)',
                          padding: '0.35rem 0.5rem',
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                          <span>{it.name} (x{it.quantity})</span>
                          <span>${(it.price * it.quantity).toLocaleString('es-AR')}</span>
                        </div>
                        {it.modifiers?.length > 0 && (
                          <div style={{ fontSize: '0.65rem', color: 'var(--accent-emerald)' }}>
                            {it.modifiers.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* DETAILS SUMMARY */}
              <div style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.55rem 0.75rem',
                fontSize: '0.72rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Entrega:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{sessionState.shippingMethod === 'delivery' ? '🛵 Delivery' : '🍔 Retiro Mostrador'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Dirección:</span>
                  <strong style={{ color: 'var(--text-primary)', textAlign: 'right', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sessionState.shippingAddress || 'No requerida'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Pago:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{sessionState.paymentMethod}</strong>
                </div>
              </div>

              {/* INJECT TO POS BUTTON */}
              <button
                type="button"
                disabled={sessionState.items.length === 0}
                onClick={handleManualInject}
                className="btn-confirm-order"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.84rem',
                  fontWeight: 900,
                  gap: '6px',
                  background: sessionState.items.length > 0 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'var(--text-muted)',
                  cursor: sessionState.items.length > 0 ? 'pointer' : 'not-allowed'
                }}
              >
                <Zap size={16} />
                <span>Inyectar Pedido a Cocina / POS</span>
              </button>
            </div>
          )}

          {/* TAB CONTENT: CATALOG */}
          {activeTab === 'catalog' && (
            <div style={{ padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0.35rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                  Fotos de la Base de Datos ({products.length}):
                </span>
                <button
                  type="button"
                  onClick={loadDatabaseCatalog}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-amber)', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                >
                  <RefreshCw size={11} />
                  <span>Refrescar</span>
                </button>
              </div>

              {products.map((p, idx) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-subtle)',
                    padding: '0.45rem',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.name}
                      style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-subtle)' }}
                    />
                  ) : (
                    <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                      {p.emoji || '🍔'}
                    </div>
                  )}

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', fontWeight: 800 }}>
                      ${Number(p.price).toLocaleString('es-AR')}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="qty-btn"
                    style={{ width: 'auto', height: '26px', padding: '0 8px', fontSize: '0.7rem', gap: '3px', background: 'var(--bg-card)' }}
                    onClick={() => handleSendMessage(`foto ${idx + 1}`)}
                    title="Probar comando 'FOTO' en el chat del bot"
                  >
                    <span>📸 Probar</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
