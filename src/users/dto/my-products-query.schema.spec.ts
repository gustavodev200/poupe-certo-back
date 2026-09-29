import { myProductsQuerySchema } from './my-products-query.schema';

describe('myProductsQuerySchema', () => {
  it('aplica defaults sem status', () => {
    expect(myProductsQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('aceita status válido e converte strings numéricas', () => {
    expect(
      myProductsQuerySchema.parse({
        status: 'PENDING',
        page: '2',
        pageSize: '5',
      }),
    ).toEqual({ status: 'PENDING', page: 2, pageSize: 5 });
  });

  it('rejeita status desconhecido', () => {
    expect(myProductsQuerySchema.safeParse({ status: 'pending' }).success).toBe(
      false,
    );
  });

  it('rejeita pageSize acima de 50', () => {
    expect(myProductsQuerySchema.safeParse({ pageSize: 51 }).success).toBe(
      false,
    );
  });
});
