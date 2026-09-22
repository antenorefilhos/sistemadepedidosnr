import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import { join } from 'path';
import sharp from 'sharp';

// uuid e ESM-only; o resto da suite ja mocka assim (ver uploads.controller.spec.ts).
let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => `mock-uuid-${++uuidCounter}`),
}));

import { UploadsController } from './uploads.controller';
import { CloudflareCacheService } from '../../common/cloudflare-cache.service';

/**
 * JON-137 (Auditoria 360, High): o filtro generico confiava em file.mimetype
 * (do cliente) e mantinha a extensao de originalname (tambem do cliente) --
 * um arquivo HTML com Content-Type: image/png forjado virava um .html
 * publico servido na mesma origem do app (stored XSS). A correcao decodifica
 * o arquivo de verdade com sharp; extensao/Content-Type final vem do que o
 * arquivo REALMENTE e, nunca do cabecalho declarado.
 */
describe('UploadsController.uploadFile — spoof de MIME (JON-137)', () => {
  let controller: UploadsController;
  const uploadsDir = join(process.cwd(), 'uploads');
  const writtenPaths: string[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [{ provide: CloudflareCacheService, useValue: { purgeUrls: jest.fn() } }],
    }).compile();
    controller = module.get<UploadsController>(UploadsController);
    fs.mkdirSync(uploadsDir, { recursive: true });
  });

  afterEach(() => {
    // sharp/libvips no Windows pode segurar o handle por mais um tick depois
    // do toFile() resolver -- so limpeza de teste, ignora se ainda estiver
    // ocupado.
    for (const p of writtenPaths.splice(0)) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        // best-effort
      }
    }
  });

  const fakeMulterFile = (tempPath: string, originalname: string, mimetype: string, size?: number): Express.Multer.File =>
    ({ path: tempPath, originalname, mimetype, size: size ?? fs.statSync(tempPath).size } as Express.Multer.File);

  it('rejeita HTML disfarçado de image/png sem publicar nada', async () => {
    const tempPath = join(uploadsDir, 'spoof-test.tmp');
    fs.writeFileSync(tempPath, '<html><body><script>alert(document.cookie)</script></body></html>');
    writtenPaths.push(tempPath);

    await expect(
      controller.uploadFile(fakeMulterFile(tempPath, 'evil.html', 'image/png')),
    ).rejects.toThrow(BadRequestException);

    // o temp some (limpo no finally) e nenhum .webp foi criado a partir dele
    expect(fs.existsSync(tempPath)).toBe(false);
    const leftover = fs.readdirSync(uploadsDir).filter((f) => f.startsWith('spoof-test'));
    expect(leftover).toEqual([]);
  });

  it('reencoda imagem real pra .webp, ignorando a extensao original', async () => {
    const tempPath = join(uploadsDir, 'real-image-test.tmp');
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 255, g: 0, b: 0 } } })
      .png()
      .toBuffer();
    fs.writeFileSync(tempPath, png);
    writtenPaths.push(tempPath);

    const result = await controller.uploadFile(fakeMulterFile(tempPath, 'foto.png', 'image/png'));

    expect(result.url).toBe(`/uploads/${result.filename}`);
    expect(result.filename.endsWith('.webp')).toBe(true);
    const finalPath = join(uploadsDir, result.filename);
    writtenPaths.push(finalPath);
    expect(fs.existsSync(finalPath)).toBe(true);
    expect(fs.existsSync(tempPath)).toBe(false);

    const meta = await sharp(finalPath).metadata();
    expect(meta.format).toBe('webp');
  });
});

/**
 * JON-113 (Auditoria 360): o limite de 5MB era um ParseFilePipe de
 * parametro, que roda ANTES do corpo do metodo -- rejeitava a requisicao
 * sem nunca chegar no try/finally que limpa o disco. Arquivo real entre 5
 * e 25MB (multer ja tinha escrito por inteiro) ficava orfao em uploads/
 * pra sempre.
 */
describe('UploadsController.uploadFile — limite de tamanho sem orfao (JON-113)', () => {
  let controller: UploadsController;
  const uploadsDir = join(process.cwd(), 'uploads');
  const writtenPaths: string[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [{ provide: CloudflareCacheService, useValue: { purgeUrls: jest.fn() } }],
    }).compile();
    controller = module.get<UploadsController>(UploadsController);
  });

  afterEach(() => {
    for (const p of writtenPaths.splice(0)) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        // best-effort
      }
    }
  });

  it('rejeita arquivo acima de 5MB sem deixar orfao no disco', async () => {
    const tempPath = join(uploadsDir, 'oversized-test.tmp');
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .png()
      .toBuffer();
    fs.writeFileSync(tempPath, png);
    writtenPaths.push(tempPath);

    const fakeBigFile = { path: tempPath, originalname: 'grande.png', mimetype: 'image/png', size: 10 * 1024 * 1024 } as Express.Multer.File;

    await expect(controller.uploadFile(fakeBigFile)).rejects.toThrow(BadRequestException);

    expect(fs.existsSync(tempPath)).toBe(false);
    const leftover = fs.readdirSync(uploadsDir).filter((f) => f.startsWith('oversized-test'));
    expect(leftover).toEqual([]);
  });
});
