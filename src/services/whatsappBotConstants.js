// =========================================================
// CONSTANTES Y PLANTILLAS DEL CHATBOT DE WHATSAPP (COMANDAFAST)
// Configuración de flujos conversacionales, personas y test suites
// =========================================================

export const DEFAULT_CHATBOT_KEYWORDS = [
  'burger', 'hamburguesa', 'papas', 'pedido', 'comprar', 'precio', 'precios', 
  'combo', 'combos', 'catalogo', 'catálogo', 'envio', 'envío', 'local', 'horario', 
  'horarios', 'transferencia', 'alias', 'cbu', 'menu', 'menú', 'hola', 'promo', 
  'promos', 'delivery', 'comanda', 'cheddar', 'bacon', 'doble', 'triple'
];

export const DEFAULT_TEMPLATES = {
  // 1. Menú Principal y Opciones
  template_menu: `🍔 *¡Hola {cliente}! Bienvenido a ComandaFast Burgers* 🔥\n\n¿En qué podemos ayudarte hoy? *Respondé con el número de opción:*\n\n1️⃣ 📋 *Consultar estado de mi pedido*\n2️⃣ 💳 *Ver datos de transferencia bancaria / Alias*\n3️⃣ 📍 *Horarios y ubicación de nuestro local*\n4️⃣ 🍔 *Ver menú completo de hamburguesas y combos*\n5️⃣ 👤 *Hablar con un encargado del local*\n\n_O escribí directamente tu pedido (ej: *2 Dobles con queso sin cebolla y unas papas*)._`,
  
  menu_response_1: `📋 *Estado de tu Pedido:* #{pedido_id}\n\n• *Estado:* {estado}\n• *Total:* \${total}\n• *Destino:* {direccion}\n\n_Para volver al menú, enviá la palabra *MENU*._`,
  
  menu_response_2: `💳 *Datos para Transferencia Bancaria:* 🏦\n\n• *Alias:* \`{alias_banco}\`\n• *Banco:* {banco}\n• *Titular:* {titular}\n• *CBU:* \`{cbu}\`\n\n📸 *Una vez realizada la transferencia, podés enviar la captura o foto del comprobante por este mismo chat para comenzar a cocinar.*\n\n_Enviá *MENU* para ver más opciones._`,
  
  menu_response_3: `📍 *Ubicación y Horarios de Atención:* 🕒\n\n🍔 *Dirección:* {direccion}\n⏰ *Horarios de Cocina:* {horarios}\n\n¡Te esperamos con las mejores burgers a la plancha! 🔥\n\n_Enviá *MENU* para volver al menú principal._`,
  
  menu_response_4: `🍔 *Menú & Precios de ComandaFast Burgers* 🔥\n\n{catalogo_lista}\n\n👉 *Respondé con el NÚMERO (1, 2, 3...) de la burger para pedir o escribí COMPRAR.*\n🌐 *Menú digital:* {catalogo_url}`,
  
  menu_response_5: `👤 *¡Entendido {cliente}! Un encargado de ComandaFast te responderá a la brevedad.* 🍔\n\nPor favor dejanos tu consulta detallada para que podamos ayudarte lo antes posible. ¡Muchas gracias!`,

  // 2. Flujo de Compra y Comanda
  template_buy_catalog: `🍔 *¡Vamos a armar tu comanda!* 🔥\n\n{catalogo_lista}\n\n👉 *Respondé con el NÚMERO (1, 2, 3...) de la hamburguesa o combo que quieras pedir.*`,
  
  template_product_photo: `🍔 *{producto}* 🔥\n{detalle}\n💵 *Precio:* {precio}\n\n👉 Para pedir este producto escribí *COMPRAR* o su número.\n👉 Podés agregar aclaraciones como *Sin cebolla*, *Extra cheddar*, etc.`,
  
  template_cart_item_added: `✅ *¡Agregaste {producto}!* 🍔 (+{subtotal_item})\n\n🛒 *Tu comanda actual:*\n{carrito_items}\n\n💵 *Subtotal:* \${subtotal}\n\n👉 ¿Querés sumar otra burger, papas o bebida? *(Escribí su número)*\n👉 Podés pedir aclaraciones *(Ej: sin cebolla, extra cheddar)*\n👉 O escribí *LISTO* para avanzar con la entrega y el pago.`,
  
  template_cart_view: `🛒 *TU COMANDA ACTUAL:* 🍔\n\n{carrito_items}\n\n💵 *Subtotal:* \${subtotal}\n\n👉 Para sumar más productos, escribí su *NÚMERO*.\n👉 Para quitar un producto, escribí *QUITAR [número]* (ej: QUITAR 1).\n👉 O escribí *LISTO* para avanzar con la entrega y el pago.`,
  
  template_empty_cart: `⚠️ Tu carrito está vacío. Escribí el *NÚMERO* del producto que querés agregar o escribí *MENU*.`,
  
  template_shipping_prompt: `🛵 *¿Cómo querés recibir tu comanda?*\n\nRespondé con el número de opción:\n1️⃣ *Retiro por el local (Mostrador / Take Away)* 🏷️ Sin costo\n2️⃣ *Envío a domicilio con cadete (Delivery)*`,
  
  template_address_prompt: `📍 *Por favor escribí tu dirección exacta y entrecalles para el repartidor:*`,
  
  template_name_prompt: `👤 *¿A nombre de quién registramos el pedido?* (Escribí tu nombre y apellido):`,
  
  template_payment_prompt: `💳 *¿Cómo preferís abonar tu pedido?*\n\nRespondé con el número:\n1️⃣ *Transferencia Bancaria* (Alias / CBU)\n2️⃣ *Efectivo contra entrega* (Al recibir o retirar)\n3️⃣ *Mercado Pago* (Link directo de pago)`,
  
  template_order_summary: `🍔 *RESUMEN DE TU COMANDA* 🔥\n\n🛒 *Items:*\n{carrito_items}\n\n💵 *Subtotal:* \${subtotal}\n{linea_descuento}🛵 *Entrega:* {metodo_entrega}\n📍 *Dirección:* {direccion}\n👤 *Cliente:* {cliente}\n💳 *Forma de Pago:* {medio_pago}\n\n💵 *TOTAL A PAGAR:* \${total}\n\n¿Está todo correcto para mandar a la cocina?\n👉 Respondé *SI* para confirmar tu comanda o *CANCELAR*.`,
  
  template_order_confirmed: `🎉 *¡PEDIDO #{pedido_id} CONFIRMADO Y ENVIADO A COCINA!* 🔥🍔\n\n¡Muchas gracias *{cliente}*, tu comanda ya ingresó al sistema de la plancha!\n\n📋 *Detalle:*\n{carrito_items}\n💵 *Total:* \${total}\n🛵 *Entrega:* {direccion}\n\n{instrucciones_pago}`,
  
  template_order_cancelled: `❌ *Comanda cancelada.* ¿En qué más podemos ayudarte?\n\n{menu}`,

  // 3. Notificaciones KDS de Estados de Cocina
  template_order_preparing: `👨‍🍳🔥 *¡Buenas noticias {cliente}! Tu pedido #{pedido_id} ya está en la plancha.*\n\nNuestros cocineros están preparando tus hamburguesas con la carne recién smashada y el cheddar fundido. ¡Te avisamos apenas esté listo! 🍔✨`,
  
  template_order_ready: `🔔 *¡Tu pedido #{pedido_id} está LISTO {cliente}!* 🍔🍟\n\nYa podés pasar a retirarlo por nuestro local en {direccion}. ¡Te esperamos con las burgers calentitas!`,
  
  template_order_shipped: `🛵💨 *¡Tu pedido #{pedido_id} va en camino {cliente}!*\n\nDestino: *{direccion}*\nEl repartidor ya salió del local. ¡Mantenete atento para recibir tu comida bien caliente! 🍔🔥`,
  
  template_payment_proof: `📸 *¡Comprobante de transferencia recibido!* 💳\n\nMuchas gracias por enviarlo. Ya verificamos el ingreso y tu pedido pasa a cocina inmediatamente. 🔥🍔`
};

