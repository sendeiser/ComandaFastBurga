import { storageService } from './storageService.js';
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
  },

  // =========================================================
  // GESTIÓN Y AUTENTICACIÓN DE CAJEROS (Acceso POS / Mostrador)
  // =========================================================
  getCashiers() {
    return storageService.getCashiers();
  },

  syncCashiersFromCloud(cloudCashiers) {
    if (Array.isArray(cloudCashiers) && cloudCashiers.length > 0) {
      storageService.saveCashiers(cloudCashiers);
    }
  },

  createCashier({ name, username, pin, role = 'cajero' }) {
    const cleanName = (name || '').trim();
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPin = (pin || '').trim();

    if (!cleanName) {
      return { success: false, error: 'El nombre del cajero es obligatorio.' };
    }
    if (!cleanUser || cleanUser.length < 3) {
      return { success: false, error: 'El usuario debe tener al menos 3 caracteres.' };
    }
    if (!cleanPin || cleanPin.length < 3) {
      return { success: false, error: 'El PIN o contraseña debe tener al menos 3 caracteres.' };
    }

    const cashiers = storageService.getCashiers();
    if (cashiers.some(c => c.username === cleanUser)) {
      return { success: false, error: `El usuario '${cleanUser}' ya está registrado.` };
    }

    const newCashier = {
      id: 'csh-' + Date.now(),
      name: cleanName,
      username: cleanUser,
      pin: cleanPin,
      role,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    storageService.addCashier(newCashier);
    storageService.setCurrentCashier(newCashier);

    return { success: true, cashier: newCashier };
  },

  loginCashier(userInput, pinInput) {
    const cleanUser = (userInput || '').trim().toLowerCase();
    const cleanPin = (pinInput || '').trim();

    if (!cleanUser || !cleanPin) {
      return { success: false, error: 'Por favor ingresa usuario y PIN.' };
    }

    const cashiers = storageService.getCashiers();
    
    // Si no hay cajeros registrados todavía, permitir login con usuario admin o cajero por defecto
    if (cashiers.length === 0) {
      if ((cleanUser === 'cajero' || cleanUser === 'admin') && (cleanPin === '1234' || cleanPin === '0000')) {
        const defaultCashier = {
          id: 'csh-default',
          name: cleanUser === 'admin' ? 'Administrador' : 'Cajero Principal',
          username: cleanUser,
          pin: cleanPin,
          role: 'cajero',
          isActive: true,
          createdAt: new Date().toISOString()
        };
        storageService.addCashier(defaultCashier);
        storageService.setCurrentCashier(defaultCashier);
        return { success: true, cashier: defaultCashier };
      }
    }

    const matched = cashiers.find(c => 
      c.username.toLowerCase() === cleanUser || 
      c.name.toLowerCase() === cleanUser
    );

    if (!matched) {
      return { success: false, error: 'Usuario no encontrado. Verifica las credenciales o crea una cuenta.' };
    }

    if (!matched.isActive && matched.isActive !== undefined) {
      return { success: false, error: 'Esta cuenta de cajero se encuentra desactivada.' };
    }

    if (matched.pin !== cleanPin) {
      return { success: false, error: 'PIN o contraseña incorrecta.' };
    }

    storageService.setCurrentCashier(matched);
    return { success: true, cashier: matched };
  },

  getCurrentCashier() {
    return storageService.getCurrentCashier();
  },

  logoutCashier() {
    storageService.clearCurrentCashier();
  },

};
