/**
 * apply_full_catalog_mode.cjs
 * Comprehensive update to support:
 * 1. Dual Menu Mode: 'catalog' (online web catalog) vs 'templates' (classic text templates)
 * 2. Automatic parsing and injection of orders sent from the Online Web Catalog via WhatsApp
 * 3. Synchronization of whatsappBotServer.js, geminiBotService.js, and data to portable bot
 */

const fs = require('fs');
const path = require('path');

const SERVER_FILE = path.join(__dirname, '..', 'server', 'whatsappBotServer.js');
let code = fs.readFileSync(SERVER_FILE, 'utf-8');

console.log('--- Applying Full Catalog Mode to whatsappBotServer.js ---');

// 1. Ensure parseCatalogOrder helper function exists
if (!code.includes('function parseCatalogOrder(')) {
  const PARSER_FUNC = `
/**
 * Parsea pedidos entrantes generados automáticamente desde el Catálogo Online Web (#catalog)
 */
function parseCatalogOrder(text) {
  if (!text || typeof text !== 'string') return null;
  const isCatalogOrder = (text.includes("Mi Pedido") || text.includes("Mi pedido") || text.includes("MI PEDIDO")) && 
                         (text.includes("Subtotal") || text.includes("TOTAL") || text.includes("Tipo de entrega"));
  if (!isCatalogOrder) return null;

  const itemRegex = /[•\\*\\-]?\\s*(\\d+)x\\s+([^—\\n]+?)\\s*—\\s*\\$?\\s*([\\d\\.,]+)/g;
  let match;
  const items = [];
  while ((match = itemRegex.exec(text)) !== null) {
    items.push({
      qty: parseInt(match[1], 10) || 1,
      name: match[2].trim(),
      price: parseInt(match[3].replace(/\\D/g, ""), 10) || 0
    });
  }

  const subMatch = text.match(/Subtotal[^\\d\\n]*([\\d\\.,]+)/i);
  const subtotal = subMatch ? parseInt(subMatch[1].replace(/\\D/g, ""), 10) : 0;
  const delMatch = text.match(/Delivery[^\\d\\n]*([\\d\\.,]+)/i);
  const deliveryFee = delMatch ? parseInt(delMatch[1].replace(/\\D/g, ""), 10) : 0;
  const totMatch = text.match(/\\bTOTAL[^\\d\\n]*([\\d\\.,]+)/i);
  const total = totMatch ? parseInt(totMatch[1].replace(/\\D/g, ""), 10) : (subtotal + deliveryFee);

  const nameMatch = text.match(/Nombre:\\*?\\s*([^\\n]+)/i);
  const addrMatch = text.match(/Direcci[oó]n:\\*?\\s*([^\\n]+)/i);
  const phoneMatch = text.match(/Tel[eé]fono:\\*?\\s*([^\\n]+)/i);
  const typeMatch = text.match(/Tipo de entrega:\\*?\\s*([^\\n]+)/i);
  const notesMatch = text.match(/Aclaraciones:\\*?\\s*([^\\n]+)/i);

  const serviceType = (typeMatch && (typeMatch[1].toLowerCase().includes("llevar") || typeMatch[1].toLowerCase().includes("retiro") || typeMatch[1].toLowerCase().includes("local"))) 
    ? 'local' 
    : 'delivery';

  return {
    items,
    subtotal: subtotal || total,
    deliveryFee,
    total: total || subtotal,
    customerName: nameMatch ? nameMatch[1].trim() : '',
    customerAddress: addrMatch ? addrMatch[1].trim() : '',
    customerPhone: phoneMatch ? phoneMatch[1].trim() : '',
    serviceType,
    notes: notesMatch ? notesMatch[1].trim() : ''
  };
}
`;

  // Insert before buildPromosMessage
  const PROMO_ANCHOR = 'function buildPromosMessage(';
  if (code.includes(PROMO_ANCHOR)) {
    code = code.replace(PROMO_ANCHOR, PARSER_FUNC + '\n' + PROMO_ANCHOR);
    console.log('✅ [1] parseCatalogOrder function inserted');
  } else {
    console.warn('⚠️ Could not find buildPromosMessage anchor');
  }
} else {
  console.log('ℹ️ [1] parseCatalogOrder already exists');
}

