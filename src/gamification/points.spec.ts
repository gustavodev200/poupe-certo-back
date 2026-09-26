import { levelForPoints, pointsToNextLevel, progressPercent } from './points';

describe('gamification/points', () => {
  describe('levelForPoints', () => {
    it('começa no nível 1 com zero pontos', () => {
      expect(levelForPoints(0)).toBe(1);
    });

    it('permanece no nível 1 até faltar 1 ponto pro próximo patamar', () => {
      expect(levelForPoints(99)).toBe(1);
    });

    it('sobe de nível exatamente no ponto de corte', () => {
      expect(levelForPoints(100)).toBe(2);
      expect(levelForPoints(250)).toBe(3);
    });

    it('nunca fica negativo mesmo com pontos negativos (defesa contra bug de estorno)', () => {
      expect(levelForPoints(-50)).toBe(1);
    });
  });

  describe('pointsToNextLevel', () => {
    it('reflete quantos pontos faltam pro próximo nível (não o patamar absoluto)', () => {
      expect(pointsToNextLevel(0)).toBe(100);
      expect(pointsToNextLevel(132)).toBe(68);
      expect(pointsToNextLevel(199)).toBe(1);
    });

    it('vira o patamar cheio exatamente ao subir de nível', () => {
      expect(pointsToNextLevel(100)).toBe(100);
    });
  });

  describe('progressPercent', () => {
    it('calcula o progresso dentro do nível atual', () => {
      expect(progressPercent(0)).toBe(0);
      expect(progressPercent(132)).toBe(32);
      expect(progressPercent(199)).toBe(99);
    });

    it('nunca fica negativo com pontos negativos', () => {
      expect(progressPercent(-10)).toBe(0);
    });
  });
});
