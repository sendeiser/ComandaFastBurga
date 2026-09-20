// =========================================================
// ESC/POS PRINTER & CASH DRAWER MICROSERVICE (Node.js)
// Conexión física a impresoras térmicas USB/Red (Puerto 9100) y apertura de cajón
// =========================================================

import express from 'express';
import cors from 'cors';
import net from 'net';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

// Comando estándar ESC/POS para abrir cajón de dinero (24V pulso RJ11)
const DRAWER_KICK_BUFFER = Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]);

// Comando ESC/POS para corte total de papel con avance
const PAPER_CUT_BUFFER = Buffer.from([0x1D, 0x56, 0x41, 0x03]);

app.get('/status', (req, res) => {
  res.json({ status: 'ready', port: PORT, message: 'Servidor de Impresión Térmica ESC/POS Activo' });
});

// Endpoint para abrir cajón de dinero
app.post('/open-drawer', (req, res) => {
  console.log('⚡ [CASH DRAWER] Disparando pulso de apertura de cajón de dinero...');
  
  const printerIp = req.body.printerIp;
  if (printerIp) {
    const client = new net.Socket();
    client.connect(9100, printerIp, () => {
      client.write(DRAWER_KICK_BUFFER);
      client.end();
    });
  }

  res.json({ success: true, message: 'Comando de apertura enviado al cajón de dinero.' });
});

// Endpoint para imprimir ticket ESC/POS raw
app.post('/print', (req, res) => {
  const { type, order, rawText, printerIp } = req.body;
  console.log(`🖨️ [PRINT JOB] Imprimiendo: ${type} - Orden #${order?.orderNumber || 'N/A'}`);

  if (printerIp) {
    const client = new net.Socket();
    client.connect(9100, printerIp, () => {
      if (rawText) {
        client.write(Buffer.from(rawText, 'utf-8'));
      }
      client.write(PAPER_CUT_BUFFER);
      client.end();
    });
  }

  res.json({ success: true, message: 'Trabajo de impresión despachado.' });
});

app.listen(PORT, () => {
  console.log(`🚀 ComandaFast Printer Server corriendo en http://localhost:${PORT}`);
  console.log(`📡 Esperando comandos de impresión térmica y apertura de cajón en /print y /open-drawer`);
});
