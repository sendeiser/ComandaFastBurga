// =========================================================
// CHATBOT SERVICE (GASTRONOMIC NLP & WHATSAPP STATE MACHINE)
// Motor de atención automática, toma de pedidos y lab de simulación
// =========================================================

import { DEFAULT_CHATBOT_KEYWORDS, DEFAULT_TEMPLATES, DEFAULT_CUSTOM_FLOWS, DEFAULT_BOT_VARIABLES, formatItemNumber } from './whatsappBotConstants.js';
import { storageService } from './storageService';
import { audioService } from './audioService';
import { supabaseSync } from './supabaseClient';

const BOT_SETTINGS_KEY = 'comandafast_bot_settings';
const BOT_VARIABLES_KEY = 'comandafast_bot_variables';

export const chatbotService = {
  // --- GESTIÓN DE VARIABLES GLOBALES DEL BOT ---
  getBotVariables() {
    try {
      const saved = localStorage.getItem(BOT_VARIABLES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const map = new Map(parsed.map(v => [v.key, v]));
          DEFAULT_BOT_VARIABLES.forEach(def => {
            if (!map.has(def.key)) {
              map.set(def.key, def);
            }
          });
          return Array.from(map.values());
        }
      }
    } catch (e) {
      console.error('[chatbotService] Error al leer bot_variables:', e);
    }
    return DEFAULT_BOT_VARIABLES;
  },

  saveBotVariables(variables) {
    try {
      localStorage.setItem(BOT_VARIABLES_KEY, JSON.stringify(variables));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('comandafast:bot_variables_updated', { detail: variables }));
      }
      this.syncBotVariablesWithServer(variables);
      return true;
    } catch (e) {
      console.error('[chatbotService] Error al guardar bot_variables:', e);
      return false;
    }
  },

  resetBotVariables() {
    this.saveBotVariables(DEFAULT_BOT_VARIABLES);
    return DEFAULT_BOT_VARIABLES;
  },

  getBotVariablesMap() {
    const list = this.getBotVariables();
    const map = {};
    for (const v of list) {
      if (v && v.key) {
        map[v.key] = v.value !== undefined ? v.value : v.defaultValue;
      }
    }
    return map;
  },

  async fetchServerBotVariables() {
    try {
      const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
      const res = await fetch(`http://${host}:3002/api/bot-variables`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.variables) && data.variables.length > 0) {
          localStorage.setItem(BOT_VARIABLES_KEY, JSON.stringify(data.variables));
          return data.variables;
        }
      }
    } catch (e) {
      // Offline fallback
    }
    return this.getBotVariables();
  },

  async syncBotVariablesWithServer(variables) {
    try {
      const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
      await fetch(`http://${host}:3002/api/bot-variables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables })
      });
    } catch (e) {
      // Live server might be offline
    }
  },

  // --- GESTIÓN DE FLUJOS PERSONALIZADOS Y CONDICIONES ---
  getCustomFlows() {
    try {
      const saved = localStorage.getItem('comandafast_custom_flows');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('[chatbotService] Error al leer custom_flows:', e);
    }
    return DEFAULT_CUSTOM_FLOWS;
  },

  saveCustomFlows(flows) {
    try {
      localStorage.setItem('comandafast_custom_flows', JSON.stringify(flows));
      this.syncFlowsWithBotServer(flows);
      return true;
    } catch (e) {
      console.error('[chatbotService] Error al guardar custom_flows:', e);
      return false;
    }
  },

  resetCustomFlows() {
    this.saveCustomFlows(DEFAULT_CUSTOM_FLOWS);
    return DEFAULT_CUSTOM_FLOWS;
  },

  async syncFlowsWithBotServer(flows) {
    try {
      await fetch(`http://${typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost'}:3002/api/flows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flows })
      });
    } catch (_) {}
  },

  async fetchServerFlows() {
    try {
      const res = await fetch(`http://${typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost'}:3002/api/flows`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.flows)) {
          localStorage.setItem('comandafast_custom_flows', JSON.stringify(data.flows));
          return data.flows;
        }
      }
    } catch (_) {}
    return this.getCustomFlows();
  },

  // 1. Obtener ajustes del bot
  getSettings() {
    try {
      const saved = localStorage.getItem(BOT_SETTINGS_KEY);
      if (saved) {
        return { ...DEFAULT_TEMPLATES, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('[chatbotService] Error al leer ajustes:', e);
    }
    return {
      enabled: true,
      auto_notify_new_order: true,
      auto_notify_status_change: true,
      require_keywords_for_chatbot: true,
      chatbot_keywords: DEFAULT_CHATBOT_KEYWORDS,
      ignored_numbers: [],
      bank_alias: 'comandafast.mp',
      bank_name: 'Mercado Pago / Banco Galicia',
      bank_holder: 'ComandaFast Burgers S.R.L.',
      bank_cbu: '0000003100092138928374',
      pickup_address: 'Av. Belgrano 1234, Centro',
      opening_hours: 'Miércoles a Domingos de 19:30 a 00:30 hs',
      store_website_url: window.location.origin,
      ...DEFAULT_TEMPLATES
    };
  },

  // 2. Guardar ajustes del bot
  saveSettings(newSettings) {
    try {
      localStorage.setItem(BOT_SETTINGS_KEY, JSON.stringify(newSettings));
      return true;
    } catch (e) {
      console.error('[chatbotService] Error al guardar ajustes:', e);
      return false;
    }
  },

  // 3. Obtener productos frescos directamente de la base de datos (Supabase + Local)
  async getDatabaseProducts() {
    try {
      // 1. Si Supabase está configurado, intentar traer de la nube primero
      if (supabaseSync.isConfigured()) {
        const cloudProds = await supabaseSync.fetchProducts();
        if (Array.isArray(cloudProds) && cloudProds.length > 0) {
          storageService.saveProducts(cloudProds);
          this.syncWithBotServer(cloudProds);
          return cloudProds;
        }
      }
    } catch (err) {
      console.warn('[chatbotService] Error al sincronizar con Supabase, usando local:', err);
    }

    // 2. Traer productos de almacenamiento local persistente
    const localProds = storageService.getProducts();
    this.syncWithBotServer(localProds);
    return localProds;
  },

  // Sincronizar catálogo con el servidor Baileys de WhatsApp en puerto 3002
  async syncWithBotServer(products) {
    try {
      await fetch(`http://${typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost'}:3002/sync-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products })
      });
    } catch (_) {
      // Servidor local puede no estar escuchando todavía
    }
  },

  // Generador de catálogo paginado y formateado limpio (sin iconos rotos en números de 2 dígitos)
  buildCatalogMessage(prods, page = 1, pageSize = 8, isAll = false) {
    const total = prods.length;
    if (total === 0) {
      return '🍔 *La carta se encuentra en actualización.* Por favor consultá en unos minutos.';
    }

    if (isAll) {
      const list = prods.map((p, i) => {
        const numBadge = formatItemNumber(i + 1);
        const photoBadge = p.image ? '📸' : '';
        return `${numBadge} *${p.name}* — $${Number(p.price).toLocaleString('es-AR')} ${photoBadge}`;
      }).join('\n');

      return `🍔 *CARTA COMPLETA DE COMANDAFAST (${total} opciones)* 🔥\n\n${list}\n\n👉 *Para pedir:* Respondé con el número (ej: *1*, *12*, *18*) o *COMPRAR*.\n👉 *Para ver foto:* Escribí *FOTO [número]* (ej: *FOTO 12*).`;
    }

    const totalPages = Math.ceil(total / pageSize) || 1;
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const startIdx = (currentPage - 1) * pageSize;
    const pageProds = prods.slice(startIdx, startIdx + pageSize);

    const list = pageProds.map((p, i) => {
      const globalIdx = startIdx + i + 1;
      const numBadge = formatItemNumber(globalIdx);
      const photoBadge = p.image ? '📸' : '';
      return `${numBadge} *${p.name}* — $${Number(p.price).toLocaleString('es-AR')} ${photoBadge}`;
    }).join('\n');

    let navInstructions = '';
    if (totalPages > 1) {
      if (currentPage < totalPages && currentPage > 1) {
        navInstructions = `⏩ Escribí *SIGUIENTE* (o *PAG ${currentPage + 1}*) | ⏪ *ANTERIOR*\n`;
      } else if (currentPage === 1) {
        navInstructions = `⏩ Escribí *SIGUIENTE* (o *PAG 2*) para ver más hamburguesas.\n`;
      } else {
        navInstructions = `⏪ Escribí *ANTERIOR* para volver a la página ${currentPage - 1}.\n`;
      }
    }

    return `🍔 *MENÚ COMANDAFAST BURGERS* 🔥\n📄 *Página ${currentPage} de ${totalPages}* (Opciones ${startIdx + 1} al ${startIdx + pageProds.length} de ${total})\n\n${list}\n\n───────────────────\n👉 *Para pedir:* Respondé con el NÚMERO (1 al ${total}).\n👉 *Para ver foto:* Escribí *FOTO [número]* (ej: *FOTO ${startIdx + 1}*).\n${navInstructions}👉 Escribí *VER TODO* para ver la lista completa.`;
  },

  // 4. Interpolación de variables en plantillas
  interpolateTemplate(template, vars = {}) {
    let res = template || '';
    for (const [k, v] of Object.entries(vars)) {
      res = res.replace(new RegExp(`\\{${k}\\}`, 'gi'), String(v ?? ''));
    }
    return res;
  },

  // 5. Variables resueltas dinámicamente
  getResolvedVariables(persona = {}, settings = null) {
    const s = settings || this.getSettings();
    return {
      cliente: persona.name || 'Cliente',
      alias_banco: s.bank_alias || 'comandafast.mp',
      banco: s.bank_name || 'Mercado Pago / Galicia',
      titular: s.bank_holder || 'ComandaFast Burgers',
      cbu: s.bank_cbu || '0000003100092138928374',
      direccion: s.pickup_address || 'Av. Belgrano 1234, Centro',
      horarios: s.opening_hours || 'Miércoles a Domingos de 19:30 a 00:30 hs',
      catalogo_url: s.store_website_url || window.location.origin
    };
  },

    // Consulta a Google Gemini AI mediante el microservicio local
  async queryGeminiAI(userMessage, persona = {}, availableProducts = []) {
    try {
      const res = await fetch(`http://${typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost'}:3002/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          customerName: persona?.name || '',
          availableProducts: availableProducts.length > 0 ? availableProducts : this.getDatabaseProducts()
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data.reply || null;
      }
    } catch (_) {}
    return null;
  },

  // 6. Inyección directa de pedido a ComandaFast (POS y Cocina KDS)
  injectOrderToPos({ items = [], customer = {}, paymentMethod = 'efectivo', shippingMethod = 'local' }) {
    if (!items || items.length === 0) return null;

    const subtotal = items.reduce((acc, it) => acc + (it.price * (it.qty || it.quantity || 1)), 0);
    const orderCode = 'CMD-' + Math.floor(1000 + Math.random() * 9000);
    const custName = typeof customer === 'object' ? (customer.name || 'Cliente WhatsApp') : customer;
    const custPhone = typeof customer === 'object' ? (customer.phone || '') : '';
    const custAddress = typeof customer === 'object' ? (customer.address || (shippingMethod === 'delivery' ? 'Domicilio' : 'Retiro en Local')) : (shippingMethod === 'delivery' ? 'Domicilio' : 'Retiro en Local');

    const newOrder = {
      id: orderCode,
      code: orderCode,
      orderNumber: orderCode.replace('CMD-', ''),
      customer: {
        name: custName,
        phone: custPhone,
        address: custAddress
      },
      channel: 'whatsapp',
      deliveryType: shippingMethod === 'delivery' ? 'delivery' : 'local',
      paymentMethod: paymentMethod || 'efectivo',
      items: items.map(it => ({
        id: it.id || it.productId || ('item-' + Math.random()),
        name: it.name,
        price: it.price,
        qty: it.qty || it.quantity || 1,
        quantity: it.qty || it.quantity || 1,
        modifiers: it.modifiers || [],
        notes: it.notes || ''
      })),
      total: subtotal,
      status: 'pendiente',
      createdAt: new Date().toISOString(),
      source: 'whatsapp_bot'
    };

    try {
      const saved = storageService.saveOrder(newOrder);
      try { audioService.playOrderChime(); } catch (_) {}
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('comandafast:new-order', { detail: saved || newOrder }));
      }
      return saved || newOrder;
    } catch (e) {
      console.error('[chatbotService] Error al inyectar pedido:', e);
      return null;
    }
  },

  // 7. MOTOR DE CÓMPUTO CONVERSACIONAL// 7. MOTOR DE CÓMPUTO CONVERSACIONAL (CON SOPORTE DE FOTOS REALES Y BASE DE DATOS)
  computeBotResponse(userInput, prevState, persona, { availableProducts = [], sandboxMode = true } = {}) {
    const text = (userInput || '').trim();
    const lower = text.toLowerCase();
    const settings = this.getSettings();
    const commonVars = this.getResolvedVariables(persona, settings);

    let newState = {
      step: prevState?.step || 'IDLE',
      items: Array.isArray(prevState?.items) ? [...prevState.items] : [],
      subtotal: prevState?.subtotal || 0,
      total: prevState?.total || 0,
      shippingMethod: prevState?.shippingMethod || 'local',
      shippingAddress: prevState?.shippingAddress || '',
      shippingName: prevState?.shippingName || persona.name || '',
      paymentMethod: prevState?.paymentMethod || 'efectivo',
      pendingProduct: prevState?.pendingProduct || null
    };

    let reply = '';
    let image = null;
    let systemNote = false;
    let generatedOrder = null;

    // Productos activos para el menú desde la base de datos
    const prods = (availableProducts && availableProducts.length > 0)
      ? availableProducts
      : storageService.getProducts();

    // -------------------------------------------------------------
    // 1. FILTRO ANTI-SPAM / MENSAJES PERSONALES
    // -------------------------------------------------------------
    if (persona.isIgnored || (settings.require_keywords_for_chatbot && (lower.includes('futbol') || lower.includes('fútbol') || lower.includes('juntamos') || lower.includes('amigo') || lower.includes('asado') || lower.includes('hola che') || lower.includes('almorzar')))) {
      const keywords = settings.chatbot_keywords || DEFAULT_CHATBOT_KEYWORDS;
      const hasKeyword = keywords.some(kw => lower.includes(kw.toLowerCase()));
      if (!hasKeyword) {
        return {
          reply: `🛡️ *[BOT SILENCIOSO - FILTRO ANTI-SPAM]*\nEl mensaje de "${persona.name}" es una conversación personal y no contiene palabras clave de ComandaFast. El bot permanece en silencio.`,
          newState,
          systemNote: true
        };
      }
    }

    // -------------------------------------------------------------
    // 2. SIMULACIÓN DE FOTO DE COMPROBANTE
    // -------------------------------------------------------------
    if (text.includes('[ENVIAR FOTO COMPROBANTE]') || (lower.includes('comprobante') && lower.includes('foto') && !lower.startsWith('foto '))) {
      image = 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80';
      reply = this.interpolateTemplate(settings.template_payment_proof || DEFAULT_TEMPLATES.template_payment_proof, commonVars);
      return { reply, image, newState };
    }

    // -------------------------------------------------------------
    // 3. FOTOS DE HAMBURGUESAS Y COMBOS (SUBIDAS DESDE BD)
    // -------------------------------------------------------------
    if (lower.startsWith('foto') || lower.startsWith('ver foto') || lower === 'fotos') {
      const numIdx = parseInt(lower.replace(/\D/g, ''), 10);
      let target = null;
      if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= prods.length) {
        target = prods[numIdx - 1];
      } else {
        target = prods.find(p => lower.includes(p.name.toLowerCase()));
      }

      if (target) {
        // PRIORIZAR FOTO SUBIDA POR EL USUARIO O DESDE BASE DE DATOS
        image = target.image || target.image_url || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80';
        reply = `🍔 *${target.name}* 🔥\n\n💵 *Precio:* $${Number(target.price).toLocaleString('es-AR')}\n📖 *Detalle:* ${target.description || 'Elaborada en nuestra cocina con ingredientes frescos del día.'}\n${target.modifiers?.length ? '✨ *Modificadores:* ' + target.modifiers.join(', ') + '\n' : ''}\n👉 *Para agregarla a tu comanda respondé con su número (*${prods.indexOf(target) + 1}*) o escribí COMPRAR.*\n👉 Escribí *FOTO [número]* para ver otra hamburguesa.`;
        return { reply, image, newState };
      } else {
        const listText = prods.map((p, i) => {
          const hasCustomPhoto = p.image ? '📸' : '';
          return `${formatItemNumber(i + 1)} *${p.name}* — $${Number(p.price).toLocaleString('es-AR')} ${hasCustomPhoto}`;
        }).join('\n');
        
        image = prods[0]?.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80';
        reply = `📸 *GALERÍA COMPLETA DE COMANDAFAST (${prods.length} productos en BD)* 🍔🔥\n\n${listText}\n\n👉 *Escribí FOTO [número] (ej: FOTO 1, FOTO 2) para ver la foto real de cada una.*`;
        return { reply, image, newState };
      }
    }

    // -------------------------------------------------------------
    // 4. CANCELAR / REINICIAR
    // -------------------------------------------------------------
    if (lower === 'cancelar' || lower === 'reiniciar' || lower === 'salir') {
      newState = {
        step: 'IDLE',
        items: [],
        subtotal: 0,
        total: 0,
        shippingMethod: 'local',
        shippingAddress: '',
        shippingName: persona.name || '',
        paymentMethod: 'efectivo',
        pendingProduct: null
      };
      reply = `❌ *Comanda cancelada.* ¿En qué más podemos ayudarte hoy?\n\n` + this.interpolateTemplate(settings.template_menu || DEFAULT_TEMPLATES.template_menu, commonVars);
      return { reply, newState };
    }

    // -------------------------------------------------------------
    // 4.5. EVALUACIÓN DE FLUJOS PERSONALIZADOS CON CONDICIONES
    // -------------------------------------------------------------
    const activeFlows = this.getCustomFlows().filter(f => f.enabled);
    for (const flow of activeFlows) {
      const cond = flow.condition || {};
      const keywords = (cond.keywords || []).map(k => k.trim().toLowerCase()).filter(Boolean);
      const matchType = cond.type || 'contains_any';
      const scope = cond.scope || 'always';

      if (scope === 'idle_only' && newState.step !== 'IDLE') continue;
      if (scope === 'active_order' && newState.step === 'IDLE') continue;

      let isMatch = false;
      if (matchType === 'exact') {
        isMatch = keywords.some(k => lower === k);
      } else if (matchType === 'starts_with') {
        isMatch = keywords.some(k => lower.startsWith(k));
      } else {
        // contains_any
        isMatch = keywords.some(k => lower.includes(k));
      }

      if (isMatch) {
        const action = flow.action || {};
        reply = this.interpolateTemplate(action.response || '', commonVars);
        if (action.imageUrl) {
          image = action.imageUrl;
        }
        return { reply, image, newState, triggeredFlow: flow };
      }
    }

    // -------------------------------------------------------------
    // 5. MODIFICADORES SOBRE EL ÚLTIMO PRODUCTO (Ej: 'sin cebolla')
    // -------------------------------------------------------------
    if (newState.items.length > 0 && (/sin\s*cebolla|sin\s*tomate|sin\s*pepino|extra\s*cheddar|extra\s*bacon|bien\s*cocida|con\s*mayo/i.test(lower))) {
      const lastItem = newState.items[newState.items.length - 1];
      if (!lastItem.modifiers) lastItem.modifiers = [];

      let modText = '';
      if (/sin\s*cebolla/i.test(lower)) { modText = 'Sin cebolla'; }
      else if (/sin\s*tomate/i.test(lower)) { modText = 'Sin tomate'; }
      else if (/extra\s*cheddar/i.test(lower)) { modText = 'Extra Cheddar (+$800)'; lastItem.price += 800; }
      else if (/extra\s*bacon/i.test(lower)) { modText = 'Extra Bacon (+$900)'; lastItem.price += 900; }
      else if (/bien\s*cocida/i.test(lower)) { modText = 'Bien cocida'; }

      if (modText && !lastItem.modifiers.includes(modText)) {
        lastItem.modifiers.push(modText);
        newState.subtotal = newState.items.reduce((s, it) => s + (it.price * it.quantity), 0);
        newState.total = newState.subtotal;
        
        reply = `✍️ *Anotado para la plancha:* "${modText}" agregado a *${lastItem.name}*.\n\n🛒 *Subtotal:* $${newState.subtotal.toLocaleString('es-AR')}\n\n👉 ¿Querés sumar algo más? *(Escribí el número)*\n👉 O escribí *LISTO* para elegir la entrega y abonar.`;
        return { reply, newState };
      }
    }

    // -------------------------------------------------------------
    // 6. VER CARRITO / QUITAR ITEMS
    // -------------------------------------------------------------
    if (lower === 'carrito' || lower === 'ver comanda' || lower === 'ver pedido') {
      if (newState.items.length === 0) {
        reply = '🛒 Tu comanda está vacía. Escribí *COMPRAR* para ver nuestras hamburguesas disponibles.';
      } else {
        const list = newState.items.map((it, i) => `${formatItemNumber(i + 1)} ${it.name} (x${it.quantity}) - $${(it.price * it.quantity).toLocaleString('es-AR')}${it.modifiers?.length ? ' [' + it.modifiers.join(', ') + ']' : ''}`).join('\n');
        reply = `🛒 *TU COMANDA ACTUAL:* 🍔\n\n${list}\n\n💵 *Subtotal:* $${newState.subtotal.toLocaleString('es-AR')}\n\n👉 Para sumar más, escribí su número.\n👉 Para quitar, escribí *QUITAR [nro]* (ej: QUITAR 1).\n👉 O escribí *LISTO* para avanzar con la entrega.`;
      }
      return { reply, newState };
    }

    if (lower.startsWith('quitar') || lower.startsWith('eliminar')) {
      const num = parseInt(lower.replace(/\D/g, ''), 10);
      if (!isNaN(num) && num >= 1 && num <= newState.items.length) {
        const removed = newState.items.splice(num - 1, 1)[0];
        newState.subtotal = newState.items.reduce((s, it) => s + (it.price * it.quantity), 0);
        newState.total = newState.subtotal;
        const list = newState.items.map((it, i) => `${formatItemNumber(i + 1)} ${it.name} - $${(it.price * it.quantity).toLocaleString('es-AR')}`).join('\n');
        reply = `🗑️ Quitaste *${removed.name}* de la comanda.\n\n🛒 *Comanda restante:*\n${list || 'Vacía'}\n\n💵 *Total:* $${newState.total.toLocaleString('es-AR')}\n\n👉 Escribí otro número o escribí *LISTO* para finalizar.`;
      } else {
        reply = '⚠️ Para quitar un producto escribí *QUITAR 1* o el número correspondiente.';
      }
      return { reply, newState };
    }

    // -------------------------------------------------------------
    // 7. CONSULTA DE ESTADO DE PEDIDO (OPCIÓN 1)
    // -------------------------------------------------------------
    if ((lower === '1' || lower.includes('estado') || lower.includes('mi pedido')) && newState.step === 'IDLE') {
      const activeOrders = storageService.getOrders();
      const userOrder = activeOrders.find(o => 
        (o.phone && o.phone.includes(persona.phone.slice(-6))) || 
        (o.customer && o.customer.toLowerCase().includes(persona.name.toLowerCase().split(' ')[0]))
      ) || (persona.hasActiveOrder ? { id: persona.activeOrderId || 'CMD-7821', status: 'preparing', total: 6800, address: 'Retiro en Local' } : null);

      if (userOrder) {
        const statusMap = {
          pending: '🕒 Ingresado a comanda',
          preparing: '👨‍🍳🔥 En la plancha / Preparando',
          ready: '🔔 Listo para retirar en mostrador',
          shipped: '🛵 En camino con repartidor',
          delivered: '🎉 Entregado'
        };
        const st = statusMap[userOrder.status] || '👨‍🍳 En cocina';
        const vars = {
          ...commonVars,
          pedido_id: (userOrder.id || 'CMD-7821').toUpperCase(),
          estado: st,
          total: Number(userOrder.total || 6800).toLocaleString('es-AR'),
          direccion: userOrder.address || 'Retiro en Mostrador'
        };
        reply = this.interpolateTemplate(settings.menu_response_1 || DEFAULT_TEMPLATES.menu_response_1, vars);
      } else {
        reply = `📋 *Consulta de Pedido:*\nNo encontramos pedidos en cocina asociados a tu número (*${persona.phone}*).\n\n👉 Para pedir unas hamburguesas recién hechas, escribí *COMPRAR*.`;
      }
      return { reply, newState };
    }

    // -------------------------------------------------------------
    // 8. OPCIÓN 2: DATOS BANCARIOS / ALIAS
    // -------------------------------------------------------------
    if ((lower === '2' || lower.includes('alias') || lower.includes('cbu') || lower.includes('transferencia')) && newState.step === 'IDLE') {
      reply = this.interpolateTemplate(settings.menu_response_2 || DEFAULT_TEMPLATES.menu_response_2, commonVars);
      return { reply, newState };
    }

    // -------------------------------------------------------------
    // 9. OPCIÓN 3: UBICACIÓN Y HORARIOS
    // -------------------------------------------------------------
    if ((lower === '3' || lower.includes('horario') || lower.includes('direccion') || lower.includes('donde estan')) && newState.step === 'IDLE') {
      reply = this.interpolateTemplate(settings.menu_response_3 || DEFAULT_TEMPLATES.menu_response_3, commonVars);
      return { reply, newState };
    }

    // -------------------------------------------------------------
    // 10. OPCIÓN 5: ASESOR HUMANO
    // -------------------------------------------------------------
    if ((lower === '5' || lower.includes('humano') || lower.includes('asesor') || lower.includes('encargado')) && newState.step === 'IDLE') {
      reply = this.interpolateTemplate(settings.menu_response_5 || DEFAULT_TEMPLATES.menu_response_5, commonVars);
      return { reply, newState };
    }

    // -------------------------------------------------------------
    // COMANDOS DE NAVEGACIÓN Y PAGINACIÓN DEL MENÚ
    // -------------------------------------------------------------
    if (lower === 'siguiente' || lower === 'sig' || lower === 'mas' || lower === 'ver mas' || lower === 'next' || lower === 'otra pagina') {
      const totalPages = Math.ceil(prods.length / 8) || 1;
      newState.catalogPage = ((newState.catalogPage || 1) % totalPages) + 1;
      reply = this.buildCatalogMessage(prods, newState.catalogPage, 8, false);
      return { reply, newState };
    }

    if (lower === 'anterior' || lower === 'atras' || lower === 'volver' || lower === 'prev') {
      const totalPages = Math.ceil(prods.length / 8) || 1;
      newState.catalogPage = Math.max(1, (newState.catalogPage || 1) - 1);
      reply = this.buildCatalogMessage(prods, newState.catalogPage, 8, false);
      return { reply, newState };
    }

    if (/^(pag|pagina|página)\s*(\d+)$/i.test(lower)) {
      const pageMatch = lower.match(/\d+/);
      const pNum = parseInt(pageMatch[0], 10);
      newState.catalogPage = pNum;
      reply = this.buildCatalogMessage(prods, pNum, 8, false);
      return { reply, newState };
    }

    if (lower === 'ver todo' || lower === 'todo' || lower === 'todas' || lower === 'completa' || lower === 'completo') {
      reply = this.buildCatalogMessage(prods, 1, 8, true);
      return { reply, newState };
    }

    // -------------------------------------------------------------
    // 11. INICIAR COMPRA / MENÚ (OPCIÓN 4 O 'COMPRAR')
    // -------------------------------------------------------------
    if (lower === 'comprar' || lower === 'pedir' || lower === 'quiero pedir' || ((lower === '4' || lower.includes('catalogo') || lower.includes('menu')) && newState.step === 'IDLE')) {
      newState.step = 'SELECTING_PRODUCTS';
      newState.items = [];
      newState.subtotal = 0;
      newState.total = 0;
      newState.catalogPage = 1;

      reply = this.buildCatalogMessage(prods, 1, 8, false);
      image = prods[0]?.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80';
      return { reply, image, newState };
    }

    // -------------------------------------------------------------
    // 12. SELECCIÓN DE PRODUCTOS EN CATÁLOGO
    // -------------------------------------------------------------
    if (newState.step === 'SELECTING_PRODUCTS') {
      if (lower === 'listo' || lower === 'finalizar' || lower === 'pagar' || lower === 'checkout') {
        if (newState.items.length === 0) {
          reply = '⚠️ Tu comanda está vacía. Escribí el *NÚMERO* de la burger que querés o escribí *MENU*.';
          return { reply, newState };
        }
        newState.step = 'ASK_SHIPPING_METHOD';
        reply = `🛵 *¿Cómo querés recibir tu comanda?*\n\nRespondé con el número de opción:\n1️⃣ *Retiro por el local (Take Away)* 🏷️ Sin costo\n2️⃣ *Envío a domicilio con cadete (Delivery)*`;
        return { reply, newState };
      }

      const numIdx = parseInt(lower.replace(/\D/g, ''), 10);
      let selectedProd = null;

      if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= prods.length) {
        selectedProd = prods[numIdx - 1];
      } else {
        selectedProd = prods.find(p => lower.includes(p.name.toLowerCase()));
      }

      if (selectedProd) {
        const itemPrice = selectedProd.price;
        newState.items.push({
          id: selectedProd.id,
          productId: selectedProd.id,
          name: selectedProd.name,
          price: itemPrice,
          quantity: 1,
          modifiers: []
        });

        newState.subtotal = newState.items.reduce((s, it) => s + (it.price * it.quantity), 0);
        newState.total = newState.subtotal;

        const itemsList = newState.items.map(it => `• ${it.name} - $${(it.price * it.quantity).toLocaleString('es-AR')}${it.modifiers?.length ? ' (' + it.modifiers.join(', ') + ')' : ''}`).join('\n');
        
        reply = `✅ *¡Agregaste ${selectedProd.name}!* 🍔 (+$${Number(itemPrice).toLocaleString('es-AR')})\n\n🛒 *Tu comanda actual:*\n${itemsList}\n\n💵 *Subtotal:* $${newState.subtotal.toLocaleString('es-AR')}\n\n👉 ¿Querés sumar algo más? *(Escribí su número)*\n👉 ¿Algún cambio? *(Ej: Sin cebolla, Extra cheddar)*\n👉 O escribí *LISTO* para avanzar con la entrega.`;
        if (selectedProd.image) image = selectedProd.image;
        return { reply, image, newState };
      } else {
        reply = `⚠️ No encontramos esa opción en la carta. Escribí el *NÚMERO* (1 a ${prods.length}) o escribí *LISTO* para avanzar.`;
        return { reply, newState };
      }
    }

    // -------------------------------------------------------------
    // 13. MÉTODO DE ENTREGA (RETIRO / DELIVERY)
    // -------------------------------------------------------------
    if (newState.step === 'ASK_SHIPPING_METHOD') {
      if (lower === '1' || lower.includes('retiro') || lower.includes('local') || lower.includes('take')) {
        newState.shippingMethod = 'local';
        newState.shippingAddress = commonVars.direccion;
        newState.step = 'ASK_NAME';
        reply = '👤 *¿A nombre de quién registramos la comanda?* (Escribí tu nombre y apellido):';
        return { reply, newState };
      } else if (lower === '2' || lower.includes('envio') || lower.includes('delivery') || lower.includes('domicilio')) {
        newState.shippingMethod = 'delivery';
        newState.step = 'ASK_ADDRESS';
        reply = '📍 *Por favor escribí tu dirección exacta y entrecalles para el cadete:*';
        return { reply, newState };
      } else {
        reply = '🛵 Por favor respondé *1* para Retiro en Mostrador o *2* para Envío a Domicilio con cadete.';
        return { reply, newState };
      }
    }

    // -------------------------------------------------------------
    // 14. CAPTURA DE DIRECCIÓN
    // -------------------------------------------------------------
    if (newState.step === 'ASK_ADDRESS') {
      newState.shippingAddress = text;
      newState.step = 'ASK_NAME';
      reply = '👤 *¿A nombre de quién registramos la comanda?* (Escribí tu nombre y apellido):';
      return { reply, newState };
    }

    // -------------------------------------------------------------
    // 15. CAPTURA DE NOMBRE
    // -------------------------------------------------------------
    if (newState.step === 'ASK_NAME') {
      newState.shippingName = text || persona.name;
      newState.step = 'ASK_PAYMENT_METHOD';
      reply = `💳 *¿Cómo preferís abonar tu pedido?*\n\nRespondé con el número:\n1️⃣ *Transferencia Bancaria* (Alias / CBU)\n2️⃣ *Efectivo contra entrega* (Al recibir o retirar)\n3️⃣ *Mercado Pago* (Link directo de pago)`;
      return { reply, newState };
    }

    // -------------------------------------------------------------
    // 16. MÉTODO DE PAGO
    // -------------------------------------------------------------
    if (newState.step === 'ASK_PAYMENT_METHOD') {
      if (lower === '1' || lower.includes('transferencia') || lower.includes('alias')) {
        newState.paymentMethod = 'transferencia';
      } else if (lower === '2' || lower.includes('efectivo') || lower.includes('cash')) {
        newState.paymentMethod = 'efectivo';
      } else {
        newState.paymentMethod = 'mercadopago';
      }

      newState.step = 'CONFIRMING';
      const itemsList = newState.items.map(it => `• ${it.name} (x${it.quantity}) - $${(it.price * it.quantity).toLocaleString('es-AR')}${it.modifiers?.length ? ' [' + it.modifiers.join(', ') + ']' : ''}`).join('\n');
      const payLabel = newState.paymentMethod === 'transferencia' ? '🏦 Transferencia Bancaria' : newState.paymentMethod === 'efectivo' ? '💵 Efectivo contra entrega' : '💳 Mercado Pago';
      const shippingLabel = newState.shippingMethod === 'delivery' ? '🛵 Envío a Domicilio' : '🍔 Retiro en Mostrador';

      reply = `🍔 *RESUMEN DE TU COMANDA* 🔥\n\n🛒 *Items:*\n${itemsList}\n\n🛵 *Entrega:* ${shippingLabel}\n📍 *Dirección:* ${newState.shippingAddress || commonVars.direccion}\n👤 *Cliente:* ${newState.shippingName || persona.name}\n💳 *Forma de Pago:* ${payLabel}\n\n💵 *TOTAL A PAGAR:* $${newState.total.toLocaleString('es-AR')}\n\n¿Está todo perfecto para mandar a la plancha?\n👉 Respondé *SI* para confirmar o *CANCELAR*.`;
      return { reply, newState };
    }

    // -------------------------------------------------------------
    // 17. CONFIRMACIÓN FINAL E INYECCIÓN A COCINA
    // -------------------------------------------------------------
    if (newState.step === 'CONFIRMING') {
      if (lower === 'si' || lower === 'confirmar' || lower === 'dale' || lower === 'sí' || lower === 's' || lower === 'ok') {
        const orderCode = 'CMD-' + Math.floor(1000 + Math.random() * 9000);
        const itemsList = newState.items.map(it => `• ${it.name} (x${it.quantity}) - $${(it.price * it.quantity).toLocaleString('es-AR')}${it.modifiers?.length ? ' [' + it.modifiers.join(', ') + ']' : ''}`).join('\n');

        let confirmMsg = `🎉 *¡PEDIDO #${orderCode} CONFIRMADO Y ENVIADO A COCINA!* 🔥🍔\n\n¡Muchas gracias *${newState.shippingName || persona.name}*, tu comanda ya ingresó al sistema de la plancha!\n\n📋 *Detalle:*\n${itemsList}\n💵 *Total:* $${newState.total.toLocaleString('es-AR')}\n🛵 *Entrega:* ${newState.shippingAddress || 'Retiro en Mostrador'}\n`;

        if (newState.paymentMethod === 'transferencia') {
          confirmMsg += `\n💳 *Datos para Transferencia:*\n• *Alias:* \`${commonVars.alias_banco}\`\n• *Banco:* ${commonVars.banco}\n• *Titular:* ${commonVars.titular}\n• *CBU:* \`${commonVars.cbu}\`\n\n📸 *Por favor enviá una foto o captura del comprobante por aquí para comenzar a cocinar.* 🔥`;
        } else if (newState.paymentMethod === 'efectivo') {
          confirmMsg += `\n💵 *Pago en Efectivo:* Abonás al recibir o retirar en ${commonVars.direccion}. ¡La cocina ya está preparando tu comida! 🔥`;
        } else {
          confirmMsg += `\n💳 *Pago con Mercado Pago:* Podés transferir al Alias \`${commonVars.alias_banco}\`. ¡Muchas gracias!`;
        }

        if (!sandboxMode) {
          generatedOrder = this.injectOrderToPos({
            items: newState.items,
            customer: {
              name: newState.shippingName || persona.name,
              phone: persona.phone,
              address: newState.shippingAddress
            },
            paymentMethod: newState.paymentMethod,
            shippingMethod: newState.shippingMethod
          });
        }

        newState = {
          step: 'IDLE',
          items: [],
          subtotal: 0,
          total: 0,
          shippingMethod: 'local',
          shippingAddress: '',
          shippingName: '',
          paymentMethod: 'efectivo',
          pendingProduct: null
        };

        reply = confirmMsg;
        return { reply, newState, generatedOrder };
      } else {
        newState = {
          step: 'IDLE',
          items: [],
          subtotal: 0,
          total: 0,
          shippingMethod: 'local',
          shippingAddress: '',
          shippingName: '',
          paymentMethod: 'efectivo',
          pendingProduct: null
        };
        reply = '❌ Comanda cancelada. Escribí *MENU* para ver más opciones.';
        return { reply, newState };
      }
    }

    // -------------------------------------------------------------
    // MENÚ PRINCIPAL POR DEFECTO
    // -------------------------------------------------------------
    reply = this.interpolateTemplate(settings.template_menu || DEFAULT_TEMPLATES.template_menu, commonVars);
    return { reply, newState };
  }
};
