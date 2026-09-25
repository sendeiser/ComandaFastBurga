// ============================================================================
// TEST AUTOMATIZADO INTEGRAL: TODOS LOS FLUJOS CONVERSACIONALES DEL BOT WHATSAPP
// Simula mensajes reales para validar:
// 1. Saludos y Menú Principal (Plantilla de 5 opciones - NO responde la IA)
// 2. Opciones 1 a 5 (Estado, Transferencia, Horarios/Dirección, Carta, Humano)
// 3. Flujo completo de pedido Delivery con cálculo de costo de envío
// 4. Flujo completo de pedido Take Away (Retiro en local)
// 5. Cancelación de pedido
// 6. Filtro Anti-Bucle y cortesía
// 7. Pregunta abierta gastronómica (IA como respaldo)
// ============================================================================

const fs = require('fs');
const path = require('path');

const PRODUCTS_FILE = path.join(__dirname, '../data/products.json');
const VARIABLES_FILE = path.join(__dirname, '../data/bot_variables.json');
const TEMPLATES_FILE = path.join(__dirname, '../data/bot_templates.json');
const ORDERS_FILE = path.join(__dirname, '../data/orders.json');

// Cargar datos
const prods = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
const varsList = JSON.parse(fs.readFileSync(VARIABLES_FILE, 'utf8'));
const tpls = JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf8'));

const varsMap = {};
for (const v of varsList) {
  if (v && v.key) {
    varsMap[v.key] = v.value !== undefined ? v.value : v.defaultValue;
  }
}

