import { Module } from '@nestjs/common'
import { RecipesController } from './recipes.controller'
import { RecipesService } from './recipes.service'
import { PrismaService } from '../../common/prisma.service'

@Module({
  controllers: [RecipesController],
  providers: [RecipesService, PrismaService],
  exports: [RecipesService],
})
export class RecipesModule {}
