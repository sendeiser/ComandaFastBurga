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

function simulateSelectingMode(inputText) {
  const lower = inputText.toLowerCase().trim();
  const numIdx = parseInt(lower.replace(/\D/g, ''), 10);
  let selectedProd = null;
  if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= prods.length && !lower.includes('hamburguesa') && !lower.includes('burger')) {
    selectedProd = prods[numIdx - 1];
  } else {
    selectedProd = findProductByText(lower, prods);
  }
  return selectedProd ? { found: true, name: selectedProd.name, cat: selectedProd.category, price: selectedProd.price } : { found: false };
}

console.log('--- TEST RESULTS IN SELECTING MODE ---');
console.log('1 ->', simulateSelectingMode('1'));
console.log('2 ->', simulateSelectingMode('2'));
console.log('promo clasica ->', simulateSelectingMode('promo clasica'));
console.log('promo doña burga ->', simulateSelectingMode('promo doña burga'));
console.log('clasica ->', simulateSelectingMode('clasica'));
console.log('doña burga ->', simulateSelectingMode('doña burga'));