export const ALL_TEMPLATE_NODES = [
  { id: 'template_menu', label: 'Menú de Bienvenida Principal', category: 'menu', description: 'Mensaje inicial cuando el cliente saluda por primera vez' },
  { id: 'menu_response_1', label: 'Respuesta: Consulta de Pedido', category: 'menu', description: 'Información del pedido activo del cliente' },
  { id: 'menu_response_2', label: 'Respuesta: Datos de Transferencia', category: 'menu', description: 'Alias bancario, CBU y titular de la cuenta' },
  { id: 'menu_response_3', label: 'Respuesta: Horarios y Ubicación', category: 'menu', description: 'Dirección física y turnos de atención del local' },
  { id: 'menu_response_4', label: 'Respuesta: Menú de Hamburguesas', category: 'menu', description: 'Listado de productos con precios para pedir' },
  { id: 'menu_response_5', label: 'Respuesta: Hablar con Asesor', category: 'menu', description: 'Mensaje de derivación al encargado humano' },
  { id: 'template_buy_catalog', label: 'Catálogo de Compras', category: 'buy_flow', description: 'Inicio del flujo de selección de productos' },
  { id: 'template_cart_item_added', label: 'Producto Agregado al Carrito', category: 'buy_flow', description: 'Confirmación cuando el cliente elige una hamburguesa' },
  { id: 'template_cart_view', label: 'Vista de Comanda Actual', category: 'buy_flow', description: 'Desglose del carrito con opciones de modificar' },
  { id: 'template_shipping_prompt', label: 'Pregunta de Entrega', category: 'buy_flow', description: 'Pregunta si es Take Away o Delivery' },
  { id: 'template_address_prompt', label: 'Pregunta de Dirección', category: 'buy_flow', description: 'Solicitud de dirección para el repartidor' },
  { id: 'template_payment_prompt', label: 'Pregunta de Medio de Pago', category: 'buy_flow', description: 'Opciones de Efectivo, Transferencia o Mercado Pago' },
  { id: 'template_order_summary', label: 'Resumen Previo a Confirmar', category: 'buy_flow', description: 'Comanda final para que el cliente responda SI' },
  { id: 'template_order_confirmed', label: 'Comanda Confirmada a Cocina', category: 'buy_flow', description: 'Mensaje con el código de comanda #CMD' },
  { id: 'template_order_preparing', label: 'KDS: En Preparación', category: 'notifications', description: 'Notificación cuando cocina toma el pedido' },
  { id: 'template_order_ready', label: 'KDS: Pedido Listo', category: 'notifications', description: 'Notificación para que el cliente retire' },
  { id: 'template_order_shipped', label: 'KDS: En Camino', category: 'notifications', description: 'Notificación cuando sale con el repartidor' },
  { id: 'template_payment_proof', label: 'Aviso de Comprobante Recibido', category: 'notifications', description: 'Agradecimiento tras recibir captura de transferencia' }
];

