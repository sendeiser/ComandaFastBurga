import React, { useState, useEffect } from 'react';
import { MessageSquare, X, ArrowRight, Clock, AlertCircle } from 'lucide-react';
import { liveChatService } from '../../services/liveChatService';
import { audioService } from '../../services/audioService';

export default function WhatsAppToastAlert({ onOpenChat, currentTab }) {
  const [activeAlert, setActiveAlert] = useState(null);
  const [seenMessages] = useState(() => new Set());

  useEffect(() => {
    // Si ya está en la pestaña de whatsapp, no mostrar toasts flotantes
    if (currentTab === 'whatsapp') {
      setActiveAlert(null);
      return;
    }

    let intervalId = null;

    const checkAlerts = async () => {
      try {
        const res = await liveChatService.getActiveChats();
        if (res && res.success && Array.isArray(res.chats)) {
          // Buscar chats con mensajes no leídos recientes de clientes
          const unreadChat = res.chats.find(c => {
            if (!c || (c.unreadCount || 0) <= 0) return false;
            const msgKey = `${c.jid}-${c.lastMessageAt}`;
            if (seenMessages.has(msgKey)) return false;
            return true;
          });

          if (unreadChat) {
            const msgKey = `${unreadChat.jid}-${unreadChat.lastMessageAt}`;
            seenMessages.add(msgKey);

            setActiveAlert({
              jid: unreadChat.jid,
              name: unreadChat.name || `+${unreadChat.phone}`,
              text: unreadChat.lastMessageText || 'Nuevo mensaje recibido',
              isPaused: unreadChat.isPaused,
              hasCart: unreadChat.session && Array.isArray(unreadChat.session.items) && unreadChat.session.items.length > 0
            });

            audioService.playWhatsAppNotification();
          }
        }
      } catch (_) {}
    };

    intervalId = setInterval(checkAlerts, 4000);
    return () => clearInterval(intervalId);
  }, [currentTab, seenMessages]);

  // Auto-ocultar después de 9 segundos
  useEffect(() => {
    if (!activeAlert) return;
    const timer = setTimeout(() => {
      setActiveAlert(null);
    }, 9000);
    return () => clearTimeout(timer);
  }, [activeAlert]);

  if (!activeAlert || currentTab === 'whatsapp') return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9990,
      maxWidth: '380px',
      background: 'var(--bg-card)',
      border: '1.5px solid #25D366',
      borderRadius: 'var(--radius-lg)',
      boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)',
      padding: '0.85rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      animation: 'slideUp 0.3s ease-out'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: '#25D366',
            color: '#052e16',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <MessageSquare size={13} />
          </div>
          <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
            {activeAlert.name}
          </strong>
        </div>

        <button
          type="button"
          onClick={() => setActiveAlert(null)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{
        fontSize: '0.78rem',
        color: 'var(--text-secondary)',
        lineHeight: '1.4',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical'
      }}>
        "{activeAlert.text}"
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {activeAlert.isPaused && (
            <span style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
              ⏸️ Requiere Humano
            </span>
          )}
          {activeAlert.hasCart && (
            <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
              🛒 Con Carrito
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            if (typeof onOpenChat === 'function') {
              onOpenChat(activeAlert.jid);
            }
            setActiveAlert(null);
          }}
          className="cat-pill-btn active"
          style={{
            height: '28px',
            padding: '0 10px',
            fontSize: '0.72rem',
            background: '#25D366',
            color: '#052e16',
            fontWeight: 800,
            gap: '4px'
          }}
        >
          <span>Ver Chat</span>
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}
