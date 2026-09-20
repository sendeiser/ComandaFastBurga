import React, { useState } from 'react';
import { KeyRound, Shield, CheckCircle, AlertCircle } from 'lucide-react';
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
    <div style={{ maxWidth: '500px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
        <Shield size={22} style={{ color: 'var(--accent-amber)' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Seguridad & Credenciales de Acceso
        </h3>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
        Modifica el PIN o contraseña con la que accedes a este portal de auditoría para proteger los datos de ventas frente al personal.
      </p>

      {msg && (
        <div style={{
          background: msg.type === 'ok' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: msg.type === 'ok' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
          padding: '0.75rem',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem',
          fontWeight: 700,
          marginBottom: '1rem'
        }}>
          {msg.text}
        </div>
      )}

      <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Nombre del Titular:</label>
          <input
            type="text"
            className="custom-input-sm"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            required
          />
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Nombre de Usuario:</label>
          <input
            type="text"
            className="custom-input-sm"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            required
          />
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700 }}>PIN / Contraseña Actual:</label>
          <input
            type="password"
            className="custom-input-sm"
            placeholder="Introduce tu PIN actual..."
            value={currentPin}
            onChange={e => setCurrentPin(e.target.value)}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Nuevo PIN:</label>
            <input
              type="password"
              className="custom-input-sm"
              placeholder="Mín. 4 caracteres"
              value={newPin}
              onChange={e => setNewPin(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Confirmar Nuevo PIN:</label>
            <input
              type="password"
              className="custom-input-sm"
              placeholder="Repite el PIN"
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value)}
              required
            />
          </div>
        </div>

        <button type="submit" className="btn-confirm-order" style={{ marginTop: '0.5rem', height: '40px' }}>
          Guardar Nuevas Credenciales
        </button>
      </form>
    </div>
  );
}
