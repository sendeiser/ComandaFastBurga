import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, 'ComandaFast-Bot-Portatil');
const ZIP_FILE = path.join(ROOT_DIR, 'ComandaFast-Bot-Portatil.zip');

console.log('=====================================================================');
console.log('   🍔 [COMANDAFAST] - GENERADOR DE BOT PORTABLE CON NODE EMBEBIDO');
console.log('=====================================================================\n');

// 1. Limpieza de carpetas previas
console.log('[1/7] Preparando directorio de salida...');
if (fs.existsSync(OUTPUT_DIR)) {
  console.log('  -> Eliminando version anterior de ComandaFast-Bot-Portatil...');
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
}
if (fs.existsSync(ZIP_FILE)) {
  console.log('  -> Eliminando archivo ZIP anterior...');
  fs.unlinkSync(ZIP_FILE);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(path.join(OUTPUT_DIR, 'server'), { recursive: true });
fs.mkdirSync(path.join(OUTPUT_DIR, 'data'), { recursive: true });
fs.mkdirSync(path.join(OUTPUT_DIR, 'data', 'baileys_auth'), { recursive: true });

// 2. Copia de código fuente
console.log('[2/7] Copiando archivos de servidor y lógica del bot...');
const serverFiles = ['whatsappBotServer.js', 'geminiBotService.js', 'printerServer.js'];
serverFiles.forEach(file => {
  const src = path.join(ROOT_DIR, 'server', file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(OUTPUT_DIR, 'server', file));
    console.log(`  -> server/${file} copiado.`);
  }
});

// 3. Copia de variables de entorno y datos iniciales
console.log('[3/7] Copiando configuraciones y base de datos inicial...');
const envSrc = path.join(ROOT_DIR, '.env');
if (fs.existsSync(envSrc)) {
  fs.copyFileSync(envSrc, path.join(OUTPUT_DIR, '.env'));
  console.log('  -> .env copiado (claves de IA Gemini).');
}

const dataFiles = [
  'bot_variables.json',
  'bot_templates.json',
  'custom_flows.json',
  'ai_config.json',
  'products.json'
];

dataFiles.forEach(df => {
  const src = path.join(ROOT_DIR, 'data', df);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(OUTPUT_DIR, 'data', df));
    console.log(`  -> data/${df} copiado.`);
  }
});

// 4. Copiar Node.js ejecutable embebido
console.log('[4/7] Incorporando Node.js Portable (node.exe embebido)...');
let nodeCopied = false;

// Intentar copiar desde process.execPath actual
if (fs.existsSync(process.execPath) && process.execPath.toLowerCase().endsWith('node.exe')) {
  try {
    fs.copyFileSync(process.execPath, path.join(OUTPUT_DIR, 'node.exe'));
    console.log(`  -> [OK] node.exe embebido copiado desde: ${process.execPath}`);
    nodeCopied = true;
  } catch (err) {
    console.warn('  -> No se pudo copiar directo de execPath, probando rutas alternativas:', err.message);
  }
}

if (!nodeCopied) {
  try {
    const whereOutput = execSync('where.exe node', { encoding: 'utf-8' }).trim().split(/\r?\n/)[0];
    if (whereOutput && fs.existsSync(whereOutput)) {
      fs.copyFileSync(whereOutput, path.join(OUTPUT_DIR, 'node.exe'));
      console.log(`  -> [OK] node.exe copiado desde where.exe: ${whereOutput}`);
      nodeCopied = true;
    }
  } catch (err) {
    console.warn('  -> No se pudo ubicar node con where.exe.');
  }
}

if (!nodeCopied) {
  console.log('  -> Descargando node.exe portable oficial desde nodejs.org...');
  try {
    execSync(`powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.0/win-x64/node.exe' -OutFile '${path.join(OUTPUT_DIR, 'node.exe')}'"`, { stdio: 'inherit' });
    nodeCopied = true;
    console.log('  -> [OK] node.exe descargado e integrado con exito.');
  } catch (err) {
    console.error('  -> [ERROR] No se pudo obtener node.exe embebido:', err.message);
  }
}

