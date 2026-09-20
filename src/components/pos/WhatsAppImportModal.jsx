import React, { useState } from 'react';
import { X, MessageSquare, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { whatsappParserService } from '../../services/whatsappParserService';

export default function WhatsAppImportModal({ 
  products, 
  onApplyOrder, 
  onClose 
}) {
  const [inputText, setInputText] = useState('');
  const [parsedResult, setParsedResult] = useState(null);

  const handleParse = () => {
    if (!inputText.trim()) return;
    const result = whatsappParserService.parseMessage(inputText, products);
    setParsedResult(result);
  };

  const handleConfirmImport = () => {
    if (!parsedResult) return;
    onApplyOrder(parsedResult);
    onClose();
  };

  const sampleMessages = [
    "Hola! Quiero 2 Burger Clásica sin cebolla y 1 Papas Cheddar & Bacon. Para enviar a Av. San Martín 450. Pago por transferencia.",
    "Buenas noches, me mandas una Doble Cuarto Cheddar con extra bacon y una Coca Cola? Soy Juan, calle Belgrano 123. Pago en efectivo con $20000."
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <MessageSquare size={24} style={{ color: '#22c55e' }} />
            <span>Importador Rápido de Mensajes WhatsApp</span>
          </div>
          <button className="btn-close-modal" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Copia el mensaje de WhatsApp que te envió el cliente y pégalo aquí. El sistema detectará automáticamente los productos, modificadores, dirección y forma de pago.
        </div>

        {/* Text Area */}
        <textarea
          rows={4}
          className="custom-input-sm"
          style={{ width: '100%', fontSize: '0.9rem', lineHeight: '1.4', fontFamily: 'inherit' }}
          placeholder="Pega aquí el mensaje de WhatsApp del cliente..."
          value={inputText}
          onChange={e => {
            setInputText(e.target.value);
            if (e.target.value.trim().length > 10) {
              const res = whatsappParserService.parseMessage(e.target.value, products);
              setParsedResult(res);
            }
          }}
          autoFocus
        />

        {/* Quick Samples */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Probar ejemplo:</span>
          {sampleMessages.map((s, idx) => (
            <button
              key={idx}
              type="button"
              className="qty-btn"
              style={{ width: 'auto', padding: '2px 8px', fontSize: '0.75rem' }}
              onClick={() => {
                setInputText(s);
                setParsedResult(whatsappParserService.parseMessage(s, products));
              }}
            >
              Ejemplo #{idx + 1}
            </button>
          ))}
        </div>

        {/* Parsed Preview */}
        {parsedResult && (
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-active)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
              ✅ DATOS DETECTADOS:
            </div>

            {/* Items */}
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PRODUCTOS:</div>
              {parsedResult.items.length === 0 ? (
                <div style={{ color: 'var(--accent-rose)', fontSize: '0.8rem' }}>No se detectaron nombres de productos exactos del menú.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                  {parsedResult.items.map((it, idx) => (
                    <div key={idx} style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      • {it.qty}x {it.name} {it.modifiers.length > 0 && <span style={{ color: 'var(--accent-amber)', fontSize: '0.75rem' }}>({it.modifiers.join(', ')})</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Delivery & Payment */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Dirección: </span>
                <strong style={{ color: 'var(--text-primary)' }}>{parsedResult.customer?.address || 'No detectada'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Pago: </span>
                <strong style={{ color: 'var(--accent-amber)' }}>{parsedResult.paymentMethod?.toUpperCase()}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Apply Button */}
        <button 
          className="btn-confirm-order"
          disabled={!parsedResult || parsedResult.items.length === 0}
          onClick={handleConfirmImport}
        >
          <ArrowRight size={20} />
          <span>Cargar Pedido al Mostrador</span>
        </button>
      </div>
    </div>
  );
}
