// Detecção de preço fora do padrão — pura, sem I/O, testável isoladamente.
// Ver research.md#2: mediana das amostras ACTIVE mais recentes do produto;
// menos de 3 amostras não dá base pra julgar (aceita direto).

export const MIN_SAMPLES_FOR_OUTLIER_CHECK = 3;
export const OUTLIER_SAMPLE_SIZE = 20;
export const OUTLIER_DEVIATION_THRESHOLD = 0.5;

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function decidePriceReportStatus(
  newPrice: number,
  recentActivePrices: number[],
): 'ACTIVE' | 'PENDING_REVIEW' {
  if (recentActivePrices.length < MIN_SAMPLES_FOR_OUTLIER_CHECK) {
    return 'ACTIVE';
  }
  const baseline = median(recentActivePrices);
  const deviation = Math.abs(newPrice - baseline) / baseline;
  return deviation > OUTLIER_DEVIATION_THRESHOLD ? 'PENDING_REVIEW' : 'ACTIVE';
}
