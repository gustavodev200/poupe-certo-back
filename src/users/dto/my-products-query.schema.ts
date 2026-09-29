import { z } from 'zod';

export const PRODUCT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export const myProductsQuerySchema = z.object({
  status: z.enum(PRODUCT_STATUSES).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(50).optional().default(20),
});

export type MyProductsQuery = z.infer<typeof myProductsQuerySchema>;
