// Regras puras de pontuação/nível — sem I/O, testáveis isoladamente.
// Ver research.md#3: valores vêm dos textos já existentes na UI ("+2 pontos",
// "+5 pontos"); a progressão de nível é deliberadamente linear.

export const PRICE_REPORT_POINTS = 2;
export const NEW_PRODUCT_POINTS = 5;
export const CONFIRMATION_POINTS = 0;

const POINTS_PER_LEVEL = 100;

export function levelForPoints(points: number): number {
  return Math.floor(Math.max(points, 0) / POINTS_PER_LEVEL) + 1;
}

// Pontos QUE FALTAM pro próximo nível (FR-019: "pontos restantes para o
// próximo nível") — não o patamar absoluto.
export function pointsToNextLevel(points: number): number {
  const threshold = levelForPoints(points) * POINTS_PER_LEVEL;
  return threshold - Math.max(points, 0);
}

export function progressPercent(points: number): number {
  return Math.round(
    ((Math.max(points, 0) % POINTS_PER_LEVEL) / POINTS_PER_LEVEL) * 100,
  );
}
