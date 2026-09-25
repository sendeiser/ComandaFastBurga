import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Bot, Sparkles, Key, Download, Terminal, Settings, ShieldCheck, QrCode, 
  Smartphone, CheckCircle2, Save, RotateCcw, Plus, 
  Trash2, Copy, Check, Info, Zap, AlertCircle, RefreshCw,
  Power, Wifi, WifiOff, ExternalLink, Clock, UserCheck, MessageSquare, Store,
  Timer, Play, Gauge, ChevronLeft, ChevronRight, FileText, GitBranch, Variable
} from 'lucide-react';
import AdminBotFlowsTab from './AdminBotFlowsTab';
import AdminBotVariablesTab from './AdminBotVariablesTab';
import { 
  ALL_TEMPLATE_NODES, 
  DEFAULT_TEMPLATES, 
  DEFAULT_CHATBOT_KEYWORDS,
  DEFAULT_ANTI_LOOP_GRATITUDE,
  DEFAULT_ANTI_LOOP_FAREWELL,
  DEFAULT_ANTI_LOOP_ACKNOWLEDGE,
  DEFAULT_ANTI_LOOP_RESPONSES
} from '../../../services/whatsappBotConstants';
import { chatbotService } from '../../../services/chatbotService';
import { supabaseSync } from '../../../services/supabaseClient';

const isLocalNetwork = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.')
);
const isSecureHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
const BOT_SERVER_URL = (!isSecureHttps && isLocalNetwork)
  ? `http://${window.location.hostname}:3002`
  : null;

