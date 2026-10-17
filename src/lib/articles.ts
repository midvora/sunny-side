import type { MarkdownInstance } from 'astro';
import { guard } from './site';

export interface ArticleMeta {
  title: string;
  description: string;
  category: string;
  readTime: string;
  image: string;
  updated: string;
  order: number;
  status: string;
}

const mods = import.meta.glob<{ frontmatter: ArticleMeta; Content: MarkdownInstance<ArticleMeta>['Content'] }>(
  '../content/resources/*.md',
  { eager: true },
);

export const articles = Object.entries(mods)
  .map(([path, mod]) => {
    const slug = path.split('/').pop()!.replace(/\.md$/, '');
    guard(mod.frontmatter, `article "${slug}"`);
    return { slug, ...mod.frontmatter, Content: mod.Content };
  })
  .sort((a, b) => a.order - b.order);

export type Article = (typeof articles)[number];
