import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductRecordDto {

    @ApiProperty({
        description: 'Mã hồ sơ hàng hóa (unique)',
        example: 'SAMSUNG-S26-HD001',
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty({ message: 'CODE_NOT_EMPTY' })
    @MaxLength(100, { message: 'CODE_MAX_LENGTH_100' })
    recordCode: string;

    @ApiProperty({
        description: 'Mã cửa hàng',
        example: 'SAMSUNG-S26',
        maxLength: 50,
    })
    @IsString()
    @IsNotEmpty({ message: 'SHOP_CODE_NOT_EMPTY' })
    @MaxLength(50, { message: 'SHOP_CODE_MAX_LENGTH_50' })
    shopCode: string;

    /**
     * Mô tả hoặc ghi chú (optional)
     */
    @ApiPropertyOptional({
        description: 'Mô tả hoặc ghi chú cho hồ sơ',
        example: 'Hồ sơ hàng hóa tháng 1/2026',
    })
    @IsString()
    @IsOptional()
    description?: string;
}
