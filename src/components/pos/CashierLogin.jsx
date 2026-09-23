import React, { useState, useEffect } from 'react';
import { 
  UserCheck, KeyRound, User, UserPlus, ArrowRight, Shield, 
  AlertCircle, CheckCircle2, Lock, Sparkles, Store, RefreshCw 
} from 'lucide-react';
import { authService } from '../../services/authService';
import { supabaseSync } from '../../services/supabaseClient';

export default function CashierLogin({ onLoginSuccess, onOpenOwner }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
  
  // Login form state
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [selectedCashier, setSelectedCashier] = useState(null);
  
  // Registration form state
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regConfirmPin, setRegConfirmPin] = useState('');
  
  // UI states
  const [cashiersList, setCashiersList] = useState([]);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load cashiers list from cache and cloud
  const refreshCashiers = async () => {
    const local = authService.getCashiers();
    setCashiersList(local);

    if (supabaseSync.isConfigured()) {
      try {
        const cloud = await supabaseSync.fetchCashiers();
        if (Array.isArray(cloud) && cloud.length > 0) {
          authService.syncCashiersFromCloud(cloud);
          setCashiersList(cloud);
        }
      } catch (_) {}
    }
  };

  useEffect(() => {
    refreshCashiers();
  }, []);

  // When a quick-pick cashier is selected
  const handleSelectCashier = (c) => {
    setSelectedCashier(c);
    setUsername(c.username);
    setPin('');
    setError(null);
  };

  // Numpad input for PIN
  const handleNumPadPress = (digit) => {
    if (activeTab === 'login') {
      if (pin.length < 8) setPin(prev => prev + digit);
    } else {
      if (regPin.length < 8) setRegPin(prev => prev + digit);
    }
  };

  const handleNumPadBackspace = () => {
    if (activeTab === 'login') {
      setPin(prev => prev.slice(0, -1));
    } else {
      setRegPin(prev => prev.slice(0, -1));
    }
  };

  const handleNumPadClear = () => {
    if (activeTab === 'login') {
      setPin('');
    } else {
      setRegPin('');
    }
  };

  // Submit Login
  const handleLoginSubmit = async (e) => {
    e?.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const userToLogin = selectedCashier ? selectedCashier.username : username;
    if (!userToLogin) {
      setError('Por favor ingresa o selecciona un cajero.');
      return;
    }
    if (!pin) {
      setError('Por favor ingresa el PIN de acceso.');
      return;
    }

    setLoading(true);

    // Try cloud first if configured
    let foundCashier = null;
    if (supabaseSync.isConfigured()) {
      try {
        const cloudCashiers = await supabaseSync.fetchCashiers();
        if (Array.isArray(cloudCashiers) && cloudCashiers.length > 0) {
          authService.syncCashiersFromCloud(cloudCashiers);
          setCashiersList(cloudCashiers);
          foundCashier = cloudCashiers.find(c => 
            c.username.toLowerCase() === userToLogin.trim().toLowerCase() && 
            String(c.pin).trim() === String(pin).trim()
          );
        }
      } catch (_) {}
    }

    // Fallback to local auth
    const res = authService.loginCashier(userToLogin, pin);
    setLoading(false);

    if (res.success || foundCashier) {
      const activeCashier = foundCashier || res.cashier;
      onLoginSuccess(activeCashier);
    } else {
      setError(res.error || 'Credenciales incorrectas.');
    }
  };

  // Submit Registration
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!regName.trim()) {
      setError('El nombre completo es requerido.');
      return;
    }
    if (!regUsername.trim() || regUsername.trim().length < 3) {
      setError('El nombre de usuario debe tener al menos 3 caracteres.');
      return;
    }
    if (!regPin || regPin.length < 3) {
      setError('El PIN debe tener al menos 3 dígitos o caracteres.');
      return;
    }
    if (regPin !== regConfirmPin) {
      setError('Los PINs no coinciden. Por favor verifícalos.');
      return;
    }

    setLoading(true);

    const res = authService.createCashier({
      name: regName.trim(),
      username: regUsername.trim().toLowerCase(),
      pin: regPin.trim(),
      role: 'cajero'
    });

    if (!res.success) {
      setLoading(false);
      setError(res.error);
      return;
    }

    const createdCashier = res.cashier;

    // Push to Supabase Cloud immediately
    if (supabaseSync.isConfigured()) {
      try {
        await supabaseSync.createCashier(createdCashier);
      } catch (err) {
        console.warn('[Supabase] Error al subir nuevo cajero a la nube:', err);
      }
    }

    setLoading(false);
    setSuccessMsg(`¡Cuenta creada con éxito para ${createdCashier.name}! Iniciando sesión...`);

    setTimeout(() => {
      onLoginSuccess(createdCashier);
    }, 800);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-main)',
      padding: '1rem',
      position: 'relative'
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem 1.75rem',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
        position: 'relative'
      }}>
        {/* Top Header / Branding */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.4))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 0.75rem',
            border: '2px solid var(--accent-amber)',
            boxShadow: '0 0 20px var(--accent-amber-glow)'
          }}>
            <UserCheck size={28} style={{ color: 'var(--accent-amber)' }} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
            Acceso de Cajeros • ComandaFast
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
            Inicia turno con tus credenciales o regístrate como cajero del local.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-input)',
          borderRadius: 'var(--radius-md)',
          padding: '4px',
          marginBottom: '1.25rem',
          border: '1px solid var(--border-subtle)'
        }}>
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setError(null); setSuccessMsg(null); }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'login' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'login' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'login' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: activeTab === 'login' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <KeyRound size={16} />
            <span>Iniciar Turno</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('register'); setError(null); setSuccessMsg(null); }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'register' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'register' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'register' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: activeTab === 'register' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <UserPlus size={16} />
            <span>Crear Cuenta Cajero</span>
          </button>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.65rem 0.85rem',
            color: 'var(--accent-rose)',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            marginBottom: '1rem'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.65rem 0.85rem',
            color: 'var(--accent-emerald)',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '1rem'
          }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1: INICIAR TURNO / LOGIN */}
        {activeTab === 'login' && (
          <div>
            {/* Quick-Pick Cajeros if any registered */}
            {cashiersList.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Seleccionar Cajero:
                </label>
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  paddingBottom: '4px'
                }}>
                  {cashiersList.map(c => {
                    const isSelected = selectedCashier?.username === c.username || username === c.username;
                    return (
                      <button
                        key={c.id || c.username}
                        type="button"
                        onClick={() => handleSelectCashier(c)}
                        style={{
                          flex: '0 0 auto',
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-full)',
                          border: isSelected ? '1.5px solid var(--accent-amber)' : '1px solid var(--border-subtle)',
                          background: isSelected ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-input)',
                          color: isSelected ? 'var(--accent-amber)' : 'var(--text-secondary)',
                          fontSize: '0.8rem',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <User size={14} />
                        <span>{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Usuario de Cajero:
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="custom-input-sm"
                    style={{ paddingLeft: '2.4rem', width: '100%', height: '40px', fontSize: '0.9rem' }}
                    placeholder="ej: lucas, cajero1"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setSelectedCashier(null); }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  PIN o Contraseña:
                </label>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    className="custom-input-sm"
                    style={{ paddingLeft: '2.4rem', width: '100%', height: '40px', fontSize: '1rem', letterSpacing: '0.15em' }}
                    placeholder="••••"
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Mini Touch Numpad */}
              <div style={{
                marginTop: '0.25rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '6px'
              }}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(btn => (
                  <button
                    key={btn}
                    type="button"
                    onClick={() => {
                      if (btn === 'C') handleNumPadClear();
                      else if (btn === '⌫') handleNumPadBackspace();
                      else handleNumPadPress(btn);
                    }}
                    style={{
                      height: '38px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: '1rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.1s ease'
                    }}
                  >
                    {btn}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className="btn-confirm-order"
                style={{ height: '44px', marginTop: '0.4rem', fontSize: '0.92rem' }}
                disabled={loading}
              >
                <span>{loading ? 'Verificando...' : 'Iniciar Turno en POS'}</span>
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: CREAR CUENTA DE CAJERO */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Nombre y Apellido del Cajero:
              </label>
              <div style={{ position: 'relative' }}>
                <User size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="custom-input-sm"
                  style={{ paddingLeft: '2.4rem', width: '100%', height: '40px', fontSize: '0.9rem' }}
                  placeholder="ej: Lucas Gómez"
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Usuario / Identificador:
              </label>
              <div style={{ position: 'relative' }}>
                <Store size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="custom-input-sm"
                  style={{ paddingLeft: '2.4rem', width: '100%', height: '40px', fontSize: '0.9rem' }}
                  placeholder="ej: lucas (sin espacios)"
                  value={regUsername}
                  onChange={e => setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  PIN (4-8 dígitos):
                </label>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={17} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    className="custom-input-sm"
                    style={{ paddingLeft: '2.2rem', width: '100%', height: '40px', fontSize: '0.95rem' }}
                    placeholder="1234"
                    value={regPin}
                    onChange={e => setRegPin(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Confirmar PIN:
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={17} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    className="custom-input-sm"
                    style={{ paddingLeft: '2.2rem', width: '100%', height: '40px', fontSize: '0.95rem' }}
                    placeholder="1234"
                    value={regConfirmPin}
                    onChange={e => setRegConfirmPin(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn-confirm-order"
              style={{ height: '44px', marginTop: '0.4rem', fontSize: '0.92rem' }}
              disabled={loading}
            >
              <UserPlus size={18} />
              <span>{loading ? 'Registrando en base de datos...' : 'Crear Cuenta y Entrar'}</span>
            </button>
          </form>
        )}

        {/* Footer Link to Owner Portal */}
        <div style={{
          marginTop: '1.25rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            ¿Eres el dueño del local?
          </span>
          <button
            type="button"
            onClick={onOpenOwner}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-amber)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 6px'
            }}
          >
            <Shield size={14} />
            <span>Portal de Auditoría →</span>
          </button>
        </div>
      </div>
    </div>
  );
}
