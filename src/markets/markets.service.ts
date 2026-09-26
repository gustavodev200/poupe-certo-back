import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMarketInput } from './dto/market.schema';

export interface MarketResponse {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  uf: string | null;
}

@Injectable()
export class MarketsService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<MarketResponse[]> {
    return this.prisma.asPublic((tx) =>
      tx.market.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, address: true, city: true, uf: true },
      }),
    );
  }

  async createOrReuse(
    userId: string,
    dto: CreateMarketInput,
  ): Promise<{ market: MarketResponse; created: boolean }> {
    return this.prisma.asUser(userId, async (tx) => {
      const existing = await tx.market.findFirst({
        where: { name: { equals: dto.name, mode: 'insensitive' } },
        select: { id: true, name: true, address: true, city: true, uf: true },
      });
      if (existing) {
        return { market: existing, created: false };
      }

      try {
        const created = await tx.market.create({
          data: dto,
          select: { id: true, name: true, address: true, city: true, uf: true },
        });
        return { market: created, created: true };
      } catch {
        const raceWinner = await tx.market.findFirst({
          where: { name: { equals: dto.name, mode: 'insensitive' } },
          select: { id: true, name: true, address: true, city: true, uf: true },
        });
        if (raceWinner) {
          return { market: raceWinner, created: false };
        }
        throw new ConflictException('Não foi possível criar o mercado');
      }
    });
  }
}
