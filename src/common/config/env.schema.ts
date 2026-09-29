import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL é obrigatória'),
  SUPABASE_URL: z.string().min(1, 'SUPABASE_URL é obrigatória'),
  FRONTEND_URL: z.string().min(1, 'FRONTEND_URL é obrigatória'),
  PORT: z.coerce.number().int().positive().default(3333),
  // `z.coerce.boolean()` usaria `Boolean(...)` do JS — a STRING "false" vira
  // `true` (string não-vazia é sempre truthy). Env var sempre chega como
  // string; comparar o texto explicitamente evita esse footgun.
  SWAGGER_ENABLED: z
    .string()
    .optional()
    .default('true')
    .transform((value) => value.toLowerCase() !== 'false'),
  // Opcionais: sem as três, o upload de foto fica desligado e o produto é
  // cadastrado sem imagem (ver CloudinaryService).
  CLOUDINARY_CLOUD_NAME: z.string().trim().optional(),
  CLOUDINARY_API_KEY: z.string().trim().optional(),
  CLOUDINARY_API_SECRET: z.string().trim().optional(),
  OFF_USER_AGENT: z.string().trim().min(1).optional().default('PoupeCerto/0.1'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Env vars inválidas: ${issues}`);
  }
  return result.data;
}
