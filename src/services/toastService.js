// Lightweight, zero-dependency Toast notification event emitter
class ToastService {
  constructor() {
    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify(message, type = 'info', duration = 3000) {
    const toast = {
      id: 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      message,
      type,
      duration
    };
    this.listeners.forEach(listener => listener(toast));
  }

  success(msg, dur) { this.notify(msg, 'success', dur); }
  info(msg, dur) { this.notify(msg, 'info', dur); }
  warning(msg, dur) { this.notify(msg, 'warning', dur); }
  error(msg, dur) { this.notify(msg, 'error', dur); }
}

export const toastService = new ToastService();
