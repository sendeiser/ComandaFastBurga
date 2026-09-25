// Benchmark de Concurrencia y Capacidad Multi-IA
// Simula 6 clientes interactuando simultáneamente con el bot de WhatsApp

const SERVER_URL = 'http://127.0.0.1:3002';

const testCustomers = [
  {
    name: 'Bianca Gómez',
    query: '¡Hola! Quiero pedir 2 Smash Doble Bacon con papas fritas y una gaseosa para enviar a San Martín 450, ¿cuánto sería?',
    expectedTopic: 'Smash Doble Bacon / Precio / Delivery'
  },
  {
    name: 'Lucas Peralta',
    query: 'Buenas noches, ¿qué opciones vegetarianas o sin carne tienen en la carta hoy?',
    expectedTopic: 'Opciones vegetarianas / Asesoramiento'
  },
  {
    name: 'Florencia Romero',
    query: 'Hola! ¿Hasta qué hora tienen abierto hoy el local y cuánto tarda el delivery a barrio centro?',
    expectedTopic: 'Horarios / Demora / Ubicación'
  },
  {
    name: 'Matías Silva',
    query: 'Buenas! Quiero una Smash Clásica simple y unas papas cheddar para retirar por el local, ¿cómo hago para encargarla?',
    expectedTopic: 'Smash Clásica / Retiro / Pasos de compra'
  },
  {
    name: 'Valentina Díaz',
    query: 'Hola, somos dos personas, ¿qué promo o combo nos recomiendan que sea llenador y rico?',
    expectedTopic: 'Recomendación / Combos'
  },
  {
    name: 'Gonzalo Funes',
    query: 'Hola genio, ¿la hamburguesa cuádruple qué ingredientes trae y viene con papas incluidas?',
    expectedTopic: 'Ingredientes / Smash Cuádruple'
  }
];

async function runBenchmark() {
  console.log('=====================================================================');
  console.log('🚀 [BENCHMARK] PRUEBA DE ESTRÉS Y CONCURRENCIA MULTI-IA (6 EN SIMULTÁNEO)');
  console.log('=====================================================================');
  console.log(`📡 Servidor destino: ${SERVER_URL}/api/ai/chat`);
  console.log(`👥 Clientes concurrentes: ${testCustomers.length}`);
  console.log(`⏱️ Enviando todas las peticiones en paralelo con Promise.all...\n`);

  const globalStart = Date.now();

  const promises = testCustomers.map(async (client, index) => {
    const reqStart = Date.now();
    try {
      const response = await fetch(`${SERVER_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: client.name,
          message: client.query
        })
      });

      const latencyMs = Date.now() - reqStart;
      const data = await response.json();

      return {
        id: index + 1,
        client: client.name,
        query: client.query,
        topic: client.expectedTopic,
        success: data.success && !!data.reply,
        status: response.status,
        latencyMs,
        reply: data.reply || data.error || 'Sin respuesta'
      };
    } catch (err) {
      return {
        id: index + 1,
        client: client.name,
        query: client.query,
        topic: client.expectedTopic,
        success: false,
        status: 'ERR',
        latencyMs: Date.now() - reqStart,
        reply: `Error de red: ${err.message}`
      };
    }
  });

  const results = await Promise.all(promises);
  const totalElapsed = Date.now() - globalStart;

  console.log('=====================================================================');
  console.log('📊 RESULTADOS INDIVIDUALES DE CADA CLIENTE SIMULTÁNEO:');
  console.log('=====================================================================\n');

  results.forEach(r => {
    console.log(`---------------------------------------------------------------------`);
    console.log(`👤 [Cliente #${r.id}] ${r.client}`);
    console.log(`❓ Consulta: "${r.query}"`);
    console.log(`⏱️ Tiempo de Respuesta: ${r.latencyMs} ms | Estado: ${r.success ? '✅ OK' : '❌ FALLO'}`);
    console.log(`🤖 Respuesta de la IA:\n${r.reply.trim()}\n`);
  });

  const successCount = results.filter(r => r.success).length;
  const latencies = results.map(r => r.latencyMs);
  const avgLatency = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(0);
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);
  const reqPerSec = ((testCustomers.length / totalElapsed) * 1000).toFixed(2);

  console.log('=====================================================================');
  console.log('📈 MÉTRICAS GLOBALES DE EFICIENCIA Y CAPACIDAD:');
  console.log('=====================================================================');
  console.log(`  • Peticiones exitosas:     ${successCount}/${testCustomers.length} (${((successCount/testCustomers.length)*100).toFixed(0)}%)`);
  console.log(`  • Tiempo total del lote:   ${totalElapsed} ms (~${(totalElapsed/1000).toFixed(2)}s)`);
  console.log(`  • Latencia promedio:       ${avgLatency} ms`);
  console.log(`  • Latencia mínima:         ${minLatency} ms`);
  console.log(`  • Latencia máxima:         ${maxLatency} ms`);
  console.log(`  • Rendimiento (Throughput): ${reqPerSec} req/seg`);
  console.log('=====================================================================\n');
}

runBenchmark().catch(console.error);
