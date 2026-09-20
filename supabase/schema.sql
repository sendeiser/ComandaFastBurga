-- =========================================================
-- COMANDAFAST — SUPABASE POSTGRESQL SCHEMA & REALTIME SETUP
-- =========================================================

-- 1. Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA DE PRODUCTOS Y MENÚ
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    emoji TEXT DEFAULT '🍔',
    description TEXT,
    modifiers JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA DE TURNOS DE CAJA (ARQUEOS)
CREATE TABLE IF NOT EXISTS public.cash_shifts (
    id TEXT PRIMARY KEY,
    opened_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    initial_cash NUMERIC(10, 2) NOT NULL DEFAULT 0,
    counted_cash NUMERIC(10, 2),
    cashier_name TEXT NOT NULL DEFAULT 'Cajero 1',
    expenses JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    is_closed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLA DE ÓRDENES / COMANDAS
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_number INTEGER NOT NULL,
    channel TEXT NOT NULL, -- 'whatsapp' | 'mostrador' | 'mesa'
    table_number TEXT,
    customer JSONB DEFAULT '{}'::jsonb,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL, -- 'efectivo' | 'transferencia' | 'tarjeta'
    cash_paid NUMERIC(10, 2),
    cash_change NUMERIC(10, 2),
    transfer_proof TEXT,
    transfer_confirmed BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pendiente', -- 'pendiente' | 'cocina' | 'listo' | 'entregado' | 'cancelado'
    status_timestamps JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. ÍNDICES PARA ALTO RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);

-- 6. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para operación local / anónima autorizada
CREATE POLICY "Permitir lectura y escritura de productos" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir lectura y escritura de turnos de caja" ON public.cash_shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir lectura y escritura de órdenes" ON public.orders FOR ALL USING (true) WITH CHECK (true);

-- 7. HABILITAR PUBLICACIÓN EN TIEMPO REAL (REALTIME)
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