export const TEST_PERSONAS = [
  {
    id: 'persona_sofia',
    name: 'Sofía González',
    phone: '3826401122',
    role: 'Cliente Nueva',
    avatarBg: 'linear-gradient(135deg, #ec4899, #be185d)',
    description: 'Sin pedidos previos. Consulta fotos, carta de hamburguesas y combos.',
    hasActiveOrder: false
  },
  {
    id: 'persona_lucas',
    name: 'Lucas Benítez',
    phone: '3826458899',
    role: 'Cliente VIP / Frecuente',
    avatarBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
    description: 'Tiene una comanda activa (#CMD-7821) en la plancha para probar seguimiento.',
    hasActiveOrder: true,
    activeOrderId: 'CMD-7821'
  },
  {
    id: 'persona_mateo',
    name: 'Mateo Romero',
    phone: '3826493344',
    role: 'Hamburguesero Exigente',
    avatarBg: 'linear-gradient(135deg, #10b981, #059669)',
    description: 'Pide burger con aclaraciones (sin cebolla, extra cheddar) y delivery.',
    hasActiveOrder: false
  },
  {
    id: 'persona_amigo',
    name: 'Juan (Amigo / Familiar)',
    phone: '3826507711',
    role: 'Contacto Personal',
    avatarBg: 'linear-gradient(135deg, #64748b, #334155)',
    description: 'Prueba que el bot NO responda mensajes personales (Filtro Anti-Spam).',
    isIgnored: true
  }
];

