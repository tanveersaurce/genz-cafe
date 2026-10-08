import multer from 'multer';
import { AppError } from '../../utils/AppError';

// 5 MB max file upload size limit
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const storage = multer.memoryStorage();

export const menuUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(
        new AppError(
          `Invalid file type: ${file.mimetype}. Allowed types: image/jpeg, image/png, image/webp`,
          400
        )
      );
    }
    cb(null, true);
  },
});
