import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePriceReportInput } from './dto/price-report.schema';

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

      // Todo preço passa pela moderação antes de ficar público — os pontos
      // só entram quando o admin aprova (ModerationService.decidePriceReport).
      const created = await tx.priceReport.create({
        data: {
          productEan: ean,
          marketId: dto.marketId,
          price: dto.price,
          status: 'PENDING_REVIEW',
          reportedBy: userId,
        },
      });

      return {
        id: created.id,
        status: 'PENDING_REVIEW',
        pointsAwarded: 0,
        message: 'Preço enviado para aprovação',
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
