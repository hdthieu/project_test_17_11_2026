import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ModifyProductRecordDto {
    @ApiPropertyOptional({
        description: 'Ghi chú cho lần modify',
        example: 'Cập nhật giá mới',
    })
    @IsString()
    @IsOptional()
    notes?: string;
}
