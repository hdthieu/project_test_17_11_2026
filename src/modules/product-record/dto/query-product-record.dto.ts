import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductRecordStatus } from '../enums/product-record-status.enum';

export class QueryProductRecordDto {
    @ApiPropertyOptional({
        description: 'Filter theo mã cửa hàng',
        example: 'SAMSUNG-S26',
    })
    @IsString()
    @IsOptional()
    shopCode?: string;

    @ApiPropertyOptional({
        description: 'Filter theo trạng thái',
        enum: ProductRecordStatus,
        example: ProductRecordStatus.DRAFT,
    })
    @IsEnum(ProductRecordStatus)
    @IsOptional()
    status?: ProductRecordStatus;

    @ApiPropertyOptional({
        description: 'Tìm kiếm theo mã hồ sơ',
        example: 'HD001',
    })
    @IsString()
    @IsOptional()
    search?: string;

    @ApiPropertyOptional({
        description: 'Số trang',
        default: 1,
        minimum: 1,
    })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    page?: number = 1;

    @ApiPropertyOptional({
        description: 'Số lượng items mỗi trang',
        default: 10,
        minimum: 1,
    })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    limit?: number = 10;
}
