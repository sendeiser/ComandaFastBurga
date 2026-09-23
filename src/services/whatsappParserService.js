// =========================================================
// WHATSAPP SMART ORDER PARSER (NLP & REGEX)
// Convierte mensajes desestructurados de chat en pedidos cargados
// =========================================================

export const whatsappParserService = {
  parseMessage(text, availableProducts = []) {
    if (!text || typeof text !== 'string') return null;

    const raw = text.trim();
    const lines = raw.split(/\r?\n/);
    
    let detectedCustomer = {
      name: '',
      address: '',
      phone: '',
      notes: ''
    };

    let detectedPayment = 'efectivo';
    let transferConfirmed = false;
    let transferProof = '';
    let detectedItems = [];

    // 1. Detectar datos de entrega y cliente
    const addressMatch = raw.match(/(?:direcci[oó]n|env[ií]o|calle|domicilio|a|para)\s*:?\s*([A-Za-z0-9\s\.,°º]+?)(?:\n|$|,|pago|telefono|cel)/i);
    if (addressMatch) {
      detectedCustomer.address = addressMatch[1].trim();
    }

    const phoneMatch = raw.match(/(?:tel[eé]fono|cel(?:ular)?|wa|wpp|nro)\s*:?\s*([0-9\+\s\-]{7,20})/i);
    if (phoneMatch) {
      detectedCustomer.phone = phoneMatch[1].replace(/\s+/g, '').trim();
    }

    const nameMatch = raw.match(/(?:nombre|soy|de parte de|cliente)\s*:?\s*([A-Za-zÀ-ÿ\s]{3,30})/i);
    if (nameMatch) {
      detectedCustomer.name = nameMatch[1].trim();
    }

    // 2. Detectar Medio de Pago
    if (/transferencia|alias|mp|mercado\s*pago|cbu|cvu|deposito/i.test(raw)) {
      detectedPayment = 'transferencia';
      if (/comprobante|acreditad[ao]|adjunto|ya\s*te\s*transfer[ií]|pagado/i.test(raw)) {
        transferConfirmed = true;
      }
    } else if (/tarjeta|posnet|debito|credito/i.test(raw)) {
      detectedPayment = 'tarjeta';
    }

    // 3. Detectar Productos y Cantidades
    availableProducts.forEach(prod => {
      // Create flexible regex for product name (e.g. "doble cuarto", "papas cheddar")
      const baseName = prod.name.toLowerCase()
        .replace(/burger|hamburguesa|porci[oó]n|mega|combo|cl[aá]sica/gi, '')
        .trim();
      
      const searchTerms = [prod.name.toLowerCase()];
      if (baseName.length >= 4) searchTerms.push(baseName);

      searchTerms.forEach(term => {
        const regex = new RegExp(`(?:(\d+)\s*(?:x|de)?\s*)?${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
        const match = raw.match(regex);
        if (match) {
          const qty = parseInt(match[1] || '1', 10);
          
          // Check for modifiers in the surrounding text or global message
          let modifiers = [];
          if (/sin\s*cebolla/i.test(raw)) modifiers.push('Sin cebolla');
          if (/sin\s*tomate/i.test(raw)) modifiers.push('Sin tomate');
          if (/extra\s*cheddar|con\s*mucho\s*cheddar/i.test(raw)) modifiers.push('Extra Cheddar (+$800)');
          if (/extra\s*bacon|con\s*bacon/i.test(raw)) modifiers.push('Extra Bacon (+$900)');
          if (/bien\s*cocida/i.test(raw)) modifiers.push('Bien cocida');

          // Avoid duplicate product additions
          if (!detectedItems.some(i => i.productId === prod.id)) {
            detectedItems.push({
              productId: prod.id,
              name: prod.name,
              unitPrice: prod.price,
              qty: Math.max(1, qty),
              modifiers,
              notes: '',
              image: prod.image || '',
              emoji: prod.emoji || '🍔'
            });
          }
        }
      });
    });

    return {
      customer: detectedCustomer,
      paymentMethod: detectedPayment,
      transferConfirmed,
      transferProof,
      items: detectedItems,
      rawText: raw
    };
  }
};
