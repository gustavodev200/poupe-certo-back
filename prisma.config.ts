import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// CLI (migrate/introspect) usa conexão de sessão; runtime usa DATABASE_URL (pooler) via adapter.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
});
