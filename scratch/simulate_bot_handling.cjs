const fs = require('fs');

const prods = JSON.parse(fs.readFileSync('ComandaFast-Bot-Portatil/data/products.json', 'utf8'));

// Exact function from whatsappBotServer.js
function findProductByText(lowerText, prodsList) {
  if (!lowerText || !Array.isArray(prodsList)) return null;
  const cleanLower = lowerText.toLowerCase().trim();
  const isPromoSearch = cleanLower.includes('promo') || cleanLower.includes('oferta') || cleanLower.includes('descuento') || cleanLower.includes('combo');

  // 1. Si el texto incluye "promo", buscar prioritariamente en la categoría Promos
  if (isPromoSearch) {
    const promoProds = prodsList.filter(p => (p.category || '').toLowerCase() === 'promos');
    const strippedText = cleanLower
      .replace(/\b(promos?|promocion(es)?|ofertas?|descuentos?|combos?)\b/gi, '')
      .replace(/\b(quiero|dame|pedir|comprar|la|el|un|una|de|con)\b/gi, '')
      .trim();

    if (strippedText) {
      const promoMatch = promoProds.find(p => {
        const pName = p.name.toLowerCase();
        return pName === strippedText || strippedText.includes(pName) || pName.includes(strippedText);
      });
      if (promoMatch) return promoMatch;
    }
  }

  // 2. Si NO es búsqueda de promo, buscar coincidencia exacta en productos regulares primero
  if (!isPromoSearch) {
    const regularExact = prodsList.find(p => (p.category || '').toLowerCase() !== 'promos' && cleanLower === p.name.toLowerCase());
    if (regularExact) return regularExact;
  }

  // 3. Coincidencia exacta de nombre o con prefijo "promo"
  const exactMatch = prodsList.find(p => {
    const pName = p.name.toLowerCase();
    return cleanLower === pName || cleanLower === `promo ${pName}` || cleanLower === `la ${pName}`;
  });
  if (exactMatch) return exactMatch;

  // 4. Buscar si el texto del cliente contiene el nombre de algún producto
  const candidates = prodsList.filter(p => {
    const pName = p.name.toLowerCase();
    return cleanLower.includes(pName) || (pName.length >= 4 && cleanLower.includes(pName.slice(0, -1)));
  });

  if (candidates.length > 0) {
    if (isPromoSearch) {
      const promoCand = candidates.find(p => (p.category || '').toLowerCase() === 'promos');
      if (promoCand) return promoCand;
    }
    candidates.sort((a, b) => b.name.length - a.name.length);
    return candidates[0];
  }

  return null;
}

// Now simulate the full handler logic at line 2160 in whatsappBotServer.js
function simulateBotHandling(inputText, sessionStep = 'IDLE') {
  const lower = inputText.toLowerCase().trim();

  // Promo trigger
  const isPromoTrigger = [
    'promo', 'promos', 'ver promo', 'ver promos', 'promocion', 'promociones',
    'oferta', 'ofertas', 'descuento', 'descuentos', 'combo', 'combos'
  ].includes(lower) || /^(ver\s+)?(las\s+)?(promos?|promocion(es)?|ofertas?)$/i.test(lower);

  if (isPromoTrigger) {
    return { action: 'SHOW_PROMOS_CATALOG' };
  }

  // Main menu 1-5 in IDLE
  if (sessionStep === 'IDLE') {
    if (lower === '1') return { action: 'ORDER_STATUS_OR_TRACKING' };
    if (lower === '2') return { action: 'BANK_INFO' };
    if (lower === '3') return { action: 'HOURS_LOCATION' };
    if (lower === '4') return { action: 'SHOW_CATALOG' };
    if (lower === '5') return { action: 'REQUEST_HUMAN' };
  }

  const initialNum = parseInt(lower.replace(/\D/g, ''), 10);
  let matchedProd = null;
  if (!isNaN(initialNum) && initialNum >= 1 && initialNum <= prods.length && !lower.includes('hamburguesa') && !lower.includes('burger')) {
    matchedProd = prods[initialNum - 1];
  } else {
    matchedProd = findProductByText(lower, prods);
  }

  const canAddToCart = matchedProd && (
    lower.startsWith('comprar') ||
    lower.startsWith('pedir') ||
    lower.startsWith('quiero') ||
    lower.startsWith('dame') ||
    (initialNum >= 6 && initialNum <= prods.length) ||
    sessionStep === 'SELECTING'
  );

  if (canAddToCart) {
    return { action: 'ADD_TO_CART', product: matchedProd.name, category: matchedProd.category, price: matchedProd.price };
  }

  return { action: 'FALLTHROUGH_TO_AI_OR_FALLBACK', matchedProd: matchedProd ? `${matchedProd.name} (${matchedProd.category})` : null };
}

const testInputs = [
  'promos',
  'ver promos',
  'promo',
  'promo clasica',
  'promo doña burga',
  'doña burga promo',
  'clasica',
  'doña burga',
  'quiero una promo',
  'quiero la promo doña burga',
  'quiero promo clasica',
  '1',
  '2',
  'dame una clasica',
  'dame una doña burga'
];

console.log('--- TEST RESULTS IN IDLE MODE ---');
for (const input of testInputs) {
  const res = simulateBotHandling(input, 'IDLE');
  console.log(`"${input}" ->`, res);
}
