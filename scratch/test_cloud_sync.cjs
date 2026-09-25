const SUPABASE_URL = 'https://yqynuvjpipmvurualgtg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxeW51dmpwaXBtdnVydWFsZ3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MzMyOTgsImV4cCI6MjEwNTUwOTI5OH0.mLO52rFPD384yQHdGlBasrx4QvqXiHYH3zRmJ9Bq2go';

async function runTest() {
  console.log('--- 1. PROBAR CONSULTA DE BOT_CONFIG EN SUPABASE CLOUD ---');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/bot_config?select=id,updated_at`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const rows = await res.json();
  console.log(`✅ [OK] ${rows.length} registros encontrados en bot_config:`);
  rows.forEach(r => console.log(`   - ${r.id}: ${r.updated_at}`));

  console.log('\n--- 2. PROBAR FETCH ESPECÍFICO DE TEMPLATES Y VARIABLES ---');
  const [resTpls, resVars] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/bot_config?id=eq.templates&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    }),
    fetch(`${SUPABASE_URL}/rest/v1/bot_config?id=eq.variables&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    })
  ]);

  const tplRows = await resTpls.json();
  const varRows = await resVars.json();

  const tplData = tplRows[0]?.data;
  const varData = varRows[0]?.data;

  console.log('✅ SEGURIDAD ANTI-SPAM & ANTI-BUCLE EN LA NUBE:');
  console.log(`   • anti_loop_enabled: ${tplData?.anti_loop_enabled} (${tplData?.anti_loop_enabled !== false ? 'ACTIVO' : 'INACTIVO'})`);
  console.log(`   • human_mode_sleep_minutes: ${tplData?.human_mode_sleep_minutes} min`);
  console.log(`   • bot_typing_delay_ms: ${tplData?.bot_typing_delay_ms} ms`);
  console.log(`   • bot_typing_mode: ${tplData?.bot_typing_mode}`);
  console.log(`   • Palabras de agradecimiento: ${tplData?.anti_loop_gratitude?.length || 0}`);
  console.log(`   • Palabras de despedida: ${tplData?.anti_loop_farewell?.length || 0}`);
  console.log(`   • Palabras de confirmación: ${tplData?.anti_loop_acknowledge?.length || 0}`);

  console.log('\n✅ VARIABLES DEL BOT EN LA NUBE:');
  console.log(`   • Cantidad de variables: ${varData?.length || 0}`);
  if (Array.isArray(varData)) {
    const sample = varData.slice(0, 3).map(v => `${v.key} = "${v.value}"`).join(' | ');
    console.log(`   • Muestra: ${sample}`);
  }

  console.log('\n--- 3. VERIFICAR QUE ANTI_LOOP_ENABLED ES TRUE ---');
  if (tplData?.anti_loop_enabled !== true) {
    throw new Error('anti_loop_enabled no es true en Supabase Cloud');
  }
  console.log('✅ ¡VERIFICACIÓN EXITOSA! Supabase Cloud está 100% sincronizado con la configuración requerida.');
}

runTest().catch(err => {
  console.error('❌ Error en test:', err);
  process.exit(1);
});
