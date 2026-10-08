import fs from 'fs/promises';
import path from 'path';
import { StorageProvider, StoredImageResult } from './StorageProvider';
import { logger } from '../../../utils/logger';

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;
  private urlPrefix: string;

  constructor(
    baseDir = path.resolve(process.cwd(), 'uploads/menu'),
    urlPrefix = '/uploads/menu'
  ) {
    this.baseDir = baseDir;
    this.urlPrefix = urlPrefix;
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (err) {
      logger.error({ err }, 'Failed to ensure upload directory');
    }
  }

  async saveImage(
    fullBuffer: Buffer,
    thumbBuffer: Buffer,
    baseName: string
  ): Promise<StoredImageResult> {
    await this.ensureDir();

    const timestamp = Date.now();
    const cleanBase = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fullFileName = `${cleanBase}_${timestamp}_full.webp`;
    const thumbFileName = `${cleanBase}_${timestamp}_thumb.webp`;

    const fullFilePath = path.join(this.baseDir, fullFileName);
    const thumbFilePath = path.join(this.baseDir, thumbFileName);

    await Promise.all([
      fs.writeFile(fullFilePath, fullBuffer),
      fs.writeFile(thumbFilePath, thumbBuffer),
    ]);

    return {
      full: `${this.urlPrefix}/${fullFileName}`,
      thumbnail: `${this.urlPrefix}/${thumbFileName}`,
    };
  }

  async deleteImage(image: StoredImageResult): Promise<void> {
    const removeFile = async (urlPath: string) => {
      try {
        const fileName = path.basename(urlPath);
        const filePath = path.join(this.baseDir, fileName);
        await fs.unlink(filePath);
      } catch (err: unknown) {
        // Ignore if file doesn't exist
        const nodeError = err as NodeJS.ErrnoException;
        if (nodeError.code !== 'ENOENT') {
          logger.warn({ err }, 'Failed to delete menu image file');
        }
      }
    };

    await Promise.all([
      image.full ? removeFile(image.full) : Promise.resolve(),
      image.thumbnail ? removeFile(image.thumbnail) : Promise.resolve(),
    ]);
  }
}

export const defaultStorageProvider = new LocalStorageProvider();
