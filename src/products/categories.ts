import { ProductCategory } from '../generated/prisma/enums';

// Contrato HTTP usa os códigos curtos já presentes no mock do frontend
// (src/lib/mock/catalog.ts do poupe-certo-front) — mapeados aqui para o enum
// do Postgres/Prisma. Ver research.md#8.
export const CATEGORY_CODES = [
  'merc',
  'beb',
  'lim',
  'hig',
  'fri',
  'pad',
] as const;

export type CategoryCode = (typeof CATEGORY_CODES)[number];

const CODE_TO_ENUM: Record<CategoryCode, ProductCategory> = {
  merc: ProductCategory.MERCEARIA,
  beb: ProductCategory.BEBIDAS,
  lim: ProductCategory.LIMPEZA,
  hig: ProductCategory.HIGIENE,
  fri: ProductCategory.FRIOS,
  pad: ProductCategory.PADARIA,
};

const ENUM_TO_CODE: Record<ProductCategory, CategoryCode> = {
  MERCEARIA: 'merc',
  BEBIDAS: 'beb',
  LIMPEZA: 'lim',
  HIGIENE: 'hig',
  FRIOS: 'fri',
  PADARIA: 'pad',
};

export function categoryCodeToEnum(code: CategoryCode): ProductCategory {
  return CODE_TO_ENUM[code];
}

export function categoryEnumToCode(value: ProductCategory): CategoryCode {
  return ENUM_TO_CODE[value];
}

export function isCategoryCode(value: string): value is CategoryCode {
  return (CATEGORY_CODES as readonly string[]).includes(value);
}
