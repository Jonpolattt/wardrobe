'use client';

import { ProductGallery } from './ProductGallery';
import { useProductColor } from '@/lib/store/product-color-context';

interface ColorImagesEntry {
  color: string;
  images: string[];
}

// Thin wrapper around the (still purely presentational) ProductGallery:
// reads the currently-selected color from ProductColorContext (set by
// ProductActions as the shopper picks a color) and swaps in that color's
// dedicated photos — falling back to the product's general `images` list
// whenever the admin hasn't uploaded any for that particular color.
export function ProductGalleryForColor({
  images,
  colorImages,
  title,
}: {
  images: string[];
  colorImages: ColorImagesEntry[];
  title: string;
}) {
  const { color } = useProductColor();
  const entry = colorImages.find((ci) => ci.color === color);
  const galleryImages = entry && entry.images.length > 0 ? entry.images : images;

  return <ProductGallery images={galleryImages} title={title} />;
}
