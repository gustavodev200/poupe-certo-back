import {
  CATEGORY_CODES,
  categoryCodeToEnum,
  categoryEnumToCode,
  isCategoryCode,
} from './categories';

describe('products/categories', () => {
  it('faz round-trip código → enum → código sem perda para todas as categorias', () => {
    for (const code of CATEGORY_CODES) {
      expect(categoryEnumToCode(categoryCodeToEnum(code))).toBe(code);
    }
  });

  it('isCategoryCode aceita só os códigos conhecidos', () => {
    expect(isCategoryCode('merc')).toBe(true);
    expect(isCategoryCode('inexistente')).toBe(false);
  });
});
