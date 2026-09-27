import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  MessageSquare, Send, RefreshCw, User, Phone, MapPin, 
  ShoppingBag, CheckCircle2, AlertCircle, Clock, Trash2, 
  Play, Pause, ExternalLink, Search, Check, CheckCheck, 
  ArrowRight, Image as ImageIcon, Zap, X, ShieldAlert, Sparkles
} from 'lucide-react';
import { liveChatService } from '../../services/liveChatService';
import { audioService } from '../../services/audioService';

const QUICK_SNIPPETS = [
  '¡Hola! Ya estamos revisando tu pedido 🔥',
  'Demora estimada actual: 30 a 45 minutos 🛵',
  'Comprobante de pago verificado con éxito, ¡muchas gracias! 🙌',
  'Por favor indícanos tu dirección exacta para el delivery 📍',
  'Hola, ¿en qué podemos ayudarte? Te atiende el cajero del local 👨‍🍳',
  'Tu pedido ya ingresó a la cocina y se está preparando 🔥🍔'
];

export default function WhatsAppLiveMonitor({ 
  onLoadOrderToPOS, 
  onDirectInjectOrder,
  products = []
}) {
  const [chats, setChats] = useState([]);
  const [selectedJid, setSelectedJid] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [inputText, setInputText] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'human' | 'cart' | 'unread'
  const [searchQuery, setSearchQuery] = useState('');
  const [botOnline, setBotOnline] = useState(true);
  const [zoomedImage, setZoomedImage] = useState(null);

  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

  // 1. Cargar lista de chats
  const fetchChats = useCallback(async (silent = false) => {
    if (!silent) setLoadingChats(true);
    try {
      const res = await liveChatService.getActiveChats();
      if (res && res.success) {
        setChats(res.chats || []);
        setBotOnline(res.botOnline !== false);

        // Si no hay seleccionado o el seleccionado ya no existe, seleccionar el primero
        if (!selectedJid && res.chats && res.chats.length > 0) {
          setSelectedJid(res.chats[0].jid);
        }
      }
    } catch (_) {
      setBotOnline(false);
    } finally {
      if (!silent) setLoadingChats(false);
    }
  }, [selectedJid]);

  // 2. Cargar mensajes del chat seleccionado
  const fetchMessages = useCallback(async (jid, silent = false) => {
    if (!jid) return;
    if (!silent) setLoadingMessages(true);
    try {
      const res = await liveChatService.getChatMessages(jid);
      if (res && res.success) {
        setMessages(res.messages || []);
        setCurrentSession(res.session || null);
      }
    } catch (_) {
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  // Polling automático cada 3 segundos
  useEffect(() => {
    fetchChats();
    const interval = setInterval(() => {
      fetchChats(true);
      if (selectedJid) {
        fetchMessages(selectedJid, true);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchChats, fetchMessages, selectedJid]);

  // Al cambiar chat seleccionado
  useEffect(() => {
    if (selectedJid) {
      fetchMessages(selectedJid);
      // Foco en el input
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 150);
    }
  }, [selectedJid, fetchMessages]);

  // Auto-scroll al final de mensajes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Enviar mensaje manual desde el cajero
  const handleSendMessage = async (textToSend) => {
    const text = (typeof textToSend === 'string' ? textToSend : inputText).trim();
    if (!text || !selectedJid || sendingMessage) return;

    setSendingMessage(true);
    try {
      const res = await liveChatService.sendMessage(selectedJid, text);
      if (res && res.success) {
        setInputText('');
        // Agregar optimistamente
        setMessages(prev => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            from: 'cashier',
            text,
            timestamp: Date.now()
          }
        ]);
        // Refrescar estado y mensajes
        setTimeout(() => {
          fetchMessages(selectedJid, true);
          fetchChats(true);
        }, 500);
      } else {
        alert(`No se pudo enviar el mensaje: ${res?.error || 'Error desconocido'}`);
      }
    } catch (err) {
      alert(`Error de conexión: ${err.message}`);
    } finally {
      setSendingMessage(false);
    }
  };

  // Alternar pausa / Modo Humano
  const handleTogglePause = async (pause) => {
    if (!selectedJid) return;
    try {
      const res = await liveChatService.togglePause(selectedJid, pause);
      if (res && res.success) {
        fetchMessages(selectedJid, true);
        fetchChats(true);
      }
    } catch (err) {
      alert(`Error al cambiar modo: ${err.message}`);
    }
  };

  // Vaciar carrito / resetear sesión
  const handleResetSession = async () => {
    if (!selectedJid) return;
    if (!window.confirm('¿Seguro que deseas vaciar el carrito actual y reiniciar la sesión del cliente?')) return;
    try {
      await liveChatService.resetSession(selectedJid);
      setCurrentSession(null);
      fetchChats(true);
      fetchMessages(selectedJid, true);
    } catch (_) {}
  };

  // Cargar sesión al Mostrador (FastOrderPad)
  const handleLoadToPOS = () => {
    if (!currentSession || !Array.isArray(currentSession.items) || currentSession.items.length === 0) {
      alert('El cliente no tiene productos seleccionados en su carrito actualmente.');
      return;
    }

    const currentChat = chats.find(c => c.jid === selectedJid);
    const parsedData = {
      customer: {
        name: currentSession.customerName || currentChat?.name || 'Cliente WhatsApp',
        phone: currentChat?.phone || '',
        address: currentSession.shippingAddress || (currentSession.shippingMethod === 'delivery' ? 'Domicilio' : 'Retiro en Local')
      },
      items: currentSession.items.map(it => {
        const prodMatch = products.find(p => p.id === it.id || p.name.toLowerCase() === it.name.toLowerCase());
        return {
          productId: prodMatch ? prodMatch.id : it.id,
          name: it.name,
          unitPrice: Number(it.unitPrice || it.price) || (prodMatch ? prodMatch.price : 0),
          qty: Number(it.qty) || 1,
          modifiers: it.modifiers || [],
          notes: it.notes || ''
        };
      })
    };

    if (typeof onLoadOrderToPOS === 'function') {
      onLoadOrderToPOS(parsedData);
    }
  };

  // Inyectar directo a cocina
  const handleDirectInject = () => {
    if (!currentSession || !Array.isArray(currentSession.items) || currentSession.items.length === 0) {
      alert('No hay productos en el carrito para inyectar.');
      return;
    }

    const currentChat = chats.find(c => c.jid === selectedJid);
    if (typeof onDirectInjectOrder === 'function') {
      onDirectInjectOrder({
        customer: {
          name: currentSession.customerName || currentChat?.name || 'Cliente WhatsApp',
          phone: currentChat?.phone || '',
          address: currentSession.shippingAddress || (currentSession.shippingMethod === 'delivery' ? 'Domicilio' : 'Retiro en Local')
        },
        deliveryType: currentSession.shippingMethod || 'local',
        paymentMethod: currentSession.paymentMethod || 'efectivo',
        items: currentSession.items,
        total: currentSession.total || currentSession.subtotal || 0
      });
    }
  };

  // Filtrado de chats
  const filteredChats = useMemo(() => {
    return chats.filter(c => {
      // Búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (c.name || '').toLowerCase().includes(q);
        const matchesPhone = (c.phone || '').includes(q);
        const matchesLast = (c.lastMessageText || '').toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesLast) return false;
      }

      // Filtro de categoría
      if (filterMode === 'human') return c.isPaused;
      if (filterMode === 'cart') return c.session && Array.isArray(c.session.items) && c.session.items.length > 0;
      if (filterMode === 'unread') return (c.unreadCount || 0) > 0;
      return true;
    });
  }, [chats, searchQuery, filterMode]);

  const activeChat = useMemo(() => {
    return chats.find(c => c.jid === selectedJid) || null;
  }, [chats, selectedJid]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '320px 1fr 340px',
      gap: '1rem',
      height: 'calc(100vh - 72px)',
      padding: '0.85rem 1rem',
      background: 'var(--bg-main)',
      overflow: 'hidden'
    }}>
      {/* ========================================================= */}
      {/* COLUMNA 1: LISTA DE CHATS */}
      {/* ========================================================= */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* HEADER CHATS */}
        <div style={{
          padding: '0.85rem 1rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} style={{ color: '#25D366' }} />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                Chats WhatsApp
              </h3>
            </div>
            <button
              type="button"
              onClick={() => fetchChats()}
              className="cat-pill-btn"
              style={{ height: '28px', padding: '0 8px', fontSize: '0.72rem', gap: '4px' }}
              title="Refrescar lista de chats"
            >
              <RefreshCw size={12} className={loadingChats ? 'spin-slow' : ''} />
            </button>
          </div>

          {/* BUSCADOR */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar por cliente o teléfono..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="custom-input-sm"
              style={{
                width: '100%',
                paddingLeft: '32px',
                height: '32px',
                fontSize: '0.78rem',
                background: 'var(--bg-main)',
                border: '1px solid var(--border-subtle)'
              }}
            />
          </div>

          {/* FILTROS RÁPIDOS */}
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
            {[
              { id: 'all', label: 'Todos' },
              { id: 'human', label: '⏸️ Humano' },
              { id: 'cart', label: '🛒 Carrito' },
              { id: 'unread', label: '📩 No leídos' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterMode(f.id)}
                className={`cat-pill-btn ${filterMode === f.id ? 'active' : ''}`}
                style={{
                  height: '24px',
                  padding: '0 8px',
                  fontSize: '0.7rem',
                  whiteSpace: 'nowrap',
                  borderRadius: 'var(--radius-full)'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* LISTA SCROLLABLE DE CHATS */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredChats.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {searchQuery ? 'No hay chats que coincidan con la búsqueda.' : 'No hay chats activos registrados por el bot aún.'}
            </div>
          ) : (
            filteredChats.map(c => {
              const isSelected = c.jid === selectedJid;
              const hasItems = c.session && Array.isArray(c.session.items) && c.session.items.length > 0;
              const cartTotal = hasItems ? (c.session.total || c.session.subtotal || 0) : 0;
              const timeStr = c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

              return (
                <div
                  key={c.jid}
                  onClick={() => setSelectedJid(c.jid)}
                  style={{
                    padding: '0.75rem 0.9rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(37, 211, 102, 0.08)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #25D366' : '3px solid transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: isSelected ? '#25D366' : 'var(--bg-main)',
                        color: isSelected ? '#052e16' : 'var(--accent-emerald)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '0.82rem',
                        flexShrink: 0
                      }}>
                        {c.name ? c.name.charAt(0).toUpperCase() : <User size={15} />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {c.name || `+${c.phone}`}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          +{c.phone}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{timeStr}</span>
                      {c.unreadCount > 0 && (
                        <span style={{
                          background: '#25D366',
                          color: '#052e16',
                          fontSize: '0.68rem',
                          fontWeight: 900,
                          padding: '1px 6px',
                          borderRadius: '10px'
                        }}>
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* PREVIEW ÚLTIMO MENSAJE */}
                  <div style={{
                    fontSize: '0.74rem',
                    color: isSelected ? 'var(--text-secondary)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    paddingLeft: '40px'
                  }}>
                    {c.lastSender === 'cashier' ? '👨‍🍳 Tú: ' : (c.lastSender === 'bot' ? '🤖 Bot: ' : '')}
                    {c.lastMessageText || 'Conversación activa'}
                  </div>

                  {/* STATUS BADGES */}
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', paddingLeft: '40px', marginTop: '2px' }}>
                    {c.isPaused ? (
                      <span style={{
                        fontSize: '0.65rem',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: 'var(--accent-amber)',
                        fontWeight: 800
                      }}>
                        ⏸️ Humano ({c.remainingPauseMinutes}m)
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '0.65rem',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'rgba(59, 130, 246, 0.12)',
                        color: 'var(--accent-blue)',
                        fontWeight: 700
                      }}>
                        🤖 Bot Activo
                      </span>
                    )}

                    {hasItems && (
                      <span style={{
                        fontSize: '0.65rem',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: 'var(--accent-emerald)',
                        fontWeight: 800
                      }}>
                        🛒 ${cartTotal.toLocaleString('es-AR')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* COLUMNA 2: CONVERSACIÓN EN VIVO (CHAT ACTIVO) */}
      {/* ========================================================= */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {activeChat ? (
          <>
            {/* TOP BAR DEL CHAT */}
            <div style={{
              padding: '0.75rem 1.25rem',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--bg-card)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: '#25D366',
                  color: '#052e16',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '0.95rem'
                }}>
                  {activeChat.name ? activeChat.name.charAt(0).toUpperCase() : <User size={18} />}
                </div>
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                    {activeChat.name}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>+{activeChat.phone}</span>
                    <span>•</span>
                    <a
                      href={`https://web.whatsapp.com/send?phone=${activeChat.phone}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#25D366', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                    >
                      <span>Abrir WhatsApp Web</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              </div>

              {/* CONTROLES DE MODO BOT / HUMANO */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeChat.isPaused ? (
                  <button
                    type="button"
                    onClick={() => handleTogglePause(false)}
                    className="cat-pill-btn active"
                    style={{
                      height: '30px',
                      padding: '0 10px',
                      fontSize: '0.74rem',
                      background: 'var(--accent-emerald)',
                      color: '#052e16',
                      fontWeight: 800,
                      gap: '5px'
                    }}
                    title="Reactivar el Bot para que vuelva a responder automáticamente"
                  >
                    <Play size={13} fill="currentColor" />
                    <span>Reanudar Bot</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleTogglePause(true)}
                    className="cat-pill-btn"
                    style={{
                      height: '30px',
                      padding: '0 10px',
                      fontSize: '0.74rem',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: 'var(--accent-amber)',
                      border: '1px solid var(--accent-amber)',
                      fontWeight: 800,
                      gap: '5px'
                    }}
                    title="Pausar el bot 25 minutos para atender personalmente al cliente"
                  >
                    <Pause size={13} fill="currentColor" />
                    <span>Pausar Bot (Modo Humano)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => fetchMessages(selectedJid)}
                  className="cat-pill-btn"
                  style={{ height: '30px', padding: '0 8px' }}
                  title="Recargar mensajes"
                >
                  <RefreshCw size={13} className={loadingMessages ? 'spin-slow' : ''} />
                </button>
              </div>
            </div>

            {/* AVISO DE ESTADO HUMANO / BOT */}
            {activeChat.isPaused && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.12)',
                borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
                padding: '6px 16px',
                fontSize: '0.74rem',
                color: 'var(--accent-amber)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 700
              }}>
                <Clock size={14} />
                <span>Modo Humano activo ({activeChat.remainingPauseMinutes} min restantes). El bot está en pausa para este cliente.</span>
              </div>
            )}

            {/* FEED DE MENSAJES SCROLLABLE */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              background: 'var(--bg-main)'
            }}>
              {messages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No hay mensajes registrados en esta conversación.
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isCustomer = m.from === 'customer';
                  const isBot = m.from === 'bot';
                  const isCashier = m.from === 'cashier';
                  const timeFormatted = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                  return (
                    <div
                      key={m.id || idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isCustomer ? 'flex-start' : 'flex-end',
                        maxWidth: '85%',
                        alignSelf: isCustomer ? 'flex-start' : 'flex-end'
                      }}
                    >
                      {/* SENDER LABEL */}
                      <span style={{
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        marginBottom: '2px',
                        color: isCustomer ? 'var(--text-muted)' : (isCashier ? 'var(--accent-amber)' : '#25D366')
                      }}>
                        {isCustomer ? (activeChat.name || 'Cliente') : (isCashier ? '👨‍🍳 Cajero (Mostrador)' : '🤖 Bot Automático')}
                      </span>

                      {/* BUBBLE */}
                      <div style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: isCustomer ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                        background: isCustomer 
                          ? 'var(--bg-card)' 
                          : (isCashier ? 'rgba(245, 158, 11, 0.15)' : 'rgba(37, 211, 102, 0.15)'),
                        border: `1px solid ${isCustomer ? 'var(--border-subtle)' : (isCashier ? 'rgba(245, 158, 11, 0.3)' : 'rgba(37, 211, 102, 0.3)')}`,
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem',
                        lineHeight: '1.45',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                      }}>
                        {/* FOTO / COMPROBANTE ADJUNTO */}
                        {m.imageUrl && (
                          <div style={{ marginBottom: '8px' }}>
                            <img
                              src={m.imageUrl}
                              alt="Comprobante / Foto"
                              onClick={() => setZoomedImage(m.imageUrl)}
                              style={{
                                maxWidth: '240px',
                                maxHeight: '200px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                objectFit: 'cover',
                                border: '1px solid var(--border-subtle)'
                              }}
                            />
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              🔍 Clic para ampliar foto
                            </div>
                          </div>
                        )}

                        {m.text}

                        <div style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '4px',
                          fontSize: '0.64rem',
                          color: 'var(--text-muted)'
                        }}>
                          <span>{timeFormatted}</span>
                          {!isCustomer && <CheckCheck size={11} style={{ color: '#25D366' }} />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* RESPUESTAS RÁPIDAS (CHIPS) */}
            <div style={{
              padding: '6px 12px',
              background: 'var(--bg-card)',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              whiteSpace: 'nowrap'
            }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'center', fontWeight: 800 }}>
                Respuestas rápidas:
              </span>
              {QUICK_SNIPPETS.map((snip, sIdx) => (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => handleSendMessage(snip)}
                  className="cat-pill-btn"
                  style={{
                    height: '24px',
                    padding: '0 8px',
                    fontSize: '0.68rem',
                    background: 'var(--bg-main)',
                    color: 'var(--text-secondary)'
                  }}
                  title={snip}
                >
                  {snip.length > 30 ? snip.substring(0, 30) + '...' : snip}
                </button>
              ))}
            </div>

            {/* BARRA DE ENTRADA (INPUT) */}
            <div style={{
              padding: '0.75rem 1rem',
              borderTop: '1px solid var(--border-subtle)',
              background: 'var(--bg-card)',
              display: 'flex',
              gap: '8px',
              alignItems: 'center'
            }}>
              <input
                ref={chatInputRef}
                type="text"
                placeholder="Escribe un mensaje para responder al cliente (pausará el bot automáticamente)..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={sendingMessage}
                className="custom-input-sm"
                style={{
                  flex: 1,
                  height: '38px',
                  fontSize: '0.84rem',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0 12px'
                }}
              />

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || sendingMessage}
                className="cat-pill-btn active"
                style={{
                  height: '38px',
                  padding: '0 1.1rem',
                  background: '#25D366',
                  color: '#052e16',
                  fontWeight: 800,
                  gap: '6px'
                }}
              >
                <Send size={15} />
                <span>{sendingMessage ? 'Enviando...' : 'Enviar'}</span>
              </button>
            </div>
          </>
        ) : (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
            <MessageSquare size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <h4 style={{ margin: 0, color: 'var(--text-secondary)' }}>Selecciona una conversación</h4>
            <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Haz clic en un chat de la izquierda para ver y gestionar la conversación.</p>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* COLUMNA 3: FICHA DEL CLIENTE Y CARRITO EN VIVO */}
      {/* ========================================================= */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        overflowY: 'auto'
      }}>
        {/* TARJETA DATOS CLIENTE */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={15} style={{ color: 'var(--accent-amber)' }} />
            <span>Ficha del Cliente</span>
          </div>

          {activeChat ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Nombre: </span>
                <strong style={{ color: 'var(--text-primary)' }}>{activeChat.name}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Teléfono: </span>
                <span style={{ color: 'var(--text-secondary)' }}>+{activeChat.phone}</span>
              </div>
              {currentSession?.shippingMethod && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Entrega: </span>
                  <span style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>
                    {currentSession.shippingMethod === 'delivery' ? '🛵 Envío a Domicilio' : '🏪 Retiro en Local'}
                  </span>
                </div>
              )}
              {currentSession?.shippingAddress && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Dirección: </span>
                  <span style={{ color: 'var(--text-primary)' }}>{currentSession.shippingAddress}</span>
                </div>
              )}
              {currentSession?.paymentMethod && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Método de Pago: </span>
                  <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{currentSession.paymentMethod}</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sin cliente seleccionado.</div>
          )}
        </div>

        {/* TARJETA CARRITO EN VIVO */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          flex: 1
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShoppingBag size={15} style={{ color: 'var(--accent-emerald)' }} />
              <span>Carrito en WhatsApp (En Vivo)</span>
            </div>

            {currentSession && Array.isArray(currentSession.items) && currentSession.items.length > 0 && (
              <button
                type="button"
                onClick={handleResetSession}
                className="qty-btn"
                style={{ width: 'auto', padding: '2px 6px', fontSize: '0.68rem', color: 'var(--accent-rose)' }}
                title="Vaciar carrito del cliente"
              >
                <Trash2 size={11} />
                <span>Vaciar</span>
              </button>
            )}
          </div>

          {currentSession && Array.isArray(currentSession.items) && currentSession.items.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1 }}>
              {/* LISTA ITEMS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto' }}>
                {currentSession.items.map((it, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg-main)',
                      padding: '0.55rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.78rem'
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>{it.qty}x {it.name}</strong>
                      {it.modifiers && it.modifiers.length > 0 && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--accent-amber)' }}>
                          {it.modifiers.join(', ')}
                        </div>
                      )}
                    </div>
                    <span style={{ fontWeight: 800, color: 'var(--accent-emerald)' }}>
                      ${((Number(it.unitPrice || it.price) || 0) * (Number(it.qty) || 1)).toLocaleString('es-AR')}
                    </span>
                  </div>
                ))}
              </div>

              {/* TOTAL */}
              <div style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.9rem'
              }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Total Estimado:</span>
                <strong style={{ color: 'var(--accent-emerald)', fontSize: '1.05rem', fontWeight: 900 }}>
                  ${(Number(currentSession.total) || Number(currentSession.subtotal) || 0).toLocaleString('es-AR')}
                </strong>
              </div>

              {/* BOTONES DE ACCIÓN RÁPIDA */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={handleLoadToPOS}
                  className="cat-pill-btn active"
                  style={{
                    height: '36px',
                    width: '100%',
                    justifyContent: 'center',
                    background: 'var(--accent-emerald)',
                    color: '#052e16',
                    fontWeight: 900,
                    fontSize: '0.8rem',
                    gap: '6px'
                  }}
                  title="Cargar estos productos en la comanda del Mostrador para cobrar o modificar"
                >
                  <ShoppingBag size={15} />
                  <span>Cargar al Mostrador (POS)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDirectInject}
                  className="cat-pill-btn"
                  style={{
                    height: '32px',
                    width: '100%',
                    justifyContent: 'center',
                    background: 'rgba(59, 130, 246, 0.12)',
                    color: 'var(--accent-blue)',
                    border: '1px solid var(--accent-blue)',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    gap: '6px'
                  }}
                  title="Enviar directamente el pedido a la pantalla de cocina KDS"
                >
                  <Zap size={14} />
                  <span>Inyectar Directo a Cocina</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              margin: 'auto',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.78rem',
              padding: '1.5rem 0'
            }}>
              El cliente no tiene productos seleccionados en el carrito en este momento.
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL PARA AMPLIAR COMPROBANTES DE TRANSFERENCIA */}
      {/* ========================================================= */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              style={{
                position: 'absolute',
                top: '-36px',
                right: '0',
                background: '#fff',
                color: '#000',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
            <img
              src={zoomedImage}
              alt="Comprobante ampliado"
              style={{
                maxWidth: '90vw',
                maxHeight: '85vh',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                objectFit: 'contain'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
