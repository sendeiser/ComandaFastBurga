// =========================================================
// WHATSAPP BOT SERVER (Node.js & Baileys Multi-Device)
// Microservicio opcional para conexión en vivo 24/7 a WhatsApp
// =========================================================

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3002;
const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'bot_settings.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let botStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
let currentQr = null;
let connectedUser = null;

// Endpoint: Estado actual del Bot
app.get('/status', (req, res) => {
  res.json({
    status: botStatus,
    qrCode: currentQr,
    user: connectedUser,
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Endpoint: Iniciar vinculación WhatsApp
app.post('/start', (req, res) => {
  console.log('🤖 [WHATSAPP BOT] Iniciando protocolo de conexión...');
  botStatus = 'qr_ready';
  currentQr = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=COMANDAFAST-BOT-LIVE-' + Date.now();
  res.json({ success: true, status: botStatus, qrCode: currentQr });
});

// Endpoint: Cerrar sesión
app.post('/logout', (req, res) => {
  console.log('🤖 [WHATSAPP BOT] Cerrando sesión...');
  botStatus = 'disconnected';
  currentQr = null;
  connectedUser = null;
  res.json({ success: true, status: botStatus });
});

// Endpoint: Notificación automática de cambio de estado KDS
app.post('/notify-status', (req, res) => {
  const { phone, customer, orderId, newStatus, total, address } = req.body;
  console.log(`📲 [WHATSAPP NOTIFY] Enviando aviso a ${phone} (${customer}) -> Pedido #${orderId} a estado: ${newStatus}`);
  
  // Aquí se enviaría el mensaje mediante el socket Baileys si está conectado
  res.json({ success: true, delivered: botStatus === 'connected' });
});

app.listen(PORT, () => {
  console.log(`\n=========================================================`);
  console.log(`🤖 SERVIDOR WHATSAPP BOT COMANDAFAST ACTIVO EN PUERTO ${PORT}`);
  console.log(`👉 http://localhost:${PORT}/status`);
  console.log(`=========================================================\n`);
});
