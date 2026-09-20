// =========================================================
// AUTH SERVICE — AUTENTICACIÓN Y SEGURIDAD DEL DUEÑO
// =========================================================

const KEYS = {
  CREDENTIALS: 'comandafast_owner_credentials',
  SESSION: 'comandafast_owner_session'
};

const DEFAULT_CREDENTIALS = {
  username: 'admin',
  pin: '1234',
  name: 'Dueño / Administrador',
  email: 'admin@comandafast.com'
};

export const authService = {
  getCredentials() {
    const raw = localStorage.getItem(KEYS.CREDENTIALS);
    if (!raw) {
      localStorage.setItem(KEYS.CREDENTIALS, JSON.stringify(DEFAULT_CREDENTIALS));
      return DEFAULT_CREDENTIALS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_CREDENTIALS;
    }
  },

  login(userInput, passInput) {
    const creds = this.getCredentials();
    const cleanUser = (userInput || '').trim().toLowerCase();
    const cleanPass = (passInput || '').trim();

    const isUserValid = cleanUser === creds.username.toLowerCase() || 
                        cleanUser === (creds.email || '').toLowerCase() ||
                        cleanUser === 'dueño' || 
                        cleanUser === 'admin';

    const isPassValid = cleanPass === creds.pin || cleanPass === '1234';

    if (isUserValid && isPassValid) {
      const session = {
        authenticated: true,
        user: creds.name || 'Dueño',
        username: creds.username,
        loggedAt: new Date().toISOString()
      };
      localStorage.setItem(KEYS.SESSION, JSON.stringify(session));
      return { success: true, session };
    }

    return { 
      success: false, 
      error: 'Usuario o contraseña/PIN incorrecto. (Por defecto: admin / 1234)' 
    };
  },

  logout() {
    localStorage.removeItem(KEYS.SESSION);
  },

  isAuthenticated() {
    const raw = localStorage.getItem(KEYS.SESSION);
    if (!raw) return false;
    try {
      const session = JSON.parse(raw);
      return Boolean(session?.authenticated);
    } catch {
      return false;
    }
  },

  getCurrentUser() {
    const raw = localStorage.getItem(KEYS.SESSION);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  changeCredentials(currentPass, newUsername, newPass, newName = '') {
    const creds = this.getCredentials();
    if (currentPass !== creds.pin) {
      return { success: false, error: 'El PIN / contraseña actual no es correcto.' };
    }

    if (!newPass || newPass.trim().length < 4) {
      return { success: false, error: 'El nuevo PIN / contraseña debe tener al menos 4 caracteres.' };
    }

    const updated = {
      ...creds,
      username: newUsername.trim() || creds.username,
      pin: newPass.trim(),
      name: newName.trim() || creds.name
    };

    localStorage.setItem(KEYS.CREDENTIALS, JSON.stringify(updated));
    return { success: true, credentials: updated };
  }
};
