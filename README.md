# Product Record Management System

> Hệ thống quản lý phiên bản hồ sơ hàng hóa nội bộ (Offline Server)

## 📋 Tổng quan / Overview

Đây là hệ thống backend quản lý hồ sơ hàng hóa với cơ chế version control tự động, được xây dựng theo yêu cầu bài test Backend Developer. Hệ thống cho phép:

- Tải lên file hồ sơ ban đầu (v1)
- Chỉnh sửa và tạo phiên bản mới (v2, v3, ..., vN)
- Hoàn thiện hồ sơ (Final) - không thể chỉnh sửa thêm
- Quản lý và tra cứu lịch sử phiên bản
- Xử lý trùng lặp file tự động

## 🎯 Yêu cầu đã thực hiện / Requirements Fulfilled

### 1. ✅ Hoạt động Offline

- Hệ thống hoạt động hoàn toàn độc lập, không cần kết nối internet
- Sử dụng PostgreSQL local database
- Lưu trữ file trên file system cục bộ

### 2. ✅ Logic Versioning qua PostgreSQL

- Mỗi record có `currentVersion` được tính toán tự động qua database query
- Service method `calculateNextVersion()` truy vấn phiên bản hiện tại và tự động tăng
- Không hardcode version, đảm bảo tính nhất quán dữ liệu

```typescript
// Logic tự động tính version
async calculateNextVersion(recordId: string): Promise<number> {
  const maxVersion = await this.productFileRepository
    .createQueryBuilder('file')
    .where('file.record.id = :recordId', { recordId })
    .select('MAX(file.version)', 'maxVersion')
    .getRawOne();

  return (maxVersion?.maxVersion || 0) + 1;
}
```

### 3. ✅ File System Storage Pattern

- Structure: `storage/modify/v[NextVersion]/`
  - v1: `storage/modify/v1/`
  - v2: `storage/modify/v2/`
  - v3: `storage/modify/v3/`
  - ...
- Tự động tạo thư mục cho từng version mới

### 4. ✅ Xử lý trùng lặp File

- Phát hiện tên file trùng trong cùng (recordId, version)
- Tự động đổi tên: `filename.ext` → `filename_1.ext` → `filename_2.ext`
- Logic trong `FileService.generateUniqueFilename()`

```typescript
// Ví dụ xử lý duplicate
// Lần 1: document.pdf
// Lần 2: document_1.pdf
// Lần 3: document_2.pdf
```

## 🏗️ Kiến trúc / Architecture

### Technology Stack

- **Framework**: NestJS 11.0.1
- **Database**: PostgreSQL với TypeORM
- **File Upload**: Multer (multipart/form-data)
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger/OpenAPI

### Database Schema

#### ProductRecord Entity

```typescript
- id: UUID (Primary Key)
- recordCode: string (Unique) - Mã hồ sơ
- currentVersion: number - Phiên bản hiện tại
- status: DRAFT | MODIFIED | FINAL
- shopCode: string - Mã shop (VD: SAMSUNG-S26)
- description: string - Mô tả
- finalizedAt: Date - Ngày hoàn thiện
- finalizedBy: string - Người hoàn thiện
```

#### ProductFile Entity

```typescript
- id: UUID (Primary Key)
- record: ProductRecord (ManyToOne relation)
- version: number - Phiên bản file
- filename: string - Tên file
- filePath: string - Đường dẫn lưu trữ
- fileSize: number - Kích thước file
- mimeType: string - Loại file
- extension: string - Phần mở rộng
- fileHash: string - Hash để so sánh
- notes: string - Ghi chú
```

### Status Flow

```
DRAFT (v1 - Initial Upload)
  ↓
MODIFIED (v2, v3, ..., vN - Modifications)
  ↓
FINAL (Finalized - Read Only)
```

## 🚀 Cài đặt / Installation

### Prerequisites

- Node.js 18+ hoặc 20+
- PostgreSQL 12+
- npm hoặc yarn

### Bước 1: Clone và cài đặt dependencies

```bash
# Clone repository
git clone <repository-url>
cd project-test

# Cài đặt packages
npm install
```

### Bước 2: Cấu hình Database

Tạo file `.env` trong thư mục root:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=product_record_db

# Application
PORT=3000
NODE_ENV=development
```

### Bước 3: Tạo Database

```bash
# Kết nối PostgreSQL
psql -U postgres

# Tạo database
CREATE DATABASE product_record_db;
```

### Bước 4: Chạy ứng dụng

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

Ứng dụng sẽ chạy tại: `http://localhost:3000`  
Swagger UI: `http://localhost:3000/api`

