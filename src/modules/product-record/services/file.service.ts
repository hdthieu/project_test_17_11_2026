import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductFile } from '../entities/product-file.entity';
import { ProductRecord } from '../entities/product-record.entity';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
@Injectable()
export class FileService {
    private readonly storageBasePath = 'storage/modify';

    constructor(
        @InjectRepository(ProductFile)
        private readonly productFileRepo: Repository<ProductFile>,
    ) { }

    async saveFile(
        file: Express.Multer.File,
        record: ProductRecord,
        version: number,
        notes?: string,
    ): Promise<ProductFile> {
        // Validate file
        this.validateFile(file);

        // create version directory
        const versionDir = path.join(this.storageBasePath, `v${version}`);
        await this.ensureDirectoryExists(versionDir);

        // check duplicate filename and generate unique filename
        const originalFilename = this.formatFileName(file.originalname);
        const uniqueFilename = await this.generateUniqueFilename(
            record.id,
            version,
            originalFilename,
        );
        const filePath = path.join(versionDir, uniqueFilename);
        await fs.writeFile(filePath, file.buffer);
        const fileHash = this.calculateFileHash(file.buffer);
        // Get file extension
        const extension = path.extname(originalFilename).slice(1).toLowerCase();

        // Create ProductFile record
        const productFile = this.productFileRepo.create({
            record,
            version,
            filename: uniqueFilename,
            filePath: filePath.replace(/\\/g, '/'),
            fileSize: file.size,
            mimeType: file.mimetype,
            extension,
            fileHash,
            notes,
        });

        return await this.productFileRepo.save(productFile);
    }

    private async generateUniqueFilename(
        recordId: string,
        version: number,
        originalFilename: string,
    ): Promise<string> {
        // Parse filename
        const ext = path.extname(originalFilename);
        const nameWithoutExt = path.basename(originalFilename, ext);

        // check file existence
        const existingFile = await this.productFileRepo.findOne({
            where: {
                record: { id: recordId },
                version,
                filename: originalFilename,
            },
        });
        if (!existingFile) {
            return originalFilename;
        }

        // If exists, find unique filename with suffix
        let suffix = 1;
        let uniqueFilename = `${nameWithoutExt}_${suffix}${ext}`;

        while (true) {
            const exists = await this.productFileRepo.findOne({
                where: {
                    record: { id: recordId },
                    version,
                    filename: uniqueFilename,
                },
            });
            if (!exists) {
                break;
            }
            suffix++;
            uniqueFilename = `${nameWithoutExt}_${suffix}${ext}`;
        }
        return uniqueFilename;
    }

    /**
     * Validate file upload
     */
    private validateFile(file: Express.Multer.File): void {
        if (!file) {
            throw new BadRequestException({ message: 'FILE_NOT_PROVIDED', STATUS_CODES: 400 });
        }
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            throw new BadRequestException(
                { message: `FILE_TOO_LARGE`, STATUS_CODES: 400 }
            );
        }
        // Validate file type (PDF, JPG, PNG)
        const allowedMimeTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new BadRequestException(
                { message: `INVALID_FILE_TYPE`, STATUS_CODES: 400 }
            );
        }
    }

    /**
     * remove special characters
     */
    private formatFileName(filename: string): string {
        return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    }

    /**
     * Create directory if it doesn't exist
     */
    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    /**
     * Calculate file hash (MD5)
     */
    private calculateFileHash(buffer: Buffer): string {
        return crypto.createHash('md5').update(buffer).digest('hex');
    }

    /**
     * Get file by ID
     */
    async findById(fileId: string): Promise<ProductFile> {
        const file = await this.productFileRepo.findOne({
            where: { id: fileId },
            relations: ['record'],
        });

        if (!file) {
            throw new BadRequestException({ message: `FILE_NOT_FOUND`, STATUS_CODES: 400 });
        }

        return file;
    }

    /**
     * Read file from disk
     */
    async getFileContent(fileId: string): Promise<Buffer> {
        const file = await this.findById(fileId);

        try {
            return await fs.readFile(file.filePath);
        } catch (error) {
            throw new BadRequestException(
                `Không thể đọc file: ${error.message}`,
            );
        }
    }

    /**
     * Delete file (both in DB and disk)
     */
    async deleteFile(fileId: string): Promise<void> {
        const file = await this.findById(fileId);
        try {
            await fs.unlink(file.filePath);
        } catch (error) {
            console.error(`Failed to delete file from disk: ${error.message}`);
        }
        await this.productFileRepo.remove(file);
    }

    /**
     * Upload file và tạo ProductFile record
     * Method chính được gọi từ controller
     */
    async uploadFile(
        file: Express.Multer.File,
        recordId: string,
        version: number,
        uploadType: 'INITIAL' | 'MODIFY',
        notes?: string,
    ): Promise<ProductFile> {
        // Validate file
        this.validateFile(file);

        // Create version directory
        const versionDir = path.join(this.storageBasePath, `v${version}`);
        await this.ensureDirectoryExists(versionDir);

        // Generate unique filename (handle duplicates)
        const originalFilename = this.formatFileName(file.originalname);
        const uniqueFilename = await this.generateUniqueFilename(
            recordId,
            version,
            originalFilename,
        );

        // Full file path
        const filePath = path.join(versionDir, uniqueFilename);

        // Write file to disk
        await fs.writeFile(filePath, file.buffer);

        // Calculate file hash
        const fileHash = this.calculateFileHash(file.buffer);

        // Get file extension
        const extension = path.extname(originalFilename).slice(1).toLowerCase();

        // Create ProductFile record
        const productFile = this.productFileRepo.create({
            record: { id: recordId } as any,
            version,
            filename: uniqueFilename,
            filePath: filePath.replace(/\\/g, '/'), // Normalize path
            fileSize: file.size,
            mimeType: file.mimetype,
            extension,
            fileHash,
            notes,
        });

        return await this.productFileRepo.save(productFile);
    }

    /**
     * Get file info by ID
     */
    async getFileInfo(fileId: string): Promise<ProductFile> {
        return await this.findById(fileId);
    }

    /**
     * Check if file exists in version
     */
    async checkFileExists(
        recordId: string,
        version: number,
        filename: string,
    ): Promise<boolean> {
        const file = await this.productFileRepo.findOne({
            where: {
                record: { id: recordId },
                version,
                filename,
            },
        });

        return !!file;
    }
}
