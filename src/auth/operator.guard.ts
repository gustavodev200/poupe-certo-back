import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from './current-user.decorator';

// Roda depois de SupabaseJwtGuard (precisa de request.user já populado) —
// registrar sempre como `@UseGuards(SupabaseJwtGuard, OperatorGuard)`, nessa ordem.
@Injectable()
export class OperatorGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;
    if (!userId) {
      throw new ForbiddenException();
    }

    const profile = await this.prisma.asUser(userId, (tx) =>
      tx.profile.findUnique({
        where: { id: userId },
        select: { isOperator: true },
      }),
    );

    if (!profile?.isOperator) {
      throw new ForbiddenException();
    }

    return true;
  }
}