## 📚 API Documentation

### 1. Upload Initial Record (Version 1)

**Tạo hồ sơ mới với file ban đầu**

```
POST /product-records/upload
Content-Type: multipart/form-data
```

**Body:**

```
recordCode: string (required) - Mã hồ sơ duy nhất
shopCode: string (required) - Mã shop
description: string (optional) - Mô tả
file: File (required) - File đính kèm
```

**Response:**

```json
{
  "id": "uuid",
  "recordCode": "REC001",
  "currentVersion": 1,
  "status": "DRAFT",
  "shopCode": "SAMSUNG-S26",
  "description": "Hồ sơ sản phẩm điện thoại",
  "files": [
    {
      "version": 1,
      "filename": "document.pdf",
      "filePath": "storage/modify/v1/document.pdf",
      "fileSize": 102400
    }
  ]
}
```

### 2. Modify Record (Create New Version)

**Tạo phiên bản mới cho hồ sơ đã tồn tại**

```
POST /product-records/:id/modify
Content-Type: multipart/form-data
```

**Body:**

```
notes: string (optional) - Ghi chú cho phiên bản mới
file: File (required) - File phiên bản mới
```

**Response:**

```json
{
  "id": "uuid",
  "recordCode": "REC001",
  "currentVersion": 2,
  "status": "MODIFIED",
  "files": [
    {
      "version": 2,
      "filename": "document_updated.pdf",
      "filePath": "storage/modify/v2/document_updated.pdf",
      "fileSize": 105600
    }
  ]
}
```

⚠️ **Lưu ý quan trọng:**

- `/upload` - Tạo **record MỚI** với version 1
- `/:id/modify` - Tạo **version MỚI** cho record đã tồn tại (v2, v3, ...)
- Không thể modify record có status = FINAL

### 3. Finalize Record

**Hoàn thiện hồ sơ (không thể chỉnh sửa thêm)**

```
PUT /product-records/:id/finalize
Content-Type: application/json
```

**Body:**

```json
{
  "finalizedBy": "Nguyễn Văn A"
}
```

### 4. Get All Records

**Lấy danh sách hồ sơ với filters**

```
GET /product-records?page=1&limit=10&status=DRAFT&shopCode=SAMSUNG-S26
```

### 5. Get Record by ID

**Lấy chi tiết một hồ sơ**

```
GET /product-records/:id
```

### 6. Get Version History

**Lấy lịch sử các phiên bản của một hồ sơ**

```
GET /product-records/:id/versions
```

**Response:**

```json
[
  {
    "version": 1,
    "filename": "document.pdf",
    "filePath": "storage/modify/v1/document.pdf",
    "fileSize": 102400,
    "uploadedAt": "2024-01-15T10:00:00Z"
  },
  {
    "version": 2,
    "filename": "document_updated.pdf",
    "filePath": "storage/modify/v2/document_updated.pdf",
    "fileSize": 105600,
    "uploadedAt": "2024-01-16T14:30:00Z"
  }
]
```

## 🧪 Testing

### Test với Swagger UI

1. Mở trình duyệt: `http://localhost:3000/api`
2. Test flow chuẩn:

**Bước 1: Upload record mới (v1)**

```
POST /product-records/upload
- recordCode: "REC001"
- shopCode: "SAMSUNG-S26"
- description: "Test record"
- file: [chọn file từ máy]
```

**Bước 2: Modify record (v2)**

```
POST /product-records/{id}/modify
- id: [copy id từ response bước 1]
- notes: "Cập nhật thông tin"
- file: [chọn file mới]
```

**Bước 3: Modify tiếp (v3)**

```
POST /product-records/{id}/modify
- id: [cùng id]
- notes: "Cập nhật lần 2"
- file: [chọn file khác]
```

**Bước 4: Xem lịch sử versions**

```
GET /product-records/{id}/versions
```

**Bước 5: Finalize record**

```
PUT /product-records/{id}/finalize
{
  "finalizedBy": "Tester"
}
```

**Bước 6: Thử modify lại (sẽ lỗi)**

```
POST /product-records/{id}/modify
→ Error 400: "Cannot modify a finalized record"
```

### Test Duplicate File Handling

1. Upload record với file `test.pdf`
2. Modify và upload cùng file `test.pdf` → Lưu thành `test_1.pdf`
3. Modify và upload lại file `test.pdf` → Lưu thành `test_2.pdf`

