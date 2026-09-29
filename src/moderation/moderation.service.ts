import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { categoryEnumToCode } from '../products/categories';
import {
  NEW_PRODUCT_POINTS,
  PRICE_REPORT_POINTS,
} from '../gamification/points';
import { PrismaService } from '../prisma/prisma.service';

type Decision = 'approve' | 'reject';

// Teto de segurança na fila de moderação — nunca devolve volume ilimitado,
// mesmo que uma tentativa de spam encha a fila de itens pendentes.
const MODERATION_QUEUE_PAGE_SIZE = 200;

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async listQueue(operatorId: string) {
    return this.prisma.asUser(operatorId, async (tx) => {
      const [products, priceReports] = await Promise.all([
        // Produto novo só chega aqui já com o preço junto (ver
        // ProductsService.create) — inclui o PriceReport PENDING_REVIEW pra
        // o admin decidir os dois de uma vez.
        tx.product.findMany({
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'asc' },
          take: MODERATION_QUEUE_PAGE_SIZE,
          include: {
            priceReports: {
              where: { status: 'PENDING_REVIEW' },
              orderBy: { createdAt: 'asc' },
              take: 1,
              include: { market: { select: { id: true, name: true } } },
            },
          },
        }),
        // Exclui preços de produto ainda pendente — esses já aparecem
        // acima, junto do produto; aqui só sobra preço fora do padrão em
        // produto que já é público.
        tx.priceReport.findMany({
          where: {
            status: 'PENDING_REVIEW',
            product: { status: 'APPROVED' },
          },
          orderBy: { createdAt: 'asc' },
          take: MODERATION_QUEUE_PAGE_SIZE,
          include: {
            product: { select: { ean: true, name: true } },
            market: { select: { id: true, name: true } },
          },
        }),
      ]);

      return {
        products: products.map((product) => {
          const priceReport = product.priceReports[0] ?? null;
          return {
            ean: product.ean,
            name: product.name,
            brand: product.brand,
            qty: product.qty,
            category: categoryEnumToCode(product.category),
            imageUrl: product.imageUrl,
            createdBy: product.createdBy,
            createdAt: product.createdAt.toISOString(),
            priceReport: priceReport && {
              id: priceReport.id,
              market: priceReport.market,
              price: Number(priceReport.price),
            },
          };
        }),
        priceReports: priceReports.map((report) => ({
          id: report.id,
          product: report.product,
          market: report.market,
          price: Number(report.price),
          reportedBy: report.reportedBy,
          createdAt: report.createdAt.toISOString(),
        })),
      };
    });
  }

  async decideProduct(ean: string, decision: Decision, operatorId: string) {
    return this.prisma.asUser(operatorId, async (tx) => {
      const product = await tx.product.findUnique({ where: { ean } });
      if (!product) {
        throw new NotFoundException('Produto não encontrado');
      }
      if (product.status !== 'PENDING') {
        throw new ConflictException('Produto já foi decidido');
      }

      // Produto novo sempre nasce com um PriceReport PENDING_REVIEW junto
      // (ver ProductsService.create) — a decisão do admin sobre o produto
      // decide os dois de uma vez, sem passo extra na fila de preços.
      const pendingPriceReport = await tx.priceReport.findFirst({
        where: { productEan: ean, status: 'PENDING_REVIEW' },
      });

      if (decision === 'approve') {
        await tx.product.update({
          where: { ean },
          data: {
            status: 'APPROVED',
            reviewedBy: operatorId,
            reviewedAt: new Date(),
          },
        });

        if (pendingPriceReport) {
          await tx.priceReport.update({
            where: { id: pendingPriceReport.id },
            data: {
              status: 'ACTIVE',
              reviewedBy: operatorId,
              reviewedAt: new Date(),
            },
          });
          await tx.profile.update({
            where: { id: pendingPriceReport.reportedBy },
            data: { points: { increment: PRICE_REPORT_POINTS } },
          });
        }

        return { ean, status: 'APPROVED' as const };
      }

      await tx.product.update({
        where: { ean },
        data: {
          status: 'REJECTED',
          reviewedBy: operatorId,
          reviewedAt: new Date(),
        },
      });

      if (pendingPriceReport) {
        await tx.priceReport.update({
          where: { id: pendingPriceReport.id },
          data: {
            status: 'REJECTED',
            reviewedBy: operatorId,
            reviewedAt: new Date(),
          },
        });
      }

      // Estorno satura em 0 — nunca deixa o total de pontos ficar negativo (FR-017).
      const author = await tx.profile.findUnique({
        where: { id: product.createdBy },
        select: { points: true },
      });
      const pointsReverted = Math.min(NEW_PRODUCT_POINTS, author?.points ?? 0);
      await tx.profile.update({
        where: { id: product.createdBy },
        data: { points: { decrement: pointsReverted } },
      });

      return { ean, status: 'REJECTED' as const, pointsReverted };
    });
  }

  async decidePriceReport(id: string, decision: Decision, operatorId: string) {
    return this.prisma.asUser(operatorId, async (tx) => {
      const report = await tx.priceReport.findUnique({ where: { id } });
      if (!report) {
        throw new NotFoundException('Preço não encontrado');
      }
      if (report.status !== 'PENDING_REVIEW') {
        throw new ConflictException('Preço já foi decidido');
      }

      if (decision === 'reject') {
        await tx.priceReport.update({
          where: { id },
          data: {
            status: 'REJECTED',
            reviewedBy: operatorId,
            reviewedAt: new Date(),
          },
        });
        return { id, status: 'REJECTED' as const };
      }

      await tx.priceReport.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          reviewedBy: operatorId,
          reviewedAt: new Date(),
        },
      });
      // Reporte aprovado depois de revisão passa a contar pontos, do mesmo jeito
      // que um reporte aceito direto — sem essa concessão, o autor seria
      // penalizado só por ter tido um preço legítimo fora do padrão histórico.
      await tx.profile.update({
        where: { id: report.reportedBy },
        data: { points: { increment: PRICE_REPORT_POINTS } },
      });
      return { id, status: 'ACTIVE' as const };
    });
  }
}
