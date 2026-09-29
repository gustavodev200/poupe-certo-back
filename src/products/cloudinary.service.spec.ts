import { ConfigService } from '@nestjs/config';
import { CloudinaryService, signParams } from './cloudinary.service';

function configWith(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

const FULL_CONFIG = {
  CLOUDINARY_CLOUD_NAME: 'demo',
  CLOUDINARY_API_KEY: 'key123',
  CLOUDINARY_API_SECRET: 'abcd',
};

const REMOTE = 'https://images.openfoodfacts.org/images/products/x.jpg';

describe('CloudinaryService', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => fetchMock.mockRestore());

  it('signParams bate com o exemplo da documentação oficial', () => {
    expect(signParams({ timestamp: '1315060510' }, 'abcd')).toBe(
      'a21ad0f63beb4de2e5575204b79ab90bffb02c10',
    );
  });

  it('signParams ordena as chaves', () => {
    expect(signParams({ b: '2', a: '1' }, 's')).toBe(
      signParams({ a: '1', b: '2' }, 's'),
    );
  });

  it('desligado sem credenciais — não chama a rede', async () => {
    const service = new CloudinaryService(configWith({}));
    expect(service.isEnabled()).toBe(false);
    await expect(service.uploadProductImage('123', REMOTE)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envia upload assinado com public_id por EAN e overwrite=false', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          secure_url:
            'https://res.cloudinary.com/demo/image/upload/v1/poupe-certo/products/789.jpg',
        }),
        { status: 200 },
      ),
    );
    const service = new CloudinaryService(configWith(FULL_CONFIG));
    const url = await service.uploadProductImage('789', REMOTE);

    expect(url).toBe(
      'https://res.cloudinary.com/demo/image/upload/v1/poupe-certo/products/789.jpg',
    );
    const [endpoint, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe('https://api.cloudinary.com/v1_1/demo/image/upload');
    const body = init.body as URLSearchParams;
    expect(body.get('public_id')).toBe('poupe-certo/products/789');
    expect(body.get('overwrite')).toBe('false');
    expect(body.get('file')).toBe(REMOTE);
    expect(body.get('api_key')).toBe('key123');
    expect(body.has('api_secret')).toBe(false);
    expect(body.get('signature')).toBe(
      signParams(
        {
          overwrite: 'false',
          public_id: 'poupe-certo/products/789',
          timestamp: body.get('timestamp')!,
        },
        'abcd',
      ),
    );
  });

  it('erro HTTP ou de rede vira null', async () => {
    const service = new CloudinaryService(configWith(FULL_CONFIG));
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    await expect(service.uploadProductImage('1', REMOTE)).resolves.toBeNull();
    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    await expect(service.uploadProductImage('1', REMOTE)).resolves.toBeNull();
  });
});
