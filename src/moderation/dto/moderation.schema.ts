import { z } from 'zod';

export const moderationDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
});

export type ModerationDecisionInput = z.infer<typeof moderationDecisionSchema>;
