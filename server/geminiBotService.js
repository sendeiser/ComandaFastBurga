// =========================================================
// SERVICIO DE INTELIGENCIA ARTIFICIAL CON GOOGLE GEMINI
// Basado en la arquitectura de Candy Shop Chamical para ComandaFast
// =========================================================

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = path.join(process.cwd(), 'data');
const AI_CONFIG_FILE = path.join(DATA_DIR, 'ai_config.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export class GeminiBotService {
  constructor() {
    this.client = null;
    this.config = this.loadConfig();
    this.initClient();
  }

  loadConfig() {
    try {
      if (fs.existsSync(AI_CONFIG_FILE)) {
        const raw = fs.readFileSync(AI_CONFIG_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          enabled: parsed.enabled ?? true,
          model: parsed.model || 'gemini-3.6-flash',
          apiKey: parsed.apiKey || process.env.GEMINI_API_KEY || '',
          systemPrompt: parsed.systemPrompt || ''
        };
      }
    } catch (_) {}

    return {
      enabled: true,
      model: 'gemini-3.6-flash',
      apiKey: process.env.GEMINI_API_KEY || '',
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
    this.initClient();
    return this.getConfigSafe();
  }

  getConfigSafe() {
    return {
      enabled: this.config.enabled,
      model: this.config.model,
      hasApiKey: !!((this.config.apiKey || process.env.GEMINI_API_KEY || '').trim()),
      apiKeyMasked: this.maskApiKey(this.config.apiKey || process.env.GEMINI_API_KEY || ''),
      systemPrompt: this.config.systemPrompt || ''
    };
  }

  maskApiKey(key) {
    if (!key || key.length < 8) return '';
    return key.substring(0, 6) + '...' + key.substring(key.length - 4);
  }

  initClient() {
    const key = (this.config.apiKey || process.env.GEMINI_API_KEY || '').trim();
    if (key && key !== 'MY_GEMINI_API_KEY') {
      try {
        this.client = new GoogleGenAI({ apiKey: key });
      } catch (err) {
        console.warn('[GeminiBot]: Error al inicializar cliente GenAI:', err);
      }
    }
  }

  async testConnection(testKey = null) {
    const keyToUse = (testKey || this.config.apiKey || process.env.GEMINI_API_KEY || '').trim();
    if (!keyToUse) {
      return { success: false, error: 'API Key de Gemini no configurada' };
    }

    const modelsToTry = [this.config.model || 'gemini-3.6-flash', 'gemini-3.5-flash'];

    for (const m of modelsToTry) {
      try {
        const client = new GoogleGenAI({ apiKey: keyToUse });
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

    return { success: false, error: 'No se pudo conectar con los modelos de Gemini. Compruebe la API Key o intente más tarde.' };
  }

  async generateReply(userMessage, context = {}) {
    if (!this.config.enabled) return null;
    const key = (this.config.apiKey || process.env.GEMINI_API_KEY || '').trim();
    if (!key) return null;

    if (!this.client) {
      this.initClient();
    }
    if (!this.client) return null;

    const prods = context.availableProducts || [];
    const productContext = prods.length > 0 
      ? prods.map((p, idx) => `${idx + 1}. *${p.name}* - $${Number(p.price).toLocaleString('es-AR')}: ${p.description || 'Hamburguesa artesanal'}${p.modifiers?.length ? ' (Opciones: ' + p.modifiers.join(', ') + ')' : ''}`).join('\n')
      : 'Hamburguesas clásicas, cheddar, doble carne, papas fritas y bebidas.';

    const defaultPrompt = `Eres el asistente virtual con Inteligencia Artificial de "ComandaFast Burgers" (hamburguesería gourmet artesanal argentina).

Tono y estilo:
- Muy cálido, amigable, buena onda y gastronómico con emojis de hamburguesas y comida (🍔, 🔥, 🍟, 🥤, ✨).
- Respuestas breves, directas y atractivas, ideales para leer rápidamente en WhatsApp (máximo 2 a 3 párrafos cortos).
- Usá formato WhatsApp con asteriscos para *negrita*.
- Hablá en tono argentino cordial (ej: "podés pedir", "te recomiendo", "fijate").

Datos clave del local:
- Ubicación: Av. Belgrano 1234, Centro.
- Horarios: Miércoles a Domingos de 19:30 a 00:30 hs.
- Formas de entrega:
  1️⃣ Retiro por el local (Take Away) sin costo.
  2️⃣ Envío a domicilio con cadete (Delivery).
- Medios de pago: Efectivo al recibir o Transferencia bancaria / Mercado Pago (Alias: comandafast.mp).
- Todas las burgers salen con pan brioche artesanal tostado con manteca y doble medallón de carne smash de 100g de roast beef y tapa de asado.

Menú activo en carta:
${productContext}

Instrucciones de comportamiento:
1. Si el cliente pregunta qué comer, qué le recomendás o qué opciones hay, recomendale 2 o 3 opciones tentadoras con su precio y descripción.
2. Decile con entusiasmo que para pedir cualquiera de las opciones solo tiene que responder con el NÚMERO (1, 2, 3...) o escribir *PEDIR* o *COMPRAR*.
3. Decile que si quiere ver la foto real de cualquier hamburguesa puede escribir *FOTO [número]* (ej: *FOTO 1*).
4. Si preguntan por adicionales (papas, gaseosas, extra cheddar, sin cebolla, etc.), respondé con los detalles y precios.
5. Si saludan o agradecen, sé súper cordial y ponete a disposición para marchar la comida a la plancha.`;

    const systemInstruction = this.config.systemPrompt && this.config.systemPrompt.trim().length > 20
      ? `${this.config.systemPrompt}\n\nMenú activo:\n${productContext}`
      : defaultPrompt;

    const modelsToTry = [this.config.model || 'gemini-3.6-flash', 'gemini-3.5-flash'];

    for (const m of modelsToTry) {
      try {
        const response = await this.client.models.generateContent({
          model: m,
          contents: userMessage,
          config: {
            systemInstruction,
            temperature: 0.7,
          }
        });
        const replyText = response?.text?.trim();
        if (replyText) return replyText;
      } catch (err) {
        console.warn(`[GeminiBot Service Error en ${m}]:`, err?.message || err);
      }
    }

    return null;
  }
}

export const geminiBotService = new GeminiBotService();
