const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'server', 'whatsappBotServer.js');
let content = fs.readFileSync(file, 'utf-8');

// Find and replace menu_response_4 template
const searchStr = 'menu_response_4: `';
const startIdx = content.indexOf(searchStr);

if (startIdx === -1) {
  console.log('menu_response_4 not found!');
  process.exit(1);
}

// Find the end of this template literal (`,` followed by newline)
const afterKey = startIdx + searchStr.length;
let backtickEnd = afterKey;
while (backtickEnd < content.length) {
  if (content[backtickEnd] === '`') {
    break;
  }
  backtickEnd++;
}

const oldValue = content.substring(startIdx, backtickEnd + 2); // include `, trailing
console.log('Old template (first 100 chars):', oldValue.substring(0, 100));

const newValue = `menu_response_4: \`🍔 *Carta Completa de {nombre_local}* 🔥\\n\\n📱 *¡Mirá nuestra carta interactiva con fotos!*\\n👉 {catalogo_url}\\n\\n_También podés elegir por acá:_\\n{catalogo_lista}\\n\\n👉 *Respondé con el NÚMERO de lo que querés pedir o escribí COMPRAR.*\``;

const newContent = content.substring(0, startIdx) + newValue + content.substring(backtickEnd + 2);
fs.writeFileSync(file, newContent, 'utf-8');
console.log('✅ menu_response_4 updated successfully!');
