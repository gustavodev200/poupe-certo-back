import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMarketInput, MarketsQuery } from './dto/market.schema';

export interface MarketResponse {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  uf: string | null;
}

// Mesmo mercado = mesmo nome na mesma cidade/UF (espelha o índice único
// markets_name_city_uf_lower_key).
function sameMarket(dto: CreateMarketInput) {
  return {
    name: { equals: dto.name, mode: 'insensitive' as const },
    city: { equals: dto.city, mode: 'insensitive' as const },
    uf: dto.uf,
  };
}

@Injectable()
export class MarketsService {
  constructor(private readonly prisma: PrismaService) {}

  list(filter: MarketsQuery = {}): Promise<MarketResponse[]> {
    const { city, uf } = filter;
    return this.prisma.asPublic((tx) =>
      tx.market.findMany({
        where: {
          ...(city && { city: { equals: city, mode: 'insensitive' } }),
          ...(uf && { uf }),
        },
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
        where: sameMarket(dto),
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
          where: sameMarket(dto),
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
