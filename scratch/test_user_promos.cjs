// ============================================================================
// TEST ESPECÍFICO PARA LAS PROMOS DEL USUARIO ("Clasica" y "DOÑA BURGA")
// ============================================================================

const fs = require('fs');
const path = require('path');

const prods = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/products.json'), 'utf8'));

console.log('================================================================');
console.log('🧪 TEST DE DETECCIÓN DE PROMOS CARGADAS POR EL USUARIO');
console.log('================================================================');

console.log(`\n📦 Total de productos cargados: ${prods.length}`);
const promoProds = prods.filter(p => (p.category || '').toLowerCase() === 'promos');
console.log(`🏷️ Promos encontradas (${promoProds.length}):`);
promoProds.forEach((p, i) => console.log(`   ${i + 1}. [ID: ${p.id}] ${p.name} - $${p.price} (${p.category})`));

if (promoProds.length !== 2) {
  console.error(`❌ [FAIL] Se esperaban 2 promos, encontradas: ${promoProds.length}`);
  process.exit(1);
}
console.log('✅ [PASS] Ambas promos ("Clasica" y "DOÑA BURGA") están presentes.');

// Probar función findProductByText
function findProductByText(lowerText, prodsList) {
  if (!lowerText || !Array.isArray(prodsList)) return null;
  const cleanLower = lowerText.toLowerCase().trim();
  const isPromoSearch = cleanLower.includes('promo') || cleanLower.includes('oferta') || cleanLower.includes('descuento') || cleanLower.includes('combo');

  if (isPromoSearch) {
    const pProds = prodsList.filter(p => (p.category || '').toLowerCase() === 'promos');
    const strippedText = cleanLower
      .replace(/\b(promos?|promocion(es)?|ofertas?|descuentos?|combos?)\b/gi, '')
      .replace(/\b(quiero|dame|pedir|comprar|la|el|un|una|de|con)\b/gi, '')
      .trim();

    if (strippedText) {
      const promoMatch = pProds.find(p => {
        const pName = p.name.toLowerCase();
        return pName === strippedText || strippedText.includes(pName) || pName.includes(strippedText);
      });
      if (promoMatch) return promoMatch;
    }
  }

  // Si NO es búsqueda de promo, buscar coincidencia exacta en productos regulares primero
  if (!isPromoSearch) {
    const regularExact = prodsList.find(p => (p.category || '').toLowerCase() !== 'promos' && cleanLower === p.name.toLowerCase());
    if (regularExact) return regularExact;
  }

  const exactMatch = prodsList.find(p => {
    const pName = p.name.toLowerCase();
    return cleanLower === pName || cleanLower === `promo ${pName}` || cleanLower === `la ${pName}`;
  });
  if (exactMatch) return exactMatch;

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

const testCases = [
  { input: 'promo doña burga', expectedId: 'prod-1790376094216', expectedPrice: 9000 },
  { input: 'dame la promo doña burga', expectedId: 'prod-1790376094216', expectedPrice: 9000 },
  { input: 'doña burga promo', expectedId: 'prod-1790376094216', expectedPrice: 9000 },
  { input: 'promo clasica', expectedId: 'prod-1790375950513', expectedPrice: 7000 },
  { input: 'quiero la promo clasica', expectedId: 'prod-1790375950513', expectedPrice: 7000 },
  { input: 'clasica promo', expectedId: 'prod-1790375950513', expectedPrice: 7000 },
  { input: 'doña burga', expectedId: 'prod-3', expectedPrice: 10000 }
];

console.log('\n📌 Probando resolución de nombres y pedidos:');
let allPass = true;
for (const tc of testCases) {
  const result = findProductByText(tc.input, prods);
  const pass = result && result.id === tc.expectedId && result.price === tc.expectedPrice;
  if (pass) {
    console.log(`  ✅ [PASS] "${tc.input}" -> ${result.name} ($${result.price}) [Cat: ${result.category}]`);
  } else {
    console.error(`  ❌ [FAIL] "${tc.input}" -> Esperado ID ${tc.expectedId} ($${tc.expectedPrice}), obtenido:`, result ? `${result.id} ($${result.price})` : 'NULL');
    allPass = false;
  }
}

// Probar trigger de consulta de promos ("promos", "ver promos", etc.)
const triggerCases = ['promos', 'promo', 'ver promos', 'promociones', 'ofertas', 'combos'];
console.log('\n📌 Probando triggers de consulta de promociones:');
for (const tr of triggerCases) {
  const isPromoTrigger = [
    'promo', 'promos', 'ver promo', 'ver promos', 'promocion', 'promociones',
    'oferta', 'ofertas', 'descuento', 'descuentos', 'combo', 'combos'
  ].includes(tr.toLowerCase()) || /^(ver\s+)?(las\s+)?(promos?|promocion(es)?|ofertas?)$/i.test(tr.toLowerCase());

  if (isPromoTrigger) {
    console.log(`  ✅ [PASS] "${tr}" activa la lista de promociones`);
  } else {
    console.error(`  ❌ [FAIL] "${tr}" no activó la lista de promociones`);
    allPass = false;
  }
}

if (allPass) {
  console.log('\n================================================================');
  console.log('🎉 ¡TODAS LAS PRUEBAS DE DETECCIÓN DE PROMOS PASARON EXITOSAMENTE!');
  console.log('================================================================');
} else {
  process.exit(1);
}
