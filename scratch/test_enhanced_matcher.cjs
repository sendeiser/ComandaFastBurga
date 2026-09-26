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

const tests = [
  'promo clasica',
  'promo clásica',
  'promo doña burga',
  'promo dona burga',
  'doña burga promo',
  'dona burga promo',
  'clasica promo',
  'clásica promo',
  'quiero la promo clásica',
  'dame una promo doña burga',
  'clasica',
  'clásica',
  'doña burga',
  'dona burga',
  '4x4',
  'aros de cebolla',
  'papas cheddar'
];

console.log('--- ENHANCED MATCHING RESULTS ---');
for (const t of tests) {
  const res = findProductByText(t, prods);
  console.log(`"${t}" =>`, res ? `${res.name} (${res.category}) - $${res.price}` : 'NULL');
}
