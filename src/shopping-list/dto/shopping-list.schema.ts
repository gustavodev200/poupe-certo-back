import { z } from 'zod';
import { eanSchema } from '../../products/dto/product.schema';

export const addToListSchema = z.object({
  productEan: eanSchema,
});

export type AddToListInput = z.infer<typeof addToListSchema>;

export const toggleListItemSchema = z.object({
  purchased: z.boolean(),
});

export type ToggleListItemInput = z.infer<typeof toggleListItemSchema>;
