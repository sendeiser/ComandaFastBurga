// =========================================================
// WHATSAPP BOT SERVER (Node.js & Baileys Multi-Device)
// Conexión real 24/7 con WhatsApp Web oficial (Cero Costos de API)
// Sincronización de Base de Datos y Envío de Fotos Reales de Productos
// Flujo Completo de Pedidos (Retiro en Local y Delivery) e Inyección al POS
// =========================================================

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import QRCode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import pino from 'pino';
import { geminiBotService } from './geminiBotService.js';
import { botUpdateService } from './botUpdateService.js';
import makeWASocket, { 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion, 
  makeCacheableSignalKeyStore,
  DisconnectReason, 
  Browsers,
  downloadMediaMessage 
} from '@whiskeysockets/baileys';

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' })); // Para recibir fotos en Base64 sin problemas

process.on('uncaughtException', (err) => {
  console.error('⚠️ [WHATSAPP BOT - UNCAUGHT EXCEPTION]:', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.warn('⚠️ [WHATSAPP BOT - UNHANDLED REJECTION]:', reason?.message || reason);
});

const PORT = 3002;


const DATA_DIR = path.join(process.cwd(), 'data');
const AUTH_DIR = path.join(DATA_DIR, 'baileys_auth');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const CASH_SHIFT_FILE = path.join(DATA_DIR, 'cash_shift.json');
const FLOWS_FILE = path.join(DATA_DIR, 'custom_flows.json');
const VARIABLES_FILE = path.join(DATA_DIR, 'bot_variables.json');
const TEMPLATES_FILE = path.join(DATA_DIR, 'bot_templates.json');

// =========================================================
// SUPABASE CLOUD INTEGRATION (Push directo a la nube)
// =========================================================
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://yqynuvjpipmvurualgtg.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxeW51dmpwaXBtdnVydWFsZ3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MzMyOTgsImV4cCI6MjEwNTUwOTI5OH0.mLO52rFPD384yQHdGlBasrx4QvqXiHYH3zRmJ9Bq2go';

// Registro de marcas de tiempo para sincronización bidireccional y hot-reload desde la nube
const cloudConfigTimestamps = {
  variables: null,
  templates: null,
  flows: null,
  ai_config: null,
  products: null,
  product_images: null
};

async function pushOrderToSupabase(order) {
  try {
    const customerObj = typeof order.customer === 'object' && order.customer
      ? order.customer
      : { name: order.customer || 'Cliente' };

    const body = JSON.stringify({
      id: order.id,
      order_number: Number(order.orderNumber) || 1,
      channel: order.channel || 'mostrador',
      table_number: order.tableNumber || '',
      customer: customerObj,
      items: Array.isArray(order.items) ? order.items : [],
      subtotal: Number(order.subtotal || order.total) || 0,
      delivery_fee: Number(order.deliveryFee) || 0,
      total: Number(order.total) || 0,
      payment_method: order.paymentMethod || 'efectivo',
      cash_paid: order.cashPaid || null,
      cash_change: order.cashChange || null,
      transfer_proof: order.transferProof || null,
      transfer_confirmed: Boolean(order.transferConfirmed),
      status: order.status || 'pendiente',
      status_timestamps: order.statusTimestamps || {},
      created_at: order.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body
    });
    if (res.ok || res.status === 201) {
      console.log(`[SUPABASE] Pedido ${order.id} sincronizado a la nube.`);
    } else {
      const err = await res.text();
      console.warn(`[SUPABASE] Error al subir pedido ${order.id}:`, err);
    }
  } catch (e) {
    console.warn('[SUPABASE] pushOrderToSupabase error:', e.message);
  }
}

async function updateOrderStatusInSupabase(orderId, status) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status, updated_at: new Date().toISOString() })
    });
  } catch (e) {
    console.warn('[SUPABASE] updateOrderStatusInSupabase error:', e.message);
  }
}

async function pushBotConfigToSupabase(key, data) {
  try {
    const updatedAt = new Date().toISOString();
    cloudConfigTimestamps[key] = updatedAt;
    await fetch(`${SUPABASE_URL}/rest/v1/bot_config`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: key,
        data,
        updated_at: updatedAt
      })
    });
    if (key !== 'server_status') {
      console.log(`[SUPABASE] Bot config '${key}' sincronizado a la nube.`);
    }
  } catch (e) {
    if (key !== 'server_status') {
      console.warn(`[SUPABASE] pushBotConfigToSupabase '${key}' error:`, e.message);
    }
  }
}

async function fetchBotConfigFromSupabase(key) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bot_config?id=eq.${key}&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        if (rows[0].updated_at) {
          cloudConfigTimestamps[key] = rows[0].updated_at;
        }
        return rows[0].data;
      }
    }
  } catch (e) {
    console.warn(`[SUPABASE] fetchBotConfigFromSupabase '${key}' error:`, e.message);
  }
  return null;
}

// Sincronización completa de productos y fotos reales desde Supabase
async function syncAllProductsFromCloud() {
  try {
    const [resProds, resImages] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/products?select=*&order=name.asc`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }),
      fetch(`${SUPABASE_URL}/rest/v1/system_settings?id=eq.product_images&select=id,data,updated_at`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      })
    ]);

    if (resProds.ok) {
      const cloudProds = await resProds.json();
      let imagesMap = {};
      if (resImages.ok) {
        const imgRows = await resImages.json();
        if (Array.isArray(imgRows) && imgRows.length > 0) {
          imagesMap = imgRows[0].data || {};
          if (imgRows[0].updated_at) {
            cloudConfigTimestamps.product_images = imgRows[0].updated_at;
          }
        }
      }

      if (Array.isArray(cloudProds) && cloudProds.length > 0) {
        let latestProdTime = '';
        cloudProds.forEach(p => {
          if (p.updated_at && (!latestProdTime || p.updated_at > latestProdTime)) {
            latestProdTime = p.updated_at;
          }
        });
        if (latestProdTime) cloudConfigTimestamps.products = latestProdTime;

        const mergedProds = cloudProds
          .filter(p => p && p.is_active !== false)
          .sort((a, b) => {
            const isPromoA = (a.category || '').toLowerCase() === 'promos' ? 0 : 1;
            const isPromoB = (b.category || '').toLowerCase() === 'promos' ? 0 : 1;
            if (isPromoA !== isPromoB) return isPromoA - isPromoB;
            return (a.name || '').localeCompare(b.name || '');
          })
          .map(p => {
            const img = p.image || imagesMap[p.id] || '';
            return {
              id: p.id,
              name: p.name,
              category: p.category || 'Hamburguesas',
              price: Number(p.price) || 0,
              originalPrice: p.originalPrice || p.original_price ? Number(p.originalPrice || p.original_price) : null,
              discountBadge: p.discountBadge || p.discount_badge || null,
              freeShipping: Boolean(p.freeShipping || p.free_shipping),
              emoji: p.emoji || '🍔',
              description: p.description || '',
              modifiers: Array.isArray(p.modifiers) ? p.modifiers : [],
              image: img
            };
          });

        fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(mergedProds, null, 2), 'utf-8');
        const countWithPhotos = mergedProds.filter(p => p.image).length;
        console.log(`✅ [SUPABASE] Catálogo de productos sincronizado: ${mergedProds.length} productos (${countWithPhotos} con fotos reales).`);
        return mergedProds;
      }
    }
  } catch (prodErr) {
    console.warn('[SUPABASE] Error descargando productos y fotos:', prodErr.message);
  }
  return null;
}

// Sincronización completa inicial desde Supabase Cloud al arrancar el bot
async function syncAllFromSupabaseCloud() {
  console.log('☁️ [SUPABASE CLOUD SYNC] Sincronizando datos frescos del Bot desde Supabase Cloud...');
  try {
    const resConfig = await fetch(`${SUPABASE_URL}/rest/v1/bot_config?select=id,data,updated_at`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (resConfig.ok) {
      const configRows = await resConfig.json();
      if (Array.isArray(configRows)) {
        for (const row of configRows) {
          if (!row || !row.id) continue;
          cloudConfigTimestamps[row.id] = row.updated_at;

          if (row.id === 'variables' && Array.isArray(row.data) && row.data.length > 0) {
            saveBotVariables(row.data);
            console.log(`✅ [SUPABASE] Variables del bot sincronizadas: ${row.data.length} variables.`);
          } else if (row.id === 'flows' && Array.isArray(row.data) && row.data.length > 0) {
            saveStoredFlows(row.data);
            console.log(`✅ [SUPABASE] Flujos conversacionales sincronizados: ${row.data.length} flujos.`);
          } else if (row.id === 'templates' && row.data && typeof row.data === 'object') {
            saveBotTemplates(row.data);
            console.log(`✅ [SUPABASE] Seguridad Anti-Spam y Plantillas sincronizadas (Anti-Bucle: ${row.data.anti_loop_enabled !== false ? 'ACTIVO' : 'INACTIVO'}, Delay: ${row.data.bot_typing_delay_ms || 2500}ms, Pausa Humano: ${row.data.human_mode_sleep_minutes || 25}min).`);
          } else if (row.id === 'ai_config' && row.data && typeof row.data === 'object') {
            geminiBotService.saveConfig(row.data);
            console.log(`✅ [SUPABASE] Configuración de IA sincronizada (Modo: ${row.data.mode || 'cascade'}).`);
          }
        }
      }
    }

    // Descargar catálogo y fotos de productos
    await syncAllProductsFromCloud();
  } catch (err) {
    console.warn('⚠️ [SUPABASE] No se pudo completar la sincronización inicial con la nube, usando almacenamiento local:', err.message);
  }
}

// =========================================================
// HOT-RELOAD DINÁMICO EN TIEMPO REAL DESDE SUPABASE CLOUD
// Detecta cualquier cambio de configuración realizado en la nube
// (Variables, Seguridad Anti-Spam, Plantillas, IA, Flujos, Productos)
// y lo aplica de inmediato en el Bot en ejecución sin reiniciar
// =========================================================
let isSyncingCloudConfig = false;

async function syncCloudConfigChanges() {
  if (isSyncingCloudConfig) return;
  isSyncingCloudConfig = true;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bot_config?select=id,updated_at`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows)) {
        for (const row of rows) {
          const { id, updated_at } = row;
          if (!id || !updated_at || id === 'server_status' || id === 'server_commands') continue;

          if (!cloudConfigTimestamps[id]) {
            cloudConfigTimestamps[id] = updated_at;
            continue;
          }

          const cloudTime = new Date(updated_at).getTime();
          const localTime = new Date(cloudConfigTimestamps[id]).getTime();

          // Si el timestamp en la nube es más nuevo por más de 1.5s
          if (cloudTime > localTime + 1500) {
            console.log(`☁️ [SUPABASE CLOUD]: Cambio detectado en '${id}' (${updated_at}). Descargando configuración en vivo...`);
            const cloudData = await fetchBotConfigFromSupabase(id);
            if (cloudData) {
              if (id === 'variables' && Array.isArray(cloudData)) {
                saveBotVariables(cloudData);
                cloudConfigTimestamps.variables = updated_at;
                console.log(`✅ [SUPABASE CLOUD]: Variables del bot actualizadas automáticamente desde la nube (${cloudData.length} variables).`);
              } else if (id === 'templates' && typeof cloudData === 'object') {
                saveBotTemplates(cloudData);
                cloudConfigTimestamps.templates = updated_at;
                console.log(`✅ [SUPABASE CLOUD]: Seguridad Anti-Spam y Plantillas actualizadas desde la nube (Delay: ${cloudData.bot_typing_delay_ms || 2500}ms, Anti-Bucle: ${cloudData.anti_loop_enabled !== false ? 'ACTIVO' : 'INACTIVO'}, Pausa humana: ${cloudData.human_mode_sleep_minutes || 25}min).`);
              } else if (id === 'flows' && Array.isArray(cloudData)) {
                saveStoredFlows(cloudData);
                cloudConfigTimestamps.flows = updated_at;
                console.log(`✅ [SUPABASE CLOUD]: Flujos conversacionales actualizados desde la nube (${cloudData.length} flujos).`);
              } else if (id === 'ai_config' && typeof cloudData === 'object') {
                geminiBotService.saveConfig(cloudData);
                cloudConfigTimestamps.ai_config = updated_at;
                console.log(`✅ [SUPABASE CLOUD]: Configuración de IA actualizada desde la nube (Modo: ${cloudData.mode || 'cascade'}).`);
              }
            }
          }
        }
      }
    }

    // Revisar cambios en catálogo de productos o fotos
    try {
      const resLatestProd = await fetch(`${SUPABASE_URL}/rest/v1/products?select=updated_at&order=updated_at.desc&limit=1`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (resLatestProd.ok) {
        const pRows = await resLatestProd.json();
        if (Array.isArray(pRows) && pRows.length > 0 && pRows[0].updated_at) {
          const latestTime = new Date(pRows[0].updated_at).getTime();
          const knownTime = cloudConfigTimestamps.products ? new Date(cloudConfigTimestamps.products).getTime() : 0;
          if (latestTime > knownTime + 1500) {
            console.log(`☁️ [SUPABASE CLOUD]: Cambio detectado en catálogo de productos. Sincronizando con WhatsApp...`);
            await syncAllProductsFromCloud();
          }
        }
      }
    } catch (_) {}

  } catch (err) {
    // Red temporalmente inaccesible
  } finally {
    isSyncingCloudConfig = false;
  }
}

// Polling de sincronización en tiempo real desde Supabase Cloud cada 12 segundos
setInterval(syncCloudConfigChanges, 12000);

async function deleteOrderFromSupabase(orderId) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
  } catch (e) {
    console.warn('[SUPABASE] deleteOrderFromSupabase error:', e.message);
  }
}

const DEFAULT_SERVER_FLOWS = [
  {
    id: 'flow-promos',
    name: 'Promociones y 2x1',
    category: 'promociones',
    enabled: true,
    priority: 10,
    condition: {
      type: 'contains_any',
      keywords: ['promo', 'promos', 'promocion', 'promoción', '2x1', 'descuento', 'oferta', 'combos'],
      scope: 'always'
    },
    action: {
      type: 'reply_text',
      response: `🎉 *¡PROMOS ACTIVAS EN COMANDAFAST!* 🔥🍔\n\n• 🍔 *2x1 Smash Clásica:* Todos los miércoles y jueves con papas incluidas.\n• 👨‍👩‍👧‍👦 *Combo Cuadrilla:* 4 Dobles Cheeseburgers + 2 Papas Grandes por solo *$18.500*.\n• 🍻 *Happy Hour Cerveza:* 2x1 de 19:30 a 21:00 hs en el local.\n\n👉 *¿Querés pedir una promo?* Respondé con la palabra *COMPRAR* o consultá la carta con *MENU*.`,
      imageUrl: '',
      suggestedChips: ['Ver Menú', 'Comprar', 'Horarios']
    }
  },
  {
    id: 'flow-sintacc',
    name: 'Opciones Celíacos / Sin TACC',
    category: 'dietas',
    enabled: true,
    priority: 9,
    condition: {
      type: 'contains_any',
      keywords: ['tacc', 'sin tacc', 'celiaco', 'celiaca', 'celíaco', 'celíaca', 'gluten', 'libre de gluten'],
      scope: 'always'
    },
    action: {
      type: 'reply_text',
      response: `🌾 *OPCIONES SIN TACC / APTAS CELÍACOS* 🍔✨\n\nContamos con:\n• 🍞 *Pan artesanal libre de gluten* certificado para cualquier burger de nuestra carta (+$800).\n• 🍟 *Papas fritas clásicas* cocinadas en freidora exclusiva sin contaminación cruzada.\n• 🧀 Medallones de carne 100% vacuna condimentados únicamente con sal y pimienta.\n\n⚠️ _Por favor indicale al cocinero en las notas si tenés celiaquía severa para extremar los cuidados de sanitización de plancha._`,
      imageUrl: '',
      suggestedChips: ['Ver Carta', 'Comprar', 'Hablar con Encargado']
    }
  },
  {
    id: 'flow-veggie',
    name: 'Opciones Vegetarianas & Veggie',
    category: 'dietas',
    enabled: true,
    priority: 8,
    condition: {
      type: 'contains_any',
      keywords: ['vegano', 'vegana', 'vegetariano', 'vegetariana', 'veggie', 'vegan', 'sin carne', 'medallon vegetal'],
      scope: 'always'
    },
    action: {
      type: 'reply_text',
      response: `🌱 *OPCIONES VEGETARIANAS Y VEGGIES* 🥑🍔\n\n• 🍔 *Veggie Smash Burger:* Medallón a base de legumbres y hongos portobello, cebolla caramelizada, rúcula fresca y queso provoleta.\n• 🧀 Podés reemplazar el medallón de carne de cualquiera de nuestras burgers por nuestra opción veggie artesanal.\n• 🍟 Papas clásicas, aros de cebolla y aderezos especiales sin derivados cárnicos.\n\n👉 Respondé con *MENU* para ver todos los precios o *COMPRAR* para pedirla.`,
      imageUrl: '',
      suggestedChips: ['Ver Menú', 'Comprar', 'Consultar']
    }
  },
  {
    id: 'flow-cumples',
    name: 'Cumpleaños y Eventos',
    category: 'eventos',
    enabled: true,
    priority: 7,
    condition: {
      type: 'contains_any',
      keywords: ['cumple', 'cumpleaños', 'evento', 'fiesta', 'festejo', 'reserva', 'mesas', 'grupo', 'agasajo'],
      scope: 'always'
    },
    action: {
      type: 'reply_text',
      response: `🎉🎂 *¡FESTEJÁ TU CUMPLEAÑOS EN COMANDAFAST!* 🍔🍻\n\nBeneficios exclusivos para grupos:\n• 🎁 *El cumpleañero come GRATIS* viniendo con 4 o más amigos (burger simple + bebida).\n• 🍰 Podés traer tu propia torta y nosotros te facilitamos platos y cubiertos sin costo.\n• 🎈 Armamos sector reservado para grupos de 10 personas o más.\n\n👉 Para coordinar tu reserva o evento especial, respondé *RESERVA* y te contactará nuestro encargado de salón.`,
      imageUrl: '',
      suggestedChips: ['Reservar Mesa', 'Ver Menú', 'Horarios']
    }
  },
  {
    id: 'flow-delivery-info',
    name: 'Zonas de Envío y Tiempos de Cadete',
    category: 'envios',
    enabled: true,
    priority: 6,
    condition: {
      type: 'contains_any',
      keywords: ['zona', 'zonas', 'envio', 'envío', 'costo envio', 'cadete', 'demora', 'cuanto tarda', 'cobertura', 'llega'],
      scope: 'always'
    },
    action: {
      type: 'reply_text',
      response: `🛵 *INFORMACIÓN DE DELIVERY & ENVÍOS* 📍\n\n• 📍 *Zona de cobertura:* Radio de hasta 6 km desde nuestro local en Av. Belgrano 1234, Centro.\n• ⏱️ *Tiempo promedio de despacho:* 30 a 45 minutos según demanda de cocina.\n• 💵 *Costo de envío:* Tarifa plana accesible para todo el casco urbano.\n• 🛍️ *Take Away:* También podés retirar por mostrador sin ningún costo extra.\n\n👉 ¿Querés pedir ahora? Escribí *COMPRAR* o *MENU* para empezar.`,
      imageUrl: '',
      suggestedChips: ['Hacer Pedido', 'Ver Carta', 'Ubicación']
    }
  },
  {
    id: 'flow-humano',
    name: 'Atención con Encargado Humano',
    category: 'atencion',
    enabled: true,
    priority: 5,
    condition: {
      type: 'contains_any',
      keywords: ['humano', 'persona', 'encargado', 'dueño', 'queja', 'reclamo', 'problema', 'hablar con alguien', 'operador'],
      scope: 'always'
    },
    action: {
      type: 'reply_text',
      response: `👤 *DERIVACIÓN A ATENCIÓN HUMANA* 🔔\n\n¡Entendido! Ya notificamos a nuestro encargado de turno en caja para que tome el control de este chat y responda a tu consulta personalmente.\n\n⏰ *Tiempo estimado de respuesta:* 2 a 5 minutos.\n\n_Mientras tanto, podés detallarnos tu consulta o reclamo por este mensaje._`,
      imageUrl: '',
      suggestedChips: ['Volver al Menú', 'Estado de Pedido']
    }
  }
];

function getCustomFlows() {
  try {
    if (fs.existsSync(FLOWS_FILE)) {
      const raw = fs.readFileSync(FLOWS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('[WHATSAPP BOT] Error al leer custom_flows.json:', e);
  }
  return DEFAULT_SERVER_FLOWS;
}

function saveStoredFlows(flows) {
  try {
    fs.writeFileSync(FLOWS_FILE, JSON.stringify(flows, null, 2), 'utf-8');
  } catch (e) {
    console.error('[WHATSAPP BOT] Error al guardar en custom_flows.json:', e);
  }
}


const DEFAULT_SERVER_VARIABLES = [
  { key: 'nombre_local', label: 'Nombre del Local', category: 'business', value: 'ComandaFast Burgers', defaultValue: 'ComandaFast Burgers', description: 'Nombre de la hamburguesería o marca gastronómica' },
  { key: 'direccion', label: 'Dirección para Retiros', category: 'business', value: 'Av. Belgrano 1234, Centro', defaultValue: 'Av. Belgrano 1234, Centro', description: 'Ubicación física del local para Take Away y cadetes' },
  { key: 'horarios', label: 'Días y Horarios de Atención', category: 'business', value: 'Miércoles a Domingos de 19:30 a 00:30 hs', defaultValue: 'Miércoles a Domingos de 19:30 a 00:30 hs', description: 'Turnos en los que la cocina se encuentra abierta y despachando' },
  { key: 'telefono_contacto', label: 'Teléfono / WhatsApp de Atención', category: 'business', value: '+54 9 3826 43-0159', defaultValue: '+54 9 3826 43-0159', description: 'Número de línea directa para consultas o derivación a humano' },
  { key: 'catalogo_url', label: 'Enlace a la Carta Web', category: 'business', value: 'https://burgasystem.netlify.app/#catalog', defaultValue: 'https://burgasystem.netlify.app/#catalog', description: 'URL de la carta digital para ver fotos y promociones' },
  { key: 'zona_envio', label: 'Zona de Cobertura de Envíos', category: 'business', value: 'Casco céntrico y barrios aledaños (hasta 5 km)', defaultValue: 'Casco céntrico y barrios aledaños (hasta 5 km)', description: 'Área geográfica de despacho del delivery' },
  { key: 'alias_banco', label: 'Alias Bancario / Mercado Pago', category: 'payments', value: 'comandafast.mp', defaultValue: 'comandafast.mp', description: 'Alias corto para transferencias bancarias o virtuales' },
  { key: 'banco', label: 'Entidad Bancaria o Billetera', category: 'payments', value: 'Mercado Pago / Banco Galicia', defaultValue: 'Mercado Pago / Banco Galicia', description: 'Nombre del banco emisor o app financiera' },
  { key: 'titular', label: 'Titular de la Cuenta', category: 'payments', value: 'ComandaFast Burgers S.R.L.', defaultValue: 'ComandaFast Burgers S.R.L.', description: 'Nombre del titular a quien se transfiere' },
  { key: 'cbu', label: 'CBU / CVU (22 dígitos)', category: 'payments', value: '0000003100092138928374', defaultValue: '0000003100092138928374', description: 'Clave Bancaria Uniforme completa' },
  { key: 'cuit', label: 'CUIT / CUIL', category: 'payments', value: '30-71829384-9', defaultValue: '30-71829384-9', description: 'Identificación tributaria del negocio' },
  { key: 'descuento_efectivo', label: 'Beneficio Pago en Efectivo', category: 'payments', value: '10% de descuento', defaultValue: '10% de descuento', description: 'Promoción especial al pagar en efectivo en mano' },
  { key: 'demora', label: 'Tiempo Promedio de Espera', category: 'delivery', value: '30 a 45 minutos', defaultValue: '30 a 45 minutos', description: 'Frase para estimar la cocción y viaje' },
  { key: 'demora_min', label: 'Demora Mínima (Minutos)', category: 'delivery', value: '30', defaultValue: '30', description: 'Tiempo mínimo en minutos' },
  { key: 'demora_max', label: 'Demora Máxima (Minutos)', category: 'delivery', value: '45', defaultValue: '45', description: 'Tiempo máximo de entrega' },
  { key: 'costo_envio', label: 'Costo Base de Delivery', category: 'delivery', value: '$1.500', defaultValue: '$1.500', description: 'Tarifa del cadete para envíos' },
  { key: 'envio_gratis_desde', label: 'Envío Gratis a partir de', category: 'delivery', value: '$18.000', defaultValue: '$18.000', description: 'Monto de compra mínima para envío sin cargo' },
  { key: 'mensaje_bienvenida', label: 'Mensaje de Saludo y Bienvenida', category: 'messages', value: '¡Hola {cliente}! Bienvenido a ComandaFast Burgers 🔥 Las mejores hamburguesas smashadas a la plancha.', defaultValue: '¡Hola {cliente}! Bienvenido a ComandaFast Burgers 🔥 Las mejores hamburguesas smashadas a la plancha.', description: 'Saludo inicial automático' },
  { key: 'mensaje_demora', label: 'Aviso de Cocina con Demora Alta', category: 'messages', value: '⚠️ ¡Estamos a pleno fuego en la cocina! La demora actual es de 50 a 65 min. ¡Gracias por la paciencia!', defaultValue: '⚠️ ¡Estamos a pleno fuego en la cocina! La demora actual es de 50 a 65 min. ¡Gracias por la paciencia!', description: 'Mensaje de aviso en alta demanda' },
  { key: 'mensaje_fuera_horario', label: 'Respuesta Fuera de Horario', category: 'messages', value: '🌙 En este momento nuestro local está cerrado. Abrimos de {horarios}. ¡Te esperamos luego!', defaultValue: '🌙 En este momento nuestro local está cerrado. Abrimos de {horarios}. ¡Te esperamos luego!', description: 'Mensaje cuando ingresan consultas fuera de horario' }
];

function getBotVariables() {
  try {
    if (fs.existsSync(VARIABLES_FILE)) {
      const raw = fs.readFileSync(VARIABLES_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const map = new Map(parsed.map(v => [v.key, v]));
        DEFAULT_SERVER_VARIABLES.forEach(def => {
          if (!map.has(def.key)) map.set(def.key, def);
        });
        return Array.from(map.values());
      }
    }
  } catch (e) {
    console.error('[WHATSAPP BOT] Error al leer bot_variables.json:', e);
  }
  return DEFAULT_SERVER_VARIABLES;
}

function saveBotVariables(vars) {
  try {
    fs.writeFileSync(VARIABLES_FILE, JSON.stringify(vars, null, 2), 'utf-8');
  } catch (e) {
    console.error('[WHATSAPP BOT] Error al guardar en bot_variables.json:', e);
  }
}

function getBotVariablesMap() {
  const vars = getBotVariables();
  const map = {};
  for (const v of vars) {
    if (v && v.key) {
      map[v.key] = v.value !== undefined ? v.value : v.defaultValue;
    }
  }
  return map;
}

const DEFAULT_ANTI_LOOP_GRATITUDE = [
  'gracias', 'muchas gracias', 'muchas gracia', 'mil gracias', 'graciass', 'graciela',
  'joya', 'genial', 'excelente', 'buenisimo', 'buenísimo', 'de diez', 'de 10',
  'listo gracias', 'dale gracias', 'muchisimas gracias', 'gracias amigo', 'gracias genio',
  'gracias chicos', 'gracias capo', 'gracias crack', 'gracias a vos', 'gracias a ustedes',
  'espectacular', 'muy rico', 'riquismo', 'riquísimo', 'tremendo', 'todo de diez', 'todo joya'
];

const DEFAULT_ANTI_LOOP_FAREWELL = [
  'chau', 'chau chau', 'adios', 'adiós', 'hasta luego', 'nos vemos', 'buenas noches',
  'buen descanso', 'hasta mañana', 'que descansen'
];

const DEFAULT_ANTI_LOOP_ACKNOWLEDGE = [
  'ok', 'oki', 'okis', 'dale', 'de una', 'perfecto', 'listo', 'entendido', 'impecable', 'barbaro', 'bárbaro',
  'dale joya', 'ok dale', 'dale gracias', 'joya dale', 'dale de una', 'listo dale', 'bueno', 'bueno dale',
  'ya llego', 'ya llegó', 'ahi voy', 'ahí voy', '👍', '👌', '👏', '🙏', '❤️', '🙌', '😊', '😁'
];

const DEFAULT_SERVER_TEMPLATES = {
  anti_loop_enabled: true,
  human_mode_sleep_minutes: 25,
  bot_typing_delay_ms: 2500,
  bot_typing_mode: 'human_dynamic',
  menu_mode: 'templates', // 'templates' = menú clásico de plantillas | 'catalog' = link al catálogo web
  anti_loop_gratitude: DEFAULT_ANTI_LOOP_GRATITUDE,
  anti_loop_farewell: DEFAULT_ANTI_LOOP_FAREWELL,
  anti_loop_acknowledge: DEFAULT_ANTI_LOOP_ACKNOWLEDGE,
  template_anti_loop_gratitude: '¡De nada! 🙌 Que lo disfrutes un montón. Si querés consultar la carta o volver a pedir, escribí *MENU* cuando gustes. ¡Buen provecho! 🍔🔥',
  template_anti_loop_farewell: '¡Hasta la próxima! 👋 Gracias por contactarte con {nombre_local}. ¡Que tengas un excelente descanso! ✨🍔',
  template_anti_loop_acknowledge: '¡Bárbaro! 👍 Quedamos atentos ante cualquier duda. Escribí *MENU* en cualquier momento para hacer un nuevo pedido.',
  template_menu: `🍔 *¡Hola {cliente}! Bienvenido a {nombre_local}* 🔥\n\n{promos_alerta}¿Qué te preparamos hoy? *Elegí lo que más te guste:*\n\n{catalogo_lista}\n\n───────────────────\n👉 *Respondé con el NÚMERO (1, 2, 3...) o el nombre de lo que quieras pedir.*\n👉 Podés agregar aclaraciones como *Sin cebolla*, *Extra cheddar*, etc.\n\n_Si querés consultar horarios, datos de pago o un pedido en curso, escribí *HORARIOS*, *DATOS* o *ESTADO*._`,
  menu_response_1: `📋 *Estado de tu Pedido:* #{pedido_id}\n\n• *Estado:* {estado}\n• *Total:* \${total}\n• *Destino:* {direccion}\n\n_Para volver al menú, enviá la palabra *MENU*._`,
  menu_response_2: `💳 *Datos para Transferencia Bancaria:* 🏦\n\n• *Alias:* \`{alias_banco}\`\n• *Banco:* {banco}\n• *Titular:* {titular}\n• *CBU:* \`{cbu}\`\n\n📸 *Una vez realizada la transferencia, podés enviar la captura o foto del comprobante por este mismo chat para comenzar a cocinar.*\n\n_Enviá *MENU* para volver al menú principal._`,
  menu_response_3: `📍 *Ubicación y Horarios de Atención:* 🕒\n\n🍔 *Dirección:* {direccion}\n⏰ *Horarios de Cocina:* {horarios}\n\n¡Te esperamos con las mejores burgers a la plancha! 🔥\n\n_Enviá *MENU* para volver al menú principal._`,
  menu_response_4: `🍔 *Carta Completa de {nombre_local}* 🔥\n\n📱 *¡Mirá nuestra carta interactiva con fotos!*\n👉 {catalogo_url}\n\n_También podés elegir por acá:_\n{catalogo_lista}\n\n👉 *Respondé con el NÚMERO de lo que querés pedir o escribí COMPRAR.*`,
  menu_response_5: `👤 *¡Entendido {cliente}! Un encargado de {nombre_local} te responderá a la brevedad.* 🍔\n\nPor favor dejanos tu consulta detallada para que podamos ayudarte lo antes posible. ¡Muchas gracias!`,
  template_catalog_direct_welcome: `🍔 *¡Hola {cliente}! Bienvenido a {nombre_local}* 🔥\n\n{promos_alerta}📱 *Hacé tu pedido directo desde nuestra Carta Online con fotos reales y precios:*\n👉 {catalogo_url}\n\nArmá tu pedido en un toque y al enviarlo ingresa directamente a nuestra cocina y POS. ¡Te esperamos! 🛵✨`,
  template_catalog_direct_confirmation: `🎉 *¡Recibimos tu pedido #{pedido_id}!* 🍔🔥\n\n¡Muchas gracias *{cliente}*! Tu comanda ya ingresó al sistema de nuestra cocina y caja.\n\n{detalle_pedido}\n\n💵 *Total:* \${total}\n🚀 *Entrega:* {tipo_entrega}\n\n{instrucciones_pago}\n\n👩‍💼 *En instantes nuestra cajera confirma tu pedido y te avisa el tiempo estimado. ¡Muchas gracias!*`,
  template_buy_catalog: `🍔 *¡Vamos a armar tu pedido!* 🔥\n\n{catalogo_lista}\n\n👉 *Respondé con el NÚMERO (1, 2, 3...) de la hamburguesa o combo que quieras pedir.*`,
  template_order_summary: `🍔 *RESUMEN DE TU PEDIDO* 🔥\n\n🛒 *Items:*\n{carrito_items}\n\n💵 *Subtotal:* \${subtotal}\n🛵 *Entrega:* {metodo_entrega}\n📍 *Dirección:* {direccion}\n👤 *Cliente:* {cliente}\n💳 *Forma de Pago:* {medio_pago}\n\n💵 *TOTAL A PAGAR:* \${total}\n\n¿Está todo perfecto para mandar a la cocina?\n👉 Respondé *SI* para confirmar tu pedido o *CANCELAR*.`,
  template_order_cancelled: `❌ *Pedido cancelado.* ¿En qué más podemos ayudarte?\n\n{menu}`,
  template_order_preparing: `👨‍🍳🔥 *¡Buenas noticias {cliente}! Tu pedido #{pedido_id} ya está en la plancha.*

Nuestros cocineros están preparando tus hamburguesas con la carne recién smashada y el cheddar fundido. ¡Te avisamos apenas esté listo! 🍔✨`,
  template_order_ready: `🔔 *¡Tu pedido #{pedido_id} está LISTO para retirar, {cliente}!* 🍔🍟

Ya podés pasar a retirarlo por nuestro local en {direccion}. ¡Te esperamos con las burgers calentitas!`,
  template_order_ready_delivery: `🔔 *¡Tu pedido #{pedido_id} ya está listo y empaquetado {cliente}!* 🍔📦

Nuestra cocina terminó de preparar tu pedido. En breve el repartidor lo retira para salir hacia {direccion}. ¡Mantenete atento! 🛵💨`,
  template_order_shipped: `🛵💨 *¡Tu pedido #{pedido_id} va en camino {cliente}!*

Destino: *{direccion}*
El repartidor ya salió del local. ¡Mantenete atento para recibir tu comida bien caliente! 🍔🔥`,
  template_order_confirmed: `🎉 *¡PEDIDO #{pedido_id} CONFIRMADO Y ENVIADO A COCINA!* 🔥🍔

¡Muchas gracias *{cliente}*, tu pedido ya ingresó al sistema de la plancha!

💵 *Total:* \${total}
🛵 *Entrega:* {direccion}`
};

function getHumanPauseDurationMs() {
  const tpls = getBotTemplates();
  const minutes = Number(tpls.human_mode_sleep_minutes) || 25;
  return Math.max(1, minutes) * 60 * 1000;
}

function getAntiLoopWords() {
  const tpls = getBotTemplates();
  return {
    gratitude: Array.isArray(tpls.anti_loop_gratitude) && tpls.anti_loop_gratitude.length > 0
      ? tpls.anti_loop_gratitude
      : DEFAULT_ANTI_LOOP_GRATITUDE,
    farewell: Array.isArray(tpls.anti_loop_farewell) && tpls.anti_loop_farewell.length > 0
      ? tpls.anti_loop_farewell
      : DEFAULT_ANTI_LOOP_FAREWELL,
    acknowledge: Array.isArray(tpls.anti_loop_acknowledge) && tpls.anti_loop_acknowledge.length > 0
      ? tpls.anti_loop_acknowledge
      : DEFAULT_ANTI_LOOP_ACKNOWLEDGE
  };
}

/**
 * Normaliza cualquier formato telefónico a un JID válido de WhatsApp (@s.whatsapp.net)
 */
function formatPhoneToRemoteJid(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  if (trimmed.includes('@s.whatsapp.net')) return trimmed;
  if (trimmed.includes('@lid')) return trimmed;

  let digits = trimmed.replace(/\D/g, '');
  if (!digits || digits.length < 7) return null;

  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.startsWith('15') && digits.length >= 10) {
    digits = '549' + digits.slice(2);
  } else if (digits.length === 10) {
    digits = '549' + digits;
  } else if (digits.startsWith('54') && !digits.startsWith('549')) {
    digits = '549' + digits.slice(2);
  }

  return `${digits}@s.whatsapp.net`;
}

function getBotTemplates() {
  try {
    if (fs.existsSync(TEMPLATES_FILE)) {
      const raw = fs.readFileSync(TEMPLATES_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SERVER_TEMPLATES, ...parsed };
    }
  } catch (e) {
    console.error('[WHATSAPP BOT] Error al leer bot_templates.json:', e);
  }
  return { ...DEFAULT_SERVER_TEMPLATES };
}

function saveBotTemplates(tpls) {
  try {
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(tpls, null, 2), 'utf-8');
  } catch (e) {
    console.error('[WHATSAPP BOT] Error al guardar en bot_templates.json:', e);
  }
}

