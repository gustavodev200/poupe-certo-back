import { createMarketSchema } from './market.schema';

describe('markets/createMarketSchema', () => {
  it('exige cidade e UF (senão o mercado some da lista filtrada)', () => {
    expect(createMarketSchema.safeParse({ name: 'ebasico' }).success).toBe(
      false,
    );
    expect(
      createMarketSchema.safeParse({ name: 'ebasico', city: 'Goianésia' })
        .success,
    ).toBe(false);
  });

  it('normaliza UF para maiúsculas', () => {
    const parsed = createMarketSchema.parse({
      name: ' ebasico ',
      city: 'Goianésia',
      uf: 'go',
    });
    expect(parsed).toEqual({ name: 'ebasico', city: 'Goianésia', uf: 'GO' });
  });
});
