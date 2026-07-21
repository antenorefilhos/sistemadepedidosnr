import { Test, TestingModule } from '@nestjs/testing';
import { HeroSlidesController } from './hero-slides.controller';
import { HeroSlidesService } from './hero-slides.service';

describe('HeroSlidesController', () => {
  let controller: HeroSlidesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HeroSlidesController],
      providers: [
        {
          provide: HeroSlidesService,
          useValue: {
            findAll: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<HeroSlidesController>(HeroSlidesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
