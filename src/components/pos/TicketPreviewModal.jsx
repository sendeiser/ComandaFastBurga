import React, { useState } from 'react';
import { X, Printer, ChefHat, Receipt } from 'lucide-react';
import { printerService } from '../../services/printerService';

export default function TicketPreviewModal({ order, settings, onClose }) {
  const [ticketTab, setTicketTab] = useState('both'); // 'kitchen' | 'customer' | 'both'

  if (!order) return null;

  const kitchenHtml = printerService.getKitchenTicketHtml(order, settings);
  const customerHtml = printerService.getCustomerTicketHtml(order, settings);

  const handlePrintKitchen = () => {
    printerService.printHtml(kitchenHtml);
  };

  const handlePrintCustomer = () => {
    printerService.printHtml(customerHtml);
  };

  const handlePrintBoth = () => {
    printerService.printHtml(`
      ${kitchenHtml}
      <div style="page-break-after: always; height: 20px;"></div>
      ${customerHtml}
    `);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '780px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Printer size={24} style={{ color: 'var(--accent-amber)' }} />
            <span>Vista Previa de Impresión — Orden #{order.orderNumber}</span>
          </div>
          <button className="btn-close-modal" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Print Buttons Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className={`cat-pill-btn ${ticketTab === 'both' ? 'active' : ''}`}
              onClick={() => setTicketTab('both')}
            >
              Ambos Tickets
            </button>
            <button 
              className={`cat-pill-btn ${ticketTab === 'kitchen' ? 'active' : ''}`}
              onClick={() => setTicketTab('kitchen')}
            >
              <ChefHat size={14} /> Solo Cocina
            </button>
            <button 
              className={`cat-pill-btn ${ticketTab === 'customer' ? 'active' : ''}`}
              onClick={() => setTicketTab('customer')}
            >
              <Receipt size={14} /> Solo Cliente/Caja
            </button>
          </div>

          <button 
            className="btn-confirm-order"
            style={{ width: 'auto', padding: '0.5rem 1.25rem', fontSize: '0.95rem' }}
            onClick={ticketTab === 'kitchen' ? handlePrintKitchen : ticketTab === 'customer' ? handlePrintCustomer : handlePrintBoth}
          >
            <Printer size={18} />
            <span>Imprimir en Ticketera</span>
          </button>
        </div>

        {/* Ticket Previews Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: ticketTab === 'both' ? '1fr 1fr' : '1fr', gap: '1.5rem', maxHeight: '550px', overflowY: 'auto', padding: '0.5rem' }}>
          {(ticketTab === 'both' || ticketTab === 'kitchen') && (
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-orange)', marginBottom: '0.5rem', textAlign: 'center' }}>
                📄 TICKET DE COCINA (Sin Precios)
              </div>
              <div 
                className="receipt-paper"
                dangerouslySetInnerHTML={{ __html: kitchenHtml }}
              />
            </div>
          )}

          {(ticketTab === 'both' || ticketTab === 'customer') && (
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-emerald)', marginBottom: '0.5rem', textAlign: 'center' }}>
                🧾 TICKET DE CAJA / CLIENTE (Detallado)
              </div>
              <div 
                className="receipt-paper"
                dangerouslySetInnerHTML={{ __html: customerHtml }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
