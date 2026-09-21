// =========================================================
// SERVICIO DE INTELIGENCIA ARTIFICIAL CON GOOGLE GEMINI
// Basado en la arquitectura de Candy Shop Chamical para ComandaFast
// Con soporte para API Key Primaria + Secundaria (Auto-Failover / Respaldo)
// =========================================================

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = path.join(process.cwd(), 'data');
const AI_CONFIG_FILE = path.join(DATA_DIR, 'ai_config.json');

const DEFAULT_GEMINI_KEY_1 = Buffer.from('QVEuQWI4Uk42S2wyVXEzaEtEUjZubnljV3BTc1l4SjJGbXhWUTRDQVg5TjhxbFVZaDVkR0E=', 'base64').toString('utf8');
const DEFAULT_GEMINI_KEY_2 = Buffer.from('QVEuQWI4Uk42S1pNWmJTTENxMDhNNVVXbVVJdXp3RWdWZkxadVFMdHJJeFJOMnRYdXNCeEE=', 'base64').toString('utf8');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export class GeminiBotService {
  constructor() {
    this.activeKeyInUse = 'primary';
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(AI_CONFIG_FILE)) {
        const raw = fs.readFileSync(AI_CONFIG_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          enabled: parsed.enabled ?? true,
          model: parsed.model || 'gemini-3.6-flash',
          apiKey: parsed.apiKey || process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY_1,
          secondaryApiKey: parsed.secondaryApiKey || process.env.GEMINI_SECONDARY_API_KEY || DEFAULT_GEMINI_KEY_2,
          systemPrompt: parsed.systemPrompt || ''
        };
      }
    } catch (_) {}

    return {
      enabled: true,
      model: 'gemini-3.6-flash',
      apiKey: process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY_1,
      secondaryApiKey: process.env.GEMINI_SECONDARY_API_KEY || DEFAULT_GEMINI_KEY_2,
      systemPrompt: ''
    };
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      fs.writeFileSync(AI_CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err) {
      console.error('[GeminiBot] Error al guardar ai_config.json:', err);
    }
    return this.getConfigSafe();
  }

  getConfigSafe() {
    const key1 = (this.config.apiKey || process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY_1).trim();
    const key2 = (this.config.secondaryApiKey || process.env.GEMINI_SECONDARY_API_KEY || DEFAULT_GEMINI_KEY_2).trim();
    return {
      enabled: this.config.enabled,
      model: this.config.model,
      hasApiKey: !!key1,
      apiKeyMasked: this.maskApiKey(key1),
      hasSecondaryApiKey: !!key2,
      secondaryApiKeyMasked: this.maskApiKey(key2),
      activeKeyInUse: this.activeKeyInUse || 'primary',
      systemPrompt: this.config.systemPrompt || ''
    };
  }

  maskApiKey(key) {
    if (!key || key.length < 8) return '';
    return key.substring(0, 6) + '...' + key.substring(key.length - 4);
  }

  async testSingleKey(key) {
    if (!key) return { success: false, error: 'Clave no configurada' };
    const modelsToTry = [this.config.model || 'gemini-3.6-flash', 'gemini-3.5-flash'];
    for (const m of modelsToTry) {
      try {
        const client = new GoogleGenAI({ apiKey: key });
        const response = await client.models.generateContent({
          model: m,
          contents: 'Hola, respondé en una sola palabra: "Conectado"'
        });
        const replyText = response?.text?.trim() || 'Conectado';
        return { success: true, text: replyText, modelUsed: m };
      } catch (err) {
        console.warn(`[GeminiBot Test Error en ${m}]:`, err?.message || err);
      }
    }
    return { success: false, error: 'No se pudo conectar con los modelos de Gemini.' };
  }

  async testConnection(testKey = null) {
    if (testKey) {
      return this.testSingleKey(testKey);
    }

    const key1 = (this.config.apiKey || process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY_1).trim();
    const key2 = (this.config.secondaryApiKey || process.env.GEMINI_SECONDARY_API_KEY || DEFAULT_GEMINI_KEY_2).trim();

    const res1 = await this.testSingleKey(key1);
    let res2 = { success: false, error: 'No configurada' };
    if (key2) {
      res2 = await this.testSingleKey(key2);
    }

    let summaryMsg = '';
    if (res1.success && res2.success) {
      summaryMsg = `✅ ¡Ambas claves conectadas con éxito! (Primaria: ${res1.modelUsed} | Secundaria: ${res2.modelUsed})`;
    } else if (res1.success) {
      summaryMsg = `✅ Clave Primaria conectada con éxito (${res1.modelUsed}). Secundaria: ${res2.error || 'No disponible'}.`;
    } else if (res2.success) {
      summaryMsg = `⚠️ Clave Primaria con error, pero Secundaria de respaldo conectada (${res2.modelUsed}). El auto-failover está listo.`;
    } else {
      summaryMsg = `❌ No se pudo conectar ninguna de las dos claves.`;
    }

    return {
      success: res1.success || res2.success,
      primary: res1,
      secondary: res2,
      modelUsed: res1.modelUsed || res2.modelUsed,
      message: summaryMsg
    };
  }

  async generateReply(userMessage, context = {}) {
    if (!this.config.enabled) return null;
    const key1 = (this.config.apiKey || process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY_1).trim();
    const key2 = (this.config.secondaryApiKey || process.env.GEMINI_SECONDARY_API_KEY || DEFAULT_GEMINI_KEY_2).trim();
    if (!key1 && !key2) return null;

    const availableProds = context.availableProducts || [];
    const prodsSummary = availableProds.slice(0, 15).map((p, idx) => 
      `${idx + 1}. ${p.name} ($${Number(p.price).toLocaleString('es-AR')}) - ${p.description || 'Artesanal'}`
    ).join('\n');

    const promptText = `
Eres el Asistente Virtual Inteligente de "ComandaFast Burgers" (una hamburguesería artesanal premium).
Tu objetivo es responder consultas de clientes con calidez, entusiasmo gastronómico y brevedad (estilo WhatsApp, usando emojis pertinentes 🍔🔥).

${this.config.systemPrompt ? `Instrucciones del dueño:\n${this.config.systemPrompt}\n` : ''}

INFORMACIÓN DEL LOCAL:
- Dirección: Av. Belgrano 1234, Centro
- Horarios: Miércoles a Domingos de 19:30 a 00:30 hs.
- Pago: Transferencias bancarias (Alias: comandafast.mp), Efectivo al recibir, Mercado Pago.
- Delivery: Propio en moto y Retiro en Mostrador (Take Away).

CARTA ACTUAL DE HAMBURGUESAS:
${prodsSummary || 'Hamburguesas clásicas, dobles, triples, smash, crispy y opciones veggie.'}

REGLAS DE ATENCIÓN:
1. Si el cliente pregunta qué comer, qué le recomendás o qué opciones hay, recomendale 2 o 3 opciones tentadoras con su precio y descripción.
2. Si pregunta por ingredientes, celíacos o vegetarianos, sé honesto y empático mencionando lo que tenemos.
3. Si el cliente quiere hacer un pedido o ver fotos, recordale que puede escribir "COMPRAR", "MENU" o "FOTO [número]".
4. Respuestas concisas (máximo 2 a 4 párrafos cortos). No des discursos largos.

Cliente: ${context.customerName || 'Cliente'}
Mensaje del cliente: "${userMessage}"
    `.trim();

    const modelsToTry = [this.config.model || 'gemini-3.6-flash', 'gemini-3.5-flash'];

    // 1. Intento con Clave Primaria
    if (key1) {
      for (const m of modelsToTry) {
        try {
          const client = new GoogleGenAI({ apiKey: key1 });
          const response = await client.models.generateContent({
            model: m,
            contents: promptText
          });
          const reply = response?.text?.trim();
          if (reply) {
            this.activeKeyInUse = 'primary';
            return reply;
          }
        } catch (err) {
          console.warn(`[GeminiBot Primary Error en ${m}]:`, err?.message || err);
        }
      }
    }

    // 2. Failover automático a Clave Secundaria de Respaldo
    if (key2 && key2 !== key1) {
      console.warn(`🛡️ [GeminiBot FAILOVER]: Clave primaria no disponible o con límite superado. Activando Clave Secundaria de Respaldo...`);
      for (const m of modelsToTry) {
        try {
          const client = new GoogleGenAI({ apiKey: key2 });
          const response = await client.models.generateContent({
            model: m,
            contents: promptText
          });
          const reply = response?.text?.trim();
          if (reply) {
            this.activeKeyInUse = 'secondary';
            console.log(`✅ [GeminiBot FAILOVER EXITOSO]: Respuesta generada con clave secundaria usando ${m}.`);
            return reply;
          }
        } catch (err) {
          console.warn(`[GeminiBot Secondary Error en ${m}]:`, err?.message || err);
        }
      }
    }

    return null;
  }
}

export const geminiBotService = new GeminiBotService();
