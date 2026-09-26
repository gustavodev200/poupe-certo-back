import { z } from 'zod';

export const createPriceReportSchema = z.object({
  marketId: z.string().uuid('marketId inválido'),
  price: z.coerce
    .number()
    .positive('Preço deve ser maior que zero')
    .finite('Preço inválido'),
});

export type CreatePriceReportInput = z.infer<typeof createPriceReportSchema>;
