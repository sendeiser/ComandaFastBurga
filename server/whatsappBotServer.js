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

const PORT = 3002;


const DATA_DIR = path.join(process.cwd(), 'data');
const AUTH_DIR = path.join(DATA_DIR, 'baileys_auth');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const CASH_SHIFT_FILE = path.join(DATA_DIR, 'cash_shift.json');
const FLOWS_FILE = path.join(DATA_DIR, 'custom_flows.json');
const VARIABLES_FILE = path.join(DATA_DIR, 'bot_variables.json');

// =========================================================
// SUPABASE CLOUD INTEGRATION (Push directo a la nube)
// =========================================================
const SUPABASE_URL = 'https://yqynuvjpipmvurualgtg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxeW51dmpwaXBtdnVydWFsZ3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MzMyOTgsImV4cCI6MjEwNTUwOTI5OH0.mLO52rFPD384yQHdGlBasrx4QvqXiHYH3zRmJ9Bq2go';

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
        updated_at: new Date().toISOString()
      })
    });
    console.log(`[SUPABASE] Bot config '${key}' sincronizado a la nube.`);
  } catch (e) {
    console.warn(`[SUPABASE] pushBotConfigToSupabase '${key}' error:`, e.message);
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
      if (Array.isArray(rows) && rows.length > 0 && rows[0].data) {
        return rows[0].data;
      }
    }
  } catch (e) {
    console.warn(`[SUPABASE] fetchBotConfigFromSupabase '${key}' error:`, e.message);
  }
  return null;
}

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

function interpolateTemplate(template, vars = {}) {
  let res = String(template || '');
  for (const [k, v] of Object.entries(vars)) {
    res = res.replace(new RegExp(`\\{${k}\\}`, 'gi'), String(v ?? ''));
  }
  return res;
}

function formatItemNumber(n) {
  const numEmojis = {
    1: '1️⃣', 2: '2️⃣', 3: '3️⃣', 4: '4️⃣', 5: '5️⃣',
    6: '6️⃣', 7: '7️⃣', 8: '8️⃣', 9: '9️⃣', 10: '🔟'
  };
  if (numEmojis[n]) return numEmojis[n];
  return `*[${n}]*`;
}

