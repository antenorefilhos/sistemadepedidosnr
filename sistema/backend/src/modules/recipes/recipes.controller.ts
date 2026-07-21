import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
} from '@nestjs/common'
import { RecipesService } from './recipes.service'
import { CreateRecipeDto } from './dto/create-recipe.dto'
import { UpdateRecipeDto } from './dto/update-recipe.dto'
import { CreateRecipeCategoryDto, UpdateRecipeCategoryDto } from './dto/recipe-category.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'

@Controller('recipes')
export class RecipesController {
  constructor(private readonly service: RecipesService) {}

  // ---- Categories ----

  @Get('categories')
  listCategories() {
    return this.service.listCategories()
  }

  @Post('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  createCategory(@Body() dto: CreateRecipeCategoryDto) {
    return this.service.createCategory(dto)
  }

  @Put('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateRecipeCategoryDto) {
    return this.service.updateCategory(id, dto)
  }

  @Delete('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  deleteCategory(@Param('id') id: string) {
    return this.service.deleteCategory(id)
  }

  // ---- Recipes ----

  @Get()
  list(
    @Query('active') active?: string,
    @Query('category') category?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit?: number,
  ) {
    const activeFilter = active === undefined ? true : active === 'false' ? false : true
    return this.service.list(activeFilter, category, page, limit)
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug)
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateRecipeDto) {
    return this.service.create(dto)
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateRecipeDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }
}
