---
name: ComandaFast Design System
description: High-performance, tactile design system for fast-food POS & Kitchen Display System with pristine Light Mode as primary theme and high-contrast Dark Mode
colors:
  primary: "#f59e0b"
  primary-glow: "rgba(245, 158, 11, 0.2)"
  primary-deep: "#d97706"
  neutral-bg: "#f8fafc"
  neutral-card: "#ffffff"
  neutral-card-hover: "#f1f5f9"
  neutral-input: "#0e1626"
  neutral-text: "#f8fafc"
  neutral-text-secondary: "#94a3b8"
  neutral-text-muted: "#64748b"
  accent-emerald: "#10b981"
  accent-rose: "#ef4444"
  accent-blue: "#3b82f6"
  accent-purple: "#8b5cf6"
  neutral-white: "#ffffff"
  neutral-black: "#000000"
  neutral-slate-100: "#f1f5f9"
  neutral-slate-200: "#e2e8f0"
  neutral-slate-300: "#cbd5e1"
  border-subtle: "#1e293b"
  border-active: "#334155"
typography:
  display:
    fontFamily: "Outfit, system-ui, -apple-system, sans-serif"
    fontSize: "clamp(1.5rem, 4vw, 2.25rem)"
    fontWeight: 900
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Outfit, system-ui, -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.85rem"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
  card:
    backgroundColor: "{colors.neutral-card}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System

## Overview

ComandaFast utiliza un sistema de diseño de alto rendimiento, optimizado para interfaces táctiles y operaciones de alta velocidad en ambientes gastronómicos.
Prioriza la ergonomía visual, el contraste marcado en modo oscuro (Canvas `#0b0f19`), la respuesta táctil inmediata (`touch-action: manipulation`) y la eliminación de sobrecostos gráficos (cero repaints innecesarios o desenfoques masivos).

## Colors

- **Primary Accent (`#f59e0b`)**: Ámbar gastronómico cálido. Empleado en acciones principales, estados activos, totales de comanda y marcas de foco.
- **Dark Canvas (`#0b0f19`)**: Fondo base oscuro para reducir fatiga visual y mejorar contraste.
- **Card Surface (`#131b2e` / `#162035`)**: Contenedores de productos, comandas y paneles de control.
- **Semantic Accents**:
  - `Emerald (#10b981)`: Comandas listas, cobros acreditados, estado online de sincronización.
  - `Rose (#ef4444)`: Egresos de caja, cancelaciones, alertas críticas de demora.
  - `Blue (#3b82f6)`: Pedidos en preparación, WhatsApp bot activo.
  - `Purple (#8b5cf6)`: Delivery o pedidos para llevar.

## Typography

- **Títulos y Cabeceras**: `Outfit` — Aporta solidez, legibilidad instantánea y presencia visual en mostradores y KDS.
- **Cuerpo y UI**: `Plus Jakarta Sans` — Geometría limpia para descripciones, nombres de ítems y opciones de pago.
- **Números & Moneda**: `font-variant-numeric: tabular-nums` — Asegura alineación estricta en tablas de auditoría, precios y cantidades sin saltos en animaciones.
- **Tickets & Auditoría**: `JetBrains Mono` — Para previsualización térmica y seriales.

## Layout

- **Desktop & Mostrador**: Cuadrícula dividida de 2 columnas (Catálogo de productos a la izquierda, Orden actual / Carrito de cobro a la derecha).
- **Cocina (KDS)**: Grilla horizontal desplazable o adaptativa de tarjetas de comanda con código de colores según tiempo transcurrido.
- **Mobile & Tablet**: Pestañas de navegación compactas inferiores o cabecera con navegación deslizable, áreas táctiles mínimas de 44x44px.

## Elevation & Depth

- Elevación mediante capas tonales (`#0b0f19` → `#131b2e` → `#162035`) y bordes sutiles de 1px (`#1e293b`).
- Sombras ligeras de una sola capa (`0 4px 10px rgba(0, 0, 0, 0.4)`) para máxima fluidez en procesadores integrados.
- Resplandores selectivos para confirmación táctil (`--accent-amber-glow`).

## Shapes

- Radios consistentes: 8px para botones y entradas, 12px para tarjetas de producto, 16px para modales principales.
- Se evitan bordes rectos ásperos sin llegar a formas de píldora excesivas en contenedores principales.

## Components

- **Order Pad Grid**: Tarjetas de producto táctiles con selector de aderezos, opciones simples/dobles y confirmación sonora.
- **Cash Shifts Card**: Resumen de caja con visualización de arqueo teórico, fondo inicial y arqueo real sin bordes asimétricos bruscos.
- **KDS Kitchen Ticket**: Tarjeta con temporizador de espera en vivo, lista de ítems tachables y botón de despacho unificado.
- **Themed Browser Surfaces**: Caret y selección en ámbar de marca, focus rings de 2px con offset para navegación por teclado.

## Do's and Don'ts

### Do's
- Mantener contrastes de texto superiores a 4.5:1 sobre todas las superficies oscuras.
- Utilizar `tabular-nums` en montos monetarios, cantidades y totales.
- Probar la interacción táctil en resoluciones pequeñas (375px a 768px).
- Usar retroalimentación visual clara (cambio de fondo y borde sutil) en estados hover y active.

### Don'ts
- No utilizar bordes laterales gruesos asimétricos (`border-left: 3px solid ...`) como único adorno de tarjetas.
- No emplear filtros de desenfoque excesivos (`backdrop-filter`) en bucles o elementos con scroll frecuente.
- No usar fuentes genéricas del sistema para títulos ni tamaños de fuente inferiores a 12px para información operativa clave.
