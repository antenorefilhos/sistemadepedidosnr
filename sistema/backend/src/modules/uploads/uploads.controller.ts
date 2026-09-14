import {
  BadRequestException,
  Controller,
  Delete,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import sharp from 'sharp';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/tiff',
  'image/bmp',
]);
/**
 * Teto do lado do canvas de saida. A vitrine exibe a ~800px; 2000 da folga pra
 * zoom e telas densas sem deixar o custo de memoria ser escolhido por quem faz
 * o upload.
 */
const MAX_CANVAS_PX = 2000;
/** Teto de bytes do upload. Foto de produto de 25 MB ja e generosa. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
/**
 * Teto de pixels na ENTRADA, checado pelo sharp antes de decodificar. Limite de
 * bytes nao protege disso: um PNG de poucos KB pode descomprimir pra centenas
 * de megapixels (decompression bomb). 40MP cobre qualquer camera real.
 */
const MAX_INPUT_PIXELS = 40_000_000;

// EAN so tem digitos; sem essa checagem, :ean vira parte literal de um path
// (filename do multer e destino do sharp) e um staff comprometido/token vazado
// poderia escrever fora de uploads/products via "../" no parametro da rota.
//
// Aceita a partir de 1 digito: o catalogo usa codigo interno curto pra
// hortifruti e producao propria (ex.: 6 = ALFACE, 303 = AIPIM). Exigir 4+
// bloqueava foto de ~890 produtos ativos com "EAN invalido". So digitos ja
// impede path traversal, o tamanho minimo nao acrescentava seguranca.
const EAN_PARAM_RE = /^[0-9]{1,20}$/;

function assertValidEan(ean: string | undefined): string {
  if (!ean || !EAN_PARAM_RE.test(ean)) {
    throw new BadRequestException('EAN invalido.');
  }
  return ean;
}

