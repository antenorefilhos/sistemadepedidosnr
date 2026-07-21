import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Serviço compartilhado para gerenciar limpeza de arquivos de upload.
 * Responsável por:
 * - Extrair nome do arquivo de uma URL de upload
 * - Deletar arquivos de disco de forma segura
 */
@Injectable()
export class UploadsManagementService {
  private readonly uploadsDir = join(process.cwd(), 'uploads');

  /**
   * Extrai o nome do arquivo de uma URL de upload.
   * Ex: "/uploads/uuid.jpg" -> "uuid.jpg"
   */
  extractFilenameFromUrl(url: string): string | null {
    if (!url) return null;
    const match = url.match(/\/uploads\/(.+)$/);
    return match ? match[1] : null;
  }

  /**
   * Deleta um arquivo de disco de forma segura.
   * Ignora erros se o arquivo não existir.
   */
  async deleteFile(filename: string): Promise<void> {
    if (!filename) return;
    try {
      const filepath = join(this.uploadsDir, filename);
      await fs.unlink(filepath);
    } catch (err) {
      // Arquivo já deletado ou não existe — continuar silenciosamente
      console.warn(
        `[UploadsManagement] Arquivo não encontrado ou já deletado: ${filename}`,
        (err as Error).message,
      );
    }
  }

  /**
   * Deleta múltiplos arquivos em paralelo.
   */
  async deleteFiles(filenames: string[]): Promise<void> {
    const validFilenames = filenames.filter(Boolean);
    if (validFilenames.length === 0) return;
    await Promise.all(validFilenames.map((f) => this.deleteFile(f)));
  }

  /**
   * Deleta arquivos de uma URL de upload.
   */
  async deleteFileFromUrl(url: string): Promise<void> {
    const filename = this.extractFilenameFromUrl(url);
    if (filename) await this.deleteFile(filename);
  }

  /**
   * Deleta múltiplos arquivos a partir de URLs.
   */
  async deleteFilesFromUrls(urls: (string | null | undefined)[]): Promise<void> {
    const validUrls = urls.filter(Boolean) as string[];
    const filenames = validUrls
      .map((url) => this.extractFilenameFromUrl(url))
      .filter(Boolean) as string[];
    if (filenames.length > 0) await this.deleteFiles(filenames);
  }
}
