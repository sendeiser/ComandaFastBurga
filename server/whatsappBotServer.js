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
import QRCode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import pino from 'pino';
import { geminiBotService } from './geminiBotService.js';
import makeWASocket, { 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion, 
  makeCacheableSignalKeyStore,
  DisconnectReason, 
  Browsers 
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
  { key: 'telefono_contacto', label: 'Teléfono / WhatsApp de Atención', category: 'business', value: '+54 9 3826 40-1234', defaultValue: '+54 9 3826 40-1234', description: 'Número de línea directa para consultas o derivación a humano' },
  { key: 'catalogo_url', label: 'Enlace a la Carta Web', category: 'business', value: 'https://comandafast.online', defaultValue: 'https://comandafast.online', description: 'URL de la carta digital para ver fotos y promociones' },
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
  anti_loop_gratitude: DEFAULT_ANTI_LOOP_GRATITUDE,
  anti_loop_farewell: DEFAULT_ANTI_LOOP_FAREWELL,
  anti_loop_acknowledge: DEFAULT_ANTI_LOOP_ACKNOWLEDGE,
  template_anti_loop_gratitude: '¡De nada! 🙌 Que lo disfrutes un montón. Si querés consultar la carta o volver a pedir, escribí *MENU* cuando gustes. ¡Buen provecho! 🍔🔥',
  template_anti_loop_farewell: '¡Hasta la próxima! 👋 Gracias por contactarte con {nombre_local}. ¡Que tengas un excelente descanso! ✨🍔',
  template_anti_loop_acknowledge: '¡Bárbaro! 👍 Quedamos atentos ante cualquier duda. Escribí *MENU* en cualquier momento para hacer un nuevo pedido.',
  template_menu: `🍔 *¡Hola {cliente}! Bienvenido a {nombre_local}* 🔥\n\n¿En qué podemos ayudarte hoy? *Respondé con el número de opción:*\n\n1️⃣ 📋 *Consultar estado de mi pedido*\n2️⃣ 💳 *Ver datos de transferencia bancaria / Alias*\n3️⃣ 📍 *Horarios y ubicación de nuestro local*\n4️⃣ 🍔 *Ver menú completo de hamburguesas y combos*\n5️⃣ 👤 *Hablar con un encargado del local*\n\n_O escribí directamente *COMPRAR* o el número de la burger que quieras pedir._`,
  menu_response_1: `📋 *Estado de tu Pedido:* #{pedido_id}\n\n• *Estado:* {estado}\n• *Total:* \${total}\n• *Destino:* {direccion}\n\n_Para volver al menú, enviá la palabra *MENU*._`,
  menu_response_2: `💳 *Datos para Transferencia Bancaria:* 🏦\n\n• *Alias:* \`{alias_banco}\`\n• *Banco:* {banco}\n• *Titular:* {titular}\n• *CBU:* \`{cbu}\`\n\n📸 *Una vez realizada la transferencia, podés enviar la captura o foto del comprobante por este mismo chat para comenzar a cocinar.*\n\n_Enviá *MENU* para volver al menú principal._`,
  menu_response_3: `📍 *Ubicación y Horarios de Atención:* 🕒\n\n🍔 *Dirección:* {direccion}\n⏰ *Horarios de Cocina:* {horarios}\n\n¡Te esperamos con las mejores burgers a la plancha! 🔥\n\n_Enviá *MENU* para volver al menú principal._`,
  menu_response_4: `🍔 *Menú & Precios de {nombre_local}* 🔥\n\n{catalogo_lista}\n\n👉 *Respondé con el NÚMERO (1, 2, 3...) de la burger para pedir o escribí COMPRAR.*\n🌐 *Menú digital:* {catalogo_url}`,
  menu_response_5: `👤 *¡Entendido {cliente}! Un encargado de {nombre_local} te responderá a la brevedad.* 🍔\n\nPor favor dejanos tu consulta detallada para que podamos ayudarte lo antes posible. ¡Muchas gracias!`,
  template_buy_catalog: `🍔 *¡Vamos a armar tu pedido!* 🔥\n\n{catalogo_lista}\n\n👉 *Respondé con el NÚMERO (1, 2, 3...) de la hamburguesa o combo que quieras pedir.*`,
  template_order_summary: `🍔 *RESUMEN DE TU PEDIDO* 🔥\n\n🛒 *Items:*\n{carrito_items}\n\n💵 *Subtotal:* \${subtotal}\n🛵 *Entrega:* {metodo_entrega}\n📍 *Dirección:* {direccion}\n👤 *Cliente:* {cliente}\n💳 *Forma de Pago:* {medio_pago}\n\n💵 *TOTAL A PAGAR:* \${total}\n\n¿Está todo perfecto para mandar a la cocina?\n👉 Respondé *SI* para confirmar tu pedido o *CANCELAR*.`,
  template_order_cancelled: `❌ *Pedido cancelado.* ¿En qué más podemos ayudarte?\n\n{menu}`,
  template_order_preparing: `👨‍🍳🔥 *¡Buenas noticias {cliente}! Tu pedido #{pedido_id} ya está en la plancha.*

Nuestros cocineros están preparando tus hamburguesas con la carne recién smashada y el cheddar fundido. ¡Te avisamos apenas esté listo! 🍔✨`,
  template_order_ready: `🔔 *¡Tu pedido #{pedido_id} está LISTO {cliente}!* 🍔🍟

Ya podés pasar a retirarlo por nuestro local en {direccion}. ¡Te esperamos con las burgers calentitas!`,
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

// Obtener contexto unificado del negocio (Supabase Cloud + Variables Locales)
function getBusinessContext() {
  const vars = getBotVariablesMap();
  const tpls = getBotTemplates();
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
    sitio_web: tpls.store_website_url || vars.sitio_web || '',
    mensaje_bienvenida: vars.mensaje_bienvenida || tpls.template_menu || tpls.template_welcome || ''
  };
}

