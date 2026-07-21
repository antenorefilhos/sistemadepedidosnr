import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

@Injectable()
export class UploadsService {
  private readonly uploadPath = join(process.cwd(), 'uploads');

  constructor() {
    this.ensureUploadPathExists();
  }

  private ensureUploadPathExists() {
    try {
      if (!existsSync(this.uploadPath)) {
        mkdirSync(this.uploadPath, { recursive: true });
      }
    } catch (error) {
      throw new InternalServerErrorException('Não foi possível criar a pasta de uploads');
    }
  }

  getUploadPath() {
    return this.uploadPath;
  }
}
