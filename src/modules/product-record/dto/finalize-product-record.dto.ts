import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FinalizeProductRecordDto {
    @ApiPropertyOptional({
        description: 'Người finalize hồ sơ',
        example: 'Nguyễn Văn A',
    })
    @IsString()
    @IsOptional()
    finalizedBy?: string;

    @ApiPropertyOptional({
        description: 'Ghi chú khi finalize',
        example: 'Đã kiểm tra và xác nhận đầy đủ',
    })
    @IsString()
    @IsOptional()
    notes?: string;
}
