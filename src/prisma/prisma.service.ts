import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client';

// Reaproveita o client entre invocações "quentes" da função serverless — sem isso
// cada cold start abre conexão nova e esgota o pooler do Supabase.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly client: PrismaClient;

  constructor(config: ConfigService) {
    this.client =
      globalForPrisma.prisma ??
      new PrismaClient({
        adapter: new PrismaPg({
          connectionString: config.getOrThrow<string>('DATABASE_URL'),
        }),
      });
    globalForPrisma.prisma = this.client;
  }

  // Única porta de acesso a dado: a role de runtime (NOINHERIT) só enxerga tabelas
  // depois de assumir `authenticated` com as claims do usuário — RLS aplica igual PostgREST.
  asUser<T>(
    userId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const claims = JSON.stringify({ sub: userId, role: 'authenticated' });
    return this.client.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE authenticated`;
      await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${claims}, true)`;
      return fn(tx);
    });
  }

  // Leitura pública (sem sessão): assume a role `anon` do Supabase, mesma role
  // que PostgREST/GoTrue usam — RLS decide o que fica visível sem login.
  asPublic<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.client.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE anon`;
      return fn(tx);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
