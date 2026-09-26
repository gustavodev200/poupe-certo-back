import { decidePriceReportStatus, median } from './outlier';

describe('price-reports/outlier', () => {
  describe('median', () => {
    it('calcula a mediana de uma lista ímpar', () => {
      expect(median([1, 5, 3])).toBe(3);
    });

    it('calcula a mediana de uma lista par (média dos dois centrais)', () => {
      expect(median([1, 2, 3, 4])).toBe(2.5);
    });
  });

  describe('decidePriceReportStatus', () => {
    it('aceita direto quando não há amostra suficiente (menos de 3)', () => {
      expect(decidePriceReportStatus(999, [10, 12])).toBe('ACTIVE');
      expect(decidePriceReportStatus(999, [])).toBe('ACTIVE');
    });

    it('aceita direto quando o preço está dentro do padrão', () => {
      const recentPrices = [25.9, 27.9, 26.9, 25.5];
      expect(decidePriceReportStatus(27.0, recentPrices)).toBe('ACTIVE');
    });

    it('marca para revisão quando o preço desvia mais de 50% da mediana', () => {
      const recentPrices = [25.9, 27.9, 26.9, 25.5];
      // mediana ~= 26.4; 99.9 desvia bem mais que 50%
      expect(decidePriceReportStatus(99.9, recentPrices)).toBe(
        'PENDING_REVIEW',
      );
    });

    it('não marca no limite exato do desvio (50% não é "maior que" 50%)', () => {
      const recentPrices = [10, 10, 10];
      // mediana = 10; +50% = 15 → deviation exatamente 0.5, não deve marcar
      expect(decidePriceReportStatus(15, recentPrices)).toBe('ACTIVE');
      // logo acima do limite deve marcar
      expect(decidePriceReportStatus(15.01, recentPrices)).toBe(
        'PENDING_REVIEW',
      );
    });
  });
});
