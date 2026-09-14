import { promises as fs } from 'fs';
import { join } from 'path';
import { UploadsManagementService } from './uploads.service';

/**
 * JON-135 (Auditoria 360, High): deleteFile so fazia join(uploadsDir, filename)
 * e apagava sem checar se o resultado continuava dentro de uploadsDir.
 * filename vem de extractFilenameFromUrl, que so faz regex sobre uma URL
 * gravada no CMS -- "../../.env", path absoluto ou separador do Windows
 * chegavam direto no unlink.
 */
jest.mock('fs', () => ({
  promises: { unlink: jest.fn() },
}));

describe('UploadsManagementService (JON-135)', () => {
  let service: UploadsManagementService;
  const uploadsDir = join(process.cwd(), 'uploads');

  beforeEach(() => {
    service = new UploadsManagementService();
    jest.clearAllMocks();
  });

  it('apaga arquivo valido dentro de uploads/', async () => {
    await service.deleteFile('foto.jpg');
    expect(fs.unlink).toHaveBeenCalledWith(join(uploadsDir, 'foto.jpg'));
  });

  it('apaga arquivo valido em subpasta de uploads/', async () => {
    await service.deleteFile('products/ean123.webp');
    expect(fs.unlink).toHaveBeenCalledWith(join(uploadsDir, 'products/ean123.webp'));
  });

  it.each([
    ['../../.env'],
    ['../../../etc/passwd'],
    ['..\\..\\windows\\system32\\config'],
    ['/etc/passwd'],
  ])('recusa path traversal: %s', async (malicious) => {
    await service.deleteFile(malicious);
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('recusa filename vazio sem chamar unlink', async () => {
    await service.deleteFile('');
    expect(fs.unlink).not.toHaveBeenCalled();
  });
});