// Normalizar enlace directo al catálogo con fragmento #catalog único
function normalizeCatalogUrl(url) {
  let clean = (url || '').trim();
  if (!clean) return 'https://burgasystem.netlify.app/#catalog';
  if (!clean.includes('#catalog')) {
    clean = clean.replace(/\/$/, '') + '/#catalog';
  }
  return clean.replace(/(#catalog)(?:\/#catalog)+/gi, '$1');
}

// Obtener contexto unificado del negocio (Supabase Cloud + Variables Locales)
function getBusinessContext() {
  const vars = getBotVariablesMap();
  const tpls = getBotTemplates();

  const rawCatalog = vars.catalogo_url || tpls.catalogo_url || vars.sitio_web || tpls.store_website_url || 'https://burgasystem.netlify.app/#catalog';
  const fullCatalogUrl = normalizeCatalogUrl(rawCatalog);
  const baseWebsite = fullCatalogUrl.replace(/\/?#catalog.*$/, '').replace(/\/$/, '');

  return {
    nombre_local: vars.nombre_local || tpls.store_name || "Burga's Chamical",
    alias_banco: vars.alias_banco || tpls.bank_alias || 'Burgachamical.nx',
    banco: vars.banco || tpls.bank_name || 'Naranja X',
    titular: vars.titular || tpls.bank_holder || 'Braian Carlos Zarate San Felipe',
    cbu: vars.cbu || tpls.bank_cbu || '0000003100092138928374',
    direccion: vars.direccion || vars.direccion_local || tpls.pickup_address || 'Av. Perón 145 (frente al super x día)',
    horarios: vars.horarios || tpls.opening_hours || 'Martes a Domingos de 19:30 a 00:30 hs',
    costo_envio: vars.costo_envio || '$2.000',
    envio_gratis_desde: vars.envio_gratis_desde || '$18.000',
    catalogo_url: fullCatalogUrl,
    sitio_web: vars.sitio_web || tpls.store_website_url || baseWebsite,
    mensaje_bienvenida: vars.mensaje_bienvenida || tpls.template_menu || tpls.template_welcome || ''
  };
}

function interpolateTemplate(template, vars = {}) {
  let res = String(template || '');
  for (const [k, v] of Object.entries(vars)) {
    if (k === 'catalogo_url' && String(v).includes('#catalog')) {
      res = res.replace(/\{catalogo_url\}\/?#catalog/gi, String(v));
    }
    res = res.replace(new RegExp(`\\{${k}\\}`, 'gi'), String(v ?? ''));
  }
  res = res.replace(/(#catalog)(?:\/#catalog)+/gi, '$1');
  return res;
}

const DIGIT_EMOJIS = {
  '0': '0️⃣',
  '1': '1️⃣',
  '2': '2️⃣',
  '3': '3️⃣',
  '4': '4️⃣',
  '5': '5️⃣',
  '6': '6️⃣',
  '7': '7️⃣',
  '8': '8️⃣',
  '9': '9️⃣'
};

function formatItemNumber(n) {
  if (n === null || n === undefined || isNaN(n)) return '';
  const numStr = String(n).trim();
  return numStr
    .split('')
    .map(digit => DIGIT_EMOJIS[digit] || digit)
    .join('');
}

function buildCatalogMessage(prods, page = 1, pageSize = 8, isAll = false) {
  const total = prods.length;
  const biz = getBusinessContext();
  const storeName = biz.nombre_local || "Burga's Chamical";
  if (total === 0) {
    return '🍔 *La carta se encuentra en actualización.* Por favor consultá en unos minutos.';
  }

  if (isAll) {
    const list = prods.map((p, i) => {
      const numBadge = formatItemNumber(i + 1);
      const photoBadge = p.image ? '📸' : '';
      let priceStr = `$${Number(p.price).toLocaleString('es-AR')}`;
      if (p.originalPrice && Number(p.originalPrice) > Number(p.price)) {
        priceStr = `~${Number(p.originalPrice).toLocaleString('es-AR')}~ $${Number(p.price).toLocaleString('es-AR')}`;
      }
      const promoBadge = p.discountBadge ? ` [🏷️ ${p.discountBadge}]` : '';
      const freeShippingBadge = p.freeShipping ? ' [🛵 Envío Gratis]' : '';
      return `${numBadge} *${p.name}* — ${priceStr}${promoBadge}${freeShippingBadge} ${photoBadge}`;
    }).join('\n');

    return `🍔 *CARTA COMPLETA DE ${storeName.toUpperCase()} (${total} opciones)* 🔥\n\n${list}\n\n👉 *Para pedir:* Respondé con el número (ej: *1*, *12*, *18*) o *COMPRAR*.\n👉 *Para ver foto:* Escribí *FOTO [número]* (ej: *FOTO 12*).`;
  }

  const totalPages = Math.ceil(total / pageSize) || 1;
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startIdx = (currentPage - 1) * pageSize;
  const pageProds = prods.slice(startIdx, startIdx + pageSize);

  const list = pageProds.map((p, i) => {
    const globalIdx = startIdx + i + 1;
    const numBadge = formatItemNumber(globalIdx);
    const photoBadge = p.image ? '📸' : '';
    let priceStr = `$${Number(p.price).toLocaleString('es-AR')}`;
    if (p.originalPrice && Number(p.originalPrice) > Number(p.price)) {
      priceStr = `~${Number(p.originalPrice).toLocaleString('es-AR')}~ $${Number(p.price).toLocaleString('es-AR')}`;
    }
    const promoBadge = p.discountBadge ? ` [🏷️ ${p.discountBadge}]` : '';
    const freeShippingBadge = p.freeShipping ? ' [🛵 Envío Gratis]' : '';
    return `${numBadge} *${p.name}* — ${priceStr}${promoBadge}${freeShippingBadge} ${photoBadge}`;
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

  return `🍔 *MENÚ ${storeName.toUpperCase()}* 🔥\n📄 *Página ${currentPage} de ${totalPages}* (Opciones ${startIdx + 1} al ${startIdx + pageProds.length} de ${total})\n\n${list}\n\n───────────────────\n👉 *Para pedir:* Respondé con el NÚMERO (1 al ${total}).\n👉 *Para ver foto:* Escribí *FOTO [número]* (ej: *FOTO ${startIdx + 1}*).\n${navInstructions}👉 Escribí *VER TODO* para ver la lista completa.`;
}

// -------------------------------------------------------------
// MAPEADOR Y FORMATEADOR DE CATEGORÍAS (MODO PLANTILLAS)
// -------------------------------------------------------------
const CATEGORY_MAP = {
  hamburguesas: {
    name: 'Hamburguesas',
    keywords: ['hamburguesa', 'hamburguesas', 'burger', 'burgers', 'burgas', 'burga']
  },
  bebidas: {
    name: 'Bebidas',
    keywords: ['bebida', 'bebidas', 'gaseosa', 'gaseosas', 'gaseosita', 'trago', 'tragos', 'refresco', 'refrescos', 'tomar', 'para tomar', 'de tomar']
  },
  agregados: {
    name: 'Agregados',
    keywords: ['agregado', 'agregados', 'papa', 'papas', 'fritas', 'guarnicion', 'guarniciones', 'acompanamiento', 'acompanamientos', 'entrada', 'entradas']
  },
  lomitos: {
    name: 'Lomitos',
    keywords: ['lomito', 'lomitos', 'lomo', 'lomos']
  },
  panchos: {
    name: 'Panchos',
    keywords: ['pancho', 'panchos', 'hot dog', 'hot dogs', 'panchito', 'panchitos']
  },
  promos: {
    name: 'Promos',
    keywords: ['promo', 'promos', 'promocion', 'promociones', 'combo', 'combos', 'oferta', 'ofertas']
  }
};

function detectCategoryQuery(text, prodsList) {
  if (!text || !Array.isArray(prodsList) || prodsList.length === 0) return null;
  const clean = normalizeSearchText(text);
  if (!clean) return null;

  // 1. Si pregunta por ingredientes específicos o alergias, derivar a IA
  if (/\b(ingredientes?|que\s+trae|que\s+lleva|de\s+que\s+es|como\s+es|celiac[oa]s?|vegan[oa]s?|sin\s+tacc|gluten)\b/i.test(clean)) {
    return null;
  }

  // 2. Si empieza con número o cantidad explícita (ej: '1 burger', '2 bajoneras', '3 papas cheddar')
  if (/^\d+\b/.test(clean)) return null;
  if (/^(quiero|dame|anotame|traeme|sumar|agregar|pedir)\s+(\d+|un|una|dos|tres|cuatro|cinco)\b/i.test(clean)) {
    if (!/^(quiero|deseo)\s+ver\b/i.test(clean)) return null;
  }

  // 3. Patrones de intención de visualización / consulta
  const isViewIntent = /^(muestrame|mostrame|ver|mostrar|cuales|que|hay|tienen|tenes|lista|opciones|carta|menu|disponible|disponibles|variedad|variedades)\b/i.test(clean);

  // 4. Chequear cada categoría configurada
  for (const [key, catInfo] of Object.entries(CATEGORY_MAP)) {
    const catProds = prodsList.filter(p => normalizeSearchText(p.category) === normalizeSearchText(catInfo.name));
    if (catProds.length === 0) continue;

    for (const kw of catInfo.keywords) {
      const kwNorm = normalizeSearchText(kw);
      const isExactCategory = clean === kwNorm || 
        clean === 'las ' + kwNorm || 
        clean === 'los ' + kwNorm || 
        clean === 'la ' + kwNorm || 
        clean === 'el ' + kwNorm ||
        clean === 'de ' + kwNorm;

      const isQuestionCategory = (
        clean.includes(kwNorm) && (
          isViewIntent ||
          /\b(tienen|tenes|hay|muestrame|mostrame|ver|cuales|que|carta|menu|lista|opciones|catalogo|cat[aá]logo|variedades|rubro|seccion)\b/i.test(clean)
        )
      );

      if (isExactCategory || isQuestionCategory) {
        return catInfo.name;
      }
    }
  }

  // 5. Categorías dinámicas presentes en la lista de productos
  const uniqueCats = Array.from(new Set(prodsList.map(p => p.category).filter(Boolean)));
  for (const cat of uniqueCats) {
    const catNorm = normalizeSearchText(cat);
    if (clean === catNorm || clean === 'las ' + catNorm || clean === 'los ' + catNorm || (clean.includes(catNorm) && isViewIntent)) {
      return cat;
    }
  }

  return null;
}

function buildCategoryCatalogMessage(categoryName, prodsList, currentItems = [], currentTotal = 0) {
  const isPromoCat = (categoryName || '').toLowerCase() === 'promos' || (categoryName || '').toLowerCase() === 'promo';
  const categoryProds = prodsList.filter(p => isProductAvailable(p) && (p.category || '').toLowerCase() === categoryName.toLowerCase());
  if (categoryProds.length === 0) {
    if (isPromoCat) {
      return buildPromosMessage(prodsList);
    }
    return null;
  }

  const emojiMap = {
    hamburguesas: '🍔',
    bebidas: '🥤',
    agregados: '🍟',
    lomitos: '🥩',
    panchos: '🌭',
    promos: '🏷️'
  };
  const catEmoji = emojiMap[categoryName.toLowerCase()] || '🍔';

  let cartHeader = '';
  if (Array.isArray(currentItems) && currentItems.length > 0) {
    const briefList = currentItems.map(it => `• ${it.name} (x${it.qty || 1})`).join(', ');
    cartHeader = `🛒 *Tu pedido actual sigue guardado:* ${briefList} *(Subtotal: $${(Number(currentTotal) || 0).toLocaleString('es-AR')})*\n\n`;
  }

  const list = categoryProds.map(p => {
    const globalIdx = prodsList.indexOf(p) + 1;
    const numBadge = formatItemNumber(globalIdx);
    const photoBadge = p.image ? '📸' : '';
    let priceStr = `$${Number(p.price).toLocaleString('es-AR')}`;
    if (p.originalPrice && Number(p.originalPrice) > Number(p.price)) {
      priceStr = `~${Number(p.originalPrice).toLocaleString('es-AR')}~ $${Number(p.price).toLocaleString('es-AR')}`;
    }
    const promoBadge = p.discountBadge ? ` [🏷️ ${p.discountBadge}]` : '';
    const freeShippingBadge = p.freeShipping ? ' [🛵 Envío Gratis]' : '';
    return `${numBadge} *${p.name}* — ${priceStr}${promoBadge}${freeShippingBadge} ${photoBadge}`;
  }).join('\n');

  const firstIdx = prodsList.indexOf(categoryProds[0]) + 1;
  const firstName = categoryProds[0].name;

  return `${cartHeader}${catEmoji} *${categoryName.toUpperCase()} DISPONIBLES* 🔥 (${categoryProds.length} opciones)\n\n${list}\n\n───────────────────\n👉 *Para pedir:* Respondé con el NÚMERO (ej: *${firstIdx}*) o su NOMBRE (ej: *1 ${firstName}*).\n👉 *Para ver foto:* Escribí *FOTO [número]* (ej: *FOTO ${firstIdx}*).\n👉 Escribí *CARTA* para ver todas las opciones o *LISTO* para avanzar con la entrega.`;
}

function isCategoriesListQuery(text) {
  if (!text) return false;
  const clean = normalizeSearchText(text);
  return /^(categorias|rubros|secciones|ver\s+categorias|ver\s+rubros|que\s+categorias\s+tienen|cuales\s+son\s+las\s+categorias|cuales\s+categorias\s+hay)$/i.test(clean);
}

function buildCategoriesSummaryMessage(prodsList) {
  const catCounts = {};
  prodsList.forEach(p => {
    if (p.category) {
      catCounts[p.category] = (catCounts[p.category] || 0) + 1;
    }
  });

  const emojiMap = {
    hamburguesas: '🍔',
    bebidas: '🥤',
    agregados: '🍟',
    lomitos: '🥩',
    panchos: '🌭',
    promos: '🏷️'
  };

  const lines = Object.entries(catCounts).map(([cat, count]) => {
    const emoji = emojiMap[cat.toLowerCase()] || '🍔';
    return `${emoji} *${cat}* (${count} opciones)`;
  }).join('\n');

  return `📋 *CATEGORÍAS DE NUESTRA CARTA:* 🔥\n\n${lines}\n\n───────────────────\n👉 Escribí el nombre de la categoría que querés ver (ej: *HAMBURGUESAS* o *BEBIDAS*).\n👉 O escribí *CARTA* para ver todas las opciones disponibles.`;
}



/**
 * Parsea pedidos entrantes generados automáticamente desde el Catálogo Online Web (#catalog)
 */
function parseCatalogCurrency(str) {
  if (!str) return 0;
  let clean = str.trim().replace(/[^\d.,]/g, '');
  if (clean.includes(',')) {
    // Formato argentino: punto de miles, coma de decimales (ej: 8.500,00)
    clean = clean.replace(/\./g, '').replace(',', '.');
    return Math.round(parseFloat(clean)) || 0;
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(clean)) {
    return parseInt(clean.replace(/\./g, ''), 10) || 0;
  }
  return Math.round(parseFloat(clean)) || 0;
}

function parseCatalogOrder(text) {
  if (!text || typeof text !== 'string') return null;
  const isCatalogOrder = (text.includes("Mi Pedido") || text.includes("Mi pedido") || text.includes("MI PEDIDO")) && 
                         (text.includes("Subtotal") || text.includes("TOTAL") || text.includes("Tipo de entrega"));
  if (!isCatalogOrder) return null;

  const itemRegex = /[•\*\-]?\s*(\d+)x\s+([^—\n]+?)\s*—\s*\$?\s*([\d\.,]+)/g;
  let match;
  const items = [];
  while ((match = itemRegex.exec(text)) !== null) {
    items.push({
      qty: parseInt(match[1], 10) || 1,
      name: match[2].trim(),
      price: parseCatalogCurrency(match[3])
    });
  }

  const subMatch = text.match(/Subtotal[^\d\n]*([$\d\.,]+)/i);
  const subtotal = subMatch ? parseCatalogCurrency(subMatch[1]) : 0;
  const delMatch = text.match(/Delivery[^\d\n]*([$\d\.,]+)/i);
  const deliveryFee = delMatch ? parseCatalogCurrency(delMatch[1]) : 0;
  const totMatch = text.match(/\bTOTAL[^\d\n]*([$\d\.,]+)/i);
  const total = totMatch ? parseCatalogCurrency(totMatch[1]) : (subtotal + deliveryFee);

  const nameMatch = text.match(/Nombre:\*?\s*([^\n]+)/i);
  const addrMatch = text.match(/Direcci[oó]n:\*?\s*([^\n]+)/i);
  const phoneMatch = text.match(/Tel[eé]fono:\*?\s*([^\n]+)/i);
  const typeMatch = text.match(/Tipo de entrega:\*?\s*([^\n]+)/i);
  const payMatch = text.match(/Forma de pago:\*?\s*([^\n]+)/i) || text.match(/Pago:\*?\s*([^\n]+)/i);
  const notesMatch = text.match(/Aclaraciones:\*?\s*([^\n]+)/i);

  const serviceType = (typeMatch && (typeMatch[1].toLowerCase().includes("llevar") || typeMatch[1].toLowerCase().includes("retiro") || typeMatch[1].toLowerCase().includes("local"))) 
    ? 'local' 
    : 'delivery';

  let paymentMethod = null;
  if (payMatch) {
    const rawPay = payMatch[1].toLowerCase();
    if (rawPay.includes('transf') || rawPay.includes('alias') || rawPay.includes('banco') || rawPay.includes('mp') || rawPay.includes('mercado')) {
      paymentMethod = 'transferencia';
    } else if (rawPay.includes('efectivo')) {
      paymentMethod = 'efectivo';
    }
  }

  const orderNumMatch = text.match(/Mi Pedido\s*#?(\d+)/i) || text.match(/Pedido\s*#?(\d+)/i);
  const orderNumber = orderNumMatch ? parseInt(orderNumMatch[1], 10) : null;

  return {
    orderNumber,
    items,
    subtotal: subtotal || total,
    deliveryFee,
    total: total || subtotal,
    customerName: nameMatch ? nameMatch[1].trim() : '',
    customerAddress: addrMatch ? addrMatch[1].trim() : '',
    customerPhone: phoneMatch ? phoneMatch[1].trim() : '',
    serviceType,
    paymentMethod,
    notes: notesMatch ? notesMatch[1].trim() : ''
  };
}

function buildPromosMessage(prods) {
  const promoProds = prods.filter(p => isProductAvailable(p) && ((p.category || '').toLowerCase() === 'promos' || Boolean(p.discountBadge)));
  const biz = getBusinessContext();
  const storeName = biz.nombre_local || "Burga's Chamical";

  if (promoProds.length === 0) {
    const regularAvailable = prods
      .filter(p => isProductAvailable(p) && (p.category || '').toLowerCase() !== 'promos')
      .slice(0, 3);

    let altsText = '';
    if (regularAvailable.length > 0) {
      altsText = `\n👉 *Pero tenemos toda nuestra carta disponible con opciones increíbles recién hechas a la plancha:*\n` +
        regularAvailable.map((p) => {
          const globalIdx = prods.indexOf(p) + 1;
          return `  • *${formatItemNumber(globalIdx)} ${p.name}* — $${Number(p.price).toLocaleString('es-AR')}${p.description ? ` (${p.description})` : ''}`;
        }).join('\n') + `\n`;
    }

    return `🏷️ *PROMOCIONES DE ${storeName.toUpperCase()}* 🍔\n\n` +
      `⚠️ *¡Por el momento las promociones se encuentran AGOTADAS (válido únicamente hasta agotar stock)!* 😔💨\n` +
      altsText +
      `\n_Escribí *CARTA* o *MENU* para ver todas las opciones disponibles._`;
  }

  const list = promoProds.map((p) => {
    const globalIdx = prods.indexOf(p) + 1;
    const numBadge = formatItemNumber(globalIdx);
    const photoBadge = p.image ? '📸' : '';
    let priceStr = `$${Number(p.price).toLocaleString('es-AR')}`;
    if (p.originalPrice && Number(p.originalPrice) > Number(p.price)) {
      priceStr = `~${Number(p.originalPrice).toLocaleString('es-AR')}~ $${Number(p.price).toLocaleString('es-AR')}`;
    }
    const promoBadge = p.discountBadge ? ` [🏷️ ${p.discountBadge}]` : '';
    const freeShippingBadge = p.freeShipping ? ' [🛵 Envío Gratis]' : '';
    const desc = p.description ? `\n   _${p.description}_` : '';
    const mods = p.modifiers && p.modifiers.length > 0 ? `\n   ✨ Modificadores: ${p.modifiers.join(', ')}` : '';
    return `${numBadge} *${p.name}* — ${priceStr}${promoBadge}${freeShippingBadge} ${photoBadge}${desc}${mods}`;
  }).join('\n\n');

  return `🏷️ *PROMOCIONES & COMBOS DE ${storeName.toUpperCase()}* 🔥\n\n${list}\n\n───────────────────\n👉 *Para pedir una promo:* Respondé con el NÚMERO (ej: *1* o *2*) o escribí su nombre (ej: *Promo ${promoProds[0].name}*).\n👉 Escribí *COMPRAR* o *MENU* para ver todas las opciones.`;
}

function normalizeSearchText(str) {
  if (!str) return '';
  return str.toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const SPANISH_WORD_NUMBERS = {
  'un': '1', 'uno': '1', 'una': '1',
  'dos': '2', 'tres': '3', 'cuatro': '4', 'cinco': '5',
  'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9', 'diez': '10'
};

function cleanTokens(txt) {
  return normalizeSearchText(txt)
    .replace(/\b(promos?|promocion(es)?|ofertas?|descuentos?|combos?|quiero|quisiera|deseo|dame|anotame|traeme|trae|pedir|pido|comprar|sumar|suma|agregar|agrega|mas|más|otro|otra|otros|otras|la|las|el|los|un|una|uno|unos|unas|de|del|con|sin|por\s+favor|porfa|me\s+das|buenas\s+tardes|buenos\s+dias|buenas\s+noches|buenas|hola)\b/g, ' ')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanTokensWithDigits(txt) {
  let cleaned = cleanTokens(txt);
  for (const [w, d] of Object.entries(SPANISH_WORD_NUMBERS)) {
    cleaned = cleaned.replace(new RegExp('\\b' + w + '\\b', 'g'), d);
  }
  return cleaned;
}

function findProductByText(inputText, prodsList) {
  if (!inputText || !Array.isArray(prodsList) || prodsList.length === 0) return null;
  const rawNorm = normalizeSearchText(inputText);
  if (!rawNorm) return null;

  const isPromoSearch = /\b(promos?|promocion(es)?|ofertas?|descuentos?|combos?)\b/.test(rawNorm);

  const strippedText = cleanTokens(rawNorm);
  const strippedDigits = cleanTokensWithDigits(rawNorm);

  const promoProds = prodsList.filter(p => normalizeSearchText(p.category) === 'promos');
  const regularProds = prodsList.filter(p => normalizeSearchText(p.category) !== 'promos');

  // Si busca "promo 1" o "promo 2"
  const promoNumMatch = rawNorm.match(/\bpromo\s*(\d+)\b/);
  if (promoNumMatch) {
    const pIdx = parseInt(promoNumMatch[1], 10);
    if (pIdx >= 1 && pIdx <= promoProds.length) {
      return promoProds[pIdx - 1];
    }
  }

  // 1. Si es búsqueda de promo, priorizar promoProds con dígitos y texto normalizado
  if (isPromoSearch) {
    const promoMatch = promoProds.find(p => {
      const pClean = cleanTokensWithDigits(p.name);
      return pClean === strippedDigits || strippedDigits.includes(pClean) || pClean.includes(strippedDigits);
    });
    if (promoMatch) return promoMatch;
  }

  // 2. Comparación por tokens limpios exactos (con y sin conversión de dígitos)
  if (strippedText || strippedDigits) {
    const promoTokenMatch = promoProds.find(p => {
      const pDigits = cleanTokensWithDigits(p.name);
      return pDigits === strippedDigits || cleanTokens(p.name) === strippedText;
    });
    if (promoTokenMatch) return promoTokenMatch;

    const regularTokenMatch = regularProds.find(p => cleanTokens(p.name) === strippedText);
    if (regularTokenMatch) return regularTokenMatch;
  }

  // 3. Coincidencia exacta completa (rawNorm) con nombre de producto (priorizando promo)
  const exactFullPromo = promoProds.find(p => {
    const pNorm = normalizeSearchText(p.name);
    return rawNorm === pNorm || rawNorm === `promo ${pNorm}` || rawNorm === `la ${pNorm}` || strippedDigits === cleanTokensWithDigits(p.name);
  });
  if (exactFullPromo) return exactFullPromo;

  const exactFullRegular = regularProds.find(p => {
    const pNorm = normalizeSearchText(p.name);
    return rawNorm === pNorm || rawNorm === `promo ${pNorm}` || rawNorm === `la ${pNorm}`;
  });
  if (exactFullRegular) return exactFullRegular;

  // 4. Coincidencia parcial con tokens limpios significativos (al menos 3 letras)
  if (strippedDigits && strippedDigits.length >= 3) {
    if (isPromoSearch) {
      const candPromo = promoProds.find(p => cleanTokensWithDigits(p.name).includes(strippedDigits) || strippedDigits.includes(cleanTokensWithDigits(p.name)));
      if (candPromo) return candPromo;
    }

    const candPromoExact = promoProds.find(p => cleanTokensWithDigits(p.name) === strippedDigits);
    if (candPromoExact) return candPromoExact;

    const candRegular = regularProds.find(p => cleanTokens(p.name).includes(strippedText) || strippedText.includes(cleanTokens(p.name)));
    if (candRegular) return candRegular;

    const candAnyPromo = promoProds.find(p => cleanTokensWithDigits(p.name).includes(strippedDigits) || strippedDigits.includes(cleanTokensWithDigits(p.name)));
    if (candAnyPromo) return candAnyPromo;
  }

  return null;
}

function parseCustomerQuantity(text, matchedProdName = '') {
  if (!text) return 1;
  const norm = normalizeSearchText(text);
  const prodNorm = normalizeSearchText(matchedProdName);

  // Si el nombre del producto contiene números intrínsecos (ej: '2 Cheese', '4x4', '2 Clasicas')
  const prodNumMatch = prodNorm.match(/\b(\d+)\b/);
  if (prodNumMatch) {
    // Buscar si el cliente especificó una cantidad MULTIPLICADORA previa (ej: '2 promos de 2 cheese', 'dos combos de 2 cheese', '3 de 2 cheese')
    const multiMatch = norm.match(/\b(\d+|dos|tres|cuatro|cinco|seis)\s*(?:promos?|combos?|veces|unidades?|x)?\s*(?:de\s+)?(?:la\s+|el\s+)?(?:promo\s+|combo\s+)?(?:de\s+)?(?:2|dos|\d+)\s*[a-z]+/i);
    if (multiMatch) {
      const wMap = { 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5, 'seis': 6 };
      const val = multiMatch[1].toLowerCase();
      const q = parseInt(val, 10) || wMap[val] || 1;
      return Math.min(20, Math.max(1, q));
    }
    // Si no dijo cantidad multiplicadora, la cantidad de la promo es 1
    return 1;
  }

  const wordQtyMap = {
    'un': 1, 'una': 1, 'uno': 1,
    'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
    'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10
  };

  const qtyMatch = norm.match(/\b(\d+)\s*(?:de\s+|del\s+|x\s*)?(?:hamburguesas?|burgers?|promos?|clasicas?|cheddar|bajonera|oklahoma|papas)?/i);
  if (qtyMatch) {
    const n = parseInt(qtyMatch[1], 10);
    if (n > 0 && n <= 50) return n;
  }

  for (const [w, q] of Object.entries(wordQtyMap)) {
    if (new RegExp(`\\b${w}\\b`).test(norm)) return q;
  }

  return 1;
}

function isCustomerInquiry(text) {
  if (!text) return false;
  const cleanNorm = normalizeSearchText(text);
  const hasQuestionMarks = text.includes('?') || text.includes('¿');
  const hasInquiryKeywords = /\b(que\s+trae|que\s+tiene|como\s+es|cual\s+es|cuales\s+son|que\s+lleva|de\s+que\s+es|ingredientes|sin\s+tacc|celiaco|celíaco|celiacos|celíacos|vegano|vegana|veganos|vegetariano|vegetariana|gluten|recomendas|recomendás|recomiendas|recomiendan|recomendacion|recomendación|sugeris|sugerís|sugieres|sugerencia|cual\s+me\s+recomendas|que\s+me\s+recomendas|que\s+esta\s+bueno|a\s+que\s+hora|hasta\s+que\s+hora|abren|abierto|demora|cuanto\s+demora|cuanto\s+tardan|delivery|envio|envío|envios|envíos|llegan|cuanto\s+sale|precio|precios|cuanto\s+cuesta)\b/i.test(cleanNorm);
  const hasBuyVerb = /^(quiero|dame|anotame|sumar|agregar|pedir|comprar|llevar|trae|traeme)\b/i.test(cleanNorm);
  return (hasQuestionMarks || hasInquiryKeywords) && !hasBuyVerb;
}

function formatCatalogListForTemplate(prods, maxItems = 8) {
  if (!Array.isArray(prods) || prods.length === 0) {
    return '🍔 *La carta se encuentra en actualización.* Por favor consultá en unos minutos.';
  }
  const total = prods.length;
  const slice = prods.slice(0, maxItems);
  const items = slice.map((p, i) => {
    const numBadge = formatItemNumber(i + 1);
    const photoBadge = p.image ? ' 📸' : '';
    let priceStr = `$${Number(p.price).toLocaleString('es-AR')}`;
    if (p.originalPrice && Number(p.originalPrice) > Number(p.price)) {
      priceStr = `~${Number(p.originalPrice).toLocaleString('es-AR')}~ $${Number(p.price).toLocaleString('es-AR')}`;
    }
    const promoBadge = p.discountBadge ? ` [🏷️ ${p.discountBadge}]` : '';
    const freeShippingBadge = p.freeShipping ? ' [🛵 Envío Gratis]' : '';
    const desc = p.description ? `\n   _${p.description}_` : '';
    return `${numBadge} *${p.name}* — ${priceStr}${promoBadge}${freeShippingBadge}${photoBadge}${desc}`;
  }).join('\n\n');

  let moreTip = '';
  if (total > maxItems) {
    moreTip = `\n\n⏩ _Mostrando las primeras ${maxItems} opciones de ${total}. Escribí *SIGUIENTE* o el nombre de una categoría (*HAMBURGUESAS*, *BEBIDAS*, *LOMITOS*) para ver más._`;
  }
  return items + moreTip;
}

function buildMainMenuMessage(customerName = '') {
  const tpls = getBotTemplates();
  const biz = getBusinessContext();
  const storeName = biz.nombre_local || "Burga's Chamical";
  const clientName = customerName ? customerName.trim() : 'amigo/a';
  const menuMode = tpls.menu_mode || 'templates';
  const catalogUrl = biz.catalogo_url;

  const prods = getStoredProducts();
  const availableProds = prods.filter(isProductAvailable);
  const promoProducts = availableProds.filter(p => 
    (p.category || '').toLowerCase().includes('promo') ||
    Boolean(p.discountBadge) ||
    Boolean(p.originalPrice && Number(p.originalPrice) > Number(p.price))
  );

  let promosAlerta = '';
  if (promoProducts.length > 0) {
    const promoNames = promoProducts.slice(0, 3).map(p => `• *${p.name}* ($${Number(p.price).toLocaleString('es-AR')})`).join('\n');
    promosAlerta = `🏷️💥 *¡HOY TENEMOS PROMOS Y COMBOS ESPECIALES!* 🛵🍔\n⚠️ _(Válido únicamente hasta agotar stock)_\n${promoNames}\n\n`;
  }

  if (menuMode === 'catalog_direct') {
    const rawDirect = tpls.template_catalog_direct_welcome || DEFAULT_SERVER_TEMPLATES.template_catalog_direct_welcome;
    return interpolateTemplate(rawDirect, {
      cliente: clientName,
      nombre_local: storeName,
      promos_alerta: promosAlerta,
      catalogo_url: catalogUrl,
      ...biz
    });
  }

  if (menuMode === 'catalog') {
    // EN MODO CATÁLOGO ONLINE: no enviar el menú numerado de primera, solo la carta digital interactiva
    return `🍔 *¡Hola ${clientName}! Bienvenido a ${storeName}* 🔥\n\n` +
      promosAlerta +
      `📱 *¡Hacé tu pedido directo desde nuestra Carta Digital interactiva con fotos reales y precios!* 📸\n` +
      `👉 ${catalogUrl}\n\n` +
      `Allí podés ver fotos reales de cada hamburguesa, armar tu combo con adicionales y enviar tu pedido directo a la cocina en un toque. ¡Te esperamos! 🛵✨\n\n` +
      `_Si necesitás consultar por un pedido en curso o hablar con nosotros, podés escribir *ESTADO* o *HUMANO*._`;
  }

  // MODO PLANTILLAS CLÁSICO: directo al grano para pedir sin menú burocrático
  const catalogList = formatCatalogListForTemplate(availableProds, 8);
  let rawMenu = tpls.template_menu || DEFAULT_SERVER_TEMPLATES.template_menu;
  if (!rawMenu || rawMenu.includes('Consultar estado') || rawMenu.includes('1️⃣ 📋') || rawMenu.includes('5️⃣ 👤')) {
    rawMenu = DEFAULT_SERVER_TEMPLATES.template_menu;
  }

  if (!rawMenu.includes('{promos_alerta}') && promosAlerta) {
    rawMenu = rawMenu.replace(/(🔥|Bienvenido[^\n]*\n)/i, `$1\n\n${promosAlerta}`);
  }

  return interpolateTemplate(rawMenu, {
    cliente: clientName,
    nombre_local: storeName,
    promos_alerta: promosAlerta,
    catalogo_lista: catalogList,
    ...biz
  });
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Comprueba si un producto está disponible para venta y con stock > 0
function isProductAvailable(p) {
  if (!p) return false;
  if (p.available === false) return false;
  if (p.is_active === false) return false;
  if (p.stock !== null && p.stock !== undefined && !isNaN(Number(p.stock)) && Number(p.stock) <= 0) return false;
  return true;
}

// Cargar productos de la base de datos local (priorizando Promos al frente)
function getStoredProducts() {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      const raw = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        return list.slice().sort((a, b) => {
          const isPromoA = (a.category || '').toLowerCase() === 'promos' ? 0 : 1;
          const isPromoB = (b.category || '').toLowerCase() === 'promos' ? 0 : 1;
          if (isPromoA !== isPromoB) return isPromoA - isPromoB;
          return 0;
        });
      }
    }
  } catch (e) {
    console.error('[WHATSAPP BOT] Error al leer products.json:', e);
  }
  return [];
}

// Guardar productos en archivo local
function saveStoredProducts(products) {
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[WHATSAPP BOT] Error al guardar products.json:', e);
    return false;
  }
}

// Sincronizar actualización de stock y disponibilidad en Supabase Cloud
async function pushProductUpdateToSupabase(productId, updates) {
  try {
    const body = { updated_at: new Date().toISOString() };
    if (updates.available !== undefined) body.is_active = updates.available;
    if (updates.is_active !== undefined) body.is_active = updates.is_active;
    if (updates.stock !== undefined) body.stock = updates.stock;

    await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${productId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.warn(`[SUPABASE] Error actualizando stock para ${productId}:`, err.message);
  }
}

// Alternativa 3: Descuento automático de stock al confirmar pedidos
function deductStockForOrder(order) {
  if (!order || !Array.isArray(order.items) || order.items.length === 0) return;
  try {
    const products = getStoredProducts();
    let modified = false;

    for (const item of order.items) {
      const qty = Number(item.qty || item.quantity || 1);
      if (qty <= 0) continue;

      const normItemName = (item.name || '').trim().toLowerCase();
      const prod = products.find(p => 
        (item.id && p.id === item.id) || 
        (p.name && p.name.trim().toLowerCase() === normItemName)
      );

      if (prod && prod.stock !== null && prod.stock !== undefined && !isNaN(Number(prod.stock))) {
        const currentStock = Number(prod.stock);
        const newStock = Math.max(0, currentStock - qty);
        prod.stock = newStock;
        if (newStock <= 0) {
          prod.available = false;
          prod.is_active = false;
          console.log(`🚨 [STOCK BOT]: El producto '${prod.name}' llegó a 0 stock y se marcó automáticamente como AGOTADO.`);
        } else {
          console.log(`📉 [STOCK BOT]: Descontadas ${qty}u de '${prod.name}'. Stock restante: ${newStock}u.`);
        }
        modified = true;
        pushProductUpdateToSupabase(prod.id, { available: prod.available, is_active: prod.is_active, stock: prod.stock }).catch(() => {});
      }
    }

    if (modified) {
      saveStoredProducts(products);
    }
  } catch (e) {
    console.error('[STOCK DEDUCT ERROR]:', e);
  }
}

// Almacenar pedidos generados por WhatsApp
function getStoredOrders() {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const raw = fs.readFileSync(ORDERS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('[WHATSAPP BOT] Error al leer orders.json:', e);
  }
  return [];
}

function saveStoredOrder(order) {
  try {
    const orders = getStoredOrders();
    const existingIdx = orders.findIndex(o => o.id === order.id);
    if (existingIdx !== -1) {
      orders[existingIdx] = { 
        ...orders[existingIdx], 
        ...order, 
        updatedAt: order.updatedAt || Date.now() 
      };
    } else {
      orders.unshift({ 
        ...order, 
        updatedAt: order.updatedAt || Date.now() 
      });
    }
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
  } catch (e) {
    console.error('[WHATSAPP BOT] Error al guardar order en orders.json:', e);
  }
}

// Obtener el número de orden más alto entre almacenamiento local y Supabase
let serverOrderCounterResetAt = null;

async function getLatestOrderNumber() {
  let highest = 0;
  let lastResetAt = serverOrderCounterResetAt;

  // 1. Intentar consultar lastResetAt en Supabase system_settings
  try {
    const sController = new AbortController();
    const sTimeout = setTimeout(() => sController.abort(), 1500);
    const sRes = await fetch(`${SUPABASE_URL}/rest/v1/system_settings?id=eq.order_counter&select=*`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      signal: sController.signal
    });
    clearTimeout(sTimeout);
    if (sRes.ok) {
      const sRows = await sRes.json();
      if (Array.isArray(sRows) && sRows.length > 0 && sRows[0].data?.lastResetAt) {
        lastResetAt = sRows[0].data.lastResetAt;
        serverOrderCounterResetAt = lastResetAt;
        const remoteCounter = Number(sRows[0].data.counter) || 0;
        if (remoteCounter > highest) highest = remoteCounter;
      }
    }
  } catch (_) {}

  const resetTime = lastResetAt ? new Date(lastResetAt).getTime() : 0;

  // 2. Revisar orders.json local (solo órdenes creadas tras el corte)
  const localOrders = getStoredOrders();
  if (Array.isArray(localOrders)) {
    for (const o of localOrders) {
      const oTime = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      if (!resetTime || oTime > resetTime) {
        const num = Number(o.orderNumber || o.order_number) || 0;
        if (num > highest) highest = num;
      }
    }
  }

  // 3. Consultar Supabase (filtrando por created_at > lastResetAt si existe)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    let query = 'select=order_number&order=order_number.desc&limit=1';
    if (lastResetAt) {
      query = `select=order_number&created_at=gt.${encodeURIComponent(lastResetAt)}&order=order_number.desc&limit=1`;
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?${query}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const cloudNum = Number(rows[0].order_number) || 0;
        if (cloudNum > highest) highest = cloudNum;
      }
    }
  } catch (_) {}

  return highest;
}

// Cola de pedidos pendientes de ser consumidos por el sistema POS / Cocina
let pendingOrdersForPos = [];

// Sesiones activas de clientes en WhatsApp (identificadas por remoteJid)
const customerSessions = new Map();

function getCustomerSession(jid) {
  if (!customerSessions.has(jid)) {
    customerSessions.set(jid, {
      step: 'IDLE', // 'IDLE' | 'SELECTING' | 'ASK_SHIPPING_METHOD' | 'ASK_ADDRESS' | 'ASK_NAME' | 'ASK_PAYMENT' | 'CONFIRMING'
      items: [],
      subtotal: 0,
      total: 0,
      shippingMethod: 'local', // 'local' (Retiro) | 'delivery' (Envío)
      shippingAddress: '',
      customerName: '',
      paymentMethod: 'efectivo', // 'efectivo' | 'transferencia'
      lastInteraction: Date.now()
    });
  }
  const s = customerSessions.get(jid);
  s.lastInteraction = Date.now();
  return s;
}

function resetCustomerSession(jid) {
  customerSessions.delete(jid);
}

// =========================================================
// MONITOREO DE CHATS EN VIVO (PANEL DEL CAJERO & CONTROL REMOTO)
// =========================================================
const LIVE_CHATS_FILE = path.join(DATA_DIR, 'live_chats.json');

function loadStoredLiveChats() {
  try {
    if (fs.existsSync(LIVE_CHATS_FILE)) {
      const data = JSON.parse(fs.readFileSync(LIVE_CHATS_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        const map = new Map();
        for (const c of data) {
          if (c && c.jid) map.set(c.jid, c);
        }
        return map;
      }
    }
  } catch (err) {
    console.warn('⚠️ Error al cargar live_chats.json:', err.message);
  }
  return new Map();
}

const liveChatsMap = loadStoredLiveChats();
let saveLiveChatsTimer = null;

function scheduleSaveLiveChats() {
  if (saveLiveChatsTimer) clearTimeout(saveLiveChatsTimer);
  saveLiveChatsTimer = setTimeout(() => {
    try {
      const list = Array.from(liveChatsMap.values()).map(c => ({
        ...c,
        messages: (c.messages || []).slice(-60)
      }));
      fs.writeFileSync(LIVE_CHATS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.warn('⚠️ Error guardando live_chats.json:', err.message);
    }
  }, 1200);
}

function recordLiveChatMessage({ jid, name, from, text, isImage, imageUrl, originalMsgKey }) {
  if (!jid || jid.endsWith('@broadcast') || jid.endsWith('@g.us') || jid.includes('@newsletter')) return;
  const cleanPhone = jid.replace('@s.whatsapp.net', '').replace('@lid', '');

  if (!liveChatsMap.has(jid)) {
    liveChatsMap.set(jid, {
      jid,
      phone: cleanPhone,
      name: name || `+${cleanPhone}`,
      unreadCount: 0,
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
      lastMessageText: text || (isImage ? '📸 Imagen recibida' : ''),
      lastSender: from,
      messages: []
    });
  }

  const chat = liveChatsMap.get(jid);
  if (name && (!chat.name || chat.name.startsWith('+'))) {
    chat.name = name;
  }

  chat.lastMessageAt = Date.now();
  chat.lastMessageText = text || (isImage ? '📸 Imagen recibida' : '');
  chat.lastSender = from;

  if (from === 'customer') {
    chat.unreadCount = (chat.unreadCount || 0) + 1;
  }

  let msgId = originalMsgKey?.id;
  if (!msgId || (chat.messages && chat.messages.some(m => m.id === msgId))) {
    msgId = `${from}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }
  if (!chat.messages) chat.messages = [];
  chat.messages.push({
    id: msgId,
    from, // 'customer' | 'bot' | 'cashier'
    text: text || '',
    isImage: Boolean(isImage),
    imageUrl: imageUrl || null,
    timestamp: Date.now()
  });

  if (chat.messages.length > 60) {
    chat.messages = chat.messages.slice(-60);
  }

  scheduleSaveLiveChats();
}

// =========================================================
// SISTEMA DE PROTECCIÓN ANTIDETECCIÓN & ANTI-BANEO (WhatsApp Business)
// =========================================================

// 1. Control de atención humana (Modo Humano / Hand-over)
// Duración de pausa automática cuando el operador escribe desde el teléfono físico
const HUMAN_PAUSE_DURATION_MS = 25 * 60 * 1000; // 25 minutos
const HUMAN_PAUSE_FILE = path.join(DATA_DIR, 'human_paused_chats.json');
const botSentMessageIds = new Set(); // IDs de mensajes despachados por el propio bot (para no auto-pausarse)

// Caché global de estados notificados a WhatsApp (Anti-duplicación estricta entre bot local y Supabase cloud)
const cloudNotifiedStatusCache = new Set();
const cloudLastForceNotifyTime = new Map();

function markStatusNotified(orderOrId, status, extraNum = null) {
  if (!status) return;
  const normSt = status === 'preparando' ? 'cocina' : String(status).toLowerCase();
  if (typeof orderOrId === 'object' && orderOrId !== null) {
    const o = orderOrId;
    if (o.id) cloudNotifiedStatusCache.add(`${o.id}:${normSt}`);
    if (o.orderNumber) cloudNotifiedStatusCache.add(`${o.orderNumber}:${normSt}`);
    if (o.code) cloudNotifiedStatusCache.add(`${o.code}:${normSt}`);
    if (Array.isArray(o.notifiedStatuses) && !o.notifiedStatuses.includes(normSt)) {
      o.notifiedStatuses.push(normSt);
    }
    if (o.statusTimestamps) {
      if (!Array.isArray(o.statusTimestamps.notifiedStatuses)) {
        o.statusTimestamps.notifiedStatuses = [];
      }
      if (!o.statusTimestamps.notifiedStatuses.includes(normSt)) {
        o.statusTimestamps.notifiedStatuses.push(normSt);
      }
      o.statusTimestamps[`${normSt}NotifiedAt`] = new Date().toISOString();
    }
  } else if (orderOrId) {
    cloudNotifiedStatusCache.add(`${orderOrId}:${normSt}`);
    if (extraNum) cloudNotifiedStatusCache.add(`${extraNum}:${normSt}`);
  }
}

function isStatusAlreadyNotified(orderOrId, status, extraNum = null) {
  if (!status) return false;
  const normSt = status === 'preparando' ? 'cocina' : String(status).toLowerCase();
  if (typeof orderOrId === 'object' && orderOrId !== null) {
    const o = orderOrId;
    if (o.id && cloudNotifiedStatusCache.has(`${o.id}:${normSt}`)) return true;
    if (o.orderNumber && cloudNotifiedStatusCache.has(`${o.orderNumber}:${normSt}`)) return true;
    if (o.code && cloudNotifiedStatusCache.has(`${o.code}:${normSt}`)) return true;
    const notified = Array.isArray(o.notifiedStatuses) ? o.notifiedStatuses : (o.statusTimestamps?.notifiedStatuses || []);
    if (notified.includes(normSt)) return true;
  } else if (orderOrId) {
    if (cloudNotifiedStatusCache.has(`${orderOrId}:${normSt}`)) return true;
    if (extraNum && cloudNotifiedStatusCache.has(`${extraNum}:${normSt}`)) return true;
  }
  return false;
}

function extractCleanDigits(jid) {
  if (!jid || typeof jid !== 'string') return '';
  const withoutDomain = jid.split('@')[0];
  const withoutDevice = withoutDomain.split(':')[0];
  return withoutDevice.replace(/\D/g, '');
}

function loadHumanPausedChats() {
  const map = new Map();
  try {
    if (fs.existsSync(HUMAN_PAUSE_FILE)) {
      const raw = fs.readFileSync(HUMAN_PAUSE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      const now = Date.now();
      for (const [k, v] of Object.entries(data)) {
        if (v && v.pausedUntil > now) {
          map.set(k, v);
        }
      }
    }
  } catch (_) {}
  return map;
}

function saveHumanPausedChats(map) {
  try {
    const obj = {};
    const now = Date.now();
    for (const [k, v] of map.entries()) {
      if (v && v.pausedUntil > now) {
        obj[k] = v;
      }
    }
    fs.writeFileSync(HUMAN_PAUSE_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (_) {}
}

const humanPausedChats = loadHumanPausedChats();

function findHumanPauseEntry(jid) {
  if (!jid) return null;
  const cleanJid = jid.replace(/:.*@/, '@').trim().toLowerCase();
  const now = Date.now();

  // 1. Coincidencia directa por JID limpio
  if (humanPausedChats.has(cleanJid)) {
    const entry = humanPausedChats.get(cleanJid);
    if (entry.pausedUntil > now) return { key: cleanJid, entry };
    humanPausedChats.delete(cleanJid);
    saveHumanPausedChats(humanPausedChats);
  }
  if (humanPausedChats.has(jid)) {
    const entry = humanPausedChats.get(jid);
    if (entry.pausedUntil > now) return { key: jid, entry };
    humanPausedChats.delete(jid);
    saveHumanPausedChats(humanPausedChats);
  }

  // 2. Coincidencia por dígitos telefónicos (últimos 8 a 10 dígitos)
  const incomingDigits = extractCleanDigits(jid);
  if (incomingDigits.length >= 8) {
    const searchSuffix = incomingDigits.slice(-9);
    for (const [storedJid, entry] of humanPausedChats.entries()) {
      if (entry.pausedUntil <= now) {
        humanPausedChats.delete(storedJid);
        continue;
      }
      const storedDigits = entry.phoneDigits || extractCleanDigits(storedJid);
      if (storedDigits.length >= 8) {
        if (storedDigits.endsWith(searchSuffix) || incomingDigits.endsWith(storedDigits.slice(-9))) {
          return { key: storedJid, entry };
        }
      }
    }
    saveHumanPausedChats(humanPausedChats);
  }

  return null;
}

function pauseBotForCustomer(jid, durationMs = null, reason = 'operador_celular') {
  const cleanJid = jid.replace(/:.*@/, '@').trim().toLowerCase();
  const digits = extractCleanDigits(jid);
  const actualDurationMs = durationMs !== null ? durationMs : getHumanPauseDurationMs();
  const pausedUntil = Date.now() + actualDurationMs;
  const entry = {
    pausedUntil,
    reason,
    phoneDigits: digits,
    timestamp: Date.now()
  };
  humanPausedChats.set(cleanJid, entry);
  saveHumanPausedChats(humanPausedChats);
  console.log(`👤 [MODO HUMANO]: Operador escribió a ${cleanJid} (tel: ${digits}). Bot pausado automáticamente por ${Math.round(actualDurationMs / 60000)} minutos.`);
}

function resumeBotForCustomer(jid) {
  const match = findHumanPauseEntry(jid);
  if (match) {
    humanPausedChats.delete(match.key);
    saveHumanPausedChats(humanPausedChats);
    console.log(`🤖 [MODO BOT REANUDADO]: Pausa humana removida para ${jid} (clave: ${match.key}).`);
    return true;
  }
  return false;
}

function getHumanPauseStatus(jid) {
  const match = findHumanPauseEntry(jid);
  if (!match) return { isPaused: false };
  const now = Date.now();
  if (now >= match.entry.pausedUntil) {
    humanPausedChats.delete(match.key);
    saveHumanPausedChats(humanPausedChats);
    return { isPaused: false };
  }
  return {
    isPaused: true,
    remainingMs: match.entry.pausedUntil - now,
    reason: match.entry.reason
  };
}

// 2. Colas de procesamiento por usuario (Anti-Flooding y ejecución secuencial)
const userProcessingQueues = new Map(); // remoteJid -> Promise

class WhatsAppBotServer {
  constructor() {
    this.sock = null;
    this.status = 'disconnected';
    this.qrCode = null;
    this.connectedUser = null;
    this.isStarting = false;
  }

  /**
   * Envío blindado contra detección de bots y spam de WhatsApp.
   * Simula:
   *  1. Lectura humana real (300-600ms + readMessages / doble tilde azul)
   *  2. Evento de presencia "composing" (Escribiendo...)
   *  3. Retraso proporcional al tamaño del mensaje (1.4s - 3.6s) con variación aleatoria
   *  4. Evento de presencia "paused"
   *  5. Despacho real del mensaje
   */
  async safeSendMessage(remoteJid, content, originalMsgKey = null, customDelay = null) {
    // Si es un chat simulado del Tester, registrar en liveChats y omitir envío por red Baileys
    const isSimulatorJid = !remoteJid || remoteJid.startsWith('sim_') || remoteJid.startsWith('test_') || remoteJid.includes('tester');
    if (isSimulatorJid) {
      const textContent = typeof content === 'string' 
        ? content 
        : (content?.text || (content?.caption ? `📸 ${content.caption}` : (content?.image ? '📸 Foto enviada' : '')));
      recordLiveChatMessage({
        jid: remoteJid,
        from: 'bot',
        text: textContent,
        isImage: Boolean(content?.image),
        imageUrl: typeof content?.image === 'string' ? content.image : (content?.image?.url || null),
        originalMsgKey
      });
      return { key: { remoteJid, id: `bot-${Date.now()}` } };
    }

    if (!this.sock) {
      console.warn(`[WHATSAPP BOT] Socket no inicializado para enviar a ${remoteJid}`);
      return null;
    }

    try {
      // 1. Simular lectura humana (doble tilde azul tras pausa natural)
      if (originalMsgKey) {
        try {
          const readDelay = Math.floor(Math.random() * 300) + 300; // 300-600ms
          await new Promise(r => setTimeout(r, readDelay));
          await this.sock.readMessages([originalMsgKey]);
        } catch (_) {}
      }

      // 2. Simular presencia humana "Escribiendo..." (composing)
      try {
        await this.sock.sendPresenceUpdate('composing', remoteJid);
      } catch (_) {}

      // 3. Calcular retardo humano según configuración del Administrador
      const tpls = getBotTemplates();
      const configuredBaseMs = Number(tpls.bot_typing_delay_ms) || 2500;
      const typingMode = tpls.bot_typing_mode || 'human_dynamic';

      let delayMs = configuredBaseMs;
      if (typeof customDelay === 'number') {
        delayMs = customDelay;
      } else if (content?.image) {
        // Subida y despacho de fotos: tiempo base configurado + 600ms-1400ms por procesamiento de imagen
        delayMs = Math.max(configuredBaseMs, 1800) + Math.floor(Math.random() * 800);
      } else if (typeof content?.text === 'string') {
        if (typingMode === 'fixed') {
          // Modo tiempo fijo: milisegundos configurados con micro-variación sutil (±120ms)
          const microJitter = Math.floor(Math.random() * 240) - 120;
          delayMs = Math.max(400, configuredBaseMs + microJitter);
        } else {
          // Modo dinámico humano (Recomendado):
          // Tiempo base configurado + ~14ms por carácter + variación aleatoria humana (±250ms)
          const charCount = content.text.length;
          const charFactor = Math.floor(charCount * 14);
          const jitter = Math.floor(Math.random() * 500) - 250;
          delayMs = Math.max(600, configuredBaseMs + charFactor + jitter);
        }
      }

      console.log(`✍️ [RETARDO TIPEO]: Simulando "Escribiendo..." (${(delayMs / 1000).toFixed(1)}s [${delayMs}ms] - Modo: ${typingMode}) para ${remoteJid}`);
      await new Promise(r => setTimeout(r, delayMs));

      // 4. Pausar "Escribiendo..." justo antes del despacho
      try {
        await this.sock.sendPresenceUpdate('paused', remoteJid);
      } catch (_) {}

      // 5. Envío efectivo del mensaje
      const sentMsg = await this.sock.sendMessage(remoteJid, content);
      if (sentMsg?.key?.id) {
        botSentMessageIds.add(sentMsg.key.id);
        setTimeout(() => botSentMessageIds.delete(sentMsg.key.id), 120000);
      }
      recordLiveChatMessage({
        jid: remoteJid,
        from: 'bot',
        text: typeof content === 'string' ? content : (content?.text || (content?.image ? '📸 Foto enviada' : '')),
        isImage: Boolean(content?.image),
        originalMsgKey: sentMsg?.key
      });
      return sentMsg;
    } catch (err) {
      console.error(`[WHATSAPP BOT] safeSendMessage error enviando a ${remoteJid}:`, err?.message || err);
      try {
        const fallbackSent = await this.sock.sendMessage(remoteJid, content);
        if (fallbackSent?.key?.id) {
          botSentMessageIds.add(fallbackSent.key.id);
          setTimeout(() => botSentMessageIds.delete(fallbackSent.key.id), 120000);
        }
        recordLiveChatMessage({
          jid: remoteJid,
          from: 'bot',
          text: typeof content === 'string' ? content : (content?.text || (content?.image ? '📸 Foto enviada' : '')),
          isImage: Boolean(content?.image),
          originalMsgKey: fallbackSent?.key
        });
        return fallbackSent;
      } catch (fallbackErr) {
        console.error(`[WHATSAPP BOT] Fallback sendMessage falló:`, fallbackErr?.message || fallbackErr);
        return null;
      }
    }
  }

  /**
   * Envía notificación automática de cambio de estado de comanda a WhatsApp
   * @param {Object} order Objeto de pedido
   * @param {string} newStatus 'cocina' | 'listo' | 'entregado'
   * @param {boolean} force Si es true, ignora el filtro anti-duplicados
   */
  async sendOrderStatusNotification(order, newStatus, force = false) {
    if (!this.sock || this.status !== 'connected') {
      console.log(`ℹ️ [NOTIF WHATSAPP]: Bot no conectado. No se pudo enviar notificación para pedido #${order?.orderNumber || order?.id}.`);
      return { success: false, reason: 'bot_disconnected' };
    }

    if (!order) return { success: false, reason: 'order_missing' };

    const targetStatus = (newStatus || '').toLowerCase();
    if (!['cocina', 'listo', 'entregado', 'preparando'].includes(targetStatus)) {
      return { success: false, reason: 'status_ignored' };
    }

    const normalizedStatus = (targetStatus === 'preparando') ? 'cocina' : targetStatus;

    // Control anti-duplicados estricto: memoria local + caché de nube
    if (!force && isStatusAlreadyNotified(order, normalizedStatus)) {
      console.log(`ℹ️ [NOTIF WHATSAPP]: Estado '${normalizedStatus}' ya fue notificado previamente al cliente del pedido #${order.orderNumber || order.id}.`);
      return { success: false, reason: 'already_notified' };
    }

    // Determinar destino JID
    const customerObj = typeof order.customer === 'object' && order.customer ? order.customer : {};
    let targetJid = order.remoteJid || customerObj.remoteJid || null;

    if (!targetJid) {
      const phone = customerObj.phone || order.phone || order.customerPhone || null;
      if (phone) {
        targetJid = formatPhoneToRemoteJid(phone);
      }
    }

    if (!targetJid) {
      console.log(`ℹ️ [NOTIF WHATSAPP]: Pedido #${order.orderNumber || order.id} no tiene teléfono ni remoteJid de WhatsApp asociado.`);
      return { success: false, reason: 'no_phone' };
    }

    // Resolver plantilla y variables
    const tpls = getBotTemplates();
    const vars = getBusinessContext();
    const customerName = customerObj.name || (typeof order.customer === 'string' ? order.customer : 'Cliente') || 'Cliente';
    const orderNum = order.orderNumber || order.code || (order.id ? String(order.id).slice(-4) : 'Comanda');

    // Detección precisa de modo Take Away (Retiro en Local) vs Delivery
    const rawAddr = (customerObj.address || order.address || '').toString().toLowerCase().trim();
    const isTakeAwayAddr = /\b(retiro|mostrador|local|take\s*away|takeaway|salon|salón|sucursal|en el local)\b/i.test(rawAddr);

    const isExplicitTakeAway = (
      order.deliveryType === 'local' ||
      order.deliveryType === 'takeaway' ||
      order.deliveryType === 'mostrador' ||
      order.deliveryType === 'salon' ||
      order.deliveryType === 'pickup' ||
      order.shippingMethod === 'local' ||
      order.shippingMethod === 'takeaway' ||
      order.shippingMethod === 'mostrador' ||
      customerObj.deliveryType === 'local' ||
      customerObj.deliveryType === 'takeaway' ||
      customerObj.deliveryType === 'mostrador' ||
      customerObj.shippingMethod === 'local' ||
      customerObj.shippingMethod === 'takeaway' ||
      customerObj.shippingMethod === 'mostrador' ||
      Boolean(order.tableNumber || order.table_number) ||
      isTakeAwayAddr
    );

    const isDelivery = !isExplicitTakeAway && (
      order.deliveryType === 'delivery' || 
      order.channel === 'delivery' || 
      order.shippingMethod === 'delivery' ||
      customerObj.deliveryType === 'delivery' ||
      customerObj.shippingMethod === 'delivery' ||
      Number(order.deliveryFee || order.delivery_fee || 0) > 0 ||
      (rawAddr.length > 3 && !isTakeAwayAddr)
    );

    // Dirección adecuada según contexto:
    // - Para Retiro en Local: siempre es la dirección física de la hamburguesería (vars.direccion)
    // - Para Envíos a Domicilio: es el domicilio del cliente
    const storeAddress = vars.direccion || 'Nuestro Local (Av. Belgrano 1234, Centro)';
    const customerDeliveryAddress = customerObj.address || order.address || 'tu domicilio';
    const addressToUse = (!isDelivery) ? storeAddress : customerDeliveryAddress;

    let templateText = '';
    if (normalizedStatus === 'cocina') {
      templateText = tpls.template_order_preparing || DEFAULT_SERVER_TEMPLATES.template_order_preparing;
    } else if (normalizedStatus === 'listo') {
      if (isDelivery) {
        templateText = tpls.template_order_ready_delivery || DEFAULT_SERVER_TEMPLATES.template_order_ready_delivery;
      } else {
        templateText = tpls.template_order_ready || DEFAULT_SERVER_TEMPLATES.template_order_ready;
      }
    } else if (normalizedStatus === 'entregado') {
      if (isDelivery) {
        templateText = tpls.template_order_shipped || DEFAULT_SERVER_TEMPLATES.template_order_shipped;
      } else {
        // Para Retiro en Local: NO se envía ningún mensaje al despachar (solo para delivery)
        console.log(`ℹ️ [NOTIF WHATSAPP]: Pedido #${orderNum} es Retiro en Local. No se envía mensaje en 'entregado'/'despachar' (solo para delivery).`);
        markStatusNotified(order, 'entregado');
        return { success: false, reason: 'takeaway_delivered_no_notify' };
      }
    }

    if (!templateText) return { success: false, reason: 'template_empty' };

    // Registrar de inmediato en la caché para evitar que un tick concurrente de Supabase dispare en paralelo
    markStatusNotified(order, normalizedStatus);

    const finalMessage = templateText
      .replace(/{cliente}/gi, customerName)
      .replace(/{pedido_id}/gi, orderNum)
      .replace(/{direccion}/gi, addressToUse)
      .replace(/{total}/gi, Number(order.total || 0).toLocaleString('es-AR'))
      .replace(/{horarios}/gi, vars.horarios)
      .replace(/{demora}/gi, vars.demora || '30 a 45 min');

    console.log(`🚀 [NOTIF WHATSAPP]: Enviando aviso de estado '${normalizedStatus}' (${isDelivery ? 'Delivery' : 'Take Away'}) a ${targetJid} (Pedido #${orderNum})...`);

    let sendResult = await this.safeSendMessage(targetJid, { text: finalMessage });

    const phone = customerObj.phone || order.phone || order.customerPhone || null;
    const phoneJid = phone ? formatPhoneToRemoteJid(String(phone)) : null;
    if (!sendResult && phoneJid && targetJid !== phoneJid) {
      console.log(`🔄 [NOTIF WHATSAPP]: Reintentando envío a número telefónico directo ${phoneJid}...`);
      sendResult = await this.safeSendMessage(phoneJid, { text: finalMessage });
      if (sendResult) {
        targetJid = phoneJid;
      }
    }

    if (sendResult) {
      markStatusNotified(order, normalizedStatus);
      if (!order.notifiedStatuses) order.notifiedStatuses = [];
      if (!order.notifiedStatuses.includes(normalizedStatus)) {
        order.notifiedStatuses.push(normalizedStatus);
      }
      order.lastNotifiedAt = Date.now();

      try {
        const stored = getStoredOrders();
        const sIdx = stored.findIndex(o => o.id === order.id);
        if (sIdx !== -1) {
          stored[sIdx].notifiedStatuses = order.notifiedStatuses;
          stored[sIdx].lastNotifiedAt = order.lastNotifiedAt;
          if (!stored[sIdx].statusTimestamps) stored[sIdx].statusTimestamps = {};
          stored[sIdx].statusTimestamps.notifiedStatuses = order.notifiedStatuses;
          stored[sIdx].statusTimestamps[`${normalizedStatus}NotifiedAt`] = new Date().toISOString();
          fs.writeFileSync(ORDERS_FILE, JSON.stringify(stored, null, 2), 'utf-8');
        }
      } catch (_) {}

      // Sincronizar hacia Supabase Cloud status_timestamps con notifiedStatuses para blindar a cualquier tablet
      if (order.id) {
        fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status_timestamps: {
              ...(order.statusTimestamps || {}),
              notifiedStatuses: order.notifiedStatuses,
              [`${normalizedStatus}NotifiedAt`]: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
        }).catch(() => {});
      }

      console.log(`✅ [NOTIF WHATSAPP]: Notificación de estado '${normalizedStatus}' entregada con éxito a ${targetJid}.`);
      return { success: true, jid: targetJid, status: normalizedStatus };
    } else {
      console.warn(`⚠️ [NOTIF WHATSAPP]: Falló el envío de notificación a ${targetJid}.`);
      return { success: false, reason: 'send_failed' };
    }
  }

  /**
   * Envía confirmación proactiva al WhatsApp del cliente cuando ingresa un pedido desde el Catálogo Web (#catalog)
   * Informa al cliente que su pedido ya está en el sistema del POS y la cocina,
   * envía los datos de pago (Transferencia o Efectivo) y pausa el bot automáticamente
   * para que la cajera o encargado humano tome el control del chat.
   * @param {Object} order Objeto de pedido normalizado
   */
  async sendCatalogOrderConfirmationToCustomer(order) {
    if (!order) return { success: false, reason: 'order_missing' };

    // Si el bot no está conectado y no es un JID simulador, no puede enviar por WhatsApp
    const customerObj = typeof order.customer === 'object' && order.customer ? order.customer : {};
    let targetJid = order.remoteJid || customerObj.remoteJid || null;
    const phone = customerObj.phone || order.phone || order.customerPhone || null;

    if (!targetJid && phone) {
      targetJid = formatPhoneToRemoteJid(String(phone));
    }

    if (!targetJid) {
      console.log(`ℹ️ [NOTIF CATALOGO DIRECTO]: Pedido #${order.orderNumber || order.id} no tiene teléfono ni remoteJid asociado.`);
      return { success: false, reason: 'no_phone' };
    }

    const isSimulatorJid = !targetJid || targetJid.startsWith('sim_') || targetJid.startsWith('test_') || targetJid.includes('tester');
    if (!isSimulatorJid && (!this.sock || this.status !== 'connected')) {
      console.log(`ℹ️ [NOTIF CATALOGO DIRECTO]: Bot no conectado. No se pudo enviar WhatsApp proactivo a ${targetJid}.`);
      return { success: false, reason: 'bot_disconnected' };
    }

    // Control anti-duplicados estricto: evitar enviar múltiples veces el mismo aviso
    if (isStatusAlreadyNotified(order, 'catalogo_confirmado')) {
      console.log(`ℹ️ [NOTIF CATALOGO DIRECTO]: Confirmación ya enviada previamente para pedido #${order.orderNumber || order.id}.`);
      return { success: false, reason: 'already_notified' };
    }

    // Resolver plantilla, variables y datos del negocio
    const tpls = getBotTemplates();
    const vars = getBusinessContext();
    const customerName = customerObj.name || (typeof order.customer === 'string' ? order.customer : 'Cliente') || 'Cliente';
    const orderNum = order.orderNumber || order.code || (order.id ? String(order.id).slice(-4) : 'Comanda');

    // Identificar método de entrega
    const rawAddr = (customerObj.address || order.address || '').toString().toLowerCase().trim();
    const isTakeAway = (
      order.channel === 'mostrador' ||
      order.deliveryType === 'local' ||
      order.deliveryType === 'takeaway' ||
      order.deliveryType === 'mostrador' ||
      customerObj.deliveryType === 'local' ||
      customerObj.deliveryType === 'takeaway' ||
      customerObj.deliveryType === 'mostrador' ||
      rawAddr.includes('retiro') ||
      rawAddr.includes('mostrador') ||
      rawAddr.includes('local')
    );
    const tipoEntrega = isTakeAway 
      ? `Retiro en Local (${vars.direccion || 'Av. Belgrano 1234, Centro'})` 
      : `Envío a Domicilio (${customerObj.address || order.address || 'tu domicilio'})`;

    // Armar detalle de ítems
    let detallePedido = '';
    if (Array.isArray(order.items) && order.items.length > 0) {
      const itemsList = order.items.map(it => {
        const qty = it.qty || it.quantity || 1;
        const name = it.name || 'Producto';
        const mods = Array.isArray(it.selectedMods) && it.selectedMods.length > 0 
          ? ` (${it.selectedMods.map(m => m.name || m).join(', ')})` 
          : '';
        const notes = it.notes ? ` _[${it.notes}]_` : '';
        return `• *${qty}x* ${name}${mods}${notes}`;
      }).join('\n');
      detallePedido = `📋 *Detalle del Pedido:*\n${itemsList}`;
    }

    // Armar instrucciones de pago según paymentMethod
    const payMethod = (order.paymentMethod || order.payment_method || customerObj.paymentMethod || 'efectivo').toString().toLowerCase();
    const isTransfer = payMethod.includes('transf') || payMethod.includes('alias') || payMethod.includes('mp') || payMethod.includes('banco');

    let instruccionesPago = '';
    if (isTransfer) {
      instruccionesPago = `💳 *DATOS PARA TRANSFERENCIA BANCARIA:* 🏦\n` +
        `• *Alias:* \`${vars.alias_banco || 'comandafast.mp'}\`\n` +
        `• *Banco / App:* ${vars.banco || 'Mercado Pago'}\n` +
        `• *Titular:* ${vars.titular || vars.nombre_local}\n` +
        `• *CBU / CVU:* \`${vars.cbu || '0000003100092138928374'}\`\n\n` +
        `📸 *Por favor enviá una captura o comprobante de la transferencia por este chat para que la cajera confirme el pago.*`;
    } else {
      instruccionesPago = `💵 *PAGO EN EFECTIVO:*\n` +
        `Abonás *$${Number(order.total || 0).toLocaleString('es-AR')}* en mano al recibir o retirar tu pedido.`;
    }

    const baseTemplate = tpls.template_catalog_direct_confirmation || DEFAULT_SERVER_TEMPLATES.template_catalog_direct_confirmation;

    const finalMessage = baseTemplate
      .replace(/{cliente}/gi, customerName)
      .replace(/{pedido_id}/gi, String(orderNum))
      .replace(/{nombre_local}/gi, vars.nombre_local)
      .replace(/{total}/gi, Number(order.total || 0).toLocaleString('es-AR'))
      .replace(/{tipo_entrega}/gi, tipoEntrega)
      .replace(/{detalle_pedido}/gi, detallePedido)
      .replace(/{instrucciones_pago}/gi, instruccionesPago)
      .replace(/{direccion}/gi, vars.direccion || 'Nuestro Local')
      .replace(/{horarios}/gi, vars.horarios || '')
      .replace(/{demora}/gi, vars.demora || '30 a 45 min');

    // Marcar en caché antes del envío para evitar concurrencia
    markStatusNotified(order, 'catalogo_confirmado');

    console.log(`🚀 [NOTIF CATALOGO DIRECTO]: Enviando confirmación de pedido #${orderNum} a ${targetJid} (${isTransfer ? 'Transferencia' : 'Efectivo'})...`);

    let sendResult = await this.safeSendMessage(targetJid, { text: finalMessage });

    if (!sendResult && phone) {
      const phoneJid = formatPhoneToRemoteJid(String(phone));
      if (phoneJid && phoneJid !== targetJid) {
        console.log(`🔄 [NOTIF CATALOGO DIRECTO]: Reintentando a número directo ${phoneJid}...`);
        sendResult = await this.safeSendMessage(phoneJid, { text: finalMessage });
        if (sendResult) targetJid = phoneJid;
      }
    }

    if (sendResult) {
      // Pausa automática al bot para este cliente para que la cajera atienda libremente
      const configuredMinutes = Number(tpls.human_mode_sleep_minutes) || 25;
      pauseBotForCustomer(targetJid, configuredMinutes * 60 * 1000, 'pedido_catalogo_online');
      console.log(`👤 [MODO HUMANO]: Bot pausado por ${configuredMinutes} min para ${targetJid} tras recibir pedido #${orderNum} del catálogo.`);

      // Actualizar pedidos almacenados
      try {
        const stored = getStoredOrders();
        const sIdx = stored.findIndex(o => o.id === order.id);
        if (sIdx !== -1) {
          if (!stored[sIdx].notifiedStatuses) stored[sIdx].notifiedStatuses = [];
          if (!stored[sIdx].notifiedStatuses.includes('catalogo_confirmado')) {
            stored[sIdx].notifiedStatuses.push('catalogo_confirmado');
          }
          fs.writeFileSync(ORDERS_FILE, JSON.stringify(stored, null, 2), 'utf-8');
        }
      } catch (_) {}

      // Sincronizar hacia Supabase Cloud
      if (order.id) {
        const curTimestamps = order.statusTimestamps || {};
        const curNotified = Array.isArray(curTimestamps.notifiedStatuses) ? [...curTimestamps.notifiedStatuses] : [];
        if (!curNotified.includes('catalogo_confirmado')) {
          curNotified.push('catalogo_confirmado');
        }
        fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status_timestamps: {
              ...curTimestamps,
              notifiedStatuses: curNotified,
              catalogoConfirmadoAt: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
        }).catch(() => {});
      }

      return { success: true, jid: targetJid };
    } else {
      console.warn(`⚠️ [NOTIF CATALOGO DIRECTO]: Falló el envío a ${targetJid}.`);
      return { success: false, reason: 'send_failed' };
    }
  }

  async start(force = false) {
    if (this.sock && this.status === 'connected' && !force) {
      return { status: this.status, qrCode: this.qrCode };
    }

    if (this.isStarting) {
      return { status: this.status, qrCode: this.qrCode };
    }

    this.isStarting = true;
    this.status = 'connecting';
    console.log('🤖 [WHATSAPP BOT] Inicializando conexión Multi-Device Baileys...');

    try {
      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners();
          this.sock.end(undefined);
        } catch (_) {}
      }
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      let version = [2, 3000, 1015901307];
      try {
        const fetched = await fetchLatestBaileysVersion();
        if (fetched?.version) version = fetched.version;
      } catch (_) {}
      const logger = pino({ level: 'silent' });

      this.sock = makeWASocket({
        version,
        logger,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        browser: Browsers.macOS('Desktop'),
        printQRInTerminal: false,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCode = await QRCode.toDataURL(qr, { scale: 8, margin: 2 });
            this.status = 'qr_ready';
            this.isStarting = false;
            
            console.log('\n=====================================================================');
            console.log('📲  [WHATSAPP BOT] ESCANEÁ ESTE CÓDIGO QR PARA VINCULAR TU WHATSAPP:');
            console.log('=====================================================================\n');
            qrcodeTerminal.generate(qr, { small: true });
            console.log('\n=====================================================================');
            console.log('👉 1. Abrí WhatsApp en tu celular.');
            console.log('👉 2. Andá a Menú (tres puntitos) o Ajustes > Dispositivos vinculados.');
            console.log('👉 3. Tocá "Vincular un dispositivo" y apuntá la cámara al código de arriba.');
            console.log('👉 (También disponible en el panel web: http://localhost:5174/#dueno)');
            console.log('=====================================================================\n');
          } catch (err) {
            console.error('[WHATSAPP BOT] Error al generar código QR:', err);
          }
          if (typeof publishBotStatusToSupabase === 'function') publishBotStatusToSupabase();
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason?.loggedOut;

          this.isStarting = false;

          if (isLoggedOut) {
            console.log('❌ [WHATSAPP BOT] Sesión cerrada desde el teléfono.');
            this.status = 'disconnected';
            this.qrCode = null;
            this.connectedUser = null;
            this.clearAuth();
          } else {
            console.log(`ℹ️ [WHATSAPP BOT] Conexión cerrada (${statusCode || 'reconnect'}). Reconectando en 3s...`);
            this.status = 'connecting';
            setTimeout(() => {
              this.start().catch(() => {});
            }, 3000);
          }
          if (typeof publishBotStatusToSupabase === 'function') publishBotStatusToSupabase();
        } else if (connection === 'open') {
          this.status = 'connected';
          this.qrCode = null;
          this.isStarting = false;
          this.connectedUser = this.sock?.user || null;
          console.log('\n=====================================================================');
          console.log(`✅ [WHATSAPP BOT CONECTADO EXITOSAMENTE]`);
          console.log(`👤 Dispositivo vinculado: ${this.connectedUser?.name || 'ComandaFast Bot'} (${this.connectedUser?.id || ''})`);
          console.log(`🍔 Catálogo listo con ${getStoredProducts().length} productos sincronizados con imágenes.`);
          console.log('=====================================================================\n');
          if (typeof publishBotStatusToSupabase === 'function') publishBotStatusToSupabase();
        }
      });

      // Escuchar mensajes entrantes con máquina conversacional de pedidos
      this.sock.ev.on('messages.upsert', async (chatUpdate) => {
        if (!chatUpdate.messages || chatUpdate.messages.length === 0) return;
        await this.processMessagesList(chatUpdate.messages);
      });

      return { status: this.status, qrCode: this.qrCode };
    } catch (err) {
      console.error('[WHATSAPP BOT] Error al iniciar socket:', err);
      this.status = 'disconnected';
      this.isStarting = false;
      return { status: 'disconnected', error: err.message };
    }
  }

  async processMessagesList(messagesList) {
    if (!Array.isArray(messagesList) || messagesList.length === 0) return;
    const prods = getStoredProducts();

    for (const msg of messagesList) {
          const remoteJid = msg.key?.remoteJid;
          if (!remoteJid) continue;

          // Ignorar estados / historias de WhatsApp y broadcasts
          if (remoteJid === 'status@broadcast' || remoteJid.endsWith('@broadcast')) continue;
          // Ignorar grupos
          if (remoteJid.endsWith('@g.us')) continue;
          // Ignorar canales informativos de WhatsApp
          if (remoteJid.includes('@newsletter')) continue;

          // Si el mensaje fue enviado por el bot mismo (eco socket), ignorar
          if (msg.key?.id && botSentMessageIds.has(msg.key.id)) {
            continue;
          }

          const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
          const isImageMsg = !!msg.message?.imageMessage;
          const lower = text.toLowerCase();

          // -------------------------------------------------------------
          // COMANDOS DE ADMINISTRACIÓN DE VERSIONES Y ACTUALIZACIÓN
          // -------------------------------------------------------------
          const isVersionCmd = lower === '#version' || lower === '#botversion' || lower === '#info';
          const isUpdateCmd = lower === '#actualizar' || lower === '#update' || lower === '#actualizarbot';

          if (isVersionCmd) {
            console.log(`ℹ️ [COMANDO #VERSION]: Solicitado desde ${remoteJid}`);
            try {
              const info = await botUpdateService.checkUpdates();
              const dateStr = info.remoteDate ? new Date(info.remoteDate).toLocaleString('es-AR') : 'N/A';
              const reply = `🤖 *ComandaFast Bot - Estado de Versión*\n\n` +
                `📌 *Commit Local:* \`${info.localCommit}\`\n` +
                `🌐 *Último en GitHub:* \`${info.remoteCommit}\`\n` +
                `📅 *Fecha:* ${dateStr}\n` +
                `📝 *Mensaje:* ${info.remoteMessage || 'N/A'}\n` +
                `📊 *Estado:* ${info.hasUpdate ? '⚠️ *¡Hay una nueva actualización disponible!*' : '✅ *El bot está al día*'}\n\n` +
                (info.hasUpdate ? `👉 Para instalar las mejoras responde *#actualizar*` : '¡Tienes la versión más reciente funcionando!');
              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
            } catch (vErr) {
              await this.safeSendMessage(remoteJid, { text: `❌ Error al consultar versión: ${vErr.message}` }, msg.key);
            }
            continue;
          }

          if (isUpdateCmd) {
            const isFromMe = Boolean(msg.key?.fromMe);
            const senderDigits = extractCleanDigits(remoteJid);
            const vars = getBotVariablesMap();
            const contactPhone = vars.telefono_contacto || '';
            const contactDigits = extractCleanDigits(contactPhone);
            const isAuthorized = isFromMe || (contactDigits && senderDigits.endsWith(contactDigits.slice(-8)));

            if (!isAuthorized) {
              console.warn(`⛔ [INTENTO NO AUTORIZADO DE ACTUALIZACIÓN]: ${remoteJid}`);
              await this.safeSendMessage(remoteJid, { 
                text: '🔒 *Acceso denegado:* El comando de actualización es exclusivo para el administrador del local.' 
              }, msg.key);
              continue;
            }

            console.log(`🔄 [COMANDO #ACTUALIZAR]: Iniciando actualización solicitada por ${remoteJid}...`);
            await this.safeSendMessage(remoteJid, { 
              text: '⏳ *Buscando e instalando actualizaciones desde el repositorio de GitHub...*\nPor favor aguarda unos instantes...' 
            }, msg.key);

            try {
              const result = await botUpdateService.applyUpdate();
              if (result.success) {
                const restartNotice = result.requiresRestart 
                  ? '\n\n🔄 *El servidor del bot se reiniciará en 3 segundos para aplicar todos los cambios.*' 
                  : '';
                await this.safeSendMessage(remoteJid, { 
                  text: `✅ *¡Actualización completada!*\n\n${result.message}${restartNotice}` 
                }, msg.key);
                if (result.requiresRestart) {
                  botUpdateService.scheduleRestart(3000);
                }
              } else {
                await this.safeSendMessage(remoteJid, { 
                  text: `⚠️ *No se pudo completar la actualización:*\n${result.error || result.message}` 
                }, msg.key);
              }
            } catch (uErr) {
              await this.safeSendMessage(remoteJid, { 
                text: `❌ *Error al actualizar:* ${uErr.message}` 
              }, msg.key);
            }
            continue;
          }

          // -------------------------------------------------------------
          // COMANDOS DE ADMINISTRACIÓN DE STOCK Y PRODUCTOS AGOTADOS
          // (#agotados, #agotado [prod], #pausar [prod], #activar [prod], #stock [prod] [cant])
          // -------------------------------------------------------------
          const isStockAdminCmd = lower.startsWith('#agotado') || 
                                  lower.startsWith('#pausar') || 
                                  lower.startsWith('#activar') || 
                                  lower.startsWith('#disponible') || 
                                  lower.startsWith('#stock');

          if (isStockAdminCmd) {
            const isFromMe = Boolean(msg.key?.fromMe);
            const isTester = remoteJid.includes('sim_') || remoteJid.includes('test_');
            const senderDigits = extractCleanDigits(remoteJid);
            const vars = getBotVariablesMap();
            const contactPhone = vars.telefono_contacto || '';
            const contactDigits = extractCleanDigits(contactPhone);
            const isAuthorized = isFromMe || isTester || !contactDigits || senderDigits.endsWith(contactDigits.slice(-8));

            if (!isAuthorized) {
              console.warn(`⛔ [ACCESO DENEGADO COMANDO STOCK]: ${remoteJid}`);
              await this.safeSendMessage(remoteJid, { 
                text: '🔒 *Acceso denegado:* Los comandos de stock son exclusivos para el personal y administración del local.' 
              }, msg.key);
              continue;
            }

            const allProds = getStoredProducts();

            // CASO A: #agotados o #stock sin parámetros -> Listar estado
            if (lower === '#agotados' || lower === '#stock') {
              const outOfStockProds = allProds.filter(p => !isProductAvailable(p));
              const limitedStockProds = allProds.filter(p => isProductAvailable(p) && p.stock !== null && p.stock !== undefined && !isNaN(p.stock));

              let statusText = `📦 *ESTADO DE STOCK Y DISPONIBILIDAD* 🍔\n\n`;
              if (outOfStockProds.length > 0) {
                statusText += `🔴 *PRODUCTOS AGOTADOS / PAUSADOS:*\n` + 
                  outOfStockProds.map(p => `  • *${p.name}*`).join('\n') + `\n\n`;
              } else {
                statusText += `🔴 *PRODUCTOS AGOTADOS:* Ninguno (todos en stock)\n\n`;
              }

              if (limitedStockProds.length > 0) {
                statusText += `🟡 *CON STOCK DIARIO LIMITADO:*\n` + 
                  limitedStockProds.map(p => `  • *${p.name}:* ${p.stock} unidades restantes`).join('\n') + `\n\n`;
              }

              statusText += `🟢 *RESTO DEL MENÚ:* En stock (ilimitado)\n\n` +
                `───────────────────\n` +
                `💡 *Comandos disponibles:*\n` +
                `• *#agotado [nombre o número]* (pausa un producto)\n` +
                `• *#activar [nombre o número]* (lo reactiva en stock)\n` +
                `• *#stock [nombre o número] [cant]* (fija cantidad que se descuenta sola)`;

              await this.safeSendMessage(remoteJid, { text: statusText }, msg.key);
              continue;
            }

            // Helper para buscar producto por texto o número
            const findTargetProduct = (query) => {
              const cleanQuery = query.trim().toLowerCase();
              const num = parseInt(cleanQuery, 10);
              if (!isNaN(num) && num >= 1 && num <= allProds.length && /^\d+$/.test(cleanQuery)) {
                return allProds[num - 1];
              }
              return allProds.find(p => p.name.toLowerCase() === cleanQuery) ||
                     allProds.find(p => p.name.toLowerCase().includes(cleanQuery)) ||
                     findProductByText(cleanQuery, allProds);
            };

            // CASO B: #stock [producto] [cantidad]
            const stockSetMatch = text.match(/^#stock\s+(.+?)\s+(\d+)$/i);
            if (stockSetMatch) {
              const query = stockSetMatch[1];
              const qty = parseInt(stockSetMatch[2], 10);
              const target = findTargetProduct(query);

              if (!target) {
                await this.safeSendMessage(remoteJid, { 
                  text: `⚠️ No se encontró ningún producto con "${query}". Enviá *#agotados* para ver la lista.` 
                }, msg.key);
                continue;
              }

              target.stock = qty;
              target.available = qty > 0;
              target.is_active = qty > 0;
              saveStoredProducts(allProds);
              pushProductUpdateToSupabase(target.id, { available: target.available, is_active: target.is_active, stock: target.stock }).catch(() => {});

              const reply = `📦 *STOCK ACTUALIZADO:* El producto *${target.name}* ahora cuenta con *${qty} unidades* disponibles. Se irán descontando automáticamente con cada pedido confirmado.`;
              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              continue;
            }

            // CASO C: #agotado [producto] o #pausar [producto]
            const agotadoMatch = text.match(/^#(?:agotado|pausar)\s+(.+)$/i);
            if (agotadoMatch) {
              const query = agotadoMatch[1];
              const target = findTargetProduct(query);

              if (!target) {
                await this.safeSendMessage(remoteJid, { 
                  text: `⚠️ No se encontró ningún producto con "${query}". Enviá *#agotados* para ver la lista.` 
                }, msg.key);
                continue;
              }

              target.available = false;
              target.is_active = false;
              target.stock = 0;
              saveStoredProducts(allProds);
              pushProductUpdateToSupabase(target.id, { available: false, is_active: false, stock: 0 }).catch(() => {});

              const reply = `🔴 *PRODUCTO PAUSADO:* *${target.name}* fue marcado como *AGOTADO*. Ya no aparecerá en las promos ni se podrá pedir hasta que sea reactivado.`;
              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              continue;
            }

            // CASO D: #activar [producto] o #disponible [producto]
            const activarMatch = text.match(/^#(?:activar|disponible)\s+(.+)$/i);
            if (activarMatch) {
              const query = activarMatch[1];
              const target = findTargetProduct(query);

              if (!target) {
                await this.safeSendMessage(remoteJid, { 
                  text: `⚠️ No se encontró ningún producto con "${query}". Enviá *#agotados* para ver la lista.` 
                }, msg.key);
                continue;
              }

              target.available = true;
              target.is_active = true;
              if (target.stock !== null && target.stock !== undefined && target.stock <= 0) {
                target.stock = null; // Vuelve a stock ilimitado
              }
              saveStoredProducts(allProds);
              pushProductUpdateToSupabase(target.id, { available: true, is_active: true, stock: target.stock }).catch(() => {});

              const reply = `🟢 *PRODUCTO REACTIVADO:* *${target.name}* vuelve a estar *DISPONIBLE* en el menú y promos (stock ilimitado).`;
              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              continue;
            }
          }

          // Ignorar mensajes con más de 90 segundos de antigüedad (historial masivo al conectar)
          const msgTimestamp = Number(msg.messageTimestamp || 0);
          const nowSec = Math.floor(Date.now() / 1000);
          if (msgTimestamp > 0 && (nowSec - msgTimestamp) > 90) {
            continue;
          }

          // Si el mensaje fue enviado por el operador/dueño desde el propio teléfono físico
          if (msg.key?.fromMe) {
            const isSelfChat = (this.connectedUser?.id && remoteJid.includes(this.connectedUser.id.split(':')[0])) ||
                               (this.connectedUser?.lid && remoteJid.includes(this.connectedUser.lid.split(':')[0])) ||
                               (this.connectedUser?.id && remoteJid === this.connectedUser.id) ||
                               (this.connectedUser?.lid && remoteJid === this.connectedUser.lid);
            if (isSelfChat) {
              // Mensaje personal a sí mismo
              continue;
            }
            pauseBotForCustomer(remoteJid, null, 'operador_celular');
            recordLiveChatMessage({
              jid: remoteJid,
              from: 'cashier',
              text: text || (isImageMsg ? '📸 Imagen enviada desde el celular' : ''),
              isImage: isImageMsg,
              originalMsgKey: msg.key
            });
            continue;
          }

          // Registrar mensaje del cliente en el centro de monitoreo en vivo (visible para el cajero)
          let customerImageBase64 = null;
          if (isImageMsg && this.sock) {
            try {
              const buffer = await downloadMediaMessage(msg, 'buffer', {});
              if (buffer && buffer.length > 0 && buffer.length < 5 * 1024 * 1024) {
                customerImageBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
              }
            } catch (_) {}
          }

          recordLiveChatMessage({
            jid: remoteJid,
            name: msg.pushName || null,
            from: 'customer',
            text: text || (isImageMsg ? '📸 Comprobante / Imagen recibida' : ''),
            isImage: isImageMsg,
            imageUrl: customerImageBase64,
            originalMsgKey: msg.key
          });

          // -------------------------------------------------------------
          // CONTROL DE ATENCIÓN HUMANA (MODO HUMANO / HAND-OVER)
          // Si el operador respondió desde el celular, pausamos el bot para no interrumpir
          // -------------------------------------------------------------
          const humanStatus = getHumanPauseStatus(remoteJid);
          const isExplicitBotReactivation = [
            '#bot', '#activar', 'activar bot', 'reiniciar bot'
          ].includes(lower) || lower === '#menu';

          if (humanStatus.isPaused) {
            if (isExplicitBotReactivation) {
              resumeBotForCustomer(remoteJid);
              console.log(`🤖 [MODO BOT REANUDADO]: Cliente ${remoteJid} reactivó el bot con comando "${text}".`);
            } else {
              console.log(`⏸️ [MODO HUMANO ACTIVO]: Mensaje de ${remoteJid} ("${text}") BLOQUEADO por bot (atención humana activa por ${Math.ceil(humanStatus.remainingMs / 60000)} min más).`);
              continue;
            }
          }

          // Si envió una imagen (ej: comprobante de pago de transferencia)
          if (isImageMsg) {
            console.log(`📸 [WHATSAPP]: Imagen/Comprobante recibido de ${remoteJid}`);
            const orders = getStoredOrders();
            const customerDigits = extractCleanDigits(remoteJid);
            const activeTransferOrder = orders.find(o => {
              if (o.status === 'cancelado' || o.status === 'entregado') return false;
              if (o.paymentMethod !== 'transferencia') return false;
              const oDigits = extractCleanDigits(o.customer?.phone || o.customer?.remoteJid || o.remoteJid || '');
              return oDigits && (oDigits.endsWith(customerDigits.slice(-8)) || customerDigits.endsWith(oDigits.slice(-8)));
            });

            if (activeTransferOrder) {
              activeTransferOrder.paymentStatus = 'comprobante_recibido';
              activeTransferOrder.comprobanteReceivedAt = new Date().toISOString();
              activeTransferOrder.updatedAt = Date.now();
              saveStoredOrder(activeTransferOrder);
              pushOrderToSupabase(activeTransferOrder).catch(() => {});
              const pIdx = pendingOrdersForPos.findIndex(o => o.id === activeTransferOrder.id);
              if (pIdx !== -1) {
                pendingOrdersForPos[pIdx].paymentStatus = 'comprobante_recibido';
                pendingOrdersForPos[pIdx].comprobanteReceivedAt = activeTransferOrder.comprobanteReceivedAt;
              }

              const custName = activeTransferOrder.customer?.name || 'Cliente';
              const reply = `📸 *¡Comprobante de pago recibido con éxito!* 🙌\n\nMuchas gracias *${custName}*. Nuestro equipo en caja está validando la transferencia.\n⏳ En cuanto confirmen el ingreso del dinero, tu pedido pasará inmediatamente a la cocina para su preparación. ¡Te avisamos en instantes! 🔥🍔`;
              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
            } else {
              await this.safeSendMessage(remoteJid, {
                text: '📸 *¡Comprobante / Imagen recibida con éxito!* 🙌\n\nSi es un comprobante de transferencia, el encargado de caja lo revisará a la brevedad para validar tu pedido.'
              }, msg.key);
            }
            continue;
          }

          if (!text) continue;
          console.log(`📩 [WHATSAPP]: De ${remoteJid} -> "${text}"`);

                    const session = getCustomerSession(remoteJid);

          // -------------------------------------------------------------
          // DETECCIÓN Y PROCESAMIENTO AUTOMÁTICO DE PEDIDOS DEL CATÁLOGO WEB ONLINE (#catalog)
          // -------------------------------------------------------------
          const parsedCatalogOrder = parseCatalogOrder(text);
          if (parsedCatalogOrder && parsedCatalogOrder.items && parsedCatalogOrder.items.length > 0) {
            console.log(`🛒 [WHATSAPP BOT] Pedido recibido desde el Catálogo Online de ${remoteJid}:`, parsedCatalogOrder.customerName, `| Pago: ${parsedCatalogOrder.paymentMethod || 'No especificado'}`);
            const cleanDigits = extractCleanDigits(remoteJid);
            const orderNum = parsedCatalogOrder.orderNumber || (await getLatestOrderNumber()) + 1;
            const uniqueOrderId = parsedCatalogOrder.id || ('ord-' + Date.now());
            const displayCode = `CMD-${orderNum}`;
            const orderId = orderNum;
            const biz = getBusinessContext();
            const storeName = biz.nombre_local || "Burga's Chamical";

            const chosenMethod = parsedCatalogOrder.paymentMethod || 'pendiente';
            const chosenStatus = chosenMethod === 'transferencia' 
              ? 'pendiente_comprobante' 
              : (chosenMethod === 'efectivo' ? 'pendiente_efectivo' : 'pendiente_pago');

            const isCash = chosenMethod === 'efectivo';
            const newOrder = {
              id: uniqueOrderId,
              code: displayCode,
              orderNumber: orderNum,
              customer: {
                name: parsedCatalogOrder.customerName || msg.pushName || 'Cliente Catálogo Web',
                phone: parsedCatalogOrder.customerPhone || cleanDigits,
                remoteJid: remoteJid,
                address: parsedCatalogOrder.customerAddress || (parsedCatalogOrder.serviceType === 'delivery' ? 'Domicilio' : 'Retiro en Local')
              },
              remoteJid: remoteJid,
              channel: 'catalogo_online',
              deliveryType: parsedCatalogOrder.serviceType,
              deliveryFee: Number(parsedCatalogOrder.deliveryFee) || 0,
              subtotal: Number(parsedCatalogOrder.subtotal) || Number(parsedCatalogOrder.total) || 0,
              total: Number(parsedCatalogOrder.total) || 0,
              paymentMethod: chosenMethod,
              paymentStatus: chosenStatus,
              paymentConfirmed: isCash,
              items: parsedCatalogOrder.items.map((it, idx) => ({
                id: `cat_${Date.now()}_${idx}`,
                name: it.name,
                price: Number(it.price) || 0,
                unitPrice: Number(it.price) || 0,
                qty: Number(it.qty || 1),
                quantity: Number(it.qty || 1),
                modifiers: []
              })),
              notes: parsedCatalogOrder.notes || '',
              status: isCash ? 'cocina' : 'pendiente',
              notifiedStatuses: isCash ? ['cocina'] : [],
              statusTimestamps: {
                createdAt: new Date().toISOString(),
                cookingAt: isCash ? new Date().toISOString() : null,
                readyAt: null,
                deliveredAt: null,
                notifiedStatuses: isCash ? ['cocina'] : [],
                cocinaNotifiedAt: isCash ? new Date().toISOString() : null
              },
              createdAt: new Date().toISOString(),
              updatedAt: Date.now(),
              source: 'catalogo_online'
            };

            if (isCash) {
              markStatusNotified(newOrder, 'cocina');
              markStatusNotified(displayCode, 'cocina');
              markStatusNotified(orderNum, 'cocina');
              markStatusNotified(uniqueOrderId, 'cocina');
            }

            // Inyectar en almacenamiento y cola para el POS / KDS / Cocina
            saveStoredOrder(newOrder);
            deductStockForOrder(newOrder);
            await pushOrderToSupabase(newOrder);
            pendingOrdersForPos.push(newOrder);
            console.log(`🛎️ [PEDIDO CATÁLOGO WEB]: Pedido #${displayCode} de ${newOrder.customer.name} ($${newOrder.total}) inyectado a cocina y POS. Método: ${chosenMethod}`);

            const itemsSummary = parsedCatalogOrder.items.map(it => `• ${it.qty}x ${it.name} - $${(it.price * it.qty).toLocaleString('es-AR')}`).join('\n');
            const shippingLabel = newOrder.deliveryType === 'delivery' 
              ? `🛵 Envío a Domicilio (${newOrder.customer.address})` 
              : '🛍️ Retiro por el Local (Mostrador)';

            const tplsCatalogMode = getBotTemplates();
            // MODO NUEVO: Catálogo Directo al POS + Pausa Automática para que atienda la Cajera
            if (tplsCatalogMode.menu_mode === 'catalog_direct') {
              resetCustomerSession(remoteJid);
              const isTransfer = chosenMethod === 'transferencia';
              let payInstructions = '';
              if (isTransfer) {
                payInstructions = `💳 *Datos para la Transferencia Bancaria:* 🏦\n` +
                  `• *Alias:* \`${biz.alias_banco}\`\n` +
                  `• *Banco:* ${biz.banco}\n` +
                  `• *Titular:* ${biz.titular}` +
                  (biz.cbu ? `\n• *CBU:* \`${biz.cbu}\`` : '') +
                  `\n\n📸 *Por favor enviá la captura o comprobante por este chat.*`;
              } else {
                payInstructions = `💵 *Abonás en efectivo al ${newOrder.deliveryType === 'delivery' ? 'recibir tu pedido' : 'retirar por el local'}.*`;
              }

              const rawDirectConf = tplsCatalogMode.template_catalog_direct_confirmation || DEFAULT_SERVER_TEMPLATES.template_catalog_direct_confirmation;
              const directReply = interpolateTemplate(rawDirectConf, {
                cliente: newOrder.customer.name,
                nombre_local: storeName,
                pedido_id: orderNum,
                detalle_pedido: `📋 *Detalle del pedido:*\n${itemsSummary}`,
                total: newOrder.total.toLocaleString('es-AR'),
                tipo_entrega: shippingLabel,
                instrucciones_pago: payInstructions,
                ...biz
              });

              await this.safeSendMessage(remoteJid, { text: directReply }, msg.key);

              // Pausa automática al bot para este cliente para que la cajera atienda libremente
              const configuredMinutes = Number(tplsCatalogMode.human_mode_sleep_minutes) || 25;
              pauseBotForCustomer(remoteJid, configuredMinutes * 60 * 1000, 'pedido_catalogo_directo');
              console.log(`🚀 [MODO DIRECTO]: Pedido #${orderNum} de ${newOrder.customer.name} recibido. Bot pausado por ${configuredMinutes}m para atención de cajera.`);
              continue;
            }

            // CASO 1: Ya eligió TRANSFERENCIA en el catálogo web
            if (chosenMethod === 'transferencia') {
              resetCustomerSession(remoteJid);
              const reply = `🎉 *¡RECIBIMOS TU PEDIDO #${orderId} DESDE NUESTRO CATÁLOGO ONLINE!* 🍔🔥\n\n` +
                `¡Muchas gracias *${newOrder.customer.name}*! Tu comanda ya ingresó al sistema de nuestra cocina.\n\n` +
                `📋 *Detalle del pedido:*\n${itemsSummary}\n\n` +
                `💵 *Subtotal:* $${newOrder.subtotal.toLocaleString('es-AR')}\n` +
                (newOrder.deliveryFee > 0 ? `🛵 *Envío:* $${newOrder.deliveryFee.toLocaleString('es-AR')}\n` : '') +
                `💰 *TOTAL A TRANSFERIR:* $${newOrder.total.toLocaleString('es-AR')}\n` +
                `🚀 *Entrega:* ${shippingLabel}` +
                (newOrder.notes ? `\n📝 *Aclaraciones:* ${newOrder.notes}` : '') +
                `\n\n💳 *Datos para la Transferencia Bancaria:* 🏦\n` +
                `• *Alias:* \`${biz.alias_banco}\`\n` +
                `• *Banco:* ${biz.banco}\n` +
                `• *Titular:* ${biz.titular}` +
                (biz.cbu ? `\n• *CBU:* \`${biz.cbu}\`` : '') +
                `\n\n📸 *Por favor enviá la captura o comprobante por este chat para mandarlo a la plancha.* ¡Muchas gracias! 🔥🍔`;

              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              continue;
            }

            // CASO 2: Ya eligió EFECTIVO en el catálogo web
            if (chosenMethod === 'efectivo') {
              resetCustomerSession(remoteJid);
              const reply = `🎉 *¡PEDIDO #${orderId} CONFIRMADO Y ENVIADO A LA COCINA!* 🔥🍔\n\n` +
                `¡Muchas gracias *${newOrder.customer.name}*! Tu comanda ya ingresó a la cocina y está confirmada.\n\n` +
                `📋 *Detalle del pedido:*\n${itemsSummary}\n\n` +
                `💵 *Subtotal:* $${newOrder.subtotal.toLocaleString('es-AR')}\n` +
                (newOrder.deliveryFee > 0 ? `🛵 *Envío:* $${newOrder.deliveryFee.toLocaleString('es-AR')}\n` : '') +
                `💰 *TOTAL EN EFECTIVO:* $${newOrder.total.toLocaleString('es-AR')}\n` +
                `🚀 *Entrega:* ${shippingLabel}` +
                (newOrder.notes ? `\n📝 *Aclaraciones:* ${newOrder.notes}` : '') +
                `\n\n🛵 *Abonás al ${newOrder.deliveryType === 'delivery' ? 'recibir el pedido' : 'retirar por el local'}*. ¡Nuestros cocineros ya están marchando tus burgers! 🍔✨`;

              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              continue;
            }

            // CASO 3: Método no especificado en el catálogo -> preguntar forma de pago (fallback)
            session.step = 'ASK_PAYMENT';
            session.activeOrderId = orderId;
            session.customerName = newOrder.customer.name;
            session.shippingAddress = newOrder.customer.address;
            session.shippingMethod = newOrder.deliveryType;
            session.deliveryFee = newOrder.deliveryFee;
            session.subtotal = newOrder.subtotal;
            session.total = newOrder.total;
            session.items = newOrder.items;

            const reply = `🎉 *¡RECIBIMOS TU PEDIDO #${orderId} DESDE NUESTRO CATÁLOGO ONLINE!* 🍔🔥\n\n¡Muchas gracias *${newOrder.customer.name}*! Tu comanda ya ingresó al sistema de nuestra cocina.\n\n📋 *Detalle del pedido:*\n${itemsSummary}\n\n💵 *Subtotal:* $${newOrder.subtotal.toLocaleString('es-AR')}\n` +
              (newOrder.deliveryFee > 0 ? `🛵 *Envío:* $${newOrder.deliveryFee.toLocaleString('es-AR')}\n` : '') +
              `💰 *TOTAL:* $${newOrder.total.toLocaleString('es-AR')}\n🚀 *Entrega:* ${shippingLabel}` +
              (newOrder.notes ? `\n📝 *Aclaraciones:* ${newOrder.notes}` : '') +
              `\n\n💳 *¿Cómo preferís abonar?*\n\n1️⃣ *Efectivo* (al recibir o retirar)\n2️⃣ *Transferencia Bancaria / Mercado Pago* (Alias: \`${biz.alias_banco}\`)\n\n_Respondé con *1* para Efectivo o *2* para Transferencia._`;

            await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
            continue;
          }

          // -------------------------------------------------------------
          // COMANDOS GLOBALES DE CANCELACIÓN O REINICIO
          // -------------------------------------------------------------
          if (lower === 'cancelar' || lower === 'cancel' || lower === 'borrar') {
            resetCustomerSession(remoteJid);
            await this.safeSendMessage(remoteJid, {
              text: '❌ *Pedido cancelado.*\n\nEscribí *MENU* en cualquier momento para volver a ver las opciones o hacer un nuevo pedido.'
            }, msg.key);
            continue;
          }

          // -------------------------------------------------------------
          // EVALUACIÓN DE FLUJOS PERSONALIZADOS CON CONDICIONES
          // -------------------------------------------------------------
          const activeFlows = getCustomFlows().filter(f => f.enabled);
          let matchedFlow = null;

          for (const flow of activeFlows) {
            const cond = flow.condition || {};
            const keywords = (cond.keywords || []).map(k => k.trim().toLowerCase()).filter(Boolean);
            const matchType = cond.type || 'contains_any';
            const scope = cond.scope || 'always';

            if (scope === 'idle_only' && session.step !== 'IDLE') continue;
            if (scope === 'active_order' && session.step === 'IDLE') continue;

            let isMatch = false;
            if (matchType === 'exact') {
              isMatch = keywords.some(k => lower === k);
            } else if (matchType === 'starts_with') {
              isMatch = keywords.some(k => lower.startsWith(k));
            } else {
              isMatch = keywords.some(k => lower.includes(k));
            }

            if (isMatch) {
              matchedFlow = flow;
              break;
            }
          }

          if (matchedFlow) {
            console.log(`🎯 [WHATSAPP BOT FLUJO]: Activado flujo "${matchedFlow.name}" por mensaje de ${remoteJid}`);
            const action = matchedFlow.action || {};
            let flowReply = action.response || '';
            const biz = getBusinessContext();
            flowReply = interpolateTemplate(flowReply, {
              cliente: msg.pushName || 'Cliente',
              ...biz
            });

            if (action.imageUrl) {
              try {
                if (action.imageUrl.startsWith('data:image')) {
                  const base64Data = action.imageUrl.split(';base64,').pop();
                  const imageBuffer = Buffer.from(base64Data, 'base64');
                  await this.safeSendMessage(remoteJid, { image: imageBuffer, caption: flowReply }, msg.key);
                  continue;
                } else if (action.imageUrl.startsWith('http')) {
                  await this.safeSendMessage(remoteJid, { image: { url: action.imageUrl }, caption: flowReply }, msg.key);
                  continue;
                }
              } catch (imgErr) {
                console.warn('[WHATSAPP BOT] Error enviando imagen del flujo:', imgErr);
              }
            }

            await this.safeSendMessage(remoteJid, { text: flowReply }, msg.key);
            continue;
          }

          // -------------------------------------------------------------
          // COMANDO: FOTO DE UN PRODUCTO ESPECÍFICO
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
              const caption = `🍔 *${target.name}* 🔥\n\n💵 *Precio:* $${Number(target.price).toLocaleString('es-AR')}\n📖 *Detalle:* ${target.description || 'Elaborada artesanalmente en ComandaFast.'}\n${target.modifiers?.length ? '✨ *Modificadores:* ' + target.modifiers.join(', ') + '\n' : ''}\n👉 Para pedirla respondé con *COMPRAR* o su número (*${prods.indexOf(target) + 1}*).`;
              
              if (target.image) {
                try {
                  if (target.image.startsWith('data:image')) {
                    const base64Data = target.image.split(';base64,').pop();
                    const imageBuffer = Buffer.from(base64Data, 'base64');
                    await this.safeSendMessage(remoteJid, { image: imageBuffer, caption }, msg.key);
                    continue;
                  } else if (target.image.startsWith('http')) {
                    await this.safeSendMessage(remoteJid, { image: { url: target.image }, caption }, msg.key);
                    continue;
                  }
                } catch (imgErr) {
                  console.warn('[WHATSAPP BOT] Error al enviar foto por socket:', imgErr);
                }
              }

              await this.safeSendMessage(remoteJid, { text: caption }, msg.key);
              continue;
            } else {
              const withPhotos = prods
                .map((p, idx) => ({ p, idx: idx + 1 }))
                .filter(({ p }) => p.image);
              const previewList = withPhotos.slice(0, 8).map(({ p, idx }) => `${formatItemNumber(idx)} *${p.name}* 📸`).join('\n');
              const helpMsg = `📸 *GALERÍA DE FOTOS (${withPhotos.length} productos con foto)* 🔥\n\n${previewList}\n\n👉 Para ver cualquier foto, escribí *FOTO [número]* (ej: *FOTO 1*, *FOTO 4*, *FOTO 12*).`;
              await this.safeSendMessage(remoteJid, { text: helpMsg }, msg.key);
              continue;
            }
          }

          // -------------------------------------------------------------
          // MÁQUINA DE ESTADOS CONVERSACIONAL DE COMANDAS
          // -------------------------------------------------------------

          // ESTADO: CONFIRMING (Esperando SI / CANCELAR)
          if (session.step === 'CONFIRMING') {
            if (lower === 'si' || lower === 'sí' || lower === 'confirmar' || lower === 'dale' || lower === 'ok' || lower === 's') {
              // Generar número de comanda correlativo sincronizado
              const latestOrderNum = await getLatestOrderNumber();
              const nextOrderNum = latestOrderNum + 1;
              const uniqueOrderId = 'ord-' + Date.now();
              const displayCode = 'CMD-' + nextOrderNum;
              const cleanPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');
              
              const isCash = session.paymentMethod === 'efectivo';
              const newOrder = {
                id: uniqueOrderId,
                code: displayCode,
                orderNumber: nextOrderNum,
                customer: {
                  name: session.customerName || 'Cliente WhatsApp',
                  phone: cleanPhone,
                  remoteJid: remoteJid,
                  address: session.shippingAddress || (session.shippingMethod === 'delivery' ? 'Domicilio' : 'Retiro en Local')
                },
                remoteJid: remoteJid,
                channel: 'whatsapp',
                deliveryType: session.shippingMethod, // 'local' o 'delivery'
                deliveryFee: Number(session.deliveryFee) || 0,
                subtotal: Number(session.subtotal || session.total) || 0,
                total: Number(session.total) || 0,
                paymentMethod: session.paymentMethod, // 'efectivo' o 'transferencia'
                paymentStatus: session.paymentMethod === 'transferencia' ? 'pendiente_comprobante' : 'pendiente_efectivo',
                paymentConfirmed: isCash,
                items: (session.items || []).map((it, idx) => ({
                  id: it.id || `item-${Date.now()}-${idx}`,
                  name: it.name,
                  price: Number(it.price) || 0,
                  unitPrice: Number(it.price) || 0,
                  qty: Number(it.qty || it.quantity || 1),
                  quantity: Number(it.qty || it.quantity || 1),
                  freeShipping: Boolean(it.freeShipping),
                  modifiers: it.modifiers || [],
                  notes: it.notes || ''
                })),
                status: isCash ? 'cocina' : 'pendiente',
                notifiedStatuses: isCash ? ['cocina'] : [],
                statusTimestamps: {
                  createdAt: new Date().toISOString(),
                  cookingAt: isCash ? new Date().toISOString() : null,
                  readyAt: null,
                  deliveredAt: null,
                  notifiedStatuses: isCash ? ['cocina'] : [],
                  cocinaNotifiedAt: isCash ? new Date().toISOString() : null
                },
                createdAt: new Date().toISOString(),
                updatedAt: Date.now(),
                source: 'whatsapp_bot'
              };

              if (isCash) {
                markStatusNotified(newOrder, 'cocina');
                markStatusNotified(displayCode, 'cocina');
                markStatusNotified(nextOrderNum, 'cocina');
                markStatusNotified(uniqueOrderId, 'cocina');
              }

              // Guardar pedido localmente y en cola para el POS / Cocina
              saveStoredOrder(newOrder);
              deductStockForOrder(newOrder);
              await pushOrderToSupabase(newOrder);
              pendingOrdersForPos.push(newOrder);
              console.log(`🔔 [NUEVO PEDIDO WHATSAPP]: Pedido #${displayCode} (${uniqueOrderId}) de ${newOrder.customer.name} ($${newOrder.total}) inyectado.`);

              const itemsList = session.items.map(it => `• ${it.name} (x${it.qty || 1}) - $${(it.price * (it.qty || 1)).toLocaleString('es-AR')}${it.modifiers?.length ? ' [' + it.modifiers.join(', ') + ']' : ''}`).join('\n');
              
              let confirmMsg = '';
              if (session.paymentMethod === 'transferencia') {
                const biz = getBusinessContext();
                confirmMsg = `🎉 *¡PEDIDO #${nextOrderNum} REGISTRADO!* 🍔🔥\n\n¡Muchas gracias *${newOrder.customer.name}*!\n\n📋 *Detalle de tu pedido:*\n${itemsList}\n\n💵 *Total a transferir:* $${newOrder.total.toLocaleString('es-AR')}\n🛵 *Modo:* ${session.shippingMethod === 'delivery' ? '🛵 Envío a Domicilio' : '🛍️ Retiro por el Local'}\n📍 *Dirección:* ${newOrder.customer.address}\n\n💳 *Datos para Transferencia:*\n• *Alias:* \`${biz.alias_banco}\`\n• *Banco:* ${biz.banco}\n• *Titular:* ${biz.titular}${biz.cbu ? `\n• *CBU:* \`${biz.cbu}\`` : ''}\n\n📸 *IMPORTANTE:* Por favor enviá la foto o captura del comprobante por aquí.\n⏳ *Tu pedido quedará pendiente hasta que una persona de nuestro equipo confirme el comprobante y lo mande a cocina.* 🔥`;
              } else {
                confirmMsg = `🎉 *¡PEDIDO #${nextOrderNum} CONFIRMADO Y ENVIADO A LA COCINA!* 🔥🍔\n\n¡Muchas gracias *${newOrder.customer.name}*, tu pedido ya ingresó al sistema de la plancha!\n\n📋 *Detalle:*\n${itemsList}\n\n💵 *Total:* $${newOrder.total.toLocaleString('es-AR')}\n🛵 *Modo:* ${session.shippingMethod === 'delivery' ? '🛵 Envío a Domicilio' : '🛍️ Retiro por el Local'}\n📍 *Dirección:* ${newOrder.customer.address}\n\n💵 *Pago en Efectivo:* Abonás al recibir tu comida. ¡La cocina ya está marchando tus burgers! 🔥`;
              }

              resetCustomerSession(remoteJid);
              await this.safeSendMessage(remoteJid, { text: confirmMsg }, msg.key);
              continue;
            } else if (lower === 'cancelar' || lower === 'no' || lower === 'cancel') {
              resetCustomerSession(remoteJid);
              await this.safeSendMessage(remoteJid, { text: '❌ *Pedido cancelado.* Escribí *MENU* para ver más opciones o iniciar un nuevo pedido.' }, msg.key);
              continue;
            } else {
              await this.safeSendMessage(remoteJid, {
                text: '⚠️ ¿Deseas confirmar tu pedido? Respondé *SI* para mandarlo a la cocina o *CANCELAR* si querés anularlo.'
              }, msg.key);
              continue;
            }
          }

          // ESTADO: ASK_PAYMENT (Forma de pago)
          if (session.step === 'ASK_PAYMENT') {
            if (lower === '1' || lower.includes('efectivo')) {
              session.paymentMethod = 'efectivo';
            } else if (lower === '2' || lower.includes('transferencia') || lower.includes('alias') || lower.includes('mp')) {
              session.paymentMethod = 'transferencia';
            } else {
              await this.safeSendMessage(remoteJid, {
                text: '⚠️ Por favor respondé con *1* para Efectivo o *2* para Transferencia Bancaria:'
              }, msg.key);
              continue;
            }

            // Si proviene de un pedido del catálogo online ya creado (session.activeOrderId):
            if (session.activeOrderId) {
              const orderId = session.activeOrderId;
              const allOrders = getStoredOrders();
              const existingIdx = allOrders.findIndex(o => o.orderNumber === orderId || o.id === `CMD-${orderId}` || o.code === `CMD-${orderId}`);
              const biz = getBusinessContext();
              if (existingIdx !== -1) {
                allOrders[existingIdx].paymentMethod = session.paymentMethod;
                allOrders[existingIdx].paymentStatus = session.paymentMethod === 'transferencia' ? 'pendiente_comprobante' : 'pendiente_efectivo';
                if (session.paymentMethod === 'efectivo') {
                  allOrders[existingIdx].status = 'cocina';
                  allOrders[existingIdx].paymentConfirmed = true;
                  allOrders[existingIdx].statusTimestamps = {
                    ...(allOrders[existingIdx].statusTimestamps || {}),
                    cookingAt: new Date().toISOString()
                  };
                }
                allOrders[existingIdx].updatedAt = Date.now();
                saveStoredOrder(allOrders[existingIdx]);
                await pushOrderToSupabase(allOrders[existingIdx]);
              }

              let confirmMsg = '';
              if (session.paymentMethod === 'transferencia') {
                confirmMsg = `🎉 *¡FORMA DE PAGO REGISTRADA PARA PEDIDO #${orderId}!* 🏦\n\n` +
                  `💵 *Total a transferir:* ${Number(session.total).toLocaleString('es-AR')}\n\n` +
                  `💳 *Datos para la Transferencia:*\n` +
                  `• *Alias:* \`${biz.alias_banco}\`\n` +
                  `• *Banco:* ${biz.banco}\n` +
                  `• *Titular:* ${biz.titular}${biz.cbu ? `\n• *CBU:* \`${biz.cbu}\`` : ''}\n\n` +
                  `📸 *Por favor enviá la captura o comprobante por este chat para mandarlo a la plancha.* ¡Muchas gracias! 🔥🍔`;
              } else {
                confirmMsg = `🎉 *¡PEDIDO #${orderId} CONFIRMADO Y ENVIADO A LA COCINA!* 🔥🍔\n\n` +
                  `¡Muchas gracias *${session.customerName || 'amigo/a'}*!\n` +
                  `💵 *Total en Efectivo:* ${Number(session.total).toLocaleString('es-AR')}\n` +
                  `🛵 Abonás al recibir o retirar tu comida. ¡Nuestros cocineros ya están marchando tus burgers! 🍔✨`;
              }

              resetCustomerSession(remoteJid);
              await this.safeSendMessage(remoteJid, { text: confirmMsg }, msg.key);
              continue;
            }

            session.step = 'CONFIRMING';
            const itemsList = session.items.map(it => `• ${it.name} (x${it.qty || 1}) - $${(it.price * (it.qty || 1)).toLocaleString('es-AR')}${it.modifiers?.length ? ' [' + it.modifiers.join(', ') + ']' : ''}`).join('\n');
            const hasFreeShippingItem = (session.items || []).some(it => it.freeShipping);
            const shippingLabel = session.shippingMethod === 'delivery' 
              ? (session.deliveryFee > 0 
                  ? `🛵 Envío a Domicilio (+$${session.deliveryFee.toLocaleString('es-AR')})` 
                  : (hasFreeShippingItem ? '🛵 Envío a Domicilio (¡Envío Gratis por Promo!)' : '🛵 Envío a Domicilio (¡Envío Gratis!)'))
              : '🛍️ Retiro por el Local (Mostrador)';

            const summary = `🍔 *RESUMEN DE TU PEDIDO* 🔥\n\n🛒 *Items:*\n${itemsList}\n\n💵 *Subtotal:* $${session.subtotal.toLocaleString('es-AR')}\n🛵 *Entrega:* ${shippingLabel}\n📍 *Dirección:* ${session.shippingAddress}\n👤 *Cliente:* ${session.customerName}\n💳 *Forma de Pago:* ${session.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia Bancaria'}\n\n💵 *TOTAL A PAGAR:* $${session.total.toLocaleString('es-AR')}\n\n¿Está todo perfecto para mandar a la cocina?\n👉 Respondé *SI* para confirmar tu pedido o *CANCELAR*.`;
            
            await this.safeSendMessage(remoteJid, { text: summary }, msg.key);
            continue;
          }

          // ESTADO: ASK_NAME (Nombre del cliente)
          if (session.step === 'ASK_NAME') {
            session.customerName = text.trim();
            session.step = 'ASK_PAYMENT';
            await this.safeSendMessage(remoteJid, {
              text: `¡Perfecto *${session.customerName}*! 👍\n\n💳 *¿Cómo preferís abonar?*\n\n1️⃣ *Efectivo* (al recibir o retirar)\n2️⃣ *Transferencia Bancaria / Mercado Pago*\n\n_Respondé con 1 o 2:_`
            }, msg.key);
            continue;
          }

          // ESTADO: ASK_ADDRESS (Dirección para delivery)
          if (session.step === 'ASK_ADDRESS') {
            session.shippingAddress = text.trim();
            session.step = 'ASK_NAME';
            await this.safeSendMessage(remoteJid, {
              text: '👤 *¿A nombre de quién preparamos el pedido?*\n(Escribí tu nombre y apellido):'
            }, msg.key);
            continue;
          }

          // ESTADO: ASK_SHIPPING_METHOD (Las dos opciones: Retiro en local o Delivery)
          if (session.step === 'ASK_SHIPPING_METHOD') {
            if (lower === '1' || lower.includes('retiro') || lower.includes('local') || lower.includes('mostrador') || lower.includes('take away')) {
              session.shippingMethod = 'local';
              session.shippingAddress = 'Retiro en Local (Mostrador)';
              session.deliveryFee = 0;
              session.total = session.subtotal;
              session.step = 'ASK_NAME';
              await this.safeSendMessage(remoteJid, {
                text: '🛍️ *Retiro por el local seleccionado.* (Sin costo de envío)\n\n👤 *¿A nombre de quién registramos el pedido?*\n(Escribí tu nombre y apellido):'
              }, msg.key);
              continue;
            } else if (lower === '2' || lower.includes('envio') || lower.includes('envío') || lower.includes('delivery') || lower.includes('domicilio')) {
              session.shippingMethod = 'delivery';
              const biz = getBusinessContext();
              const rawCost = String(biz.costo_envio || '').replace(/\D/g, '');
              const costoEnvio = parseInt(rawCost, 10) || 0;
              const rawGratis = String(biz.envio_gratis_desde || '').replace(/\D/g, '');
              const gratisDesde = parseInt(rawGratis, 10) || 0;

              const hasFreeShippingItem = (session.items || []).some(it => it.freeShipping);

              if (hasFreeShippingItem) {
                session.deliveryFee = 0;
              } else if (gratisDesde > 0 && session.subtotal >= gratisDesde) {
                session.deliveryFee = 0;
              } else {
                session.deliveryFee = costoEnvio;
              }
              session.total = session.subtotal + session.deliveryFee;

              session.step = 'ASK_ADDRESS';
              const feeText = session.deliveryFee > 0 
                ? `🛵 Costo de envío: *$${session.deliveryFee.toLocaleString('es-AR')}*`
                : (hasFreeShippingItem ? `🛵 Costo de envío: *¡GRATIS POR PROMO!* 🎁🛵` : `🛵 Costo de envío: *¡GRATIS!* 🎉`);
              await this.safeSendMessage(remoteJid, {
                text: `🛵 *Envío a domicilio seleccionado.*\n${feeText}\n\n📍 *Por favor escribí tu dirección exacta y entrecalles para el cadete:*`
              }, msg.key);
              continue;
            } else {
              await this.safeSendMessage(remoteJid, {
                text: '⚠️ Por favor elegí una de las dos opciones:\n\n1️⃣ *Retiro por el local (Take Away)*\n2️⃣ *Envío a domicilio con cadete (Delivery)*'
              }, msg.key);
              continue;
            }
          }

          // ESTADO: SELECTING (Seleccionando productos o modificadores)
          if (session.step === 'SELECTING') {
            if (!Array.isArray(session.items)) session.items = [];
            const tplsSel = getBotTemplates();
            const menuModeSel = tplsSel.menu_mode || 'templates';

            // 1. Ver carrito actual
            const cleanNormSelecting = normalizeSearchText(lower);

            // COMANDO: VER MENÚ O CARTA DESDE MODO SELECTING
            const isMenuOrCatalogQuery = /^(menu|menú|carta|catalogo|catálogo|ver\s+menu|ver\s+menú|ver\s+carta|ver\s+catalogo|inicio|comenzar)$/i.test(cleanNormSelecting);
            if (isMenuOrCatalogQuery) {
              if (session.items.length === 0) {
                session.catalogPage = 1;
                const menuReply = buildMainMenuMessage(msg.pushName);
                await this.safeSendMessage(remoteJid, { text: menuReply }, msg.key);
                continue;
              } else {
                const itemsBrief = session.items.map(it => `• ${it.name} (x${it.qty || 1})`).join(', ');
                const cartHeader = `🛒 *Tu pedido actual sigue guardado:* ${itemsBrief} *(Subtotal: $${(session.total || session.subtotal || 0).toLocaleString('es-AR')})*\n\n`;

                if (menuModeSel === 'catalog' || menuModeSel === 'catalog_direct') {
                  const biz = getBusinessContext();
                  const catalogUrl = biz.catalogo_url;
                  const reply = `${cartHeader}📱 *¡Mirá nuestra Carta Digital con fotos para elegir qué sumar!* 📸\n👉 ${catalogUrl}\n\n_O respondé *LISTO* para avanzar con la entrega._`;
                  await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
                  continue;
                } else {
                  session.catalogPage = session.catalogPage || 1;
                  const catalogText = buildCatalogMessage(prods, session.catalogPage, 8, false);
                  const reply = `${cartHeader}${catalogText}`;
                  await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
                  continue;
                }
              }
            }

            if (/^(carrito|ver\s+carrito|mi\s+carrito|ver\s+pedido|mi\s+pedido|pedido\s+actual)$/i.test(cleanNormSelecting)) {
              if (session.items.length === 0) {
                await this.safeSendMessage(remoteJid, {
                  text: `🛒 *Tu carrito está vacío.*\n\n👉 Respondé con el *NÚMERO* (1 al ${prods.length}) o el nombre de la burger que quieras sumar.\n👉 Escribí *MENU* para ver todas las opciones.`
                }, msg.key);
              } else {
                const itemsList = session.items.map(it => `• ${it.name} (x${it.qty || 1}) - $${((Number(it.price) || 0) * (it.qty || 1)).toLocaleString('es-AR')}${it.modifiers?.length ? ' [' + it.modifiers.join(', ') + ']' : ''}`).join('\n');
                await this.safeSendMessage(remoteJid, {
                  text: `🛒 *TU CARRITO ACTUAL:* 🍔\n\n${itemsList}\n\n💵 *Subtotal:* $${(session.total || session.subtotal || 0).toLocaleString('es-AR')}\n\n👉 Para sumar más: Respondé con el *NÚMERO* o nombre.\n👉 Para quitar: Escribí *QUITAR [número]*.\n👉 O respondé *LISTO* para elegir cómo recibirlo.`
                }, msg.key);
              }
              continue;
            }

            // 2. Quitar / Eliminar producto del carrito (ej: "quitar 1", "quita el pancho", "sacar clásica")
            const removeMatch = lower.match(/^(?:quitar|quita|quiteme|quítame|sacar|saca|sacame|sácame|eliminar|elimina|borrar|borra)\s+(.+)$/i);
            if (removeMatch) {
              const targetStr = removeMatch[1].trim();
              const targetIdx = parseInt(targetStr, 10);
              let removedItem = null;

              if (!isNaN(targetIdx) && targetIdx >= 1 && targetIdx <= session.items.length) {
                removedItem = session.items.splice(targetIdx - 1, 1)[0];
              } else {
                const foundCartIdx = session.items.findIndex(it => cleanTokens(it.name).includes(cleanTokens(targetStr)) || cleanTokens(targetStr).includes(cleanTokens(it.name)));
                if (foundCartIdx !== -1) {
                  removedItem = session.items.splice(foundCartIdx, 1)[0];
                }
              }

              if (removedItem) {
                session.subtotal = session.items.reduce((acc, it) => acc + ((Number(it.price) || 0) * (it.qty || 1)), 0);
                session.total = session.subtotal;
                const itemsList = session.items.length > 0
                  ? session.items.map(it => `• ${it.name} (x${it.qty || 1}) - $${((Number(it.price) || 0) * (it.qty || 1)).toLocaleString('es-AR')}`).join('\n')
                  : '_Tu carrito ahora está vacío._';

                await this.safeSendMessage(remoteJid, {
                  text: `🗑️ *Quitaste ${removedItem.name} de tu pedido.*\n\n🛒 *Carrito actual:*\n${itemsList}\n\n💵 *Nuevo Total:* $${session.total.toLocaleString('es-AR')}\n\n👉 Podés sumar otro producto escribiendo su número o escribir *LISTO* para avanzar.`
                }, msg.key);
                continue;
              } else {
                await this.safeSendMessage(remoteJid, {
                  text: `⚠️ No encontramos ese producto en tu carrito actual. Para quitarlo escribí *QUITAR [número de item]* (ej: *QUITAR 1*).`
                }, msg.key);
                continue;
              }
            }

            // 3. Finalizar armado de carrito y avanzar al checkout (entrega y pago)
            const isCheckoutTrigger = /^(listo|pedir|comprar|terminar|seguir|avanzar|pagar|ya\s+esta|ya\s+está|nada\s+mas|nada\s+más|eso\s+es\s+todo|eso\s+solo|fin)$/i.test(cleanNormSelecting);
            if (isCheckoutTrigger) {
              if (session.items.length === 0) {
                await this.safeSendMessage(remoteJid, {
                  text: `⚠️ Tu pedido está vacío. Escribí el *NÚMERO* (1 al ${prods.length}) de la burger que querés o escribí *MENU*.`
                }, msg.key);
                continue;
              }
              session.step = 'ASK_SHIPPING_METHOD';
              await this.safeSendMessage(remoteJid, {
                text: `🛵 *¿Cómo querés recibir tu pedido?*\n\nRespondé con el número de opción:\n1️⃣ *Retiro por el local (Take Away)* 🏷️ Sin costo\n2️⃣ *Envío a domicilio con cadete (Delivery)*`
              }, msg.key);
              continue;
            }

            // 3.5. Detección de consultas por categoría o lista de categorías en modo plantillas
            if (menuModeSel === 'templates') {
              if (isCategoriesListQuery(text)) {
                const catSummaryMsg = buildCategoriesSummaryMessage(prods);
                await this.safeSendMessage(remoteJid, { text: catSummaryMsg }, msg.key);
                continue;
              }

              const matchedCategory = detectCategoryQuery(text, prods);
              if (matchedCategory) {
                const catMsg = buildCategoryCatalogMessage(matchedCategory, prods, session.items, session.total);
                await this.safeSendMessage(remoteJid, { text: catMsg }, msg.key);
                continue;
              }
            }

            // 4. Consulta a la IA mientras está en SELECTING (dudas de ingredientes, celíacos, recomendaciones)
            if (isCustomerInquiry(text)) {
              try {
                const biz = getBusinessContext();
                const aiReply = await geminiBotService.generateReply(text, {
                  customerName: msg.pushName || '',
                  customerPhone: remoteJid,
                  availableProducts: prods,
                  businessInfo: biz,
                  currentOrder: session.items || [],
                  orderStep: session.step
                });

                if (aiReply) {
                  console.log(`✨ [WHATSAPP IA en SELECTING]: Respondiendo consulta a ${remoteJid}`);
                  await this.safeSendMessage(remoteJid, { text: aiReply }, msg.key);
                  continue;
                }
              } catch (aiErr) {
                console.warn('[WHATSAPP BOT AI SELECTING ERROR]:', aiErr);
              }
            }

            // 5. Detección de modificadores explícitos (ej: "sin cebolla", "extra cheddar", "con panceta")
            const isExplicitModifier = /^(sin|con|extra|sacar|agregar|doble)\s+(cebolla|cheddar|panceta|bacon|queso|salsa|tomate|lechuga|huevo|pepino|mayonesa|mostaza|ketchup|papas)/i.test(lower);
            if (isExplicitModifier && session.items.length > 0) {
              const lastItem = session.items[session.items.length - 1];
              if (!lastItem.modifiers) lastItem.modifiers = [];
              lastItem.modifiers.push(text);
              await this.safeSendMessage(remoteJid, {
                text: `📝 *Modificador agregado a ${lastItem.name}:* "${text}".\n\n👉 ¿Querés sumar algo más? *(Escribí el nombre o número)*\n👉 O escribí *LISTO* para avanzar con la entrega.`
              }, msg.key);
              continue;
            }

            // 6. Selección y adición de productos por número o nombre (con soporte inteligente de cantidades)
            let selectedProd = null;
            let parsedQty = 1;

            // Detección por número: ej "1", "la 1", "sumar 1", "quiero el 2", "dame 1"
            const numOnlyMatch = cleanNormSelecting.match(/^(?:quiero\s+|dame\s+|anotame\s+|sumar\s+|agregar\s+|pedir\s+|llevar\s+|trae\s+|traeme\s+)?(?:el\s+|la\s+|n[uú]mero\s+|numero\s+|nro\s+|#|opci[oó]n\s+|opcion\s+|otro\s+n[uú]mero\s+|otro\s+numero\s+)?(\d+)(?:\s+por\s+favor)?$/i);
            if (numOnlyMatch) {
              const numIdx = parseInt(numOnlyMatch[1], 10);
              if (numIdx >= 1 && numIdx <= prods.length) {
                selectedProd = prods[numIdx - 1];
                parsedQty = 1;
              }
            } else {
              // Búsqueda por texto / nombre (ej: "2 clasicas", "quiero doña burga", "bajonera")
              selectedProd = findProductByText(lower, prods);
              if (selectedProd) {
                parsedQty = parseCustomerQuantity(lower, selectedProd.name);
              }
            }

            if (selectedProd) {
              if (!isProductAvailable(selectedProd)) {
                const outOfStockReply = `⚠️ *¡Lo sentimos mucho!* El producto *${selectedProd.name}* se encuentra *agotado por hoy (hasta agotar stock)* 😔🍔\n\n¿Te gustaría elegir otra de nuestras opciones disponibles? Enviá *MENU* para ver la carta.`;
                await this.safeSendMessage(remoteJid, { text: outOfStockReply }, msg.key);
                continue;
              }

              const existingIdx = session.items.findIndex(it => it.id === selectedProd.id);
              if (existingIdx !== -1) {
                session.items[existingIdx].qty = (session.items[existingIdx].qty || 1) + parsedQty;
                session.items[existingIdx].quantity = session.items[existingIdx].qty;
              } else {
                session.items.push({
                  id: selectedProd.id,
                  name: selectedProd.name,
                  price: Number(selectedProd.price) || 0,
                  freeShipping: Boolean(selectedProd.freeShipping),
                  qty: parsedQty,
                  quantity: parsedQty,
                  modifiers: []
                });
              }

              session.subtotal = session.items.reduce((acc, it) => acc + ((Number(it.price) || 0) * (it.qty || 1)), 0);
              session.total = session.subtotal;

              const itemsList = session.items.map(it => `• ${it.name} (x${it.qty || 1}) - $${((Number(it.price) || 0) * (it.qty || 1)).toLocaleString('es-AR')}${it.modifiers?.length ? ' [' + it.modifiers.join(', ') + ']' : ''}`).join('\n');

              const modsHint = selectedProd.modifiers && selectedProd.modifiers.length > 0 
                ? `\n👉 *Modificadores disponibles:* ${selectedProd.modifiers.join(', ')}`
                : `\n👉 *¿Modificaciones?* (Ej: Sin cebolla, Extra cheddar)`;

              const qtyStr = parsedQty > 1 ? ` (x${parsedQty})` : '';
              await this.safeSendMessage(remoteJid, {
                text: `✅ *¡Sumaste ${selectedProd.name}${qtyStr}!* 🍔 (+$${((Number(selectedProd.price) || 0) * parsedQty).toLocaleString('es-AR')})\n\n🛒 *Tu pedido actual:*\n${itemsList}\n\n💵 *Subtotal:* $${session.total.toLocaleString('es-AR')}\n\n👉 *¿Querés sumar algo más?*\n• Podés pedir directamente por *nombre* (ej: *"1 Coca"*, *"papas"*) o por *número*.\n• Escribí *CARTA* (o *HAMBURGUESAS*, *BEBIDAS*, etc.) para ver la lista sin perder tu carrito.${modsHint}\n👉 O escribí *LISTO* para avanzar con la entrega y el pago.`
              }, msg.key);
              continue;
            }

            // 7. Si el cliente pide explícitamente sumar, agregar o ver otro número / opciones / categorías
            const isAddMoreTrigger = 
              /^(si|sí|dale|ok|claro|por\s+fa|por\s+favor)?\s*(quiero|quisiera|deseo|voy\s+a)?\s*(sumar|sumas|suma|sumo|agregar|agrega|agrego|meter|pedir)\b/i.test(cleanNormSelecting) ||
              /^(si|sí|dale|ok|claro|por\s+favor)?\s*(algo\s+m[aá]s|otra\s+cosa|m[aá]s|mas)\b/i.test(cleanNormSelecting) ||
              /^(otro|otra|otros|otras|otro\s+n[uú]mero|otro\s+numero|otro\s+producto|otra\s+hamburguesa|otra\s+burger|ver\s+m[aá]s|ver\s+mas|quiero\s+otra|quiero\s+otro|dame\s+otra|dame\s+otro|como\s+sumo|como\s+pido)$/i.test(cleanNormSelecting) ||
              /\b(opciones|catalogo|cat[aá]logo|carta|menu|men[uú]|productos|que\s+tienen|que\s+hay|que\s+mas\s+hay|que\s+mas\s+tienen|como\s+veo|ver\s+productos|mostrar\s+productos)\b/i.test(cleanNormSelecting) ||
              cleanNormSelecting.startsWith('sumar') ||
              cleanNormSelecting.startsWith('agregar') ||
              cleanNormSelecting.startsWith('otro ') ||
              cleanNormSelecting.startsWith('otra ');

            if (isAddMoreTrigger) {
              session.catalogPage = session.catalogPage || 1;
              if (session.items.length === 0) {
                const menuReply = buildMainMenuMessage(msg.pushName);
                await this.safeSendMessage(remoteJid, { text: menuReply }, msg.key);
                continue;
              }

              const itemsBrief = session.items.map(it => `• ${it.name} (x${it.qty || 1})`).join(', ');
              const cartHeader = `🛒 *Tu pedido actual sigue guardado:* ${itemsBrief} *(Subtotal: $${(session.total || session.subtotal || 0).toLocaleString('es-AR')})*\n\n`;

              if (menuModeSel === 'catalog' || menuModeSel === 'catalog_direct') {
                const biz = getBusinessContext();
                const catalogUrl = biz.catalogo_url;
                const reply = `${cartHeader}📱 *¡Mirá nuestra Carta Digital con fotos para elegir qué sumar!* 📸\n👉 ${catalogUrl}\n\n_O respondé *LISTO* para finalizar tu pedido._`;
                await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
                continue;
              } else {
                const catalogText = buildCatalogMessage(prods, session.catalogPage, 8, false);
                const reply = `${cartHeader}${catalogText}`;
                await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
                continue;
              }
            }
          }

          // -------------------------------------------------------------
          // COMANDOS DE NAVEGACIÓN Y PAGINACIÓN DEL CATÁLOGO
          // -------------------------------------------------------------
          if (lower === 'siguiente' || lower === 'sig' || lower === 'mas' || lower === 'ver mas' || lower === 'next' || lower === 'otra pagina') {
            const totalPages = Math.ceil(prods.length / 8) || 1;
            session.catalogPage = ((session.catalogPage || 1) % totalPages) + 1;
            const reply = buildCatalogMessage(prods, session.catalogPage, 8, false);
            await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
            continue;
          }

          if (lower === 'anterior' || lower === 'atras' || lower === 'volver' || lower === 'prev') {
            const totalPages = Math.ceil(prods.length / 8) || 1;
            session.catalogPage = Math.max(1, (session.catalogPage || 1) - 1);
            const reply = buildCatalogMessage(prods, session.catalogPage, 8, false);
            await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
            continue;
          }

          if (/^(pag|pagina|página)\s*(\d+)$/i.test(lower)) {
            const pageMatch = lower.match(/\d+/);
            const pNum = parseInt(pageMatch[0], 10);
            session.catalogPage = pNum;
            const reply = buildCatalogMessage(prods, pNum, 8, false);
            await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
            continue;
          }

          if (lower === 'ver todo' || lower === 'todo' || lower === 'todas' || lower === 'completa' || lower === 'completo') {
            const reply = buildCatalogMessage(prods, 1, 8, true);
            await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
            continue;
          }

          // -------------------------------------------------------------
          // DETECCIÓN Y CONSULTA DIRECTA CON IA (PREGUNTAS, INGREDIENTES, DUDAS, RECOMENDACIONES)
          // Se activa prioritariamente cuando el cliente hace una pregunta gastronómica o del local
          // -------------------------------------------------------------
          const cleanNormText = normalizeSearchText(lower);

          if (isCustomerInquiry(text)) {
            // Si la consulta es directamente sobre si quedan promos o si hay promos disponibles, y todas están agotadas:
            const isPromoStockCheck = /\b(promos?|promocion(es)?|ofertas?|combos?)\b/i.test(cleanNormText) &&
                                      /\b(quedan|quedaron|quedo|hay|tienen|tenes|disponible|disponibles|alguna|algun)\b/i.test(cleanNormText);
            const activePromos = prods.filter(p => isProductAvailable(p) && ((p.category || '').toLowerCase() === 'promos' || Boolean(p.discountBadge)));
            if (isPromoStockCheck && activePromos.length === 0) {
              const promoReply = buildPromosMessage(prods);
              await this.safeSendMessage(remoteJid, { text: promoReply }, msg.key);
              continue;
            }

            try {
              const biz = getBusinessContext();
              const aiReply = await geminiBotService.generateReply(text, {
                customerName: msg.pushName || '',
                customerPhone: remoteJid,
                availableProducts: prods,
                businessInfo: biz,
                currentOrder: session.items || [],
                orderStep: session.step
              });

              if (aiReply) {
                console.log(`✨ [WHATSAPP IA]: Respondiendo consulta inteligente a ${remoteJid}: "${text}"`);
                await this.safeSendMessage(remoteJid, { text: aiReply }, msg.key);
                continue;
              }
            } catch (aiErr) {
              console.warn('[WHATSAPP BOT AI ERROR]:', aiErr);
            }
          }

          // -------------------------------------------------------------
          // COMANDO: CONSULTA DIRECTA DE PROMOS ("promos", "ver promos", "ofertas")
          // -------------------------------------------------------------
          const isGeneralPromoInquiry = (
            ['promo', 'promos', 'ver promo', 'ver promos', 'promocion', 'promociones', 'oferta', 'ofertas', 'descuento', 'descuentos', 'combo', 'combos', '0'].includes(cleanNormText) ||
            /^(ver\s+)?(las\s+)?(promos?|promocion(es)?|ofertas?|combos?)$/i.test(cleanNormText) ||
            (/\b(promos?|promocion(es)?|ofertas?|combos?|descuentos?)\b/i.test(cleanNormText) && (
              cleanNormText.includes('que') || cleanNormText.includes('hay') || cleanNormText.includes('tienen') ||
              cleanNormText.includes('tenes') || cleanNormText.includes('cuales') || cleanNormText.includes('ver') ||
              cleanNormText.includes('mostrar') || cleanNormText.includes('quiero') || cleanNormText.includes('disponible') ||
              cleanNormText.includes('quedan') || cleanNormText.includes('quedaron') || cleanNormText.includes('quedo') ||
              cleanNormText.includes('alguna') || cleanNormText.includes('algun')
            ))
          );

          // Si el texto coincide con una promo o producto específico (ej: "promo clasica"), se procesará más abajo para agregarlo directamente
          const directProdCheck = findProductByText(lower, prods);

          if (isGeneralPromoInquiry && !directProdCheck) {
            const tplsPromo = getBotTemplates();
            if (tplsPromo.menu_mode === 'catalog' || tplsPromo.menu_mode === 'catalog_direct') {
              const biz0 = getBusinessContext();
              const catalogUrl0 = biz0.catalogo_url;
              const promoReply = `🏷️ *¡Mirá todas las promociones y combos del día con fotos y precios especiales!* 🍔🔥\n\n📱 Entrá a nuestra carta digital:\n👉 ${catalogUrl0}\n\nElegí tu promo favorita con fotos reales y enviala en un toque. ¡Te esperamos! ✨`;
              await this.safeSendMessage(remoteJid, { text: promoReply }, msg.key);
              continue;
            }
            session.step = 'SELECTING';
            const promoReply = buildPromosMessage(prods);
            await this.safeSendMessage(remoteJid, { text: promoReply }, msg.key);
            continue;
          }

          // -------------------------------------------------------------
          // MENÚ PRINCIPAL Y SALUDOS PUROS (ALTA PRIORIDAD EN MODO IDLE)
          // Solo responde con el menú estructurado si el cliente envía un saludo puro sin consultas
          // -------------------------------------------------------------
          const cleanGreeting = lower.replace(/[!¡?¿,.]/g, ' ').replace(/\s+/g, ' ').trim();
          const isPureGreeting = /^(hola|buenas|buen\s*d[ií]a|buenos\s*d[ií]as|buenas\s*tardes|buenas\s*noches|que\s*tal|holis|hey|saludos)(\s+(hola|buenas|buen\s*d[ií]a|buenos\s*d[ií]as|buenas\s*tardes|buenas\s*noches|que\s*tal|como\s*(estas|andas|va)|todo\s*bien|amigo|amiga|che))?$/i.test(cleanGreeting);
          const isMenuCommand = [
            'menu', 'menú', 'inicio', 'comenzar', 'start', 'opciones', 'ayuda', '#menu'
          ].includes(lower) || isPureGreeting;

          if (isMenuCommand && (session.step === 'IDLE' || session.step === 'SELECTING')) {
            session.catalogPage = 1;
            const tplsMenu = getBotTemplates();
            const currentMenuMode = tplsMenu.menu_mode || 'templates';
            if (currentMenuMode === 'templates') {
              session.step = 'SELECTING';
              if (!Array.isArray(session.items)) session.items = [];
            }
            const menuReply = buildMainMenuMessage(msg.pushName);
            await this.safeSendMessage(remoteJid, { text: menuReply }, msg.key);
            continue;
          }

          // -------------------------------------------------------------
          // COMANDOS DE INFORMACIÓN Y SERVICIO (ESTADO, ALIAS, HORARIOS, HUMANO, CARTA)
          // -------------------------------------------------------------
          if (session.step === 'IDLE' || session.step === 'SELECTING') {
            // CONSULTA DE PROMOCIONES DEL DÍA
            if (lower === 'promo' || lower === 'promos' || lower === 'ofertas' || lower === 'combos') {
              const tpls0 = getBotTemplates();
              const menuMode0 = tpls0.menu_mode || 'catalog';
              if (menuMode0 === 'catalog' || menuMode0 === 'catalog_direct') {
                const biz0 = getBusinessContext();
                const catalogUrl0 = biz0.catalogo_url;
                const promoReply = `🏷️ *¡Mirá todas las promociones y combos del día con fotos y precios especiales!* 🍔🔥\n\n📱 Entrá a nuestra carta digital:\n👉 ${catalogUrl0}\n\nElegí tu promo favorita con fotos reales y enviala en un toque. ¡Te esperamos! ✨`;
                await this.safeSendMessage(remoteJid, { text: promoReply }, msg.key);
              } else {
                session.step = 'SELECTING';
                const promoReply = buildPromosMessage(prods);
                await this.safeSendMessage(remoteJid, { text: promoReply }, msg.key);
              }
              continue;
            }

            // CONSULTAR ESTADO DE PEDIDO
            if (lower === 'estado' || lower === 'mi pedido' || lower === 'mi orden' || lower === 'como viene mi pedido' || lower === 'seguimiento') {
              const cleanPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');
              const allOrders = getStoredOrders();
              // Buscar pedido activo de este cliente (últimas 24 horas y no entregado/cancelado)
              const activeUserOrder = allOrders.slice().reverse().find(o => {
                const custPhone = o.customer?.phone || o.phone || '';
                const matchesPhone = custPhone && (custPhone.includes(cleanPhone.slice(-8)) || cleanPhone.includes(custPhone.slice(-8)));
                const matchesJid = o.remoteJid === remoteJid || o.customer?.remoteJid === remoteJid;
                const isRecent = (Date.now() - new Date(o.createdAt || o.updatedAt || Date.now()).getTime()) < 24 * 60 * 60 * 1000;
                const isActive = o.status !== 'cancelado';
                return (matchesPhone || matchesJid) && isRecent && isActive;
              });

              if (activeUserOrder) {
                const statusMap = {
                  pendiente: '🕒 *Pendiente:* Recibido en cola de espera.',
                  cocina: '👨‍🍳🔥 *En Cocina:* Hamburguesas smashadas en la plancha.',
                  listo: '🔔 *¡Listo para retirar!* Ya podés pasar a buscarlo.',
                  entregado: '🎉 *Entregado:* Pedido despachado con éxito.'
                };
                const itemsList = Array.isArray(activeUserOrder.items)
                  ? activeUserOrder.items.map(it => `• ${it.name} (x${it.qty || it.quantity || 1})`).join('\n')
                  : '';
                const orderNum = activeUserOrder.orderNumber || activeUserOrder.code || activeUserOrder.id;

                const statusText = `📋 *SEGUIMIENTO DE TU PEDIDO* 🔥\n\n` +
                  `🍔 *Pedido:* #${orderNum}\n` +
                  `📊 *Estado actual:* ${statusMap[activeUserOrder.status] || activeUserOrder.status}\n` +
                  `💵 *Total:* $${Number(activeUserOrder.total || 0).toLocaleString('es-AR')}\n` +
                  (itemsList ? `🛒 *Items:*\n${itemsList}\n` : '') +
                  `📍 *Entrega:* ${activeUserOrder.customer?.address || 'Retiro en Local'}\n\n` +
                  `_Te avisaremos automáticamente por aquí cuando haya novedades en la cocina._\n\n_Escribí *MENU* para volver al menú principal._`;

                await this.safeSendMessage(remoteJid, { text: statusText }, msg.key);
                continue;
              } else {
                await this.safeSendMessage(remoteJid, {
                  text: '📋 *Estado de Pedido:*\n\nNo encontramos ningún pedido activo asociado a tu número en este momento.\n\n👉 Para pedir unas hamburguesas recién hechas, escribí *COMPRAR* o *MENU*.'
                }, msg.key);
                continue;
              }
            }

            // DATOS BANCARIOS / TRANSFERENCIA
            if (lower === 'alias' || lower === 'cbu' || lower === 'transferencia' || lower === 'datos banco' || lower === 'datos') {
              const biz = getBusinessContext();
              const tpls = getBotTemplates();
              const rawTpl = tpls.menu_response_2 || `💳 *Datos para Transferencia Bancaria:* 🏦\n\n• *Alias:* \`{alias_banco}\`\n• *Banco:* {banco}\n• *Titular:* {titular}\n• *CBU:* \`{cbu}\`\n\n📸 *Una vez realizada la transferencia, podés enviar la captura o foto del comprobante por este mismo chat.*\n\n_Enviá *MENU* para volver al menú principal._`;
              const reply = interpolateTemplate(rawTpl, { ...biz, cliente: msg.pushName || '' });
              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              continue;
            }

            // HORARIOS Y UBICACIÓN
            if (lower === 'horario' || lower === 'horarios' || lower === 'ubicacion' || lower === 'ubicación' || lower === 'direccion' || lower === 'dirección' || lower === 'donde estan' || lower === 'donde queda') {
              const biz = getBusinessContext();
              const tpls = getBotTemplates();
              const rawTpl = tpls.menu_response_3 || `📍 *Ubicación y Horarios de Atención:* 🕒\n\n🍔 *Dirección:* {direccion}\n⏰ *Horarios de Cocina:* {horarios}\n\n¡Te esperamos con las mejores burgers a la plancha! 🔥\n\n_Enviá *MENU* para volver al menú principal._`;
              const reply = interpolateTemplate(rawTpl, { ...biz, cliente: msg.pushName || '' });
              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              continue;
            }

            // VER CARTA COMPLETA / CATÁLOGO
            if (lower === 'carta' || lower === 'catalogo' || lower === 'catálogo') {
              const tpls4 = getBotTemplates();
              const biz4 = getBusinessContext();
              const menuMode = tpls4.menu_mode || 'templates';
              if (menuMode === 'catalog' || menuMode === 'catalog_direct') {
                // MODO CATÁLOGO ONLINE: envía link al catálogo web con fotos obligatoriamente
                const catalogUrl = biz4.catalogo_url;
                const catalogLink = `🍔 *¡Mirá nuestra carta completa con fotos reales y precios!* 📸\n\n👉 ${catalogUrl}\n\nElegí tus burgers, combos y adicionales con fotos, armá tu carrito y envialo directamente por acá en segundos. ¡Te esperamos! 🔥`;
                await this.safeSendMessage(remoteJid, { text: catalogLink }, msg.key);
              } else {
                // MODO PLANTILLAS CLÁSICO: menú numerado de texto
                session.step = 'SELECTING';
                session.catalogPage = 1;
                if (!Array.isArray(session.items)) session.items = [];
                const reply = buildCatalogMessage(prods, 1, 8, false);
                await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              }
              continue;
            }

            // HABLAR CON UN ENCARGADO / HUMANO
            if (lower === 'humano' || lower === 'asesor' || lower === 'encargado' || lower === 'persona' || lower === 'operador') {
              const biz = getBusinessContext();
              const tpls = getBotTemplates();
              const rawTpl = tpls.menu_response_5 || `👤 *¡Entendido {cliente}! Un encargado de {nombre_local} te responderá a la brevedad.* 🍔\n\nPor favor dejanos tu consulta detallada para que podamos ayudarte lo antes posible. ¡Muchas gracias!`;
              const reply = interpolateTemplate(rawTpl, { ...biz, cliente: msg.pushName || 'amigo/a' });
              pauseBotForCustomer(remoteJid, null, 'cliente_solicito_humano');
              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              continue;
            }

            // INICIAR PEDIDO DIRECTO ('comprar', 'pedir', 'hacer pedido')
            if (lower === 'comprar' || lower === 'pedir' || lower === 'hacer pedido' || lower === 'quiero pedir' || lower === 'hacer una orden' || lower === 'quiero una hamburguesa') {
              const tplsCmp = getBotTemplates();
              const bizCmp = getBusinessContext();
              const menuModeCmp = tplsCmp.menu_mode || 'templates';
              if (menuModeCmp === 'catalog' || menuModeCmp === 'catalog_direct') {
                const catalogUrl = bizCmp.catalogo_url;
                const catalogLink = `🛒 *¡Para realizar tu pedido ingresá a nuestra Carta Digital con fotos!* 🍔📸\n\n👉 ${catalogUrl}\n\nAllí podés ver fotos reales de cada producto, elegir tus adicionales favoritos y enviar tu pedido directo a la cocina con un click. ¡Te esperamos! 🔥`;
                await this.safeSendMessage(remoteJid, { text: catalogLink }, msg.key);
              } else {
                session.step = 'SELECTING';
                session.catalogPage = 1;
                if (!Array.isArray(session.items)) session.items = [];
                const reply = buildCatalogMessage(prods, 1, 8, false);
                await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              }
              continue;
            }
          }

          // -------------------------------------------------------------
          // MODO PLANTILLAS: CONSULTA POR CATEGORÍA O LISTADO DE CATEGORÍAS (IDLE / SELECTING)
          // (ej: "muestrame que hamburguesas tienen", "ver bebidas", "que papas hay", "lomitos", etc.)
          // -------------------------------------------------------------
          const tplsIdle = getBotTemplates();
          const menuModeIdle = tplsIdle.menu_mode || 'templates';
          if (menuModeIdle === 'templates') {
            if (isCategoriesListQuery(text)) {
              const catSummaryMsg = buildCategoriesSummaryMessage(prods);
              await this.safeSendMessage(remoteJid, { text: catSummaryMsg }, msg.key);
              continue;
            }

            const matchedCatQuery = detectCategoryQuery(text, prods);
            if (matchedCatQuery) {
              session.step = 'SELECTING';
              if (!Array.isArray(session.items)) session.items = [];
              const catReply = buildCategoryCatalogMessage(matchedCatQuery, prods, session.items, session.total);
              await this.safeSendMessage(remoteJid, { text: catReply }, msg.key);
              continue;
            }
          }

          // -------------------------------------------------------------
          // SELECCIÓN DIRECTA DE HAMBURGUESAS O PROMOS EN CUALQUIER MOMENTO (NÚMERO O NOMBRE)
          // -------------------------------------------------------------
          const initialNum = parseInt(lower.replace(/\D/g, ''), 10);
          let matchedProd = null;
          let parsedDirectQty = 1;

          if (!isNaN(initialNum) && initialNum >= 1 && initialNum <= prods.length && !lower.includes('hamburguesa') && !lower.includes('burger') && /^(pedir|comprar|la|el|nro|numero)?\s*\d+$/i.test(lower)) {
            matchedProd = prods[initialNum - 1];
            parsedDirectQty = 1;
          } else {
            matchedProd = directProdCheck || findProductByText(lower, prods);
            if (matchedProd) {
              parsedDirectQty = parseCustomerQuantity(lower, matchedProd.name);
            }
          }

          if (matchedProd) {
            // Comprobar si el producto está pausado o sin stock
            if (!isProductAvailable(matchedProd)) {
              const outOfStockReply = `⚠️ *¡Lo sentimos mucho!* El producto *${matchedProd.name}* se encuentra *agotado por hoy (hasta agotar stock)* 😔🍔\n\n¿Te gustaría elegir otra de nuestras opciones disponibles? Enviá *MENU* para ver la carta.`;
              await this.safeSendMessage(remoteJid, { text: outOfStockReply }, msg.key);
              continue;
            }

            const tplsDirect = getBotTemplates();
            const menuModeDirect = tplsDirect.menu_mode || 'templates';
            if (menuModeDirect === 'catalog' || menuModeDirect === 'catalog_direct') {
              // MODO CATÁLOGO ONLINE: no se permite pedir por texto ni plantillas
              const biz = getBusinessContext();
              const catalogUrl = biz.catalogo_url;
              const reply = `🍔 *¡Para pedir ${matchedProd.name}, ingresá a nuestra Carta Digital con fotos!* 📸\n\n👉 ${catalogUrl}\n\nDesde allí podés ver fotos reales, elegir los ingredientes o combos y enviar tu pedido directo a la cocina con un click.`;
              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              continue;
            }

            session.step = 'SELECTING';
            if (!Array.isArray(session.items)) session.items = [];
            
            const existingIdx = session.items.findIndex(it => it.id === matchedProd.id);
            if (existingIdx !== -1) {
              session.items[existingIdx].qty = (session.items[existingIdx].qty || 1) + parsedDirectQty;
              session.items[existingIdx].quantity = session.items[existingIdx].qty;
            } else {
              session.items.push({
                id: matchedProd.id,
                name: matchedProd.name,
                price: Number(matchedProd.price) || 0,
                freeShipping: Boolean(matchedProd.freeShipping),
                qty: parsedDirectQty,
                quantity: parsedDirectQty,
                modifiers: []
              });
            }

            session.subtotal = session.items.reduce((acc, it) => acc + ((Number(it.price) || 0) * (it.qty || 1)), 0);
            session.total = session.subtotal;

            const itemsList = session.items.map(it => `• ${it.name} (x${it.qty || 1}) - $${((Number(it.price) || 0) * (it.qty || 1)).toLocaleString('es-AR')}${it.modifiers?.length ? ' [' + it.modifiers.join(', ') + ']' : ''}`).join('\n');

            const modsHint = matchedProd.modifiers && matchedProd.modifiers.length > 0 
              ? `\n👉 *Modificadores disponibles:* ${matchedProd.modifiers.join(', ')}`
              : `\n👉 *¿Algún cambio?* (Ej: Sin cebolla, Extra cheddar)`;

            const qtyStr = parsedDirectQty > 1 ? ` (x${parsedDirectQty})` : '';
            const reply = `✅ *¡Excelente elección! Sumaste ${matchedProd.name}${qtyStr}* 🍔 (+$${((Number(matchedProd.price) || 0) * parsedDirectQty).toLocaleString('es-AR')})\n\n🛒 *Tu pedido actual:*\n${itemsList}\n\n💵 *Subtotal:* $${session.total.toLocaleString('es-AR')}\n\n👉 *¿Querés sumar algo más?*\n• Podés pedir directamente por *nombre* (ej: *"1 Coca"*, *"papas"*) o por *número*.\n• Escribí *CARTA* (o *HAMBURGUESAS*, *BEBIDAS*, etc.) para ver la lista sin perder tu carrito.${modsHint}\n👉 O respondé *LISTO* para elegir forma de entrega.`;
            await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
            continue;
          }

          // -------------------------------------------------------------
          // FILTRO ANTI-BUCLE Y DETECCIÓN DE CORTESÍA / AGRADECIMIENTOS
          // (Evita spamear el menú completo a clientes que solo dan las gracias o se despiden)
          // -------------------------------------------------------------
          const tpls = getBotTemplates();
          const isAntiLoopEnabled = tpls.anti_loop_enabled !== false;

          if (session.step === 'IDLE' && isAntiLoopEnabled) {
            const cleanText = lower.replace(/[!¡?¿.,;:\-_]/g, ' ').replace(/\s+/g, ' ').trim();
            const { gratitude, farewell, acknowledge } = getAntiLoopWords();

            const isWordMatch = (list) => {
              if (!Array.isArray(list)) return false;
              return list.some(item => {
                const cleanItem = String(item).trim().toLowerCase();
                if (!cleanItem) return false;
                if (cleanText === cleanItem) return true;
                if (cleanText.startsWith(cleanItem + ' ')) return true;
                if (cleanText.endsWith(' ' + cleanItem)) return true;
                if (cleanText.includes(' ' + cleanItem + ' ')) return true;
                return false;
              });
            };

            const isGratitude = isWordMatch(gratitude);
            const isFarewell = isWordMatch(farewell);
            const isAcknowledge = isWordMatch(acknowledge);

            if (isGratitude || isFarewell || isAcknowledge) {
              const now = Date.now();
              const lastCourtesyTime = session.lastCourtesyReplyAt || 0;
              const isRecentCourtesy = (now - lastCourtesyTime) < 10 * 60 * 1000; // 10 minutos de memoria

              // Si ya respondimos cortesía recientemente, reaccionamos con emoji en lugar de spamear otro texto o bucle
              if (isRecentCourtesy) {
                try {
                  await this.sock.sendMessage(remoteJid, { react: { text: '❤️', key: msg.key } });
                } catch (_) {}
                console.log(`🛡️ [ANTI-BUCLE]: Mensaje de cortesía de ${remoteJid} reaccionado con ❤️ para no generar bucle repetitivo.`);
                continue;
              }

              session.lastCourtesyReplyAt = now;

              if (isGratitude) {
                const customReply = tpls.template_anti_loop_gratitude;
                const defaultReplies = [
                  '¡De nada! 🙌 Que lo disfrutes un montón. Si querés consultar la carta o volver a pedir, escribí *MENU* cuando gustes. ¡Buen provecho! 🍔🔥',
                  '¡Un placer enorme atenderte! 😊 Avisanos cualquier cosa que necesites. Escribí *MENU* cuando quieras volver a pedir. ✨',
                  '¡Muchas gracias a vos por tu compra! ❤️ Esperamos que la disfrutes. La cocina queda a tu entera disposición. 🍔'
                ];
                const reply = (customReply && customReply.trim())
                  ? customReply
                  : defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
                await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
                continue;
              }

              if (isFarewell) {
                const biz = getBusinessContext();
                const storeName = biz.nombre_local || "Burga's Chamical";
                const customReply = tpls.template_anti_loop_farewell;
                const defaultReplies = [
                  `¡Hasta la próxima! 👋 Gracias por contactarte con ${storeName}. ¡Que tengas un excelente descanso! ✨🍔`,
                  `¡Nos vemos! Un saludo enorme de todo el equipo de ${storeName}. Escribí *MENU* cuando gustes volver a pedir. 🙌`
                ];
                const reply = (customReply && customReply.trim())
                  ? interpolateTemplate(customReply, { nombre_local: storeName })
                  : defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
                await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
                continue;
              }

              if (isAcknowledge) {
                const customReply = tpls.template_anti_loop_acknowledge;
                const reply = (customReply && customReply.trim())
                  ? customReply
                  : '¡Bárbaro! 👍 Quedamos atentos ante cualquier duda. Escribí *MENU* en cualquier momento para hacer un nuevo pedido.';
                await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
                continue;
              }
            }
          }

          // -------------------------------------------------------------
          // CONSULTA INTELIGENTE CON IA (GEMINI / GROQ)
          // Se activa SOLO para consultas abiertas sobre ingredientes, dudas o recomendaciones
          // que no hayan sido capturadas por el menú ni los comandos de pedido
          // -------------------------------------------------------------
          try {
            const biz = getBusinessContext();
            const tplsAI = getBotTemplates();
            const aiReply = await geminiBotService.generateReply(text, {
              customerName: msg.pushName || '',
              customerPhone: remoteJid,
              availableProducts: prods,
              businessInfo: biz,
              currentOrder: session.items || [],
              orderStep: session.step,
              menuMode: tplsAI.menu_mode || 'catalog',
              catalogUrl: biz.catalogo_url
            });

            if (aiReply) {
              console.log(`✨ [WHATSAPP IA]: Respondiendo consulta a ${remoteJid}`);
              await this.safeSendMessage(remoteJid, { text: aiReply }, msg.key);
              continue;
            }
          } catch (aiErr) {
            console.warn('[WHATSAPP BOT AI ERROR]:', aiErr);
          }

          // SALUDO POR DEFECTO O RECORDATORIO DE PEDIDO EN CURSO
          if (session.step === 'SELECTING' && session.items && session.items.length > 0) {
            const itemsList = session.items.map(it => `• ${it.name} (x${it.qty || 1}) - $${(it.price * (it.qty || 1)).toLocaleString('es-AR')}${it.modifiers?.length ? ' [' + it.modifiers.join(', ') + ']' : ''}`).join('\n');
            const fallbackReply = `🛒 *Tu pedido actual sigue guardado:*\n${itemsList}\n\n💵 *Subtotal:* $${session.total.toLocaleString('es-AR')}\n\n👉 *Para sumar:* Respondé con el *NÚMERO* (1 al ${prods.length}) o escribí su *NOMBRE* (ej: *"1 Coca"*, *"papas"*).\n👉 Escribí *CARTA* (o *HAMBURGUESAS*, *BEBIDAS*, etc.) para ver opciones.\n👉 ¿Algún cambio? (Ej: Sin cebolla, Extra cheddar)\n👉 O respondé *LISTO* para elegir la forma de entrega.`;
            await this.safeSendMessage(remoteJid, { text: fallbackReply }, msg.key);
            continue;
          }

          const fallbackMenu = buildMainMenuMessage(msg.pushName);
          await this.safeSendMessage(remoteJid, { text: fallbackMenu }, msg.key);
        }
  }

  async logout() {
    try {
      if (this.sock) {
        await this.sock.logout().catch(() => {});
        this.sock = null;
      }
    } catch (_) {}
    this.clearAuth();
    this.status = 'disconnected';
    this.qrCode = null;
    this.connectedUser = null;
    this.isStarting = false;
    console.log('🔌 [WHATSAPP BOT] Desvinculado y credenciales borradas.');
    return { success: true };
  }

  clearAuth() {
    try {
      if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      }
    } catch (_) {}
  }
}

const botServer = new WhatsAppBotServer();

// Verificar si se solicita reiniciar sesión o generar nuevo código QR
if (process.argv.includes('--reset') || process.argv.includes('--new-qr')) {
  console.log('\n🔄 [WHATSAPP BOT] Solicitud de nuevo código QR detectada.');
  console.log('🧹 Limpiando sesión previa para vincular un nuevo número...\n');
  botServer.clearAuth();
}

// Iniciar automáticamente
botServer.start().catch(() => {});

// =========================================================
// SUPABASE CLOUD BRIDGE (Permite que Netlify y celulares vean el bot conectado)
// =========================================================
async function publishBotStatusToSupabase() {
  try {
    const now = Date.now();
    let pausedCount = 0;
    const humanChats = [];
    for (const [jid, data] of humanPausedChats.entries()) {
      if (now < data.pausedUntil) {
        pausedCount++;
        humanChats.push({
          jid,
          phone: jid.replace('@s.whatsapp.net', '').replace('@lid', ''),
          remainingMinutes: Math.ceil((data.pausedUntil - now) / 60000),
          reason: data.reason || 'manual',
          pausedAt: new Date(data.timestamp).toISOString()
        });
      } else {
        humanPausedChats.delete(jid);
      }
    }

    const payload = {
      status: botServer.status,
      serverOnline: true,
      qrCode: botServer.status === 'qr_ready' ? botServer.qrCode : null,
      user: botServer.connectedUser ? {
        id: botServer.connectedUser.id,
        name: botServer.connectedUser.name || 'ComandaFast Bot'
      } : null,
      timestamp: Date.now(),
      updatedAt: new Date().toISOString(),
      port: PORT,
      productsCount: getStoredProducts().length,
      antiBanProtection: {
        active: true,
        pausedChatsCount: pausedCount
      },
      activeChats: humanChats
    };

    await pushBotConfigToSupabase('server_status', payload);
  } catch (_) {}
}

// Latido suave hacia Supabase Cloud cada 60 segundos (y al cambiar de estado)
setInterval(publishBotStatusToSupabase, 60000);
setTimeout(publishBotStatusToSupabase, 1500);

// Polling suave de comandos remotos desde la nube (start, logout, resume_chat) cada 25 segundos
async function checkRemoteCommands() {
  try {
    const cmd = await fetchBotConfigFromSupabase('server_commands');
    if (cmd && cmd.id && cmd.status === 'pending' && (Date.now() - cmd.timestamp < 60000)) {
      console.log(`[WHATSAPP BOT] Comando remoto recibido desde Supabase: ${cmd.action}`);
      if (cmd.action === 'start') {
        botServer.start().catch(() => {});
      } else if (cmd.action === 'logout') {
        botServer.clearAuth();
        if (botServer.sock) {
          botServer.sock.logout().catch(() => {});
        }
        botServer.status = 'disconnected';
        botServer.connectedUser = null;
        publishBotStatusToSupabase();
      } else if (cmd.action === 'resume_chat' && cmd.jid) {
        resumeBotForCustomer(cmd.jid);
        publishBotStatusToSupabase();
      } else if (cmd.action === 'sync_config' || cmd.action === 'sync_all') {
        console.log(`[WHATSAPP BOT] Comando remoto '${cmd.action}' recibido. Forzando sincronización completa...`);
        await syncAllFromSupabaseCloud();
      }
      await pushBotConfigToSupabase('server_commands', {
        ...cmd,
        status: 'executed',
        executedAt: new Date().toISOString()
      });
    }
  } catch (_) {}
}
setInterval(checkRemoteCommands, 15000);

// =========================================================
// SYNC ORDER STATUSES & REAL-TIME NOTIFICATIONS FROM SUPABASE CLOUD
// Permite que cuando el personal en Netlify o tablets cambie estados
// (o pulse el botón de notificar en KDS), el bot envíe los mensajes
// =========================================================
let isSyncingCloudOrders = false;
const SERVER_BOOT_TIME = Date.now();
let isCloudOrdersInitialSeedDone = false;

async function syncCloudOrderStatuses() {
  if (isSyncingCloudOrders) return;
  if (!botServer || botServer.status !== 'connected' || !botServer.sock) return;

  isSyncingCloudOrders = true;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&order=updated_at.desc&limit=30`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!res.ok) return;
    const cloudOrders = await res.json();
    if (!Array.isArray(cloudOrders) || cloudOrders.length === 0) return;

    // Si es la primera iteración al bootear el servidor, sembrar caché con órdenes viejas
    if (!isCloudOrdersInitialSeedDone) {
      for (const ord of cloudOrders) {
        if (!ord || !ord.id) continue;
        const normSt = ord.status === 'preparando' ? 'cocina' : (ord.status || '').toLowerCase();
        const timestamps = ord.status_timestamps || {};
        const notified = Array.isArray(timestamps.notifiedStatuses) ? timestamps.notifiedStatuses : [];
        const updatedTime = new Date(ord.updated_at || ord.created_at || 0).getTime();
        const isOldOrder = (SERVER_BOOT_TIME - updatedTime) > 10 * 60 * 1000;
        if (isOldOrder || notified.includes(normSt)) {
          markStatusNotified(ord, normSt);
        }
        if (isOldOrder || notified.includes('catalogo_confirmado')) {
          markStatusNotified(ord, 'catalogo_confirmado');
        }
      }
      isCloudOrdersInitialSeedDone = true;
      console.log(`☁️ [SUPABASE CLOUD ORDERS]: Inicialización completada. ${cloudNotifiedStatusCache.size} estados previos asegurados contra reenvío.`);
      return;
    }

    for (const ord of cloudOrders) {
      if (!ord || !ord.id) continue;

      // 1. Detectar si es un pedido nuevo de catálogo online sin confirmar
      const isCatalogOrder = (ord.source === 'catalogo_online' || ord.channel === 'catalogo_online');
      if (isCatalogOrder && !isStatusAlreadyNotified(ord, 'catalogo_confirmado')) {
        const timestamps = ord.status_timestamps || {};
        const notifiedList = Array.isArray(timestamps.notifiedStatuses) ? timestamps.notifiedStatuses : [];
        if (!notifiedList.includes('catalogo_confirmado')) {
          const ordTime = new Date(ord.updated_at || ord.created_at || Date.now()).getTime();
          if ((Date.now() - ordTime) < 24 * 60 * 60 * 1000) {
            const normalizedCatalogOrder = {
              id: ord.id,
              orderNumber: ord.order_number || ord.orderNumber || (ord.id ? String(ord.id).slice(-4) : 'Comanda'),
              channel: ord.channel || 'catalogo_online',
              customer: ord.customer || {},
              remoteJid: ord.customer?.remoteJid || null,
              phone: ord.customer?.phone || null,
              address: ord.customer?.address || null,
              deliveryType: ord.channel === 'delivery' || ord.delivery_fee > 0 ? 'delivery' : (ord.customer?.deliveryType || 'mostrador'),
              deliveryFee: Number(ord.delivery_fee || 0),
              subtotal: Number(ord.subtotal || ord.total || 0),
              total: Number(ord.total || 0),
              items: Array.isArray(ord.items) ? ord.items : [],
              paymentMethod: ord.payment_method || 'efectivo',
              status: ord.status || 'pendiente',
              statusTimestamps: timestamps
            };

            botServer.sendCatalogOrderConfirmationToCustomer(normalizedCatalogOrder).catch(e => {
              console.warn(`[NOTIF CATALOGO CLOUD] Error enviando confirmación a pedido ${ord.id}:`, e.message);
            });
          }
        }
      }

      const targetStatus = (ord.status || '').toLowerCase();
      if (!['cocina', 'preparando', 'listo', 'entregado'].includes(targetStatus)) continue;

      const normalizedStatus = (targetStatus === 'preparando') ? 'cocina' : targetStatus;
      const cacheKey = `${ord.id}:${normalizedStatus}`;
      const timestamps = ord.status_timestamps || {};
      const notifiedList = Array.isArray(timestamps.notifiedStatuses) ? timestamps.notifiedStatuses : [];

      // Detección de solicitud de reenvío forzado desde el KDS en Netlify
      const forceAtStr = timestamps.forceNotifyAt || null;
      let isForced = false;
      if (forceAtStr) {
        const forceTime = new Date(forceAtStr).getTime();
        const lastForce = cloudLastForceNotifyTime.get(ord.id) || 0;
        if (forceTime > lastForce && (Date.now() - forceTime) < 5 * 60 * 1000) {
          isForced = true;
          cloudLastForceNotifyTime.set(ord.id, forceTime);
        }
      }

      // Si no es forzado y ya fue notificado tanto en caché como en la base de datos, omitir
      if (!isForced && (isStatusAlreadyNotified(ord, normalizedStatus) || notifiedList.includes(normalizedStatus))) {
        continue;
      }

      // Solo notificar si la comanda se actualizó en las últimas 24 horas
      const orderTime = new Date(ord.updated_at || ord.created_at || Date.now()).getTime();
      if (Date.now() - orderTime > 24 * 60 * 60 * 1000) {
        continue;
      }

      // Normalizar objeto de pedido para sendOrderStatusNotification
      const normalizedOrder = {
        id: ord.id,
        orderNumber: ord.order_number || ord.orderNumber || (ord.id ? String(ord.id).slice(-4) : 'Comanda'),
        channel: ord.channel || 'catalogo_online',
        customer: ord.customer || {},
        remoteJid: ord.customer?.remoteJid || null,
        phone: ord.customer?.phone || null,
        address: ord.customer?.address || null,
        deliveryType: ord.channel === 'delivery' || ord.delivery_fee > 0 ? 'delivery' : (ord.customer?.deliveryType || 'mostrador'),
        deliveryFee: Number(ord.delivery_fee || 0),
        subtotal: Number(ord.subtotal || ord.total || 0),
        total: Number(ord.total || 0),
        items: Array.isArray(ord.items) ? ord.items : [],
        paymentMethod: ord.payment_method || 'efectivo',
        status: ord.status,
        notifiedStatuses: [...notifiedList],
        statusTimestamps: timestamps
      };

      const hasContact = normalizedOrder.remoteJid || normalizedOrder.customer?.phone || normalizedOrder.phone;
      if (!hasContact) {
        markStatusNotified(ord, normalizedStatus);
        continue;
      }

      // Marcar preventivamente antes del envío para bloquear concurrencia
      markStatusNotified(ord, normalizedStatus);

      console.log(`☁️ [SUPABASE CLOUD]: Cambio de estado detectado en orden #${normalizedOrder.orderNumber} (${ord.id}) -> '${normalizedStatus}'${isForced ? ' (FORZADO MANUAL)' : ''}. Disparando notificación WhatsApp...`);

      const notifyRes = await botServer.sendOrderStatusNotification(normalizedOrder, normalizedStatus, isForced);
      markStatusNotified(ord, normalizedStatus);

      if (notifyRes && (notifyRes.success || notifyRes.reason === 'takeaway_delivered_no_notify')) {
        const updatedNotified = Array.from(new Set([...notifiedList, normalizedStatus]));
        const updatedTimestamps = {
          ...timestamps,
          notifiedStatuses: updatedNotified,
          [`${normalizedStatus}NotifiedAt`]: new Date().toISOString()
        };

        fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${ord.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status_timestamps: updatedTimestamps,
            updated_at: new Date().toISOString()
          })
        }).catch(() => {});

        try {
          const stored = getStoredOrders();
          const sIdx = stored.findIndex(o => o.id === ord.id);
          if (sIdx !== -1) {
            stored[sIdx].status = normalizedStatus;
            stored[sIdx].notifiedStatuses = updatedNotified;
            stored[sIdx].statusTimestamps = updatedTimestamps;
            fs.writeFileSync(ORDERS_FILE, JSON.stringify(stored, null, 2), 'utf-8');
          }
        } catch (_) {}
      } else if (notifyRes && notifyRes.reason === 'no_phone') {
        markStatusNotified(ord, normalizedStatus);
      }
    }
  } catch (err) {
    // Silently ignore transient network errors
  } finally {
    isSyncingCloudOrders = false;
  }
}

