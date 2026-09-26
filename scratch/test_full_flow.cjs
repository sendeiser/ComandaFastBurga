const fs = require('fs');
const prods = JSON.parse(fs.readFileSync('ComandaFast-Bot-Portatil/data/products.json', 'utf8'));

function normalizeSearchText(str) {
  if (!str) return '';
  return str.toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function findProductByText(inputText, prodsList) {
  if (!inputText || !Array.isArray(prodsList) || prodsList.length === 0) return null;
  const rawNorm = normalizeSearchText(inputText);
  if (!rawNorm) return null;

  const isPromoSearch = /\b(promos?|promocion(es)?|ofertas?|descuentos?|combos?)\b/.test(rawNorm);

  // Limpiar palabras accesorias
  const strippedText = rawNorm
    .replace(/\b(promos?|promocion(es)?|ofertas?|descuentos?|combos?)\b/g, '')
    .replace(/\b(quiero|dame|pedir|comprar|la|el|un|una|de|con|por favor|me das)\b/g, '')
    .replace(/[!¡?¿.,;:\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const promoProds = prodsList.filter(p => normalizeSearchText(p.category) === 'promos');
  const regularProds = prodsList.filter(p => normalizeSearchText(p.category) !== 'promos');

  // Si busca "promo 1" o "promo 2"
  const promoNumMatch = rawNorm.match(/\bpromo\s*(\d+)\b/);
  if (promoNumMatch) {
    const pIdx = parseInt(promoNumMatch[1], 10);
    if (pIdx >= 1 && pIdx <= promoProds.length) {
      return promoProds[pIdx - 1];
    }
  }

  // 1. Si es búsqueda de promo o incluye strippedText que coincide con alguna promo
  if (isPromoSearch && strippedText) {
    const promoMatch = promoProds.find(p => {
      const pNorm = normalizeSearchText(p.name);
      return pNorm === strippedText || strippedText.includes(pNorm) || pNorm.includes(strippedText);
    });
    if (promoMatch) return promoMatch;
  }

  // 2. Si el strippedText coincide exactamente con una promo (priorizar Promos si tienen el mismo nombre!)
  if (strippedText) {
    const exactPromo = promoProds.find(p => normalizeSearchText(p.name) === strippedText);
    if (exactPromo) return exactPromo;
  }

  // 3. Coincidencia exacta con strippedText en productos regulares
  if (strippedText) {
    const exactRegular = regularProds.find(p => normalizeSearchText(p.name) === strippedText);
    if (exactRegular) return exactRegular;
  }

  // 4. Coincidencia exacta completa (rawNorm) con nombre de producto (priorizando promo)
  const exactFullPromo = promoProds.find(p => {
    const pNorm = normalizeSearchText(p.name);
    return rawNorm === pNorm || rawNorm === `promo ${pNorm}` || rawNorm === `la ${pNorm}`;
  });
  if (exactFullPromo) return exactFullPromo;

  const exactFullRegular = regularProds.find(p => {
    const pNorm = normalizeSearchText(p.name);
    return rawNorm === pNorm || rawNorm === `promo ${pNorm}` || rawNorm === `la ${pNorm}`;
  });
  if (exactFullRegular) return exactFullRegular;

  // 5. Coincidencia parcial donde el texto contenga el nombre de algún producto o viceversa
  if (isPromoSearch) {
    const promoCand = promoProds.find(p => {
      const pNorm = normalizeSearchText(p.name);
      return rawNorm.includes(pNorm) || pNorm.includes(rawNorm) || (pNorm.length >= 4 && rawNorm.includes(pNorm.slice(0, -1)));
    });
    if (promoCand) return promoCand;
  }

  const allCandidates = prodsList.filter(p => {
    const pNorm = normalizeSearchText(p.name);
    return rawNorm.includes(pNorm) || (rawNorm.length >= 4 && pNorm.includes(rawNorm)) || (pNorm.length >= 4 && rawNorm.includes(pNorm.slice(0, -1)));
  });

  if (allCandidates.length > 0) {
    if (isPromoSearch) {
      const pPromo = allCandidates.find(p => normalizeSearchText(p.category) === 'promos');
      if (pPromo) return pPromo;
    }
    allCandidates.sort((a, b) => b.name.length - a.name.length);
    return allCandidates[0];
  }

  return null;
}

function processMessage(text, session = { step: 'IDLE' }) {
  const lower = text.toLowerCase().trim();
  const cleanNorm = normalizeSearchText(text);

  // 1. Verificación de consulta general de promos
  const isGeneralPromoInquiry = (
    ['promo', 'promos', 'ver promo', 'ver promos', 'promocion', 'promociones', 'oferta', 'ofertas', 'descuento', 'descuentos', 'combo', 'combos', '0'].includes(cleanNorm) ||
    /^(ver\s+)?(las\s+)?(promos?|promocion(es)?|ofertas?|combos?)$/i.test(cleanNorm) ||
    (/\b(promos?|promocion(es)?|ofertas?|combos?|descuentos?)\b/i.test(cleanNorm) && (
      cleanNorm.includes('que') || cleanNorm.includes('hay') || cleanNorm.includes('tienen') ||
      cleanNorm.includes('tenes') || cleanNorm.includes('cuales') || cleanNorm.includes('ver') ||
      cleanNorm.includes('mostrar') || cleanNorm.includes('quiero') || cleanNorm.includes('disponible')
    ))
  );

  // Si busca un producto específico, NO tratar como consulta general
  const productCheck = findProductByText(lower, prods);

  if (isGeneralPromoInquiry && !productCheck) {
    session.step = 'SELECTING';
    return { type: 'SHOW_PROMOS_CATALOG' };
  }

  // 2. Si está en IDLE y es un número puro 1-5, opciones del menú principal
  if (session.step === 'IDLE' && /^[1-5]$/.test(cleanNorm)) {
    if (cleanNorm === '1') return { type: 'MENU_OPTION_1_STATUS' };
    if (cleanNorm === '2') return { type: 'MENU_OPTION_2_BANK' };
    if (cleanNorm === '3') return { type: 'MENU_OPTION_3_HOURS' };
    if (cleanNorm === '4') { session.step = 'SELECTING'; return { type: 'MENU_OPTION_4_CATALOG' }; }
    if (cleanNorm === '5') return { type: 'MENU_OPTION_5_HUMAN' };
  }

  // 3. Selección directa de producto o promo
  const initialNum = parseInt(lower.replace(/\D/g, ''), 10);
  let matchedProd = null;
  if (!isNaN(initialNum) && initialNum >= 1 && initialNum <= prods.length && !lower.includes('hamburguesa') && !lower.includes('burger') && /^(pedir|comprar|la|el|nro|numero)?\s*\d+$/i.test(lower)) {
    matchedProd = prods[initialNum - 1];
  } else {
    matchedProd = productCheck;
  }

  const isPureNumber1to5InIdle = session.step === 'IDLE' && /^[1-5]$/.test(cleanNorm);

  if (matchedProd && !isPureNumber1to5InIdle) {
    session.step = 'SELECTING';
    return {
      type: 'ADD_PRODUCT_TO_CART',
      id: matchedProd.id,
      name: matchedProd.name,
      category: matchedProd.category,
      price: matchedProd.price
    };
  }

  return { type: 'OTHER_OR_AI' };
}

console.log('=== TEST ALL CASES ===');
const testCases = [
  'promos',
  'ver promos',
  'que promos tienen',
  'hay alguna promo?',
  'tienen promos hoy',
  '0',
  'promo clasica',
  'promo clásica',
  'promo doña burga',
  'promo dona burga',
  'doña burga promo',
  'clasica promo',
  'quiero la promo doña burga',
  'quiero promo clásica',
  'dame una promo clasica',
  'clasica',
  'clásica',
  'doña burga',
  'dona burga',
  'promo 1',
  'promo 2',
  'la 1',
  'la 2',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '4x4',
  'aros de cebolla'
];

for (const tc of testCases) {
  const res = processMessage(tc, { step: 'IDLE' });
  console.log(`[${tc}] =>`, res.type, res.name ? `"${res.name}" (${res.category}) $${res.price}` : '');
}
