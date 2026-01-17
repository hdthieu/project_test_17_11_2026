import { ApiProperty } from '@nestjs/swagger';
import { ProductRecordStatus } from '../enums/product-record-status.enum';

export class ProductRecordResponseDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ example: 'SAMSUNG-S26-HD001' })
    recordCode: string;

    @ApiProperty({ example: 1 })
    currentVersion: number;

    @ApiProperty({ example: 1, description: 'Alias for currentVersion' })
    version?: number;

    @ApiProperty({ enum: ProductRecordStatus, example: ProductRecordStatus.DRAFT })
    status: ProductRecordStatus;

    @ApiProperty({ example: 'SAMSUNG-S26' })
    shopCode: string;

    @ApiProperty({ example: 'Hồ sơ hàng hóa tháng 1/2026', required: false })
    description?: string;

    @ApiProperty({ required: false })
    filePath?: string;

    @ApiProperty({ required: false })
    fileName?: string;

    @ApiProperty({ required: false })
    fileSize?: number;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt?: Date;

    @ApiProperty({ required: false })
    finalizedAt?: Date;

    @ApiProperty({ required: false })
    finalizedBy?: string;
}

/**
 * DTO Response cho File
 */
export class ProductFileResponseDto {
    @ApiProperty({ example: '660e8400-e29b-41d4-a716-446655440001' })
    id: string;

    @ApiProperty({ example: 1 })
    version: number;

    @ApiProperty({ example: 'document.pdf' })
    filename: string;

    @ApiProperty({ example: 'storage/modify/v1/document.pdf' })
    filePath: string;

    @ApiProperty({ example: 2048576 })
    fileSize: number;

    @ApiProperty({ example: 'application/pdf' })
    mimeType: string;

    @ApiProperty({ example: 'pdf' })
    extension: string;

    @ApiProperty()
    uploadedAt: Date;

    @ApiProperty({ required: false })
    notes?: string;
}

/**
 * Response khi upload thành công
 */
export class UploadSuccessResponseDto {
    @ApiProperty({ example: true })
    success: boolean;

    @ApiProperty({ example: 'Upload thành công' })
    message: string;

    @ApiProperty({ type: ProductRecordResponseDto })
    record: ProductRecordResponseDto;

    @ApiProperty({ type: ProductFileResponseDto })
    file: ProductFileResponseDto;
}

/**
 * Response cho paginated list
 */
export class PaginatedProductRecordResponseDto {
    @ApiProperty({ type: [ProductRecordResponseDto] })
    data: ProductRecordResponseDto[];

    @ApiProperty({ example: 100 })
    total: number;

    @ApiProperty({ example: 1 })
    page: number;

    @ApiProperty({ example: 10 })
    limit: number;

    @ApiProperty({ example: 10 })
    totalPages: number;
}