setInterval(syncCloudOrderStatuses, 3500);

// Señal de apagado limpio
process.on('SIGINT', async () => {
  try {
    await pushBotConfigToSupabase('server_status', {
      status: 'disconnected',
      serverOnline: false,
      timestamp: Date.now(),
      updatedAt: new Date().toISOString()
    });
  } catch (_) {}
  process.exit(0);
});

// =========================================================
// ENDPOINTS HTTP
// =========================================================
app.get('/status', (req, res) => {
  const now = Date.now();
  let pausedCount = 0;
  for (const [jid, data] of humanPausedChats.entries()) {
    if (now < data.pausedUntil) {
      pausedCount++;
    } else {
      humanPausedChats.delete(jid);
    }
  }

  res.json({
    status: botServer.status,
    qrCode: botServer.qrCode,
    user: botServer.connectedUser,
    port: PORT,
    productsCount: getStoredProducts().length,
    pendingOrdersCount: pendingOrdersForPos.length,
    antiBanProtection: {
      active: true,
      humanPresenceSimulation: true,
      naturalTypingDelay: true,
      humanTakeoverDetection: true,
      courtesyFilter: true,
      pausedChatsCount: pausedCount
    },
    timestamp: new Date().toISOString()
  });
});

// Endpoint para consultar chats en Modo Humano (pausados por operador)
app.get('/api/human-mode/chats', (req, res) => {
  const now = Date.now();
  const list = [];
  for (const [jid, data] of humanPausedChats.entries()) {
    if (now < data.pausedUntil) {
      list.push({
        jid,
        phone: jid.replace('@s.whatsapp.net', '').replace('@lid', ''),
        remainingMinutes: Math.ceil((data.pausedUntil - now) / 60000),
        reason: data.reason,
        pausedAt: new Date(data.timestamp).toISOString()
      });
    } else {
      humanPausedChats.delete(jid);
    }
  }
  res.json({ success: true, count: list.length, chats: list });
});