// Rotas de upload sao admin-only e podem ser chamadas em lote (import de fotos,
// edicao em massa de catalogo). Sem isso, o guard global aplica TODOS os buckets
// nomeados de throttle (inclusive 'auth': 20 req/min), nao so o 'default' -- o que
// bloqueava qualquer upload em lote apos ~20 arquivos mesmo estando bem abaixo do
// limite geral de 600/min.
@SkipThrottle({ auth: true, checkout: true, webhook: true })
@Controller('uploads')
export class UploadsController {
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('file', {
      // Sem limite, o multer grava o arquivo inteiro em disco ANTES de qualquer
      // checagem -- upload de 2 GB enche o volume mesmo sendo recusado depois.
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
      storage: diskStorage({
        destination: './uploads',
        // JON-137 (Auditoria 360, High): a extensao vinha de extname(originalname),
        // controlado pelo cliente -- um arquivo "evil.html" com
        // Content-Type: image/png forjado passava no fileFilter (que so olha
        // mimetype, tambem do cliente) e era servido como HTML na mesma
        // origem do app (stored XSS). Sempre grava como .tmp; a extensao/
        // Content-Type final so nascem depois, do formato REAL decodificado
        // pelo sharp abaixo -- nunca do que o cliente declarou.
        filename: (req, file, callback) => {
          callback(null, `${uuidv4()}.tmp`);
        },
      }),
      // Rejeita pelo fileFilter (antes de gravar em disco) em vez de checar
      // so depois -- senao arquivo com mimetype invalido ja tinha sido
      // gravado com nome unico e ficava orfao em ./uploads pra sempre.
      // Continua sendo so a primeira barreira (mimetype ainda e do
      // cliente) -- a decodificacao real do sharp abaixo e quem decide.
      fileFilter: (req, file, callback) => {
        if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
          callback(new BadRequestException('Formato de imagem inválido. Envie JPG, PNG, WebP, AVIF, GIF, TIFF ou BMP.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const tempPath = file.path;
    const finalName = `${uuidv4()}.webp`;
    const finalPath = join('./uploads', finalName);

    // JON-113 (Auditoria 360): o limite "de verdade" (5MB) era checado por um
    // ParseFilePipe, que roda como PARAMETRO -- antes do corpo do metodo, e
    // portanto antes do try/finally que limpa o tempPath. Arquivo entre 5 e
    // 25MB (dentro do teto generoso do multer, acima do nosso) era gravado
    // por inteiro e ficava orfao pra sempre, porque a rejeicao acontecia
    // fora de qualquer bloco com cleanup. Agora a checagem de tamanho mora
    // DENTRO do try, coberta pelo mesmo finally que limpa tudo.
    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new BadRequestException('Arquivo muito grande (maximo 5MB).');
      }
      // sharp so decodifica bytes de imagem de verdade -- HTML/SVG/JS
      // disfarcado de image/png estoura aqui, antes de virar arquivo
      // publico. limitInputPixels evita decompression bomb.
      await sharp(tempPath, { limitInputPixels: MAX_INPUT_PIXELS })
        .resize(MAX_CANVAS_PX, MAX_CANVAS_PX, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 90, effort: 6 })
        .toFile(finalPath);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Arquivo enviado nao e uma imagem valida: ' + (error as Error).message);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }

    return {
      url: `/uploads/${finalName}`,
      filename: finalName,
      originalName: file.originalname,
    };
  }

  @Post(['product/:ean', 'product/:ean/:slot'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('file', {
      // Sem limite, o multer grava o arquivo inteiro em disco ANTES de qualquer
      // checagem -- upload de 2 GB enche o volume mesmo sendo recusado depois.
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
      storage: diskStorage({
        destination: './uploads/products',
        filename: (req, file, callback) => {
          const ean = req.params.ean;
          const slot = req.params.slot;
          if (!ean || !EAN_PARAM_RE.test(ean) || (slot && slot !== '2')) {
            callback(new BadRequestException('EAN invalido.'), '');
            return;
          }
          const suffix = slot === '2' ? '_2' : '';
          const tempName = `${ean}${suffix}-temp${extname(file.originalname)}`;
          callback(null, tempName);
        },
      }),
      // JON-113/JON-137 (Auditoria 360): faltava aqui -- so o endpoint
      // generico rejeitava MIME no fileFilter (antes de gravar). Este
      // endpoint so checava mimetype DEPOIS de escrever o arquivo, e nem
      // isso dentro do try/finally que limpa o disco.
      fileFilter: (req, file, callback) => {
        if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
          callback(new BadRequestException('Formato de imagem inválido. Envie JPG, PNG, WebP, AVIF, GIF, TIFF ou BMP.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadProductImage(
    @Param('ean') ean: string,
    @Param('slot') slot: string | undefined,
    @UploadedFile() file: Express.Multer.File,
  ) {
    assertValidEan(ean);

    const tempPath = file.path;
    const finalDir = './uploads/products';
    const suffix = slot === '2' ? '_2' : '';
    const finalPath = join(finalDir, `${ean}${suffix}.webp`);
    // Escreve num arquivo a parte e so entao substitui: se o sharp falhar no
    // meio, a foto antiga continua intacta em vez de virar arquivo truncado.
    const stagingPath = `${finalPath}.new`;

    try {
      // JON-113: checagem de tamanho movida pra dentro do try -- antes vinha
      // de um ParseFilePipe que rejeitava ANTES deste bloco rodar, deixando
      // arquivo entre 5 e 25MB (multer ja tinha escrito por inteiro) orfao
      // em uploads/products pra sempre.
      if (file.size > 5 * 1024 * 1024) {
        throw new BadRequestException('Arquivo muito grande (maximo 5MB).');
      }
      if (!fs.existsSync(finalDir)) {
        fs.mkdirSync(finalDir, { recursive: true });
      }

      const metadata = await sharp(tempPath, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
      // 800px e o minimo e MAX_CANVAS_PX o teto. Imagem de origem maior nao e
      // reduzida ate o teto; o canvas quadrado acompanha o maior lado pra
      // preservar detalhe.
      //
      // O teto NAO e detalhe de gosto: sem ele o canvas passa a ser ditado pelo
      // arquivo enviado. Um TIFF de camera (8000x6000 -- e TIFF e um dos
      // formatos aceitos aqui) geraria um canvas 8000x8000, ~256 MB so no
      // buffer de saida, derrubando o container da API. E a API e o backend
      // inteiro: loja, admin, separacao e entrega caem juntos.
      const canvasSize = Math.min(
        MAX_CANVAS_PX,
        Math.max(800, metadata.width ?? 800, metadata.height ?? 800),
      );

      await sharp(tempPath, { limitInputPixels: MAX_INPUT_PIXELS })
        .resize(canvasSize, canvasSize, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .webp({ quality: 90, effort: 6 })
        .toFile(stagingPath);

      fs.renameSync(stagingPath, finalPath);

      return {
        success: true,
        url: `/uploads/products/${ean}${suffix}.webp?v=${Date.now()}`,
      };
    } catch (error) {
      if (fs.existsSync(stagingPath)) {
        fs.unlinkSync(stagingPath);
      }
      throw new BadRequestException('Erro ao processar imagem: ' + error.message);
    } finally {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }

  /**
   * Apaga a foto do disco de verdade -- nao basta sumir da tela, senao o
   * armazenamento da VPS vai acumulando imagem orfa.
   */
  @Delete(['product/:ean', 'product/:ean/:slot'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async deleteProductImage(@Param('ean') ean: string, @Param('slot') slot: string | undefined) {
    assertValidEan(ean);
    if (slot && slot !== '2') {
      throw new BadRequestException('Slot invalido.');
    }

    const suffix = slot === '2' ? '_2' : '';
    const filePath = join('./uploads/products', `${ean}${suffix}.webp`);

    if (!fs.existsSync(filePath)) {
      // Idempotente: se ja nao existe, o resultado desejado ja e o atual.
      return { success: true, deleted: false };
    }

    try {
      fs.unlinkSync(filePath);
      return { success: true, deleted: true };
    } catch (error) {
      throw new BadRequestException('Erro ao apagar imagem: ' + error.message);
    }
  }
}
