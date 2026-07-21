import { Test, TestingModule } from '@nestjs/testing';
import { HeroSlidesService } from './hero-slides.service';
import { PrismaService } from '../../../common/prisma.service';

describe('HeroSlidesService', () => {
  let service: HeroSlidesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HeroSlidesService,
        {
          provide: PrismaService,
          useValue: {
            heroSlide: {
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<HeroSlidesService>(HeroSlidesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
