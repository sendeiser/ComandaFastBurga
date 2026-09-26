/**
 * patch_menu_mode.cjs
 * Adds menu_mode support to whatsappBotServer.js:
 * - 'catalog': sends online catalog link (web app)
 * - 'templates': classic numbered text menu (current behavior)
 */
const fs = require('fs');
const path = require('path');

const TARGET = path.join(__dirname, '..', 'server', 'whatsappBotServer.js');
let content = fs.readFileSync(TARGET, 'utf-8');
let changed = 0;

// ---------------------------------------------------------------
// 1. Add menu_mode to DEFAULT_SERVER_TEMPLATES (after bot_typing_mode line)
// ---------------------------------------------------------------
const TYPING_MODE_LINE = "bot_typing_mode: 'human_dynamic',";
if (!content.includes("menu_mode:")) {
  if (content.includes(TYPING_MODE_LINE)) {
    content = content.replace(
      TYPING_MODE_LINE,
      TYPING_MODE_LINE + "\r\n  menu_mode: 'catalog', // 'catalog' = link al catálogo web | 'templates' = menú clásico de plantillas"
    );
    console.log('✅ [1] menu_mode added to DEFAULT_SERVER_TEMPLATES');
    changed++;
  } else {
    console.warn('⚠️  [1] Could not find bot_typing_mode line');
  }
} else {
  console.log('ℹ️  [1] menu_mode already exists, skipping');
}

// ---------------------------------------------------------------
// 2. Replace OPCIÓN 4 handler (lower === '4' || lower === 'carta' ...)
// ---------------------------------------------------------------
const OLD_OPT4 = `            // OPCIÓN 4: VER CARTA COMPLETA / CATÁLOGO
            if (lower === '4' || lower === 'carta' || lower === 'catalogo' || lower === 'catálogo') {
              session.step = 'SELECTING';
              session.catalogPage = 1;
              const reply = buildCatalogMessage(prods, 1, 8, false);
              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              continue;
            }`;

const NEW_OPT4 = `            // OPCIÓN 4: VER CARTA COMPLETA / CATÁLOGO
            if (lower === '4' || lower === 'carta' || lower === 'catalogo' || lower === 'catálogo') {
              const tpls4 = getBotTemplates();
              const biz4 = getBusinessContext();
              const menuMode = tpls4.menu_mode || 'catalog';
              if (menuMode === 'catalog') {
                // MODO CATÁLOGO ONLINE: envía link al catálogo web con fotos
                const catalogUrl = (biz4.catalogo_url || biz4.sitio_web || 'https://comandafast.online').replace(/\\/$/, '');
                const catalogLink = \`🍔 *¡Mirá nuestra carta completa con fotos y precios!* 📸\\n\\n👉 \${catalogUrl}/#catalog\\n\\nDesde ahí podés armar tu pedido y enviarlo directamente por este mismo WhatsApp. ¡Todo en segundos! 🔥\\n\\n_También podés escribir el nombre de lo que querés y te ayudo._\`;
                await this.safeSendMessage(remoteJid, { text: catalogLink }, msg.key);
              } else {
                // MODO PLANTILLAS CLÁSICO: menú numerado de texto
                session.step = 'SELECTING';
                session.catalogPage = 1;
                const reply = buildCatalogMessage(prods, 1, 8, false);
                await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              }
              continue;
            }`;

if (content.includes(OLD_OPT4.trim().substring(0, 60))) {
  content = content.replace(OLD_OPT4, NEW_OPT4);
  console.log('✅ [2] OPCIÓN 4 handler updated');
  changed++;
} else {
  console.warn('⚠️  [2] OPCIÓN 4 pattern not found, trying line-by-line...');
  // Try with CRLF
  const OLD_OPT4_CRLF = OLD_OPT4.replace(/\n/g, '\r\n');
  if (content.includes(OLD_OPT4_CRLF.trim().substring(0, 60))) {
    content = content.replace(OLD_OPT4_CRLF, NEW_OPT4);
    console.log('✅ [2] OPCIÓN 4 handler updated (CRLF)');
    changed++;
  } else {
    console.warn('⚠️  [2] OPCIÓN 4 not patched. Manual edit needed at line ~2210');
  }
}

