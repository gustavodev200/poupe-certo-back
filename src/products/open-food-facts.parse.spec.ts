import {
  mapCategory,
  NOT_FOUND,
  parseOffResponse,
} from './open-food-facts.parse';

describe('products/open-food-facts.parse', () => {
  it('extrai nome, primeira marca, quantidade, categoria e foto', () => {
    const result = parseOffResponse({
      status: 1,
      product: {
        product_name: 'Leite Condensado Integral moça',
        brands: 'Nestlé, Moça',
        quantity: '395 g',
        image_front_url:
          'https://images.openfoodfacts.org/images/products/789/100/010/0103/front_pt.34.400.jpg',
        categories_tags: ['en:dairies', 'en:condensed-milks'],
      },
    });
    expect(result).toEqual({
      found: true,
      name: 'Leite Condensado Integral moça',
      brand: 'Nestlé',
      qty: '395 g',
      category: 'fri',
      imageUrl:
        'https://images.openfoodfacts.org/images/products/789/100/010/0103/front_pt.34.400.jpg',
    });
  });

  it('prefere o nome em português', () => {
    const result = parseOffResponse({
      status: 1,
      product: { product_name: 'Rice', product_name_pt: 'Arroz' },
    });
    expect(result.name).toBe('Arroz');
  });

  it('status 0 ou formato inesperado vira não encontrado', () => {
    expect(parseOffResponse({ status: 0 })).toEqual(NOT_FOUND);
    expect(parseOffResponse('lixo')).toEqual(NOT_FOUND);
    expect(parseOffResponse({ status: 1, product: { brands: 42 } })).toEqual(
      NOT_FOUND,
    );
    expect(parseOffResponse({ status: 1, product: {} })).toEqual(NOT_FOUND);
  });

  it('descarta foto fora do domínio do OFF ou sem https', () => {
    const base = { status: 1, product: { product_name: 'X' } };
    for (const url of [
      'https://evil.example.com/a.jpg',
      'http://images.openfoodfacts.org/a.jpg',
      'https://images.openfoodfacts.org.evil.com/a.jpg',
      'file:///etc/passwd',
      'não é url',
    ]) {
      const result = parseOffResponse({
        ...base,
        product: { ...base.product, image_front_url: url },
      });
      expect(result.imageUrl).toBeNull();
    }
  });

  it('corta textos gigantes no limite do cadastro', () => {
    const result = parseOffResponse({
      status: 1,
      product: { product_name: 'a'.repeat(5000), quantity: '1'.repeat(100) },
    });
    expect(result.name).toHaveLength(200);
    expect(result.qty).toHaveLength(40);
  });

  it('mapCategory devolve null sem correspondência', () => {
    expect(mapCategory(['en:plant-based-foods'])).toBeNull();
    expect(mapCategory(undefined)).toBeNull();
    expect(mapCategory(['en:beverages'])).toBe('beb');
  });
});
