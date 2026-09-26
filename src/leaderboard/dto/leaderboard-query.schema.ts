import { z } from 'zod';

export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
