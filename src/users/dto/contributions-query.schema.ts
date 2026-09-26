import { z } from 'zod';

export const contributionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type ContributionsQuery = z.infer<typeof contributionsQuerySchema>;
