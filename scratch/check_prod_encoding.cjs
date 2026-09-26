const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
let url = env.match(/VITE_SUPABASE_URL=["']?([^"'\r\n]+)/)?.[1]?.trim();
let key = env.match(/VITE_SUPABASE_ANON_KEY=["']?([^"'\r\n]+)/)?.[1]?.trim();
url = url.replace(/["']/g, '');
key = key.replace(/["']/g, '');

async function run() {
  const res = await fetch(`${url}/rest/v1/products?id=in.(prod-1790375950513,prod-1790376094216,prod-1,prod-3)&select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const data = await res.json();
  console.log('--- SUPABASE PRODUCTS ---');
  for (const p of data) {
    console.log(`ID: ${p.id} | Name: "${p.name}" | Cat: "${p.category}" | Price: ${p.price}`);
    console.log(`Name charCodes:`, Array.from(p.name).map(c => c.charCodeAt(0)));
  }

  const localPortatil = JSON.parse(fs.readFileSync('./ComandaFast-Bot-Portatil/data/products.json', 'utf8'));
  console.log('\n--- PORTATIL JSON PRODUCTS (first 4) ---');
  for (const p of localPortatil.slice(0, 4)) {
    console.log(`ID: ${p.id} | Name: "${p.name}" | Cat: "${p.category}" | Price: ${p.price}`);
    console.log(`Name charCodes:`, Array.from(p.name).map(c => c.charCodeAt(0)));
  }
}
run();
