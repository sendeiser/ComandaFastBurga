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
  getKitchenTicketHtml(order, settings) {
    const channelLabel = order.channel === 'whatsapp' ? '🛵 DELIVERY' :
                         order.channel === 'mesa' ? `🍽️ MESA #${order.tableNumber || 'S/N'}` :
                         '🛍️ MOSTRADOR';

    let itemsHtml = order.items.map(item => {
      let modsHtml = '';
      if (item.modifiers && item.modifiers.length > 0) {
        modsHtml = `<div style="font-size: 13px; font-weight: bold; margin-left: 8px; color: #000;">
          ${item.modifiers.map(m => `>> ${m}`).join('<br/>')}
        </div>`;
      }
      if (item.notes) {
        modsHtml += `<div style="font-size: 12px; font-weight: bold; margin-left: 8px; background: #eee; padding: 2px 4px; display: inline-block;">
          ⚠️ ${item.notes}
        </div>`;
      }
      return `
        <div style="margin-bottom: 6px; border-bottom: 1px dashed #666; padding-bottom: 4px;">
          <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900;">
            <span>[ ${item.qty}x ] ${item.name.toUpperCase()}</span>
          </div>
          ${modsHtml}
        </div>
      `;
    }).join('');

    return `
      <div style="font-family: 'JetBrains Mono', monospace, sans-serif; width: 220px; padding: 4px; color: #000; background: #fff; line-height: 1.25; font-size: 12px;">
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
        <!-- Avance para barra de corte manual de Xprinter -->
        <div style="height: 30px;"></div>
      </div>
    `;
  },

  // 6. GENERAR TICKET CLIENTE (58mm / 32 columnas)
  getCustomerTicketHtml(order, settings) {
    const channelLabel = order.channel === 'whatsapp' ? 'DELIVERY' :
                         order.channel === 'mesa' ? `MESA #${order.tableNumber || 'S/N'}` :
                         'MOSTRADOR';

    let itemsHtml = order.items.map(item => {
      const itemTotal = item.unitPrice * item.qty;
      return `
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;">
          <span>${item.qty}x ${item.name}</span>
          <span style="font-weight: bold;">${this.formatCurrency(itemTotal)}</span>
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
          <div>Paga: ${this.formatCurrency(order.cashPaid)} | Vuelto: <strong>${this.formatCurrency(order.cashChange)}</strong></div>
        ` : ''}
      </div>
    `;

    let customerInfo = '';
    if (order.channel === 'whatsapp' || order.customer?.name || order.customer?.address) {
      customerInfo = `
        <div style="border-top: 1px dashed #666; margin: 4px 0; padding-top: 4px; font-size: 11px;">
          ${order.customer?.name ? `<div>Cliente: ${order.customer.name}</div>` : ''}
          ${order.customer?.address ? `<div>Dir: <strong>${order.customer.address}</strong></div>` : ''}
          ${order.customer?.phone ? `<div>Tel: ${order.customer.phone}</div>` : ''}
        </div>
      `;
    }

    return `
      <div style="font-family: 'JetBrains Mono', monospace, sans-serif; width: 220px; padding: 4px; color: #000; background: #fff; line-height: 1.25; font-size: 12px;">
        <div style="text-align: center; border-bottom: 1px dashed #666; padding-bottom: 4px; margin-bottom: 4px;">
          <div style="font-size: 15px; font-weight: 900;">${settings.businessName}</div>
          <div style="font-size: 10px;">${settings.slogan}</div>
          <div style="font-size: 10px;">${settings.address}</div>
          <div style="font-size: 10px;">Tel: ${settings.phone}</div>
          ${settings.alias ? `<div style="font-size: 10px; font-weight: bold;">Alias: ${settings.alias}</div>` : ''}
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
          ¡Gracias por su compra!<br/>
          Xprinter XP-58IIH
        </div>
        <!-- Avance de papel para corte manual -->
        <div style="height: 35px;"></div>
      </div>
    `;
  },

  // 7. Impresión de Prueba Xprinter XP-58IIH
  printTestTicket(width = '58mm', settings) {
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

    const kitchenHtml = this.getKitchenTicketHtml(mockOrder, { ...settings, ticketWidth: '58mm' });
    const customerHtml = this.getCustomerTicketHtml(mockOrder, { ...settings, ticketWidth: '58mm' });

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