// 2. Insert incoming catalog order handler in message loop
const MSG_ENTRY_ANCHOR = 'const session = getCustomerSession(remoteJid);';
const CATALOG_ORDER_INTERCEPTOR = `          const session = getCustomerSession(remoteJid);

          // -------------------------------------------------------------
          // DETECCIÓN Y PROCESAMIENTO AUTOMÁTICO DE PEDIDOS DEL CATÁLOGO WEB ONLINE (#catalog)
          // -------------------------------------------------------------
          const parsedCatalogOrder = parseCatalogOrder(text);
          if (parsedCatalogOrder && parsedCatalogOrder.items && parsedCatalogOrder.items.length > 0) {
            console.log(\`🛒 [WHATSAPP BOT] Pedido recibido desde el Catálogo Online de \${remoteJid}:\`, parsedCatalogOrder.customerName);
            const cleanDigits = extractCleanDigits(remoteJid);
            const orderId = (await getLatestOrderNumber()) + 1;
            const biz = getBusinessContext();

            const newOrder = {
              id: \`CMD-\${orderId}\`,
              orderNumber: orderId,
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
              paymentMethod: 'pendiente',
              paymentStatus: 'pendiente_pago',
              paymentConfirmed: false,
              items: parsedCatalogOrder.items.map((it, idx) => ({
                id: \`cat_\${Date.now()}_\${idx}\`,
                name: it.name,
                price: Number(it.price),
                qty: Number(it.qty || 1),
                quantity: Number(it.qty || 1),
                modifiers: []
              })),
              notes: parsedCatalogOrder.notes || '',
              status: 'pendiente',
              createdAt: new Date().toISOString(),
              source: 'catalogo_online'
            };

            // Inyectar en almacenamiento y cola para el POS / KDS / Cocina
            saveStoredOrder(newOrder);
            pushOrderToSupabase(newOrder).catch(() => {});
            pendingOrdersForPos.push(newOrder);
            console.log(\`🛎️ [PEDIDO CATÁLOGO WEB]: Pedido #\${orderId} de \${newOrder.customer.name} ($\${newOrder.total}) inyectado a cocina y POS.\`);

            // Actualizar sesión del cliente para el siguiente paso (forma de pago)
            session.step = 'ASK_PAYMENT';
            session.activeOrderId = orderId;
            session.customerName = newOrder.customer.name;
            session.shippingAddress = newOrder.customer.address;
            session.shippingMethod = newOrder.deliveryType;
            session.deliveryFee = newOrder.deliveryFee;
            session.subtotal = newOrder.subtotal;
            session.total = newOrder.total;
            session.items = newOrder.items;

            const itemsSummary = parsedCatalogOrder.items.map(it => \`• \${it.qty}x \${it.name} - $\${(it.price * it.qty).toLocaleString('es-AR')}\`).join('\\n');
            const shippingLabel = newOrder.deliveryType === 'delivery' 
              ? \`🛵 Envío a Domicilio (\${newOrder.customer.address})\` 
              : '🛍️ Retiro por el Local (Mostrador)';

            const reply = \`🎉 *¡RECIBIMOS TU PEDIDO #\${orderId} DESDE NUESTRO CATÁLOGO ONLINE!* 🍔🔥\\n\\n¡Muchas gracias *\${newOrder.customer.name}*! Tu comanda ya ingresó al sistema de nuestra cocina.\\n\\n📋 *Detalle del pedido:*\\n\${itemsSummary}\\n\\n💵 *Subtotal:* $\${newOrder.subtotal.toLocaleString('es-AR')}\\n\` +
              (newOrder.deliveryFee > 0 ? \`🛵 *Envío:* $\${newOrder.deliveryFee.toLocaleString('es-AR')}\\n\` : '') +
              \`💰 *TOTAL:* $\${newOrder.total.toLocaleString('es-AR')}\\n🚀 *Entrega:* \${shippingLabel}\` +
              (newOrder.notes ? \`\\n📝 *Aclaraciones:* \${newOrder.notes}\` : '') +
              \`\\n\\n💳 *¿Cómo preferís abonar?*\\n\\n1️⃣ *Efectivo* (al recibir o retirar)\\n2️⃣ *Transferencia Bancaria / Mercado Pago* (Alias: \\\`\${biz.alias_banco}\\\`)\\n\\n_Respondé con *1* para Efectivo o *2* para Transferencia._\`;

            await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
            continue;
          }`;

if (!code.includes('DETECCIÓN Y PROCESAMIENTO AUTOMÁTICO DE PEDIDOS DEL CATÁLOGO WEB')) {
  if (code.includes(MSG_ENTRY_ANCHOR)) {
    code = code.replace(MSG_ENTRY_ANCHOR, CATALOG_ORDER_INTERCEPTOR);
    console.log('✅ [2] Catalog order interceptor added');
  } else {
    console.warn('⚠️ Could not find MSG_ENTRY_ANCHOR');
  }
} else {
  console.log('ℹ️ [2] Catalog order interceptor already exists');
}

// 3. Ensure COMPRAR handler checks menu_mode
const OLD_COMPRAR_SNIPPET = `            // INICIAR PEDIDO DIRECTO ('comprar', 'pedir', 'hacer pedido')
            if (lower === 'comprar' || lower === 'pedir' || lower === 'hacer pedido' || lower === 'quiero pedir') {
              session.step = 'SELECTING';
              session.catalogPage = 1;
              const reply = buildCatalogMessage(prods, 1, 8, false);
              await this.safeSendMessage(remoteJid, { text: reply }, msg.key);
              continue;
            }`;

