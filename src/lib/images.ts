import type { ImageMetadata } from 'astro';
import imagesData from '../data/images.json';
import { guard } from './site';

export interface PhotoRecord {
  file: string;
  alt: string;
  focal: string;
  status: string;
  replaceWith: string;
  credit: { photographer: string; title: string; pexelsId: number };
}

const files = import.meta.glob<ImageMetadata>('../assets/photos/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
});

const records = imagesData.images as Record<string, PhotoRecord>;

export function photo(key: string): PhotoRecord & { meta: ImageMetadata; key: string } {
  const rec = records[key];
  if (!rec) throw new Error(`Unknown photo "${key}" (not in src/data/images.json)`);
  guard(rec, `photo "${key}"`);
  const meta = files[`../assets/photos/${rec.file}`];
  if (!meta) throw new Error(`Photo file missing for "${key}": src/assets/photos/${rec.file}`);
  return { ...rec, meta, key };
}

export const allPhotoKeys = (): string[] => Object.keys(records);
export const pexelsUrl = (id: number): string => `https://www.pexels.com/photo/${id}/`;

// object-position per focal point, emitted once as a <style> block so images need no inline style attribute.
export const focalCss = (): string =>
  [...new Set(Object.values(records).map((r) => r.focal))]
    .map((f) => `img[data-focal="${f}"]{object-position:${f}}`)
    .join('');