export const DEFAULT_TEST_SUITES = [
  {
    id: 'suite_full_order',
    title: '🍔 Compra Completa de Hamburguesas & Papas',
    description: 'Pide Burger 1 + Sin cebolla + Papas + Delivery + Efectivo + Confirmación.',
    badge: 'Flujo Completo',
    badgeColor: 'rgba(236, 72, 153, 0.2)',
    textColor: '#f472b6',
    steps: ['comprar', '1', 'sin cebolla', '4', 'listo', '2', 'Av. Belgrano 450', 'Sofía González', '2', 'si']
  },
  {
    id: 'suite_product_photos',
    title: '📸 Consulta de Fotos & Ficha de Burgers',
    description: 'Pide fotos y detalles de las hamburguesas más vendidas del menú.',
    badge: 'Fotos & Info',
    badgeColor: 'rgba(99, 102, 241, 0.2)',
    textColor: '#818cf8',
    steps: ['foto 1', 'foto 2', 'comprar', '1', 'listo']
  },
  {
    id: 'suite_order_status',
    title: '📋 Consulta de Estado de Pedido Activo',
    description: 'Verifica respuesta de seguimiento para cliente con comanda en cocina.',
    badge: 'Estado KDS',
    badgeColor: 'rgba(245, 158, 11, 0.2)',
    textColor: '#fbbf24',
    steps: ['1']
  },
  {
    id: 'suite_alias_and_proof',
    title: '💳 Datos de Transferencia & Comprobante',
    description: 'Solicita el Alias bancario y simula el envío de una foto de comprobante.',
    badge: 'Transferencia',
    badgeColor: 'rgba(16, 185, 129, 0.2)',
    textColor: '#34d399',
    steps: ['2', '[ENVIAR FOTO COMPROBANTE]']
  },
  {
    id: 'suite_cart_edit',
    title: '🛒 Gestión y Edición de Comanda',
    description: 'Prueba comandos CARRITO, QUITAR 1 y modificación en vivo.',
    badge: 'Edición Carrito',
    badgeColor: 'rgba(59, 130, 246, 0.2)',
    textColor: '#60a5fa',
    steps: ['comprar', '1', '2', 'carrito', 'quitar 1', 'listo']
  },
  {
    id: 'suite_antispam',
    title: '🛡️ Filtro Anti-Spam (Mensaje Personal)',
    description: 'Verifica que el bot permanezca en silencio ante mensajes no comerciales.',
    badge: 'Filtro Anti-Spam',
    badgeColor: 'rgba(100, 116, 139, 0.2)',
    textColor: '#94a3b8',
    steps: ['Hola che, a qué hora nos juntamos hoy a jugar al fútbol?']
  }
];


// =========================================================
// GESTOR DE FLUJOS PERSONALIZADOS Y CONDICIONES (BUILDER)
// =========================================================

export const FLOW_CATEGORIES = [
  { id: 'all', label: 'Todas las categorías', icon: 'Layers' },
  { id: 'promociones', label: 'Promos & Ofertas', icon: 'Sparkles', color: '#f59e0b' },
  { id: 'dietas', label: 'Dietas & Nutrición', icon: 'Utensils', color: '#10b981' },
  { id: 'eventos', label: 'Eventos & Grupos', icon: 'PartyPopper', color: '#a855f7' },
  { id: 'envios', label: 'Envíos & Logística', icon: 'Truck', color: '#3b82f6' },
  { id: 'atencion', label: 'Atención & Soporte', icon: 'UserCheck', color: '#ec4899' },
  { id: 'general', label: 'General / Otros', icon: 'MessageSquare', color: '#64748b' }
];

export const FLOW_MATCH_TYPES = [
  { id: 'contains_any', label: 'Contiene alguna de las palabras clave', description: 'Se activa si el cliente escribe cualquier palabra de la lista en su mensaje' },
  { id: 'exact', label: 'Coincidencia exacta de frase', description: 'El mensaje debe ser idéntico a una de las frases configuradas' },
  { id: 'starts_with', label: 'Empieza con la palabra clave', description: 'El mensaje debe comenzar obligatoriamente con alguna de las palabras clave' }
];

export const FLOW_SCOPES = [
  { id: 'always', label: '🌐 Siempre activo (Global)', description: 'Responde en cualquier momento de la charla' },
  { id: 'idle_only', label: '⏳ Solo fuera de pedidos (Sin comanda activa)', description: 'No interrumpe si el cliente está armando un pedido o cargando su dirección' },
  { id: 'active_order', label: '🛒 Solo durante la comanda', description: 'Únicamente cuando el cliente está seleccionando productos' }
];

export const DEFAULT_CUSTOM_FLOWS = [
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
    },
    stats: { triggerCount: 0, lastTriggered: null }
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
    },
    stats: { triggerCount: 0, lastTriggered: null }
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
    },
    stats: { triggerCount: 0, lastTriggered: null }
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
    },
    stats: { triggerCount: 0, lastTriggered: null }
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
      response: `🛵 *INFORMACIÓN DE DELIVERY & ENVÍOS* 📍\n\n• 📍 *Zona de cobertura:* Radio de hasta 6 km desde nuestro local en {direccion}.\n• ⏱️ *Tiempo promedio de despacho:* 30 a 45 minutos según demanda de cocina.\n• 💵 *Costo de envío:* Tarifa plana accesible para todo el casco urbano.\n• 🛍️ *Take Away:* También podés retirar por mostrador sin ningún costo extra.\n\n👉 ¿Querés pedir ahora? Escribí *COMPRAR* o *MENU* para empezar.`,
      imageUrl: '',
      suggestedChips: ['Hacer Pedido', 'Ver Carta', 'Ubicación']
    },
    stats: { triggerCount: 0, lastTriggered: null }
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
    },
    stats: { triggerCount: 0, lastTriggered: null }
  }
];