function interpolateTemplate(template, vars = {}) {
  let res = String(template || '');
  for (const [k, v] of Object.entries(vars)) {
    res = res.replace(new RegExp(`\\{${k}\\}`, 'gi'), String(v ?? ''));
  }
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

function buildMainMenuMessage(customerName = '') {
  const tpls = getBotTemplates();
  const biz = getBusinessContext();
  const storeName = biz.nombre_local || "Burga's Chamical";
  const clientName = customerName ? customerName.trim() : 'amigo/a';

  let rawMenu = tpls.template_menu || DEFAULT_SERVER_TEMPLATES.template_menu;

  // Si la plantilla guardada está vacía, recortada o no contiene opciones numéricas básicas, asegurar la estructura completa
  if (!rawMenu || !rawMenu.includes('1️⃣') || !rawMenu.includes('5️⃣')) {
    rawMenu = DEFAULT_SERVER_TEMPLATES.template_menu;
  }

  return interpolateTemplate(rawMenu, {
    cliente: clientName,
    nombre_local: storeName,
    ...biz
  });
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Cargar productos de la base de datos local
function getStoredProducts() {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      const raw = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('[WHATSAPP BOT] Error al leer products.json:', e);
  }
  return [];
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
// SISTEMA DE PROTECCIÓN ANTIDETECCIÓN & ANTI-BANEO (WhatsApp Business)
// =========================================================

// 1. Control de atención humana (Modo Humano / Hand-over)
// Duración de pausa automática cuando el operador escribe desde el teléfono físico
const HUMAN_PAUSE_DURATION_MS = 25 * 60 * 1000; // 25 minutos
const HUMAN_PAUSE_FILE = path.join(DATA_DIR, 'human_paused_chats.json');
const botSentMessageIds = new Set(); // IDs de mensajes despachados por el propio bot (para no auto-pausarse)

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
      return sentMsg;
    } catch (err) {
      console.error(`[WHATSAPP BOT] safeSendMessage error enviando a ${remoteJid}:`, err?.message || err);
      try {
        const fallbackSent = await this.sock.sendMessage(remoteJid, content);
        if (fallbackSent?.key?.id) {
          botSentMessageIds.add(fallbackSent.key.id);
          setTimeout(() => botSentMessageIds.delete(fallbackSent.key.id), 120000);
        }
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

    // Control anti-duplicados: evitar reenvíos accidentales por doble click
    const notified = Array.isArray(order.notifiedStatuses) ? order.notifiedStatuses : [];
    if (!force && notified.includes(normalizedStatus)) {
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

    // Detección precisa de modo Delivery
    const isDelivery = order.deliveryType === 'delivery' || 
                       order.channel === 'delivery' || 
                       order.shippingMethod === 'delivery' ||
                       customerObj.deliveryType === 'delivery' ||
                       customerObj.shippingMethod === 'delivery' ||
                       Number(order.deliveryFee || 0) > 0 ||
                       (customerObj.address && !['retiro en local', 'mostrador', 'local', 'en el local'].includes(customerObj.address.toLowerCase().trim()) && customerObj.address.length > 2 && !order.tableNumber);

    // Dirección adecuada según contexto:
    // - Para Retiro en Local: siempre es la dirección física de la hamburguesería (vars.direccion)
    // - Para Envíos a Domicilio: es el domicilio del cliente
    const storeAddress = vars.direccion || 'Nuestro Local (Av. Perón 145)';
    const customerDeliveryAddress = customerObj.address || order.address || 'tu domicilio';
    const addressToUse = (normalizedStatus === 'listo') ? storeAddress : customerDeliveryAddress;

    let templateText = '';
    if (normalizedStatus === 'cocina') {
      templateText = tpls.template_order_preparing || DEFAULT_SERVER_TEMPLATES.template_order_preparing;
    } else if (normalizedStatus === 'listo') {
      if (isDelivery) {
        // En pedidos para DELIVERY: El cliente NO debe recibir el aviso de retirar por el local.
        console.log(`ℹ️ [NOTIF WHATSAPP]: Pedido #${orderNum} es para DELIVERY. Se omite notificación de 'Retiro en Local' en estado 'listo'. Se notificará cuando el cadete salga ('despachar'/'entregado').`);
        return { success: false, reason: 'delivery_order_skip_pickup_notice' };
      }
      templateText = tpls.template_order_ready || DEFAULT_SERVER_TEMPLATES.template_order_ready;
    } else if (normalizedStatus === 'entregado') {
      if (isDelivery) {
        templateText = tpls.template_order_shipped || DEFAULT_SERVER_TEMPLATES.template_order_shipped;
      } else {
        return { success: false, reason: 'takeaway_delivered_no_notify' };
      }
    }

    if (!templateText) return { success: false, reason: 'template_empty' };

    const finalMessage = templateText
      .replace(/{cliente}/gi, customerName)
      .replace(/{pedido_id}/gi, orderNum)
      .replace(/{direccion}/gi, addressToUse)
      .replace(/{total}/gi, Number(order.total || 0).toLocaleString('es-AR'))
      .replace(/{horarios}/gi, vars.horarios)
      .replace(/{demora}/gi, vars.demora || '30 a 45 min');

    console.log(`🚀 [NOTIF WHATSAPP]: Enviando aviso de estado '${normalizedStatus}' (${isDelivery ? 'Delivery' : 'Take Away'}) a ${targetJid} (Pedido #${orderNum})...`);

    const sendResult = await this.safeSendMessage(targetJid, { text: finalMessage });

    if (sendResult) {
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
          fs.writeFileSync(ORDERS_FILE, JSON.stringify(stored, null, 2), 'utf-8');
        }
      } catch (_) {}

      console.log(`✅ [NOTIF WHATSAPP]: Notificación de estado '${normalizedStatus}' entregada con éxito a ${targetJid}.`);
      return { success: true, jid: targetJid, status: normalizedStatus };
    } else {
      console.warn(`⚠️ [NOTIF WHATSAPP]: Falló el envío de notificación a ${targetJid}.`);
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
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version } = await fetchLatestBaileysVersion();
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

        const prods = getStoredProducts();

        for (const msg of chatUpdate.messages) {
          const remoteJid = msg.key?.remoteJid;
          if (!remoteJid) continue;

          // Ignorar estados / historias de WhatsApp y broadcasts
          if (remoteJid === 'status@broadcast' || remoteJid.endsWith('@broadcast')) continue;
          // Ignorar grupos
          if (remoteJid.endsWith('@g.us')) continue;
          // Ignorar canales informativos de WhatsApp
          if (remoteJid.includes('@newsletter')) continue;

          // Si el mensaje fue enviado por el operador/dueño desde el propio teléfono físico
          if (msg.key?.fromMe) {
            if (msg.key?.id && botSentMessageIds.has(msg.key.id)) {
              // Eco del propio bot: ignorar silenciosamente sin pausar la atención
              continue;
            }
            if (this.connectedUser?.id && remoteJid.includes(this.connectedUser.id.split(':')[0])) {
              // Mensaje personal a sí mismo
              continue;
            }
            pauseBotForCustomer(remoteJid, null, 'operador_celular');
            continue;
          }

          // Ignorar mensajes con más de 90 segundos de antigüedad (historial masivo al conectar)
          const msgTimestamp = Number(msg.messageTimestamp || 0);
          const nowSec = Math.floor(Date.now() / 1000);
          if (msgTimestamp > 0 && (nowSec - msgTimestamp) > 90) {
            continue;
          }

          const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
          const isImageMsg = !!msg.message?.imageMessage;
          const lower = text.toLowerCase();

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
              const orderId = 'CMD-' + nextOrderNum;
              const cleanPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');
              
              const newOrder = {
                id: orderId,
                code: orderId,
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
                paymentConfirmed: false,
                items: session.items.map(it => ({
                  id: it.id,
                  name: it.name,
                  price: Number(it.price),
                  qty: Number(it.qty || it.quantity || 1),
                  quantity: Number(it.qty || it.quantity || 1),
                  freeShipping: Boolean(it.freeShipping),
                  modifiers: it.modifiers || [],
                  notes: it.notes || ''
                })),
                status: 'pendiente',
                createdAt: new Date().toISOString(),
                source: 'whatsapp_bot'
              };

              // Guardar pedido localmente y en cola para el POS
              saveStoredOrder(newOrder);
              pushOrderToSupabase(newOrder).catch(() => {});
              pendingOrdersForPos.push(newOrder);
              console.log(`🔔 [NUEVO PEDIDO WHATSAPP]: Pedido #${orderId} de ${newOrder.customer.name} ($${newOrder.total}) inyectado.`);

              const itemsList = session.items.map(it => `• ${it.name} (x${it.qty || 1}) - $${(it.price * (it.qty || 1)).toLocaleString('es-AR')}${it.modifiers?.length ? ' [' + it.modifiers.join(', ') + ']' : ''}`).join('\n');
              
              let confirmMsg = '';
              if (session.paymentMethod === 'transferencia') {
                const biz = getBusinessContext();
                confirmMsg = `🎉 *¡PEDIDO #${orderId} REGISTRADO!* 🍔🔥\n\n¡Muchas gracias *${newOrder.customer.name}*!\n\n📋 *Detalle de tu pedido:*\n${itemsList}\n\n💵 *Total a transferir:* $${newOrder.total.toLocaleString('es-AR')}\n🛵 *Modo:* ${session.shippingMethod === 'delivery' ? '🛵 Envío a Domicilio' : '🛍️ Retiro por el Local'}\n📍 *Dirección:* ${newOrder.customer.address}\n\n💳 *Datos para Transferencia:*\n• *Alias:* \`${biz.alias_banco}\`\n• *Banco:* ${biz.banco}\n• *Titular:* ${biz.titular}${biz.cbu ? `\n• *CBU:* \`${biz.cbu}\`` : ''}\n\n📸 *IMPORTANTE:* Por favor enviá la foto o captura del comprobante por aquí.\n⏳ *Tu pedido quedará pendiente hasta que una persona de nuestro equipo confirme el comprobante y lo mande a cocina.* 🔥`;
              } else {
                confirmMsg = `🎉 *¡PEDIDO #${orderId} CONFIRMADO Y ENVIADO A LA COCINA!* 🔥🍔\n\n¡Muchas gracias *${newOrder.customer.name}*, tu pedido ya ingresó al sistema de la plancha!\n\n📋 *Detalle:*\n${itemsList}\n\n💵 *Total:* $${newOrder.total.toLocaleString('es-AR')}\n🛵 *Modo:* ${session.shippingMethod === 'delivery' ? '🛵 Envío a Domicilio' : '🛍️ Retiro por el Local'}\n📍 *Dirección:* ${newOrder.customer.address}\n\n💵 *Pago en Efectivo:* Abonás al recibir tu comida. ¡La cocina ya está marchando tus burgers! 🔥`;
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
            if (lower === 'listo' || lower === 'pedir' || lower === 'comprar' || lower === 'terminar' || lower === 'seguir' || lower === 'avanzar' || lower === 'pagar') {
              if (session.items.length === 0) {
                await this.safeSendMessage(remoteJid, {
                  text: '⚠️ Tu pedido está vacío. Escribí el *NÚMERO* de la burger que querés o escribí *MENU*.'
                }, msg.key);
                continue;
              }
              session.step = 'ASK_SHIPPING_METHOD';
              await this.safeSendMessage(remoteJid, {
                text: `🛵 *¿Cómo querés recibir tu pedido?*\n\nRespondé con el número de opción:\n1️⃣ *Retiro por el local (Take Away)* 🏷️ Sin costo\n2️⃣ *Envío a domicilio con cadete (Delivery)*`
              }, msg.key);
              continue;
            }

            // Detección de modificadores (ej: sin cebolla, extra cheddar)
            if (lower.startsWith('sin ') || lower.startsWith('con ') || lower.startsWith('extra ') || lower.includes('cebolla') || lower.includes('cheddar') || lower.includes('panceta') || lower.includes('bacon')) {
              if (session.items.length > 0) {
                const lastItem = session.items[session.items.length - 1];
                if (!lastItem.modifiers) lastItem.modifiers = [];
                lastItem.modifiers.push(text);
                await this.safeSendMessage(remoteJid, {
                  text: `📝 *Modificador agregado a ${lastItem.name}:* "${text}".\n\n👉 ¿Querés sumar algo más? *(Escribí el número)*\n👉 O escribí *LISTO* para avanzar con la entrega.`
                }, msg.key);
                continue;
              }
            }

            // Intentar sumar otro producto por número o nombre
            const numIdx = parseInt(lower.replace(/\D/g, ''), 10);
            let selectedProd = null;
            if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= prods.length) {
              selectedProd = prods[numIdx - 1];
            } else {
              selectedProd = prods.find(p => lower.includes(p.name.toLowerCase()));
            }

            if (selectedProd) {
              const existingIdx = session.items.findIndex(it => it.id === selectedProd.id);
              if (existingIdx !== -1) {
                session.items[existingIdx].qty = (session.items[existingIdx].qty || 1) + 1;
                session.items[existingIdx].quantity = session.items[existingIdx].qty;
              } else {
                session.items.push({
                  id: selectedProd.id,
                  name: selectedProd.name,
                  price: Number(selectedProd.price),
                  freeShipping: Boolean(selectedProd.freeShipping),
                  qty: 1,
                  quantity: 1,
                  modifiers: []
                });
              }

              session.subtotal = session.items.reduce((acc, it) => acc + (it.price * (it.qty || 1)), 0);
              session.total = session.subtotal;

              const itemsList = session.items.map(it => `• ${it.name} (x${it.qty || 1}) - $${(it.price * (it.qty || 1)).toLocaleString('es-AR')}${it.modifiers?.length ? ' [' + it.modifiers.join(', ') + ']' : ''}`).join('\n');

              await this.safeSendMessage(remoteJid, {
                text: `✅ *¡Sumaste ${selectedProd.name}!* 🍔 (+$${Number(selectedProd.price).toLocaleString('es-AR')})\n\n🛒 *Tu pedido actual:*\n${itemsList}\n\n💵 *Subtotal:* $${session.total.toLocaleString('es-AR')}\n\n👉 ¿Querés sumar algo más? *(Escribí otro número)*\n👉 ¿Modificaciones? *(Ej: Sin cebolla, Extra cheddar)*\n👉 O escribí *LISTO* para continuar.`
              }, msg.key);
              continue;
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
          // MENÚ PRINCIPAL Y SALUDOS (ALTA PRIORIDAD EN MODO IDLE)
          // Si el cliente saluda ("hola", "buenas", etc.) o solicita el menú,
          // se envía la plantilla de menú estructurada con opciones 1 a 5
          // (NO debe intervenir la IA en el menú principal ni en saludos)
          // -------------------------------------------------------------
          const isGreetingRegex = /^(hola|buenas|buen\s*dia|buenos\s*dias|buenas\s*tardes|buenas\s*noches|que\s*tal|holis|hey|saludos)(\s.*)?$/i;
          const isMenuCommand = [
            'menu', 'menú', 'inicio', 'comenzar', 'start', 'opciones', 'ayuda', '#menu'
          ].includes(lower) || isGreetingRegex.test(lower);

          if (isMenuCommand && session.step === 'IDLE') {
            session.catalogPage = 1;
            const menuReply = buildMainMenuMessage(msg.pushName);
            await this.safeSendMessage(remoteJid, { text: menuReply }, msg.key);
            continue;
          }

          // -------------------------------------------------------------
          // OPCIONES DEL MENÚ PRINCIPAL EN MODO IDLE (1, 2, 3, 4, 5)
          // -------------------------------------------------------------
          if (session.step === 'IDLE') {
            // OPCIÓN 1: CONSULTAR ESTADO DE PEDIDO
            if (lower === '1' || lower === 'estado' || lower === 'mi pedido' || lower === 'mi orden') {
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

            // OPCIÓN 2: DATOS BANCARIOS / TRANSFERENCIA
            if (lower === '2' || lower === 'alias' || lower === 'cbu' || lower === 'transferencia' || lower === 'datos banco') {
              const biz = getBusinessContext();
              const tpls = getBotTemplates();
              const rawTpl = tpls.menu_response_2 || `💳 *Datos para Transferencia Bancaria:* 🏦\n\n• *Alias:* \`{alias_banco}\`\n• *Banco:* {banco}\n• *Titular:* {titular}\n• *CBU:* \`{cbu}\`\n\n📸 *Una vez realizada la transferencia, podés enviar la captura o foto del comprobante por este mismo chat.*\n\n_Enviá *MENU* para volver al menú principal._`;
              const reply = interpolateTemplate(rawTpl, { ...biz, cliente: msg.pushName || '' });
              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              continue;
            }

            // OPCIÓN 3: HORARIOS Y UBICACIÓN
            if (lower === '3' || lower === 'horario' || lower === 'horarios' || lower === 'ubicacion' || lower === 'ubicación' || lower === 'direccion' || lower === 'dirección') {
              const biz = getBusinessContext();
              const tpls = getBotTemplates();
              const rawTpl = tpls.menu_response_3 || `📍 *Ubicación y Horarios de Atención:* 🕒\n\n🍔 *Dirección:* {direccion}\n⏰ *Horarios de Cocina:* {horarios}\n\n¡Te esperamos con las mejores burgers a la plancha! 🔥\n\n_Enviá *MENU* para volver al menú principal._`;
              const reply = interpolateTemplate(rawTpl, { ...biz, cliente: msg.pushName || '' });
              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              continue;
            }

            // OPCIÓN 4: VER CARTA COMPLETA / CATÁLOGO
            if (lower === '4' || lower === 'carta' || lower === 'catalogo' || lower === 'catálogo') {
              session.step = 'SELECTING';
              session.catalogPage = 1;
              const reply = buildCatalogMessage(prods, 1, 8, false);
              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              continue;
            }

            // OPCIÓN 5: HABLAR CON UN ENCARGADO / HUMANO
            if (lower === '5' || lower === 'humano' || lower === 'asesor' || lower === 'encargado' || lower === 'persona' || lower === 'operador') {
              const biz = getBusinessContext();
              const tpls = getBotTemplates();
              const rawTpl = tpls.menu_response_5 || `👤 *¡Entendido {cliente}! Un encargado de {nombre_local} te responderá a la brevedad.* 🍔\n\nPor favor dejanos tu consulta detallada para que podamos ayudarte lo antes posible. ¡Muchas gracias!`;
              const reply = interpolateTemplate(rawTpl, { ...biz, cliente: msg.pushName || 'amigo/a' });
              pauseBotForCustomer(remoteJid, null, 'cliente_solicito_humano');
              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              continue;
            }

            // INICIAR PEDIDO DIRECTO ('comprar', 'pedir', 'hacer pedido')
            if (lower === 'comprar' || lower === 'pedir' || lower === 'hacer pedido' || lower === 'quiero pedir') {
              session.step = 'SELECTING';
              session.catalogPage = 1;
              const reply = buildCatalogMessage(prods, 1, 8, false);
              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              continue;
            }
          }

          // -------------------------------------------------------------
          // SELECCIÓN DIRECTA DE HAMBURGUESAS EN CUALQUIER MOMENTO (NÚMERO O NOMBRE)
          // Si el cliente pide directamente "quiero la 1", "dame una 2" o un número >= 6
          // -------------------------------------------------------------
          const initialNum = parseInt(lower.replace(/\D/g, ''), 10);
          let matchedProd = null;
          if (!isNaN(initialNum) && initialNum >= 1 && initialNum <= prods.length) {
            matchedProd = prods[initialNum - 1];
          } else {
            matchedProd = prods.find(p => lower.includes(p.name.toLowerCase()));
          }

          if (matchedProd && (lower.startsWith('comprar') || lower.startsWith('pedir') || lower.startsWith('quiero') || lower.startsWith('dame') || (initialNum >= 6 && initialNum <= prods.length) || session.step === 'SELECTING')) {
            session.step = 'SELECTING';
            if (!session.items) session.items = [];
            
            const existingIdx = session.items.findIndex(it => it.id === matchedProd.id);
            if (existingIdx !== -1) {
              session.items[existingIdx].qty = (session.items[existingIdx].qty || 1) + 1;
              session.items[existingIdx].quantity = session.items[existingIdx].qty;
            } else {
              session.items.push({
                id: matchedProd.id,
                name: matchedProd.name,
                price: Number(matchedProd.price),
                freeShipping: Boolean(matchedProd.freeShipping),
                qty: 1,
                quantity: 1,
                modifiers: []
              });
            }

            session.subtotal = session.items.reduce((acc, it) => acc + (it.price * (it.qty || 1)), 0);
            session.total = session.subtotal;

            const itemsList = session.items.map(it => `• ${it.name} (x${it.qty || 1}) - $${(it.price * (it.qty || 1)).toLocaleString('es-AR')}${it.modifiers?.length ? ' [' + it.modifiers.join(', ') + ']' : ''}`).join('\n');

            const reply = `✅ *¡Excelente elección! Sumaste ${matchedProd.name}* 🍔 (+$${Number(matchedProd.price).toLocaleString('es-AR')})\n\n🛒 *Tu pedido actual:*\n${itemsList}\n\n💵 *Subtotal:* $${session.total.toLocaleString('es-AR')}\n\n👉 ¿Querés sumar otra burger o bebida? *(Escribí su número)*\n👉 ¿Algún cambio? *(Ej: Sin cebolla, Extra cheddar)*\n👉 O respondé *LISTO* para elegir forma de entrega.`;
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
            const aiReply = await geminiBotService.generateReply(text, {
              customerName: msg.pushName || '',
              customerPhone: remoteJid,
              availableProducts: prods,
              businessInfo: biz
            });

            if (aiReply) {
              console.log(`✨ [WHATSAPP IA]: Respondiendo consulta a ${remoteJid}`);
              await this.safeSendMessage(remoteJid, { text: aiReply }, msg.key);
              continue;
            }
          } catch (aiErr) {
            console.warn('[WHATSAPP BOT AI ERROR]:', aiErr);
          }

          // SALUDO POR DEFECTO CON EL MENÚ DE LA PLANTILLA SI LA IA NO RESPONDE
          const fallbackMenu = buildMainMenuMessage(msg.pushName);
          await this.safeSendMessage(remoteJid, { text: fallbackMenu }, msg.key);
        }
      });

      return { status: this.status, qrCode: this.qrCode };
    } catch (err) {
      console.error('[WHATSAPP BOT] Error al iniciar socket:', err);
      this.status = 'disconnected';
      this.isStarting = false;
      return { status: 'disconnected', error: err.message };
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
  const { products } = req.body;
  if (Array.isArray(products)) {
    try {
      fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
      console.log(`📦 [WHATSAPP BOT] Sincronizados ${products.length} productos con fotos para el chatbot.`);
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
    updatedAt: Date.now()
  };

  // Guardar en orders.json
  saveStoredOrder(normalizedOrder);
  pushOrderToSupabase(normalizedOrder).catch(() => {});

  // Inyectar en la cola de pedidos pendientes para que cocina web, KDS y POS lo reciban
  if (!pendingOrdersForPos.some(o => o.id === normalizedOrder.id)) {
    pendingOrdersForPos.push(normalizedOrder);
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