// Endpoint para reanudar el bot en un chat manualmente
app.post('/api/human-mode/resume', (req, res) => {
  const { jid } = req.body;
  if (!jid) return res.status(400).json({ error: 'jid requerido' });
  const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
  const wasResumed = resumeBotForCustomer(normalizedJid);
  res.json({ success: true, jid: normalizedJid, resumed: wasResumed });
});

// Endpoint para pausar el bot manualmente desde el panel para un chat
app.post('/api/human-mode/pause', (req, res) => {
  const { jid, minutes } = req.body;
  if (!jid) return res.status(400).json({ error: 'jid requerido' });
  const configuredMinutes = Number(getBotTemplates().human_mode_sleep_minutes) || 25;
  const pauseMinutes = Number(minutes) || configuredMinutes;
  const durationMs = pauseMinutes * 60 * 1000;
  const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
  pauseBotForCustomer(normalizedJid, durationMs, 'panel_administrador');
  res.json({ success: true, jid: normalizedJid, minutes: Math.round(durationMs / 60000) });
});

// =========================================================
// ENDPOINTS DE MONITOREO Y CONTROL DE CHATS EN VIVO (POS / CAJERO)
// =========================================================

// 1. Obtener lista de todos los chats activos ordenados por actividad reciente
app.get('/api/bot/live-chats', (req, res) => {
  try {
    const now = Date.now();
    const result = [];

    for (const [jid, chat] of liveChatsMap.entries()) {
      const pauseData = humanPausedChats.get(jid);
      const isPaused = pauseData && now < pauseData.pausedUntil;
      const remainingPauseMinutes = isPaused ? Math.ceil((pauseData.pausedUntil - now) / 60000) : 0;
      const session = customerSessions.get(jid) || null;

      result.push({
        jid: chat.jid,
        phone: chat.phone,
        name: chat.name || `+${chat.phone}`,
        unreadCount: chat.unreadCount || 0,
        lastMessageAt: chat.lastMessageAt || chat.createdAt || now,
        lastMessageText: chat.lastMessageText || '',
        lastSender: chat.lastSender || 'customer',
        messageCount: (chat.messages || []).length,
        isPaused: Boolean(isPaused),
        remainingPauseMinutes,
        pauseReason: isPaused ? pauseData.reason : null,
        cartItems: (session && Array.isArray(session.items)) ? session.items : [],
        session: session ? {
          step: session.step || 'IDLE',
          items: session.items || [],
          subtotal: session.subtotal || 0,
          total: session.total || 0,
          shippingMethod: session.shippingMethod || 'local',
          shippingAddress: session.shippingAddress || '',
          customerName: session.customerName || '',
          paymentMethod: session.paymentMethod || 'efectivo'
        } : null
      });
    }

    result.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));

    res.json({
      success: true,
      botOnline: botServer.status === 'connected',
      chats: result,
      total: result.length,
      timestamp: now
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Obtener historial de mensajes de un chat específico (y marcar como leído)
app.get('/api/bot/live-chats/:jid/messages', (req, res) => {
  try {
    const { jid } = req.params;
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    const chat = liveChatsMap.get(normalizedJid);

    if (!chat) {
      return res.json({ success: true, messages: [], chat: null, session: null });
    }

    // Resetear contador de no leídos al abrir
    chat.unreadCount = 0;
    scheduleSaveLiveChats();

    const pauseData = humanPausedChats.get(normalizedJid);
    const now = Date.now();
    const isPaused = pauseData && now < pauseData.pausedUntil;

    res.json({
      success: true,
      jid: normalizedJid,
      name: chat.name,
      phone: chat.phone,
      isPaused: Boolean(isPaused),
      remainingPauseMinutes: isPaused ? Math.ceil((pauseData.pausedUntil - now) / 60000) : 0,
      messages: chat.messages || [],
      session: customerSessions.get(normalizedJid) || null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Enviar mensaje manual desde el panel del cajero al cliente
app.post('/api/bot/live-chats/:jid/send', async (req, res) => {
  try {
    const { jid } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'El texto del mensaje no puede estar vacío.' });
    }

    if (!botServer.sock || botServer.status !== 'connected') {
      return res.status(503).json({ error: 'El bot de WhatsApp no está conectado actualmente.' });
    }

    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;

    // Pausar bot automáticamente para evitar conflicto con la atención humana del cajero
    const configuredMinutes = Number(getBotTemplates().human_mode_sleep_minutes) || 25;
    pauseBotForCustomer(normalizedJid, configuredMinutes * 60 * 1000, 'cajero_pos');

    // Despacho real en WhatsApp
    const sentMsg = await botServer.sock.sendMessage(normalizedJid, { text: text.trim() });
    if (sentMsg?.key?.id) {
      botSentMessageIds.add(sentMsg.key.id);
    }

    // Registrar en liveChatsMap
    recordLiveChatMessage({
      jid: normalizedJid,
      from: 'cashier',
      text: text.trim(),
      originalMsgKey: sentMsg?.key
    });

    res.json({
      success: true,
      jid: normalizedJid,
      pausedMinutes: configuredMinutes,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error('❌ Error enviando mensaje manual desde POS:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Pausar o reanudar bot para un cliente específico
app.post('/api/bot/live-chats/:jid/toggle-pause', (req, res) => {
  try {
    const { jid } = req.params;
    const { pause, minutes } = req.body;
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;

    if (pause) {
      const configuredMinutes = Number(getBotTemplates().human_mode_sleep_minutes) || 25;
      const durMs = (Number(minutes) || configuredMinutes) * 60 * 1000;
      pauseBotForCustomer(normalizedJid, durMs, 'cajero_panel');
      res.json({ success: true, isPaused: true, remainingMinutes: Math.round(durMs / 60000) });
    } else {
      resumeBotForCustomer(normalizedJid);
      res.json({ success: true, isPaused: false });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Resetear sesión y vaciar carrito del cliente
app.post('/api/bot/live-chats/:jid/reset-session', (req, res) => {
  try {
    const { jid } = req.params;
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    customerSessions.delete(normalizedJid);
    res.json({ success: true, message: 'Sesión reseteada correctamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para obtener plantillas del bot
app.get('/api/bot-templates', (req, res) => {
  res.json({ success: true, templates: getBotTemplates() });
});

// Endpoint para actualizar plantillas y configuración del negocio
app.post('/api/bot-templates', (req, res) => {
  const { templates } = req.body;
  if (templates && typeof templates === 'object') {
    saveBotTemplates(templates);
    pushBotConfigToSupabase('templates', templates).catch(() => {});
    return res.json({ success: true, templates });
  }
  res.status(400).json({ error: 'Objeto templates requerido' });
});

app.post('/start', async (req, res) => {
  const result = await botServer.start(true);
  res.json(result);
});

app.post('/logout', async (req, res) => {
  const result = await botServer.logout();
  res.json(result);
});

// Endpoint para sincronizar productos y fotos desde la base de datos / frontend
app.post('/sync-products', (req, res) => {
  const products = Array.isArray(req.body) ? req.body : req.body?.products;
  if (Array.isArray(products)) {
    try {
      saveStoredProducts(products);
      console.log(`📦 [WHATSAPP BOT] Sincronizados ${products.length} productos con fotos y stock para el chatbot.`);
      return res.json({ success: true, count: products.length });
    } catch (err) {
      console.error('[WHATSAPP BOT] Error al guardar products.json:', err);
      return res.status(500).json({ error: err.message });
    }
  }
  res.status(400).json({ error: 'Array de productos inválido' });
});

// Endpoint para que el POS (App.jsx) consuma los pedidos pendientes en tiempo real
app.get('/api/orders/pending', (req, res) => {
  res.json({ success: true, orders: pendingOrdersForPos });
});

// Confirmación de que el POS recibió e inyectó los pedidos
app.post('/api/orders/ack', (req, res) => {
  const { ids } = req.body;
  if (Array.isArray(ids)) {
    pendingOrdersForPos = pendingOrdersForPos.filter(o => !ids.includes(o.id));
    return res.json({ success: true, remaining: pendingOrdersForPos.length });
  }
  res.status(400).json({ error: 'Array de ids requerido' });
});

// Endpoint para que la App Android o cualquier terminal inyecte pedidos en tiempo real
app.post('/api/orders', async (req, res) => {
  const order = req.body;
  if (!order || !order.id) {
    return res.status(400).json({ success: false, error: 'Pedido inválido o sin id' });
  }

  let assignedNumber = Number(order.orderNumber || order.order_number) || 0;
  if (assignedNumber <= 0) {
    const latest = await getLatestOrderNumber();
    assignedNumber = latest + 1;
  }

  const normalizedOrder = {
    id: order.id,
    orderNumber: assignedNumber,
    channel: order.channel || 'mostrador',
    tableNumber: order.tableNumber || order.table_number || '',
    customer: typeof order.customer === 'object' ? order.customer : {
      name: order.customerName || order.customer || 'Cliente',
      phone: order.customerPhone || '',
      address: order.customerAddress || ''
    },
    items: Array.isArray(order.items) ? order.items : [],
    subtotal: Number(order.subtotal) || Number(order.total) || 0,
    deliveryFee: Number(order.deliveryFee) || 0,
    total: Number(order.total) || 0,
    paymentMethod: order.paymentMethod || order.payment_method || 'efectivo',
    status: order.status || 'pendiente',
    statusTimestamps: order.statusTimestamps || { pendiente: Date.now() },
    createdAt: order.createdAt || new Date().toISOString(),
    updatedAt: Date.now(),
    source: order.source || 'pos'
  };

  // Guardar en orders.json
  saveStoredOrder(normalizedOrder);
  deductStockForOrder(normalizedOrder);
  pushOrderToSupabase(normalizedOrder).catch(() => {});

  // Inyectar en la cola de pedidos pendientes para que cocina web, KDS y POS lo reciban
  if (!pendingOrdersForPos.some(o => o.id === normalizedOrder.id)) {
    pendingOrdersForPos.push(normalizedOrder);
  }

  // Si proviene del catálogo online o tiene datos de teléfono del cliente, enviar confirmación proactiva por WhatsApp
  const isCatalog = order.source === 'catalogo_online' || order.channel === 'catalogo_online' || Boolean(normalizedOrder.customer?.phone);
  if (isCatalog) {
    botServer.sendCatalogOrderConfirmationToCustomer(normalizedOrder).catch(err => {
      console.warn('⚠️ [NOTIF CATALOGO]: Error enviando confirmación por WhatsApp:', err.message);
    });
  }

  console.log(`🛎️ [SYNC LOCAL] Pedido #${normalizedOrder.orderNumber} (${normalizedOrder.channel}) inyectado desde App Móvil/POS -> Sincronizado a cocina.`);
  res.json({ success: true, order: normalizedOrder });
});

// Endpoint para consultar el último número de comanda registrado
app.get('/api/latest-order-number', async (req, res) => {
  try {
    const latest = await getLatestOrderNumber();
    res.json({ success: true, latestOrderNumber: latest });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Endpoint para reiniciar el contador de pedidos a 0 desde el frontend o app móvil
app.post('/api/order-counter/reset', (req, res) => {
  const { counter = 0, lastResetAt = new Date().toISOString() } = req.body || {};
  serverOrderCounterResetAt = lastResetAt;
  console.log(`🔄 [COUNTER RESET LOCAL] Contador de pedidos reiniciado a ${counter} (corte: ${lastResetAt})`);
  res.json({ success: true, counter, lastResetAt });
});

// Endpoint para actualizar estado de un pedido desde cualquier dispositivo (Android, POS, etc.)
app.patch('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, order: payloadOrder, extraData } = req.body;
  if (!status) return res.status(400).json({ error: 'Status requerido' });

  const orders = getStoredOrders();
  let idx = orders.findIndex(o => o.id === id);
  let targetOrder = null;

  if (idx !== -1) {
    orders[idx].status = status;
    orders[idx].updatedAt = Date.now();
    if (extraData && typeof extraData === 'object') {
      Object.assign(orders[idx], extraData);
    }
    if (payloadOrder?.paymentStatus) orders[idx].paymentStatus = payloadOrder.paymentStatus;
    if (payloadOrder?.paymentConfirmed !== undefined) orders[idx].paymentConfirmed = payloadOrder.paymentConfirmed;
    if (payloadOrder?.paymentConfirmedAt) orders[idx].paymentConfirmedAt = payloadOrder.paymentConfirmedAt;

    if (payloadOrder?.customer && !orders[idx].customer?.phone) {
      orders[idx].customer = { ...orders[idx].customer, ...payloadOrder.customer };
    }
    if (payloadOrder?.phone && !orders[idx].phone) {
      orders[idx].phone = payloadOrder.phone;
    }
    if (payloadOrder?.remoteJid && !orders[idx].remoteJid) {
      orders[idx].remoteJid = payloadOrder.remoteJid;
    }
    targetOrder = orders[idx];
    try {
      fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
    } catch (_) {}
  } else if (payloadOrder) {
    targetOrder = { ...payloadOrder, status, updatedAt: Date.now(), ...(extraData || {}) };
    saveStoredOrder(targetOrder);
  }

  const pIdx = pendingOrdersForPos.findIndex(o => o.id === id);
  if (pIdx !== -1) {
    pendingOrdersForPos[pIdx].status = status;
    if (targetOrder?.paymentStatus) pendingOrdersForPos[pIdx].paymentStatus = targetOrder.paymentStatus;
    if (targetOrder?.paymentConfirmed !== undefined) pendingOrdersForPos[pIdx].paymentConfirmed = targetOrder.paymentConfirmed;
  }

  updateOrderStatusInSupabase(id, status).catch(() => {});

  // Notificar automáticamente a WhatsApp si aplica
  if (targetOrder) {
    botServer.sendOrderStatusNotification(targetOrder, status).catch(e => {
      console.warn(`[NOTIF WHATSAPP] Error en notificación de pedido ${id}:`, e.message);
    });
  }

  console.log(`🔄 [SYNC STATUS] Pedido ${id} actualizado a estado '${status}' en servidor local y Supabase.`);
  res.json({ 
    success: true, 
    id, 
    status, 
    notified: Boolean(targetOrder?.notifiedStatuses?.includes(status)) 
  });
});

// Endpoint para que un operador humano valide el comprobante de transferencia y mande el pedido a cocina
app.post('/api/orders/:id/confirm-payment', async (req, res) => {
  const { id } = req.params;
  const orders = getStoredOrders();
  const idx = orders.findIndex(o => o.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
  }

  orders[idx].paymentStatus = 'pagado';
  orders[idx].paymentConfirmed = true;
  orders[idx].paymentConfirmedAt = new Date().toISOString();
  orders[idx].status = 'cocina';
  orders[idx].updatedAt = Date.now();
  if (!orders[idx].statusTimestamps) orders[idx].statusTimestamps = {};
  orders[idx].statusTimestamps.cookingAt = new Date().toISOString();

  saveStoredOrder(orders[idx]);
  pushOrderToSupabase(orders[idx]).catch(() => {});
  const pIdx = pendingOrdersForPos.findIndex(o => o.id === id);
  if (pIdx !== -1) {
    pendingOrdersForPos[pIdx] = { ...orders[idx] };
  }

  // Notificar por WhatsApp que el pago fue aprobado y entró a la cocina
  botServer.sendOrderStatusNotification(orders[idx], 'cocina', true).catch(() => {});

  console.log(`✅ [PAGO CONFIRMADO]: Pedido ${id} validado por operador humano y enviado a cocina.`);
  res.json({ success: true, order: orders[idx] });
});

// Endpoint para reenviar manualmente la notificación por WhatsApp desde KDS o POS
app.post('/api/orders/:id/notify', async (req, res) => {
  const { id } = req.params;
  const { status, force = true } = req.body || {};

  const orders = getStoredOrders();
  const target = orders.find(o => o.id === id) || req.body?.order;
  if (!target) return res.status(404).json({ success: false, error: 'Pedido no encontrado' });

  const currentStatus = status || target.status || 'cocina';
  const result = await botServer.sendOrderStatusNotification(target, currentStatus, force);
  res.json(result);
});

// Endpoint para vaciar todas las órdenes
app.delete('/api/orders', (req, res) => {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2), 'utf-8');
  } catch (_) {}
  pendingOrdersForPos = [];
  console.log('🗑️ [SYNC CLEAR] Todas las órdenes vaciadas en servidor local.');
  res.json({ success: true, count: 0 });
});

// Endpoint para eliminar un pedido desde cualquier dispositivo (Android, POS, etc.)
app.delete('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  let orders = getStoredOrders();
  orders = orders.filter(o => o.id !== id);
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
  } catch (_) {}

  pendingOrdersForPos = pendingOrdersForPos.filter(o => o.id !== id);

  deleteOrderFromSupabase(id).catch(() => {});

  console.log(`🗑️ [SYNC DELETE] Pedido ${id} eliminado en servidor local y Supabase.`);
  res.json({ success: true, id });
});

// Endpoint para consultar histórico de pedidos de WhatsApp
// =========================================================
// ENDPOINTS DE INTELIGENCIA ARTIFICIAL (GOOGLE GEMINI)
// =========================================================


// =========================================================
// ENDPOINTS DE CAJA / ARQUEO (LAN SYNC)
// =========================================================

function getStoredCashShift() {
  try {
    if (fs.existsSync(CASH_SHIFT_FILE)) {
      return JSON.parse(fs.readFileSync(CASH_SHIFT_FILE, 'utf-8'));
    }
  } catch (_) {}
  return null;
}

function saveStoredCashShift(shift) {
  try {
    fs.writeFileSync(CASH_SHIFT_FILE, JSON.stringify(shift, null, 2), 'utf-8');
  } catch (_) {}
}

app.get('/api/cash-shift', (req, res) => {
  res.json({ success: true, cashShift: getStoredCashShift() });
});

app.post('/api/cash-shift', (req, res) => {
  const { cashShift } = req.body;
  if (cashShift) {
    saveStoredCashShift(cashShift);
    console.log('💵 [SYNC LOCAL CAJA] Turno de caja actualizado en servidor local.');
  }
  res.json({ success: true, cashShift: getStoredCashShift() });
});

app.get('/api/bot-templates', (req, res) => {
  res.json({ success: true, templates: getBotTemplates() });
});

app.post('/api/bot-templates', (req, res) => {
  const { templates } = req.body;
  if (!templates || typeof templates !== 'object') {
    return res.status(400).json({ success: false, error: 'Formato inválido de plantillas' });
  }
  const current = getBotTemplates();
  const merged = { ...current, ...templates };
  saveBotTemplates(merged);
  cloudConfigTimestamps.templates = new Date().toISOString();
  pushBotConfigToSupabase('templates', merged).catch(() => {});
  console.log(`🛡️ [WHATSAPP BOT] Seguridad Anti-Spam y Plantillas guardadas vía API local y sincronizadas a la nube.`);
  return res.json({ success: true, templates: merged });
});

app.get('/api/bot-variables', (req, res) => {
  res.json({ success: true, variables: getBotVariables() });
});

app.post('/api/bot-variables', (req, res) => {
  const { variables } = req.body;
  if (!variables || !Array.isArray(variables)) {
    return res.status(400).json({ success: false, error: 'Formato inválido de variables' });
  }
  saveBotVariables(variables);
  cloudConfigTimestamps.variables = new Date().toISOString();
  pushBotConfigToSupabase('variables', variables).catch(() => {});
  return res.json({ success: true, count: variables.length });
});

app.get('/api/flows', (req, res) => {
  res.json({ success: true, flows: getCustomFlows() });
});

app.post('/api/flows', (req, res) => {
  const { flows } = req.body;
  if (Array.isArray(flows)) {
    saveStoredFlows(flows);
    cloudConfigTimestamps.flows = new Date().toISOString();
    pushBotConfigToSupabase('flows', flows).catch(() => {});
    console.log(`🔀 [WHATSAPP BOT] Sincronizados ${flows.length} flujos conversacionales.`);
    return res.json({ success: true, count: flows.length });
  }
  res.status(400).json({ error: 'Array de flujos requerido' });
});

app.get('/api/ai/config', (req, res) => {
  res.json({ success: true, config: geminiBotService.getConfigSafe() });
});

app.post('/api/ai/config', (req, res) => {
  const { enabled, mode, groqApiKey, geminiApiKey, deepseekApiKey, apiKey, model, groqModel, deepseekModel, systemPrompt } = req.body;
  const rawUpdates = { enabled, mode, groqApiKey, geminiApiKey, deepseekApiKey, apiKey, model, groqModel, deepseekModel, systemPrompt };
  const cleanUpdates = {};
  for (const [k, v] of Object.entries(rawUpdates)) {
    if (v !== undefined) cleanUpdates[k] = v;
  }
  const updated = geminiBotService.saveConfig(cleanUpdates);
  cloudConfigTimestamps.ai_config = new Date().toISOString();
  pushBotConfigToSupabase('ai_config', updated).catch(() => {});
  res.json({ success: true, config: updated });
});

app.post('/api/ai/test', async (req, res) => {
  const { target, provider, apiKey } = req.body;
  const result = await geminiBotService.testConnection(target || provider || apiKey || 'cascade');
  res.json(result);
});

app.post('/api/ai/chat', async (req, res) => {
  const { message, customerName, availableProducts } = req.body;
  const prods = availableProducts || getStoredProducts();
  const biz = getBusinessContext();
  const reply = await geminiBotService.generateReply(message, { 
    customerName, 
    availableProducts: prods,
    businessInfo: biz
  });
  res.json({ success: true, reply });
});

// Endpoints para descarga directa de scripts (.bat)
app.get('/download/INICIAR_BOT_WHATSAPP.bat', (req, res) => {
  const filePath = path.join(process.cwd(), 'INICIAR_BOT_WHATSAPP.bat');
  if (fs.existsSync(filePath)) {
    return res.download(filePath, 'INICIAR_BOT_WHATSAPP.bat');
  }
  res.status(404).send('Archivo no encontrado');
});

app.get('/download/INICIAR_SISTEMA_COMPLETO.bat', (req, res) => {
  const filePath = path.join(process.cwd(), 'INICIAR_SISTEMA_COMPLETO.bat');
  if (fs.existsSync(filePath)) {
    return res.download(filePath, 'INICIAR_SISTEMA_COMPLETO.bat');
  }
  res.status(404).send('Archivo no encontrado');
});

app.get('/download/ACTUALIZAR_BOT.bat', (req, res) => {
  const filePath = path.join(process.cwd(), 'ACTUALIZAR_BOT.bat');
  if (fs.existsSync(filePath)) {
    return res.download(filePath, 'ACTUALIZAR_BOT.bat');
  }
  res.status(404).send('Archivo no encontrado');
});

// =========================================================
// ENDPOINTS DE ACTUALIZACIÓN DEL REPOSITORIO (OTA / GIT)
// =========================================================
app.get('/api/bot/update/check', async (req, res) => {
  try {
    const info = await botUpdateService.checkUpdates();
    res.json({ success: true, ...info });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/bot/update/apply', async (req, res) => {
  try {
    console.log('🔄 [BOT UPDATE] Solicitud de actualización recibida desde API Web...');
    const result = await botUpdateService.applyUpdate();
    if (result.success && result.requiresRestart) {
      botUpdateService.scheduleRestart(3000);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/orders', (req, res) => {
  const { since, status } = req.query;
  let orders = getStoredOrders();
  if (status) {
    orders = orders.filter(o => o.status === status);
  }
  if (since) {
    const sinceNum = Number(since);
    if (!isNaN(sinceNum)) {
      orders = orders.filter(o => (o.updatedAt || 0) > sinceNum);
    }
  }
  res.json({ success: true, orders, timestamp: Date.now() });
});

// =========================================================
// ENDPOINTS PARA EL LABORATORIO DE PRUEBAS DEL BOT (TESTER)
// =========================================================
app.get('/tester', (req, res) => {
  const testerPath = path.join(__dirname, 'tester.html');
  if (fs.existsSync(testerPath)) {
    res.sendFile(testerPath);
  } else {
    res.status(404).send('tester.html no encontrado');
  }
});

app.post('/api/bot/tester/message', async (req, res) => {
  try {
    const { text, jid = 'sim_cliente@s.whatsapp.net', name = 'Cliente Tester' } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'Texto requerido' });
    }
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    const fakeMsg = {
      key: { remoteJid: normalizedJid, id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, fromMe: false },
      message: { conversation: text.trim() },
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: name.trim() || 'Cliente Tester'
    };

    await botServer.processMessagesList([fakeMsg]);

    const chat = liveChatsMap.get(normalizedJid);
    const session = customerSessions.get(normalizedJid) || null;
    res.json({
      success: true,
      jid: normalizedJid,
      messages: chat?.messages || [],
      session: session ? {
        step: session.step,
        items: session.items || [],
        subtotal: session.subtotal || 0,
        total: session.total || 0,
        shippingMethod: session.shippingMethod,
        shippingAddress: session.shippingAddress,
        customerName: session.customerName,
        paymentMethod: session.paymentMethod
      } : null
    });
  } catch (err) {
    console.error('[TESTER API ERROR]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/bot/tester/state', (req, res) => {
  const jid = req.query.jid || 'sim_cliente@s.whatsapp.net';
  const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
  const chat = liveChatsMap.get(normalizedJid);
  const session = customerSessions.get(normalizedJid) || null;
  const vars = getBusinessContext();
  const prods = getStoredProducts();
  const pauseData = humanPausedChats.get(normalizedJid);
  const now = Date.now();
  const isPaused = pauseData && now < pauseData.pausedUntil;

  res.json({
    success: true,
    botStatus: botServer.status,
    botUser: botServer.connectedUser,
    jid: normalizedJid,
    isPaused: Boolean(isPaused),
    remainingPauseMinutes: isPaused ? Math.ceil((pauseData.pausedUntil - now) / 60000) : 0,
    pauseReason: isPaused ? pauseData.reason : null,
    messages: chat?.messages || [],
    session: session ? {
      step: session.step,
      items: session.items || [],
      subtotal: session.subtotal || 0,
      total: session.total || 0,
      shippingMethod: session.shippingMethod,
      shippingAddress: session.shippingAddress,
      customerName: session.customerName,
      paymentMethod: session.paymentMethod
    } : null,
    businessInfo: {
      nombre_local: vars.nombre_local,
      direccion: vars.direccion,
      horarios: vars.horarios,
      demora: vars.demora,
      alias_banco: vars.alias_banco,
      productsCount: prods.length
    }
  });
});

app.post('/api/bot/tester/reset', (req, res) => {
  const { jid = 'sim_cliente@s.whatsapp.net', clearMessages = false } = req.body || {};
  const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
  resetCustomerSession(normalizedJid);
  if (clearMessages && liveChatsMap.has(normalizedJid)) {
    const chat = liveChatsMap.get(normalizedJid);
    chat.messages = [];
    chat.lastMessageText = '';
    scheduleSaveLiveChats();
  }
  res.json({ success: true, jid: normalizedJid, message: 'Sesión reiniciada con éxito' });
});

const server = app.listen(PORT, async () => {
  console.log(`\n=========================================================`);
  console.log(`🍔 SERVIDOR WHATSAPP BOT COMANDAFAST (BAILEYS MULTI-DEVICE)`);
  console.log(`👉 Puerto: ${PORT} | Endpoint: http://localhost:${PORT}/status`);
  console.log(`=========================================================\n`);
  await syncAllFromSupabaseCloud();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠️ [ALERTA] El puerto ${PORT} ya está en uso.`);
    console.error(`   Es muy probable que el bot ya esté corriendo en segundo plano.`);
    console.error(`   Podés usarlo directamente o cerrar la ventana previa para reiniciar.`);
    process.exit(1);
  } else {
    console.error('\n❌ Error en el servidor Express:', err);
    process.exit(1);
  }
});