const NEW_COMPRAR_SNIPPET = `            // INICIAR PEDIDO DIRECTO ('comprar', 'pedir', 'hacer pedido')
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

if (code.includes('session.step = \'SELECTING\';\n              session.catalogPage = 1;\n              const reply = buildCatalogMessage(prods, 1, 8, false);')) {
  code = code.replace(OLD_COMPRAR_SNIPPET, NEW_COMPRAR_SNIPPET);
  // Also try CRLF if needed
  code = code.replace(OLD_COMPRAR_SNIPPET.replace(/\n/g, '\r\n'), NEW_COMPRAR_SNIPPET);
  console.log('✅ [3] COMPRAR handler updated with menu_mode');
} else {
  console.log('ℹ️ [3] COMPRAR handler already updated or not found');
}

// 4. Update buildMainMenuMessage to append catalog link if in catalog mode
const MAIN_MENU_OLD = `  return interpolateTemplate(rawMenu, {
    cliente: clientName,
    nombre_local: storeName,
    ...biz
  });`;

const MAIN_MENU_NEW = `  let formatted = interpolateTemplate(rawMenu, {
    cliente: clientName,
    nombre_local: storeName,
    ...biz
  });

  const menuMode = tpls.menu_mode || 'catalog';
  if (menuMode === 'catalog') {
    const catalogUrl = (biz.catalogo_url || biz.sitio_web || 'https://comandafast.online').replace(/\\/$/, '');
    if (!formatted.includes('/#catalog')) {
      formatted += \`\\n\\n📱 *Carta digital con fotos:* \${catalogUrl}/#catalog\`;
    }
  }

  return formatted;`;

if (code.includes(MAIN_MENU_OLD)) {
  code = code.replace(MAIN_MENU_OLD, MAIN_MENU_NEW);
  console.log('✅ [4] buildMainMenuMessage updated with catalog link');
} else if (code.includes(MAIN_MENU_OLD.replace(/\n/g, '\r\n'))) {
  code = code.replace(MAIN_MENU_OLD.replace(/\n/g, '\r\n'), MAIN_MENU_NEW);
  console.log('✅ [4] buildMainMenuMessage updated with catalog link (CRLF)');
} else {
  console.log('ℹ️ [4] buildMainMenuMessage already updated');
}

// Save server file
fs.writeFileSync(SERVER_FILE, code, 'utf-8');
console.log('💾 server/whatsappBotServer.js saved successfully');

// 5. Update data/bot_templates.json
const TEMPLATES_FILE = path.join(__dirname, '..', 'data', 'bot_templates.json');
if (fs.existsSync(TEMPLATES_FILE)) {
  try {
    const tpls = JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf-8'));
    if (!tpls.menu_mode) {
      tpls.menu_mode = 'catalog';
      fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(tpls, null, 2), 'utf-8');
      console.log('✅ [5] data/bot_templates.json updated with menu_mode: catalog');
    }
  } catch (e) {
    console.error('Error updating bot_templates.json:', e);
  }
}

// 6. Sync to portable bot
const PORTABLE_SERVER = path.join(__dirname, '..', 'ComandaFast-Bot-Portatil', 'server', 'whatsappBotServer.js');
const PORTABLE_GEMINI = path.join(__dirname, '..', 'ComandaFast-Bot-Portatil', 'server', 'geminiBotService.js');
const PORTABLE_TEMPLATES = path.join(__dirname, '..', 'ComandaFast-Bot-Portatil', 'data', 'bot_templates.json');

if (fs.existsSync(path.dirname(PORTABLE_SERVER))) {
  fs.writeFileSync(PORTABLE_SERVER, code, 'utf-8');
  console.log('✅ [6] Portable bot whatsappBotServer.js synchronized');
}
if (fs.existsSync(path.dirname(PORTABLE_GEMINI))) {
  const geminiCode = fs.readFileSync(path.join(__dirname, '..', 'server', 'geminiBotService.js'), 'utf-8');
  fs.writeFileSync(PORTABLE_GEMINI, geminiCode, 'utf-8');
  console.log('✅ [6] Portable bot geminiBotService.js synchronized');
}
if (fs.existsSync(TEMPLATES_FILE) && fs.existsSync(path.dirname(PORTABLE_TEMPLATES))) {
  fs.copyFileSync(TEMPLATES_FILE, PORTABLE_TEMPLATES);
  console.log('✅ [6] Portable bot bot_templates.json synchronized');
}

console.log('\n🎉 Dual Menu Mode & Catalog Order Parser applied successfully!');
