import React, { useState } from 'react';
import { Shield, KeyRound, CheckCircle, AlertCircle, Save, User, Lock } from 'lucide-react';
import { authService } from '../../services/authService';

export default function AuditSecuritySettings() {
  const creds = authService.getCredentials();
  const [currentPin, setCurrentPin] = useState('');
  const [newUsername, setNewUsername] = useState(creds.username);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [newName, setNewName] = useState(creds.name || '');
  const [msg, setMsg] = useState(null);

  const handleUpdate = (e) => {
    e.preventDefault();
    setMsg(null);

    if (newPin !== confirmPin) {
      setMsg({ type: 'error', text: 'El nuevo PIN y su confirmación no coinciden.' });
      return;
    }

    const res = authService.changeCredentials(currentPin, newUsername, newPin, newName);
    if (res.success) {
      setMsg({ type: 'ok', text: '✅ Credenciales del dueño actualizadas exitosamente.' });
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } else {
      setMsg({ type: 'error', text: res.error });
    }
  };

  return (
    <div style={{ maxWidth: '540px', margin: '0 auto' }}>
      <div 
        className="tactile-card"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.75rem 1.5rem',
          boxShadow: 'var(--shadow-md)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.15)',
            color: 'var(--accent-amber)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-highlight)',
            flexShrink: 0
          }}>
            <Shield size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Seguridad & Credenciales de Acceso
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Protege el acceso a métricas y balances financieros frente al personal.
            </p>
          </div>
        </div>

        {msg && (
          <div style={{
            background: msg.type === 'ok' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${msg.type === 'ok' ? 'var(--border-emerald-highlight)' : 'var(--border-rose-highlight)'}`,
            color: msg.type === 'ok' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.84rem',
            fontWeight: 700,
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {msg.type === 'ok' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>{msg.text}</span>
          </div>
        )}

        <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Nombre del Titular:
            </label>
            <input
              type="text"
              className="custom-input-sm"
              style={{ height: '40px', padding: '0 0.85rem' }}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Nombre de Usuario:
            </label>
            <input
              type="text"
              className="custom-input-sm"
              style={{ height: '40px', padding: '0 0.85rem' }}
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              PIN / Contraseña Actual:
            </label>
            <input
              type="password"
              className="custom-input-sm"
              style={{ height: '40px', padding: '0 0.85rem' }}
              placeholder="Introduce tu PIN actual..."
              value={currentPin}
              onChange={e => setCurrentPin(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Nuevo PIN:
              </label>
              <input
                type="password"
                className="custom-input-sm"
                style={{ height: '40px', padding: '0 0.85rem' }}
                placeholder="Mín. 4 caracteres"
                value={newPin}
                onChange={e => setNewPin(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Confirmar Nuevo PIN:
              </label>
              <input
                type="password"
                className="custom-input-sm"
                style={{ height: '40px', padding: '0 0.85rem' }}
                placeholder="Repite el PIN"
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-confirm-order tactile-btn" 
            style={{ marginTop: '0.5rem', height: '44px', gap: '8px', fontSize: '0.9rem' }}
          >
            <Save size={18} />
            <span>Guardar Nuevas Credenciales</span>
          </button>
        </form>
      </div>
    </div>
  );
}
