// =========================================================
// WHATSAPP BOT SERVER (Node.js & Baileys Multi-Device)
// Conexión real 24/7 con WhatsApp Web oficial (Cero Costos de API)
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
app.use(express.json());

const PORT = 3002;
const DATA_DIR = path.join(process.cwd(), 'data');
const AUTH_DIR = path.join(DATA_DIR, 'baileys_auth');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class WhatsAppBotServer {
  constructor() {
    this.sock = null;
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
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

            console.log('\n============================================================');
            console.log('  📲 ESCANEÁ ESTE CÓDIGO QR CON TU WHATSAPP (Dispositivos vinculados):');
            console.log('============================================================\n');
            try {
              const terminalQr = await QRCode.toString(qr, { type: 'terminal', small: true });
              console.log(terminalQr);
            } catch (_) {}
            console.log('============================================================\n');
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
            console.log(`ℹ️ [WHATSAPP BOT] Conexión cerrada (${statusCode || 'desconocido'}). Reconectando en 3s...`);
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

      // Escuchar mensajes entrantes
      this.sock.ev.on('messages.upsert', async (chatUpdate) => {
        if (!chatUpdate.messages || chatUpdate.messages.length === 0) return;

        for (const msg of chatUpdate.messages) {
          if (msg.key?.fromMe || !msg.key?.remoteJid || msg.key.remoteJid.endsWith('@g.us')) continue;

          const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
          if (!text.trim()) continue;

          console.log(`📩 [WHATSAPP MENSAJE]: De ${msg.key.remoteJid} -> "${text}"`);
          
          const lower = text.toLowerCase();
          const remoteJid = msg.key.remoteJid;

          if (lower.includes('hola') || lower.includes('menu') || lower.includes('menú') || lower.includes('burger') || lower.includes('pedido') || lower === 'buenas') {
            const reply = `🍔 *¡Hola! Bienvenido a ComandaFast Burgers* 🔥\n\n¿En qué podemos ayudarte hoy?\n\n1️⃣ *Consultar estado de pedido*\n2️⃣ *Datos de transferencia / Alias*\n3️⃣ *Horarios y ubicación*\n4️⃣ *Ver carta de hamburguesas y combos*\n5️⃣ *Hablar con un encargado*\n\n_Respondé con el número de opción o escribí tu pedido directo._`;
            await this.sock.sendMessage(remoteJid, { text: reply });
          } else if (lower === '1') {
            await this.sock.sendMessage(remoteJid, { text: `📋 Para consultar tu pedido ingresá tu número de orden o aguardá que un encargado verifique la plancha. 🔥` });
          } else if (lower === '2') {
            await this.sock.sendMessage(remoteJid, { text: `💳 *Datos para Transferencia:* 🏦\n• *Alias:* \`comandafast.mp\`\n• *Banco:* Mercado Pago\n• *Titular:* ComandaFast Burgers\n\n📸 *Enviá la captura del comprobante por aquí.*` });
          } else if (lower === '3') {
            await this.sock.sendMessage(remoteJid, { text: `📍 *Ubicación y Horarios:* 🕒\n🍔 Av. Belgrano 1234, Centro\n⏰ Miércoles a Domingos de 19:30 a 00:30 hs.` });
          } else if (lower === '4') {
            await this.sock.sendMessage(remoteJid, { text: `🍔 *CARTA DE BURGERS COMANDAFAST:* 🔥\n\n1️⃣ Clásica Cheeseburger — $5.800\n2️⃣ Doble Bacon Cheddar — $7.200\n3️⃣ Triple Smash Burger — $8.500\n4️⃣ Papas con Cheddar y Bacon — $3.900\n\n👉 Escribí el número para ordenar.` });
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

// Auto-start al encender
botServer.start().catch(() => {});

// ENDPOINTS HTTP
app.get('/status', (req, res) => {
  res.json({
    status: botServer.status,
    qrCode: botServer.qrCode,
    user: botServer.connectedUser,
    port: PORT,
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

app.listen(PORT, () => {
  console.log(`\n=========================================================`);
  console.log(`🤖 SERVIDOR WHATSAPP BOT COMANDAFAST (BAILEYS MULTI-DEVICE)`);
  console.log(`👉 Puerto: ${PORT} | Endpoint: http://localhost:${PORT}/status`);
  console.log(`=========================================================\n`);
});
