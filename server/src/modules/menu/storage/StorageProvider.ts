export interface StoredImageResult {
  full: string;
  thumbnail: string;
}

export interface StorageProvider {
  saveImage(fullBuffer: Buffer, thumbBuffer: Buffer, baseName: string): Promise<StoredImageResult>;
  deleteImage(image: StoredImageResult): Promise<void>;
}
