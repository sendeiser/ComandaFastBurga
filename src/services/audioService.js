// =========================================================
// AUDIO SERVICE — SYNTHESIZED SOUNDS (NO EXTERNAL ASSETS)
// =========================================================

function isCatalogUrl() {
  if (typeof window === 'undefined') return false;
  try {
    const hash = (window.location.hash || '').toLowerCase();
    const search = (window.location.search || '').toLowerCase();
    const pathname = (window.location.pathname || '').toLowerCase();
    return (
      pathname === '/catalog' ||
      pathname === '/carta' ||
      pathname === '/menu' ||
      hash.startsWith('#catalog') ||
      hash.startsWith('#carta') ||
      hash.startsWith('#menu') ||
      hash.startsWith('#mesa') ||
      hash.includes('mesa=') ||
      hash.includes('catalog') ||
      search.includes('catalog') ||
      search.includes('mesa=') ||
      search.includes('table=')
    );
  } catch (_) {
    return false;
  }
}

class AudioService {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
  }

  playOrderChime() {
    if (isCatalogUrl()) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880.00, now + 0.1); // A5

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  playReadyBell() {
    if (isCatalogUrl()) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1046.50, now); // C6
      osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {}
  }

  playWhatsAppNotification() {
    if (isCatalogUrl()) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.setValueAtTime(1100, now + 0.08);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.28);
    } catch (_) {}
  }
}

export const audioService = new AudioService();