## 📂 Cấu trúc Project / Project Structure

```
src/
├── common/
│   ├── decorators/
│   │   └── roles.decorator.ts       # Custom decorators
│   └── role-common.ts                # Common constants
├── modules/
│   └── product-record/
│       ├── controllers/
│       │   └── product-record.controller.ts  # API endpoints
│       ├── dto/
│       │   ├── create-product-record.dto.ts
│       │   ├── modify-product-record.dto.ts
│       │   ├── finalize-product-record.dto.ts
│       │   └── query-product-record.dto.ts
│       ├── entities/
│       │   ├── product-record.entity.ts
│       │   └── product-file.entity.ts
│       ├── enums/
│       │   └── product-record-status.enum.ts
│       ├── services/
│       │   ├── product-record.service.ts     # Business logic
│       │   └── file.service.ts               # File handling
│       └── product-record.module.ts
├── app.module.ts
└── main.ts

storage/                              # File storage directory
└── modify/
    ├── v1/                          # Version 1 files
    ├── v2/                          # Version 2 files
    └── v3/                          # Version 3 files
```

## 🔧 Triển khai Offline / Offline Deployment

### Chuẩn bị máy chủ offline

1. **Cài đặt PostgreSQL:**

```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
```

2. **Cài đặt Node.js:**

```bash
# Sử dụng nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

3. **Copy source code:**

```bash
# Nén source code trên máy có internet
tar -czf project-test.tar.gz project-test/

# Copy sang máy offline (USB, network...)
# Giải nén
tar -xzf project-test.tar.gz
cd project-test
```

4. **Cài đặt dependencies (nếu đã có node_modules):**

```bash
# Option 1: Copy cả thư mục node_modules từ máy đã cài
# Option 2: Tạo local npm cache trước khi offline
npm install
```

5. **Thiết lập database:**

```bash
sudo -u postgres psql
CREATE DATABASE product_record_db;
CREATE USER app_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE product_record_db TO app_user;
```

6. **Chạy ứng dụng:**

```bash
npm run build
npm run start:prod

# Hoặc dùng PM2 cho production
npm install -g pm2
pm2 start dist/main.js --name product-record-api
pm2 save
pm2 startup
```

## 🐛 Xử lý lỗi / Error Handling

### Common Errors

| Error                              | Nguyên nhân                    | Giải pháp                     |
| ---------------------------------- | ------------------------------ | ----------------------------- |
| `Record with code already exists`  | recordCode bị trùng khi upload | Đổi recordCode khác           |
| `Cannot modify a finalized record` | Cố gắng modify record đã FINAL | Không thể sửa, tạo record mới |
| `File is required`                 | Thiếu file trong request       | Upload file kèm theo          |
| `Invalid file type`                | File không được hỗ trợ         | Kiểm tra MIME type            |

## 📝 Notes

### Điểm khác biệt giữa Upload và Modify

| Feature    | POST /upload   | POST /:id/modify             |
| ---------- | -------------- | ---------------------------- |
| Mục đích   | Tạo record MỚI | Tạo version MỚI              |
| Version    | Luôn là v1     | Auto-increment (v2, v3, ...) |
| recordCode | Required       | Không cần (dùng id)          |
| Status     | DRAFT          | MODIFIED                     |

### Best Practices

1. **Đặt tên recordCode:** Sử dụng format có ý nghĩa (VD: `SAMSUNG-S26-20240115-001`)
2. **Version control:** Không xóa file versions cũ, giữ để audit trail
3. **Finalize:** Chỉ finalize khi chắc chắn không cần sửa
4. **Backup:** Định kỳ backup cả database và thư mục `storage/`

## 📖 Tài liệu tham khảo / References

- [NestJS Documentation](https://docs.nestjs.com)
- [TypeORM Documentation](https://typeorm.io)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## 👨‍💻 Developer Notes

### Development Mode

```bash
npm run start:dev  # Hot reload
```

### Production Build

```bash
npm run build
npm run start:prod
```

### Database Migration (if needed)

```bash
# Generate migration
npm run typeorm migration:generate -- -n MigrationName

# Run migration
npm run typeorm migration:run
```

## 📞 Support

Mọi thắc mắc vui lòng tham khảo:

- Swagger UI: `/api` endpoint
- Test guides: `TEST_GUIDE.md`, `SWAGGER_TEST_GUIDE.md`
- Code documentation trong source files

---

**Version:** 1.0.0  
**Last Updated:** January 2024  
**Author:** Backend Developer Test Assignment