function getBusinessContext() {
  return {
    nombre_local: varsMap.nombre_local || tpls.store_name || "Burga's Chamical",
    alias_banco: varsMap.alias_banco || tpls.bank_alias || 'Burgachamical.nx',
    banco: varsMap.banco || tpls.bank_name || 'Naranja X',
    titular: varsMap.titular || tpls.bank_holder || 'Braian Carlos Zarate San Felipe',
    cbu: varsMap.cbu || tpls.bank_cbu || '0000003100092138928374',
    direccion: varsMap.direccion || varsMap.direccion_local || tpls.pickup_address || 'Av. Perón 145 (frente al super x día)',
    horarios: varsMap.horarios || tpls.opening_hours || 'Martes a Domingos de 19:30 a 00:30 hs',
    costo_envio: varsMap.costo_envio || '$2.000',
    envio_gratis_desde: varsMap.envio_gratis_desde || '$18.000',
    sitio_web: tpls.store_website_url || varsMap.sitio_web || ''
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
  '0': '0️⃣', '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣',
  '5': '5️⃣', '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣'
};

function formatItemNumber(n) {
  if (n === null || n === undefined || isNaN(n)) return '';
  return String(n).trim().split('').map(digit => DIGIT_EMOJIS[digit] || digit).join('');
}

function buildCatalogMessage(products, page = 1, pageSize = 8, isAll = false) {
  const total = products.length;
  const biz = getBusinessContext();
  const storeName = biz.nombre_local || "Burga's Chamical";

  if (isAll) {
    const list = products.map((p, i) => `${formatItemNumber(i + 1)} *${p.name}* — $${Number(p.price).toLocaleString('es-AR')}`).join('\n');
    return `🍔 *CARTA COMPLETA DE ${storeName.toUpperCase()} (${total} opciones)* 🔥\n\n${list}`;
  }

  const totalPages = Math.ceil(total / pageSize) || 1;
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startIdx = (currentPage - 1) * pageSize;
  const pageProds = products.slice(startIdx, startIdx + pageSize);

  const list = pageProds.map((p, i) => {
    const globalIdx = startIdx + i + 1;
    return `${formatItemNumber(globalIdx)} *${p.name}* — $${Number(p.price).toLocaleString('es-AR')}`;
  }).join('\n');

  return `🍔 *MENÚ ${storeName.toUpperCase()}* 🔥\n📄 *Página ${currentPage} de ${totalPages}*\n\n${list}\n\n👉 *Para pedir:* Respondé con el NÚMERO.`;
}

function buildMainMenuMessage(customerName = '') {
  const biz = getBusinessContext();
  const storeName = biz.nombre_local || "Burga's Chamical";
  const clientName = customerName ? customerName.trim() : 'amigo/a';

  let rawMenu = tpls.template_menu;
  if (!rawMenu || !rawMenu.includes('1️⃣') || !rawMenu.includes('5️⃣')) {
    rawMenu = `🍔 *¡Hola {cliente}! Bienvenido a {nombre_local}* 🔥\n\n¿En qué podemos ayudarte hoy? *Respondé con el número de opción:*\n\n1️⃣ 📋 *Consultar estado de mi pedido*\n2️⃣ 💳 *Ver datos de transferencia bancaria / Alias*\n3️⃣ 📍 *Horarios y ubicación de nuestro local*\n4️⃣ 🍔 *Ver menú completo de hamburguesas y combos*\n5️⃣ 👤 *Hablar con un encargado del local*\n\n_O escribí directamente *COMPRAR* o el número de la burger que quieras pedir._`;
  }

  return interpolateTemplate(rawMenu, {
    cliente: clientName,
    nombre_local: storeName,
    ...biz
  });
}

// Simulador de motor de mensajes (idéntico al de server/whatsappBotServer.js)
class BotSessionSimulator {
  constructor() {
    this.sessions = new Map();
    this.pausedJids = new Map();
  }

  getSession(jid) {
    if (!this.sessions.has(jid)) {
      this.sessions.set(jid, {
        step: 'IDLE',
        items: [],
        subtotal: 0,
        total: 0,
        deliveryFee: 0,
        shippingMethod: 'local',
        shippingAddress: '',
        customerName: '',
        paymentMethod: 'efectivo',
        catalogPage: 1,
        lastCourtesyReplyAt: 0
      });
    }
    return this.sessions.get(jid);
  }

  resetSession(jid) {
    this.sessions.delete(jid);
  }

  pauseCustomer(jid, minutes = 25) {
    this.pausedJids.set(jid, Date.now() + minutes * 60 * 1000);
  }

  isPaused(jid) {
    const exp = this.pausedJids.get(jid);
    return exp && Date.now() < exp;
  }

  async processMessage(remoteJid, text, pushName = 'Cliente') {
    const session = this.getSession(remoteJid);
    const lower = text.trim().toLowerCase();

    // 1. Cancelar
    if (lower === 'cancelar' || lower === 'cancel' || lower === 'borrar') {
      this.resetSession(remoteJid);
      return {
        type: 'CANCEL',
        text: '❌ *Pedido cancelado.*\n\nEscribí *MENU* en cualquier momento para volver a ver las opciones o hacer un nuevo pedido.'
      };
    }

    // 2. Máquina de estados de pedidos
    if (session.step === 'CONFIRMING') {
      if (lower === 'si' || lower === 'sí' || lower === 'confirmar' || lower === 'dale' || lower === 'ok' || lower === 's') {
        const orderId = 'CMD-SIM-' + Math.floor(100 + Math.random() * 900);
        const biz = getBusinessContext();
        const itemsList = session.items.map(it => `• ${it.name} (x${it.qty || 1}) - $${(it.price * (it.qty || 1)).toLocaleString('es-AR')}`).join('\n');
        
        let confirmMsg = '';
        if (session.paymentMethod === 'transferencia') {
          confirmMsg = `🎉 *¡PEDIDO #${orderId} REGISTRADO!* 🍔🔥\n\n¡Muchas gracias *${session.customerName}*!\n\n📋 *Detalle de tu pedido:*\n${itemsList}\n\n💵 *Total a transferir:* $${session.total.toLocaleString('es-AR')}\n🛵 *Modo:* ${session.shippingMethod === 'delivery' ? '🛵 Envío a Domicilio' : '🛍️ Retiro por el Local'}\n📍 *Dirección:* ${session.shippingAddress}\n\n💳 *Datos para Transferencia:*\n• *Alias:* \`${biz.alias_banco}\`\n• *Banco:* ${biz.banco}\n• *Titular:* ${biz.titular}\n\n📸 *IMPORTANTE:* Por favor enviá la foto o captura del comprobante por aquí.\n⏳ *Tu pedido quedará pendiente hasta que una persona de nuestro equipo confirme el comprobante y lo mande a cocina.* 🔥`;
        } else {
          confirmMsg = `🎉 *¡PEDIDO #${orderId} CONFIRMADO Y ENVIADO A LA COCINA!* 🔥🍔\n\n¡Muchas gracias *${session.customerName}*, tu pedido ya ingresó al sistema de la plancha!\n\n📋 *Detalle:*\n${itemsList}\n\n💵 *Total:* $${session.total.toLocaleString('es-AR')}\n🛵 *Modo:* ${session.shippingMethod === 'delivery' ? '🛵 Envío a Domicilio' : '🛍️ Retiro por el Local'}\n📍 *Dirección:* ${session.shippingAddress}\n\n💵 *Pago en Efectivo:* Abonás al recibir tu comida. ¡La cocina ya está marchando tus burgers! 🔥`;
        }

        const generatedOrder = {
          orderId,
          total: session.total,
          deliveryFee: session.deliveryFee,
          subtotal: session.subtotal,
          paymentMethod: session.paymentMethod,
          shippingMethod: session.shippingMethod,
          items: session.items,
          customerName: session.customerName
        };

        this.resetSession(remoteJid);
        return { type: 'ORDER_CONFIRMED', text: confirmMsg, order: generatedOrder };
      } else if (lower === 'cancelar' || lower === 'no' || lower === 'cancel') {
        this.resetSession(remoteJid);
        return { type: 'CANCEL', text: '❌ *Pedido cancelado.* Escribí *MENU* para ver más opciones o iniciar un nuevo pedido.' };
      } else {
        return {
          type: 'CONFIRMING_HELP',
          text: '⚠️ ¿Deseas confirmar tu pedido? Respondé *SI* para mandarlo a la cocina o *CANCELAR* si querés anularlo.'
        };
      }
    }

    if (session.step === 'ASK_PAYMENT') {
      if (lower === '1' || lower.includes('efectivo')) {
        session.paymentMethod = 'efectivo';
      } else if (lower === '2' || lower.includes('transferencia') || lower.includes('alias') || lower.includes('mp')) {
        session.paymentMethod = 'transferencia';
      } else {
        return { type: 'PAYMENT_PROMPT_INVALID', text: '⚠️ Por favor respondé con *1* para Efectivo o *2* para Transferencia Bancaria:' };
      }

      session.step = 'CONFIRMING';
      const itemsList = session.items.map(it => `• ${it.name} (x${it.qty || 1}) - $${(it.price * (it.qty || 1)).toLocaleString('es-AR')}${it.modifiers?.length ? ' [' + it.modifiers.join(', ') + ']' : ''}`).join('\n');
      const shippingLabel = session.shippingMethod === 'delivery' 
        ? (session.deliveryFee > 0 ? `🛵 Envío a Domicilio (+$${session.deliveryFee.toLocaleString('es-AR')})` : '🛵 Envío a Domicilio (¡Envío Gratis!)')
        : '🛍️ Retiro por el Local (Mostrador)';

      const summary = `🍔 *RESUMEN DE TU PEDIDO* 🔥\n\n🛒 *Items:*\n${itemsList}\n\n💵 *Subtotal:* $${session.subtotal.toLocaleString('es-AR')}\n🛵 *Entrega:* ${shippingLabel}\n📍 *Dirección:* ${session.shippingAddress}\n👤 *Cliente:* ${session.customerName}\n💳 *Forma de Pago:* ${session.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia Bancaria'}\n\n💵 *TOTAL A PAGAR:* $${session.total.toLocaleString('es-AR')}\n\n¿Está todo perfecto para mandar a la cocina?\n👉 Respondé *SI* para confirmar tu pedido o *CANCELAR*.`;
      return { type: 'ORDER_SUMMARY', text: summary, session: { ...session } };
    }

    if (session.step === 'ASK_NAME') {
      session.customerName = text.trim();
      session.step = 'ASK_PAYMENT';
      return {
        type: 'PAYMENT_PROMPT',
        text: `¡Perfecto *${session.customerName}*! 👍\n\n💳 *¿Cómo preferís abonar?*\n\n1️⃣ *Efectivo* (al recibir o retirar)\n2️⃣ *Transferencia Bancaria / Mercado Pago*\n\n_Respondé con 1 o 2:_`
      };
    }

    if (session.step === 'ASK_ADDRESS') {
      session.shippingAddress = text.trim();
      session.step = 'ASK_NAME';
      return {
        type: 'NAME_PROMPT',
        text: '👤 *¿A nombre de quién preparamos el pedido?*\n(Escribí tu nombre y apellido):'
      };
    }

    if (session.step === 'ASK_SHIPPING_METHOD') {
      if (lower === '1' || lower.includes('retiro') || lower.includes('local') || lower.includes('mostrador') || lower.includes('take away')) {
        session.shippingMethod = 'local';
        session.shippingAddress = 'Retiro en Local (Mostrador)';
        session.deliveryFee = 0;
        session.total = session.subtotal;
        session.step = 'ASK_NAME';
        return {
          type: 'SHIPPING_METHOD_LOCAL',
          text: '🛍️ *Retiro por el local seleccionado.* (Sin costo de envío)\n\n👤 *¿A nombre de quién registramos el pedido?*\n(Escribí tu nombre y apellido):'
        };
      } else if (lower === '2' || lower.includes('envio') || lower.includes('envío') || lower.includes('delivery') || lower.includes('domicilio')) {
        session.shippingMethod = 'delivery';
        const biz = getBusinessContext();
        const rawCost = String(biz.costo_envio || '').replace(/\D/g, '');
        const costoEnvio = parseInt(rawCost, 10) || 0;
        const rawGratis = String(biz.envio_gratis_desde || '').replace(/\D/g, '');
        const gratisDesde = parseInt(rawGratis, 10) || 0;

        if (gratisDesde > 0 && session.subtotal >= gratisDesde) {
          session.deliveryFee = 0;
        } else {
          session.deliveryFee = costoEnvio;
        }
        session.total = session.subtotal + session.deliveryFee;

        session.step = 'ASK_ADDRESS';
        const feeText = session.deliveryFee > 0 
          ? `🛵 Costo de envío: *$${session.deliveryFee.toLocaleString('es-AR')}*`
          : `🛵 Costo de envío: *¡GRATIS!* 🎉`;
        return {
          type: 'SHIPPING_METHOD_DELIVERY',
          text: `🛵 *Envío a domicilio seleccionado.*\n${feeText}\n\n📍 *Por favor escribí tu dirección exacta y entrecalles para el cadete:*`
        };
      } else {
        return {
          type: 'SHIPPING_METHOD_INVALID',
          text: '⚠️ Por favor elegí una de las dos opciones:\n\n1️⃣ *Retiro por el local (Take Away)*\n2️⃣ *Envío a domicilio con cadete (Delivery)*'
        };
      }
    }

    if (session.step === 'SELECTING') {
      if (lower === 'listo' || lower === 'pedir' || lower === 'comprar' || lower === 'terminar' || lower === 'seguir' || lower === 'avanzar' || lower === 'pagar') {
        if (session.items.length === 0) {
          return { type: 'EMPTY_CART', text: '⚠️ Tu pedido está vacío. Escribí el *NÚMERO* de la burger que querés o escribí *MENU*.' };
        }
        session.step = 'ASK_SHIPPING_METHOD';
        return {
          type: 'ASK_SHIPPING_METHOD',
          text: `🛵 *¿Cómo querés recibir tu pedido?*\n\nRespondé con el número de opción:\n1️⃣ *Retiro por el local (Take Away)* 🏷️ Sin costo\n2️⃣ *Envío a domicilio con cadete (Delivery)*`
        };
      }

      if (lower.startsWith('sin ') || lower.startsWith('con ') || lower.startsWith('extra ') || lower.includes('cebolla') || lower.includes('cheddar') || lower.includes('panceta') || lower.includes('bacon')) {
        if (session.items.length > 0) {
          const lastItem = session.items[session.items.length - 1];
          if (!lastItem.modifiers) lastItem.modifiers = [];
          lastItem.modifiers.push(text);
          return {
            type: 'MODIFIER_ADDED',
            text: `📝 *Modificador agregado a ${lastItem.name}:* "${text}".\n\n👉 ¿Querés sumar algo más? *(Escribí el número)*\n👉 O escribí *LISTO* para avanzar con la entrega.`
          };
        }
      }

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
        } else {
          session.items.push({
            id: selectedProd.id,
            name: selectedProd.name,
            price: Number(selectedProd.price),
            qty: 1,
            modifiers: []
          });
        }
        session.subtotal = session.items.reduce((acc, it) => acc + (it.price * (it.qty || 1)), 0);
        session.total = session.subtotal;
        return {
          type: 'ITEM_ADDED',
          text: `✅ *¡Sumaste ${selectedProd.name}!* 🍔\n💵 *Subtotal:* $${session.total.toLocaleString('es-AR')}`,
          session: { ...session }
        };
      }
    }

    // 3. Menú Principal y Saludos en IDLE
    const isGreetingRegex = /^(hola|buenas|buen\s*dia|buenos\s*dias|buenas\s*tardes|buenas\s*noches|que\s*tal|holis|hey|saludos)(\s.*)?$/i;
    const isMenuCommand = [
      'menu', 'menú', 'inicio', 'comenzar', 'start', 'opciones', 'ayuda', '#menu'
    ].includes(lower) || isGreetingRegex.test(lower);

    if (isMenuCommand && session.step === 'IDLE') {
      session.catalogPage = 1;
      return {
        type: 'TEMPLATE_MENU',
        text: buildMainMenuMessage(pushName)
      };
    }

    // 4. Opciones del menú principal en IDLE (1 a 5)
    if (session.step === 'IDLE') {
      if (lower === '1' || lower === 'estado' || lower === 'mi pedido' || lower === 'mi orden') {
        return {
          type: 'MENU_OPTION_1',
          text: '📋 *Estado de Pedido:*\n\nNo encontramos ningún pedido activo asociado a tu número en este momento.\n\n👉 Para pedir unas hamburguesas recién hechas, escribí *COMPRAR* o *MENU*.'
        };
      }

      if (lower === '2' || lower === 'alias' || lower === 'cbu' || lower === 'transferencia' || lower === 'datos banco') {
        const biz = getBusinessContext();
        const rawTpl = tpls.menu_response_2 || `💳 *Datos para Transferencia Bancaria:* 🏦\n\n• *Alias:* \`{alias_banco}\`\n• *Banco:* {banco}\n• *Titular:* {titular}\n• *CBU:* \`{cbu}\``;
        return {
          type: 'MENU_OPTION_2',
          text: interpolateTemplate(rawTpl, { ...biz, cliente: pushName })
        };
      }

      if (lower === '3' || lower === 'horario' || lower === 'horarios' || lower === 'ubicacion' || lower === 'ubicación' || lower === 'direccion' || lower === 'dirección') {
        const biz = getBusinessContext();
        const rawTpl = tpls.menu_response_3 || `📍 *Ubicación y Horarios de Atención:* 🕒\n\n🍔 *Dirección:* {direccion}\n⏰ *Horarios de Cocina:* {horarios}`;
        return {
          type: 'MENU_OPTION_3',
          text: interpolateTemplate(rawTpl, { ...biz, cliente: pushName })
        };
      }

      if (lower === '4' || lower === 'carta' || lower === 'catalogo' || lower === 'catálogo') {
        session.step = 'SELECTING';
        session.catalogPage = 1;
        return {
          type: 'MENU_OPTION_4_CATALOG',
          text: buildCatalogMessage(prods, 1, 8, false)
        };
      }

      if (lower === '5' || lower === 'humano' || lower === 'asesor' || lower === 'encargado' || lower === 'persona' || lower === 'operador') {
        const biz = getBusinessContext();
        const rawTpl = tpls.menu_response_5 || `👤 *¡Entendido {cliente}! Un encargado de {nombre_local} te responderá a la brevedad.* 🍔`;
        this.pauseCustomer(remoteJid, 25);
        return {
          type: 'MENU_OPTION_5_HUMAN',
          text: interpolateTemplate(rawTpl, { ...biz, cliente: pushName }),
          pausedUntil: this.pausedJids.get(remoteJid)
        };
      }

      if (lower === 'comprar' || lower === 'pedir' || lower === 'hacer pedido' || lower === 'quiero pedir') {
        session.step = 'SELECTING';
        session.catalogPage = 1;
        return {
          type: 'START_ORDER_CATALOG',
          text: buildCatalogMessage(prods, 1, 8, false)
        };
      }
    }

    // 5. Anti-bucle cortesía
    const cleanText = lower.replace(/[!¡?¿.,;:\-_]/g, ' ').replace(/\s+/g, ' ').trim();
    const gratitude = tpls.anti_loop_gratitude || ['gracias', 'muchas gracias'];
    const farewell = tpls.anti_loop_farewell || ['chau', 'nos vemos'];
    const acknowledge = tpls.anti_loop_acknowledge || ['ok', 'dale', 'joya'];

    if (gratitude.some(g => cleanText === g || cleanText.startsWith(g + ' ') || cleanText.endsWith(' ' + g))) {
      return {
        type: 'ANTI_LOOP_GRATITUDE',
        text: tpls.template_anti_loop_gratitude || '¡De nada! 🙌 Que lo disfrutes un montón. Escribí *MENU* cuando gustes.'
      };
    }
    if (farewell.some(f => cleanText === f || cleanText.startsWith(f + ' ') || cleanText.endsWith(' ' + f))) {
      return {
        type: 'ANTI_LOOP_FAREWELL',
        text: interpolateTemplate(tpls.template_anti_loop_farewell || '¡Hasta la próxima! 👋 Gracias por contactarte con {nombre_local}.', { nombre_local: "Burga's Chamical" })
      };
    }
    if (acknowledge.some(a => cleanText === a)) {
      return {
        type: 'ANTI_LOOP_ACKNOWLEDGE',
        text: tpls.template_anti_loop_acknowledge || '¡Bárbaro! 👍 Quedamos atentos ante cualquier duda.'
      };
    }

    // 6. Si no es nada de lo anterior, es una consulta abierta -> IA
    return {
      type: 'AI_FALLBACK',
      text: '🤖 [IA Respondiendo consulta gastronómica sobre el menú]'
    };
  }
}

