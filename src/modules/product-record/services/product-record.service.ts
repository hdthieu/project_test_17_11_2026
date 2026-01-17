import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { ProductRecord } from '../entities/product-record.entity';
import { ProductFile } from '../entities/product-file.entity';
import { ProductRecordStatus } from '../enums/product-record-status.enum';
import {
    CreateProductRecordDto,
    QueryProductRecordDto,
    FinalizeProductRecordDto,
} from '../dto';
import { STATUS_CODES } from 'http';

@Injectable()
export class ProductRecordService {
    constructor(
        @InjectRepository(ProductRecord)
        private readonly productRecordRepo: Repository<ProductRecord>,

        @InjectRepository(ProductFile)
        private readonly productFileRepo: Repository<ProductFile>,
    ) { }

    /**
     * Tạo Product Record mới (v = 1, status = DRAFT)
     */
    async create(dto: CreateProductRecordDto): Promise<ProductRecord> {
        // Kiểm tra trùng recordCode
        const existing = await this.productRecordRepo.findOne({
            where: { recordCode: dto.recordCode },
        });

        if (existing) {
            throw new BadRequestException(
                `CODE_EXISTS`,
            );
        }
        const record = this.productRecordRepo.create({
            recordCode: dto.recordCode,
            shopCode: dto.shopCode,
            description: dto.description,
            currentVersion: 1,
            status: ProductRecordStatus.DRAFT,
        });

        return await this.productRecordRepo.save(record);
    }

    /**
     * Tìm Product Record theo ID
     */
    async findById(id: string, includeFiles = false): Promise<ProductRecord> {
        const record = await this.productRecordRepo.findOne({
            where: { id },
            relations: includeFiles ? ['files'] : [],
        });
        if (!record) {
            throw new NotFoundException({
                message: 'NOT_FOUND',
                statusCode: 404
            });
        }
        return record;
    }

    /**
     * Tìm Product Record theo recordCode
     */
    async findByCode(recordCode: string): Promise<ProductRecord> {
        const record = await this.productRecordRepo.findOne({
            where: { recordCode },
        });

        if (!record) {
            throw new NotFoundException(`Không tìm thấy hồ sơ với mã: ${recordCode}`);
        }

        return record;
    }

