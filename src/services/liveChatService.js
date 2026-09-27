// =========================================================
// LIVE CHAT SERVICE (MONITOREO DE WHATSAPP EN VIVO PARA CAJERO)
// =========================================================

const isLocalNetwork = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.')
);

const getBotServerUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:3002';
  return isLocalNetwork ? `http://${window.location.hostname}:3002` : 'http://localhost:3002';
};

export const liveChatService = {
  /**
   * Obtiene la lista de chats activos con su último mensaje, estado del bot y carrito en curso
   */
  async getActiveChats() {
    try {
      const url = getBotServerUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${url}/api/bot/live-chats`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message, chats: [], botOnline: false };
    }
  },

  /**
   * Obtiene la conversación completa de un cliente
   */
  async getChatMessages(jid) {
    if (!jid) return { success: false, messages: [] };
    try {
      const url = getBotServerUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${url}/api/bot/live-chats/${encodeURIComponent(jid)}/messages`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message, messages: [] };
    }
  },

  /**
   * Envía un mensaje manual desde el mostrador hacia el WhatsApp del cliente
   */
  async sendMessage(jid, text) {
    if (!jid || !text || !text.trim()) return { success: false, error: 'Datos incompletos' };
    try {
      const url = getBotServerUrl();
      const res = await fetch(`${url}/api/bot/live-chats/${encodeURIComponent(jid)}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() })
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Pausa o reactiva el bot para un chat específico
   */
  async togglePause(jid, pause, minutes = 25) {
    if (!jid) return { success: false };
    try {
      const url = getBotServerUrl();
      const res = await fetch(`${url}/api/bot/live-chats/${encodeURIComponent(jid)}/toggle-pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pause, minutes })
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Resetea la sesión y vacía el carrito del cliente en el bot
   */
  async resetSession(jid) {
    if (!jid) return { success: false };
    try {
      const url = getBotServerUrl();
      const res = await fetch(`${url}/api/bot/live-chats/${encodeURIComponent(jid)}/reset-session`, {
        method: 'POST'
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
