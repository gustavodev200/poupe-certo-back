import { z } from 'zod';

export const createMarketSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(150),
  address: z.string().trim().max(200).optional(),
  // Obrigatórios: GET /markets filtra por cidade/UF, então mercado sem
  // cidade nunca apareceria na lista de ninguém.
  city: z.string().trim().min(1, 'Informe a cidade do mercado').max(100),
  uf: z
    .string()
    .trim()
    .length(2, 'UF deve ter 2 letras')
    .transform((value) => value.toUpperCase()),
});

export type CreateMarketInput = z.infer<typeof createMarketSchema>;

export const marketsQuerySchema = z.object({
  city: z.string().trim().min(1).optional(),
  uf: z
    .string()
    .trim()
    .length(2, 'UF deve ter 2 letras')
    .transform((value) => value.toUpperCase())
    .optional(),
});

export type MarketsQuery = z.infer<typeof marketsQuerySchema>;
