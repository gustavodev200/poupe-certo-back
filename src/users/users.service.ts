import { Injectable, NotFoundException } from '@nestjs/common';
import {
  levelForPoints,
  pointsToNextLevel,
  progressPercent,
} from '../gamification/points';
import { PrismaService } from '../prisma/prisma.service';
import type { ContributionsQuery } from './dto/contributions-query.schema';
import type { UpdateLocationInput } from './dto/location.schema';

export interface ProfileResponse {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  city: string | null;
  uf: string | null;
  createdAt: Date;
}

export interface ProfileStats {
  pricesReported: number;
  productsCreated: number;
  confirmationsGiven: number;
  confidencePercent: number;
  points: number;
  level: number;
  pointsToNextLevel: number;
  progressPercent: number;
  rankPosition: number;
}

export interface ContributionItem {
  type: 'price_report' | 'product_created';
  product: { ean: string; name: string };
  market?: { id: string; name: string } | null;
  price?: number;
  createdAt: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: string): Promise<ProfileResponse> {
    const profile = await this.prisma.asUser(userId, (tx) =>
      tx.profile.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          city: true,
          uf: true,
          createdAt: true,
        },
      }),
    );
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return profile;
  }

  async setLocation(
    userId: string,
    { city, uf }: UpdateLocationInput,
  ): Promise<{ city: string; uf: string }> {
    await this.prisma.asUser(userId, (tx) =>
      tx.profile.update({
        where: { id: userId },
        data: { city, uf },
        select: { id: true },
      }),
    );
    return { city, uf };
  }

  async getStats(userId: string): Promise<ProfileStats> {
    const counts = await this.prisma.asUser(userId, async (tx) => {
      const profile = await tx.profile.findUnique({
        where: { id: userId },
        select: { points: true },
      });
      if (!profile) {
        throw new NotFoundException('Profile not found');
      }

      const [
        pricesReported,
        productsCreated,
        confirmationsGiven,
        totalReports,
      ] = await Promise.all([
        tx.priceReport.count({
          where: { reportedBy: userId, status: 'ACTIVE' },
        }),
        tx.product.count({ where: { createdBy: userId, status: 'APPROVED' } }),
        tx.priceConfirmation.count({ where: { confirmedBy: userId } }),
        tx.priceReport.count({ where: { reportedBy: userId } }),
      ]);

      return {
        points: profile.points,
        pricesReported,
        productsCreated,
        confirmationsGiven,
        totalReports,
      };
    });

    // Comparar pontos com o resto da base exige enxergar outras linhas de
    // `profiles`, que a RLS de `authenticated` restringe à própria (own-row) —
    // por isso o ranking é lido pela role pública (`anon`), que tem a policy
    // dedicada de leaderboard (só id/nome/avatar/pontos, ver migration).
    const higherRanked = await this.prisma.asPublic((tx) =>
      tx.profile.count({ where: { points: { gt: counts.points } } }),
    );

    const confidencePercent =
      counts.totalReports === 0
        ? 100
        : Math.round((counts.pricesReported / counts.totalReports) * 100);

    return {
      pricesReported: counts.pricesReported,
      productsCreated: counts.productsCreated,
      confirmationsGiven: counts.confirmationsGiven,
      confidencePercent,
      points: counts.points,
      level: levelForPoints(counts.points),
      pointsToNextLevel: pointsToNextLevel(counts.points),
      progressPercent: progressPercent(counts.points),
      rankPosition: higherRanked + 1,
    };
  }

  async getContributions(userId: string, query: ContributionsQuery) {
    const { page, pageSize } = query;

    return this.prisma.asUser(userId, async (tx) => {
      const [reports, products] = await Promise.all([
        tx.priceReport.findMany({
          where: { reportedBy: userId },
          orderBy: { createdAt: 'desc' },
          take: 200,
          select: {
            price: true,
            createdAt: true,
            product: { select: { ean: true, name: true } },
            market: { select: { id: true, name: true } },
          },
        }),
        tx.product.findMany({
          where: { createdBy: userId },
          orderBy: { createdAt: 'desc' },
          take: 200,
          select: { ean: true, name: true, createdAt: true },
        }),
      ]);

      const items: ContributionItem[] = [
        ...reports.map((report) => ({
          type: 'price_report' as const,
          product: report.product,
          market: report.market,
          price: Number(report.price),
          createdAt: report.createdAt.toISOString(),
        })),
        ...products.map((product) => ({
          type: 'product_created' as const,
          product: { ean: product.ean, name: product.name },
          createdAt: product.createdAt.toISOString(),
        })),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const total = items.length;
      const start = (page - 1) * pageSize;
      return {
        items: items.slice(start, start + pageSize),
        page,
        pageSize,
        total,
      };
    });
  }
}
