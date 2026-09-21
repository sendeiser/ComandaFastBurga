// =========================================================
// WHATSAPP BOT SERVER (Node.js & Baileys Multi-Device)
// Conexión real 24/7 con WhatsApp Web oficial (Cero Costos de API)
// Sincronización de Base de Datos y Envío de Fotos Reales de Productos
// =========================================================

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import pino from 'pino';
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

class WhatsAppBotServer {
  constructor() {
    this.sock = null;
    this.status = 'disconnected';
    this.qrCode = null;
    this.connectedUser = null;
    this.isStarting = false;
  }

  async start(force = false) {
    if (this.status === 'connected') {
      return { status: this.status, qrCode: null, user: this.connectedUser };
    }

    if (this.isStarting && !force) {
      return { status: this.status, qrCode: this.qrCode };
    }

    this.isStarting = true;
    this.status = 'connecting';

    try {
      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners();
          this.sock.end(undefined);
        } catch (_) {}
        this.sock = null;
      }

      console.log('🤖 [WHATSAPP BOT] Inicializando conexión Multi-Device Baileys...');
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

      const logger = pino({ level: 'silent' });

      this.sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        browser: Browsers.macOS('Desktop'),
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 15000,
        defaultQueryTimeoutMs: 60000,
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
            console.log('📲 [WHATSAPP BOT] Código QR emitido y listo para escanear.');
          } catch (err) {
            console.error('[WHATSAPP BOT] Error al generar DataURL de QR:', err);
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
          console.log(`✅ [WHATSAPP BOT] ¡Conectado exitosamente como ${this.connectedUser?.name || this.connectedUser?.id}!`);
        }
      });

      // Escuchar mensajes entrantes con soporte de FOTOS REALES
      this.sock.ev.on('messages.upsert', async (chatUpdate) => {
        if (!chatUpdate.messages || chatUpdate.messages.length === 0) return;

        const prods = getStoredProducts();

        for (const msg of chatUpdate.messages) {
          if (msg.key?.fromMe || !msg.key?.remoteJid || msg.key.remoteJid.endsWith('@g.us')) continue;

          const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
          if (!text.trim()) continue;

          console.log(`📩 [WHATSAPP]: De ${msg.key.remoteJid} -> "${text}"`);
          
          const lower = text.toLowerCase();
          const remoteJid = msg.key.remoteJid;

          // 1. SOLICITUD DE FOTO DE UN PRODUCTO ESPECÍFICO
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
                    // Convertir Base64 a Buffer
                    const base64Data = target.image.split(';base64,').pop();
                    const imageBuffer = Buffer.from(base64Data, 'base64');
                    await this.sock.sendMessage(remoteJid, { image: imageBuffer, caption });
                    continue;
                  } else if (target.image.startsWith('http')) {
                    // Enlace URL directo
                    await this.sock.sendMessage(remoteJid, { image: { url: target.image }, caption });
                    continue;
                  }
                } catch (imgErr) {
                  console.warn('[WHATSAPP BOT] Error al enviar foto por socket:', imgErr);
                }
              }

              // Fallback de texto si no hay imagen o falla el buffer
              await this.sock.sendMessage(remoteJid, { text: caption });
              continue;
            }
          }

          // 2. SALUDO O MENÚ PRINCIPAL
          if (lower.includes('hola') || lower.includes('menu') || lower.includes('menú') || lower.includes('burger') || lower.includes('pedido') || lower === 'buenas') {
            const reply = `🍔 *¡Hola! Bienvenido a ComandaFast Burgers* 🔥\n\n¿En qué podemos ayudarte hoy?\n\n1️⃣ *Consultar estado de pedido*\n2️⃣ *Datos de transferencia / Alias*\n3️⃣ *Horarios y ubicación*\n4️⃣ *Ver carta completa (${prods.length} burgers)*\n5️⃣ *Hablar con un encargado*\n\n_Respondé con el número de opción o escribí tu pedido directo._`;
            await this.sock.sendMessage(remoteJid, { text: reply });
          } else if (lower === '1') {
            await this.sock.sendMessage(remoteJid, { text: `📋 Para consultar tu pedido ingresá tu número de orden o aguardá que un encargado verifique la plancha. 🔥` });
          } else if (lower === '2') {
            await this.sock.sendMessage(remoteJid, { text: `💳 *Datos para Transferencia:* 🏦\n• *Alias:* \`comandafast.mp\`\n• *Banco:* Mercado Pago\n• *Titular:* ComandaFast Burgers\n\n📸 *Enviá la captura del comprobante por aquí para comenzar a cocinar.*` });
          } else if (lower === '3') {
            await this.sock.sendMessage(remoteJid, { text: `📍 *Ubicación y Horarios:* 🕒\n🍔 Av. Belgrano 1234, Centro\n⏰ Miércoles a Domingos de 19:30 a 00:30 hs.` });
          } else if (lower === '4' || lower === 'carta' || lower === 'catalogo') {
            const list = prods.slice(0, 10).map((p, i) => `${i + 1}️⃣ *${p.name}* — $${Number(p.price).toLocaleString('es-AR')} ${p.image ? '📸' : ''}`).join('\n');
            const reply = `🍔 *CARTA DE COMANDAFAST (${prods.length} productos en BD):* 🔥\n\n${list}\n\n👉 Escribí *FOTO [número]* para ver la foto real de cada hamburguesa (ej: *FOTO 1*).\n👉 O escribí el número para ordenar.`;
            await this.sock.sendMessage(remoteJid, { text: reply });
          }
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

// Iniciar automáticamente
botServer.start().catch(() => {});

// ENDPOINTS HTTP
app.get('/status', (req, res) => {
  res.json({
    status: botServer.status,
    qrCode: botServer.qrCode,
    user: botServer.connectedUser,
    port: PORT,
    productsCount: getStoredProducts().length,
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
