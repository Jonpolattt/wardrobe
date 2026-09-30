'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

// Lets the product detail page's gallery (ProductGalleryForColor) react to
// the color the shopper picks in ProductActions, without the two — which
// are separate sibling client components — needing to be merged into one.
// A plain React Context (created fresh per page render) rather than a
// module-level Zustand store: a singleton store would leak the selected
// color across navigations between different products.
//
// The default value (no-op setColor) means any consumer rendered outside a
// <ProductColorProvider> just harmlessly does nothing instead of throwing —
// defensive in case either component is ever reused somewhere else.
interface ProductColorContextValue {
  color: string;
  setColor: (color: string) => void;
}

const ProductColorContext = createContext<ProductColorContextValue>({
  color: '',
  setColor: () => {},
});

export function ProductColorProvider({
  initialColor,
  children,
}: {
  initialColor: string;
  children: ReactNode;
}) {
  const [color, setColor] = useState(initialColor);
  return (
    <ProductColorContext.Provider value={{ color, setColor }}>{children}</ProductColorContext.Provider>
  );
}

export function useProductColor() {
  return useContext(ProductColorContext);
}
