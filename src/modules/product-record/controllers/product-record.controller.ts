import {
    Controller,
    Get,
    Post,
    Put,
    Body,
    Param,
    Query,
    UseInterceptors,
    UploadedFile,
    ParseUUIDPipe,
    HttpStatus,
    HttpCode,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ProductRecordService } from '../services/product-record.service';
import { FileService } from '../services/file.service';
import {
    CreateProductRecordDto,
    ModifyProductRecordDto,
    FinalizeProductRecordDto,
    QueryProductRecordDto,
    ProductRecordResponseDto,
} from '../dto';

/**
 * Controller xử lý tất cả API endpoints cho Product Records
 * 
 * Endpoints:
 * - POST /product-records/upload : Tạo record mới và upload file đầu tiên
 * - POST /product-records/:id/modify : Modify record và upload file version mới
 * - PUT /product-records/:id/finalize : Chốt record (FINAL)
 * - GET /product-records : Lấy danh sách records (có filter)
 * - GET /product-records/:id : Lấy chi tiết 1 record
 * - GET /product-records/:id/versions : Lấy tất cả versions của record
 */
@ApiTags('Product Records')
@Controller('product-records')
export class ProductRecordController {
    constructor(
        private readonly productRecordService: ProductRecordService,
        private readonly fileService: FileService,
    ) { }