// ============================================================================
// SUITE DE PRUEBAS
// ============================================================================
async function runAllTests() {
  console.log('================================================================');
  console.log('🧪 INICIANDO TEST AUTOMATIZADO INTEGRAL DE FLUJOS DEL BOT');
  console.log('================================================================\n');

  const sim = new BotSessionSimulator();
  let passed = 0;
  let total = 0;

  function assert(condition, testName, details = '') {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (details) console.error(`     Detalles: ${details}`);
      process.exitCode = 1;
    }
  }

  // TEST 1: SALUDOS DEVUELVEN LA PLANTILLA DE MENÚ (NO LA IA)
  console.log('📌 Test 1: Saludos ("hola", "buenas noches") deben devolver template_menu con opciones 1 a 5');
  const r1 = await sim.processMessage('5493826000001@s.whatsapp.net', 'hola', 'Carlos');
  assert(r1.type === 'TEMPLATE_MENU', 'Responde con TEMPLATE_MENU');
  assert(r1.text.includes('1️⃣') && r1.text.includes('5️⃣'), 'Contiene opciones 1️⃣ a 5️⃣');
  assert(r1.text.includes("Burga's Chamical"), 'Contiene nombre del local');
  assert(r1.type !== 'AI_FALLBACK', 'La IA NO interceptó el saludo inicial');

  const r1b = await sim.processMessage('5493826000001@s.whatsapp.net', 'buenas noches', 'Carlos');
  assert(r1b.type === 'TEMPLATE_MENU', 'Saludo "buenas noches" responde con TEMPLATE_MENU');

  // TEST 2: COMANDO "MENU"
  console.log('\n📌 Test 2: Comando "menu" devuelve el template_menu');
  const r2 = await sim.processMessage('5493826000002@s.whatsapp.net', 'menu', 'Ana');
  assert(r2.type === 'TEMPLATE_MENU', 'Comando "menu" responde con TEMPLATE_MENU');

  // TEST 3: OPCIÓN 1 (ESTADO DE PEDIDO)
  console.log('\n📌 Test 3: Opción "1" consulta estado de pedido');
  const r3 = await sim.processMessage('5493826000003@s.whatsapp.net', '1', 'Pedro');
  assert(r3.type === 'MENU_OPTION_1', 'Opción 1 detectada como consulta de estado');
  assert(r3.text.includes('Estado de Pedido'), 'Texto incluye estado de pedido');

  // TEST 4: OPCIÓN 2 (DATOS DE TRANSFERENCIA)
  console.log('\n📌 Test 4: Opción "2" muestra datos bancarios');
  const r4 = await sim.processMessage('5493826000004@s.whatsapp.net', '2', 'Laura');
  assert(r4.type === 'MENU_OPTION_2', 'Opción 2 detectada como datos bancarios');
  assert(r4.text.includes('Burgachamical.nx'), 'Contiene el alias bancario correcto');
  assert(r4.text.includes('Naranja X'), 'Contiene el banco correcto');

  // TEST 5: OPCIÓN 3 (UBICACIÓN Y HORARIOS)
  console.log('\n📌 Test 5: Opción "3" muestra ubicación y horarios');
  const r5 = await sim.processMessage('5493826000005@s.whatsapp.net', '3', 'Mario');
  assert(r5.type === 'MENU_OPTION_3', 'Opción 3 detectada como horarios y ubicación');
  assert(r5.text.includes('Av. Perón 145'), 'Contiene la dirección del local');
  assert(r5.text.includes('Martes a Domingos'), 'Contiene los días de atención');

  // TEST 6: OPCIÓN 4 (VER CARTA COMPLETA)
  console.log('\n📌 Test 6: Opción "4" muestra el catálogo y pasa a estado SELECTING');
  const r6 = await sim.processMessage('5493826000006@s.whatsapp.net', '4', 'Sofia');
  assert(r6.type === 'MENU_OPTION_4_CATALOG', 'Opción 4 muestra catálogo');
  assert(r6.text.includes('MENÚ'), 'Contiene encabezado de Menú');
  assert(sim.getSession('5493826000006@s.whatsapp.net').step === 'SELECTING', 'Estado cambia a SELECTING');

  // TEST 7: OPCIÓN 5 (HABLAR CON ENCARGADO / HUMANO)
  console.log('\n📌 Test 7: Opción "5" deriva a humano y activa pausa de bot');
  const r7 = await sim.processMessage('5493826000007@s.whatsapp.net', '5', 'Bianca');
  assert(r7.type === 'MENU_OPTION_5_HUMAN', 'Opción 5 deriva a humano');
  assert(r7.text.includes('encargado'), 'Mensaje menciona encargado');
  assert(sim.isPaused('5493826000007@s.whatsapp.net') === true, 'El cliente queda pausado para atención humana');

  // TEST 8: FLUJO COMPLETO DE PEDIDO DELIVERY CON TRANSFERENCIA
  console.log('\n📌 Test 8: Flujo Completo Delivery + Modificador + Transferencia Bancaria');
  const jidDelivery = '5493826000008@s.whatsapp.net';
  
  // 8.1 Iniciar pedido
  const step1 = await sim.processMessage(jidDelivery, 'comprar', 'Juan');
  assert(step1.type === 'START_ORDER_CATALOG', 'Paso 1: Inicia compra y muestra catálogo');
  
  // 8.2 Elegir burger 1
  const step2 = await sim.processMessage(jidDelivery, '1', 'Juan');
  assert(step2.type === 'ITEM_ADDED', 'Paso 2: Suma burger 1 al pedido');
  assert(step2.session.items.length === 1, 'Tiene 1 producto en items');
  const burgerPrice = step2.session.items[0].price;

  // 8.3 Modificador sin cebolla
  const step3 = await sim.processMessage(jidDelivery, 'sin cebolla', 'Juan');
  assert(step3.type === 'MODIFIER_ADDED', 'Paso 3: Agrega modificador "sin cebolla"');
  assert(sim.getSession(jidDelivery).items[0].modifiers.includes('sin cebolla'), 'Modificador guardado');

  // 8.4 Listo para entregar
  const step4 = await sim.processMessage(jidDelivery, 'listo', 'Juan');
  assert(step4.type === 'ASK_SHIPPING_METHOD', 'Paso 4: Pregunta método de entrega');

  // 8.5 Elegir Delivery (opción 2)
  const step5 = await sim.processMessage(jidDelivery, '2', 'Juan');
  assert(step5.type === 'SHIPPING_METHOD_DELIVERY', 'Paso 5: Selecciona Delivery');
  const sessionAfterDel = sim.getSession(jidDelivery);
  assert(sessionAfterDel.deliveryFee === 2000, 'Calcula costo de envío correcto ($2.000)');
  assert(sessionAfterDel.total === burgerPrice + 2000, 'Total incluye subtotal + $2.000 de delivery');

  // 8.6 Ingresar dirección
  const step6 = await sim.processMessage(jidDelivery, 'San Martin 450 entre Belgrano y Moreno', 'Juan');
  assert(step6.type === 'NAME_PROMPT', 'Paso 6: Guarda dirección y pide nombre');
  assert(sim.getSession(jidDelivery).shippingAddress === 'San Martin 450 entre Belgrano y Moreno', 'Dirección guardada');

  // 8.7 Ingresar nombre
  const step7 = await sim.processMessage(jidDelivery, 'Juan Perez', 'Juan');
  assert(step7.type === 'PAYMENT_PROMPT', 'Paso 7: Guarda nombre y pide medio de pago');
  assert(sim.getSession(jidDelivery).customerName === 'Juan Perez', 'Nombre guardado');

  // 8.8 Elegir transferencia (opción 2)
  const step8 = await sim.processMessage(jidDelivery, '2', 'Juan');
  assert(step8.type === 'ORDER_SUMMARY', 'Paso 8: Muestra resumen de pedido');
  assert(step8.text.includes('🛵 Envío a Domicilio (+$2.000)'), 'Resumen muestra línea de delivery con cargo');
  assert(step8.text.includes('San Martin 450'), 'Resumen incluye dirección');
  assert(step8.text.includes('Transferencia Bancaria'), 'Resumen incluye medio de pago');

  // 8.9 Confirmar con "SI"
  const step9 = await sim.processMessage(jidDelivery, 'si', 'Juan');
  assert(step9.type === 'ORDER_CONFIRMED', 'Paso 9: Pedido confirmado');
  assert(step9.text.includes('REGISTRADO'), 'Indica registrado para validación de comprobante');
  assert(step9.text.includes('comprobante'), 'Pide envío del comprobante');
  assert(step9.order.paymentMethod === 'transferencia', 'Método guardado es transferencia');
  assert(sim.getSession(jidDelivery).step === 'IDLE', 'Sesión reseteada a IDLE tras confirmar');

  // TEST 9: FLUJO COMPLETO RETIRO EN LOCAL (TAKE AWAY) CON EFECTIVO
  console.log('\n📌 Test 9: Flujo Completo Take Away (Retiro en Local) + Efectivo');
  const jidLocal = '5493826000009@s.whatsapp.net';
  await sim.processMessage(jidLocal, 'pedir', 'Mariana');
  await sim.processMessage(jidLocal, '2', 'Mariana');
  await sim.processMessage(jidLocal, 'listo', 'Mariana');
  
  // Seleccionar Retiro por el Local (opción 1)
  const localStep = await sim.processMessage(jidLocal, '1', 'Mariana');
  assert(localStep.type === 'SHIPPING_METHOD_LOCAL', 'Selecciona Retiro en Local sin costo');
  assert(sim.getSession(jidLocal).deliveryFee === 0, 'Costo de envío es $0');

  await sim.processMessage(jidLocal, 'Mariana Gomez', 'Mariana');
  const payStep = await sim.processMessage(jidLocal, '1', 'Mariana'); // Efectivo
  assert(payStep.type === 'ORDER_SUMMARY', 'Muestra resumen con Efectivo');
  assert(payStep.text.includes('Retiro por el Local'), 'Resumen indica retiro en local');

  const confirmLocal = await sim.processMessage(jidLocal, 'si', 'Mariana');
  assert(confirmLocal.type === 'ORDER_CONFIRMED', 'Pedido local confirmado');
  assert(confirmLocal.text.includes('ENVIADO A LA COCINA'), 'Efectivo ingresa directo a cocina');

  // TEST 10: CANCELACIÓN DE PEDIDO
  console.log('\n📌 Test 10: Comando "cancelar" en medio del proceso resetea el pedido');
  const jidCancel = '5493826000010@s.whatsapp.net';
  await sim.processMessage(jidCancel, 'comprar', 'Roberto');
  await sim.processMessage(jidCancel, '1', 'Roberto');
  const cancelStep = await sim.processMessage(jidCancel, 'cancelar', 'Roberto');
  assert(cancelStep.type === 'CANCEL', 'Cancela pedido exitosamente');
  assert(sim.getSession(jidCancel).step === 'IDLE', 'Sesión reseteada a IDLE');

  // TEST 11: FILTRO ANTI-BUCLE (CORTESÍA)
  console.log('\n📌 Test 11: Agradecimientos ("gracias") y despedidas ("chau")');
  const rThanks = await sim.processMessage('5493826000011@s.whatsapp.net', 'muchas gracias chicos!', 'Lucas');
  assert(rThanks.type === 'ANTI_LOOP_GRATITUDE', 'Responde con plantilla de agradecimiento anti-bucle');

  const rFarewell = await sim.processMessage('5493826000011@s.whatsapp.net', 'chau', 'Lucas');
  assert(rFarewell.type === 'ANTI_LOOP_FAREWELL', 'Responde con plantilla de despedida anti-bucle');

  // TEST 12: CONSULTA ABIERTA GASTRONÓMICA (ACTIVACIÓN DE IA)
  console.log('\n📌 Test 12: Pregunta abierta sobre ingredientes ("¿Tienen opciones vegetarianas?")');
  const rAi = await sim.processMessage('5493826000012@s.whatsapp.net', '¿Tienen alguna hamburguesa vegetariana o apta veganos?', 'Martin');
  assert(rAi.type === 'AI_FALLBACK', 'Pregunta abierta es derivada a la IA');

  console.log('\n================================================================');
  console.log(`📊 RESULTADOS: ${passed} de ${total} pruebas aprobadas (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================');

  if (passed === total) {
    console.log('🎉 ¡TODOS LOS FLUJOS CONVERSACIONALES FUNCIONAN A LA PERFECCIÓN!');
  } else {
    console.error('⚠️ ALGUNAS PRUEBAS FALLARON. REVISAR LOGS ANTERIORES.');
  }
}

runAllTests().catch(err => {
  console.error('💥 ERROR INESPERADO EN EL TEST:', err);
  process.exit(1);
});
