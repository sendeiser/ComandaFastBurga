import React, { useState } from 'react';
import { X, Settings, Download, Upload, Printer, DollarSign, Database, Bluetooth, Usb, CheckCircle } from 'lucide-react';
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