// 5. Generar package.json e instalar dependencias limpias en ComandaFast-Bot-Portatil
console.log('[5/7] Generando package.json e instalando librerias limpias del bot...');
const portablePkg = {
  name: "comandafast-bot-portable",
  version: "1.0.0",
  private: true,
  type: "module",
  scripts: {
    "start": "node server/whatsappBotServer.js",
    "qr": "node server/whatsappBotServer.js --reset"
  },
  dependencies: {
    "@google/genai": "^2.23.0",
    "@whiskeysockets/baileys": "^7.0.0-rc14",
    "cors": "^2.8.6",
    "dotenv": "^18.0.1",
    "express": "^5.2.1",
    "pino": "^10.3.1",
    "qrcode": "^1.5.4",
    "qrcode-terminal": "^0.12.0"
  }
};

fs.writeFileSync(path.join(OUTPUT_DIR, 'package.json'), JSON.stringify(portablePkg, null, 2), 'utf-8');

console.log('  -> Ejecutando npm install en la carpeta portable (solo dependencias necesarias)...');
execSync('npm install --omit=dev --no-audit --no-fund', {
  cwd: OUTPUT_DIR,
  stdio: 'inherit'
});
console.log('  -> [OK] Dependencias instaladas en node_modules del paquete.');

// 6. Generar scripts lanzadores .bat y LEEME
console.log('[6/7] Creando scripts lanzadores y manual de uso...');

const iniciarBatContent = `@echo off
chcp 65001 > nul
title ComandaFast - Bot WhatsApp Portatil
color 0B
cls

cd /d "%~dp0"

set NODE_BIN=node.exe
if exist "%~dp0node.exe" (
    set NODE_BIN="%~dp0node.exe"
    echo [OK] Utilizando Node.js Portable Embebido.
) else (
    where node >nul 2>nul
    if %errorlevel% equ 0 (
        set NODE_BIN=node
        echo [OK] Utilizando Node.js instalado en el sistema.
    ) else (
        color 0C
        echo =====================================================================
        echo [ERROR] No se encontro node.exe en esta carpeta ni en el sistema.
        echo =====================================================================
        pause
        exit /b 1
    )
)

echo.
echo =====================================================================
echo    🍔 [COMANDAFAST] - BOT DE WHATSAPP PORTATIL (AUTONOMO)
echo    Conectado a la nube Supabase para sincronizar pedidos con el POS
echo =====================================================================
echo.

:: Comprobar si el puerto 3002 ya esta ocupado
set OCCUPIED_PID=
for /f "tokens=5" %%p in ('netstat -aon ^| findstr :3002 ^| findstr LISTENING 2^>nul') do (
    set OCCUPIED_PID=%%p
)

if defined OCCUPIED_PID (
    echo [AVISO] Ya hay un bot o proceso ejecutandose en el puerto 3002 (PID %OCCUPIED_PID%).
    set /p RESTART="¿Deseas cerrar el proceso anterior y reiniciar el bot? (S/N): "
    if /i "%RESTART%"=="S" (
        taskkill /F /PID %OCCUPIED_PID% >nul 2>nul
        timeout /t 2 /nobreak >nul
    ) else (
        echo Operacion cancelada.
        pause
        exit /b 0
    )
)

echo.
echo ¿Como deseas iniciar el bot?
echo.
echo   [1] Iniciar normalmente (Mantiene tu sesion de WhatsApp guardada)
echo   [2] Vincular NUEVO celular (Muestra el Codigo QR en esta ventana)
echo   [3] Salir
echo.
set OP=1
set /p OP="Elige 1, 2 o 3 (Por defecto 1): "

if "%OP%"=="2" (
    cls
    echo =====================================================================
    echo    📲 [VINCULACION] ESCANEA ESTE CODIGO QR CON TU WHATSAPP
    echo =====================================================================
    echo.
    echo 1. Abre WhatsApp en tu celular.
    echo 2. Ve a Ajustes / Menu (3 puntitos) ^> Dispositivos vinculados ^> Vincular dispositivo.
    echo 3. Apunta tu camara al codigo QR que aparecera a continuacion:
    echo.
    %NODE_BIN% server\\whatsappBotServer.js --reset
) else if "%OP%"=="3" (
    exit /b 0
) else (
    cls
    echo =====================================================================
    echo    🚀 INICIANDO BOT EN MODO NORMAL (CONEXION CLOUD CON SUPABASE)
    echo =====================================================================
    echo.
    %NODE_BIN% server\\whatsappBotServer.js
)

echo.
pause
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'INICIAR_BOT.bat'), iniciarBatContent, 'utf-8');

const detenerBatContent = `@echo off
chcp 65001 > nul
title ComandaFast - Detener Bot WhatsApp
color 0C
cls