// ---------------------------------------------------------------
// 3. Replace COMPRAR / PEDIR handler
// ---------------------------------------------------------------
const OLD_COMPRAR = `            // INICIAR PEDIDO DIRECTO ('comprar', 'pedir', 'hacer pedido')
            if (lower === 'comprar' || lower === 'pedir' || lower === 'hacer pedido' || lower === 'quiero pedir') {
              session.step = 'SELECTING';
              session.catalogPage = 1;
              const reply = buildCatalogMessage(prods, 1, 8, false);
              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              continue;
            }`;

const NEW_COMPRAR = `            // INICIAR PEDIDO DIRECTO ('comprar', 'pedir', 'hacer pedido')
            if (lower === 'comprar' || lower === 'pedir' || lower === 'hacer pedido' || lower === 'quiero pedir') {
              const tplsCmp = getBotTemplates();
              const bizCmp = getBusinessContext();
              const menuModeCmp = tplsCmp.menu_mode || 'catalog';
              if (menuModeCmp === 'catalog') {
                // MODO CATÁLOGO ONLINE
                const catalogUrl = (bizCmp.catalogo_url || bizCmp.sitio_web || 'https://comandafast.online').replace(/\\/$/, '');
                const catalogLink = \`🛒 *¡Vamos a armar tu pedido!* 🔥\\n\\n📱 Entrá a nuestra carta con fotos:\\n👉 \${catalogUrl}/#catalog\\n\\nElegí lo que querés, armá tu pedido y envialo por acá mismo. ¡En segundos está en la cocina! 🍔✨\`;
                await this.safeSendMessage(remoteJid, { text: catalogLink }, msg.key);
              } else {
                // MODO PLANTILLAS CLÁSICO
                session.step = 'SELECTING';
                session.catalogPage = 1;
                const reply = buildCatalogMessage(prods, 1, 8, false);
                await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              }
              continue;
            }`;

if (content.includes(OLD_COMPRAR.trim().substring(0, 60))) {
  content = content.replace(OLD_COMPRAR, NEW_COMPRAR);
  console.log('✅ [3] COMPRAR handler updated');
  changed++;
} else {
  console.warn('⚠️  [3] COMPRAR pattern not found, trying CRLF...');
  const OLD_COMPRAR_CRLF = OLD_COMPRAR.replace(/\n/g, '\r\n');
  if (content.includes(OLD_COMPRAR_CRLF.trim().substring(0, 60))) {
    content = content.replace(OLD_COMPRAR_CRLF, NEW_COMPRAR);
    console.log('✅ [3] COMPRAR handler updated (CRLF)');
    changed++;
  } else {
    console.warn('⚠️  [3] COMPRAR not patched. Check manually at line ~2230');
  }
}

// ---------------------------------------------------------------
// 4. Save main server file
// ---------------------------------------------------------------
fs.writeFileSync(TARGET, content, 'utf-8');
console.log(`\n📝 Main server saved. ${changed} patches applied.`);

// ---------------------------------------------------------------
// 5. Sync to Bot Portable
// ---------------------------------------------------------------
const PORTABLE_TARGET = path.join(__dirname, '..', 'ComandaFast-Bot-Portatil', 'server', 'whatsappBotServer.js');
const PORTABLE_GEMINI = path.join(__dirname, '..', 'ComandaFast-Bot-Portatil', 'server', 'geminiBotService.js');
const SOURCE_GEMINI = path.join(__dirname, '..', 'server', 'geminiBotService.js');

fs.writeFileSync(PORTABLE_TARGET, content, 'utf-8');
console.log('✅ [5] Bot Portable whatsappBotServer.js synced!');

// Also sync geminiBotService.js
const geminiContent = fs.readFileSync(SOURCE_GEMINI, 'utf-8');
fs.writeFileSync(PORTABLE_GEMINI, geminiContent, 'utf-8');
console.log('✅ [5] Bot Portable geminiBotService.js synced!');

console.log('\n🎉 Done! Both servers are up to date with menu_mode support.');
console.log('   Configure menu_mode in the Admin Panel → Bot → Seguridad & Plantillas');
