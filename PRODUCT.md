# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

1. **Cajeros / Vendedores de Mostrador**: Personal gastronómico que toma pedidos rápidamente en caja, abre/cierra turnos de caja, maneja cobros (efectivo, Mercado Pago, débito, transferencia) y emite comandas.
2. **Personal de Cocina (KDS)**: Cocineros y plancheros que visualizan comandas en tiempo real, agrupan pedidos por mesa/cliente, marcan comandas en preparación o listas, y requieren interfaz de alto contraste legible a distancia.
3. **Dueño / Administrador del Local**: Acceso al portal de auditoría, cierres de turno, métricas financieras, configuración de bot de WhatsApp, auditoría de seguridad y tablas Supabase.
4. **Clientes (vía WhatsApp)**: Clientes que envían pedidos vía mensaje o audio interactuando con el bot automatizado integrado.

## Product Purpose

**ComandaFast** es un sistema gastronómico de Punto de Venta (POS), Cocina (KDS) y Auditoría para hamburgueserías y locales de comida rápida. Su propósito es erradicar demoras de atención, fallas de conectividad y pérdidas de dinero mediante operaciones sin fricción, almacenamiento local resiliente con sincronización Supabase en tiempo real, e integración nativa con WhatsApp.

## Positioning

A diferencia de los sistemas de comandas tradicionales lentos, basados en abonos rígidos o dependientes de internet constante, ComandaFast opera con latencia cero en frontend (IndexedDB / LocalStorage first), soporta pantalla táctil y móvil instantánea, y procesa comandas de WhatsApp directamente hacia la cocina sin requerir re-tipeo manual.

## Operating Context

- Mostradores de comida rápida con alta rotación en horas pico.
- Tablets táctiles o celulares de mozos/cajeros bajo iluminación variable.
- Pantallas de cocina montadas cerca de freidoras y planchas con vapor y ruido.
- Redes locales o conexiones WiFi con caídas intermitentes.

## Capabilities and Constraints

- **Fast Order Pad**: Carga táctil de productos, agregados, promociones y personalización de notas.
- **Control de Caja y Turnos**: Apertura con fondo inicial, registro de egresos/gastos de caja chica, arqueo teórico vs real, y detección automática del cajero activo.
- **Cocina (KDS)**: Despacho de comandas con cronómetros por pedido y alertas visuales por demoras.
- **Historial & Facturación**: Reimpresión de tickets térmicos (80mm/58mm), cambios de estado y cancelaciones seguras.
- **Bot de WhatsApp**: Polling e integración con servidor Node.js/Baileys para recepción y confirmación de pedidos automatizados.
- **Auditoría & Seguridad**: Métricas de rendimiento, ticket promedio, seguridad PIN y exportación de reportes.

## Brand Commitments

- **Nombre**: ComandaFast (Burga & Fast Food).
- **Estética**: High-Contrast Dark Canvas (`#0b0f19`), acento dorado/ámbar cálido gastronómico (`#f59e0b`), y superficies oscuras sin reflejos molestos.
- **Tipografía**: Sans-serif moderna y legible (`Plus Jakarta Sans` para lectura e interfaces, `Outfit` para títulos y números de mesa, `JetBrains Mono` para tickets y códigos).

## Evidence on Hand

- Código fuente completo en React 18 + Vite (`src/`).
- Backend local para WhatsApp Bot (`server/`).
- Conexión Supabase para sincronización cloud (`src/services/supabaseClient.js`).
- Base de datos local resiliente en `storageService.js`.

## Product Principles

1. **Velocidad sin concesiones**: Cada milisegundo cuenta en hora pico. Cero repaints costosos, cero pantallas bloqueadas.
2. **Tolerancia a fallos**: Si se corta internet, el local sigue cobrando e imprimiendo; se sincroniza al restablecer conexión.
3. **Legibilidad táctil**: Controles claros, contraste mínimo 4.5:1, áreas de toque cómodas en pantallas táctiles y móviles.
4. **Veracidad de datos**: Los cierres de turno y arqueos de caja reflejan con precisión los ingresos, egresos y diferencias de dinero.
