import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { isAbsolute, join, relative, resolve, sep } from 'path';

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
    // JON-135 (Auditoria 360, High): filename vem de extractFilenameFromUrl,
    // que so faz um regex sobre tudo depois de "/uploads/" -- uma URL
    // gravada no CMS com "../../.env" ou path absoluto chegava aqui, join()
    // normalizava pra FORA de uploadsDir, e o unlink rodava sem checagem
    // nenhuma. Resolve o candidato e confere que ele continua dentro da raiz
    // antes de apagar qualquer coisa.
    //
    // Achado em 17/09/2026 (CI real rodando pela primeira vez num runner
    // Linux): barra invertida (`\`) so e separador de path no Windows --
    // path.resolve/relative no Linux (onde producao roda de verdade, via
    // Docker) tratam "..\\..\\windows\\..." como UM nome de arquivo literal,
    // que fica dentro de uploadsDir (nao escapa nada, so tenta apagar um
    // arquivo esquisito que nao existe). Nao era vulnerabilidade real em
    // producao, mas o codigo dependia de semantica de path do SO onde roda
    // pra decidir seguranca -- fragil. Rejeita `\` explicitamente, antes de
    // qualquer resolve, pra ficar correto em qualquer plataforma sem
    // depender de qual SO esta executando.
    if (filename.includes('\\')) {
      console.warn(`[UploadsManagement] Caminho fora da pasta de uploads recusado: ${filename}`);
      return;
    }
    const candidate = resolve(this.uploadsDir, filename);
    const rel = relative(this.uploadsDir, candidate);
    if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      console.warn(`[UploadsManagement] Caminho fora da pasta de uploads recusado: ${filename}`);
      return;
    }
    try {
      await fs.unlink(candidate);
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