    /**
     * API 1: Upload file đầu tiên - Tạo record mới
     * POST /product-records/upload
     * 
     * Flow:
     * 1. Nhận file từ client
     * 2. Tạo ProductRecord mới (version=1, status=DRAFT)
     * 3. Lưu file vào storage/modify/v1/
     * 4. Tạo ProductFile record
     * 5. Return thông tin record + file
     */
    @Post('upload')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Upload file đầu tiên và tạo Product Record mới',
        description: 'Tạo một Product Record mới với version 1 và status DRAFT. File sẽ được lưu vào storage/modify/v1/'
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            required: ['file', 'recordCode', 'shopCode'],
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                    description: 'File cần upload (PDF, JPG, PNG)',
                },
                recordCode: {
                    type: 'string',
                    description: 'Mã hồ sơ (unique)',
                    example: 'SAMSUNG-S26-001',
                },
                shopCode: {
                    type: 'string',
                    description: 'Mã cửa hàng',
                    example: 'SAMSUNG-S26',
                },
                description: {
                    type: 'string',
                    description: 'Mô tả hồ sơ (optional)',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Upload thành công',
        type: ProductRecordResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'File không hợp lệ hoặc recordCode đã tồn tại'
    })
    @UseInterceptors(FileInterceptor('file'))
    async uploadInitial(
        @UploadedFile() file: Express.Multer.File,
        @Body() dto: CreateProductRecordDto,
    ): Promise<ProductRecordResponseDto> {
        // Validate file tồn tại
        if (!file) {
            throw new BadRequestException('FILE_REQUIRED');
        }

        // 1. Tạo Product Record
        const record = await this.productRecordService.create(dto);

        try {
            // 2. Upload file và tạo ProductFile record
            const productFile = await this.fileService.uploadFile(
                file,
                record.id,
                record.currentVersion,
                'INITIAL',
            );

            // 3. Return response
            return {
                id: record.id,
                recordCode: record.recordCode,
                shopCode: record.shopCode,
                currentVersion: record.currentVersion,
                version: record.currentVersion,
                status: record.status,
                description: record.description,
                filePath: productFile.filePath,
                fileName: productFile.filename,
                fileSize: productFile.fileSize,
                createdAt: record.createdAt,
            };
        } catch (error) {
            // Nếu upload file thất bại, xóa record đã tạo
            await this.productRecordService.delete(record.id);
            throw error;
        }
    }

    /**
     * API 2: Modify record - Upload file version mới
     * POST /product-records/:id/modify
     * 
     * Flow:
     * 1. Validate record tồn tại và chưa FINAL
     * 2. Tính nextVersion
     * 3. Upload file vào storage/modify/v[nextVersion]/
     * 4. Xử lý trùng tên file trong cùng version
     * 5. Update record: version++, status=MODIFIED
     * 6. Return thông tin mới
     */
    @Post(':id/modify')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Modify Product Record - Upload file version mới',
        description: 'Upload file phiên bản mới. Version tự động tăng (v1→v2→v3...). File lưu vào storage/modify/v[NextVersion]/'
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            required: ['file'],
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                    description: 'File version mới cần upload',
                },
                notes: {
                    type: 'string',
                    description: 'Ghi chú cho lần modify này',
                    example: 'Cập nhật giá sản phẩm',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Modify thành công',
        type: ProductRecordResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Record không tồn tại'
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Record đã FINAL hoặc file không hợp lệ'
    })
    @UseInterceptors(FileInterceptor('file'))
    async modify(
        @Param('id', ParseUUIDPipe) id: string,
        @UploadedFile() file: Express.Multer.File,
        @Body() dto: ModifyProductRecordDto,
    ): Promise<ProductRecordResponseDto> {
        // Validate file
        if (!file) {
            throw new BadRequestException('FILE_REQUIRED');
        }

        // 1. Modify record (tính nextVersion, update status)
        const record = await this.productRecordService.modify(id, dto);

        // 2. Upload file với version mới
        const productFile = await this.fileService.uploadFile(
            file,
            record.id,
            record.currentVersion,
            'MODIFY',
            dto.notes,
        );

        // 3. Return response
        return {
            id: record.id,
            recordCode: record.recordCode,
            shopCode: record.shopCode,
            currentVersion: record.currentVersion,
            version: record.currentVersion,
            status: record.status,
            description: record.description,
            filePath: productFile.filePath,
            fileName: productFile.filename,
            fileSize: productFile.fileSize,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }

    /**
     * API 3: Finalize record - Chốt không cho sửa nữa
     * PUT /product-records/:id/finalize
     * 
     * Flow:
     * 1. Validate record tồn tại
     * 2. Validate chưa FINAL
     * 3. Update status = FINAL, finalizedAt = NOW()
     * 4. Return record đã finalize
     */
    @Put(':id/finalize')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Finalize Product Record',
        description: 'Chốt hồ sơ, không cho phép modify thêm. Status → FINAL'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Finalize thành công'
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Record không tồn tại'
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Record đã FINAL rồi'
    })
    async finalize(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: FinalizeProductRecordDto,
    ) {
        const record = await this.productRecordService.finalize(id, dto);

        return {
            id: record.id,
            recordCode: record.recordCode,
            version: record.currentVersion,
            status: record.status,
            finalizedAt: record.finalizedAt,
            finalizedBy: record.finalizedBy,
            message: 'Product Record đã được finalize thành công',
        };
    }

    /**
     * API 4: Lấy danh sách records (có filter, pagination)
     * GET /product-records
     * 
     * Query params:
     * - shopCode: Filter theo shop
     * - status: Filter theo status (DRAFT/MODIFIED/FINAL)
     * - search: Tìm kiếm theo recordCode hoặc description
     * - page, limit: Pagination
     */
    @Get()
    @ApiOperation({
        summary: 'Lấy danh sách Product Records',
        description: 'Hỗ trợ filter theo shopCode, status, search và pagination'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Lấy danh sách thành công'
    })
    async findAll(@Query() query: QueryProductRecordDto) {
        const { data, total } = await this.productRecordService.findAll(query);

        return {
            data,
            total,
            page: query.page || 1,
            limit: query.limit || 10,
            totalPages: Math.ceil(total / (query.limit || 10)),
        };
    }

    /**
     * API 5: Lấy chi tiết 1 record
     * GET /product-records/:id
     */
    @Get(':id')
    @ApiOperation({
        summary: 'Lấy chi tiết Product Record',
        description: 'Lấy thông tin chi tiết một record theo ID'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Lấy chi tiết thành công'
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Record không tồn tại'
    })
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
        return await this.productRecordService.findOne(id);
    }

    /**
     * API 6: Lấy tất cả versions (files) của một record
     * GET /product-records/:id/versions
     * 
     * Return danh sách tất cả files theo version
     */
    @Get(':id/versions')
    @ApiOperation({
        summary: 'Lấy tất cả phiên bản (versions) của Product Record',
        description: 'Trả về danh sách tất cả files đã upload theo từng version'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Lấy versions thành công'
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Record không tồn tại'
    })
    async getVersions(@Param('id', ParseUUIDPipe) id: string) {
        const versions = await this.productRecordService.getVersionHistory(id);

        return {
            recordId: id,
            totalVersions: versions.length,
            versions,
        };
    }

    /**
     * API 7: Download file của một version cụ thể
     * GET /product-records/:id/files/:fileId/download
     */
    @Get(':id/files/:fileId')
    @ApiOperation({
        summary: 'Lấy thông tin file cụ thể',
        description: 'Lấy metadata của một file cụ thể'
    })
    async getFile(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('fileId', ParseUUIDPipe) fileId: string,
    ) {
        // Validate record tồn tại
        await this.productRecordService.findOne(id);

        // Lấy file info
        return await this.fileService.getFileInfo(fileId);
    }
}
