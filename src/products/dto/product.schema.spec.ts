import { createProductSchema } from './product.schema';

describe('createProductSchema', () => {
  const base = {
    ean: '12345678',
    name: 'Feijão Preto',
    brand: 'Camil',
    qty: '1kg',
    category: 'merc',
  };

  it('rejeita produto novo sem marketId', () => {
    const result = createProductSchema.safeParse({ ...base, price: 5.99 });
    expect(result.success).toBe(false);
  });

  it('rejeita produto novo sem price', () => {
    const result = createProductSchema.safeParse({
      ...base,
      marketId: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita price zero ou negativo', () => {
    const result = createProductSchema.safeParse({
      ...base,
      marketId: '123e4567-e89b-12d3-a456-426614174000',
      price: 0,
    });
    expect(result.success).toBe(false);
  });

  it('aceita produto novo com marketId e price válidos', () => {
    const result = createProductSchema.safeParse({
      ...base,
      marketId: '123e4567-e89b-12d3-a456-426614174000',
      price: 5.99,
    });
    expect(result.success).toBe(true);
  });
});
