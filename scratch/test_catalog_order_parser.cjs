const sample = `🍔 *Mi Pedido — ComandaFast*

• 2x Triple Bacon Cheese — $ 12.500
  + Extra Bacon
  → Medallón Smash
  📝 Sin cebolla
• 1x Papas Fritas Grandes — $ 3.500

💵 *Subtotal:* $ 16.000
🛵 *Delivery:* $ 1.500
💰 *TOTAL:* $ 17.500

🚀 *Tipo de entrega:* Delivery 🛵
👤 *Nombre:* Tincho
📍 *Dirección:* San Martin 450
📞 *Teléfono:* 3826451122

📝 *Aclaraciones:* Timbre blanco`;

function parseCatalogOrder(text) {
  const isCatalogOrder = (text.includes("Mi Pedido") || text.includes("Mi pedido")) && 
                         (text.includes("Subtotal:") || text.includes("TOTAL:"));
  if (!isCatalogOrder) return null;

  const itemRegex = /[•\*\-]?\s*(\d+)x\s+([^—\n]+?)\s*—\s*\$?\s*([\d\.,]+)/g;
  let match;
  const items = [];
  while ((match = itemRegex.exec(text)) !== null) {
    items.push({
      qty: parseInt(match[1], 10),
      name: match[2].trim(),
      price: parseInt(match[3].replace(/\D/g, ""), 10)
    });
  }

  const subMatch = text.match(/Subtotal[^\d\n]*([\d\.,]+)/i);
  const subtotal = subMatch ? parseInt(subMatch[1].replace(/\D/g, ""), 10) : 0;
  const delMatch = text.match(/Delivery[^\d\n]*([\d\.,]+)/i);
  const deliveryFee = delMatch ? parseInt(delMatch[1].replace(/\D/g, ""), 10) : 0;
  const totMatch = text.match(/\bTOTAL[^\d\n]*([\d\.,]+)/i);
  console.log('DEBUG totMatch:', totMatch);
  const total = totMatch ? parseInt(totMatch[1].replace(/\D/g, ""), 10) : (subtotal + deliveryFee);

  const nameMatch = text.match(/Nombre:\*?\s*([^\n]+)/i);
  const addrMatch = text.match(/Direcci[oó]n:\*?\s*([^\n]+)/i);
  const phoneMatch = text.match(/Tel[eé]fono:\*?\s*([^\n]+)/i);
  const typeMatch = text.match(/Tipo de entrega:\*?\s*([^\n]+)/i);
  const notesMatch = text.match(/Aclaraciones:\*?\s*([^\n]+)/i);

  const serviceType = (typeMatch && (typeMatch[1].toLowerCase().includes("llevar") || typeMatch[1].toLowerCase().includes("retiro"))) 
    ? 'local' 
    : 'delivery';

  return {
    items,
    subtotal,
    deliveryFee,
    total,
    customerName: nameMatch ? nameMatch[1].trim() : '',
    customerAddress: addrMatch ? addrMatch[1].trim() : '',
    customerPhone: phoneMatch ? phoneMatch[1].trim() : '',
    serviceType,
    notes: notesMatch ? notesMatch[1].trim() : ''
  };
}

const result = parseCatalogOrder(sample);
console.log('Result:', JSON.stringify(result, null, 2));