echo =====================================================================
echo    CERRANDO INSTANCIAS DE BOT WHATSAPP (PUERTO 3002)...
echo =====================================================================
echo.

set KILLED=0
for /f "tokens=5" %%p in ('netstat -aon ^| findstr :3002 ^| findstr LISTENING 2^>nul') do (
    echo Cerrando proceso PID %%p...
    taskkill /F /PID %%p >nul 2>nul
    set KILLED=1
)

if "%KILLED%"=="1" (
    echo.
    echo [OK] El bot se ha detenido correctamente.
) else (
    echo.
    echo [INFO] No habia ningun bot activo en el puerto 3002.
)

echo.
echo =====================================================================
timeout /t 3 /nobreak >nul
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'DETENER_BOT.bat'), detenerBatContent, 'utf-8');

const leemeContent = `=====================================================================
   GUIA DE USO - BOT WHATSAPP PORTATIL DE COMANDAFAST (PLUG & PLAY)
=====================================================================

¡Este paquete es 100% AUTONOMO y PORTATIL!
Contiene su propio motor de Node.js embebido (node.exe) y todas las
librerias ya pre-instaladas. Funciona en cualquier computadora con
Windows sin necesidad de instalar nada previo.

---------------------------------------------------------------------
📁 ¿COMO USAR EN UN PENDRIVE O EN OTRA PC?
---------------------------------------------------------------------
1. Copia la carpeta "ComandaFast-Bot-Portatil" a tu pendrive, o envia
   el archivo "ComandaFast-Bot-Portatil.zip" por WhatsApp Web / Email.

2. En la computadora destino, si enviaste el ZIP, haz clic derecho
   y selecciona "Extraer todo...".

3. Entra a la carpeta y haz doble clic en "INICIAR_BOT.bat".

4. Si es la primera vez que lo usas con un numero nuevo:
   - Elige la opcion [2] en la pantalla.
   - En tu celular abre WhatsApp > Menu > Dispositivos vinculados > Vincular.
   - Escanea el codigo QR que aparecera directamente en la pantalla negra.

5. En los siguientes inicios:
   - Simplemente haz doble clic en "INICIAR_BOT.bat" y presiona ENTER (opcion 1).
   - El bot se conectara automaticamente en segundos sin pedir QR de nuevo.

---------------------------------------------------------------------
☁️ ¿COMO SE CONECTA CON EL SISTEMA / CAJA / COCINA?
---------------------------------------------------------------------
- El bot esta conectado directamente a Supabase Cloud.
- Cada pedido que un cliente haga por WhatsApp entrara automaticamente
  al POS de Caja y al Monitor de Cocina (KDS) en tiempo real, incluso si
  el bot esta corriendo en una computadora distinta a la de la caja.

---------------------------------------------------------------------
🛑 ¿COMO DETENER EL BOT?
---------------------------------------------------------------------
- Puedes simplemente cerrar la ventana de la consola, o hacer doble clic
  en "DETENER_BOT.bat".

=====================================================================
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'LEEME_INSTRUCCIONES.txt'), leemeContent, 'utf-8');

// 7. Comprimir en archivo ZIP listo para distribución
console.log('[7/7] Comprimiendo paquete en archivo ZIP listo para pendrive o WhatsApp...');
try {
  execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${OUTPUT_DIR}\\*' -DestinationPath '${ZIP_FILE}' -Force"`, {
    stdio: 'inherit'
  });
  const zipStat = fs.statSync(ZIP_FILE);
  const zipMb = (zipStat.size / (1024 * 1024)).toFixed(2);
  console.log(`\n  -> [OK] Archivo ZIP generado: ${ZIP_FILE} (${zipMb} MB)`);
} catch (err) {
  console.warn('  -> [AVISO] No se pudo comprimir automáticamente el ZIP:', err.message);
}

console.log('\n=====================================================================');
console.log('   🎉 ¡BOT PORTATIL AUTONOMO GENERADO CON EXITO!');
console.log('=====================================================================');
console.log(`📁 Carpeta generada:  ${OUTPUT_DIR}`);
if (fs.existsSync(ZIP_FILE)) {
  console.log(`📦 Archivo ZIP listo: ${ZIP_FILE}`);
}
console.log('=====================================================================\n');
