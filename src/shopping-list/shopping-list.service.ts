import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { getBestActiveOffer } from '../products/products.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AddToListInput } from './dto/shopping-list.schema';

export interface ShoppingListItemResult {
  id: string;
  product: {
    ean: string;
    name: string;
    brand: string;
    qty: string;
    imageUrl: string | null;
  };
  market: { id: string; name: string };
  price: number;
  purchased: boolean;
  createdAt: string;
}

const ITEM_SELECT = {
  id: true,
  price: true,
  purchased: true,
  createdAt: true,
  product: {
    select: { ean: true, name: true, brand: true, qty: true, imageUrl: true },
  },
  market: { select: { id: true, name: true } },
} satisfies Prisma.ShoppingListItemSelect;

type ItemRow = Prisma.ShoppingListItemGetPayload<{
  select: typeof ITEM_SELECT;
}>;

function toResult(item: ItemRow): ShoppingListItemResult {
  return {
    id: item.id,
    product: item.product,
    market: item.market,
    price: Number(item.price),
    purchased: item.purchased,
    createdAt: item.createdAt.toISOString(),
  };
}

@Injectable()
export class ShoppingListService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ShoppingListItemResult[]> {
    return this.prisma.asUser(userId, async (tx) => {
      const items = await tx.shoppingListItem.findMany({
        where: { userId },
        orderBy: [{ purchased: 'asc' }, { createdAt: 'desc' }],
        select: ITEM_SELECT,
      });
      return items.map(toResult);
    });
  }

  async add(
    userId: string,
    dto: AddToListInput,
  ): Promise<{ item: ShoppingListItemResult; created: boolean }> {
    return this.prisma.asUser(userId, async (tx) => {
      const existing = await tx.shoppingListItem.findUnique({
        where: { userId_productEan: { userId, productEan: dto.productEan } },
        select: ITEM_SELECT,
      });
      // Idempotente por (userId, productEan): re-adicionar não duplica nem
      // atualiza o snapshot já salvo (ver research.md#2 da feature).
      if (existing) {
        return { item: toResult(existing), created: false };
      }

      const product = await tx.product.findFirst({
        where: { ean: dto.productEan, status: 'APPROVED' },
      });
      if (!product) {
        throw new NotFoundException('Produto não encontrado ou não aprovado');
      }

      const offer = await getBestActiveOffer(tx, dto.productEan);
      if (!offer) {
        throw new NotFoundException(
          'Produto sem oferta ativa para adicionar à lista',
        );
      }

      const item = await tx.shoppingListItem.create({
        data: {
          userId,
          productEan: dto.productEan,
          marketId: offer.marketId,
          price: offer.price,
        },
        select: ITEM_SELECT,
      });
      return { item: toResult(item), created: true };
    });
  }

  async setPurchased(
    userId: string,
    id: string,
    purchased: boolean,
  ): Promise<ShoppingListItemResult> {
    return this.prisma.asUser(userId, async (tx) => {
      try {
        const item = await tx.shoppingListItem.update({
          where: { id, userId },
          data: { purchased },
          select: ITEM_SELECT,
        });
        return toResult(item);
      } catch (error) {
        throw mapNotFound(error);
      }
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.asUser(userId, async (tx) => {
      try {
        await tx.shoppingListItem.delete({ where: { id, userId } });
      } catch (error) {
        throw mapNotFound(error);
      }
    });
  }
}

// Item de outra conta (ou id inexistente) nunca é encontrado pelo `where`
// composto acima — trata como 404 igual a um id que não existe, nunca
// vazando pra quem pediu se o id pertence a outra pessoa (Princípio III).
function mapNotFound(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    return new NotFoundException('Item não encontrado');
  }
  return error;
}
