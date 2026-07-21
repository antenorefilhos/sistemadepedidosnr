import { Type } from 'class-transformer'
import { IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

export class CreateRecipeIngredientDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  quantity?: string

  @IsOptional()
  @IsString()
  unit?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  order?: number
}

export class CreateRecipeStepDto {
  @IsString()
  content: string

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  order?: number

  @IsOptional()
  @IsString()
  imageUrl?: string
}

export class CreateRecipeProductDto {
  @IsString()
  productId: string

  @IsOptional()
  @IsString()
  note?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  order?: number
}

export class CreateRecipeDto {
  @IsString()
  title: string

  @IsString()
  slug: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  seoTitle?: string

  @IsOptional()
  @IsString()
  seoDescription?: string

  @IsOptional()
  @IsString()
  imageUrl?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  prepTime?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  servings?: number

  @IsOptional()
  @IsString()
  difficulty?: string

  @IsOptional()
  @IsString()
  categoryId?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeIngredientDto)
  ingredients?: CreateRecipeIngredientDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeStepDto)
  steps?: CreateRecipeStepDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeProductDto)
  products?: CreateRecipeProductDto[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedIds?: string[]

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  active?: boolean

  @IsOptional()
  @IsDateString()
  publishedAt?: string
}
