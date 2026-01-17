import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    Index,
} from 'typeorm';
import { ProductRecordStatus } from '../enums/product-record-status.enum';
import { ProductFile } from './product-file.entity';

/**
 * Quản lý hồ sơ hàng
 * Hỗ trợ v: V1, V2, V3...
 * 
 * Flow:
 * 1. Tạo mới → v = 1, status = DRAFT
 * 2. Modify → v++, status = MODIFIED
 * 3. Finalize → status = FINAL (ko cho sửa)
 */
@Entity('product_records')
@Index(['shopCode', 'recordCode'])
export class ProductRecord {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100, unique: true })
    recordCode: string;

    @Column({ type: 'int', default: 1 })
    currentVersion: number;

    @Column({
        type: 'enum',
        enum: ProductRecordStatus,
        default: ProductRecordStatus.DRAFT,
    })
    status: ProductRecordStatus;

    @Column({ type: 'varchar', length: 50 })
    shopCode: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    finalizedAt: Date;

    @Column({ type: 'varchar', length: 100, nullable: true })
    finalizedBy: string;

    /**
     * Một record có nhiều v
     */
    @OneToMany(() => ProductFile, (file) => file.record, {
        cascade: true,
    })
    files: ProductFile[];
}
