import { Injectable } from '@nestjs/common';
import { levelForPoints } from '../gamification/points';
import { PrismaService } from '../prisma/prisma.service';
import type { LeaderboardEntryDto } from './dto/leaderboard-entry.dto';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getTop(limit: number): Promise<LeaderboardEntryDto[]> {
    return this.prisma.asPublic(async (tx) => {
      const profiles = await tx.profile.findMany({
        orderBy: { points: 'desc' },
        take: limit,
        select: { id: true, displayName: true, avatarUrl: true, points: true },
      });
      if (profiles.length === 0) {
        return [];
      }

      // Uma única consulta agregada para todo o grupo — evita 1 count() por
      // perfil (N+1) quando `limit` cresce.
      const counts = await tx.priceReport.groupBy({
        by: ['reportedBy'],
        where: {
          reportedBy: { in: profiles.map((profile) => profile.id) },
          status: 'ACTIVE',
        },
        _count: { _all: true },
      });
      const countByProfile = new Map(
        counts.map((count) => [count.reportedBy, count._count._all]),
      );

      return profiles.map((profile) => ({
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        level: levelForPoints(profile.points),
        points: profile.points,
        pricesReported: countByProfile.get(profile.id) ?? 0,
      }));
    });
  }
}
