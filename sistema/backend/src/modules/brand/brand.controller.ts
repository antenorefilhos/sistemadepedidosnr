import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
} from '@nestjs/common';
import { BrandService, BrandConfigDto } from './brand.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('brand')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get()
  get() {
    return this.brandService.get();
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Body() dto: BrandConfigDto) {
    return this.brandService.upsert(dto);
  }
}
