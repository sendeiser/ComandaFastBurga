// =========================================================
// PRINTER SERVICE — CALIBRADO PARA XPRINTER XP-58IIH (58mm)
// Soporta: Web Bluetooth, Web Serial USB, ESC/POS y Diálogo Web
// =========================================================

let activeSerialPort = null;
let activeBluetoothCharacteristic = null;

export const printerService = {
  // Configuración física Xprinter XP-58IIH:
  // 58mm ancho -> 384 puntos -> 32 columnas (Font A) / 42 columnas (Font B)
  LINE_WIDTH: 32,

  formatCurrency(num) {
    return '$' + Number(num || 0).toLocaleString('es-AR');
  },

  formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  },

  formatDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  // Rellenar texto a 32 columnas para alineación perfecta en Xprinter
  padLine(leftText, rightText, width = 32) {
    const spaceCount = Math.max(1, width - leftText.length - rightText.length);
    return leftText + ' '.repeat(spaceCount) + rightText;
  },

  divider(char = '-', width = 32) {
    return char.repeat(width);
  },

  // 1. CONEXIÓN WIRELESS BLUETOOTH (Web Bluetooth API)
  async connectBluetooth() {
    if (!navigator.bluetooth) {
      alert('Tu navegador no tiene activado Web Bluetooth. Usa Google Chrome o Microsoft Edge.');
      return false;
    }
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Servicio estándar POS Bluetooth
          '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2'  // Xprinter custom
        ]
      });

      const server = await device.gatt.connect();
      // Buscar servicio de escritura
      const services = await server.getPrimaryServices();
      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            activeBluetoothCharacteristic = char;
            alert(`✅ Xprinter conectada por Bluetooth: ${device.name || 'XP-58IIH'}`);
            return true;
          }
        }
      }
      alert('Se conectó por Bluetooth pero no se encontró el canal de escritura térmica.');
      return false;
    } catch (e) {
      console.warn('Bluetooth connection error/cancel:', e);
      return false;
    }
  },

  // 2. CONEXIÓN DIRECTA USB (Web Serial API)
  async connectUsbSerial() {
    if (!('serial' in navigator)) {
      alert('Tu navegador no soporta Web Serial API. Usa Google Chrome o Microsoft Edge.');
      return false;
    }
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      activeSerialPort = port;
      alert('✅ Xprinter XP-58IIH conectada por USB con éxito.');
      return true;
    } catch (e) {
      console.warn('Serial connection cancel:', e);
      return false;
    }
  },

  // 3. ENVIAR BYTES BINARIOS ESC/POS DIRECTO AL HARDWARE
  async sendRawEscPos(bytes) {
    // A. Vía Bluetooth
    if (activeBluetoothCharacteristic) {
      try {
        // Enviar en fragmentos de 100 bytes (MTU Bluetooth)
        for (let i = 0; i < bytes.length; i += 100) {
          const chunk = bytes.slice(i, i + 100);
          await activeBluetoothCharacteristic.writeValue(chunk);
        }
        return true;
      } catch (e) {
        console.error('Error enviando a Bluetooth:', e);
      }
    }

    // B. Vía USB Serial
    if (activeSerialPort && activeSerialPort.writable) {
      try {
        const writer = activeSerialPort.writable.getWriter();
        await writer.write(bytes);
        writer.releaseLock();
        return true;
      } catch (e) {
        console.error('Error enviando a Serial:', e);
      }
    }

    return false;
  },

  // 4. DISPARAR APERTURA DE CAJÓN DE DINERO (RJ11 Xprinter)
  async kickCashDrawer(settings) {
    // ESC p 0 25 250 (Pulso 24V al puerto RJ11 de la XP-58IIH)
    const drawerCmd = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]);
    const sent = await this.sendRawEscPos(drawerCmd);
    if (!sent) {
      // Fallback al servidor local
      try {
        await fetch('http://localhost:3001/open-drawer', { method: 'POST' });
      } catch (e) {}
    }
    return true;
  },

  // 5. GENERAR TICKET COCINA (Optimizada para ancho 58mm / 32 columnas)

  // =========================================================
  // 5. GENERAR TICKET COCINA SEGÚN TEMA
  // =========================================================
  getKitchenTicketHtml(order, settings = {}) {
    const theme = settings?.ticketTheme || 'classic';
    switch (theme) {
      case 'modern':
        return this._renderModernKitchen(order, settings);
      case 'minimal':
        return this._renderMinimalKitchen(order, settings);
      case 'street':
        return this._renderStreetKitchen(order, settings);
      case 'classic':
      default:
        return this._renderClassicKitchen(order, settings);
    }
  },

  // =========================================================
  // 6. GENERAR TICKET CLIENTE / CAJA SEGÚN TEMA
  // =========================================================
  getCustomerTicketHtml(order, settings = {}) {
    const theme = settings?.ticketTheme || 'classic';
    switch (theme) {
      case 'modern':
        return this._renderModernCustomer(order, settings);
      case 'minimal':
        return this._renderMinimalCustomer(order, settings);
      case 'street':
        return this._renderStreetCustomer(order, settings);
      case 'classic':
      default:
        return this._renderClassicCustomer(order, settings);
    }
  },

  // ---------------------------------------------------------
  // TEMA 1: CLÁSICO (Estándar 32 Columnas)
  // ---------------------------------------------------------
  _renderClassicCustomer(order, settings = {}) {
    const width = settings?.ticketWidth === '80mm' ? '290px' : '220px';
    const channelLabel = order.channel === 'whatsapp' ? 'DELIVERY' :
                         order.channel === 'mesa' ? `MESA #${order.tableNumber || 'S/N'}` :
                         'MOSTRADOR';

    const itemsHtml = order.items.map(item => {
      const itemTotal = item.unitPrice * item.qty;
      let mods = '';
      if (item.modifiers && item.modifiers.length > 0) {
        mods = `<div style="font-size: 10px; color: #555; padding-left: 10px;">+ ${item.modifiers.join(', ')}</div>`;
      }
      let note = '';
      if (item.notes) {
        note = `<div style="font-size: 10px; font-style: italic; padding-left: 10px;">* Nota: ${item.notes}</div>`;
      }
      return `
        <div style="margin-bottom: 4px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px;">
            <span>${item.qty}x ${item.name}</span>
            <span style="font-weight: bold;">${this.formatCurrency(itemTotal)}</span>
          </div>
          ${mods}
          ${note}
        </div>
      `;
    }).join('');

    let paymentDetails = `
      <div style="font-size: 11px; margin-top: 4px;">
        <div>Pago: <strong>${order.paymentMethod?.toUpperCase()}</strong></div>
        ${order.paymentMethod === 'transferencia' ? `
          <div>Comp: <strong>${order.transferProof || 'Registrado'}</strong></div>
          <div>Estado: <strong>${order.transferConfirmed ? '✅ ACREDITADA' : '⏳ PENDIENTE'}</strong></div>
        ` : ''}
        ${order.cashPaid ? `
          <div>Paga con: ${this.formatCurrency(order.cashPaid)} | Vuelto: <strong>${this.formatCurrency(order.cashChange)}</strong></div>
        ` : ''}
      </div>
    `;

    let customerInfo = '';
    if (settings.ticketShowCustomer !== false && (order.channel === 'whatsapp' || order.customer?.name || order.customer?.address)) {
      customerInfo = `
        <div style="border-top: 1px dashed #666; margin: 4px 0; padding-top: 4px; font-size: 11px;">
          ${order.customer?.name ? `<div>Cliente: <strong>${order.customer.name}</strong></div>` : ''}
          ${order.customer?.address ? `<div>Dir: <strong>${order.customer.address}</strong></div>` : ''}
          ${order.customer?.phone ? `<div>Tel: ${order.customer.phone}</div>` : ''}
          ${order.customer?.notes ? `<div>Obs: <em>${order.customer.notes}</em></div>` : ''}
        </div>
      `;
    }

    const footer = (settings.ticketCustomFooter || '¡Gracias por su compra!\nXprinter XP-58IIH')
      .replace(/\n/g, '<br/>');

    return `
      <div style="font-family: 'JetBrains Mono', monospace, sans-serif; width: ${width}; padding: 4px; color: #000; background: #fff; line-height: 1.25; font-size: 12px; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 1px dashed #666; padding-bottom: 4px; margin-bottom: 4px;">
          <div style="font-size: 15px; font-weight: 900;">${settings.businessName || 'COMANDALOCAL'}</div>
          ${settings.ticketShowSlogan !== false && settings.slogan ? `<div style="font-size: 10px;">${settings.slogan}</div>` : ''}
          ${settings.ticketShowAddress !== false && settings.address ? `<div style="font-size: 10px;">${settings.address}</div>` : ''}
          ${settings.ticketShowPhone !== false && settings.phone ? `<div style="font-size: 10px;">Tel: ${settings.phone}</div>` : ''}
          ${settings.ticketShowAlias !== false && settings.alias ? `<div style="font-size: 10px; font-weight: bold;">Alias: ${settings.alias}</div>` : ''}
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin-bottom: 2px;">
          <span>ORDEN #${order.orderNumber}</span>
          <span>${channelLabel}</span>
        </div>
        <div style="font-size: 10px; color: #444; margin-bottom: 4px;">
          ${this.formatDate(order.createdAt)} ${this.formatTime(order.createdAt)}
        </div>

        <div style="border-top: 1px dashed #666; margin: 3px 0;"></div>
        ${itemsHtml}
        <div style="border-top: 1px dashed #666; margin: 3px 0;"></div>

        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span>Subtotal:</span>
          <span>${this.formatCurrency(order.subtotal)}</span>
        </div>
        ${order.deliveryFee > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span>Envío:</span>
            <span>${this.formatCurrency(order.deliveryFee)}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; margin-top: 3px; border-top: 1px solid #000; padding-top: 3px;">
          <span>TOTAL:</span>
          <span>${this.formatCurrency(order.total)}</span>
        </div>

        ${paymentDetails}
        ${customerInfo}

        <div style="text-align: center; border-top: 1px dashed #666; margin-top: 6px; padding-top: 4px; font-size: 10px;">
          ${footer}
        </div>
        <div style="height: 35px;"></div>
      </div>
    `;
  },

  _renderClassicKitchen(order, settings = {}) {
    const width = settings?.ticketWidth === '80mm' ? '290px' : '220px';
    const channelLabel = order.channel === 'whatsapp' ? 'DELIVERY' :
                         order.channel === 'mesa' ? `MESA #${order.tableNumber || 'S/N'}` :
                         'MOSTRADOR';

    const itemsHtml = order.items.map(item => `
      <div style="margin-bottom: 6px; border-bottom: 1px dotted #ccc; padding-bottom: 4px;">
        <div style="font-size: 14px; font-weight: 900;">
          [ ${item.qty} ] ${item.name}
        </div>
        ${item.modifiers && item.modifiers.length > 0 ? `
          <div style="font-size: 11px; font-weight: bold; margin-left: 12px; color: #111;">
            >> ${item.modifiers.join(' | ')}
          </div>
        ` : ''}
        ${item.notes ? `
          <div style="font-size: 11px; font-weight: 900; background: #eee; padding: 2px 4px; margin-top: 2px; margin-left: 8px;">
            ! ${item.notes}
          </div>
        ` : ''}
      </div>
    `).join('');

    return `
      <div style="font-family: 'JetBrains Mono', monospace, sans-serif; width: ${width}; padding: 4px; color: #000; background: #fff; line-height: 1.25; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px;">
          <div style="font-size: 16px; font-weight: 900;">*** COCINA ***</div>
          <div style="font-size: 20px; font-weight: 900; margin: 2px 0;">ORDEN #${order.orderNumber}</div>
          <div style="font-size: 13px; font-weight: 900;">${channelLabel}</div>
          <div style="font-size: 10px;">${this.formatDate(order.createdAt)} - ${this.formatTime(order.createdAt)}</div>
        </div>

        ${order.customer?.name ? `<div style="font-size: 11px; font-weight: bold;">Cliente: ${order.customer.name}</div>` : ''}
        ${order.customer?.notes ? `<div style="font-size: 11px; font-weight: bold; border: 1px solid #000; padding: 2px 4px; margin: 4px 0;">Obs: ${order.customer.notes}</div>` : ''}

        <div style="border-top: 1px solid #000; margin: 4px 0;"></div>
        ${itemsHtml}
        <div style="border-top: 2px solid #000; padding-top: 4px; text-align: center; font-size: 12px; font-weight: 900;">
          TOTAL PRODUCTOS: ${order.items.reduce((acc, i) => acc + i.qty, 0)}
        </div>
        <div style="height: 30px;"></div>
      </div>
    `;
  },

  // ---------------------------------------------------------
  // TEMA 2: MODERNO / GOURMET (Bloque Invertido & Marco Doble)
  // ---------------------------------------------------------
  _renderModernCustomer(order, settings = {}) {
    const width = settings?.ticketWidth === '80mm' ? '290px' : '220px';
    const channelLabel = order.channel === 'whatsapp' ? 'DELIVERY' :
                         order.channel === 'mesa' ? `MESA #${order.tableNumber || 'S/N'}` :
                         'MOSTRADOR';

    const itemsHtml = order.items.map(item => {
      const itemTotal = item.unitPrice * item.qty;
      let mods = '';
      if (item.modifiers && item.modifiers.length > 0) {
        mods = `<div style="font-size: 10px; color: #444; padding-left: 20px;">└ ${item.modifiers.join(', ')}</div>`;
      }
      let note = '';
      if (item.notes) {
        note = `<div style="font-size: 10px; color: #b45309; padding-left: 20px; font-weight: 600;">★ ${item.notes}</div>`;
      }
      return `
        <div style="margin-bottom: 5px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 12px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="background: #000; color: #fff; font-size: 10px; font-weight: 900; padding: 1px 5px; border-radius: 3px;">${item.qty}</span>
              <span style="font-weight: 700;">${item.name}</span>
            </div>
            <span style="font-family: monospace; font-weight: 800; font-size: 12px;">${this.formatCurrency(itemTotal)}</span>
          </div>
          ${mods}
          ${note}
        </div>
      `;
    }).join('');

    const footer = (settings.ticketCustomFooter || '¡Gracias por su compra!\nComandaFast Gourmet')
      .replace(/\n/g, '<br/>');

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; width: ${width}; padding: 6px; color: #000; background: #fff; line-height: 1.3; font-size: 12px; margin: 0 auto;">
        {/* Header Gourmet */}
        <div style="text-align: center; margin-bottom: 6px;">
          <div style="font-size: 16px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">${settings.businessName || 'COMANDALOCAL'}</div>
          ${settings.ticketShowSlogan !== false && settings.slogan ? `<div style="font-size: 10px; font-style: italic; color: #333;">${settings.slogan}</div>` : ''}
          ${settings.ticketShowAddress !== false && settings.address ? `<div style="font-size: 10px; color: #444;">${settings.address}</div>` : ''}
          ${settings.ticketShowPhone !== false && settings.phone ? `<div style="font-size: 10px; font-weight: 600;">Tel: ${settings.phone}</div>` : ''}
          ${settings.ticketShowAlias !== false && settings.alias ? `<div style="font-size: 10px; font-weight: bold; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; display: inline-block; margin-top: 2px;">Alias: ${settings.alias}</div>` : ''}
        </div>

        {/* Order Badge Box */}
        <div style="border: 2px solid #000; border-radius: 4px; padding: 4px 6px; text-align: center; margin: 6px 0;">
          <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.5px;">ORDEN #${order.orderNumber}</div>
          <div style="font-size: 11px; font-weight: 800; background: #eee; padding: 2px 0; border-radius: 2px; margin-top: 2px;">${channelLabel}</div>
          <div style="font-size: 9px; color: #555; margin-top: 2px;">${this.formatDate(order.createdAt)} • ${this.formatTime(order.createdAt)}</div>
        </div>

        {/* Items */}
        <div style="border-top: 2px solid #000; border-bottom: 1px solid #000; padding: 6px 0; margin: 6px 0;">
          ${itemsHtml}
        </div>

        {/* Subtotal breakdown */}
        <div style="font-size: 11px; display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span style="color: #444;">Subtotal:</span>
          <span style="font-family: monospace; font-weight: 700;">${this.formatCurrency(order.subtotal)}</span>
        </div>
        ${order.deliveryFee > 0 ? `
          <div style="font-size: 11px; display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #444;">Costo de Envío:</span>
            <span style="font-family: monospace; font-weight: 700;">${this.formatCurrency(order.deliveryFee)}</span>
          </div>
        ` : ''}

        {/* INVERTED BLACK BOX TOTAL */}
        <div style="background: #000; color: #fff; padding: 6px 8px; border-radius: 3px; display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
          <span style="font-size: 13px; font-weight: 900; letter-spacing: 0.5px;">TOTAL A PAGAR</span>
          <span style="font-size: 16px; font-weight: 900; font-family: monospace;">${this.formatCurrency(order.total)}</span>
        </div>

        {/* Payment & Customer Details */}
        <div style="border: 1px solid #000; border-radius: 4px; padding: 5px 6px; margin-top: 6px; font-size: 11px;">
          <div>Método de Pago: <strong>${order.paymentMethod?.toUpperCase()}</strong></div>
          ${order.paymentMethod === 'transferencia' ? `
            <div>Comprobante: <strong>${order.transferProof || 'Registrado'}</strong></div>
            <div>Acreditación: <strong>${order.transferConfirmed ? '✅ CONFIRMADA' : '⏳ PENDIENTE'}</strong></div>
          ` : ''}
          ${order.cashPaid ? `
            <div>Paga con: ${this.formatCurrency(order.cashPaid)} | Vuelto: <strong>${this.formatCurrency(order.cashChange)}</strong></div>
          ` : ''}

          ${settings.ticketShowCustomer !== false && (order.customer?.name || order.customer?.address) ? `
            <div style="border-top: 1px dotted #888; margin-top: 4px; padding-top: 4px;">
              ${order.customer?.name ? `<div>Cliente: <strong>${order.customer.name}</strong></div>` : ''}
              ${order.customer?.address ? `<div>Entrega: <strong>${order.customer.address}</strong></div>` : ''}
              ${order.customer?.phone ? `<div>Tel: ${order.customer.phone}</div>` : ''}
            </div>
          ` : ''}
        </div>

        <div style="text-align: center; margin-top: 8px; font-size: 10px; color: #333;">
          <div style="letter-spacing: 2px; font-size: 11px;">★ ★ ★</div>
          ${footer}
        </div>
        <div style="height: 35px;"></div>
      </div>
    `;
  },

  _renderModernKitchen(order, settings = {}) {
    const width = settings?.ticketWidth === '80mm' ? '290px' : '220px';
    const channelLabel = order.channel === 'whatsapp' ? 'DELIVERY' :
                         order.channel === 'mesa' ? `MESA #${order.tableNumber || 'S/N'}` :
                         'MOSTRADOR';

    const itemsHtml = order.items.map(item => `
      <div style="margin-bottom: 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="background: #000; color: #fff; font-size: 13px; font-weight: 900; padding: 2px 6px; border-radius: 3px;">
            ${item.qty}
          </span>
          <span style="font-size: 14px; font-weight: 900;">${item.name}</span>
        </div>
        ${item.modifiers && item.modifiers.length > 0 ? `
          <div style="font-size: 11px; font-weight: 800; color: #000; margin-left: 28px; margin-top: 2px;">
            ◆ ${item.modifiers.join(' / ')}
          </div>
        ` : ''}
        ${item.notes ? `
          <div style="font-size: 11px; font-weight: 900; border-left: 3px solid #000; padding-left: 6px; margin-left: 28px; margin-top: 2px; background: #f3f4f6;">
            Nota: ${item.notes}
          </div>
        ` : ''}
      </div>
    `).join('');

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; width: ${width}; padding: 6px; color: #000; background: #fff; line-height: 1.3; margin: 0 auto;">
        <div style="border: 2px solid #000; border-radius: 4px; padding: 6px; text-align: center; margin-bottom: 6px;">
          <div style="font-size: 13px; font-weight: 900; letter-spacing: 1px;">COMANDA DE COCINA</div>
          <div style="font-size: 22px; font-weight: 900; margin: 2px 0;">ORDEN #${order.orderNumber}</div>
          <div style="font-size: 12px; font-weight: 900; background: #000; color: #fff; padding: 2px 0; border-radius: 2px;">
            ${channelLabel}
          </div>
          <div style="font-size: 10px; color: #555; margin-top: 3px;">${this.formatTime(order.createdAt)} hs</div>
        </div>

        ${order.customer?.name ? `<div style="font-size: 11px; font-weight: 800;">Cliente: ${order.customer.name}</div>` : ''}
        ${order.customer?.notes ? `<div style="font-size: 11px; font-weight: 900; border: 2px solid #000; padding: 3px 5px; margin: 4px 0; background: #fffbe6;">OBSERVACIÓN: ${order.customer.notes}</div>` : ''}

        <div style="border-top: 2px solid #000; margin: 6px 0;"></div>
        ${itemsHtml}
        <div style="border-top: 2px solid #000; padding-top: 4px; text-align: center; font-size: 12px; font-weight: 900;">
          TOTAL ITEMS: ${order.items.reduce((acc, i) => acc + i.qty, 0)}
        </div>
        <div style="height: 30px;"></div>
      </div>
    `;
  },

  // ---------------------------------------------------------
  // TEMA 3: MINIMALISTA / ECO (Ahorro Máximo de Papel)
  // ---------------------------------------------------------
  _renderMinimalCustomer(order, settings = {}) {
    const width = settings?.ticketWidth === '80mm' ? '280px' : '210px';
    const channelLabel = order.channel === 'whatsapp' ? 'DELIV' :
                         order.channel === 'mesa' ? `MESA #${order.tableNumber || 'S/N'}` :
                         'MOSTR';

    const itemsHtml = order.items.map(item => `
      <div style="display: flex; justify-content: space-between; font-size: 11px;">
        <span>${item.qty}x ${item.name}${item.modifiers?.length ? ` (${item.modifiers.join(',')})` : ''}</span>
        <span>${this.formatCurrency(item.unitPrice * item.qty)}</span>
      </div>
    `).join('');

    return `
      <div style="font-family: 'Courier New', monospace; width: ${width}; padding: 2px; color: #000; background: #fff; line-height: 1.15; font-size: 11px; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 1px dotted #000; padding-bottom: 2px; margin-bottom: 2px;">
          <strong>${settings.businessName || 'COMANDALOCAL'}</strong>
          <div>ORDEN #${order.orderNumber} • ${channelLabel} • ${this.formatTime(order.createdAt)}</div>
        </div>

        ${itemsHtml}

        <div style="border-top: 1px dotted #000; margin: 2px 0;"></div>
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span>Sub: ${this.formatCurrency(order.subtotal)}${order.deliveryFee ? ` | Env: ${this.formatCurrency(order.deliveryFee)}` : ''}</span>
          <strong>TOT: ${this.formatCurrency(order.total)}</strong>
        </div>

        <div style="font-size: 10px; margin-top: 2px;">
          Pago: ${order.paymentMethod?.toUpperCase()}
          ${order.customer?.name ? ` • ${order.customer.name}` : ''}
          ${order.customer?.address ? ` • ${order.customer.address}` : ''}
        </div>
        <div style="text-align: center; font-size: 9px; margin-top: 3px; border-top: 1px dotted #ccc;">
          ¡Gracias!
        </div>
        {/* Avance ultracorto para ahorrar papel */}
        <div style="height: 18px;"></div>
      </div>
    `;
  },

  _renderMinimalKitchen(order, settings = {}) {
    const width = settings?.ticketWidth === '80mm' ? '280px' : '210px';
    const channelLabel = order.channel === 'whatsapp' ? 'DELIV' :
                         order.channel === 'mesa' ? `MESA #${order.tableNumber || 'S/N'}` :
                         'MOSTR';

    const itemsHtml = order.items.map(item => `
      <div style="font-size: 12px; font-weight: bold; margin-bottom: 2px;">
        ${item.qty}x ${item.name}
        ${item.modifiers?.length ? `<span style="font-size: 10px; font-weight: normal;"> [${item.modifiers.join(',')}]</span>` : ''}
        ${item.notes ? `<div style="font-size: 10px; font-style: italic;">Obs: ${item.notes}</div>` : ''}
      </div>
    `).join('');

    return `
      <div style="font-family: 'Courier New', monospace; width: ${width}; padding: 2px; color: #000; background: #fff; line-height: 1.15; font-size: 11px; margin: 0 auto;">
        <div style="border-bottom: 2px solid #000; padding-bottom: 2px; margin-bottom: 3px; font-weight: 900; font-size: 14px;">
          COCINA #${order.orderNumber} (${channelLabel}) ${this.formatTime(order.createdAt)}
        </div>
        ${order.customer?.notes ? `<div style="font-size: 11px; font-weight: bold; margin-bottom: 3px;">! ${order.customer.notes}</div>` : ''}
        ${itemsHtml}
        <div style="border-top: 1px solid #000; margin-top: 2px; font-size: 10px;">Total items: ${order.items.reduce((a,i)=>a+i.qty,0)}</div>
        <div style="height: 18px;"></div>
      </div>
    `;
  },

  // ---------------------------------------------------------
  // TEMA 4: BURGER & STREET FOOD (Audaz / Resaltado)
  // ---------------------------------------------------------
  _renderStreetCustomer(order, settings = {}) {
    const width = settings?.ticketWidth === '80mm' ? '290px' : '220px';
    const channelLabel = order.channel === 'whatsapp' ? '🛵 WHATSAPP DELIVERY' :
                         order.channel === 'mesa' ? `🍽️ MESA LOCAL #${order.tableNumber || 'S/N'}` :
                         '🛍️ RETIRO EN MOSTRADOR';

    const itemsHtml = order.items.map(item => {
      const itemTotal = item.unitPrice * item.qty;
      let mods = '';
      if (item.modifiers && item.modifiers.length > 0) {
        mods = `<div style="border-left: 3px solid #000; padding-left: 6px; margin: 2px 0 2px 14px; font-size: 10px; font-weight: 800;">👉 ${item.modifiers.join(' / ')}</div>`;
      }
      let note = '';
      if (item.notes) {
        note = `<div style="background: #000; color: #fff; font-size: 10px; font-weight: 800; padding: 1px 5px; margin: 2px 0 2px 14px; border-radius: 2px;">⚠️ NOTA: ${item.notes}</div>`;
      }
      return `
        <div style="margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 900;">
            <span>${item.qty}X ${item.name.toUpperCase()}</span>
            <span>${this.formatCurrency(itemTotal)}</span>
          </div>
          ${mods}
          ${note}
        </div>
      `;
    }).join('');

    const footer = (settings.ticketCustomFooter || '🍔 ¡GRACIAS POR ELEGIRNOS! 🍔\nSeguinos en Instagram')
      .replace(/\n/g, '<br/>');

    return `
      <div style="font-family: 'Arial Black', Impact, sans-serif, monospace; width: ${width}; padding: 4px; color: #000; background: #fff; line-height: 1.25; font-size: 12px; margin: 0 auto;">
        {/* Header Street */}
        <div style="text-align: center; margin-bottom: 4px;">
          <div style="font-size: 18px; font-weight: 900; text-transform: uppercase;">🍔 ${settings.businessName || 'BURGER & CO.'} 🍔</div>
          ${settings.ticketShowSlogan !== false && settings.slogan ? `<div style="font-size: 10px; font-weight: bold; letter-spacing: 0.5px;">${settings.slogan.toUpperCase()}</div>` : ''}
          ${settings.ticketShowAddress !== false && settings.address ? `<div style="font-size: 10px; font-weight: normal;">${settings.address}</div>` : ''}
          ${settings.ticketShowPhone !== false && settings.phone ? `<div style="font-size: 11px; font-weight: 900;">WSP: ${settings.phone}</div>` : ''}
          ${settings.ticketShowAlias !== false && settings.alias ? `<div style="font-size: 10px; font-weight: 900; border: 1px solid #000; padding: 2px; margin-top: 2px;">ALIAS: ${settings.alias}</div>` : ''}
        </div>

        {/* Order Banner */}
        <div style="background: #000; color: #fff; text-align: center; padding: 4px 0; margin: 4px 0;">
          <div style="font-size: 18px; font-weight: 900; letter-spacing: 1px;">>> ORDEN #${order.orderNumber} <<</div>
        </div>
        <div style="text-align: center; font-size: 11px; font-weight: 900; margin-bottom: 4px;">
          ${channelLabel}
        </div>
        <div style="font-size: 10px; text-align: center; margin-bottom: 6px;">
          ${this.formatDate(order.createdAt)} | ${this.formatTime(order.createdAt)} HS
        </div>

        <div style="border-top: 3px solid #000; border-bottom: 3px solid #000; padding: 6px 0; margin: 4px 0;">
          ${itemsHtml}
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold;">
          <span>SUBTOTAL:</span>
          <span>${this.formatCurrency(order.subtotal)}</span>
        </div>
        ${order.deliveryFee > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold;">
            <span>COSTO ENVÍO:</span>
            <span>${this.formatCurrency(order.deliveryFee)}</span>
          </div>
        ` : ''}

        <div style="border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 4px 0; margin: 4px 0; display: flex; justify-content: space-between; font-size: 17px; font-weight: 900;">
          <span>TOTAL:</span>
          <span>${this.formatCurrency(order.total)}</span>
        </div>

        <div style="font-size: 11px; font-weight: bold; margin-top: 4px;">
          <div>PAGO: ${order.paymentMethod?.toUpperCase()}</div>
          ${order.paymentMethod === 'transferencia' ? `
            <div>COMP: ${order.transferProof || 'REGISTRADO'} (${order.transferConfirmed ? 'ACREDITADO' : 'PENDIENTE'})</div>
          ` : ''}
          ${order.cashPaid ? `
            <div>PAGA: ${this.formatCurrency(order.cashPaid)} | VUELTO: ${this.formatCurrency(order.cashChange)}</div>
          ` : ''}
        </div>

        ${settings.ticketShowCustomer !== false && (order.customer?.name || order.customer?.address) ? `
          <div style="border: 2px solid #000; padding: 4px; margin-top: 6px; font-size: 11px; font-weight: bold;">
            ${order.customer?.name ? `<div>👤 CLIENTE: ${order.customer.name.toUpperCase()}</div>` : ''}
            ${order.customer?.address ? `<div>🏠 ENTREGA: ${order.customer.address.toUpperCase()}</div>` : ''}
            ${order.customer?.phone ? `<div>📞 TEL: ${order.customer.phone}</div>` : ''}
            ${order.customer?.notes ? `<div>📝 OBS: ${order.customer.notes}</div>` : ''}
          </div>
        ` : ''}

        <div style="text-align: center; margin-top: 8px; font-size: 11px; font-weight: 900;">
          ${footer}
        </div>
        <div style="height: 35px;"></div>
      </div>
    `;
  },

  _renderStreetKitchen(order, settings = {}) {
    const width = settings?.ticketWidth === '80mm' ? '290px' : '220px';
    const channelLabel = order.channel === 'whatsapp' ? '🛵 DELIVERY' :
                         order.channel === 'mesa' ? `🍽️ MESA #${order.tableNumber || 'S/N'}` :
                         '🛍️ RETIRO';

    const itemsHtml = order.items.map(item => `
      <div style="margin-bottom: 8px; border-bottom: 2px dashed #000; padding-bottom: 6px;">
        <div style="font-size: 16px; font-weight: 900;">
          [ ${item.qty} ] ${item.name.toUpperCase()}
        </div>
        ${item.modifiers && item.modifiers.length > 0 ? `
          <div style="background: #000; color: #fff; font-size: 12px; font-weight: 900; padding: 2px 6px; margin-top: 3px; display: inline-block;">
            👉 ${item.modifiers.join(' // ')}
          </div>
        ` : ''}
        ${item.notes ? `
          <div style="border: 2px solid #000; font-size: 12px; font-weight: 900; padding: 2px 4px; margin-top: 3px;">
            ⚠️ NOTA: ${item.notes}
          </div>
        ` : ''}
      </div>
    `).join('');

    return `
      <div style="font-family: 'Arial Black', Impact, sans-serif, monospace; width: ${width}; padding: 4px; color: #000; background: #fff; line-height: 1.25; margin: 0 auto;">
        <div style="background: #000; color: #fff; text-align: center; padding: 4px 0;">
          <div style="font-size: 14px; font-weight: 900;">🔥 COMANDA DE COCINA 🔥</div>
          <div style="font-size: 26px; font-weight: 900; letter-spacing: 1px;">#${order.orderNumber}</div>
        </div>
        <div style="text-align: center; font-size: 14px; font-weight: 900; margin: 4px 0;">
          ${channelLabel}
        </div>
        <div style="text-align: center; font-size: 11px; margin-bottom: 6px;">
          HORA: ${this.formatTime(order.createdAt)} HS
        </div>

        ${order.customer?.name ? `<div style="font-size: 12px; font-weight: 900; margin-bottom: 4px;">CLIENTE: ${order.customer.name.toUpperCase()}</div>` : ''}
        ${order.customer?.notes ? `<div style="background: #000; color: #fff; font-size: 12px; font-weight: 900; padding: 4px; margin-bottom: 6px;">OBS: ${order.customer.notes}</div>` : ''}

        <div style="border-top: 3px solid #000; margin: 4px 0;"></div>
        ${itemsHtml}

        <div style="text-align: center; font-size: 14px; font-weight: 900; margin-top: 4px;">
          TOTAL ITEMS: ${order.items.reduce((a,i)=>a+i.qty,0)}
        </div>
        <div style="height: 30px;"></div>
      </div>
    `;
  },

  // 7. Impresión de Prueba Xprinter XP-58IIH
  printTestTicket(width = '58mm', settings = {}) {
    const mockOrder = {
      orderNumber: 101,
      channel: 'whatsapp',
      createdAt: new Date().toISOString(),
      customer: {
        name: 'Cliente Prueba Xprinter',
        address: 'Av. San Martín 450',
        phone: '+54 9 3826 45-6789',
        notes: 'Timbre blanco'
      },
      items: [
        { name: 'Doble Cuarto Cheddar', unitPrice: 8200, qty: 2, modifiers: ['Sin cebolla', 'Extra Bacon (+$900)'] },
        { name: 'Papas Cheddar & Bacon', unitPrice: 4900, qty: 1, modifiers: ['Sin verdeo'] },
        { name: 'Coca Cola 500ml', unitPrice: 2000, qty: 2, modifiers: ['Fría'] }
      ],
      subtotal: 23300,
      deliveryFee: 1000,
      total: 24300,
      paymentMethod: 'efectivo',
      cashPaid: 25000,
      cashChange: 700
    };

    const effectiveSettings = { ...settings, ticketWidth: width || settings?.ticketWidth || '58mm' };
    const kitchenHtml = this.getKitchenTicketHtml(mockOrder, effectiveSettings);
    const customerHtml = this.getCustomerTicketHtml(mockOrder, effectiveSettings);

    this.printHtml(`
      ${kitchenHtml}
      <div style="page-break-after: always; height: 16px;"></div>
      ${customerHtml}
    `);
  },

  // 8. Lanzar Ventana de Impresión de Windows
  printHtml(html) {
    const printWindow = window.open('', '_blank', 'width=380,height=560');
    if (!printWindow) {
      alert('Habilita las ventanas emergentes (popups) para imprimir en tu Xprinter.');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Xprinter XP-58IIH Print</title>
          <style>
            @page {
              margin: 0;
              size: 58mm auto;
            }
            body { 
              margin: 0; 
              padding: 0; 
              background: #fff; 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
            }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          ${html}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 600);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }
};