    /**
     * Query danh sách Product Records với filter và pagination
     */
    async findAll(query: QueryProductRecordDto) {
        const { shopCode, status, search, page = 1, limit = 10 } = query;

        const queryBuilder = this.productRecordRepo.createQueryBuilder('record');

        // Filter theo shopCode
        if (shopCode) {
            queryBuilder.andWhere('record.shopCode = :shopCode', { shopCode });
        }

        // Filter theo status
        if (status) {
            queryBuilder.andWhere('record.status = :status', { status });
        }

        // Search theo recordCode
        if (search) {
            queryBuilder.andWhere('record.recordCode LIKE :search', {
                search: `%${search}%`,
            });
        }

        // Pagination
        const skip = (page - 1) * limit;
        queryBuilder.skip(skip).take(limit);

        // Sort by createdAt DESC
        queryBuilder.orderBy('record.createdAt', 'DESC');

        const [data, total] = await queryBuilder.getManyAndCount();

        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * LOGIC QUAN TRỌNG: Tính toán Next Version
     * 
     * Flow:
     * 1. Lấy currentVersion từ ProductRecord
     * 2. nextVersion = currentVersion + 1
     * 3. Update currentVersion trong DB
     * 4. Update status thành MODIFIED
     * 
     * @param recordId ID của Product Record
     * @returns nextVersion number
     */
    async calculateNextVersion(recordId: string): Promise<number> {
        const record = await this.findById(recordId);

        // Kiểm tra: Không cho modify nếu đã FINAL
        if (record.status === ProductRecordStatus.FINAL) {
            throw new BadRequestException(
                `Hồ sơ "${record.recordCode}" đã được finalize, không thể chỉnh sửa`,
            );
        }

        // Tính nextVersion
        const nextVersion = record.currentVersion + 1;

        // Update currentVersion và status
        record.currentVersion = nextVersion;
        record.status = ProductRecordStatus.MODIFIED;

        await this.productRecordRepo.save(record);

        return nextVersion;
    }

    /**
     * Finalize Product Record
     * Sau khi finalize, không thể modify nữa
     */
    async finalize(
        recordId: string,
        dto: FinalizeProductRecordDto,
    ): Promise<ProductRecord> {
        const record = await this.findById(recordId);

        // Kiểm tra đã final chưa
        if (record.status === ProductRecordStatus.FINAL) {
            throw new BadRequestException(`Hồ sơ này đã được finalize trước đó`);
        }

        // Validate finalizedBy
        if (!dto.finalizedBy) {
            throw new BadRequestException('finalizedBy is required');
        }

        // Update status
        record.status = ProductRecordStatus.FINAL;
        record.finalizedAt = new Date();
        record.finalizedBy = dto.finalizedBy;

        return await this.productRecordRepo.save(record);
    }

    /**
     * Lấy tất cả files của Product Record
     */
    async getFiles(recordId: string, version?: number): Promise<ProductFile[]> {
        const where: any = { record: { id: recordId } };
        if (version) {
            where.version = version;
        }
        return await this.productFileRepo.find({
            where,
            order: { version: 'DESC', createdAt: 'DESC' },
        });
    }

    /**
     * Lấy danh sách v của một Product Record
     */
    async getVersions(recordId: string) {
        const files = await this.getFiles(recordId);
        const versionMap = new Map<number, ProductFile[]>();

        files.forEach((file) => {
            if (!versionMap.has(file.version)) {
                versionMap.set(file.version, []);
            }
            versionMap.get(file.version)!.push(file);
        });
        const versions = Array.from(versionMap.entries())
            .map(([version, files]) => ({
                version,
                files,
                fileCount: files.length,
                uploadedAt: files[0]?.createdAt,
            }))
            .sort((a, b) => b.version - a.version);

        return versions;
    }

    /**
     * Xóa Product Record
     */
    async delete(recordId: string): Promise<void> {
        const record = await this.findById(recordId);
        if (record.status === ProductRecordStatus.FINAL) {
            throw new BadRequestException({
                message: 'CANNOT_DELETE_FINALIZED_RECORD',
                statusCode: STATUS_CODES.FORBIDDEN
            });
        }

        await this.productRecordRepo.remove(record);
    }

    /**
     * Get current v của record
     */
    async getCurrentVersion(recordId: string): Promise<number> {
        const record = await this.findById(recordId);
        return record.currentVersion;
    }

    /**
     * Find one Product Record by ID (alias cho controller)
     */
    async findOne(id: string): Promise<ProductRecord> {
        return await this.findById(id, true);
    }

    /**
     * Modify Product Record
     */
    async modify(id: string, dto: { notes?: string }): Promise<ProductRecord> {
        const record = await this.findById(id);
        if (record.status === ProductRecordStatus.FINAL) {
            throw new BadRequestException(
                { message: 'RECORD_FINALIZED_CANNOT_MODIFY' }
            );
        }
        record.currentVersion += 1;
        record.status = ProductRecordStatus.MODIFIED;
        return await this.productRecordRepo.save(record);
    }

    /**
     * Check history versions from record
     */
    async getVersionHistory(recordId: string) {
        await this.findById(recordId); // Validate record exists

        const files = await this.productFileRepo.find({
            where: { record: { id: recordId } },
            order: { version: 'ASC', createdAt: 'ASC' },
        });

        // Group files by version
        const versionMap = new Map<number, ProductFile[]>();
        files.forEach((file) => {
            if (!versionMap.has(file.version)) {
                versionMap.set(file.version, []);
            }
            versionMap.get(file.version)!.push(file);
        });

        // Convert to array
        return Array.from(versionMap.entries())
            .map(([version, files]) => ({
                version,
                files: files.map((f) => ({
                    id: f.id,
                    filename: f.filename,
                    filePath: f.filePath,
                    fileSize: f.fileSize,
                    mimeType: f.mimeType,
                    createdAt: f.createdAt,
                    notes: f.notes,
                })),
                fileCount: files.length,
                uploadedAt: files[0]?.createdAt,
            }))
            .sort((a, b) => a.version - b.version);
    }
}