function buildCatalogMessage(prods, page = 1, pageSize = 8, isAll = false) {
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

class WhatsAppBotServer {
  constructor() {
    this.sock = null;
    this.status = 'disconnected';
    this.qrCode = null;
    this.connectedUser = null;
    this.isStarting = false;
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
        }
      });

      // Escuchar mensajes entrantes con máquina conversacional de pedidos
      this.sock.ev.on('messages.upsert', async (chatUpdate) => {
        if (!chatUpdate.messages || chatUpdate.messages.length === 0) return;

        const prods = getStoredProducts();

        for (const msg of chatUpdate.messages) {
          const remoteJid = msg.key?.remoteJid;
          if (!remoteJid) continue;
          if (msg.key?.fromMe) continue;

          // Ignorar estados / historias de WhatsApp y broadcasts
          if (remoteJid === 'status@broadcast' || remoteJid.endsWith('@broadcast')) continue;
          // Ignorar grupos
          if (remoteJid.endsWith('@g.us')) continue;
          // Ignorar canales informativos de WhatsApp
          if (remoteJid.includes('@newsletter')) continue;

          // Ignorar mensajes con más de 90 segundos de antigüedad (historial masivo al conectar)
          const msgTimestamp = Number(msg.messageTimestamp || 0);
          const nowSec = Math.floor(Date.now() / 1000);
          if (msgTimestamp > 0 && (nowSec - msgTimestamp) > 90) {
            continue;
          }

          const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
          const isImageMsg = !!msg.message?.imageMessage;
          const lower = text.toLowerCase();

          // Si envió una imagen (ej: comprobante de pago)
          if (isImageMsg) {
            console.log(`📸 [WHATSAPP]: Imagen/Comprobante recibido de ${remoteJid}`);
            await this.sock.sendMessage(remoteJid, {
              text: '📸 *¡Comprobante recibido con éxito!* 🔥\n\nMuchas gracias, ya fue notificado a caja y cocina para su validación.'
            });
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
            await this.sock.sendMessage(remoteJid, {
              text: '❌ *Pedido cancelado.*\n\nEscribí *MENU* en cualquier momento para volver a ver las opciones o hacer un nuevo pedido.'
            });
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
            flowReply = interpolateTemplate(flowReply, {
              cliente: msg.pushName || 'Cliente',
              direccion: 'Av. Belgrano 1234, Centro',
              horarios: 'Miércoles a Domingos de 19:30 a 00:30 hs',
              alias_banco: 'comandafast.mp',
              banco: 'Mercado Pago',
              titular: 'ComandaFast Burgers S.R.L.',
              cbu: '0000003100092138928374'
            });

            if (action.imageUrl) {
              try {
                if (action.imageUrl.startsWith('data:image')) {
                  const base64Data = action.imageUrl.split(';base64,').pop();
                  const imageBuffer = Buffer.from(base64Data, 'base64');
                  await this.sock.sendMessage(remoteJid, { image: imageBuffer, caption: flowReply });
                  continue;
                } else if (action.imageUrl.startsWith('http')) {
                  await this.sock.sendMessage(remoteJid, { image: { url: action.imageUrl }, caption: flowReply });
                  continue;
                }
              } catch (imgErr) {
                console.warn('[WHATSAPP BOT] Error enviando imagen del flujo:', imgErr);
              }
            }

            await this.sock.sendMessage(remoteJid, { text: flowReply });
            continue;
          }

          // -------------------------------------------------------------
          // COMANDO: FOTO DE UN PRODUCTO ESPECÍFICO
          // -------------------------------------------------------------
          if (lower.startsWith('foto') || lower.startsWith('ver foto')) {
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
                    await this.sock.sendMessage(remoteJid, { image: imageBuffer, caption });
                    continue;
                  } else if (target.image.startsWith('http')) {
                    await this.sock.sendMessage(remoteJid, { image: { url: target.image }, caption });
                    continue;
                  }
                } catch (imgErr) {
                  console.warn('[WHATSAPP BOT] Error al enviar foto por socket:', imgErr);
                }
              }

              await this.sock.sendMessage(remoteJid, { text: caption });
              continue;
            }
          }

          // -------------------------------------------------------------
          // MÁQUINA DE ESTADOS CONVERSACIONAL DE COMANDAS
          // -------------------------------------------------------------

          // ESTADO: CONFIRMING (Esperando SI / CANCELAR)
          if (session.step === 'CONFIRMING') {
            if (lower === 'si' || lower === 'sí' || lower === 'confirmar' || lower === 'dale' || lower === 'ok' || lower === 's') {
              // Generar código de comanda
              const orderId = 'CMD-' + Math.floor(1000 + Math.random() * 9000);
              const cleanPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');
              
              const newOrder = {
                id: orderId,
                code: orderId,
                orderNumber: orderId.replace('CMD-', ''),
                customer: {
                  name: session.customerName || 'Cliente WhatsApp',
                  phone: cleanPhone,
                  address: session.shippingAddress || (session.shippingMethod === 'delivery' ? 'Domicilio' : 'Retiro en Local')
                },
                channel: 'whatsapp',
                deliveryType: session.shippingMethod, // 'local' o 'delivery'
                paymentMethod: session.paymentMethod, // 'efectivo' o 'transferencia'
                items: session.items.map(it => ({
                  id: it.id,
                  name: it.name,
                  price: it.price,
                  qty: it.qty || it.quantity || 1,
                  quantity: it.qty || it.quantity || 1,
                  modifiers: it.modifiers || [],
                  notes: it.notes || ''
                })),
                total: session.total,
                status: 'pendiente',
                createdAt: new Date().toISOString(),
                source: 'whatsapp_bot'
              };

              // Guardar pedido localmente y en cola para el POS
              saveStoredOrder(newOrder);
              pushOrderToSupabase(newOrder).catch(() => {});
              pendingOrdersForPos.push(newOrder);
              console.log(`🔔 [NUEVA COMANDA WHATSAPP]: Pedido #${orderId} de ${newOrder.customer.name} ($${newOrder.total}) inyectado.`);

              const itemsList = session.items.map(it => `• ${it.name} (x${it.qty || 1}) - $${(it.price * (it.qty || 1)).toLocaleString('es-AR')}${it.modifiers?.length ? ' [' + it.modifiers.join(', ') + ']' : ''}`).join('\n');
              
              let confirmMsg = `🎉 *¡PEDIDO #${orderId} CONFIRMADO Y ENVIADO A LA COCINA!* 🔥🍔\n\n¡Muchas gracias *${newOrder.customer.name}*, tu comanda ya ingresó al sistema de la plancha!\n\n📋 *Detalle:*\n${itemsList}\n\n💵 *Total:* $${newOrder.total.toLocaleString('es-AR')}\n🛵 *Modo:* ${session.shippingMethod === 'delivery' ? '🛵 Envío a Domicilio' : '🛍️ Retiro por el Local'}\n📍 *Dirección:* ${newOrder.customer.address}\n`;

              if (session.paymentMethod === 'transferencia') {
                confirmMsg += `\n💳 *Datos para Transferencia:*\n• *Alias:* \`comandafast.mp\`\n• *Banco:* Mercado Pago\n• *Titular:* ComandaFast Burgers\n\n📸 *Enviá la captura o foto del comprobante por aquí para validar tu pago.* 🔥`;
              } else {
                confirmMsg += `\n💵 *Pago en Efectivo:* Abonás al recibir tu comida. ¡La cocina ya está marchando tu pedido! 🔥`;
              }

              resetCustomerSession(remoteJid);
              await this.sock.sendMessage(remoteJid, { text: confirmMsg });
              continue;
            } else {
              resetCustomerSession(remoteJid);
              await this.sock.sendMessage(remoteJid, { text: '❌ *Pedido cancelado.* Escribí *MENU* para ver más opciones.' });
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
              await this.sock.sendMessage(remoteJid, {
                text: '⚠️ Por favor respondé con *1* para Efectivo o *2* para Transferencia Bancaria:'
              });
              continue;
            }

            session.step = 'CONFIRMING';
            const itemsList = session.items.map(it => `• ${it.name} (x${it.qty || 1}) - $${(it.price * (it.qty || 1)).toLocaleString('es-AR')}${it.modifiers?.length ? ' [' + it.modifiers.join(', ') + ']' : ''}`).join('\n');
            const shippingLabel = session.shippingMethod === 'delivery' ? '🛵 Envío a Domicilio' : '🛍️ Retiro por el Local (Mostrador)';

            const summary = `🍔 *RESUMEN DE TU COMANDA* 🔥\n\n🛒 *Items:*\n${itemsList}\n\n🛵 *Entrega:* ${shippingLabel}\n📍 *Dirección:* ${session.shippingAddress}\n👤 *Cliente:* ${session.customerName}\n💳 *Forma de Pago:* ${session.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia Bancaria'}\n\n💵 *TOTAL A PAGAR:* $${session.total.toLocaleString('es-AR')}\n\n¿Está todo perfecto para mandar a la cocina?\n👉 Respondé *SI* para confirmar o *CANCELAR*.`;
            
            await this.sock.sendMessage(remoteJid, { text: summary });
            continue;
          }

          // ESTADO: ASK_NAME (Nombre del cliente)
          if (session.step === 'ASK_NAME') {
            session.customerName = text.trim();
            session.step = 'ASK_PAYMENT';
            await this.sock.sendMessage(remoteJid, {
              text: `¡Perfecto *${session.customerName}*! 👍\n\n💳 *¿Cómo preferís abonar?*\n\n1️⃣ *Efectivo* (al recibir o retirar)\n2️⃣ *Transferencia Bancaria / Mercado Pago*\n\n_Respondé con 1 o 2:_`
            });
            continue;
          }

          // ESTADO: ASK_ADDRESS (Dirección para delivery)
          if (session.step === 'ASK_ADDRESS') {
            session.shippingAddress = text.trim();
            session.step = 'ASK_NAME';
            await this.sock.sendMessage(remoteJid, {
              text: '👤 *¿A nombre de quién preparamos el pedido?*\n(Escribí tu nombre y apellido):'
            });
            continue;
          }

          // ESTADO: ASK_SHIPPING_METHOD (Las dos opciones: Retiro en local o Delivery)
          if (session.step === 'ASK_SHIPPING_METHOD') {
            if (lower === '1' || lower.includes('retiro') || lower.includes('local') || lower.includes('mostrador') || lower.includes('take away')) {
              session.shippingMethod = 'local';
              session.shippingAddress = 'Retiro en Local (Mostrador)';
              session.step = 'ASK_NAME';
              await this.sock.sendMessage(remoteJid, {
                text: '🛍️ *Retiro por el local seleccionado.*\n\n👤 *¿A nombre de quién registramos la comanda?*\n(Escribí tu nombre y apellido):'
              });
              continue;
            } else if (lower === '2' || lower.includes('envio') || lower.includes('envío') || lower.includes('delivery') || lower.includes('domicilio')) {
              session.shippingMethod = 'delivery';
              session.step = 'ASK_ADDRESS';
              await this.sock.sendMessage(remoteJid, {
                text: '🛵 *Envío a domicilio seleccionado.*\n\n📍 *Por favor escribí tu dirección exacta y entrecalles para el cadete:*'
              });
              continue;
            } else {
              await this.sock.sendMessage(remoteJid, {
                text: '⚠️ Por favor elegí una de las dos opciones:\n\n1️⃣ *Retiro por el local (Take Away)*\n2️⃣ *Envío a domicilio con cadete (Delivery)*'
              });
              continue;
            }
          }

          // ESTADO: SELECTING (Seleccionando productos o modificadores)
          if (session.step === 'SELECTING') {
            if (lower === 'listo' || lower === 'pedir' || lower === 'comprar' || lower === 'terminar' || lower === 'seguir' || lower === 'avanzar') {
              if (session.items.length === 0) {
                await this.sock.sendMessage(remoteJid, {
                  text: '⚠️ Tu comanda está vacía. Escribí el *NÚMERO* de la burger que querés o escribí *MENU*.'
                });
                continue;
              }
              session.step = 'ASK_SHIPPING_METHOD';
              await this.sock.sendMessage(remoteJid, {
                text: `🛵 *¿Cómo querés recibir tu comanda?*\n\nRespondé con el número de opción:\n1️⃣ *Retiro por el local (Take Away)* 🏷️ Sin costo\n2️⃣ *Envío a domicilio con cadete (Delivery)*`
              });
              continue;
            }

            // Detección de modificadores (ej: sin cebolla, extra cheddar)
            if (lower.startsWith('sin ') || lower.startsWith('con ') || lower.startsWith('extra ') || lower.includes('cebolla') || lower.includes('cheddar') || lower.includes('panceta')) {
              if (session.items.length > 0) {
                const lastItem = session.items[session.items.length - 1];
                if (!lastItem.modifiers) lastItem.modifiers = [];
                lastItem.modifiers.push(text);
                await this.sock.sendMessage(remoteJid, {
                  text: `📝 *Modificador agregado a ${lastItem.name}:* "${text}".\n\n👉 ¿Querés sumar algo más? *(Escribí el número)*\n👉 O escribí *LISTO* para avanzar con la entrega.`
                });
                continue;
              }
            }

            // Intentar sumar otro producto
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
                  qty: 1,
                  quantity: 1,
                  modifiers: []
                });
              }

              session.subtotal = session.items.reduce((acc, it) => acc + (it.price * (it.qty || 1)), 0);
              session.total = session.subtotal;

              const itemsList = session.items.map(it => `• ${it.name} (x${it.qty || 1}) - $${(it.price * (it.qty || 1)).toLocaleString('es-AR')}${it.modifiers?.length ? ' [' + it.modifiers.join(', ') + ']' : ''}`).join('\n');

              await this.sock.sendMessage(remoteJid, {
                text: `✅ *¡Sumaste ${selectedProd.name}!* 🍔 (+$${Number(selectedProd.price).toLocaleString('es-AR')})\n\n🛒 *Tu comanda actual:*\n${itemsList}\n\n💵 *Subtotal:* $${session.total.toLocaleString('es-AR')}\n\n👉 ¿Querés sumar algo más? *(Escribí otro número)*\n👉 ¿Modificaciones? *(Ej: Sin cebolla, Extra cheddar)*\n👉 O escribí *LISTO* para continuar.`
              });
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
            await this.sock.sendMessage(remoteJid, { text: reply });
            continue;
          }

          if (lower === 'anterior' || lower === 'atras' || lower === 'volver' || lower === 'prev') {
            const totalPages = Math.ceil(prods.length / 8) || 1;
            session.catalogPage = Math.max(1, (session.catalogPage || 1) - 1);
            const reply = buildCatalogMessage(prods, session.catalogPage, 8, false);
            await this.sock.sendMessage(remoteJid, { text: reply });
            continue;
          }

          if (/^(pag|pagina|página)\s*(\d+)$/i.test(lower)) {
            const pageMatch = lower.match(/\d+/);
            const pNum = parseInt(pageMatch[0], 10);
            session.catalogPage = pNum;
            const reply = buildCatalogMessage(prods, pNum, 8, false);
            await this.sock.sendMessage(remoteJid, { text: reply });
            continue;
          }

          if (lower === 'ver todo' || lower === 'todo' || lower === 'todas' || lower === 'completa' || lower === 'completo') {
            const reply = buildCatalogMessage(prods, 1, 8, true);
            await this.sock.sendMessage(remoteJid, { text: reply });
            continue;
          }

          // -------------------------------------------------------------
          // OPCIONES DEL MENÚ PRINCIPAL (1, 2, 3, 4, 5)
          // -------------------------------------------------------------
          if (lower === '1') {
            await this.sock.sendMessage(remoteJid, {
              text: '📋 *Estado de Pedido:*\n\nIngresá tu número de orden (ej: *CMD-1234*) o aguardá un instante que un encargado verifique el estado en la plancha. 🔥'
            });
            continue;
          }

          if (lower === '2') {
            await this.sock.sendMessage(remoteJid, {
              text: '💳 *Datos para Transferencia:* 🏦\n• *Alias:* `comandafast.mp`\n• *Banco:* Mercado Pago\n• *Titular:* ComandaFast Burgers\n\n📸 *Enviá la captura o comprobante por aquí para verificar tu pago.*'
            });
            continue;
          }

          if (lower === '3') {
            await this.sock.sendMessage(remoteJid, {
              text: '📍 *Ubicación y Horarios:* 🕒\n🍔 Av. Belgrano 1234, Centro\n⏰ Miércoles a Domingos de 19:30 a 00:30 hs.'
            });
            continue;
          }

          if (lower === '4' || lower === 'carta' || lower === 'catalogo' || lower === 'menu') {
            session.step = 'SELECTING';
            session.catalogPage = 1;
            const reply = buildCatalogMessage(prods, 1, 8, false);
            await this.sock.sendMessage(remoteJid, { text: reply });
            continue;
          }

          if (lower === '5' || lower === 'pedir' || lower === 'hacer pedido' || lower === 'comprar') {
            session.step = 'SELECTING';
            session.catalogPage = 1;
            const reply = buildCatalogMessage(prods, 1, 8, false);
            await this.sock.sendMessage(remoteJid, { text: reply });
            continue;
          }

          // -------------------------------------------------------------
          // SELECCIÓN DIRECTA DE HAMBURGUESAS (POR NÚMERO 1-23 O NOMBRE)
          // -------------------------------------------------------------
          const initialNum = parseInt(lower.replace(/\D/g, ''), 10);
          let matchedProd = null;
          if (!isNaN(initialNum) && initialNum >= 1 && initialNum <= prods.length) {
            matchedProd = prods[initialNum - 1];
          } else {
            matchedProd = prods.find(p => lower.includes(p.name.toLowerCase()));
          }

          if (matchedProd && (lower.startsWith('comprar') || lower.startsWith('pedir') || lower.startsWith('quiero') || !isNaN(initialNum) || session.step === 'SELECTING')) {
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
                qty: 1,
                quantity: 1,
                modifiers: []
              });
            }

            session.subtotal = session.items.reduce((acc, it) => acc + (it.price * (it.qty || 1)), 0);
            session.total = session.subtotal;

            const itemsList = session.items.map(it => `• ${it.name} (x${it.qty || 1}) - $${(it.price * (it.qty || 1)).toLocaleString('es-AR')}${it.modifiers?.length ? ' [' + it.modifiers.join(', ') + ']' : ''}`).join('\n');

            const reply = `✅ *¡Excelente elección! Sumaste ${matchedProd.name}* 🍔 (+$$${Number(matchedProd.price).toLocaleString('es-AR')})\n\n🛒 *Tu comanda actual:*\n${itemsList}\n\n💵 *Subtotal:* $${session.total.toLocaleString('es-AR')}\n\n👉 ¿Querés sumar otra burger o bebida? *(Escribí su número)*\n👉 ¿Algún cambio? *(Ej: Sin cebolla, Extra cheddar)*\n👉 O respondé *LISTO* para elegir forma de entrega.`;
            await this.sock.sendMessage(remoteJid, { text: reply });
            continue;
          }

          // CONSULTA INTELIGENTE CON GOOGLE GEMINI AI (Patrón Candy Shop)
          try {
            const aiReply = await geminiBotService.generateReply(text, {
              customerName: msg.pushName || '',
              customerPhone: remoteJid,
              availableProducts: prods
            });

            if (aiReply) {
              console.log(`✨ [WHATSAPP IA GEMINI]: Respondiendo a ${remoteJid}`);
              await this.sock.sendMessage(remoteJid, { text: aiReply });
              continue;
            }
          } catch (aiErr) {
            console.warn('[WHATSAPP BOT GEMINI AI ERROR]:', aiErr);
          }

          // SALUDO POR DEFECTO
          const reply = `🍔 *¡Hola! Bienvenido a ComandaFast Burgers* 🔥\n\n¿En qué podemos ayudarte hoy?\n\n1️⃣ *Consultar estado de pedido*\n2️⃣ *Datos de transferencia / Alias*\n3️⃣ *Horarios y ubicación*\n4️⃣ *Ver carta completa y fotos (${prods.length} burgers)*\n5️⃣ *Hacer un pedido ahora* 🍔\n\n_Respondé con el número de opción o escribí tu pedido directo._`;
          await this.sock.sendMessage(remoteJid, { text: reply });
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
// ENDPOINTS HTTP
// =========================================================
app.get('/status', (req, res) => {
  res.json({
    status: botServer.status,
    qrCode: botServer.qrCode,
    user: botServer.connectedUser,
    port: PORT,
    productsCount: getStoredProducts().length,
    pendingOrdersCount: pendingOrdersForPos.length,
    timestamp: new Date().toISOString()
  });
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
app.post('/api/orders', (req, res) => {
  const order = req.body;
  if (!order || !order.id) {
    return res.status(400).json({ success: false, error: 'Pedido inválido o sin id' });
  }

  const normalizedOrder = {
    id: order.id,
    orderNumber: order.orderNumber || order.order_number || (Math.floor(Date.now() % 1000) + 1),
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

// Endpoint para actualizar estado de un pedido desde cualquier dispositivo (Android, POS, etc.)
app.patch('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status requerido' });

  const orders = getStoredOrders();
  const idx = orders.findIndex(o => o.id === id);
  if (idx !== -1) {
    orders[idx].status = status;
    orders[idx].updatedAt = Date.now();
    try {
      fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
    } catch (_) {}
  }

  const pIdx = pendingOrdersForPos.findIndex(o => o.id === id);
  if (pIdx !== -1) {
    pendingOrdersForPos[pIdx].status = status;
  }

  updateOrderStatusInSupabase(id, status).catch(() => {});

  console.log(`🔄 [SYNC STATUS] Pedido ${id} actualizado a estado '${status}' en servidor local y Supabase.`);
  res.json({ success: true, id, status });
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

app.get('/api/bot-variables', (req, res) => {
  res.json({ success: true, variables: getBotVariables() });
});

app.post('/api/bot-variables', (req, res) => {
  const { variables } = req.body;
  if (!variables || !Array.isArray(variables)) {
    return res.status(400).json({ success: false, error: 'Formato inválido de variables' });
  }
  saveBotVariables(variables);
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
  const { enabled, model, apiKey, secondaryApiKey, systemPrompt } = req.body;
  const updated = geminiBotService.saveConfig({ enabled, model, apiKey, secondaryApiKey, systemPrompt });
  pushBotConfigToSupabase('ai_config', updated).catch(() => {});
  res.json({ success: true, config: updated });
});

app.post('/api/ai/test', async (req, res) => {
  const { apiKey } = req.body;
  const result = await geminiBotService.testConnection(apiKey);
  res.json(result);
});

app.post('/api/ai/chat', async (req, res) => {
  const { message, customerName, availableProducts } = req.body;
  const prods = availableProducts || getStoredProducts();
  const reply = await geminiBotService.generateReply(message, { customerName, availableProducts: prods });
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

const server = app.listen(PORT, () => {
  console.log(`\n=========================================================`);
  console.log(`🍔 SERVIDOR WHATSAPP BOT COMANDAFAST (BAILEYS MULTI-DEVICE)`);
  console.log(`👉 Puerto: ${PORT} | Endpoint: http://localhost:${PORT}/status`);
  console.log(`=========================================================\n`);
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

