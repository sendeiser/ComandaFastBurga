// =========================================================
// useCatalogCart.js — Hook de estado del carrito del catálogo
// Persiste en sessionStorage, soporta modificadores y toppings
// =========================================================

import { useState, useCallback } from 'react';

const SESSION_KEY = 'cf_catalog_cart';

function loadCart() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart(items) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(items));
  } catch {}
}

export function useCatalogCart() {
  const [items, setItems] = useState(() => loadCart());

  const updateItems = useCallback((newItems) => {
    setItems(newItems);
    saveCart(newItems);
  }, []);

  /** Agrega un ítem al carrito (con modificadores ya calculados) */
  const addItem = useCallback((product, qty = 1, selectedMods = [], selectedOptions = [], notes = '', unitPriceWithMods = null) => {
    const extraCost = selectedMods.reduce((sum, m) => sum + (m.price || 0), 0) +
                      selectedOptions.reduce((sum, o) => sum + (o.price || 0), 0);
    const finalPrice = unitPriceWithMods ?? (product.price + extraCost);

    const cartItem = {
      cartId: `${product.id}_${Date.now()}`,
      productId: product.id,
      name: product.name,
      emoji: product.emoji || '🍔',
      image: product.image || '',
      category: product.category || '',
      unitPrice: finalPrice,
      basePrice: product.price,
      qty,
      selectedMods,     // toppings incrementales
      selectedOptions,  // checkbox options (e.g. salsas)
      notes,
    };

    setItems(prev => {
      const next = [...prev, cartItem];
      saveCart(next);
      return next;
    });
  }, []);

  /** Actualiza la cantidad de un ítem */
  const updateQty = useCallback((cartId, qty) => {
    setItems(prev => {
      let next;
      if (qty <= 0) {
        next = prev.filter(i => i.cartId !== cartId);
      } else {
        next = prev.map(i => i.cartId === cartId ? { ...i, qty } : i);
      }
      saveCart(next);
      return next;
    });
  }, []);

  /** Elimina un ítem del carrito */
  const removeItem = useCallback((cartId) => {
    setItems(prev => {
      const next = prev.filter(i => i.cartId !== cartId);
      saveCart(next);
      return next;
    });
  }, []);

  /** Vacía el carrito */
  const clearCart = useCallback(() => {
    updateItems([]);
  }, [updateItems]);

  const totalItems = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);

  return {
    items,
    totalItems,
    subtotal,
    addItem,
    updateQty,
    removeItem,
    clearCart,
  };
}
