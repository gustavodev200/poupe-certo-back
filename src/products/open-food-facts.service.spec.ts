import { ConfigService } from '@nestjs/config';
import { OpenFoodFactsService } from './open-food-facts.service';

const EAN = '7891000100103';

function offBody() {
  return {
    status: 1,
    product: { product_name: 'Leite Condensado', brands: 'Nestlé' },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('OpenFoodFactsService', () => {
  let service: OpenFoodFactsService;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    service = new OpenFoodFactsService({
      getOrThrow: () => 'PoupeCerto/test',
    } as unknown as ConfigService);
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
    jest.useRealTimers();
  });

  it('envia User-Agent e devolve os dados parseados', async () => {
    fetchMock.mockResolvedValue(jsonResponse(offBody()));
    const result = await service.lookup(EAN);
    expect(result.found).toBe(true);
    expect(result.name).toBe('Leite Condensado');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/api/v2/product/${EAN}.json`);
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(
      'PoupeCerto/test',
    );
  });

  it('20 chamadas simultâneas ao mesmo EAN geram 1 requisição externa', async () => {
    fetchMock.mockResolvedValue(jsonResponse(offBody()));
    const results = await Promise.all(
      Array.from({ length: 20 }, () => service.lookup(EAN)),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.found)).toBe(true);
  });

  it('reaproveita o cache em chamadas sequenciais (encontrado e não encontrado)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(offBody()))
      .mockResolvedValueOnce(jsonResponse({ status: 0 }, 404));
    await service.lookup(EAN);
    await service.lookup(EAN);
    await service.lookup('7899999999999');
    const miss = await service.lookup('7899999999999');
    expect(miss.found).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falha de rede vira não encontrado e expira em pouco tempo', async () => {
    jest.useFakeTimers({ now: 0 });
    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    const first = await service.lookup(EAN);
    expect(first.found).toBe(false);

    await service.lookup(EAN);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    jest.setSystemTime(61_000);
    fetchMock.mockResolvedValueOnce(jsonResponse(offBody()));
    const retried = await service.lookup(EAN);
    expect(retried.found).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('HTTP 5xx do OFF não quebra — vira não encontrado', async () => {
    fetchMock.mockResolvedValue(new Response('erro', { status: 503 }));
    await expect(service.lookup(EAN)).resolves.toMatchObject({ found: false });
  });
});
