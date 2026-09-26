const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'server', 'whatsappBotServer.js');
let content = fs.readFileSync(file, 'utf-8');

const target = `            // INICIAR PEDIDO DIRECTO ('comprar', 'pedir', 'hacer pedido')
            if (lower === 'comprar' || lower === 'pedir' || lower === 'hacer pedido' || lower === 'quiero pedir') {
              session.step = 'SELECTING';
              session.catalogPage = 1;
              const reply = buildCatalogMessage(prods, 1, 8, false);
              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              continue;
            }`;

const replacement = `            // INICIAR PEDIDO DIRECTO ('comprar', 'pedir', 'hacer pedido')
            if (lower === 'comprar' || lower === 'pedir' || lower === 'hacer pedido' || lower === 'quiero pedir') {
              const tplsCmp = getBotTemplates();
              const bizCmp = getBusinessContext();
              const menuModeCmp = tplsCmp.menu_mode || 'catalog';
              if (menuModeCmp === 'catalog') {
                const catalogUrl = (bizCmp.catalogo_url || bizCmp.sitio_web || 'https://comandafast.online').replace(/\\/$/, '');
                const catalogLink = \`🛒 *¡Vamos a armar tu pedido!* 🔥\\n\\n📱 Entrá a nuestra carta interactiva con fotos:\\n👉 \${catalogUrl}/#catalog\\n\\nElegí lo que más te guste, armá tu carrito y envialo por acá mismo. ¡En segundos ingresa directo a la cocina! 🍔✨\\n\\n_También podés escribir directamente lo que querés (ej: Promo Doble Cheddar) y te ayudo._\`;
                await this.safeSendMessage(remoteJid, { text: catalogLink }, msg.key);
              } else {
                session.step = 'SELECTING';
                session.catalogPage = 1;
                const reply = buildCatalogMessage(prods, 1, 8, false);
                await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              }
              continue;
            }`;

const targetCrlf = target.replace(/\n/g, '\r\n');
const replacementCrlf = replacement.replace(/\n/g, '\r\n');

if (content.includes(targetCrlf)) {
  content = content.replace(targetCrlf, replacementCrlf);
  fs.writeFileSync(file, content, 'utf-8');
  console.log('✅ COMPRAR handler updated with CRLF');
} else if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content, 'utf-8');
  console.log('✅ COMPRAR handler updated with LF');
} else {
  console.log('⚠️ Target not found in file');
}

// Sync to portable bot
const portableFile = path.join(__dirname, '..', 'ComandaFast-Bot-Portatil', 'server', 'whatsappBotServer.js');
if (fs.existsSync(path.dirname(portableFile))) {
  fs.writeFileSync(portableFile, content, 'utf-8');
  console.log('✅ Portable bot whatsappBotServer.js synced');
}
