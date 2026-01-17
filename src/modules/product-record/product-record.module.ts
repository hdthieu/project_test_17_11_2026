import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductRecord } from './entities/product-record.entity';
import { ProductFile } from './entities/product-file.entity';
import { ProductRecordService } from './services/product-record.service';
import { FileService } from './services/file.service';
import { ProductRecordController } from './controllers/product-record.controller';

/**
 * Product Record Module
 * 
 * Module quản lý hồ sơ hàng hóa với logic versioning
 * - Entities: ProductRecord, ProductFile
 * - Services: ProductRecordService, FileService
 * - Controller: ProductRecordController
 */
@Module({
    imports: [
        // Register entities với TypeORM
        TypeOrmModule.forFeature([ProductRecord, ProductFile]),
    ],
    controllers: [ProductRecordController],
    providers: [ProductRecordService, FileService],
    exports: [ProductRecordService, FileService], // Export để module khác có thể sử dụng
})
export class ProductRecordModule { }
