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
    orders.unshift(order);
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
          // ESTADO IDLE / MENÚ PRINCIPAL
          // -------------------------------------------------------------
          // Verificación de si el mensaje es para hacer un pedido o seleccionar una hamburguesa
          const initialNum = parseInt(lower.replace(/\D/g, ''), 10);
          let matchedProd = null;
          if (!isNaN(initialNum) && initialNum >= 1 && initialNum <= prods.length && lower.length < 5) {
            matchedProd = prods[initialNum - 1];
          } else {
            matchedProd = prods.find(p => lower.includes(p.name.toLowerCase()));
          }

          if (matchedProd && (lower.startsWith('comprar') || lower.startsWith('pedir') || lower.startsWith('quiero') || lower.length < 15 || session.step === 'SELECTING')) {
            session.step = 'SELECTING';
            session.items = [{
              id: matchedProd.id,
              name: matchedProd.name,
              price: Number(matchedProd.price),
              qty: 1,
              quantity: 1,
              modifiers: []
            }];
            session.subtotal = Number(matchedProd.price);
            session.total = session.subtotal;

            const reply = `✅ *¡Excelente elección! Agregaste ${matchedProd.name}* 🍔\n\n💵 *Precio:* $${Number(matchedProd.price).toLocaleString('es-AR')}\n\n👉 ¿Querés sumar otra burger o bebida? *(Escribí su número)*\n👉 ¿Algún cambio? *(Ej: Sin cebolla, Extra cheddar)*\n👉 O respondé *LISTO* para elegir forma de entrega.`;
            await this.sock.sendMessage(remoteJid, { text: reply });
            continue;
          }

          if (lower === '5' || lower === 'pedir' || lower === 'hacer pedido' || lower === 'comprar') {
            session.step = 'SELECTING';
            const list = prods.slice(0, 10).map((p, i) => `${i + 1}️⃣ *${p.name}* — $${Number(p.price).toLocaleString('es-AR')}`).join('\n');
            const reply = `🍔 *¿Qué burger te gustaría pedir hoy?* 🔥\n\n${list}\n\n👉 *Respondé con el número de la hamburguesa* que querés sumar a tu comanda:`;
            await this.sock.sendMessage(remoteJid, { text: reply });
            continue;
          }

          // OPCIONES INFORMATIVAS
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

          if (lower === '4' || lower === 'carta' || lower === 'catalogo') {
            const list = prods.slice(0, 10).map((p, i) => `${i + 1}️⃣ *${p.name}* — $${Number(p.price).toLocaleString('es-AR')} ${p.image ? '📸' : ''}`).join('\n');
            const reply = `🍔 *CARTA DE COMANDAFAST (${prods.length} productos):* 🔥\n\n${list}\n\n👉 Escribí *FOTO [número]* para ver la foto real (ej: *FOTO 1*).\n👉 O escribí el número para comenzar a ordenar.`;
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

// Endpoint para consultar histórico de pedidos de WhatsApp
// =========================================================
// ENDPOINTS DE INTELIGENCIA ARTIFICIAL (GOOGLE GEMINI)
// =========================================================
app.get('/api/ai/config', (req, res) => {
  res.json({ success: true, config: geminiBotService.getConfigSafe() });
});

app.post('/api/ai/config', (req, res) => {
  const { enabled, model, apiKey, systemPrompt } = req.body;
  const updated = geminiBotService.saveConfig({ enabled, model, apiKey, systemPrompt });
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
  res.json({ success: true, orders: getStoredOrders() });
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
