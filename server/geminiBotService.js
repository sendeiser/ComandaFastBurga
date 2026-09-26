// =========================================================
// SERVICIO DE INTELIGENCIA ARTIFICIAL MULTI-PROVEEDOR
// Soporte para Google Gemini, Groq Cloud (Llama 3.3 70B) y DeepSeek (V3)
// Modos: Cascada Automática (Failover entre las 3) o Modo Exclusivo Individual
// =========================================================

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = path.join(process.cwd(), 'data');
const AI_CONFIG_FILE = path.join(DATA_DIR, 'ai_config.json');

const DEFAULT_GEMINI_KEY_1 = Buffer.from('QVEuQWI4Uk42S1pNWmJTTENxMDhNNVVXbVVJdXp3RWdWZkxadVFMdHJJeFJOMnRYdXNCeEE=', 'base64').toString('utf8');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export class GeminiBotService {
  constructor() {
    this.activeProviderInUse = 'Groq';
    this.config = this.loadConfig();
  }

  loadConfig() {
    let parsed = {};
    try {
      if (fs.existsSync(AI_CONFIG_FILE)) {
        const raw = fs.readFileSync(AI_CONFIG_FILE, 'utf-8');
        parsed = JSON.parse(raw) || {};
      }
    } catch (_) {}

    return {
      enabled: parsed.enabled ?? true,
      mode: parsed.mode || 'cascade', // 'cascade' | 'only_groq' | 'only_gemini' | 'only_deepseek'
      groqApiKey: parsed.groqApiKey || process.env.GROQ_API_KEY || '',
      geminiApiKey: parsed.geminiApiKey || parsed.apiKey || process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY_1,
      deepseekApiKey: parsed.deepseekApiKey || process.env.DEEPSEEK_API_KEY || '',
      model: parsed.model || 'gemini-2.0-flash',
      groqModel: parsed.groqModel || 'llama-3.3-70b-versatile',
      deepseekModel: parsed.deepseekModel || 'deepseek-chat',
      systemPrompt: parsed.systemPrompt || ''
    };
  }

  saveConfig(newConfig) {
    if (!newConfig) return this.getConfigSafe();

    // Si viene 'apiKey' genérica, mapear según prefijo
    if (newConfig.apiKey) {
      if (newConfig.apiKey.startsWith('gsk_') && !newConfig.groqApiKey) {
        newConfig.groqApiKey = newConfig.apiKey;
      } else if (newConfig.apiKey.startsWith('sk-') && !newConfig.deepseekApiKey) {
        newConfig.deepseekApiKey = newConfig.apiKey;
      } else if (!newConfig.geminiApiKey) {
        newConfig.geminiApiKey = newConfig.apiKey;
      }
    }

    // Filtrar valores indefinidos y claves enmascaradas con '...' para no pisar claves reales existentes
    const cleanUpdates = {};
    for (const [key, value] of Object.entries(newConfig)) {
      if (value !== undefined) {
        if (typeof value === 'string' && value.includes('...')) {
          continue;
        }
        cleanUpdates[key] = value;
      }
    }

    this.config = { ...this.config, ...cleanUpdates };
    try {
      fs.writeFileSync(AI_CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err) {
      console.error('[AIBot] Error al guardar ai_config.json:', err);
    }
    return this.getConfigSafe();
  }

  getConfigSafe() {
    const groqKey = (this.config.groqApiKey || process.env.GROQ_API_KEY || '').trim();
    const geminiKey = (this.config.geminiApiKey || this.config.apiKey || process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY_1).trim();
    const deepseekKey = (this.config.deepseekApiKey || process.env.DEEPSEEK_API_KEY || '').trim();

    return {
      enabled: this.config.enabled ?? true,
      mode: this.config.mode || 'cascade',
      hasGroq: !!groqKey,
      groqApiKeyMasked: this.maskApiKey(groqKey),
      hasGemini: !!geminiKey,
      geminiApiKeyMasked: this.maskApiKey(geminiKey),
      hasDeepSeek: !!deepseekKey,
      deepseekApiKeyMasked: this.maskApiKey(deepseekKey),
      model: this.config.model || 'gemini-2.0-flash',
      groqModel: this.config.groqModel || 'llama-3.3-70b-versatile',
      deepseekModel: this.config.deepseekModel || 'deepseek-chat',
      activeProviderInUse: this.activeProviderInUse || 'Groq (Llama 3.3)',
      systemPrompt: this.config.systemPrompt || ''
    };
  }

  maskApiKey(key) {
    if (!key || key.length < 8) return '';
    return key.substring(0, 6) + '...' + key.substring(key.length - 4);
  }

  // --- LLAMADAS A APIS EXTERNAS ---

  async callGroq(apiKey, model, systemPrompt, userMessage) {
    const candidateModels = [
      model,
      'qwen/qwen3.8-27b',
      'llama-3.3-70b-versatile',
      'openai/gpt-oss-120b',
      'allam-2-7b'
    ].filter(Boolean);

    let lastErr = null;
    for (const m of candidateModels) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: m,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage }
            ],
            temperature: 0.6,
            max_tokens: 350
          })
        });
        if (res.ok) {
          const data = await res.json();
          const reply = data.choices?.[0]?.message?.content?.trim();
          if (reply) return reply;
        } else {
          const errText = await res.text();
          lastErr = new Error(`Groq (${m}): ${errText}`);
        }
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Groq no pudo procesar la solicitud.');
  }

  async callDeepSeek(apiKey, model, systemPrompt, userMessage) {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.6,
        max_tokens: 350
      })
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DeepSeek API error (${res.status}): ${err}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim();
  }

  async callGemini(apiKey, model, systemPrompt, userMessage) {
    const modelsToTry = [
      model,
      'gemini-3.6-flash',
      'gemini-3.8-flash',
      'gemini-3.5-flash'
    ].filter(Boolean);
    const fullPrompt = `${systemPrompt}\n\nCliente: ${userMessage}`;
    for (const m of modelsToTry) {
      try {
        const client = new GoogleGenAI({ apiKey });
        const response = await client.models.generateContent({
          model: m,
          contents: fullPrompt
        });
        const reply = response?.text?.trim();
        if (reply) return { reply, modelUsed: m };
      } catch (err) {
        console.warn(`[Gemini Error en ${m}]:`, err?.message || err);
      }
    }
    throw new Error('Gemini congestionado o con límite de peticiones superado.');
  }

  // --- TESTS DE CONEXIÓN ---

  async testSingleKey(key) {
    if (!key) return { success: false, error: 'Clave no configurada' };
    const t0 = Date.now();

    if (key.startsWith('gsk_')) {
      try {
        const reply = await this.callGroq(key, this.config.groqModel || 'qwen/qwen3.8-27b', 'Sos un test.', 'Hola, respondé en una palabra: "Conectado"');
        const ms = Date.now() - t0;
        return { success: true, text: reply || 'Conectado', modelUsed: `Groq (Ultrarrápido - ${ms}ms)` };
      } catch (err) {
        return { success: false, error: `Groq error: ${err.message}` };
      }
    }

    if (key.startsWith('sk-')) {
      try {
        const reply = await this.callDeepSeek(key, 'deepseek-chat', 'Sos un test.', 'Hola, respondé en una palabra: "Conectado"');
        const ms = Date.now() - t0;
        return { success: true, text: reply || 'Conectado', modelUsed: `DeepSeek (V3 - ${ms}ms)` };
      } catch (err) {
        return { success: false, error: `DeepSeek error: ${err.message}` };
      }
    }

    try {
      const res = await this.callGemini(key, this.config.model, 'Sos un test.', 'Hola, respondé en una palabra: "Conectado"');
      const ms = Date.now() - t0;
      return { success: true, text: res.reply || 'Conectado', modelUsed: `Gemini (${res.modelUsed} - ${ms}ms)` };
    } catch (err) {
      return { success: false, error: `Gemini error: ${err.message}` };
    }
  }

  async testConnection(target = 'cascade') {
    const groqKey = (this.config.groqApiKey || process.env.GROQ_API_KEY || '').trim();
    const geminiKey = (this.config.geminiApiKey || this.config.apiKey || process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY_1).trim();
    const deepseekKey = (this.config.deepseekApiKey || process.env.DEEPSEEK_API_KEY || '').trim();

    if (target === 'only_groq' || target === 'groq') {
      return this.testSingleKey(groqKey);
    }
    if (target === 'only_gemini' || target === 'gemini') {
      return this.testSingleKey(geminiKey);
    }
    if (target === 'only_deepseek' || target === 'deepseek') {
      return this.testSingleKey(deepseekKey);
    }

    // Probar modo Cascada (las 3)
    let summary = [];
    let anyOk = false;

    if (groqKey) {
      const t0 = Date.now();
      try {
        await this.callGroq(groqKey, this.config.groqModel || 'qwen/qwen3.8-27b', 'test', 'Hola');
        summary.push(`⚡ Groq: ✅ ${Date.now() - t0}ms`);
        anyOk = true;
      } catch (e) {
        summary.push(`⚡ Groq: ❌ Error`);
      }
    } else {
      summary.push(`⚡ Groq: ⚪ Sin clave`);
    }

    if (geminiKey) {
      const t0 = Date.now();
      try {
        const res = await this.callGemini(geminiKey, this.config.model, 'test', 'Hola');
        summary.push(`🔷 Gemini: ✅ ${Date.now() - t0}ms`);
        anyOk = true;
      } catch (e) {
        summary.push(`🔷 Gemini: ❌ Congestión`);
      }
    } else {
      summary.push(`🔷 Gemini: ⚪ Sin clave`);
    }

    if (deepseekKey) {
      const t0 = Date.now();
      try {
        await this.callDeepSeek(deepseekKey, 'deepseek-chat', 'test', 'Hola');
        summary.push(`🐋 DeepSeek: ✅ ${Date.now() - t0}ms`);
        anyOk = true;
      } catch (e) {
        summary.push(`🐋 DeepSeek: ❌ Error`);
      }
    } else {
      summary.push(`🐋 DeepSeek: ⚪ Sin clave`);
    }

    return {
      success: anyOk,
      message: summary.join(' | ')
    };
  }

  // --- GENERACIÓN PRINCIPAL DE RESPUESTA ---

  async generateReply(userMessage, context = {}) {
    if (!this.config.enabled) return null;

    const groqKey = (this.config.groqApiKey || process.env.GROQ_API_KEY || '').trim();
    const geminiKey = (this.config.geminiApiKey || this.config.apiKey || process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY_1).trim();
    const deepseekKey = (this.config.deepseekApiKey || process.env.DEEPSEEK_API_KEY || '').trim();

    if (!groqKey && !geminiKey && !deepseekKey) return null;

    const availableProds = context.availableProducts || [];
    const promoProds = availableProds.filter(p => (p.category || '').toLowerCase() === 'promos');
    const regularProds = availableProds.filter(p => (p.category || '').toLowerCase() !== 'promos');

    const promosSummary = promoProds.length > 0 
      ? promoProds.map((p, idx) => `• [PROMO #${idx + 1}] ${p.name}: $${Number(p.price).toLocaleString('es-AR')}${p.originalPrice ? ` (Antes: $${p.originalPrice.toLocaleString('es-AR')})` : ''}${p.freeShipping ? ' [Incluye Envío Gratis]' : ''} - ${p.description || 'Elaborada artesanalmente'}${p.modifiers?.length ? ` (Modificadores: ${p.modifiers.join(', ')})` : ''}`).join('\n')
      : 'No hay promociones especiales cargadas en este momento.';

    const prodsSummary = regularProds.slice(0, 18).map((p, idx) => 
      `${idx + 1}. ${p.name} ($${Number(p.price).toLocaleString('es-AR')}) - ${p.description || 'Artesanal'}`
    ).join('\n');

    const bInfo = context.businessInfo || {};
    const storeName = (bInfo.nombre_local && bInfo.nombre_local.trim()) ? bInfo.nombre_local.trim() : "Burga's Chamical";
    const address = bInfo.direccion || 'Av. Perón 145 (frente al super x día)';
    const hours = bInfo.horarios || 'Martes a Domingos de 19:30 a 00:30 hs';
    const alias = bInfo.alias_banco || 'Burgachamical.nx';
    const bank = bInfo.banco ? ` (${bInfo.banco})` : '';
    const cbu = bInfo.cbu ? ` | CBU: ${bInfo.cbu}` : '';
    const shipping = bInfo.costo_envio ? ` | Costo de envío: ${bInfo.costo_envio}` : '';
    const welcomeGreeting = bInfo.mensaje_bienvenida || '';

    const activeOrderItems = Array.isArray(context.currentOrder) ? context.currentOrder : [];
    const hasOrder = activeOrderItems.length > 0;
    const currentOrderSummary = hasOrder
      ? activeOrderItems.map(it => `• ${it.name} (x${it.qty || 1}) - $${(it.price * (it.qty || 1)).toLocaleString('es-AR')}`).join('\n')
      : '';

    const systemPrompt = `
Eres el Asistente Virtual Inteligente de "${storeName}" (un local gastronómico artesanal de hamburguesas premium).
Tu objetivo es responder consultas de clientes con calidez, entusiasmo gastronómico y brevedad (estilo WhatsApp, usando emojis pertinentes 🍔🔥).

REGLA CRÍTICA DE IDENTIDAD Y NOMBRE:
El nombre oficial del negocio es SIEMPRE "${storeName}". Está TOTALMENTE PROHIBIDO inventar o usar otro nombre como "ComandaFast Burgers" para referirte al local. Siempre debes presentarte y hablar en nombre de "${storeName}".

${hasOrder ? `
⚠️ ATENCIÓN MÁXIMA - EL CLIENTE YA ESTÁ ARMANDO UN PEDIDO:
El cliente YA TIENE los siguientes productos en su carrito de compras:
${currentOrderSummary}

REGLAS OBLIGATORIAS PARA PEDIDOS EN CURSO:
1. ESTÁ TOTALMENTE PROHIBIDO saludarlo diciendo "¡Hola! Bienvenido a ${storeName}". El cliente NO está saludando, ya fue recibido y está en medio del proceso de compra.
2. Si el cliente dice "sumar", "otro número", "agregar", "otra", "otro" o pregunta opciones, explícale con amabilidad y brevedad que puede responder con el NÚMERO del producto (ej: 1 al 33) o su nombre para sumarlo a su carrito, o escribir *LISTO* para finalizar y elegir la entrega.
3. Si pregunta sobre ingredientes, celíacos o dudas, respóndele concretamente y anímalo a continuar su pedido actual.
` : (welcomeGreeting ? `SALUDO OFICIAL Y BIENVENIDA CONFIGURADA POR EL DUEÑO:
"${welcomeGreeting}"
Cuando un cliente salude por primera vez o diga "hola", "buenas noches", "buen día", etc., salúdalo cordialmente en nombre de "${storeName}" inspirándote en este mensaje, y recuérdale que puede escribir *MENU* para ver la carta o *COMPRAR* para armar su pedido.\n` : '')}

${this.config.systemPrompt ? `INSTRUCCIONES Y DIRECTIVAS ESPECÍFICAS DEL DUEÑO:\n${this.config.systemPrompt}\n` : ''}

INFORMACIÓN DEL LOCAL:
- Nombre del Negocio: ${storeName}
- Dirección / Retiro en Mostrador: ${address}
- Horarios de Cocina y Atención: ${hours}
- Medios de Pago: Transferencias bancarias (Alias: ${alias}${bank}${cbu}), Efectivo al recibir, Mercado Pago.
- Modalidades: Delivery propio en moto y Retiro en Mostrador (Take Away)${shipping}.

PROMOCIONES Y COMBOS ACTIVOS:
${promosSummary}

CARTA DE HAMBURGUESAS Y PRODUCTOS:
${prodsSummary || 'Hamburguesas clásicas, dobles, triples, smash, crispy y opciones veggie.'}

REGLAS DE ATENCIÓN:
1. Si el cliente saluda (hola, buenas noches, etc.), dale la bienvenida cordial en nombre de "${storeName}" y recuérdale que puede escribir *MENU* para ver la carta o *COMPRAR* para pedir.
2. Si el cliente pregunta por promociones, ofertas o qué promos hay, detalle con entusiasmo las PROMOCIONES ACTIVAS mencionadas arriba con sus nombres, precios y agregados, y recuérdale que puede pedirlas respondiendo con el nombre de la promo o *COMPRAR*.
3. Si el cliente pregunta qué comer, qué le recomendás o qué opciones hay, recomendale 2 o 3 opciones tentadoras con su precio y descripción real.
4. Si pregunta por ingredientes, celíacos o vegetarianos, sé honesto y empático mencionando lo que tenemos.
5. Si el cliente quiere hacer un pedido o ver fotos, recordale que puede escribir "COMPRAR", "MENU", "PROMOS" o "FOTO [número]".
6. Respuestas concisas y atractivas (máximo 2 a 4 párrafos cortos). No des discursos largos.
7. TERMINOLOGÍA OBLIGATORIA: Usa SIEMPRE la palabra "pedido" o "pedidos". Está TERMINANTEMENTE PROHIBIDO usar la palabra "comanda" con el cliente (la palabra comanda es exclusivamente de uso técnico interno para la cocina). Habla siempre de "tu pedido", "armar tu pedido", "confirmar tu pedido", "seguir tu pedido".

Cliente: ${context.customerName || 'Cliente'}
    `.trim();

    const mode = this.config.mode || 'cascade';

    // Ejecutores individuales
    const execGroq = async () => {
      if (!groqKey) return null;
      const reply = await this.callGroq(groqKey, this.config.groqModel || 'llama-3.3-70b-versatile', systemPrompt, userMessage);
      if (reply) {
        this.activeProviderInUse = 'Groq (Llama 3.3)';
        return reply;
      }
      return null;
    };

    const execGemini = async () => {
      if (!geminiKey) return null;
      const res = await this.callGemini(geminiKey, this.config.model, systemPrompt, userMessage);
      if (res?.reply) {
        this.activeProviderInUse = `Gemini (${res.modelUsed})`;
        return res.reply;
      }
      return null;
    };

    const execDeepSeek = async () => {
      if (!deepseekKey) return null;
      const reply = await this.callDeepSeek(deepseekKey, this.config.deepseekModel || 'deepseek-chat', systemPrompt, userMessage);
      if (reply) {
        this.activeProviderInUse = 'DeepSeek (V3)';
        return reply;
      }
      return null;
    };

    // 1. MODO SOLO GROQ
    if (mode === 'only_groq') {
      try {
        return await execGroq();
      } catch (err) {
        console.warn('❌ [IA SOLO GROQ ERROR]:', err.message);
        return null;
      }
    }

    // 2. MODO SOLO GEMINI
    if (mode === 'only_gemini') {
      try {
        return await execGemini();
      } catch (err) {
        console.warn('❌ [IA SOLO GEMINI ERROR]:', err.message);
        return null;
      }
    }

    // 3. MODO SOLO DEEPSEEK
    if (mode === 'only_deepseek') {
      try {
        return await execDeepSeek();
      } catch (err) {
        console.warn('❌ [IA SOLO DEEPSEEK ERROR]:', err.message);
        return null;
      }
    }

    // 4. MODO CASCADA INTELIGENTE (Failover automático: Groq -> Gemini -> DeepSeek)
    const pipeline = [
      { name: 'Groq (Llama 3.3)', fn: execGroq },
      { name: 'Google Gemini', fn: execGemini },
      { name: 'DeepSeek (V3)', fn: execDeepSeek }
    ];

    for (const provider of pipeline) {
      try {
        const reply = await provider.fn();
        if (reply) {
          console.log(`🤖 [IA RESPUESTA ENTREGADA]: Resuelto vía ${provider.name}.`);
          return reply;
        }
      } catch (err) {
        console.warn(`⚠️ [IA CASCADA]: ${provider.name} no disponible (${err.message}). Saltando al siguiente proveedor...`);
      }
    }

    return null;
  }
}

export const geminiBotService = new GeminiBotService();
