import { PartialType } from '@nestjs/mapped-types'
import { Type } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator'

export class CreateRecipeCategoryDto {
  @IsString()
  name: string

  @IsString()
  slug: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  active?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  order?: number
}

export class UpdateRecipeCategoryDto extends PartialType(CreateRecipeCategoryDto) {}
