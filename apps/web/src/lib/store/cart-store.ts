'use client';

import { create } from 'zustand';

interface CartUiState {
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

export const useCartUi = create<CartUiState>((set) => ({
  isCartOpen: false,
  openCart: () => set({ isCartOpen: true }),
  closeCart: () => set({ isCartOpen: false }),
}));
