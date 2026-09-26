import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NEW_PRODUCT_POINTS } from '../gamification/points';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { categoryCodeToEnum, categoryEnumToCode } from './categories';
import type {
  CreateProductInput,
  ProductDetailQuery,
  SearchProductsQuery,
} from './dto/product.schema';

function marketWhere(
  filter: Pick<SearchProductsQuery, 'city' | 'uf'>,
): Prisma.MarketWhereInput | undefined {
  const { city, uf } = filter;
  if (!city && !uf) return undefined;
  return {
    ...(city && { city: { equals: city, mode: 'insensitive' } }),
    ...(uf && { uf }),
  };
}

interface OfferRow {
  id: string;
  marketId: string;
  price: Prisma.Decimal;
  createdAt: Date;
  market: { id: string; name: string };
  _count: { confirmations: number };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function biweekPeriodLabel(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const half = date.getUTCDate() <= 15 ? 1 : 2;
  return `${year}-${month}-${half}`;
}

function computeHistory(reports: { price: Prisma.Decimal; createdAt: Date }[]) {
  const byPeriod = new Map<string, number>();
  for (const report of reports) {
    const label = biweekPeriodLabel(report.createdAt);
    const price = Number(report.price);
    const current = byPeriod.get(label);
    if (current === undefined || price < current) {
      byPeriod.set(label, price);
    }
  }
  return [...byPeriod.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([period, lowestPrice]) => ({ period, lowestPrice }));
}

function latestActivePerMarket<T extends { marketId: string }>(
  reports: T[],
): T[] {
  const latest = new Map<string, T>();
  // reports já vêm ordenados createdAt desc — o primeiro visto por mercado é o vigente.
  for (const report of reports) {
    if (!latest.has(report.marketId)) {
      latest.set(report.marketId, report);
    }
  }
  return [...latest.values()];
}

export interface BestActiveOffer {
  marketId: string;
  price: number;
}

// Reaproveitado pelo ShoppingListService (snapshot no POST /users/me/list) —
// mesma regra de "oferta vigente" usada em findDetail/search: reporte ACTIVE
// mais recente por mercado, menor preço entre eles (ver research.md#4 da
// feature 004-lista-compras).
export async function getBestActiveOffer(
  tx: Prisma.TransactionClient,
  ean: string,
): Promise<BestActiveOffer | null> {
  const activeReports = await tx.priceReport.findMany({
    where: { productEan: ean, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    select: { marketId: true, price: true },
  });
  const currentOffers = latestActivePerMarket(activeReports);
  const lowest = currentOffers.reduce<(typeof currentOffers)[number] | null>(
    (min, offer) =>
      !min || Number(offer.price) < Number(min.price) ? offer : min,
    null,
  );
  return lowest
    ? { marketId: lowest.marketId, price: Number(lowest.price) }
    : null;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchProductsQuery) {
    const { q, category, sort, page, pageSize, city, uf } = query;
    const market = marketWhere({ city, uf });

    return this.prisma.asPublic(async (tx) => {
      const where: Prisma.ProductWhereInput = {
        status: 'APPROVED',
        ...(category ? { category: categoryCodeToEnum(category) } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { brand: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
        // Preços são hiperlocais: um produto só aparece na busca de uma
        // cidade se tiver ao menos um preço ativo lá (ver spec da feature
        // de localização — evita vazar preço/mercado de outra cidade).
        ...(market && { priceReports: { some: { status: 'ACTIVE', market } } }),
      };

      const products = await tx.product.findMany({
        where,
        include: {
          priceReports: {
            where: { status: 'ACTIVE', ...(market && { market }) },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              marketId: true,
              price: true,
              createdAt: true,
              market: { select: { id: true, name: true } },
              _count: { select: { confirmations: true } },
            },
          },
        },
      });

      const withSummary = products.map((product) => {
        const currentOffers = latestActivePerMarket(product.priceReports);
        const lowest = currentOffers.reduce<OfferRow | null>(
          (min, offer) =>
            !min || Number(offer.price) < Number(min.price) ? offer : min,
          null,
        );
        const mostRecentAt = currentOffers.reduce<Date | null>(
          (max, offer) =>
            !max || offer.createdAt > max ? offer.createdAt : max,
          null,
        );

        let sortKey = 0;
        if (sort === 'preco') {
          sortKey = lowest ? Number(lowest.price) : Number.POSITIVE_INFINITY;
        } else if (mostRecentAt) {
          sortKey = -mostRecentAt.getTime();
        }

        return {
          ean: product.ean,
          name: product.name,
          brand: product.brand,
          qty: product.qty,
          category: categoryEnumToCode(product.category),
          lowestOffer: lowest
            ? {
                market: lowest.market,
                price: Number(lowest.price),
                reportedAt: lowest.createdAt.toISOString(),
                confirmations: lowest._count.confirmations,
              }
            : null,
          offerCount: currentOffers.length,
          sortKey,
        };
      });

      withSummary.sort((a, b) => a.sortKey - b.sortKey);

      const total = withSummary.length;
      const start = (page - 1) * pageSize;
      const items = withSummary.slice(start, start + pageSize).map((entry) => ({
        ean: entry.ean,
        name: entry.name,
        brand: entry.brand,
        qty: entry.qty,
        category: entry.category,
        lowestOffer: entry.lowestOffer,
        offerCount: entry.offerCount,
      }));

      return { items, page, pageSize, total };
    });
  }

  async findDetail(ean: string, filter: ProductDetailQuery = {}) {
    const market = marketWhere(filter);

    return this.prisma.asPublic(async (tx) => {
      const product = await tx.product.findFirst({
        where: { ean, status: 'APPROVED' },
      });
      if (!product) {
        throw new NotFoundException('Produto não encontrado');
      }

      const activeReports = await tx.priceReport.findMany({
        where: {
          productEan: ean,
          status: 'ACTIVE',
          ...(market && { market }),
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          marketId: true,
          price: true,
          createdAt: true,
          market: { select: { id: true, name: true } },
          _count: { select: { confirmations: true } },
        },
      });

      const currentOffers = latestActivePerMarket(activeReports).sort(
        (a, b) => Number(a.price) - Number(b.price),
      );

      const offers = currentOffers.map((offer) => ({
        priceReportId: offer.id,
        market: offer.market,
        price: Number(offer.price),
        reportedAt: offer.createdAt.toISOString(),
        confirmations: offer._count.confirmations,
      }));

      const prices = offers.map((offer) => offer.price);
      const stats = prices.length
        ? {
            lowest: Math.min(...prices),
            average: round2(
              prices.reduce((sum, price) => sum + price, 0) / prices.length,
            ),
            highest: Math.max(...prices),
          }
        : { lowest: null, average: null, highest: null };

      const history = computeHistory(activeReports);

      return {
        ean: product.ean,
        name: product.name,
        brand: product.brand,
        qty: product.qty,
        category: categoryEnumToCode(product.category),
        offers,
        stats,
        history,
      };
    });
  }

  async existsByEan(
    ean: string,
  ): Promise<{ exists: boolean; approved: boolean }> {
    return this.prisma.asPublic(async (tx) => {
      const product = await tx.product.findUnique({
        where: { ean },
        select: { status: true },
      });
      if (!product) {
        return { exists: false, approved: false };
      }
      return { exists: true, approved: product.status === 'APPROVED' };
    });
  }

  async create(
    userId: string,
    dto: CreateProductInput,
  ): Promise<{ ean: string; status: 'PENDING'; pointsAwarded: number }> {
    try {
      return await this.prisma.asUser(userId, async (tx) => {
        const market = await tx.market.findUnique({
          where: { id: dto.marketId },
        });
        if (!market) {
          throw new BadRequestException('Mercado não encontrado');
        }

        await tx.product.create({
          data: {
            ean: dto.ean,
            name: dto.name,
            brand: dto.brand,
            qty: dto.qty,
            category: categoryCodeToEnum(dto.category),
            imageUrl: dto.imageUrl,
            createdBy: userId,
          },
        });
        // Preço de produto recém-criado nasce PENDING_REVIEW mesmo sem ser
        // outlier — o produto ainda não é público, então não há como o preço
        // "passar direto": os dois só saem da fila quando o admin aprova o
        // produto (ver ModerationService.decideProduct).
        await tx.priceReport.create({
          data: {
            productEan: dto.ean,
            marketId: dto.marketId,
            price: dto.price,
            status: 'PENDING_REVIEW',
            reportedBy: userId,
          },
        });
        await tx.profile.update({
          where: { id: userId },
          data: { points: { increment: NEW_PRODUCT_POINTS } },
        });
        return {
          ean: dto.ean,
          status: 'PENDING' as const,
          pointsAwarded: NEW_PRODUCT_POINTS,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Produto já cadastrado');
      }
      throw error;
    }
  }
}