export default function AdminWhatsAppBot({ initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'connection'); // 'connection' | 'flows' | 'variables' | 'ai' | 'templates' | 'security'
  const [settings, setSettings] = useState(chatbotService.getSettings());
  const [flows, setFlows] = useState(() => chatbotService.getCustomFlows());
  const [isCloudBridge, setIsCloudBridge] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    // 1. Cargar plantillas actualizadas desde Supabase Cloud
    chatbotService.fetchCloudTemplates().then(cloudTpls => {
      if (cloudTpls) {
        setSettings(prev => {
          const merged = { ...prev, ...cloudTpls };
          if (merged[selectedNodeId]) {
            setCurrentNodeText(merged[selectedNodeId]);
          }
          return merged;
        });
      }
    });

    // 2. Cargar flujos desde Supabase Cloud y servidor local
    chatbotService.fetchCloudFlows().then(cloudFlows => {
      if (Array.isArray(cloudFlows) && cloudFlows.length > 0) {
        setFlows(cloudFlows);
      } else {
        chatbotService.fetchServerFlows().then(serverFlows => {
          if (Array.isArray(serverFlows) && serverFlows.length > 0) {
            setFlows(serverFlows);
          }
        });
      }
    });
  }, []);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Template editor
  const [templateFilterCategory, setTemplateFilterCategory] = useState('all');
  const [selectedNodeId, setSelectedNodeId] = useState('template_menu');
  const [currentNodeText, setCurrentNodeText] = useState(settings.template_menu || DEFAULT_TEMPLATES.template_menu);

  // Security editor
  const [newKeyword, setNewKeyword] = useState('');
  const [newIgnoredPhone, setNewIgnoredPhone] = useState('');
  const [newIgnoredLabel, setNewIgnoredLabel] = useState('');
  const [antiLoopCategoryFilter, setAntiLoopCategoryFilter] = useState('all');
  const [newAntiLoopWord, setNewAntiLoopWord] = useState('');
  const [newAntiLoopCategory, setNewAntiLoopCategory] = useState('gratitude');
  const [antiLoopSearch, setAntiLoopSearch] = useState('');
  const [savingAntiLoop, setSavingAntiLoop] = useState(false);
  const [antiLoopSaveMsg, setAntiLoopSaveMsg] = useState('');

  // Typing delay test & status states
  const [testingTyping, setTestingTyping] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [testCompletedMsg, setTestCompletedMsg] = useState(null);
  const [typingSaveMsg, setTypingSaveMsg] = useState('');

  // Live Baileys Server Connection State
  const [serverOnline, setServerOnline] = useState(false);

  // AI Gemini State
    // AI Gemini State (Con soporte Dual Key & Auto-Failover)
  // AI Multi-Provider State (Groq + Gemini + DeepSeek con Cascada y Modo Individual)
  const [aiConfig, setAiConfig] = useState({
    enabled: true,
    mode: 'cascade', // 'cascade' | 'only_groq' | 'only_gemini' | 'only_deepseek'
    model: 'gemini-2.0-flash',
    groqApiKey: '',
    hasGroq: false,
    groqApiKeyMasked: '',
    geminiApiKey: (typeof atob === 'function' ? atob('QVEuQWI4Uk42S1pNWmJTTENxMDhNNVVXbVVJdXp3RWdWZkxadVFMdHJJeFJOMnRYdXNCeEE=') : ''),
    hasGemini: true,
    geminiApiKeyMasked: 'AQ.Ab8...sBxA',
    deepseekApiKey: '',
    hasDeepSeek: false,
    deepseekApiKeyMasked: '',
    systemPrompt: ''
  });
  const [aiTestLoading, setAiTestLoading] = useState(false);
  const [aiTestResult, setAiTestResult] = useState(null);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showDeepSeekKey, setShowDeepSeekKey] = useState(false);
  const [aiSavedSuccess, setAiSavedSuccess] = useState(false);

  // Fetch AI Config from bot server or Supabase Cloud
  const fetchAiConfig = useCallback(async () => {
    try {
      if (supabaseSync.isConfigured()) {
        const cloudConfig = await supabaseSync.fetchAiConfig();
        if (cloudConfig && typeof cloudConfig === 'object') {
          setAiConfig(prev => ({
            ...prev,
            ...cloudConfig,
            groqApiKey: cloudConfig.groqApiKeyMasked || cloudConfig.groqApiKey || prev.groqApiKey,
            geminiApiKey: cloudConfig.geminiApiKeyMasked || cloudConfig.geminiApiKey || cloudConfig.apiKeyMasked || prev.geminiApiKey,
            deepseekApiKey: cloudConfig.deepseekApiKeyMasked || cloudConfig.deepseekApiKey || prev.deepseekApiKey,
            mode: cloudConfig.mode || 'cascade'
          }));
          return;
        }
      }
      if (BOT_SERVER_URL) {
        const res = await fetch(`${BOT_SERVER_URL}/api/ai/config`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.config) {
            setAiConfig(prev => ({
              ...prev,
              ...data.config,
              groqApiKey: data.config.groqApiKeyMasked || data.config.groqApiKey || prev.groqApiKey,
              geminiApiKey: data.config.geminiApiKeyMasked || data.config.geminiApiKey || prev.geminiApiKey,
              deepseekApiKey: data.config.deepseekApiKeyMasked || data.config.deepseekApiKey || prev.deepseekApiKey,
              mode: data.config.mode || 'cascade'
            }));
          }
        }
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchAiConfig();
  }, [fetchAiConfig]);

  // Anti-Ban & Modo Humano (Chats pausados por operador)
  const [pausedChats, setPausedChats] = useState([]);
  const [loadingPausedChats, setLoadingPausedChats] = useState(false);

  const fetchHumanModeChats = useCallback(async () => {
    try {
      setLoadingPausedChats(true);
      if (supabaseSync.isConfigured()) {
        const cloudStatus = await supabaseSync.fetchBotConfig('server_status');
        if (cloudStatus && Array.isArray(cloudStatus.activeChats)) {
          setPausedChats(cloudStatus.activeChats);
          return;
        }
      }
      if (BOT_SERVER_URL) {
        const res = await fetch(`${BOT_SERVER_URL}/api/human-mode/chats`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.chats)) {
            setPausedChats(data.chats);
          }
        }
      }
    } catch (_) {} finally {
      setLoadingPausedChats(false);
    }
  }, []);

  const handleResumeChat = async (jid) => {
    try {
      if (supabaseSync.isConfigured()) {
        await supabaseSync.saveBotConfig('server_commands', {
          id: 'cmd-' + Date.now(),
          action: 'resume_chat',
          jid,
          timestamp: Date.now(),
          status: 'pending'
        });
      }
      if (BOT_SERVER_URL) {
        await fetch(`${BOT_SERVER_URL}/api/human-mode/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jid })
        }).catch(() => {});
      }
      setPausedChats(prev => prev.filter(c => c.jid !== jid));
    } catch (_) {}
  };

  useEffect(() => {
    if (activeTab === 'security') {
      fetchHumanModeChats();
      const interval = setInterval(fetchHumanModeChats, 8000);
      return () => clearInterval(interval);
    }
  }, [activeTab, fetchHumanModeChats]);

  const handleSaveAiConfig = async () => {
    try {
      const payload = {
        enabled: aiConfig.enabled,
        mode: aiConfig.mode || 'cascade',
        model: aiConfig.model,
        systemPrompt: aiConfig.systemPrompt
      };
      if (aiConfig.groqApiKey && !aiConfig.groqApiKey.includes('...')) {
        payload.groqApiKey = aiConfig.groqApiKey;
      }
      if (aiConfig.geminiApiKey && !aiConfig.geminiApiKey.includes('...')) {
        payload.geminiApiKey = aiConfig.geminiApiKey;
      }
      if (aiConfig.deepseekApiKey && !aiConfig.deepseekApiKey.includes('...')) {
        payload.deepseekApiKey = aiConfig.deepseekApiKey;
      }

      if (supabaseSync.isConfigured()) {
        await supabaseSync.saveAiConfig(payload);
      }
      if (BOT_SERVER_URL) {
        await fetch(`${BOT_SERVER_URL}/api/ai/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => {});
      }
      setAiSavedSuccess(true);
      setTimeout(() => setAiSavedSuccess(false), 3000);
      fetchAiConfig();
    } catch (err) {
      console.error('Error al guardar configuración de IA:', err);
    }
  };

  const handleTestAiConnection = async () => {
    setAiTestLoading(true);
    setAiTestResult(null);
    try {
      const payload = {
        target: aiConfig.mode || 'cascade'
      };
      if (BOT_SERVER_URL) {
        const res = await fetch(`${BOT_SERVER_URL}/api/ai/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          setAiTestResult({ success: true, message: data.message || `✅ ¡Conexión exitosa con la IA!` });
        } else {
          setAiTestResult({ success: false, message: `❌ ${data.error || data.message || 'No se pudo conectar con la IA.'}` });
        }
      } else {
        setAiTestResult({ success: true, message: '✅ Ajustes listos en Supabase Cloud. El bot los sincronizará automáticamente.' });
      }
    } catch (err) {
      setAiTestResult({ success: false, message: '❌ Servidor desconectado o error de red.' });
    } finally {
      setAiTestLoading(false);
    }
  };

  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
  const [qrCodeData, setQrCodeData] = useState(null);
  const [connectedUser, setConnectedUser] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);

  // 1. Consultar estado del microservicio Baileys (Local o Supabase Cloud Bridge)
  const fetchServerStatus = useCallback(async () => {
    let isOnline = false;
    let data = null;
    let viaCloud = false;

    // A. Si estamos en red local y HTTP, intentar endpoint local directo (puerto 3002)
    if (BOT_SERVER_URL) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800);
        const res = await fetch(`${BOT_SERVER_URL}/status`, { 
          cache: 'no-store',
          signal: controller.signal 
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          data = await res.json();
          isOnline = true;
          viaCloud = false;
        }
      } catch (_) {}
    }

    // B. Si no respondió localmente o estamos en Producción (Netlify / HTTPS), consultar Supabase Cloud
    if (!isOnline && supabaseSync.isConfigured()) {
      try {
        const cloudData = await supabaseSync.fetchBotConfig('server_status');
        if (cloudData && cloudData.timestamp) {
          const diffMs = Date.now() - Number(cloudData.timestamp);
          // Si el latido fue recibido hace menos de 30 segundos y el servidor reporta online
          if (diffMs < 30000 && cloudData.serverOnline !== false) {
            data = cloudData;
            isOnline = true;
            viaCloud = true;
          } else if (cloudData.status === 'connected' && diffMs < 60000) {
            data = cloudData;
            isOnline = true;
            viaCloud = true;
          }
        }
      } catch (_) {}
    }

    if (isOnline && data) {
      setServerOnline(true);
      setConnectionStatus(data.status || 'disconnected');
      setQrCodeData(data.qrCode || null);
      setConnectedUser(data.user || null);
      setIsCloudBridge(viaCloud);
    } else {
      setServerOnline(false);
      setConnectionStatus('disconnected');
      setQrCodeData(null);
      setIsCloudBridge(false);
    }
  }, []);

  // Polling automático cuando está en la pestaña de conexión o esperando QR
  useEffect(() => {
    fetchServerStatus();
    const interval = setInterval(() => {
      fetchServerStatus();
    }, 3500);
    return () => clearInterval(interval);
  }, [fetchServerStatus]);

  // Actualizar plantilla al cambiar de nodo
  useEffect(() => {
    setCurrentNodeText(settings[selectedNodeId] || DEFAULT_TEMPLATES[selectedNodeId] || '');
  }, [selectedNodeId, settings]);

  const handleSaveSettings = async () => {
    const updated = {
      ...settings,
      [selectedNodeId]: currentNodeText
    };
    setSettings(updated);
    await chatbotService.saveSettings(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetTemplate = () => {
    const defaultVal = DEFAULT_TEMPLATES[selectedNodeId] || '';
    setCurrentNodeText(defaultVal);
    const updated = { ...settings, [selectedNodeId]: defaultVal };
    setSettings(updated);
    chatbotService.saveSettings(updated);
  };

  const handleAddKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (!kw) return;
    if (!settings.chatbot_keywords.includes(kw)) {
      const updated = { ...settings, chatbot_keywords: [...settings.chatbot_keywords, kw] };
      setSettings(updated);
      chatbotService.saveSettings(updated);
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kwToRemove) => {
    const updated = {
      ...settings,
      chatbot_keywords: settings.chatbot_keywords.filter(k => k !== kwToRemove)
    };
    setSettings(updated);
    chatbotService.saveSettings(updated);
  };

  const handleAddIgnoredNumber = () => {
    if (!newIgnoredPhone.trim()) return;
    const item = {
      id: 'ign-' + Date.now(),
      phone: newIgnoredPhone.trim(),
      label: newIgnoredLabel.trim() || 'Contacto Personal'
    };
    const updated = {
      ...settings,
      ignored_numbers: [...(settings.ignored_numbers || []), item]
    };
    setSettings(updated);
    chatbotService.saveSettings(updated);
    setNewIgnoredPhone('');
    setNewIgnoredLabel('');
  };

  const handleRemoveIgnoredNumber = (id) => {
    const updated = {
      ...settings,
      ignored_numbers: (settings.ignored_numbers || []).filter(i => i.id !== id)
    };
    setSettings(updated);
    chatbotService.saveSettings(updated);
  };

  const handleUpdateSleepMinutes = (val) => {
    const mins = Math.max(1, Math.min(240, Number(val) || 25));
    const updated = {
      ...settings,
      human_mode_sleep_minutes: mins
    };
    setSettings(updated);
    chatbotService.saveSettings(updated);
  };

  const handleUpdateTypingDelay = (val, mode = null) => {
    const delayMs = Math.max(500, Math.min(15000, Number(val) || 2500));
    const targetMode = mode || settings.bot_typing_mode || 'human_dynamic';
    const updated = {
      ...settings,
      bot_typing_delay_ms: delayMs,
      bot_typing_mode: targetMode
    };
    setSettings(updated);
    chatbotService.saveSettings(updated);
    setTypingSaveMsg(`✅ Guardado: ${delayMs} ms (${(delayMs / 1000).toFixed(1)}s)`);
    setSaveSuccess(true);
    setTimeout(() => {
      setTypingSaveMsg('');
      setSaveSuccess(false);
    }, 2800);
  };

  const handleTestTyping = () => {
    if (testingTyping) return;
    setTestingTyping(true);
    setTestCompletedMsg(null);
    setTestProgress(0);

    const targetMs = Number(settings.bot_typing_delay_ms) || 2500;
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / targetMs) * 100));
      setTestProgress(pct);
      if (elapsed >= targetMs) {
        clearInterval(interval);
        setTestingTyping(false);
        setTestProgress(100);
        setTestCompletedMsg(`¡Mensaje despachado tras ${(targetMs / 1000).toFixed(1)} segundos! (Simulación de tipeo completada)`);
        setTimeout(() => setTestCompletedMsg(null), 5000);
      }
    }, 30);
  };

  const handleAddAntiLoopWord = async () => {
    const word = newAntiLoopWord.trim().toLowerCase();
    if (!word) return;

    const targetKey = newAntiLoopCategory === 'gratitude' 
      ? 'anti_loop_gratitude' 
      : newAntiLoopCategory === 'farewell' 
        ? 'anti_loop_farewell' 
        : 'anti_loop_acknowledge';

    const currentList = Array.isArray(settings[targetKey]) ? settings[targetKey] : (
      newAntiLoopCategory === 'gratitude' 
        ? DEFAULT_ANTI_LOOP_GRATITUDE 
        : newAntiLoopCategory === 'farewell' 
          ? DEFAULT_ANTI_LOOP_FAREWELL 
          : DEFAULT_ANTI_LOOP_ACKNOWLEDGE
    );

    if (!currentList.includes(word)) {
      const updated = {
        ...settings,
        [targetKey]: [...currentList, word]
      };
      setSettings(updated);
      setSavingAntiLoop(true);
      await chatbotService.saveSettings(updated);
      setSavingAntiLoop(false);
      setAntiLoopSaveMsg(`Palabra "${word}" guardada en la Base de Datos`);
      setTimeout(() => setAntiLoopSaveMsg(''), 3000);
    }
    setNewAntiLoopWord('');
  };

  const handleRemoveAntiLoopWord = async (category, wordToRemove) => {
    const targetKey = category === 'gratitude' 
      ? 'anti_loop_gratitude' 
      : category === 'farewell' 
        ? 'anti_loop_farewell' 
        : 'anti_loop_acknowledge';

    const currentList = Array.isArray(settings[targetKey]) ? settings[targetKey] : (
      category === 'gratitude' 
        ? DEFAULT_ANTI_LOOP_GRATITUDE 
        : category === 'farewell' 
          ? DEFAULT_ANTI_LOOP_FAREWELL 
          : DEFAULT_ANTI_LOOP_ACKNOWLEDGE
    );

    const updated = {
      ...settings,
      [targetKey]: currentList.filter(w => w !== wordToRemove)
    };
    setSettings(updated);
    setSavingAntiLoop(true);
    await chatbotService.saveSettings(updated);
    setSavingAntiLoop(false);
    setAntiLoopSaveMsg(`Palabra eliminada y guardada en la Base de Datos`);
    setTimeout(() => setAntiLoopSaveMsg(''), 3000);
  };

  const isAntiLoopActive = settings.anti_loop_enabled !== false;

  const handleToggleAntiLoopEnabled = async () => {
    const nextState = !isAntiLoopActive;
    const updated = {
      ...settings,
      anti_loop_enabled: nextState
    };
    setSettings(updated);
    setSavingAntiLoop(true);
    await chatbotService.saveSettings(updated);
    setSavingAntiLoop(false);
    setAntiLoopSaveMsg(nextState 
      ? '✅ Filtro Anti-Bucle y Respuestas activados (Guardado en BD)' 
      : '⚠️ Filtro Anti-Bucle y Respuestas desactivados (Guardado en BD)'
    );
    setTimeout(() => setAntiLoopSaveMsg(''), 3500);
  };

  const handleResetAntiLoopWords = async () => {
    const updated = {
      ...settings,
      anti_loop_enabled: true,
      anti_loop_gratitude: DEFAULT_ANTI_LOOP_GRATITUDE,
      anti_loop_farewell: DEFAULT_ANTI_LOOP_FAREWELL,
      anti_loop_acknowledge: DEFAULT_ANTI_LOOP_ACKNOWLEDGE,
      template_anti_loop_gratitude: DEFAULT_ANTI_LOOP_RESPONSES.template_anti_loop_gratitude,
      template_anti_loop_farewell: DEFAULT_ANTI_LOOP_RESPONSES.template_anti_loop_farewell,
      template_anti_loop_acknowledge: DEFAULT_ANTI_LOOP_RESPONSES.template_anti_loop_acknowledge
    };
    setSettings(updated);
    setSavingAntiLoop(true);
    await chatbotService.saveSettings(updated);
    setSavingAntiLoop(false);
    setAntiLoopSaveMsg('Filtro y respuestas restablecidos por defecto en la Base de Datos');
    setTimeout(() => setAntiLoopSaveMsg(''), 3000);
  };

  const handleUpdateAntiLoopReply = (key, text) => {
    setSettings(prev => ({
      ...prev,
      [key]: text
    }));
  };

  const handleSaveAntiLoopReplies = async () => {
    setSavingAntiLoop(true);
    await chatbotService.saveSettings(settings);
    setSavingAntiLoop(false);
    setAntiLoopSaveMsg('✅ Frases y Respuestas Inteligentes guardadas en la Base de Datos');
    setTimeout(() => setAntiLoopSaveMsg(''), 3500);
  };

  const handleResetSingleReply = async (key) => {
    const defaultValue = DEFAULT_ANTI_LOOP_RESPONSES[key];
    if (!defaultValue) return;
    const updated = {
      ...settings,
      [key]: defaultValue
    };
    setSettings(updated);
    setSavingAntiLoop(true);
    await chatbotService.saveSettings(updated);
    setSavingAntiLoop(false);
    setAntiLoopSaveMsg('Respuesta restablecida al valor por defecto y guardada en BD');
    setTimeout(() => setAntiLoopSaveMsg(''), 3000);
  };

  // Acciones en vivo con el servidor Baileys
    // Descarga directa del script local para Windows (.bat)
  const handleDownloadBotScript = () => {
    const batContent = `@echo off
chcp 65001 > nul
title ComandaFast - Servidor WhatsApp Bot (Baileys)
color 0B
cls

echo =====================================================================
echo    [COMANDAFAST BURGERS] - SERVIDOR LOCAL WHATSAPP BOT (BAILEYS)
echo =====================================================================
echo.

cd /d "%~dp0"

:: 1. Verificar si Node.js esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor descarga e instala Node.js desde: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Verificar dependencias de Baileys y qrcode-terminal
if not exist "node_modules\\@whiskeysockets\\baileys" (
    echo [INFO] Instalando dependencias necesarias de Baileys y WhatsApp...
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Hubo un error al instalar las dependencias con npm.
        pause
        exit /b 1
    )
)

:: 3. Verificar si el puerto 3002 ya esta ocupado
set OCCUPIED_PID=
for /f "tokens=5" %%p in ('netstat -aon ^| findstr :3002 ^| findstr LISTENING 2^>nul') do (
    set OCCUPIED_PID=%%p
)

if defined OCCUPIED_PID (
    echo [AVISO] El puerto 3002 ya esta siendo usado por el proceso PID %OCCUPIED_PID%.
    echo Es probable que una instancia previa del bot ya este en ejecucion.
    echo.
    set /p RESTART_CONFIRM="Deseas detener el proceso anterior para ver el bot/QR? (S/N): "
    if /i "%RESTART_CONFIRM%"=="S" (
        echo Deteniendo proceso %OCCUPIED_PID%...
        taskkill /F /PID %OCCUPIED_PID% >nul 2>nul
        timeout /t 2 /nobreak >nul
    ) else (
        echo.
        echo Manteniendo el bot actual activo en http://localhost:3002/status
        echo Podes gestionar el bot desde el panel de Dueno: http://localhost:5174/#dueno
        echo.
        pause
        exit /b 0
    )
)

:: 4. Opcion por parametro directo (--reset o --qr)
if "%1"=="--reset" goto :DO_RESET
if "%1"=="--qr" goto :DO_RESET
if "%1"=="-r" goto :DO_RESET

:ASK_MODE
cls
echo =====================================================================
echo    [COMANDAFAST BURGERS] - SERVIDOR LOCAL WHATSAPP BOT (BAILEYS)
echo =====================================================================
echo.
echo ¿Como deseas iniciar el bot de WhatsApp?
echo.
echo   [1] Conectar normalmente (Usa la sesion guardada si ya estas vinculado)
echo   [2] Vincular NUEVO celular (Muestra el CODIGO QR en pantalla para escanear)
echo.
set BOT_CHOICE=1
set /p BOT_CHOICE="Elige una opcion [1 o 2] (Por defecto 1): "

if "%BOT_CHOICE%"=="2" goto :DO_RESET
goto :RUN_NORMAL

:DO_RESET
cls
echo =====================================================================
echo    [VINCULAR NUEVO WHATSAPP - CODIGO QR EN PANTALLA]
echo =====================================================================
echo.
echo Generando nuevo codigo QR en terminal...
echo Cuando aparezca el codigo, escanealo con WhatsApp desde tu celular:
echo -> WhatsApp > Menu (o Ajustes) > Dispositivos vinculados > Vincular
echo.
echo =====================================================================
echo.
node server/whatsappBotServer.js --reset
goto :AFTER_BOT

:RUN_NORMAL
cls
echo =====================================================================
echo    [CONECTANDO WHATSAPP BOT COMANDAFAST]
echo =====================================================================
echo.
echo Iniciando microservicio...
echo Si no hay sesion guardada, aparecera el codigo QR aqui abajo:
echo.
node server/whatsappBotServer.js
goto :AFTER_BOT

:AFTER_BOT
echo.
echo ---------------------------------------------------------------------
echo El servidor del bot se ha detenido.
echo.
set /p RESTART_BOT="Deseas reiniciar el bot ahora? (S/N): "
if /i "%RESTART_BOT%"=="S" goto :ASK_MODE

echo Saliendo...
`;
    const blob = new Blob([batContent], { type: 'application/x-bat;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'INICIAR_BOT_WHATSAPP.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllScript = () => {
    const batContent = `@echo off
chcp 65001 > nul
title ComandaFast - Lanzador Completo (Sistema + Bot)
color 0E
cls

echo =====================================================================
echo    [COMANDAFAST BURGERS] - LANZADOR COMPLETO (SISTEMA + BOT)
echo =====================================================================
echo.
echo Este script iniciara:
echo   1. Servidor del Bot de WhatsApp (Puerto 3002)
echo   2. Servidor Web POS / Cocina / Auditoria de Dueno (Vite)
echo   3. Apertura automatica del navegador en el panel administrativo
echo.
echo =====================================================================
echo.
pause

cd /d "%~dp0"

echo.
echo [1/3] Lanzando Servidor WhatsApp Bot en ventana separada...
start "ComandaFast - WhatsApp Bot" cmd /c "INICIAR_BOT_WHATSAPP.bat"

timeout /t 2 /nobreak >nul

echo [2/3] Abriendo navegador en el Portal del Dueno & Chatbot...
start http://localhost:5174/#dueno

echo [3/3] Iniciando Servidor Web (Vite)...
echo.
echo (Para cerrar todo cuando termines, simplemente cerra estas consolas)
echo =====================================================================
echo.

call npm run dev
`;
    const blob = new Blob([batContent], { type: 'application/x-bat;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'INICIAR_SISTEMA_COMPLETO.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleStartBot = async () => {
    setLoadingAction(true);
    try {
      if (supabaseSync.isConfigured()) {
        await supabaseSync.saveBotConfig('server_commands', {
          id: 'cmd-' + Date.now(),
          action: 'start',
          timestamp: Date.now(),
          status: 'pending'
        });
      }
      if (BOT_SERVER_URL) {
        const res = await fetch(`${BOT_SERVER_URL}/start`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setConnectionStatus(data.status || 'qr_ready');
          setQrCodeData(data.qrCode || null);
        }
      } else {
        setConnectionStatus('connecting');
      }
    } catch (e) {
      console.error('[AdminWhatsAppBot] Error al iniciar bot:', e);
    } finally {
      setLoadingAction(false);
      setTimeout(fetchServerStatus, 2000);
    }
  };

  const handleLogoutBot = async () => {
    if (!window.confirm('¿Seguro que deseas desvincular el WhatsApp actual?')) return;
    setLoadingAction(true);
    try {
      if (supabaseSync.isConfigured()) {
        await supabaseSync.saveBotConfig('server_commands', {
          id: 'cmd-' + Date.now(),
          action: 'logout',
          timestamp: Date.now(),
          status: 'pending'
        });
      }
      if (BOT_SERVER_URL) {
        await fetch(`${BOT_SERVER_URL}/logout`, { method: 'POST' });
      }
      setConnectionStatus('disconnected');
      setQrCodeData(null);
      setConnectedUser(null);
    } catch (e) {
      console.error('[AdminWhatsAppBot] Error al desconectar bot:', e);
    } finally {
      setLoadingAction(false);
      setTimeout(fetchServerStatus, 2000);
    }
  };

  const filteredNodes = ALL_TEMPLATE_NODES.filter(n => {
    if (templateFilterCategory === 'all') return true;
    return n.category === templateFilterCategory;
  });

  const gratitudeList = settings.anti_loop_gratitude || DEFAULT_ANTI_LOOP_GRATITUDE;
  const farewellList = settings.anti_loop_farewell || DEFAULT_ANTI_LOOP_FAREWELL;
  const acknowledgeList = settings.anti_loop_acknowledge || DEFAULT_ANTI_LOOP_ACKNOWLEDGE;

  const allAntiLoopWordsWithCategory = [
    ...gratitudeList.map(w => ({ word: w, category: 'gratitude', label: 'Agradecimiento' })),
    ...farewellList.map(w => ({ word: w, category: 'farewell', label: 'Despedida' })),
    ...acknowledgeList.map(w => ({ word: w, category: 'acknowledge', label: 'Confirmación' }))
  ];

  const filteredAntiLoopWords = allAntiLoopWordsWithCategory.filter(item => {
    const matchesCategory = antiLoopCategoryFilter === 'all' || item.category === antiLoopCategoryFilter;
    const matchesSearch = !antiLoopSearch.trim() || item.word.toLowerCase().includes(antiLoopSearch.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const tabsBarRef = useRef(null);

  const handleScrollTabs = (direction) => {
    if (tabsBarRef.current) {
      tabsBarRef.current.scrollBy({
        left: direction === 'left' ? -200 : 200,
        behavior: 'smooth'
      });
    }
  };

  const handleTabsWheel = (e) => {
    if (tabsBarRef.current && e.deltaY !== 0) {
      e.preventDefault();
      tabsBarRef.current.scrollLeft += e.deltaY;
    }
  };

  useEffect(() => {
    if (tabsBarRef.current) {
      const activeEl = tabsBarRef.current.querySelector(`.bot-subnav-btn[data-tab="${activeTab}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [activeTab]);

  const tabsList = [
    {
      id: 'connection',
      label: 'Conexión QR',
      icon: QrCode,
      color: '#10b981',
      badge: serverOnline ? (
        <span 
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: connectionStatus === 'connected' ? '#10b981' : '#f59e0b',
            display: 'inline-block'
          }} 
          title={connectionStatus === 'connected' ? 'WhatsApp Conectado' : 'Esperando Vinculación'}
        />
      ) : null
    },
    {
      id: 'flows',
      label: 'Flujos & Respuestas',
      icon: GitBranch,
      color: '#f59e0b',
      badge: (
        <span className="bot-tab-badge amber">
          {flows.filter(f => f.enabled).length} Activos
        </span>
      )
    },
    {
      id: 'variables',
      label: 'Variables',
      icon: Variable,
      color: '#06b6d4',
      badge: null
    },
    {
      id: 'ai',
      label: 'IA Gemini',
      icon: Sparkles,
      color: '#a855f7',
      badge: aiConfig.enabled ? (
        <span className="bot-tab-badge purple">Gemini</span>
      ) : null
    },
    {
      id: 'templates',
      label: 'Plantillas Mensajes',
      icon: FileText,
      color: '#6366f1',
      badge: null
    },
    {
      id: 'security',
      label: 'Seguridad & Spam',
      icon: ShieldCheck,
      color: '#ea580c',
      badge: null
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', height: '100%' }}>
      {/* BOT MANAGER SUBHEADER TABS */}
      <div className="bot-subnav-container">
        <button
          type="button"
          className="bot-subnav-scroll-btn left"
          onClick={() => handleScrollTabs('left')}
          title="Desplazar pestañas a la izquierda"
          aria-label="Pestañas anteriores"
        >
          <ChevronLeft size={16} />
        </button>

        <div 
          ref={tabsBarRef} 
          className="bot-subnav-bar"
          onWheel={handleTabsWheel}
        >
          {tabsList.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-tab={tab.id}
                className={`bot-subnav-btn ${isActive ? 'active' : ''}`}
                style={{
                  '--tab-accent': tab.color
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={15} className="bot-tab-icon" />
                <span className="bot-tab-label">{tab.label}</span>
                {tab.badge}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="bot-subnav-scroll-btn right"
          onClick={() => handleScrollTabs('right')}
          title="Desplazar pestañas a la derecha"
          aria-label="Pestañas siguientes"
        >
          <ChevronRight size={16} />
        </button>

        {/* Global Save Indicator */}
        {saveSuccess && (
          <span className="bot-subnav-save-pill">
            <CheckCircle2 size={14} /> Guardado
          </span>
        )}
      </div>

      {/* TAB CONTENT: FLUJOS & CONDICIONES (BUILDER) */}
      {activeTab === 'flows' && (
        <AdminBotFlowsTab
          flows={flows}
          onSaveFlows={async (updatedFlows) => {
            setFlows(updatedFlows);
            await chatbotService.saveCustomFlows(updatedFlows);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
          }}
        />
      )}

      {/* TAB: GESTOR DE VARIABLES DEL BOT */}
      {activeTab === 'variables' && (
        <AdminBotVariablesTab />
      )}

      {/* TAB CONTENT: TEMPLATES STUDIO */}
      {activeTab === 'templates' && (
        <div 
          className="bot-studio-grid"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem',
            flex: 1,
            minHeight: '520px'
          }}
        >
          {/* LEFT: NODES LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {/* Category Filter */}
            <div style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto', paddingBottom: '4px' }}>
              {[
                { id: 'all', label: 'Todas' },
                { id: 'menu', label: 'Menú' },
                { id: 'buy_flow', label: 'Comanda' },
                { id: 'notifications', label: 'Cocina KDS' }
              ].map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`cat-pill-btn ${templateFilterCategory === c.id ? 'active' : ''}`}
                  style={{ fontSize: '0.7rem', height: '26px', padding: '0 8px' }}
                  onClick={() => setTemplateFilterCategory(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', overflowY: 'auto', flex: 1 }}>
              {filteredNodes.map(node => {
                const isSelected = selectedNodeId === node.id;
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    style={{
                      background: isSelected ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-main)',
                      border: isSelected ? '1.5px solid var(--accent-amber)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.6rem 0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: isSelected ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
                      {node.label}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {node.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: TEMPLATE TEXTAREA & PREVIEW */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                  {ALL_TEMPLATE_NODES.find(n => n.id === selectedNodeId)?.label}
                </h4>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Clave: <code>{selectedNodeId}</code>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  className="qty-btn"
                  style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.75rem', gap: '4px' }}
                  onClick={handleResetTemplate}
                  title="Restablecer plantilla a su valor de fábrica"
                >
                  <RotateCcw size={13} />
                  <span>Restablecer</span>
                </button>
                <button
                  type="button"
                  className="btn-confirm-order"
                  style={{ width: 'auto', padding: '0.4rem 1rem', fontSize: '0.78rem', gap: '6px' }}
                  onClick={handleSaveSettings}
                >
                  <Save size={14} />
                  <span>Guardar Plantilla</span>
                </button>
              </div>
            </div>

            {/* Variable Tags Pills */}
            <div style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.5rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800 }}>Variables disponibles:</span>
              {['{cliente}', '{pedido_id}', '{total}', '{direccion}', '{alias_banco}', '{banco}', '{titular}', '{cbu}', '{horarios}', '{catalogo_lista}', '{carrito_items}', '{subtotal}'].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCurrentNodeText(prev => prev + ' ' + v)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '4px',
                    padding: '1px 6px',
                    fontSize: '0.68rem',
                    color: 'var(--accent-blue)',
                    cursor: 'pointer'
                  }}
                  title="Insertar variable"
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Textarea Editor */}
            <textarea
              className="search-input"
              value={currentNodeText}
              onChange={(e) => setCurrentNodeText(e.target.value)}
              style={{
                flex: 1,
                minHeight: '220px',
                fontFamily: 'monospace',
                fontSize: '0.84rem',
                lineHeight: '1.45',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                resize: 'vertical'
              }}
            />

            {/* LIVE PREVIEW BOX */}
            <div style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem'
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>
                Vista previa en WhatsApp del cliente:
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #005c4b, #025143)',
                color: '#fff',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.4'
              }}>
                {chatbotService.interpolateTemplate(currentNodeText, chatbotService.getResolvedVariables({ name: 'Sofía' }, settings))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: SECURITY & ANTI-SPAM */}
      {activeTab === 'security' && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          {/* BANNER PRINCIPAL: ESCUDO ANTI-BANEO ACTIVO */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(245, 158, 11, 0.05) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '1.2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-emerald)'
                }}>
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Escudo Anti-Baneo & Simulación Humana
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 900,
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: 'var(--accent-emerald)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      letterSpacing: '0.04em'
                    }}>
                      BLINDAJE ACTIVO 24/7
                    </span>
                  </h4>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                    Protección por telemetría orgánica para WhatsApp Business. El bot nunca responde a 0ms ni envía ráfagas sospechosas.
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="cat-pill-btn"
                onClick={fetchHumanModeChats}
                style={{ height: '32px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <RefreshCw size={13} className={loadingPausedChats ? 'spin' : ''} />
                <span>Actualizar Estado</span>
              </button>
            </div>

            {/* GRILLA DE ESCUDOS ACTIVOS */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.75rem'
            }}>
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.85rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                  <Clock size={16} color="#d97706" />
                </div>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
                    Retardo de Tipeo Humano
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#334155', marginTop: '3px', lineHeight: '1.35' }}>
                    Espera dinámica (1.4s - 3.6s) proporcional al tamaño de cada mensaje para imitar escritura real.
                  </div>
                </div>
              </div>

              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.85rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                  <Smartphone size={16} color="#059669" />
                </div>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span>Presencia "Escribiendo..."</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '1px 6px', borderRadius: '4px' }}>
                      ⏱️ {((Number(settings.bot_typing_delay_ms) || 2500) / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#334155', marginTop: '3px', lineHeight: '1.35' }}>
                    Emite el evento <code style={{ background: '#f1f5f9', color: '#0f172a', padding: '1px 5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 700 }}>composing</code> durante {((Number(settings.bot_typing_delay_ms) || 2500) / 1000).toFixed(1)}s ({settings.bot_typing_mode === 'fixed' ? 'Fijo' : 'Dinámico Humano'}) antes de responder.
                  </div>
                </div>
              </div>

              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.85rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(37, 99, 235, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                  <CheckCircle2 size={16} color="#2563eb" />
                </div>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
                    Lectura Natural (Doble Tilde)
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#334155', marginTop: '3px', lineHeight: '1.35' }}>
                    Simula el ciclo orgánico de lectura (350-700ms) antes de marcar mensajes leídos.
                  </div>
                </div>
              </div>

              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.85rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(124, 58, 237, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                  <UserCheck size={16} color="#7c3aed" />
                </div>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
                    Modo Humano Automático
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#334155', marginTop: '3px', lineHeight: '1.35' }}>
                    Si respondes en el celular físico, el bot se duerme {settings.human_mode_sleep_minutes || 25} min para no entrometerse en la charla.
                  </div>
                </div>
              </div>

              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.85rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                  <MessageSquare size={16} color="#d97706" />
                </div>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
                    Filtro Anti-Bucle de Cortesía
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#334155', marginTop: '3px', lineHeight: '1.35' }}>
                    Detecta {allAntiLoopWordsWithCategory.length} palabras de cortesía (gracias, chau, ok) y responde cálido sin enviar menú.
                  </div>
                </div>
              </div>

              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.85rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                  <Zap size={16} color="#059669" />
                </div>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
                    Cola Anti-Flooding
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#334155', marginTop: '3px', lineHeight: '1.35' }}>
                    Encola ráfagas de mensajes del mismo cliente para procesarlos en fila india sin colisiones.
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN MODO HUMANO EN VIVO */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '0.95rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={16} color="#7c3aed" />
                  <span>Chats en Modo Humano Activo ({pausedChats.length})</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#475569' }}>
                  Auto-pausa de {settings.human_mode_sleep_minutes || 25} min al enviar un mensaje desde el WhatsApp físico
                </div>
              </div>

              {/* CONTROL DE TIEMPO QUE EL BOT SE DUERME */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.65rem',
                padding: '0.65rem 0.85rem',
                background: '#f8fafc',
                borderRadius: '6px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Clock size={16} color="#7c3aed" />
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
                      Tiempo que el bot se duerme (Auto-Pausa):
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      Duración de la pausa temporal cuando el operador responde desde su celular físico
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {[5, 10, 15, 25, 45, 60].map(mins => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => handleUpdateSleepMinutes(mins)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '5px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          border: (Number(settings.human_mode_sleep_minutes) || 25) === mins ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
                          background: (Number(settings.human_mode_sleep_minutes) || 25) === mins ? 'rgba(124, 58, 237, 0.12)' : '#ffffff',
                          color: (Number(settings.human_mode_sleep_minutes) || 25) === mins ? '#7c3aed' : '#334155',
                          cursor: 'pointer'
                        }}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      min="1"
                      max="240"
                      value={settings.human_mode_sleep_minutes || 25}
                      onChange={(e) => handleUpdateSleepMinutes(e.target.value)}
                      style={{
                        width: '56px',
                        height: '26px',
                        padding: '1px 5px',
                        borderRadius: '5px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        textAlign: 'center',
                        color: '#0f172a',
                        background: '#ffffff'
                      }}
                    />
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569' }}>min</span>
                  </div>
                </div>
              </div>

              {pausedChats.length === 0 ? (
                <div style={{
                  padding: '0.85rem',
                  borderRadius: '6px',
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  fontSize: '0.76rem',
                  color: '#475569',
                  textAlign: 'center',
                  lineHeight: '1.4'
                }}>
                  Ningún chat pausado actualmente. Cuando escribas a un cliente desde el teléfono celular físico de tu local, el bot se pausará automáticamente por {settings.human_mode_sleep_minutes || 25} min para ese cliente permitiéndote hablar libremente.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '160px', overflowY: 'auto' }}>
                  {pausedChats.map(c => (
                    <div key={c.jid} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(139, 92, 246, 0.08)',
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      borderRadius: '6px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          📞 +{c.phone}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          (Pausado por {c.remainingMinutes} min más)
                        </span>
                      </div>
                      <button
                        type="button"
                        className="cat-pill-btn active"
                        onClick={() => handleResumeChat(c.jid)}
                        style={{ height: '26px', fontSize: '0.72rem', padding: '0 0.6rem' }}
                      >
                        Reanudar Bot Ahora
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN CONFIGURACIÓN: VELOCIDAD DE RESPUESTA & RETARDO DE TIPEO HUMANO */}
          <div 
            id="bot-typing-delay-section"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--radius-md)',
              padding: '1.2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.1rem',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
            }}
          >
            {/* Encabezado */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.65rem' }}>
              <div>
                <h4 style={{ fontSize: '1.02rem', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <Timer size={19} color="#059669" />
                  <span>Velocidad de Respuesta & Retardo de Tipeo Humano</span>
                  <span style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#047857',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    ⏱️ {((Number(settings.bot_typing_delay_ms) || 2500) / 1000).toFixed(1)}s ({Number(settings.bot_typing_delay_ms) || 2500} ms)
                  </span>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    background: (settings.bot_typing_mode || 'human_dynamic') === 'fixed' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(124, 58, 237, 0.1)',
                    color: (settings.bot_typing_mode || 'human_dynamic') === 'fixed' ? '#2563eb' : '#7c3aed',
                    border: `1px solid ${(settings.bot_typing_mode || 'human_dynamic') === 'fixed' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(124, 58, 237, 0.3)'}`,
                    padding: '2px 8px',
                    borderRadius: '999px'
                  }}>
                    {(settings.bot_typing_mode || 'human_dynamic') === 'fixed' ? '⏱️ Tiempo Fijo' : '✨ Dinámico Proporcional'}
                  </span>
                </h4>
                <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px', lineHeight: '1.4' }}>
                  Ajusta los milisegundos que el bot simula estar <strong>"Escribiendo..."</strong> en WhatsApp antes de responder. Un tiempo natural (2.0s a 4.0s) hace que los clientes sientan que los atiende una persona real y previene bloqueos de WhatsApp.
                </div>
              </div>

              {typingSaveMsg && (
                <span style={{ fontSize: '0.78rem', color: '#047857', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', background: '#ecfdf5', padding: '4px 10px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                  <CheckCircle2 size={15} /> {typingSaveMsg}
                </span>
              )}
            </div>

            {/* BOTONES RÁPIDOS DE PREAJUSTES (1 CLIC) */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
              padding: '0.85rem',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Zap size={14} color="#f59e0b" />
                <span>Preajustes Rápidos Recomendados:</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                {[
                  { ms: 1200, label: '⚡ Rápido (1.2s)', desc: 'Para horas pico de alta demanda' },
                  { ms: 2500, label: '👤 Humano (2.5s)', desc: 'Equilibrado y muy natural (Recomendado)', recommended: true },
                  { ms: 3500, label: '💬 Gastronómico (3.5s)', desc: 'Simula tipeo real de cajero' },
                  { ms: 5000, label: '☕ Pausado (5.0s)', desc: 'Máxima sensación de atención humana' }
                ].map(preset => {
                  const isCurrent = (Number(settings.bot_typing_delay_ms) || 2500) === preset.ms;
                  return (
                    <button
                      key={preset.ms}
                      type="button"
                      onClick={() => handleUpdateTypingDelay(preset.ms)}
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: '6px',
                        textAlign: 'left',
                        background: isCurrent ? 'rgba(16, 185, 129, 0.12)' : '#ffffff',
                        border: isCurrent ? '1.5px solid #059669' : '1px solid #cbd5e1',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        position: 'relative'
                      }}
                    >
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: isCurrent ? '#047857' : '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{preset.label}</span>
                        {preset.recommended && (
                          <span style={{ fontSize: '0.62rem', background: '#fef3c7', color: '#b45309', padding: '1px 4px', borderRadius: '3px', fontWeight: 800 }}>
                            TOP
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: isCurrent ? '#065f46' : '#64748b', marginTop: '2px' }}>
                        {preset.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CONTROL DUAL: SLIDER + INPUT EXACTO EN MILISEGUNDOS */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              padding: '0.85rem 1rem',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a' }}>
                    Control Preciso por Barra Deslizante:
                  </span>
                  <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#059669' }}>
                    {((Number(settings.bot_typing_delay_ms) || 2500) / 1000).toFixed(1)} segundos
                  </span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="10000"
                  step="100"
                  value={Number(settings.bot_typing_delay_ms) || 2500}
                  onChange={(e) => handleUpdateTypingDelay(e.target.value)}
                  style={{
                    width: '100%',
                    accentColor: '#059669',
                    cursor: 'pointer'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                  <span>0.5s (500ms)</span>
                  <span>2.5s (Normal)</span>
                  <span>5.0s</span>
                  <span>7.5s</span>
                  <span>10.0s (10.000ms)</span>
                </div>
              </div>

              {/* Input numérico directo con controles rápidos */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    Milisegundos exactos:
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <button
                      type="button"
                      onClick={() => handleUpdateTypingDelay(Math.max(500, (Number(settings.bot_typing_delay_ms) || 2500) - 250))}
                      style={{ width: '24px', height: '26px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 800, cursor: 'pointer' }}
                      title="-250ms"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="500"
                      max="15000"
                      step="50"
                      value={Number(settings.bot_typing_delay_ms) || 2500}
                      onChange={(e) => handleUpdateTypingDelay(e.target.value)}
                      style={{
                        width: '74px',
                        height: '26px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        border: '1.5px solid #059669',
                        fontSize: '0.84rem',
                        fontWeight: 900,
                        textAlign: 'center',
                        color: '#0f172a',
                        background: '#ffffff'
                      }}
                    />
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569' }}>ms</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateTypingDelay(Math.min(15000, (Number(settings.bot_typing_delay_ms) || 2500) + 250))}
                      style={{ width: '24px', height: '26px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 800, cursor: 'pointer' }}
                      title="+250ms"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* MODO DE COMPORTAMIENTO: DINÁMICO VS FIJO */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              padding: '0.75rem 0.95rem',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155' }}>
                Modo de Simulación de Tipeo:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.65rem' }}>
                <div
                  onClick={() => handleUpdateTypingDelay(settings.bot_typing_delay_ms || 2500, 'human_dynamic')}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    border: (settings.bot_typing_mode || 'human_dynamic') === 'human_dynamic' ? '1.5px solid #059669' : '1px solid #cbd5e1',
                    background: (settings.bot_typing_mode || 'human_dynamic') === 'human_dynamic' ? 'rgba(16, 185, 129, 0.08)' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem'
                  }}
                >
                  <input
                    type="radio"
                    checked={(settings.bot_typing_mode || 'human_dynamic') === 'human_dynamic'}
                    onChange={() => {}}
                    style={{ marginTop: '2px', accentColor: '#059669' }}
                  />
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
                      Dinámico Proporcional (Recomendado)
                    </div>
                    <div style={{ fontSize: '0.71rem', color: '#475569', marginTop: '2px', lineHeight: '1.3' }}>
                      Calcula el tiempo según la cantidad de caracteres (+14ms/letra) y aplica micro-variaciones aleatorias naturales. Si el mensaje es una comanda larga, escribe más tiempo.
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => handleUpdateTypingDelay(settings.bot_typing_delay_ms || 2500, 'fixed')}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    border: (settings.bot_typing_mode || 'human_dynamic') === 'fixed' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                    background: (settings.bot_typing_mode || 'human_dynamic') === 'fixed' ? 'rgba(37, 99, 235, 0.08)' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem'
                  }}
                >
                  <input
                    type="radio"
                    checked={(settings.bot_typing_mode || 'human_dynamic') === 'fixed'}
                    onChange={() => {}}
                    style={{ marginTop: '2px', accentColor: '#2563eb' }}
                  />
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
                      Tiempo Fijo Exacto
                    </div>
                    <div style={{ fontSize: '0.71rem', color: '#475569', marginTop: '2px', lineHeight: '1.3' }}>
                      Espera exactamente los milisegundos configurados ({((Number(settings.bot_typing_delay_ms) || 2500) / 1000).toFixed(1)}s) en cada mensaje sin importar la longitud.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SIMULADOR EN VIVO: PROBAR CÓMO SE SIENTE EL RETARDO */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
              padding: '0.85rem',
              background: '#f0fdf4',
              borderRadius: '8px',
              border: '1px solid #bbf7d0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Play size={15} color="#059669" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#065f46' }}>
                    Probador Interactivo en Vivo:
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleTestTyping}
                  disabled={testingTyping}
                  style={{
                    padding: '0.35rem 0.85rem',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    background: testingTyping ? '#cbd5e1' : '#059669',
                    color: '#ffffff',
                    border: 'none',
                    cursor: testingTyping ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }}
                >
                  {testingTyping ? <RefreshCw size={13} className="spin" /> : <Play size={13} />}
                  <span>{testingTyping ? 'Simulando tipeo...' : '▶️ Probar Tipeo en Vivo'}</span>
                </button>
              </div>

              {/* Caja de simulación de WhatsApp */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                minHeight: '68px',
                justifyContent: 'center'
              }}>
                {testingTyping ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#059669' }}>
                        WhatsApp • ComandaFast Bot:
                      </span>
                      <span style={{ fontSize: '0.74rem', color: '#059669', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        escribiendo
                        <span style={{ display: 'inline-flex', gap: '2px' }}>
                          <span style={{ animation: 'pulse 1s infinite', fontSize: '10px' }}>●</span>
                          <span style={{ animation: 'pulse 1s infinite 0.2s', fontSize: '10px' }}>●</span>
                          <span style={{ animation: 'pulse 1s infinite 0.4s', fontSize: '10px' }}>●</span>
                        </span>
                      </span>
                    </div>
                    {/* Barra de progreso */}
                    <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${testProgress}%`, height: '100%', background: '#059669', transition: 'width 0.04s linear' }} />
                    </div>
                  </div>
                ) : testCompletedMsg ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={16} color="#059669" />
                      <span style={{ fontSize: '0.78rem', color: '#065f46', fontWeight: 700 }}>
                        {testCompletedMsg}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      💬 Mensaje enviado con éxito
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>
                    Toca en <strong>"▶️ Probar Tipeo en Vivo"</strong> para experimentar cómo verá el cliente los {((Number(settings.bot_typing_delay_ms) || 2500) / 1000).toFixed(1)} segundos de espera con presencia "Escribiendo...".
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECCIÓN CONFIGURACIÓN: FILTRO ANTI-BUCLE DE CORTESÍA */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 'var(--radius-md)',
            padding: '1.1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.6rem' }}>
              <div>
                <h4 style={{ fontSize: '1.02rem', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                  <MessageSquare size={18} color="#d97706" />
                  <span>Filtro Anti-Bucle de Cortesía & Respuestas Inteligentes</span>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    background: isAntiLoopActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    color: isAntiLoopActive ? '#047857' : '#b91c1c',
                    border: `1px solid ${isAntiLoopActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {isAntiLoopActive ? '● ACTIVO' : '○ DESACTIVADO'}
                  </span>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    background: 'rgba(245, 158, 11, 0.12)',
                    color: '#d97706',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    padding: '1px 7px',
                    borderRadius: '999px'
                  }}>
                    {allAntiLoopWordsWithCategory.length} palabras configuradas
                  </span>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    background: 'rgba(5, 150, 105, 0.12)',
                    color: '#059669',
                    border: '1px solid rgba(5, 150, 105, 0.3)',
                    padding: '1px 7px',
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Wifi size={11} /> Base de Datos Cloud
                  </span>
                </h4>
                <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '3px' }}>
                  {isAntiLoopActive
                    ? 'Evita que el bot vuelva a disparar el menú de compras cuando un cliente simplemente da las gracias, se despide o envía un saludo cordial de cierre.'
                    : '⚠️ El filtro se encuentra desactivado. El bot responderá con su menú habitual sin interceptar despedidas ni agradecimientos.'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleToggleAntiLoopEnabled}
                  disabled={savingAntiLoop}
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    border: isAntiLoopActive ? '1.5px solid #10b981' : '1.5px solid #cbd5e1',
                    background: isAntiLoopActive ? 'rgba(16, 185, 129, 0.08)' : '#f1f5f9',
                    color: isAntiLoopActive ? '#047857' : '#64748b',
                    transition: 'all 0.2s ease'
                  }}
                  title={isAntiLoopActive ? 'Click para desactivar el filtro anti-bucle' : 'Click para activar el filtro anti-bucle'}
                >
                  <Power size={14} color={isAntiLoopActive ? '#10b981' : '#94a3b8'} />
                  <span>{isAntiLoopActive ? 'Desactivar Filtro' : 'Activar Filtro'}</span>
                </button>

                <button
                  type="button"
                  className="cat-pill-btn"
                  onClick={handleResetAntiLoopWords}
                  style={{ height: '32px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="Restablecer el listado de palabras a los valores por defecto del sistema"
                >
                  <RotateCcw size={12} />
                  <span>Restablecer por defecto</span>
                </button>
              </div>
            </div>

            {!isAntiLoopActive && (
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                borderLeft: '4px solid #f59e0b',
                borderRadius: '8px',
                padding: '9px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.8rem',
                color: '#92400e'
              }}>
                <AlertCircle size={16} color="#d97706" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Filtro en pausa:</strong> El bot no interceptará los agradecimientos ni saludos de cortesía con respuestas automáticas. Podés volver a activarlo en cualquier momento con el botón superior.
                </div>
              </div>
            )}

            {/* CATEGORY TABS & SEARCH */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.6rem'
            }}>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setAntiLoopCategoryFilter('all')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: antiLoopCategoryFilter === 'all' ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
                    background: antiLoopCategoryFilter === 'all' ? '#0f172a' : '#f8fafc',
                    color: antiLoopCategoryFilter === 'all' ? '#ffffff' : '#475569'
                  }}
                >
                  Todas ({allAntiLoopWordsWithCategory.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAntiLoopCategoryFilter('gratitude')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: antiLoopCategoryFilter === 'gratitude' ? '1.5px solid #059669' : '1px solid #cbd5e1',
                    background: antiLoopCategoryFilter === 'gratitude' ? '#059669' : '#f8fafc',
                    color: antiLoopCategoryFilter === 'gratitude' ? '#ffffff' : '#047857'
                  }}
                >
                  💖 Agradecimiento ({gratitudeList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAntiLoopCategoryFilter('farewell')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: antiLoopCategoryFilter === 'farewell' ? '1.5px solid #d97706' : '1px solid #cbd5e1',
                    background: antiLoopCategoryFilter === 'farewell' ? '#d97706' : '#f8fafc',
                    color: antiLoopCategoryFilter === 'farewell' ? '#ffffff' : '#b45309'
                  }}
                >
                  👋 Despedidas ({farewellList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAntiLoopCategoryFilter('acknowledge')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: antiLoopCategoryFilter === 'acknowledge' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                    background: antiLoopCategoryFilter === 'acknowledge' ? '#2563eb' : '#f8fafc',
                    color: antiLoopCategoryFilter === 'acknowledge' ? '#ffffff' : '#1d4ed8'
                  }}
                >
                  👍 Confirmaciones ({acknowledgeList.length})
                </button>
              </div>

              {/* SEARCH INPUT */}
              <input
                type="text"
                className="search-input"
                placeholder="Buscar palabra..."
                value={antiLoopSearch}
                onChange={(e) => setAntiLoopSearch(e.target.value)}
                style={{ width: '180px', height: '32px', fontSize: '0.78rem', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' }}
              />
            </div>

            {/* ADD WORD INPUT + CATEGORY SELECTOR */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              alignItems: 'center',
              background: '#f8fafc',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <input
                type="text"
                className="search-input"
                placeholder="Nueva palabra o frase (ej: mil gracias, joya, chau)..."
                value={newAntiLoopWord}
                onChange={(e) => setNewAntiLoopWord(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddAntiLoopWord()}
                style={{ flex: 1, minWidth: '220px', height: '34px', fontSize: '0.82rem', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' }}
              />
              <select
                value={newAntiLoopCategory}
                onChange={(e) => setNewAntiLoopCategory(e.target.value)}
                style={{
                  height: '34px',
                  padding: '0 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  cursor: 'pointer'
                }}
              >
                <option value="gratitude">💖 Agradecimiento / Elogio</option>
                <option value="farewell">👋 Despedida</option>
                <option value="acknowledge">👍 Confirmación / Cierre breve</option>
              </select>
              <button
                type="button"
                className="cat-pill-btn active"
                style={{ height: '34px', padding: '0 1rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                onClick={handleAddAntiLoopWord}
              >
                <Plus size={14} />
                <span>Agregar Palabra</span>
              </button>
            </div>

            {/* WORD TAGS CONTAINER */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.45rem',
              maxHeight: '220px',
              overflowY: 'auto',
              boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.03)'
            }}>
              {filteredAntiLoopWords.length === 0 ? (
                <div style={{ padding: '1rem', color: '#64748b', fontSize: '0.78rem', width: '100%', textAlign: 'center' }}>
                  No se encontraron palabras para el filtro seleccionado.
                </div>
              ) : (
                filteredAntiLoopWords.map(item => {
                  const isGrat = item.category === 'gratitude';
                  const isFare = item.category === 'farewell';
                  const bg = isGrat ? 'rgba(16, 185, 129, 0.08)' : isFare ? 'rgba(245, 158, 11, 0.08)' : 'rgba(59, 130, 246, 0.08)';
                  const borderColor = isGrat ? 'rgba(16, 185, 129, 0.35)' : isFare ? 'rgba(245, 158, 11, 0.35)' : 'rgba(59, 130, 246, 0.35)';
                  const textColor = isGrat ? '#065f46' : isFare ? '#92400e' : '#1e40af';
                  const badgeIcon = isGrat ? '💖' : isFare ? '👋' : '👍';

                  return (
                    <span
                      key={`${item.category}-${item.word}`}
                      style={{
                        background: bg,
                        border: `1px solid ${borderColor}`,
                        color: textColor,
                        borderRadius: 'var(--radius-full)',
                        padding: '4px 10px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ fontSize: '0.72rem' }}>{badgeIcon}</span>
                      <span>{item.word}</span>
                      <Trash2
                        size={12}
                        style={{ color: '#ef4444', cursor: 'pointer', marginLeft: '2px' }}
                        title={`Eliminar "${item.word}"`}
                        onClick={() => handleRemoveAntiLoopWord(item.category, item.word)}
                      />
                    </span>
                  );
                })
              )}
            </div>

            {/* NOTIFICACIÓN DE GUARDADO / SYNC EN TIEMPO REAL */}
            {antiLoopSaveMsg && (
              <div style={{
                padding: '0.6rem 0.85rem',
                borderRadius: '6px',
                background: 'rgba(5, 150, 105, 0.12)',
                border: '1px solid rgba(5, 150, 105, 0.3)',
                color: '#065f46',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={16} />
                <span>{antiLoopSaveMsg}</span>
              </div>
            )}

            {/* SECCIÓN EDITABLE: RESPUESTAS INTELIGENTES DEL BOT */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '0.9rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={16} color="#d97706" />
                    <span>Respuestas Inteligentes de Cortesía (Editables)</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                    Mensajes automáticos que el bot responde cuando un cliente usa las palabras clave configuradas. Se guardan en la Base de Datos y el bot las carga al encenderse.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="cat-pill-btn active"
                    onClick={handleSaveAntiLoopReplies}
                    disabled={savingAntiLoop}
                    style={{ height: '32px', padding: '0 0.85rem', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Save size={13} />
                    <span>{savingAntiLoop ? 'Guardando en BD...' : 'Guardar Frases en BD'}</span>
                  </button>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '0.75rem'
              }}>
                {/* 1. AGRADECIMIENTOS */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  padding: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#047857' }}>
                      💖 Ante Agradecimientos ("gracias", "joya", etc.)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleResetSingleReply('template_anti_loop_gratitude')}
                      style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                      title="Restablecer respuesta por defecto"
                    >
                      <RotateCcw size={11} /> Default
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={settings.template_anti_loop_gratitude ?? DEFAULT_ANTI_LOOP_RESPONSES.template_anti_loop_gratitude}
                    onChange={(e) => handleUpdateAntiLoopReply('template_anti_loop_gratitude', e.target.value)}
                    onBlur={handleSaveAntiLoopReplies}
                    placeholder="Escribí la respuesta de agradecimiento..."
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.6rem',
                      borderRadius: '5px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.76rem',
                      color: '#0f172a',
                      background: '#ffffff',
                      lineHeight: '1.4',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic' }}>
                    💡 Se guarda en BD y el bot la usa inmediatamente.
                  </div>
                </div>

                {/* 2. DESPEDIDAS */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  padding: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#b45309' }}>
                      👋 Ante Despedidas ("chau", "buenas noches", etc.)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleResetSingleReply('template_anti_loop_farewell')}
                      style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                      title="Restablecer respuesta por defecto"
                    >
                      <RotateCcw size={11} /> Default
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={settings.template_anti_loop_farewell ?? DEFAULT_ANTI_LOOP_RESPONSES.template_anti_loop_farewell}
                    onChange={(e) => handleUpdateAntiLoopReply('template_anti_loop_farewell', e.target.value)}
                    onBlur={handleSaveAntiLoopReplies}
                    placeholder="Escribí la respuesta de despedida..."
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.6rem',
                      borderRadius: '5px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.76rem',
                      color: '#0f172a',
                      background: '#ffffff',
                      lineHeight: '1.4',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic' }}>
                    💡 Se envía cuando el cliente saluda al terminar su pedido.
                  </div>
                </div>

                {/* 3. CONFIRMACIONES BREVES */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid rgba(37, 99, 235, 0.35)',
                  padding: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1d4ed8' }}>
                      👍 Ante Confirmaciones ("ok", "listo", "dale")
                    </span>
                    <button
                      type="button"
                      onClick={() => handleResetSingleReply('template_anti_loop_acknowledge')}
                      style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                      title="Restablecer respuesta por defecto"
                    >
                      <RotateCcw size={11} /> Default
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={settings.template_anti_loop_acknowledge ?? DEFAULT_ANTI_LOOP_RESPONSES.template_anti_loop_acknowledge}
                    onChange={(e) => handleUpdateAntiLoopReply('template_anti_loop_acknowledge', e.target.value)}
                    onBlur={handleSaveAntiLoopReplies}
                    placeholder="Escribí la respuesta de confirmación..."
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.6rem',
                      borderRadius: '5px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.76rem',
                      color: '#0f172a',
                      background: '#ffffff',
                      lineHeight: '1.4',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic' }}>
                    💡 Cierra el ciclo sin volver a mostrar el menú completo.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Filtro de Palabras Clave Gastronómicas (Opcional)
            </h4>
            <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
              Evita que el bot responda mensajes personales o interrupciones en conversaciones con amigos o familiares en el mismo WhatsApp si compartes el número.
            </div>
          </div>

          {/* TOGGLE: REQUIRE KEYWORDS */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 'var(--radius-md)',
            padding: '0.9rem 1.1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                Activar Filtro Anti-Spam de ComandaFast
              </div>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px' }}>
                El bot solo responderá si el mensaje contiene alguna de las palabras clave gastronómicas de la lista.
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.require_keywords_for_chatbot}
              onChange={(e) => {
                const updated = { ...settings, require_keywords_for_chatbot: e.target.checked };
                setSettings(updated);
                chatbotService.saveSettings(updated);
              }}
              style={{ width: '20px', height: '20px', accentColor: 'var(--accent-amber)', cursor: 'pointer' }}
            />
          </div>

          {/* KEYWORDS TAG LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
              Palabras Clave Autorizadas ({settings.chatbot_keywords?.length || 0})
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="search-input"
                placeholder="Nueva palabra clave (ej: burger, delivery)..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                style={{ width: '260px', height: '34px', fontSize: '0.82rem', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' }}
              />
              <button
                type="button"
                className="cat-pill-btn active"
                style={{ height: '34px', padding: '0 0.95rem', fontSize: '0.78rem' }}
                onClick={handleAddKeyword}
              >
                <Plus size={14} />
                <span>Agregar</span>
              </button>
            </div>

            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.45rem',
              maxHeight: '160px',
              overflowY: 'auto',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
            }}>
              {(settings.chatbot_keywords || []).map(kw => (
                <span
                  key={kw}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    borderRadius: 'var(--radius-full)',
                    padding: '3px 10px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {kw}
                  <Trash2
                    size={12}
                    style={{ color: '#ef4444', cursor: 'pointer' }}
                    onClick={() => handleRemoveKeyword(kw)}
                  />
                </span>
              ))}
            </div>
          </div>

          {/* IGNORED NUMBERS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
              Números Ignorados (Lista Negra Personal)
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="search-input"
                placeholder="Número de teléfono (ej: 3826507711)..."
                value={newIgnoredPhone}
                onChange={(e) => setNewIgnoredPhone(e.target.value)}
                style={{ width: '220px', height: '34px', fontSize: '0.82rem', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' }}
              />
              <input
                type="text"
                className="search-input"
                placeholder="Etiqueta (ej: Juan Hermano)..."
                value={newIgnoredLabel}
                onChange={(e) => setNewIgnoredLabel(e.target.value)}
                style={{ width: '200px', height: '34px', fontSize: '0.82rem', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' }}
              />
              <button
                type="button"
                className="cat-pill-btn active"
                style={{ height: '34px', padding: '0 0.95rem', fontSize: '0.78rem' }}
                onClick={handleAddIgnoredNumber}
              >
                <Plus size={14} />
                <span>Bloquear Número</span>
              </button>
            </div>

            {settings.ignored_numbers?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {settings.ignored_numbers.map(n => (
                  <div
                    key={n.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.55rem 0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.82rem',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
                    }}
                  >
                    <div>
                      <strong>{n.phone}</strong> — <span style={{ color: 'var(--text-muted)' }}>{n.label}</span>
                    </div>
                    <button
                      type="button"
                      className="qty-btn"
                      style={{ width: 'auto', padding: '2px 8px', fontSize: '0.72rem', color: 'var(--accent-rose)' }}
                      onClick={() => handleRemoveIgnoredNumber(n.id)}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

            {/* TAB CONTENT: INTELIGENCIA ARTIFICIAL (GOOGLE GEMINI) */}
      {activeTab === 'ai' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* BANNER PRINCIPAL DE IA */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)',
            border: '1.5px solid rgba(168, 85, 247, 0.3)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #a855f7, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)'
              }}>
                <Sparkles size={26} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                    Asistente Inteligente Multi-IA (Groq + Gemini + DeepSeek)
                  </h3>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: aiConfig.enabled ? 'rgba(37, 211, 102, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                    color: aiConfig.enabled ? '#25D366' : 'var(--text-muted)'
                  }}>
                    {aiConfig.enabled ? '● IA ACTIVA' : '○ DESACTIVADA'}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Motor de alta disponibilidad con failover automático o selección exclusiva: responde preguntas de la carta, horarios, promociones y consultas sin saturarse.
                </p>
              </div>
            </div>

            {/* TOGGLE SWITCH */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={aiConfig.enabled}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                  style={{ width: '18px', height: '18px', accentColor: '#a855f7', cursor: 'pointer' }}
                />
                <span>Habilitar IA en WhatsApp</span>
              </label>
            </div>
          </div>

          {/* GRID: CONFIGURACIÓN Y PROMPT */}
          <div className="bot-connection-grid">
            {/* LEFT: API KEY & MODEL SETTINGS */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={16} style={{ color: '#a855f7' }} />
                  <span>Motores de IA & Estrategia</span>
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-purple)', background: 'rgba(168, 85, 247, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                  3 Motores Integrados
                </span>
              </div>

              {/* SELECTOR DE MODO DE OPERACIÓN */}
              <div style={{ background: 'var(--bg-card-subtle, rgba(0,0,0,0.02))', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Zap size={14} style={{ color: '#eab308' }} />
                  <span>Modo de Operación:</span>
                </label>
                <select
                  value={aiConfig.mode || 'cascade'}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, mode: e.target.value }))}
                  className="search-input"
                  style={{ width: '100%', height: '36px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  <option value="cascade">⚡ Cascada Inteligente (Groq ➔ Gemini ➔ DeepSeek con Auto-Failover)</option>
                  <option value="only_groq">🚀 Solo Groq Cloud (Llama 3.3 70B - Ultrarrápido y Gratis)</option>
                  <option value="only_gemini">🔮 Solo Google Gemini (2.0 Flash - Gratis)</option>
                  <option value="only_deepseek">🧠 Solo DeepSeek (V3 / Chat - Económico)</option>
                </select>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.3' }}>
                  {(!aiConfig.mode || aiConfig.mode === 'cascade') && (
                    <span>🛡️ <strong>Modo Cascada (Recomendado):</strong> Prueba primero con Groq (0.3s). Si se satura o arroja error de límite (429/503), conmuta en tiempo real a Google Gemini. Si este también se congestiona, pasa a DeepSeek.</span>
                  )}
                  {aiConfig.mode === 'only_groq' && (
                    <span>⚡ <strong>Solo Groq Cloud:</strong> Usa exclusivamente Groq con Llama 3.3 70B (30 req/min gratis). Si se satura, no consulta a otros motores.</span>
                  )}
                  {aiConfig.mode === 'only_gemini' && (
                    <span>🔮 <strong>Solo Google Gemini:</strong> Usa exclusivamente Google Gemini (15 req/min gratis). Si se satura, no conmuta.</span>
                  )}
                  {aiConfig.mode === 'only_deepseek' && (
                    <span>🧠 <strong>Solo DeepSeek:</strong> Usa exclusivamente DeepSeek-V3 oficial con modelo deepseek-chat.</span>
                  )}
                </div>
              </div>

              {/* 1. GROQ CLOUD */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>⚡ 1. Groq Cloud API Key (Llama 3.3 70B):</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <a 
                      href="https://console.groq.com/keys" 
                      target="_blank" 
                      rel="noreferrer" 
                      style={{ fontSize: '0.7rem', color: '#a855f7', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 700 }}
                    >
                      Obtener gratis <ExternalLink size={11} />
                    </a>
                    {aiConfig.hasGroq && (
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: '12px' }}>
                        🟢 Lista
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type={showGroqKey ? 'text' : 'password'}
                    placeholder="gsk_..."
                    value={aiConfig.groqApiKey || ''}
                    onChange={(e) => setAiConfig(prev => ({ ...prev, groqApiKey: e.target.value }))}
                    className="search-input"
                    style={{ flex: 1, height: '36px', fontSize: '0.8rem', fontFamily: 'monospace' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowGroqKey(!showGroqKey)}
                    className="qty-btn"
                    style={{ height: '36px', padding: '0 10px', fontSize: '0.72rem' }}
                    title={showGroqKey ? 'Ocultar clave' : 'Mostrar clave'}
                  >
                    {showGroqKey ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
                <div style={{ fontSize: '0.69rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  🚀 100% Gratis, 30 peticiones/min y latencia casi instantánea (~0.3s).
                </div>
              </div>

              {/* 2. GOOGLE GEMINI */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>🔮 2. Google Gemini API Key:</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noreferrer" 
                      style={{ fontSize: '0.7rem', color: '#a855f7', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 700 }}
                    >
                      Obtener gratis <ExternalLink size={11} />
                    </a>
                    {aiConfig.hasGemini && (
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: '12px' }}>
                        🟢 Lista
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    placeholder="AIzaSy... o AQ.Ab8..."
                    value={aiConfig.geminiApiKey || ''}
                    onChange={(e) => setAiConfig(prev => ({ ...prev, geminiApiKey: e.target.value }))}
                    className="search-input"
                    style={{ flex: 1, height: '36px', fontSize: '0.8rem', fontFamily: 'monospace' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="qty-btn"
                    style={{ height: '36px', padding: '0 10px', fontSize: '0.72rem' }}
                    title={showGeminiKey ? 'Ocultar clave' : 'Mostrar clave'}
                  >
                    {showGeminiKey ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
                <div style={{ fontSize: '0.69rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  ✨ Gratis con 15 peticiones/min. Gran capacidad contextual y recomendaciones.
                </div>
              </div>

              {/* 3. DEEPSEEK */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>🧠 3. DeepSeek API Key (Opcional):</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <a 
                      href="https://platform.deepseek.com/api_keys" 
                      target="_blank" 
                      rel="noreferrer" 
                      style={{ fontSize: '0.7rem', color: '#a855f7', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 700 }}
                    >
                      Obtener clave <ExternalLink size={11} />
                    </a>
                    {aiConfig.hasDeepSeek && (
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: '12px' }}>
                        🟢 Lista
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type={showDeepSeekKey ? 'text' : 'password'}
                    placeholder="sk-..."
                    value={aiConfig.deepseekApiKey || ''}
                    onChange={(e) => setAiConfig(prev => ({ ...prev, deepseekApiKey: e.target.value }))}
                    className="search-input"
                    style={{ flex: 1, height: '36px', fontSize: '0.8rem', fontFamily: 'monospace' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeepSeekKey(!showDeepSeekKey)}
                    className="qty-btn"
                    style={{ height: '36px', padding: '0 10px', fontSize: '0.72rem' }}
                    title={showDeepSeekKey ? 'Ocultar clave' : 'Mostrar clave'}
                  >
                    {showDeepSeekKey ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
                <div style={{ fontSize: '0.69rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  🛡️ Pago por consumo ultra accesible (~$0.02 USD / noche de 200 pedidos).
                </div>
              </div>

              {/* TEST CONNECTION BUTTON */}
              <div>
                <button
                  type="button"
                  onClick={handleTestAiConnection}
                  disabled={aiTestLoading}
                  className="cat-pill-btn"
                  style={{
                    width: '100%',
                    height: '38px',
                    fontSize: '0.8rem',
                    gap: '6px',
                    justifyContent: 'center',
                    background: 'rgba(168, 85, 247, 0.15)',
                    color: '#a855f7',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    fontWeight: 800
                  }}
                >
                  <RefreshCw size={14} className={aiTestLoading ? 'spin-slow' : ''} />
                  <span>
                    {aiTestLoading 
                      ? 'Probando conexión...' 
                      : (!aiConfig.mode || aiConfig.mode === 'cascade')
                        ? '⚡ Probar Cascada Multi-IA'
                        : `Probar ${aiConfig.mode === 'only_groq' ? 'Groq' : aiConfig.mode === 'only_gemini' ? 'Gemini' : 'DeepSeek'}`
                    }
                  </span>
                </button>

                {aiTestResult && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.75rem',
                    background: aiTestResult.success ? 'rgba(37, 211, 102, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    color: aiTestResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                    border: `1px solid ${aiTestResult.success ? 'rgba(37, 211, 102, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                  }}>
                    {aiTestResult.message}
                  </div>
                )}
              </div>

              {/* SAVE BUTTON */}
              <button
                type="button"
                onClick={handleSaveAiConfig}
                className="btn-confirm-order"
                style={{ height: '38px', fontSize: '0.82rem', gap: '6px', justifyContent: 'center' }}
              >
                <Save size={15} />
                <span>{aiSavedSuccess ? '¡Configuración Guardada!' : 'Guardar Ajustes de IA'}</span>
              </button>
            </div>

            {/* RIGHT: SYSTEM PROMPT / PERSONALITY EDITOR */}
            {(() => {
              const botVarsMap = chatbotService.getBotVariablesMap();
              const currentStoreName = botVarsMap.nombre_local || "Burga's Chamical";
              const currentWelcomeMsg = botVarsMap.mensaje_bienvenida || `¡Hola {cliente}! Bienvenido a ${currentStoreName} 🔥 Las mejores hamburguesas smashadas a la plancha.`;
              return (
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Settings size={16} style={{ color: 'var(--accent-amber)' }} />
                      <span>Personalidad del Asistente & Instrucciones (System Prompt)</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Personalizá el tono y respuestas
                    </span>
                  </div>

                  {/* ACTIVE IDENTITY & GREETING INFO BOX */}
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 0.9rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ fontWeight: 800, color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
                        <Store size={15} /> Identidad en la IA: <u>{currentStoreName}</u>
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('variables')}
                        className="qty-btn"
                        style={{ height: '24px', padding: '0 8px', fontSize: '0.7rem', gap: '4px', textDecoration: 'none' }}
                        title="Ir a modificar las variables del negocio"
                      >
                        <span>Editar en Variables</span>
                        <ExternalLink size={11} />
                      </button>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      <strong>👋 Saludo / Bienvenida de referencia para la IA:</strong>
                      <div style={{
                        marginTop: '3px',
                        fontStyle: 'italic',
                        background: 'var(--bg-main)',
                        padding: '5px 8px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        wordBreak: 'break-word'
                      }}>
                        "{currentWelcomeMsg}"
                      </div>
                    </div>
                    <div style={{ fontSize: '0.69rem', color: 'var(--text-muted)' }}>
                      💡 Cuando un cliente saluda por primera vez (ej: <em>"hola", "buenas noches"</em>), la IA se presenta en nombre de <strong>{currentStoreName}</strong> usando este estilo y calidez.
                    </div>
                  </div>

                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                    Podés escribir tus propias directivas personalizadas para la IA. Por defecto, el sistema le inyecta automáticamente a <strong>{currentStoreName}</strong> el <strong>catálogo completo en tiempo real</strong>, precios, formas de entrega (Retiro y Delivery) y alias de pago.
                  </p>

                  <textarea
                    rows={10}
                    value={aiConfig.systemPrompt}
                    onChange={(e) => setAiConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                    placeholder={`Dejá en blanco para usar la personalidad oficial gastronómica de ${currentStoreName}:\n- Se presenta siempre como ${currentStoreName} y utiliza el saludo de bienvenida configurado.\n- Tono canchero y simpático argentino con emojis (🍔, 🔥, 🍟).\n- Respuestas cortas y vendedoras (2-3 párrafos).\n- Recomendación de hamburguesas smash y adicionales.\n- Instrucciones para pedir escribiendo el número o la palabra COMPRAR.`}
                    className="search-input"
                    style={{
                      width: '100%',
                      fontSize: '0.82rem',
                      lineHeight: '1.45',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      💡 La IA solo interviene en consultas abiertas. Para armar pedidos, el sistema toma el control garantizando la comanda exacta.
                    </div>
                    <button
                      type="button"
                      onClick={() => setAiConfig(prev => ({ ...prev, systemPrompt: '' }))}
                      className="qty-btn"
                      style={{ height: '30px', padding: '0 10px', fontSize: '0.72rem', gap: '4px' }}
                    >
                      <RotateCcw size={12} />
                      <span>Restablecer Prompt por Defecto</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* TAB CONTENT: REAL WHATSAPP CONNECTION */}
      {activeTab === 'connection' && (
        <div 
          className="bot-qr-grid"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem'
          }}
        >
          {/* QR CODE BOX */}
          <div style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            textAlign: 'center'
          }}>
            {/* SERVER STATUS CHIP */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              background: serverOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: serverOnline ? 'var(--accent-emerald)' : 'var(--accent-rose)',
              fontSize: '0.75rem',
              fontWeight: 800
            }}>
              {serverOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>{serverOnline ? (isCloudBridge ? 'Servidor Baileys Activo (Supabase Cloud Bridge)' : 'Servidor Baileys Activo (Puerto 3002)') : 'Servidor Baileys Desconectado'}</span>
            </div>

            {/* QR CONTAINER */}
            <div style={{
              width: '240px',
              height: '240px',
              background: '#ffffff',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
              overflow: 'hidden',
              padding: '8px'
            }}>
              {connectionStatus === 'connected' ? (
                <div style={{ color: '#25D366', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '1rem' }}>
                  <CheckCircle2 size={64} />
                  <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
                    ¡WhatsApp Conectado!
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {connectedUser?.name || connectedUser?.id || 'Dispositivo Vinculado'}
                  </span>
                </div>
              ) : connectionStatus === 'qr_ready' && qrCodeData ? (
                <img 
                  src={qrCodeData} 
                  alt="Código QR Real WhatsApp" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                />
              ) : connectionStatus === 'connecting' ? (
                <div style={{ color: 'var(--accent-blue)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <RefreshCw size={44} className="spin-slow" />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Generando Código QR...</span>
                </div>
              ) : (
                <div style={{ color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <QrCode size={64} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>WhatsApp Desconectado</span>
                </div>
              )}
            </div>

            {/* QR INSTRUCTION TEXT */}
            {connectionStatus === 'qr_ready' && (
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 800 }}>
                📲 Escaneá este QR ahora con tu WhatsApp
              </div>
            )}

                        {/* BOTÓN RÁPIDO PARA DESCARGAR SCRIPT */}
            <button
              type="button"
              onClick={handleDownloadBotScript}
              className="cat-pill-btn"
              style={{
                width: '100%',
                height: '36px',
                padding: '0 0.85rem',
                fontSize: '0.78rem',
                background: 'rgba(37, 211, 102, 0.12)',
                color: '#25D366',
                border: '1px solid rgba(37, 211, 102, 0.3)',
                gap: '6px',
                justifyContent: 'center',
                fontWeight: 700
              }}
              title="Descargar script para ejecutar el bot localmente"
            >
              <Download size={14} />
              <span>Descargar Script Local (.bat)</span>
            </button>

            {/* CONTROLS */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
              {connectionStatus !== 'connected' ? (
                <button
                  type="button"
                  disabled={loadingAction || !serverOnline}
                  className="cat-pill-btn active"
                  style={{ height: '36px', padding: '0 1rem', fontSize: '0.8rem', gap: '6px', flex: 1, justifyContent: 'center' }}
                  onClick={handleStartBot}
                >
                  <RefreshCw size={14} className={loadingAction ? 'spin-slow' : ''} />
                  <span>{loadingAction ? 'Iniciando...' : 'Generar / Actualizar QR'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={loadingAction}
                  className="qty-btn"
                  style={{ width: '100%', height: '36px', padding: '0 1rem', fontSize: '0.8rem', color: 'var(--accent-rose)', gap: '6px', justifyContent: 'center' }}
                  onClick={handleLogoutBot}
                >
                  <Trash2 size={14} />
                  <span>Desvincular WhatsApp</span>
                </button>
              )}
            </div>
          </div>

          {/* RIGHT: DETAILED INSTRUCTIONS & DIAGNOSTICS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                Vinculación Real Multi-Dispositivo con WhatsApp
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
                Este módulo utiliza la tecnología de <strong>Baileys (WebSockets)</strong> para conectarse directamente a los servidores de WhatsApp como un dispositivo vinculado oficial. No requiere suscripciones pagas ni APIs de terceros.
              </p>
            </div>

            {/* IF SERVER IS OFFLINE */}
            {!serverOnline && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1.5px solid var(--accent-amber)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 900, color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={18} />
                  <span>El Servidor de WhatsApp (Puerto 3002) no está encendido</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  Para que el código QR aparezca y el bot responda mensajes en vivo, debés iniciar el servicio en segundo plano:
                  <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                    <li>Doble clic en el archivo <strong>INICIAR_BOT_WHATSAPP.bat</strong> en la raíz de ComandaFast.</li>
                    <li>O ejecutá en una terminal: <code>npm run bot-server</code>.</li>
                  </ul>
                </div>
                <div style={{ marginTop: '4px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="cat-pill-btn active"
                      style={{ height: '32px', padding: '0 0.85rem', fontSize: '0.78rem', gap: '6px' }}
                      onClick={fetchServerStatus}
                    >
                      <RefreshCw size={13} />
                      <span>Comprobar Estado del Servidor</span>
                    </button>
                    <button
                      type="button"
                      className="cat-pill-btn"
                      style={{
                        height: '32px',
                        padding: '0 0.85rem',
                        fontSize: '0.78rem',
                        gap: '6px',
                        background: 'var(--accent-amber)',
                        color: '#000',
                        fontWeight: 800
                      }}
                      onClick={handleDownloadBotScript}
                    >
                      <Download size={13} />
                      <span>Descargar INICIAR_BOT_WHATSAPP.bat</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

                        {/* TARJETA DE DESCARGA DE SCRIPTS */}
            <div style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.15rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Terminal size={17} style={{ color: 'var(--accent-emerald)' }} />
                  <span>Descargar Scripts de Ejecución Local para Windows</span>
                </div>
                <span style={{ fontSize: '0.7rem', background: 'rgba(37, 211, 102, 0.15)', color: '#25D366', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
                  Listo para Usar
                </span>
              </div>
              
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                Podés descargar los archivos ejecutables <strong>.bat</strong> directamente en tu PC. Incluyen detección de Node.js, auto-instalación de dependencias, control de puertos y visualización de Código QR en consola.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '4px' }}>
                {/* BOT ONLY SCRIPT */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Smartphone size={15} style={{ color: '#25D366' }} />
                    <span>Bot de WhatsApp</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Inicia el microservicio Baileys en puerto 3002 con menú de QR en consola.
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadBotScript}
                    className="cat-pill-btn active"
                    style={{
                      marginTop: '6px',
                      height: '32px',
                      fontSize: '0.75rem',
                      gap: '6px',
                      justifyContent: 'center',
                      background: '#25D366',
                      color: '#052e16',
                      fontWeight: 800
                    }}
                  >
                    <Download size={13} />
                    <span>Descargar INICIAR_BOT_WHATSAPP.bat</span>
                  </button>
                </div>

                {/* FULL SYSTEM SCRIPT */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={15} style={{ color: 'var(--accent-amber)' }} />
                    <span>Sistema Completo + Bot</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Lanza el Bot en consola, el servidor web Vite y abre el navegador automáticamente.
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadAllScript}
                    className="cat-pill-btn"
                    style={{
                      marginTop: '6px',
                      height: '32px',
                      fontSize: '0.75rem',
                      gap: '6px',
                      justifyContent: 'center',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: 'var(--accent-amber)',
                      border: '1px solid var(--accent-amber)',
                      fontWeight: 800
                    }}
                  >
                    <Download size={13} />
                    <span>Descargar INICIAR_SISTEMA_COMPLETO.bat</span>
                  </button>
                </div>
              </div>
            </div>

            {/* STEPS TO CONNECT */}
            <div style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-amber)' }}>
                Pasos para escanear y conectar:
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                1. Abrí <strong>WhatsApp</strong> en el teléfono oficial de la hamburguesería.<br />
                2. Tocá los <strong>tres puntos</strong> (Android) o <strong>Ajustes</strong> (iPhone) y seleccioná <strong>Dispositivos vinculados</strong>.<br />
                3. Tocá <strong>Vincular un dispositivo</strong>.<br />
                4. Apuntá la cámara al <strong>Código QR de la izquierda</strong>.<br />
                5. ¡Listo! La pantalla se actualizará automáticamente a <strong>Conectado</strong> y el bot comenzará a responder y cargar pedidos en ComandaFast.
              </div>
            </div>

            {/* STATUS ENDPOINT LINK */}
            <div style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <strong>Diagnóstico de Servidor:</strong> Endpoint activo en <code>http://localhost:3002/status</code>
              </div>
              <a
                href="http://localhost:3002/status"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 700 }}
              >
                <span>Ver JSON</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
