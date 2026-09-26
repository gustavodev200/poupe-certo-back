import { Throttle } from '@nestjs/throttler';

// Limite dedicado para escrita sensível a abuso/spam (reportar preço,
// confirmar preço, cadastrar produto/mercado) — mais restritivo que o
// ThrottlerGuard global (60/min), per FR-023.
export const WriteThrottle = (): MethodDecorator & ClassDecorator =>
  Throttle({ default: { limit: 10, ttl: 60_000 } });
