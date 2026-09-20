import React, { useState } from 'react';
import { Lock, KeyRound, User, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { authService } from '../../services/authService';

export default function OwnerLogin({ onLoginSuccess, onBackToPos }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    setTimeout(() => {
      const res = authService.login(username, password);
      setLoading(false);
      if (res.success) {
        onLoginSuccess(res.session);
      } else {
        setError(res.error);
      }
    }, 250);
  };

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '2.5rem 2rem',
        maxWidth: '440px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        position: 'relative'
      }}>
        {/* Back to POS Button */}
        <button
          type="button"
          onClick={onBackToPos}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '1.25rem',
            padding: 0
          }}
        >
          ← Volver al Mostrador (POS)
        </button>

        {/* Lock Shield Icon */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.4))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            border: '2px solid var(--accent-amber)',
            boxShadow: '0 0 20px var(--accent-amber-glow)'
          }}>
            <ShieldCheck size={32} style={{ color: 'var(--accent-amber)' }} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 0.35rem' }}>
            Portal del Dueño
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Acceso seguro a métricas financieras, auditoría de cajas y control antifraude.
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem',
            color: 'var(--accent-rose)',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            marginBottom: '1.25rem'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Usuario o Correo:
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="custom-input-sm"
                style={{ paddingLeft: '2.5rem', width: '100%', height: '42px', fontSize: '0.95rem' }}
                placeholder="admin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Contraseña o PIN:
            </label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                className="custom-input-sm"
                style={{ paddingLeft: '2.5rem', width: '100%', height: '42px', fontSize: '0.95rem' }}
                placeholder="••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-confirm-order"
            style={{ height: '44px', marginTop: '0.5rem', fontSize: '0.95rem' }}
            disabled={loading}
          >
            <span>{loading ? 'Verificando credenciales...' : 'Ingresar a la Auditoría'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Quick hint for first time login */}
        <div style={{
          marginTop: '1.5rem',
          padding: '0.65rem 0.85rem',
          background: 'var(--bg-main)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          textAlign: 'center',
          border: '1px dashed var(--border-subtle)'
        }}>
          💡 <strong>Acceso inicial:</strong> Usuario: <code>admin</code> | PIN: <code>1234</code>
          <div style={{ marginTop: '2px' }}>Puedes cambiar estas credenciales una vez dentro.</div>
        </div>
      </div>
    </div>
  );
}
