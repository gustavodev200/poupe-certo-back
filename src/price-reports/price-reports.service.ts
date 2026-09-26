import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PRICE_REPORT_POINTS } from '../gamification/points';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePriceReportInput } from './dto/price-report.schema';
import { decidePriceReportStatus, OUTLIER_SAMPLE_SIZE } from './outlier';

export interface PriceReportResult {
  id: string;
  status: 'ACTIVE' | 'PENDING_REVIEW';
  pointsAwarded: number;
  message?: string;
}

@Injectable()
export class PriceReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    ean: string,
    userId: string,
    dto: CreatePriceReportInput,
  ): Promise<PriceReportResult> {
    return this.prisma.asUser(userId, async (tx) => {
      const product = await tx.product.findFirst({
        where: { ean, status: 'APPROVED' },
      });
      if (!product) {
        throw new NotFoundException('Produto não encontrado ou não aprovado');
      }

      const market = await tx.market.findUnique({
        where: { id: dto.marketId },
      });
      if (!market) {
        throw new BadRequestException('Mercado não encontrado');
      }

      const recent = await tx.priceReport.findMany({
        where: { productEan: ean, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: OUTLIER_SAMPLE_SIZE,
        select: { price: true },
      });
      const prices = recent.map((report) => Number(report.price));
      const status = decidePriceReportStatus(dto.price, prices);

      const created = await tx.priceReport.create({
        data: {
          productEan: ean,
          marketId: dto.marketId,
          price: dto.price,
          status,
          reportedBy: userId,
        },
      });

      if (status === 'ACTIVE') {
        await tx.profile.update({
          where: { id: userId },
          data: { points: { increment: PRICE_REPORT_POINTS } },
        });
      }

      return {
        id: created.id,
        status,
        pointsAwarded: status === 'ACTIVE' ? PRICE_REPORT_POINTS : 0,
        ...(status === 'PENDING_REVIEW'
          ? { message: 'Preço fora do padrão, enviado para revisão' }
          : {}),
      };
    });
  }

  async confirm(
    priceReportId: string,
    userId: string,
  ): Promise<{ priceReportId: string; confirmations: number }> {
    return this.prisma.asUser(userId, async (tx) => {
      const report = await tx.priceReport.findFirst({
        where: { id: priceReportId, status: 'ACTIVE' },
      });
      if (!report) {
        throw new NotFoundException('Preço não encontrado');
      }

      await tx.priceConfirmation.upsert({
        where: {
          priceReportId_confirmedBy: { priceReportId, confirmedBy: userId },
        },
        create: { priceReportId, confirmedBy: userId },
        update: {},
      });

      const confirmations = await tx.priceConfirmation.count({
        where: { priceReportId },
      });
      return { priceReportId, confirmations };
    });
  }
}
