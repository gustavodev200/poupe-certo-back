import { z } from 'zod';
import { CATEGORY_CODES } from '../categories';

export const eanSchema = z
  .string()
  .trim()
  .regex(/^\d{8,14}$/, 'EAN deve ter de 8 a 14 dígitos numéricos');

const cityFilterSchema = {
  city: z.string().trim().min(1).optional(),
  uf: z
    .string()
    .trim()
    .length(2, 'UF deve ter 2 letras')
    .transform((value) => value.toUpperCase())
    .optional(),
};

export const searchProductsQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(''),
  category: z.enum(CATEGORY_CODES).optional(),
  sort: z.enum(['preco', 'recente']).optional().default('preco'),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  ...cityFilterSchema,
});

export type SearchProductsQuery = z.infer<typeof searchProductsQuerySchema>;

export const productDetailQuerySchema = z.object(cityFilterSchema);

export type ProductDetailQuery = z.infer<typeof productDetailQuerySchema>;

export const createProductSchema = z.object({
  ean: eanSchema,
  name: z
    .string()
    .trim()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(200),
  brand: z
    .string()
    .trim()
    .min(2, 'Marca deve ter no mínimo 2 caracteres')
    .max(120),
  qty: z.string().trim().min(1, 'Informe a quantidade').max(40),
  category: z.enum(CATEGORY_CODES),
  imageUrl: z.string().trim().url('URL de imagem inválida').optional(),
  marketId: z.string().uuid('marketId inválido'),
  price: z.coerce
    .number()
    .positive('Preço deve ser maior que zero')
    .finite('Preço inválido'),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
