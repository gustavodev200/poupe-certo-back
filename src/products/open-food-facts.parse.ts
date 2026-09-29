import { z } from 'zod';
import type { CategoryCode } from './categories';

// Resposta do Open Food Facts é entrada externa não confiável (Princípio II):
// tudo opcional, tipos checados, e textos cortados no mesmo limite que o
// createProductSchema aceita — assim a sugestão sempre cabe no formulário.
const offResponseSchema = z.object({
  status: z.number().optional(),
  product: z
    .object({
      product_name_pt: z.string().optional(),
      product_name: z.string().optional(),
      brands: z.string().optional(),
      quantity: z.string().optional(),
      image_front_url: z.string().optional(),
      categories_tags: z.array(z.string()).optional(),
    })
    .optional(),
});

export interface EanLookup {
  found: boolean;
  name: string | null;
  brand: string | null;
  qty: string | null;
  category: CategoryCode | null;
  imageUrl: string | null;
}

export const NOT_FOUND: EanLookup = {
  found: false,
  name: null,
  brand: null,
  qty: null,
  category: null,
  imageUrl: null,
};

// Só aceitamos foto hospedada pelo próprio OFF — essa URL depois é repassada
// ao Cloudinary para ele baixar, então qualquer outro host abriria um vetor
// de SSRF/conteúdo arbitrário (research.md#5).
const ALLOWED_IMAGE_HOSTS = new Set([
  'images.openfoodfacts.org',
  'static.openfoodfacts.org',
]);

// Ordem importa: a primeira regra que casar vence. Conservador de propósito —
// sem match, a pessoa escolhe a categoria (research.md#6).
const CATEGORY_RULES: [CategoryCode, string[]][] = [
  ['lim', ['en:household-cleaning', 'en:cleaning-products', 'en:detergents']],
  ['hig', ['en:hygiene', 'en:toiletries', 'en:toothpastes', 'en:soaps']],
  ['beb', ['en:beverages', 'en:waters', 'en:alcoholic-beverages']],
  ['pad', ['en:breads', 'en:biscuits-and-cakes', 'en:pastries', 'en:cakes']],
  ['fri', ['en:dairies', 'en:cheeses', 'en:meats', 'en:hams', 'en:yogurts']],
  [
    'merc',
    [
      'en:cereals-and-potatoes',
      'en:cereals-and-their-products',
      'en:pastas',
      'en:rices',
      'en:legumes',
      'en:sugars',
      'en:coffees',
      'en:fats',
      'en:condiments',
      'en:sauces',
      'en:canned-foods',
      'en:snacks',
    ],
  ],
];

function clean(value: string | undefined, max: number): string | null {
  const trimmed = value?.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function safeImageUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !ALLOWED_IMAGE_HOSTS.has(url.hostname)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function mapCategory(tags: string[] | undefined): CategoryCode | null {
  if (!tags?.length) return null;
  const set = new Set(tags);
  for (const [code, rule] of CATEGORY_RULES) {
    if (rule.some((tag) => set.has(tag))) return code;
  }
  return null;
}

export function parseOffResponse(body: unknown): EanLookup {
  const parsed = offResponseSchema.safeParse(body);
  if (!parsed.success || parsed.data.status !== 1 || !parsed.data.product) {
    return NOT_FOUND;
  }
  const product = parsed.data.product;
  const name = clean(product.product_name_pt || product.product_name, 200);
  const brand = clean(product.brands?.split(',')[0], 120);
  const qty = clean(product.quantity, 40);
  const imageUrl = safeImageUrl(product.image_front_url);

  if (!name && !brand && !qty && !imageUrl) return NOT_FOUND;

  return {
    found: true,
    name,
    brand,
    qty,
    category: mapCategory(product.categories_tags),
    imageUrl,
  };
}
