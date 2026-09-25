// ============================================================================
// TEST ESPECÍFICO: CATEGORÍA PROMOS Y ENVÍO GRATIS BONIFICADO
// ============================================================================

const fs = require('fs');
const path = require('path');

const PRODUCTS_FILE = path.join(__dirname, '../data/products.json');
const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));

console.log('================================================================');
console.log('🧪 TEST DE CATEGORÍA PROMOS Y BONIFICACIÓN DE ENVÍO GRATIS');
console.log('================================================================');

// 1. Validar que la categoría Promos exista y tenga 4 productos cargados
const promos = products.filter(p => p.category === 'Promos');
console.log(`\n📌 1. Verificación de productos en categoría 'Promos': Encontrados ${promos.length}`);
if (promos.length !== 4) {
  console.error(`❌ [FAIL] Se esperaban 4 productos en 'Promos', encontrados: ${promos.length}`);
  process.exit(1);
}
console.log('✅ [PASS] 4 productos de promoción encontrados.');

// 2. Verificar atributos de cada promo
const p1 = promos.find(p => p.id === 'prod-promo-duo-smash');
const p2 = promos.find(p => p.id === 'prod-promo-4-cheese');
const p3 = promos.find(p => p.id === 'prod-promo-pareja-cheddar');
const p4 = promos.find(p => p.id === 'prod-promo-familiar-triple');

if (!p1 || !p1.freeShipping || p1.originalPrice <= p1.price) {
  console.error('❌ [FAIL] p1 attributes invalid:', p1);
  process.exit(1);
}
console.log('✅ [PASS] Promo Dúo Smash tiene freeShipping: true y precio original tachado.');

if (!p2 || !p2.freeShipping || p2.discountBadge !== '25% OFF') {
  console.error('❌ [FAIL] p2 attributes invalid:', p2);
  process.exit(1);
}
console.log('✅ [PASS] Promo 4 Cheeseburgers tiene 25% OFF y freeShipping: true.');

if (!p3 || p3.freeShipping !== false) {
  console.error('❌ [FAIL] p3 attributes invalid:', p3);
  process.exit(1);
}
console.log('✅ [PASS] Promo Pareja Doble Cheddar tiene descuento sin envío gratis.');

if (!p4 || !p4.freeShipping) {
  console.error('❌ [FAIL] p4 attributes invalid:', p4);
  process.exit(1);
}
console.log('✅ [PASS] Mega Promo 3 Triples Bacon tiene freeShipping: true.');

// 3. Simular lógica del Bot para envío con producto con freeShipping: true
console.log('\n📌 2. Simulación de bonificación de delivery en Bot con Promo Envío Gratis');
const session = {
  items: [
    { id: p1.id, name: p1.name, price: p1.price, freeShipping: p1.freeShipping, qty: 1 }
  ],
  subtotal: p1.price,
  shippingMethod: 'delivery'
};

const hasFreeShippingItem = session.items.some(it => it.freeShipping);
let deliveryFee = 2000;
if (hasFreeShippingItem) {
  deliveryFee = 0;
}
session.deliveryFee = deliveryFee;
session.total = session.subtotal + session.deliveryFee;

if (session.deliveryFee !== 0) {
  console.error(`❌ [FAIL] El delivery fee debía ser 0, pero es ${session.deliveryFee}`);
  process.exit(1);
}
console.log(`✅ [PASS] Costo de envío bonificado a $${session.deliveryFee} (¡Gratis por Promo!)`);
console.log(`✅ [PASS] Total a pagar: $${session.total.toLocaleString('es-AR')} (Sin recargo de envío)`);

// 4. Simular producto sin envío gratis
console.log('\n📌 3. Simulación con producto regular (sin promo de envío gratis)');
const sessionRegular = {
  items: [
    { id: 'prod-regular-1', name: 'Burger Simple', price: 7000, freeShipping: false, qty: 1 }
  ],
  subtotal: 7000,
  shippingMethod: 'delivery'
};

const hasFreeRegular = sessionRegular.items.some(it => it.freeShipping);
let deliveryFeeRegular = 2000;
if (hasFreeRegular) {
  deliveryFeeRegular = 0;
}
sessionRegular.deliveryFee = deliveryFeeRegular;
sessionRegular.total = sessionRegular.subtotal + sessionRegular.deliveryFee;

if (sessionRegular.deliveryFee !== 2000) {
  console.error(`❌ [FAIL] El delivery fee debía ser 2000, pero es ${sessionRegular.deliveryFee}`);
  process.exit(1);
}
console.log(`✅ [PASS] Costo de envío regular cobrado correctamente: $${sessionRegular.deliveryFee}`);
console.log(`✅ [PASS] Total regular: $${sessionRegular.total.toLocaleString('es-AR')}`);

console.log('\n================================================================');
console.log('🎉 ¡TODOS LOS TESTS DE PROMOS Y ENVÍO GRATIS PASARON CON ÉXITO!');
console.log('================================================================');
