import React, { useState } from 'react';
import { X, Settings, Download, Upload, Printer, DollarSign, Database, Bluetooth, Usb, CheckCircle, Palette, FileText, Check, Hash, RotateCcw } from 'lucide-react';
import { storageService } from '../../services/storageService';
import { printerService } from '../../services/printerService';
import { supabaseSync } from '../../services/supabaseClient';

export default function SettingsModal({ settings, onSaveSettings, onClose }) {
  const [form, setForm] = useState(settings);
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveSettings(form);
    alert('Configuraciones guardadas correctamente.');
    onClose();
  };

  const handleTestPrint = () => {
    printerService.printTestTicket('58mm', form);
  };

  const handleTestDrawer = () => {
    printerService.kickCashDrawer(form);
  };

  const handleConnectUsb = async () => {
    await printerService.connectUsbSerial();
  };

  const handleConnectBluetooth = async () => {
    await printerService.connectBluetooth();
  };

  const handleTestSupabase = async () => {
    if (!form.supabaseUrl || !form.supabaseAnonKey) {
      alert('Ingresa la URL y Anon Key de Supabase primero.');
      return;
    }
    setTestingSupabase(true);
    const ok = await supabaseSync.testConnection(form.supabaseUrl, form.supabaseAnonKey);
    setTestingSupabase(false);
    setSupabaseStatus(ok ? 'ok' : 'fail');
  };

  const handleExport = () => {
    const json = storageService.exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comandafast_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const ok = storageService.importBackup(event.target?.result);
        if (ok) {
          alert('Copia de seguridad restaurada. Recargando la aplicación...');
          window.location.reload();
        } else {
          alert('Error al leer el archivo de copia.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Settings size={24} style={{ color: 'var(--accent-amber)' }} />
            <span>Configuración — Xprinter XP-58IIH</span>
          </div>
          <button className="btn-close-modal" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* DATOS COMERCIO */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nombre del Comercio (Membrete de Tickets):</label>
            <input type="text" className="custom-input-sm" value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Eslogan / Subtítulo:</label>
              <input type="text" className="custom-input-sm" value={form.slogan} onChange={e => setForm({ ...form, slogan: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Teléfono / WhatsApp:</label>
              <input type="text" className="custom-input-sm" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dirección del Local:</label>
              <input type="text" className="custom-input-sm" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Alias MP / Banco para Transferencias:</label>
              <input type="text" className="custom-input-sm" value={form.alias} onChange={e => setForm({ ...form, alias: e.target.value })} />
            </div>
          </div>

          {/* DISEÑO & PLANTILLAS DE TICKET TÉRMICO */}
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Palette size={18} />
                <span>Diseño & Plantilla del Ticket Térmico</span>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Personalización 58mm / 80mm
              </span>
            </div>

            {/* Theme Selector Grid */}
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                Selecciona la plantilla de diseño para cocina y cliente:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                {[
                  { id: 'classic', label: '🏛️ Clásico', title: 'Tradicional 32 col', desc: 'Separadores de guiones y formato POS estándar' },
                  { id: 'modern', label: '✨ Moderno', title: 'Gourmet / Invertido', desc: 'Total en bloque negro invertido y marco doble' },
                  { id: 'minimal', label: '⚡ Minimal Eco', title: 'Ahorro de Papel', desc: 'Ultra-compacto, reduce hasta 40% de papel' },
                  { id: 'street', label: '🍔 Street Food', title: 'Audaz & Modificadores', desc: 'Letras grandes, emojis y mod resaltadas' }
                ].map(th => (
                  <div
                    key={th.id}
                    onClick={() => setForm({ ...form, ticketTheme: th.id })}
                    style={{
                      border: form.ticketTheme === th.id ? '2px solid var(--accent-amber)' : '1px solid var(--border-subtle)',
                      background: form.ticketTheme === th.id ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-card)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', color: form.ticketTheme === th.id ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
                        {th.label}
                      </span>
                      {form.ticketTheme === th.id && <Check size={14} style={{ color: 'var(--accent-amber)' }} />}
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{th.title}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>{th.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Footer Input & Presets */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mensaje de Pie del Ticket:</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button 
                    type="button" 
                    className="cat-pill-btn" 
                    style={{ fontSize: '0.7rem', height: '22px', padding: '0 6px' }}
                    onClick={() => setForm({ ...form, ticketCustomFooter: '¡Gracias por su compra!\nComandaFast Gastronomía' })}
                  >
                    + Estándar
                  </button>
                  <button 
                    type="button" 
                    className="cat-pill-btn" 
                    style={{ fontSize: '0.7rem', height: '22px', padding: '0 6px' }}
                    onClick={() => setForm({ ...form, ticketCustomFooter: '🍔 ¡Seguinos en Instagram!\n@tu_comercio_ok' })}
                  >
                    + Instagram
                  </button>
                  <button 
                    type="button" 
                    className="cat-pill-btn" 
                    style={{ fontSize: '0.7rem', height: '22px', padding: '0 6px' }}
                    onClick={() => setForm({ ...form, ticketCustomFooter: '📶 Wi-Fi Clientes: ClaveBurger\n¡Vuelve pronto!' })}
                  >
                    + Wi-Fi
                  </button>
                </div>
              </div>
              <textarea 
                className="form-textarea" 
                rows="2"
                style={{ fontSize: '0.85rem', width: '100%', resize: 'none' }}
                value={form.ticketCustomFooter || ''} 
                onChange={e => setForm({ ...form, ticketCustomFooter: e.target.value })}
                placeholder="Texto de agradecimiento o redes sociales..."
              />
            </div>

            {/* Toggles de Contenido Visible */}
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                Elementos a imprimir en el ticket:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', fontSize: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={form.ticketShowSlogan !== false} 
                    onChange={e => setForm({ ...form, ticketShowSlogan: e.target.checked })} 
                  />
                  <span>Eslogan</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={form.ticketShowAddress !== false} 
                    onChange={e => setForm({ ...form, ticketShowAddress: e.target.checked })} 
                  />
                  <span>Dirección</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={form.ticketShowPhone !== false} 
                    onChange={e => setForm({ ...form, ticketShowPhone: e.target.checked })} 
                  />
                  <span>Teléfono</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={form.ticketShowAlias !== false} 
                    onChange={e => setForm({ ...form, ticketShowAlias: e.target.checked })} 
                  />
                  <span>Alias MP / CBU</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={form.ticketShowCustomer !== false} 
                    onChange={e => setForm({ ...form, ticketShowCustomer: e.target.checked })} 
                  />
                  <span>Datos de Entrega</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Ancho:</span>
                  <select 
                    className="custom-input-sm" 
                    style={{ padding: '2px 4px', height: '26px', fontSize: '0.75rem', width: 'auto' }}
                    value={form.ticketWidth || '58mm'} 
                    onChange={e => setForm({ ...form, ticketWidth: e.target.value })}
                  >
                    <option value="58mm">58mm (XP-58)</option>
                    <option value="80mm">80mm (Grande)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* HARDWARE XPRINTER XP-58IIH */}
          <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid var(--accent-amber)', borderRadius: 'var(--radius-md)', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Printer size={18} />
                <span>Ticketera Térmica: Xprinter XP-58IIH (58mm)</span>
              </div>
              <span className="brand-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)' }}>
                Calibrada 32 col
              </span>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Formato optimizado a 58mm (32 columnas por línea, margen lateral de 4mm y avance de papel para barra de corte manual).
            </div>

            {/* Quick Actions Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '4px' }}>
              <button 
                type="button" 
                className="qty-btn"
                style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', gap: '6px', background: 'var(--bg-card)' }}
                onClick={handleTestPrint}
              >
                <Printer size={15} style={{ color: 'var(--accent-amber)' }} />
                <span>Imprimir Ticket Prueba (58mm)</span>
              </button>

              <button 
                type="button" 
                className="qty-btn"
                style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', gap: '6px', background: 'var(--bg-card)', color: 'var(--accent-emerald)' }}
                onClick={handleTestDrawer}
              >
                <DollarSign size={15} />
                <span>Probar Apertura Cajón RJ11</span>
              </button>

              <button 
                type="button" 
                className="qty-btn"
                style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', gap: '6px', background: 'var(--bg-card)', color: '#60a5fa' }}
                onClick={handleConnectBluetooth}
              >
                <Bluetooth size={15} />
                <span>Conectar por Bluetooth</span>
              </button>

              <button 
                type="button" 
                className="qty-btn"
                style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', gap: '6px', background: 'var(--bg-card)', color: '#c084fc' }}
                onClick={handleConnectUsb}
              >
                <Usb size={15} />
                <span>Conectar por Cable USB</span>
              </button>
            </div>
          </div>

          {/* SUPABASE CLOUD SYNC */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Database size={16} /> Sincronización en la Nube (Supabase):
              </label>
              <button 
                type="button"
                className="qty-btn"
                style={{ width: 'auto', padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                onClick={handleTestSupabase}
                disabled={testingSupabase}
              >
                {testingSupabase ? 'Probando...' : 'Probar Conexión'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '6px' }}>
              <input 
                type="text" 
                className="custom-input-sm" 
                placeholder="https://xyz.supabase.co" 
                value={form.supabaseUrl || ''} 
                onChange={e => setForm({ ...form, supabaseUrl: e.target.value })} 
              />
              <input 
                type="password" 
                className="custom-input-sm" 
                placeholder="Anon / Public Key" 
                value={form.supabaseAnonKey || ''} 
                onChange={e => setForm({ ...form, supabaseAnonKey: e.target.value })} 
              />
            </div>

            {supabaseStatus && (
              <div style={{ fontSize: '0.8rem', marginTop: '4px', fontWeight: 700, color: supabaseStatus === 'ok' ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                {supabaseStatus === 'ok' ? '✅ Conexión exitosa a Supabase' : '❌ No se pudo conectar a Supabase (Verifica URL y Key o ejecuta el script SQL)'}
              </div>
            )}
          </div>

          
          {/* NUMERACIÓN DE PEDIDOS */}
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Hash size={18} />
                <span>Numeración de Órdenes y Comandas</span>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem' }}>
              <input 
                type="checkbox" 
                checked={form.resetDailyOrderNumber !== false} 
                onChange={e => setForm({ ...form, resetDailyOrderNumber: e.target.checked })} 
              />
              <span>Reiniciar número de orden automáticamente cada día (inicia en #1 a medianoche)</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <button 
                type="button" 
                className="qty-btn"
                style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem', gap: '6px', background: 'var(--bg-card)', color: 'var(--accent-amber)' }}
                onClick={() => {
                  if (window.confirm('¿Deseas reiniciar el contador de órdenes a 0 ahora? El próximo pedido será el #1.')) {
                    storageService.resetOrderCounter(0);
                    alert('Contador de órdenes reiniciado a 0. Próxima orden: #1.');
                  }
                }}
              >
                <RotateCcw size={14} />
                <span>Reiniciar contador a 0 ahora</span>
              </button>
            </div>
          </div>

          <button type="submit" className="btn-confirm-order" style={{ marginTop: '0.5rem' }}>
            Guardar Configuración
          </button>
        </form>

        {/* Backup section */}
        <div style={{ borderTop: '1px dashed var(--border-subtle)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Copia de Seguridad de Datos:</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="qty-btn" style={{ width: 'auto', padding: '0.4rem 0.75rem' }} onClick={handleExport}>
              <Download size={14} /> Exportar JSON
            </button>
            <label className="qty-btn" style={{ width: 'auto', padding: '0.4rem 0.75rem', cursor: 'pointer' }}>
              <Upload size={14} /> Importar
              <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
