import imageCompression from 'browser-image-compression';

const MAX_SIZE_MB = 4.5;
const MAX_DIMENSION = 2048;

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
}

/**
 * Validates file size and compresses images if necessary.
 * For PDFs, only performs size validation.
 */
export async function processFileForUpload(file: File): Promise<File> {
  const originalSizeMB = file.size / (1024 * 1024);

  // 1. Handle PDFs
  if (file.type === 'application/pdf') {
    if (originalSizeMB > MAX_SIZE_MB) {
      throw new Error(`הקובץ גדול מדי (${originalSizeMB.toFixed(1)}MB). המקסימום המותר הוא ${MAX_SIZE_MB}MB.`);
    }
    return file;
  }

  // 2. Handle Images
  if (file.type.startsWith('image/')) {
    const options = {
      maxSizeMB: MAX_SIZE_MB * 0.8, // Aim slightly lower than the hard limit
      maxWidthOrHeight: MAX_DIMENSION,
      useWebWorker: true,
      initialQuality: 0.8,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      const compressedSizeMB = compressedFile.size / (1024 * 1024);
      
      
      if (compressedSizeMB > MAX_SIZE_MB) {
        throw new Error(`גם לאחר דחיסה, התמונה גדולה מדי (${compressedSizeMB.toFixed(1)}MB). אנא בחר קובץ קטן יותר.`);
      }

      // Ensure the name carries over if missing
      return new File([compressedFile], file.name, {
        type: compressedFile.type,
        lastModified: Date.now(),
      });
    } catch (error) {
      console.error(`Compression failed:`, error);
      // If compression fails but original was under limit, we can try sending as is
      if (originalSizeMB <= MAX_SIZE_MB) {
        return file;
      }
      throw new Error('נכשלה דחיסת התמונה והיא חורגת מהגודל המותר.');
    }
  }

  // 3. Fallback for other types
  if (originalSizeMB > MAX_SIZE_MB) {
    throw new Error(`הקובץ גדול מדי. המקסימום המותר הוא ${MAX_SIZE_MB}MB.`);
  }
  
  return file;
}
