import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
} from '@nestjs/common'
import { RecipesService } from './recipes.service'
import { CreateRecipeDto } from './dto/create-recipe.dto'
import { UpdateRecipeDto } from './dto/update-recipe.dto'
import { CreateRecipeCategoryDto, UpdateRecipeCategoryDto } from './dto/recipe-category.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'

@RelaxedThrottle()
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

  // JON-156 (Auditoria 360, Low): listagem/consulta por slug eram
  // publicas sem exigir active -- visitante que passasse active=false ou
  // conhecesse o slug de uma receita desativada continuava vendo o
  // conteudo. OptionalJwtAuthGuard: admin autenticado preserva o filtro que
  // pedir (inclusive ver inativas pra gerenciar); qualquer outro chamador
  // (inclusive anonimo) fica travado em active=true, sem exceção.
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(
    @Req() req: { user?: { role?: string } },
    @Query('active') active?: string,
    @Query('category') category?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit?: number,
  ) {
    const isAdmin = req.user?.role === 'admin'
    const activeFilter = isAdmin ? (active === undefined ? undefined : active !== 'false') : true
    return this.service.list(activeFilter, category, page, limit)
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  findBySlug(@Param('slug') slug: string, @Req() req: { user?: { role?: string } }) {
    return this.service.findBySlug(slug, req.user?.role === 'admin')
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
