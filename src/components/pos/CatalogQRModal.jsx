// =========================================================
// CatalogQRModal.jsx — Generador de QR & Flyers para Carta Digital
// Genera código QR local (offline) y flyers imprimibles en PDF / A4 / A5 / Sticker
// =========================================================

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  X, QrCode, Printer, Download, Copy, Check, ExternalLink, 
  Sparkles, Layers, Sliders, Smartphone, Store, Coffee, Tag,
  FileText, ZoomIn, ZoomOut, RotateCcw, Flame
} from 'lucide-react';

export default function CatalogQRModal({ settings, onClose }) {
  // URL por defecto del catálogo
  const defaultOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const initialUrl = (settings?.store_website_url || defaultOrigin).replace(/\/$/, '') + '/#catalog';

  const [catalogUrl, setCatalogUrl] = useState(initialUrl);
  const [tableNumber, setTableNumber] = useState(''); // E.g. '', '1', '2', 'Barra'
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [template, setTemplate] = useState('dark'); // 'dark' | 'red' | 'white' | 'green'
  const [format, setFormat] = useState('a4'); // 'a4' | 'a5' | 'sticker'
  const [zoom, setZoom] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      return 38;
    }
    return 60;
  }); // Preview zoom percentage
  const [copyDone, setCopyDone] = useState(false);
  const [mobileTab, setMobileTab] = useState('config'); // 'config' | 'preview'

  const handleFormatSelect = (fmtId) => {
    setFormat(fmtId);
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      if (fmtId === 'a4') setZoom(38);
      else if (fmtId === 'a5') setZoom(50);
      else setZoom(60);
    }
  };

  const handleAdjustZoom = () => {
    const isMob = typeof window !== 'undefined' && window.innerWidth <= 768;
    if (isMob) {
      setZoom(format === 'a4' ? 38 : format === 'a5' ? 50 : 60);
    } else {
      setZoom(format === 'a4' ? 55 : format === 'a5' ? 70 : 85);
    }
  };

  // Calcula la URL efectiva con el parámetro ?mesa= si se especificó
  const getEffectiveUrl = () => {
    const base = catalogUrl.trim() || initialUrl;
    if (!tableNumber.trim()) return base;
    const cleanMesa = encodeURIComponent(tableNumber.trim().replace(/^mesa\s*/i, ''));
    if (base.includes('mesa=')) {
      return base.replace(/([?&])mesa=[^&#]*/, `$1mesa=${cleanMesa}`);
    }
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}mesa=${cleanMesa}`;
  };

  // Textos editables del flyer
  const [brandName, setBrandName] = useState(
    settings?.businessName || settings?.nombre_local || "BURGA'S CHAMICAL"
  );
  const [slogan, setSlogan] = useState(
    settings?.slogan || 'Hamburguesas Artesanales & Calidad 100% Smashada'
  );
  const [ctaTitle, setCtaTitle] = useState('📱 ESCANEÁ LA CARTA DIGITAL');
  const [ctaSubtitle, setCtaSubtitle] = useState(
    'Mirá fotos reales de cada burger, armá tu pedido y envialo por WhatsApp directo a cocina.'
  );
  const [address, setAddress] = useState(
    settings?.address || settings?.direccion || ''
  );
  const [phone, setPhone] = useState(
    settings?.phone || settings?.telefono_contacto || ''
  );
  const [instagram, setInstagram] = useState(
    settings?.catalogo_instagram || 'burga_chamical'
  );

  // Generar el Data URL del QR usando la librería local `qrcode`
  useEffect(() => {
    let isMounted = true;
    const generateQr = async () => {
      try {
        const urlToEncode = getEffectiveUrl();
        const dataUrl = await QRCode.toDataURL(urlToEncode, {
          width: 800, // Alta resolución para que en impresión no se pixele
          margin: 1,
          errorCorrectionLevel: 'H',
          color: {
            dark: template === 'white' ? '#111827' : '#0a0a0c',
            light: '#ffffff',
          },
        });
        if (isMounted) {
          setQrDataUrl(dataUrl);
        }
      } catch (err) {
        console.error('Error generando QR code:', err);
      }
    };

    generateQr();
    return () => {
      isMounted = false;
    };
  }, [catalogUrl, tableNumber, template, initialUrl]);

  // Copiar URL al portapapeles
  const handleCopyUrl = () => {
    const url = getEffectiveUrl();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    });
  };

  // Abrir catálogo en nueva pestaña
  const handleOpenCatalog = () => {
    window.open(getEffectiveUrl(), '_blank');
  };

  // Descargar imagen QR individual en alta definición (PNG)
  const handleDownloadQrPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    const safeBrand = (brandName || 'comandafast').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const mesaSuffix = tableNumber.trim() ? `_mesa_${tableNumber.trim().replace(/[^a-z0-9]/gi, '_')}` : '';
    link.download = `qr_carta_digital_${safeBrand}${mesaSuffix}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  // Presets rápidos para CTA
  const handlePresetCta = (preset) => {
    if (preset === 'mesa') {
      setCtaTitle('🍔 PEDÍ DIRECTO DESDE TU MESA');
      setCtaSubtitle('Escaneá el código, elegí tus combos favoritos y disfrutá sin esperar.');
    } else if (preset === 'delivery') {
      setCtaTitle('🛵 ¡VOLVÉ A PEDIR EN 1 CLICK!');
      setCtaSubtitle('Guardá nuestro catálogo en tus favoritos para tu próxima noche de burgers.');
    } else if (preset === 'carta') {
      setCtaTitle('📱 ESCANEÁ LA CARTA DIGITAL');
      setCtaSubtitle('Mirá fotos reales de cada burger, armá tu pedido y envialo por WhatsApp directo a cocina.');
    }
  };

  // Configuración de Paletas de Estilo
  const THEMES = {
    dark: {
      id: 'dark',
      label: '🌑 Dark Smash',
      desc: 'Fondo carbón con acento dorado premium',
      bg: '#0f1015',
      cardBg: '#181a20',
      accent: '#f59e0b',
      accentSoft: 'rgba(245, 158, 11, 0.12)',
      textPrimary: '#ffffff',
      textMuted: '#9ca3af',
      border: 'rgba(245, 158, 11, 0.35)',
      badgeBg: '#f59e0b',
      badgeText: '#000000',
      qrBorder: '#f59e0b',
    },
    red: {
      id: 'red',
      label: '🔥 Fuego Red',
      desc: 'Fondo oscuro con acento rojo hamburguesero',
      bg: '#140505',
      cardBg: '#1f0d0d',
      accent: '#ef4444',
      accentSoft: 'rgba(239, 68, 68, 0.14)',
      textPrimary: '#ffffff',
      textMuted: '#d1a3a3',
      border: 'rgba(239, 68, 68, 0.4)',
      badgeBg: '#ef4444',
      badgeText: '#ffffff',
      qrBorder: '#ef4444',
    },
    white: {
      id: 'white',
      label: '⬜ Clean White',
      desc: 'Fondo blanco (Ahorro de tinta / Eco-print)',
      bg: '#ffffff',
      cardBg: '#f9fafb',
      accent: '#d97706',
      accentSoft: 'rgba(217, 119, 6, 0.08)',
      textPrimary: '#111827',
      textMuted: '#4b5563',
      border: '#e5e7eb',
      badgeBg: '#111827',
      badgeText: '#ffffff',
      qrBorder: '#d97706',
    },
    green: {
      id: 'green',
      label: '🟢 Fresh Green',
      desc: 'Fondo oscuro con acento verde esmeralda',
      bg: '#04140d',
      cardBg: '#092116',
      accent: '#10b981',
      accentSoft: 'rgba(16, 185, 129, 0.12)',
      textPrimary: '#ffffff',
      textMuted: '#94a3b8',
      border: 'rgba(16, 185, 129, 0.35)',
      badgeBg: '#10b981',
      badgeText: '#000000',
      qrBorder: '#10b981',
    },
  };

  const t = THEMES[template] || THEMES.dark;

  // Medidas y estilos según formato
  const FORMATS = {
    a4: {
      id: 'a4',
      name: 'Afiche A4 (Pared / Vidriera)',
      desc: '210 × 297 mm — Máxima visibilidad para el local',
      widthPx: 794,
      heightPx: 1123,
      padding: '50px 48px 40px',
      qrSize: 280,
      titleSize: 52,
      ctaSize: 24,
      pageCss: 'A4 portrait',
    },
    a5: {
      id: 'a5',
      name: 'Cartel de Mesa A5 (Mesa / Barra)',
      desc: '148 × 210 mm — Ideal para porta-menú acrílico',
      widthPx: 560,
      heightPx: 794,
      padding: '36px 32px 30px',
      qrSize: 210,
      titleSize: 38,
      ctaSize: 20,
      pageCss: 'A5 portrait',
    },
    sticker: {
      id: 'sticker',
      name: 'Sticker Cuadrado (Cajas / Bolsas)',
      desc: '100 × 100 mm — Para packaging de delivery',
      widthPx: 500,
      heightPx: 500,
      padding: '28px 24px',
      qrSize: 180,
      titleSize: 28,
      ctaSize: 16,
      pageCss: '100mm 100mm',
    },
  };

  const f = FORMATS[format] || FORMATS.a4;

  // IMPRESIÓN Y EXPORTACIÓN A PDF
  const handlePrintPdf = () => {
    const flyer = document.getElementById('qr-flyer-printable-content');
    if (!flyer) return;

    const printWin = window.open('', '_blank', 'width=950,height=1100');
    if (!printWin) {
      alert('Por favor habilita las ventanas emergentes (pop-ups) en tu navegador para imprimir.');
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Flyer QR Carta Digital — ${brandName}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          }
          @page {
            size: ${f.pageCss};
            margin: 0;
          }
          @media print {
            body {
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .flyer-outer-container {
              width: 100% !important;
              height: 100% !important;
              max-width: none !important;
              max-height: none !important;
              box-shadow: none !important;
              border-radius: 0 !important;
            }
          }
          .flyer-outer-container {
            width: ${f.widthPx}px;
            min-height: ${f.heightPx}px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: center;
          }
        </style>
      </head>
      <body>
        <div class="flyer-outer-container">
          ${flyer.outerHTML}
        </div>
        <script>
          // Esperar a que la imagen QR base64 termine de montarse y renderizarse
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }, 300);
          };
        <\/script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="qr-modal-overlay" onClick={onClose}>
      <div className="qr-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* MODAL HEADER */}
        <div className="qr-modal-header">
          <div className="qr-modal-header-left">
            <div className="qr-modal-icon-box">
              <QrCode size={22} />
            </div>
            <div>
              <div className="qr-modal-title-row">
                <span className="qr-modal-title">
                  Generador de QR & Flyers
                </span>
                <span className="qr-modal-badge">
                  PDF & PRINT
                </span>
              </div>
              <div className="qr-modal-subtitle">
                Personalizá e imprimí afiches A4, carteles de mesa A5 o stickers para packaging de delivery
              </div>
            </div>
          </div>

          <div className="qr-modal-header-actions">
            <button
              onClick={handlePrintPdf}
              className="btn-qr-print-action"
              title="Imprimir o guardar en PDF"
            >
              <Printer size={16} />
              <span className="qr-print-text-full">Imprimir / Guardar en PDF</span>
              <span className="qr-print-text-short">Imprimir / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="btn-qr-close-action"
              title="Cerrar (Esc)"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* MOBILE NAVIGATION TABS (Segmented Control) */}
        <div className="qr-mobile-tab-bar">
          <button
            type="button"
            className={`qr-mobile-tab-btn ${mobileTab === 'config' ? 'active' : ''}`}
            onClick={() => setMobileTab('config')}
          >
            <Sliders size={15} />
            <span>1. Personalizar</span>
          </button>
          <button
            type="button"
            className={`qr-mobile-tab-btn ${mobileTab === 'preview' ? 'active' : ''}`}
            onClick={() => {
              setMobileTab('preview');
              if (zoom > 45 && typeof window !== 'undefined' && window.innerWidth <= 768) {
                setZoom(format === 'a4' ? 38 : format === 'a5' ? 50 : 60);
              }
            }}
          >
            <QrCode size={15} />
            <span>2. Ver Flyer & QR</span>
          </button>
        </div>

        {/* MODAL BODY: Split Panel en Desktop / Tabs en Mobile */}
        <div className="qr-modal-body">
          {/* PANEL IZQUIERDO: Configuración y Edición */}
          <div className={`qr-modal-panel-config ${mobileTab === 'config' ? 'mobile-active' : ''}`}>
            {/* 1. Selector de Formato */}
            <div>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Layers size={14} style={{ color: 'var(--accent-amber)' }} />
                <span>1. Formato de Impresión</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {Object.values(FORMATS).map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => handleFormatSelect(fmt.id)}
                    style={{
                      background: format === fmt.id ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-main)',
                      border: `1.5px solid ${format === fmt.id ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
                      borderRadius: 10,
                      padding: '10px 8px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: '1.2rem' }}>
                      {fmt.id === 'a4' ? '📄' : fmt.id === 'a5' ? '📑' : '🏷️'}
                    </div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        color: format === fmt.id ? 'var(--accent-amber)' : 'var(--text-primary)',
                      }}
                    >
                      {fmt.id.toUpperCase()}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>
                      {fmt.id === 'a4' ? 'Afiche Pared' : fmt.id === 'a5' ? 'Para Mesa' : 'Sticker Caja'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Selector de Estilo / Tema */}
            <div>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Sparkles size={14} style={{ color: 'var(--accent-amber)' }} />
                <span>2. Estilo Visual</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {Object.values(THEMES).map((thm) => (
                  <button
                    key={thm.id}
                    onClick={() => setTemplate(thm.id)}
                    style={{
                      background: template === thm.id ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-main)',
                      border: `1.5px solid ${template === thm.id ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
                      borderRadius: 10,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          color: template === thm.id ? 'var(--accent-amber)' : 'var(--text-primary)',
                        }}
                      >
                        {thm.label}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {thm.id === 'white' ? 'Ahorro de tinta' : 'Fondo oscuro'}
                      </div>
                    </div>
                    {template === thm.id && (
                      <Check size={16} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Selector de Mesa / Ubicación */}
            <div>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Store size={14} style={{ color: 'var(--accent-amber)' }} />
                  <span>3. Mesa / Salón (Opcional)</span>
                </div>
                {tableNumber && (
                  <button
                    onClick={() => {
                      setTableNumber('');
                      handlePresetCta('carta');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-amber)',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Quitar mesa
                  </button>
                )}
              </div>

              <div
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTableNumber(val);
                    if (val.trim()) {
                      handlePresetCta('mesa');
                    }
                  }}
                  placeholder="Ej: 1, 4, Barra... (vacío = carta general)"
                  className="custom-input-sm"
                  style={{ width: '100%', fontSize: '0.82rem' }}
                />

                {/* Chips rápidos de mesas */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setTableNumber('');
                      handlePresetCta('carta');
                    }}
                    style={{
                      background: !tableNumber ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-card)',
                      border: `1px solid ${!tableNumber ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
                      borderRadius: 6,
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: !tableNumber ? 'var(--accent-amber)' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    General
                  </button>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setTableNumber(String(n));
                        handlePresetCta('mesa');
                      }}
                      style={{
                        background: tableNumber === String(n) ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-card)',
                        border: `1px solid ${tableNumber === String(n) ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
                        borderRadius: 6,
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: tableNumber === String(n) ? 'var(--accent-amber)' : 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      Mesa {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setTableNumber('Barra');
                      handlePresetCta('mesa');
                    }}
                    style={{
                      background: tableNumber.toLowerCase() === 'barra' ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-card)',
                      border: `1px solid ${tableNumber.toLowerCase() === 'barra' ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
                      borderRadius: 6,
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: tableNumber.toLowerCase() === 'barra' ? 'var(--accent-amber)' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    Barra
                  </button>
                </div>
              </div>
            </div>

            {/* 4. URL del Catálogo & Accesos Directos */}
            <div>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Smartphone size={14} style={{ color: 'var(--accent-amber)' }} />
                  <span>4. Destino del Código QR</span>
                </div>
                {catalogUrl !== initialUrl && (
                  <button
                    onClick={() => setCatalogUrl(initialUrl)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-amber)',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <RotateCcw size={11} /> Restaurar URL
                  </button>
                )}
              </div>
              <div
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <input
                  type="text"
                  value={catalogUrl}
                  onChange={(e) => setCatalogUrl(e.target.value)}
                  placeholder="https://tudominio.com/#catalog"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    width: '100%',
                    fontFamily: 'monospace',
                  }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={handleCopyUrl}
                    style={{
                      flex: 1,
                      background: copyDone ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                      border: `1px solid ${copyDone ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-subtle)'}`,
                      borderRadius: 8,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      color: copyDone ? '#10b981' : 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      transition: 'all 0.15s',
                    }}
                  >
                    {copyDone ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copyDone ? '¡Copiado!' : 'Copiar Link'}</span>
                  </button>
                  <button
                    onClick={handleOpenCatalog}
                    style={{
                      flex: 1,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                    }}
                  >
                    <ExternalLink size={14} />
                    <span>Ver Catálogo</span>
                  </button>
                  <button
                    onClick={handleDownloadQrPng}
                    style={{
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: 8,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      color: 'var(--accent-amber)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                    }}
                    title="Descargar solo la imagen del código QR en alta calidad PNG"
                  >
                    <Download size={14} />
                    <span>QR PNG</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 5. Textos Personalizables del Flyer */}
            <div>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Sliders size={14} style={{ color: 'var(--accent-amber)' }} />
                <span>5. Textos del Flyer</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Nombre del local */}
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Nombre del Comercio:
                  </label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="custom-input-sm"
                    style={{ width: '100%', marginTop: 3 }}
                  />
                </div>

                {/* Eslogan */}
                {format !== 'sticker' && (
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Eslogan / Subtítulo:
                    </label>
                    <input
                      type="text"
                      value={slogan}
                      onChange={(e) => setSlogan(e.target.value)}
                      className="custom-input-sm"
                      style={{ width: '100%', marginTop: 3 }}
                    />
                  </div>
                )}

                {/* Llamado a la Acción (CTA) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Llamado a la Acción (CTA):
                    </label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => handlePresetCta('carta')}
                        style={{
                          background: 'var(--bg-main)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 4,
                          padding: '2px 5px',
                          fontSize: '0.65rem',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        Carta
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePresetCta('mesa')}
                        style={{
                          background: 'var(--bg-main)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 4,
                          padding: '2px 5px',
                          fontSize: '0.65rem',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        Mesa
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePresetCta('delivery')}
                        style={{
                          background: 'var(--bg-main)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 4,
                          padding: '2px 5px',
                          fontSize: '0.65rem',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        Delivery
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={ctaTitle}
                    onChange={(e) => setCtaTitle(e.target.value)}
                    className="custom-input-sm"
                    style={{ width: '100%', marginTop: 3 }}
                  />
                  {format === 'a4' && (
                    <textarea
                      value={ctaSubtitle}
                      onChange={(e) => setCtaSubtitle(e.target.value)}
                      className="custom-input-sm"
                      rows={2}
                      style={{ width: '100%', marginTop: 6, resize: 'none', lineHeight: 1.3 }}
                    />
                  )}
                </div>

                {/* Contacto & Redes (para formatos A4 y A5) */}
                {format !== 'sticker' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        WhatsApp / Tel:
                      </label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="custom-input-sm"
                        style={{ width: '100%', marginTop: 3 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Instagram:
                      </label>
                      <input
                        type="text"
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value)}
                        placeholder="usuario_ig"
                        className="custom-input-sm"
                        style={{ width: '100%', marginTop: 3 }}
                      />
                    </div>
                  </div>
                )}

                {format === 'a4' && (
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Dirección del Local:
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="custom-input-sm"
                      style={{ width: '100%', marginTop: 3 }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Tips de Impresión */}
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 12,
                padding: '12px 14px',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 800, color: 'var(--accent-amber)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>💡</span>
                <span>¿Cómo guardar en PDF o imprimir?</span>
              </div>
              <ul style={{ paddingLeft: 16, margin: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <li>Hacé click en <strong>"Imprimir / Guardar en PDF"</strong> arriba.</li>
                <li>En destino, elegí <strong>"Guardar como PDF"</strong> o tu impresora física.</li>
                <li>Activá la casilla <strong>"Gráficos en segundo plano"</strong> para que se vean los colores de fondo.</li>
                <li>Configurá márgenes en <strong>"Ninguno"</strong> o "Por defecto".</li>
              </ul>
            </div>

            {/* Botón destacado en mobile para ver la vista previa */}
            <div className="qr-mobile-next-step-wrap">
              <button
                type="button"
                className="btn-qr-next-step"
                onClick={() => {
                  setMobileTab('preview');
                  if (typeof window !== 'undefined' && window.innerWidth <= 768) {
                    setZoom(format === 'a4' ? 38 : format === 'a5' ? 50 : 60);
                  }
                }}
              >
                <span>Ver Flyer & Código QR</span>
                <Sparkles size={16} />
              </button>
            </div>
          </div>

          {/* PANEL DERECHO: Live Preview del Flyer */}
          <div className={`qr-modal-panel-preview ${mobileTab === 'preview' ? 'mobile-active' : ''}`}>
            {/* Top Toolbar de la vista previa */}
            <div className="qr-preview-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="btn-qr-back-to-config"
                  onClick={() => setMobileTab('config')}
                >
                  ← Editar
                </button>
                <span className="qr-preview-title">
                  Vista Previa
                </span>
                <span className="qr-preview-format-badge">
                  {f.name}
                </span>
              </div>

              {/* Controles de Zoom */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => setZoom((z) => Math.max(25, z - 8))}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    borderRadius: 6,
                    width: 28,
                    height: 28,
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Reducir Zoom"
                >
                  <ZoomOut size={14} />
                </button>
                <span style={{ color: '#d1d5db', fontSize: '0.75rem', fontWeight: 700, minWidth: 40, textAlign: 'center' }}>
                  {zoom}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(100, z + 8))}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    borderRadius: 6,
                    width: 28,
                    height: 28,
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Aumentar Zoom"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  onClick={handleAdjustZoom}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    borderRadius: 6,
                    padding: '4px 8px',
                    color: '#9ca3af',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Ajustar
                </button>
              </div>
            </div>

            {/* Scrollable Container para la hoja del flyer */}
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: '30px 20px',
              }}
            >
              <div
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease',
                  boxShadow: '0 25px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.05)',
                  borderRadius: format === 'sticker' ? 16 : 4,
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {/* ============================================================ */}
                {/* FLYER RENDERIZABLE (Este mismo nodo se exporta al PDF)        */}
                {/* ============================================================ */}
                <div
                  id="qr-flyer-printable-content"
                  style={{
                    width: `${f.widthPx}px`,
                    minHeight: `${f.heightPx}px`,
                    background: t.bg,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: f.padding,
                    boxSizing: 'border-box',
                    fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
                    position: 'relative',
                    overflow: 'hidden',
                    color: t.textPrimary,
                  }}
                >
                  {/* Decorative glowing gradient accents */}
                  <div
                    style={{
                      position: 'absolute',
                      top: -100,
                      right: -100,
                      width: 380,
                      height: 380,
                      borderRadius: '50%',
                      background: t.accent,
                      opacity: t.id === 'white' ? 0.04 : 0.08,
                      filter: 'blur(60px)',
                      pointerEvents: 'none',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -100,
                      left: -100,
                      width: 420,
                      height: 420,
                      borderRadius: '50%',
                      background: t.accent,
                      opacity: t.id === 'white' ? 0.04 : 0.07,
                      filter: 'blur(70px)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* TOP ACCENT BAR */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: format === 'sticker' ? 5 : 7,
                      background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)`,
                    }}
                  />

                  {/* HEADER DEL FLYER */}
                  <div style={{ textAlign: 'center', width: '100%', marginBottom: format === 'sticker' ? 12 : 24 }}>
                    {/* Brand Name */}
                    <div
                      style={{
                        fontSize: `${f.titleSize}px`,
                        fontWeight: 900,
                        color: t.textPrimary,
                        letterSpacing: '-1px',
                        lineHeight: 1.05,
                        textTransform: 'uppercase',
                        marginBottom: 6,
                      }}
                    >
                      {brandName}
                    </div>

                    {/* Accent Divider Line */}
                    <div
                      style={{
                        width: format === 'sticker' ? 50 : 80,
                        height: 4,
                        background: t.accent,
                        margin: '8px auto',
                        borderRadius: 2,
                      }}
                    />

                    {/* Slogan */}
                    {slogan && format !== 'sticker' && (
                      <div
                        style={{
                          fontSize: format === 'a4' ? 16 : 13,
                          fontWeight: 700,
                          color: t.textMuted,
                          letterSpacing: 2,
                          textTransform: 'uppercase',
                          marginTop: 6,
                        }}
                      >
                        {slogan}
                      </div>
                    )}
                  </div>

                  {/* CTA SECTION */}
                  <div style={{ textAlign: 'center', marginBottom: format === 'sticker' ? 14 : 26, width: '100%' }}>
                    <div
                      style={{
                        fontSize: `${f.ctaSize}px`,
                        fontWeight: 900,
                        color: t.accent,
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                        marginBottom: 6,
                      }}
                    >
                      {ctaTitle}
                    </div>
                    {ctaSubtitle && format !== 'sticker' && (
                      <div
                        style={{
                          fontSize: format === 'a4' ? 15 : 12,
                          color: t.textMuted,
                          lineHeight: 1.45,
                          maxWidth: format === 'a4' ? 580 : 440,
                          margin: '0 auto',
                        }}
                      >
                        {ctaSubtitle}
                      </div>
                    )}
                  </div>

                  {/* Table Badge on flyer if set */}
                  {tableNumber.trim() && (
                    <div
                      style={{
                        background: t.accent,
                        color: t.id === 'white' ? '#ffffff' : '#000000',
                        padding: format === 'sticker' ? '4px 16px' : '6px 24px',
                        borderRadius: 50,
                        fontSize: format === 'sticker' ? 14 : 20,
                        fontWeight: 900,
                        letterSpacing: 1.5,
                        textTransform: 'uppercase',
                        marginBottom: 14,
                        boxShadow: `0 8px 24px ${t.accentSoft}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span>🪑</span>
                      <span>
                        {tableNumber.trim().toUpperCase().startsWith('MESA') 
                          ? tableNumber.trim().toUpperCase() 
                          : `MESA ${tableNumber.trim().toUpperCase()}`}
                      </span>
                    </div>
                  )}

                  {/* QR CODE CARD */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: `3px solid ${t.qrBorder}`,
                      borderRadius: format === 'sticker' ? 18 : 26,
                      padding: format === 'sticker' ? 16 : 22,
                      boxShadow: `0 16px 50px rgba(0,0,0,0.35), 0 0 40px ${t.accentSoft}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 12,
                      margin: 'auto 0',
                    }}
                  >
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="Código QR Carta Digital"
                        width={f.qrSize}
                        height={f.qrSize}
                        style={{
                          display: 'block',
                          imageRendering: 'pixelated',
                          borderRadius: 8,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: f.qrSize,
                          height: f.qrSize,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#666',
                        }}
                      >
                        Generando QR...
                      </div>
                    )}

                    {/* Badge below QR */}
                    <div
                      style={{
                        background: t.badgeBg,
                        color: t.badgeText,
                        padding: format === 'sticker' ? '4px 14px' : '6px 20px',
                        borderRadius: 50,
                        fontSize: format === 'sticker' ? 11 : 13,
                        fontWeight: 900,
                        letterSpacing: 1.5,
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>🍔</span>
                      <span>Carta Digital</span>
                    </div>
                  </div>

                  {/* URL DISPLAY BOX */}
                  <div
                    style={{
                      marginTop: format === 'sticker' ? 12 : 24,
                      background: t.accentSoft,
                      border: `1.5px dashed ${t.border}`,
                      borderRadius: 12,
                      padding: format === 'sticker' ? '8px 14px' : '10px 20px',
                      textAlign: 'center',
                      maxWidth: format === 'a4' ? 520 : format === 'a5' ? 420 : 380,
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        fontSize: format === 'sticker' ? 9 : 10,
                        color: t.textMuted,
                        fontWeight: 800,
                        letterSpacing: 1.5,
                        textTransform: 'uppercase',
                        marginBottom: 2,
                      }}
                    >
                      O ingresá directamente a:
                    </div>
                    <div
                      style={{
                        fontSize: format === 'sticker' ? 12 : format === 'a5' ? 13 : 15,
                        color: t.accent,
                        fontWeight: 800,
                        wordBreak: 'break-all',
                        fontFamily: 'monospace',
                      }}
                    >
                      {getEffectiveUrl()}
                    </div>
                  </div>

                  {/* FOOTER INFO: Dirección, Teléfono, Instagram */}
                  {format !== 'sticker' && (
                    <div
                      style={{
                        marginTop: format === 'a4' ? 32 : 18,
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: format === 'a4' ? 36 : 20,
                        flexWrap: 'wrap',
                        borderTop: `1px solid ${t.border}`,
                        paddingTop: format === 'a4' ? 22 : 14,
                      }}
                    >
                      {address && format === 'a4' && (
                        <div style={{ textAlign: 'center', color: t.textMuted, fontSize: 13 }}>
                          <div style={{ fontSize: 16, marginBottom: 2 }}>📍</div>
                          <div style={{ fontWeight: 700, color: t.textPrimary }}>{address}</div>
                        </div>
                      )}
                      {phone && (
                        <div style={{ textAlign: 'center', color: t.textMuted, fontSize: format === 'a4' ? 13 : 11 }}>
                          <div style={{ fontSize: format === 'a4' ? 16 : 14, marginBottom: 2 }}>📞</div>
                          <div style={{ fontWeight: 700, color: t.textPrimary }}>{phone}</div>
                        </div>
                      )}
                      {instagram && (
                        <div style={{ textAlign: 'center', color: t.textMuted, fontSize: format === 'a4' ? 13 : 11 }}>
                          <div style={{ fontSize: format === 'a4' ? 16 : 14, marginBottom: 2 }}>📸</div>
                          <div style={{ fontWeight: 700, color: t.textPrimary }}>@{instagram}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* BOTTOM ACCENT BAR */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Mobile Bottom Action Bar */}
            <div className="qr-mobile-preview-footer">
              <button
                type="button"
                className="btn-qr-mobile-print"
                onClick={handlePrintPdf}
              >
                <Printer size={16} />
                <span>Imprimir / PDF</span>
              </button>
              <button
                type="button"
                className="btn-qr-mobile-dl"
                onClick={handleDownloadQrPng}
              >
                <Download size={16} />
                <span>Descargar PNG</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
