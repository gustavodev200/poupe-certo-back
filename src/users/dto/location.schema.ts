import { z } from 'zod';

export const updateLocationSchema = z.object({
  city: z.string().trim().min(1, 'Cidade é obrigatória').max(100),
  uf: z
    .string()
    .trim()
    .length(2, 'UF deve ter 2 letras')
    .transform((value) => value.toUpperCase()),
});

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
