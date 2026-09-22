import { Test, TestingModule } from '@nestjs/testing';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

import { UploadsController } from './uploads.controller';
import { CloudflareCacheService } from '../../common/cloudflare-cache.service';

describe('UploadsController', () => {
  let controller: UploadsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [{ provide: CloudflareCacheService, useValue: { purgeUrls: jest.fn() } }],
    }).compile();

    controller = module.get<UploadsController>(UploadsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
