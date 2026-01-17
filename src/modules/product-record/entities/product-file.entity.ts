import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { ProductRecord } from './product-record.entity';

@Entity('product_files')
// Sử dụng relation property thay vì column name trực tiếp
@Index(['record', 'version'])
@Index(['record', 'version', 'filename'], { unique: true }) // UNIQUE constraint: Không trùng filename trong cùng record + version
export class ProductFile {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => ProductRecord, (record) => record.files, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'recordId' })
    record: ProductRecord;

    @Column({ type: 'int' })
    version: number;

    @Column({ type: 'varchar', length: 255 })
    filename: string;

    @Column({ type: 'varchar', length: 500 })
    filePath: string;

    @Column({ type: 'bigint' })
    fileSize: number;

    @Column({ type: 'varchar', length: 100 })
    mimeType: string;

    /**
     * jpg, pdf, png, ...
     */
    @Column({ type: 'varchar', length: 10 })
    extension: string;

    @Column({ type: 'varchar', length: 64, nullable: true })
    fileHash: string;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ type: 'text', nullable: true })
    notes: string;
}
