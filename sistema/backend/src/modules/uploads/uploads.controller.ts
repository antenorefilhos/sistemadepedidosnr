import {
  BadRequestException,
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  UseGuards,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import sharp from 'sharp';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Controller('uploads')
export class UploadsController {
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
    }),
  )
  uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Formato de imagem inválido. Envie JPG, PNG ou WebP.');
    }

    return {
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
    };
  }

  @Post(['product/:ean', 'product/:ean/:slot'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/products',
        filename: (req, file, callback) => {
          const ean = req.params.ean;
          const slot = req.params.slot;
          const suffix = slot === '2' ? '_2' : '';
          const tempName = `${ean}${suffix}-temp${extname(file.originalname)}`;
          callback(null, tempName);
        },
      }),
    }),
  )
  async uploadProductImage(
    @Param('ean') ean: string,
    @Param('slot') slot: string | undefined,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Formato de imagem inválido. Envie JPG, PNG ou WebP.');
    }

    const tempPath = file.path;
    const finalDir = './uploads/products';
    
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }
    
    const suffix = slot === '2' ? '_2' : '';
    const finalPath = join(finalDir, `${ean}${suffix}.webp`);

    try {
      await sharp(tempPath)
        .resize(800, 800, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toFile(finalPath);

      // Remove temp file
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }

      return {
        success: true,
        url: `/uploads/products/${ean}${suffix}.webp?v=${Date.now()}`,
      };
    } catch (error) {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      throw new BadRequestException('Erro ao processar imagem: ' + error.message);
    }
  }
}
