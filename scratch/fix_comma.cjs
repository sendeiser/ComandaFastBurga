// Fix: Add missing comma after menu_response_4 in whatsappBotServer.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server', 'whatsappBotServer.js');
let content = fs.readFileSync(filePath, 'utf-8');

// Find the exact pattern: backtick + newline + spaces + menu_response_5 (without comma)
// The bug is: ...COMPRAR.*`\r\n  menu_response_5  (missing comma after backtick)
const regex = /(COMPRAR\.\*`)(\r?\n\s+menu_response_5:)/;
const match = content.match(regex);

if (match) {
  console.log('Found bug pattern at index:', match.index);
  console.log('Before fix (30 chars):', JSON.stringify(content.substring(match.index, match.index + match[0].length)));
  
  content = content.replace(regex, '$1,$2');
  fs.writeFileSync(filePath, content, 'utf-8');
  
  console.log('✅ Fixed: Added comma after menu_response_4');
  
  // Verify
  const verify = fs.readFileSync(filePath, 'utf-8');
  const verifyMatch = verify.match(regex);
  if (!verifyMatch) {
    console.log('✅ Verification passed: bug pattern no longer present');
  }
} else {
  // Check if already fixed
  if (content.includes("COMPRAR.*`,")) {
    console.log('✅ Already fixed!');
  } else {
    console.log('❌ Could not find the pattern');
    // Show what's around menu_response_4
    const idx = content.indexOf('menu_response_4');
    if (idx !== -1) {
      const end = content.indexOf('\n', idx);
      const nextLine = content.substring(end, end + 80);
      console.log('After menu_response_4 line:', JSON.stringify(nextLine));
    }
  }
}
