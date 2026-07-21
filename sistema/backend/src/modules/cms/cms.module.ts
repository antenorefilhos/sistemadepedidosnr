import { Module } from '@nestjs/common';
import { CategoriesModule } from './categories/categories.module';
import { HeroSlidesModule } from './hero-slides/hero-slides.module';
import { PromoBannersModule } from './promo-banners/promo-banners.module';
import { StoreBannersModule } from './store-banners/store-banners.module';

@Module({
  imports: [CategoriesModule, HeroSlidesModule, PromoBannersModule, StoreBannersModule]
})
export class CmsModule {}
