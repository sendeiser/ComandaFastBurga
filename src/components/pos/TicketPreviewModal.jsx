import React, { useState } from 'react';
import { X, Printer, ChefHat, Receipt, Palette, Sparkles } from 'lucide-react';
import { printerService } from '../../services/printerService';
import { storageService } from '../../services/storageService';

const THEMES = [
  { id: 'classic', label: '🏛️ Clásico', desc: '32 col estándar con líneas de puntos' },
  { id: 'modern', label: '✨ Moderno', desc: 'Líneas dobles y total en bloque negro invertido' },
  { id: 'minimal', label: '⚡ Minimal Eco', desc: 'Ultra-compacto, ahorra 40% de papel' },
  { id: 'street', label: '🍔 Street Food', desc: 'Letras grandes, emojis y mod destacadas' }
];

export default function TicketPreviewModal({ order, settings, onClose, onUpdateSettings }) {
  const [ticketTab, setTicketTab] = useState('both'); // 'kitchen' | 'customer' | 'both'
  const [selectedTheme, setSelectedTheme] = useState(settings?.ticketTheme || 'classic');

  if (!order) return null;

  const effectiveSettings = {
    ...settings,
    ticketTheme: selectedTheme
  };

  const handleSelectTheme = (themeId) => {
    setSelectedTheme(themeId);
    // Persist as new default theme
    const updated = { ...settings, ticketTheme: themeId };
    storageService.saveSettings(updated);
    if (onUpdateSettings) {
      onUpdateSettings(updated);
    }
  };

  const kitchenHtml = printerService.getKitchenTicketHtml(order, effectiveSettings);
  const customerHtml = printerService.getCustomerTicketHtml(order, effectiveSettings);

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
      <div className="modal-card" style={{ maxWidth: '820px', width: '95%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Printer size={22} style={{ color: 'var(--accent-amber)' }} />
            <span>Vista Previa & Temas de Impresión — Orden #{order.orderNumber}</span>
          </div>
          <button className="btn-close-modal" onClick={onClose}><X size={20} /></button>
        </div>

        {/* TICKET THEMES TOOLBAR */}
        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Palette size={15} style={{ color: 'var(--accent-amber)' }} />
              <span>Plantilla de Diseño Térmico:</span>
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-amber)', fontWeight: 700 }}>
              {THEMES.find(t => t.id === selectedTheme)?.desc}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
            {THEMES.map(theme => (
              <button
                key={theme.id}
                type="button"
                className={`cat-pill-btn ${selectedTheme === theme.id ? 'active' : ''}`}
                style={{ 
                  justifyContent: 'center', 
                  fontSize: '0.8rem', 
                  padding: '0.45rem 0.5rem',
                  height: 'auto',
                  borderWidth: selectedTheme === theme.id ? '2px' : '1px'
                }}
                onClick={() => handleSelectTheme(theme.id)}
              >
                <span>{theme.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Print & Filter Buttons Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button 
              type="button"
              className={`cat-pill-btn ${ticketTab === 'both' ? 'active' : ''}`}
              style={{ fontSize: '0.8rem', height: '34px', padding: '0.4rem 0.8rem' }}
              onClick={() => setTicketTab('both')}
            >
              Ambos Tickets
            </button>
            <button 
              type="button"
              className={`cat-pill-btn ${ticketTab === 'kitchen' ? 'active' : ''}`}
              style={{ fontSize: '0.8rem', height: '34px', padding: '0.4rem 0.8rem' }}
              onClick={() => setTicketTab('kitchen')}
            >
              <ChefHat size={14} /> Solo Cocina
            </button>
            <button 
              type="button"
              className={`cat-pill-btn ${ticketTab === 'customer' ? 'active' : ''}`}
              style={{ fontSize: '0.8rem', height: '34px', padding: '0.4rem 0.8rem' }}
              onClick={() => setTicketTab('customer')}
            >
              <Receipt size={14} /> Solo Cliente/Caja
            </button>
          </div>

          <button 
            type="button"
            className="btn-confirm-order"
            style={{ width: 'auto', padding: '0.5rem 1.25rem', fontSize: '0.9rem', height: '38px' }}
            onClick={ticketTab === 'kitchen' ? handlePrintKitchen : ticketTab === 'customer' ? handlePrintCustomer : handlePrintBoth}
          >
            <Printer size={16} />
            <span>Imprimir en Ticketera</span>
          </button>
        </div>

        {/* Ticket Previews Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: ticketTab === 'both' ? '1fr 1fr' : '1fr', gap: '1rem', maxHeight: '480px', overflowY: 'auto', padding: '0.5rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', marginTop: '0.5rem' }}>
          {(ticketTab === 'both' || ticketTab === 'kitchen') && (
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-orange)', marginBottom: '0.4rem', textAlign: 'center' }}>
                📄 TICKET DE COCINA ({THEMES.find(t => t.id === selectedTheme)?.label})
              </div>
              <div 
                className="receipt-paper"
                dangerouslySetInnerHTML={{ __html: kitchenHtml }}
              />
            </div>
          )}

          {(ticketTab === 'both' || ticketTab === 'customer') && (
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-emerald)', marginBottom: '0.4rem', textAlign: 'center' }}>
                🧾 TICKET DE CLIENTE ({THEMES.find(t => t.id === selectedTheme)?.label})
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
