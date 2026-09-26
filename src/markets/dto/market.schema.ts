import { z } from 'zod';

export const createMarketSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(150),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  uf: z
    .string()
    .trim()
    .length(2, 'UF deve ter 2 letras')
    .transform((value) => value.toUpperCase())
    .optional(),
});

export type CreateMarketInput = z.infer<typeof createMarketSchema>;
