// =========================================================
// BOT UPDATE SERVICE (OTA & Git Updater desde Repositorio)
// Permite comprobar y aplicar actualizaciones de versiones
// directamente desde GitHub para el servidor y bot portátil.
// =========================================================

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const REPO_OWNER = 'sendeiser';
const REPO_NAME = 'ComandaFastBurga';
const REPO_BRANCH = 'main';
const GITHUB_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/${REPO_BRANCH}`;
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/sendeiser/${REPO_NAME}/${REPO_BRANCH}`;

// Archivos esenciales del bot que se actualizan en modo portable
const BOT_FILES_TO_SYNC = [
  'server/whatsappBotServer.js',
  'server/geminiBotService.js',
  'server/printerServer.js',
  'server/botUpdateService.js',
  'package.json'
];

class BotUpdateService {
  constructor() {
    this.rootDir = process.cwd();
    this.dataDir = path.join(this.rootDir, 'data');
    this.versionFile = path.join(this.dataDir, 'bot_version.json');
    this.restartTriggerFile = path.join(this.rootDir, '.restart_trigger');
    this.ensureDataDir();
  }

  ensureDataDir() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch (_) {}
  }

  // Obtener versión / commit local activo
  getLocalVersion() {
    // 1. Intentar leer desde git si existe la carpeta .git
    const gitDir = path.join(this.rootDir, '.git');
    if (fs.existsSync(gitDir)) {
      try {
        const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8', timeout: 5000 }).trim();
        const msg = execSync('git log -1 --format=%s', { encoding: 'utf-8', timeout: 5000 }).trim();
        const date = execSync('git log -1 --format=%cI', { encoding: 'utf-8', timeout: 5000 }).trim();
        return {
          commit: sha,
          message: msg,
          date: date,
          source: 'git'
        };
      } catch (_) {}
    }

    // 2. Intentar leer desde data/bot_version.json
    try {
      if (fs.existsSync(this.versionFile)) {
        const raw = JSON.parse(fs.readFileSync(this.versionFile, 'utf-8'));
        if (raw && raw.commit) {
          return { ...raw, source: 'file' };
        }
      }
    } catch (_) {}

    // 3. Fallback por defecto inicial
    return {
      commit: 'c57af28',
      message: 'Versión inicial instalada',
      date: new Date().toISOString(),
      source: 'default'
    };
  }

  // Guardar versión local actualizada
  saveLocalVersion(info) {
    try {
      this.ensureDataDir();
      const current = this.getLocalVersion();
      const merged = {
        ...current,
        ...info,
        updatedAt: new Date().toISOString()
      };
      fs.writeFileSync(this.versionFile, JSON.stringify(merged, null, 2), 'utf-8');
      return merged;
    } catch (err) {
      console.warn('⚠️ [BOT UPDATER] No se pudo guardar bot_version.json:', err.message);
      return info;
    }
  }

  // Consultar en GitHub si hay nuevos commits
  async checkUpdates() {
    const local = this.getLocalVersion();
    try {
      const response = await fetch(GITHUB_API_URL, {
        headers: {
          'User-Agent': 'ComandaFast-Bot-Updater',
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const latestSha = data.sha || '';
      const latestShortSha = latestSha.slice(0, 7);
      const commitObj = data.commit || {};
      const commitMsg = (commitObj.message || '').split(/\r?\n/)[0];
      const commitDate = commitObj.author?.date || commitObj.committer?.date || '';
      const commitAuthor = commitObj.author?.name || 'ComandaFast Team';

      const localShort = (local.commit || '').slice(0, 7).toLowerCase();
      const remoteShort = latestShortSha.toLowerCase();
      const hasUpdate = Boolean(remoteShort && localShort !== remoteShort);

      return {
        success: true,
        hasUpdate,
        currentCommit: localShort || local.commit,
        latestCommit: latestShortSha,
        fullSha: latestSha,
        commitMessage: commitMsg,
        commitDate: commitDate ? new Date(commitDate).toLocaleString('es-AR') : '',
        commitAuthor: commitAuthor,
        repo: `${REPO_OWNER}/${REPO_NAME}`,
        branch: REPO_BRANCH,
        checkedAt: new Date().toLocaleString('es-AR')
      };
    } catch (err) {
      console.error('❌ [BOT UPDATER] Error al verificar actualizaciones en GitHub:', err.message);
      return {
        success: false,
        error: err.message,
        currentCommit: local.commit,
        checkedAt: new Date().toLocaleString('es-AR')
      };
    }
  }

  // Aplicar actualización desde el repositorio
  async applyUpdate() {
    console.log('\n=========================================================');
    console.log('🔄 [BOT UPDATER] Iniciando proceso de actualización desde GitHub...');
    console.log('=========================================================\n');

    const updateCheck = await this.checkUpdates();
    if (!updateCheck.success) {
      throw new Error(`No se pudo verificar la actualización: ${updateCheck.error}`);
    }

    const isGitRepo = fs.existsSync(path.join(this.rootDir, '.git'));
    const results = {
      method: isGitRepo ? 'git_pull' : 'ota_download',
      previousCommit: updateCheck.currentCommit,
      newCommit: updateCheck.latestCommit,
      commitMessage: updateCheck.commitMessage,
      updatedFiles: [],
      timestamp: new Date().toISOString()
    };

    // MÉTODO 1: Si hay repositorio Git local
    if (isGitRepo) {
      try {
        console.log('  -> Detectado repositorio Git. Ejecutando git pull origin main...');
        const gitOutput = execSync(`git pull origin ${REPO_BRANCH}`, {
          cwd: this.rootDir,
          encoding: 'utf-8',
          timeout: 45000
        });
        console.log('  -> [OK] Git pull completado exitosamente.');
        results.gitOutput = gitOutput.trim();
        results.updatedFiles = ['Repositorio sincronizado via Git'];
      } catch (gitErr) {
        console.warn('  -> git pull falló, intentando método de descarga directa OTA...', gitErr.message);
        await this.downloadOtaFiles(results);
      }
    } else {
      // MÉTODO 2: Modo Portable (descarga directa archivo por archivo conservando sesiones y .env)
      await this.downloadOtaFiles(results);
    }

    // Actualizar registro de versión local
    this.saveLocalVersion({
      commit: updateCheck.latestCommit,
      fullSha: updateCheck.fullSha,
      message: updateCheck.commitMessage,
      date: updateCheck.commitDate,
      author: updateCheck.commitAuthor
    });

    console.log(`\n✅ [BOT UPDATER] ¡Actualización completada a la versión [${updateCheck.latestCommit}]!`);
    return results;
  }

  // Descarga directa de archivos de código desde raw.githubusercontent.com
  async downloadOtaFiles(results) {
    console.log('  -> Descargando últimos archivos de código desde GitHub...');
    for (const relFile of BOT_FILES_TO_SYNC) {
      const fileUrl = `${GITHUB_RAW_BASE}/${relFile}?t=${Date.now()}`;
      const destPath = path.join(this.rootDir, relFile);

      try {
        const res = await fetch(fileUrl, {
          headers: { 'User-Agent': 'ComandaFast-Bot-Updater' }
        });

        if (!res.ok) {
          console.warn(`  -> Saltando ${relFile} (HTTP ${res.status})`);
          continue;
        }

        const newContent = await res.text();
        if (!newContent || newContent.trim().length === 0) {
          continue;
        }

        // Crear directorio destino si no existe
        const dir = path.dirname(destPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        // Crear respaldo .bak del archivo actual
        if (fs.existsSync(destPath)) {
          try {
            fs.copyFileSync(destPath, destPath + '.bak');
          } catch (_) {}
        }

        fs.writeFileSync(destPath, newContent, 'utf-8');
        results.updatedFiles.push(relFile);
        console.log(`  -> [OK] ${relFile} actualizado.`);
      } catch (downloadErr) {
        console.error(`  -> [ERROR] Falló descarga de ${relFile}:`, downloadErr.message);
      }
    }
  }

  // Programar reinicio limpio del proceso
  scheduleRestart(delayMs = 2500) {
    try {
      fs.writeFileSync(this.restartTriggerFile, Date.now().toString(), 'utf-8');
      console.log(`♻️ [BOT UPDATER] Bandera de reinicio creada (.restart_trigger). Reiniciando en ${delayMs}ms...`);
    } catch (_) {}

    setTimeout(() => {
      console.log('👋 [BOT UPDATER] Reiniciando proceso...');
      process.exit(0);
    }, delayMs);
  }
}

export const botUpdateService = new BotUpdateService();

// Soporte para ejecución directa desde terminal: node server/botUpdateService.js [check|apply]
if (process.argv[1] && process.argv[1].endsWith('botUpdateService.js')) {
  const action = process.argv[2] || 'check';
  if (action === 'check') {
    botUpdateService.checkUpdates().then(info => {
      console.log('\n📊 [ESTADO DE ACTUALIZACIÓN]');
      console.log('Versión actual:   ', info.currentCommit);
      console.log('Versión en GitHub:', info.latestCommit);
      console.log('¿Hay nueva versión?:', info.hasUpdate ? '¡SÍ! Hay cambios disponibles' : 'No, estás al día');
      if (info.hasUpdate) {
        console.log('Último commit:    ', info.commitMessage);
        console.log('Fecha commit:     ', info.commitDate);
      }
    }).catch(err => {
      console.error(err);
      process.exitCode = 1;
    });
  } else if (action === 'apply' || action === 'update') {
    botUpdateService.applyUpdate().then(res => {
      console.log('\n🎉 [ÉXITO]');
      console.log('Archivos actualizados:', res.updatedFiles);
    }).catch(err => {
      console.error(err);
      process.exitCode = 1;
    });
  }
}
