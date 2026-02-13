import { fileTypeFromFile } from "file-type";
import path from "path";
import fs from "fs";
import { ProcessingResult, ProcessingOptions, ProgressCallback } from "./types";
import { compressImage, compressVideo } from "./compression";
import { compressPDF, PDFQualityPreset } from "./pdf-compression";
import { resizeImage, resizeVideo } from "./resize";

export type FileCategory = "image" | "video" | "pdf" | "unsupported";

/**
 * Detect file category based on MIME type
 */
export async function detectFileCategory(filePath: string): Promise<{
  category: FileCategory;
  mime?: string;
}> {
  try {
    const fileType = await fileTypeFromFile(filePath);

    if (!fileType) {
      // Check if it's a PDF by extension (file-type might not detect all PDFs)
      const ext = path.extname(filePath).toLowerCase();
      if (ext === ".pdf") {
        return { category: "pdf", mime: "application/pdf" };
      }
      return { category: "unsupported" };
    }

    const { mime } = fileType;

    if (mime.startsWith("image/")) {
      return { category: "image", mime };
    } else if (mime.startsWith("video/")) {
      return { category: "video", mime };
    } else if (mime === "application/pdf") {
      return { category: "pdf", mime };
    }

    return { category: "unsupported", mime };
  } catch {
    return { category: "unsupported" };
  }
}

/**
 * Route file to appropriate compression function based on file type
 */
export async function routeFileCompression(
  filePath: string,
  options: ProcessingOptions,
  pdfQuality: PDFQualityPreset = "medium",
  progressCallback?: ProgressCallback,
): Promise<ProcessingResult> {
  const fileName = path.basename(filePath);
  const { category, mime } = await detectFileCategory(filePath);

  if (category === "unsupported") {
    return {
      success: false,
      error: `Unsupported file type${mime ? `: ${mime}` : ""}. Only images, videos, and PDFs are supported.`,
      fileName,
    };
  }

  try {
    let result: ProcessingResult;

    switch (category) {
      case "image":
        result = await processImage(filePath, options, progressCallback);
        result.fileType = "image";
        break;

      case "video":
        result = await processVideo(filePath, options, progressCallback);
        result.fileType = "video";
        break;

      case "pdf":
        result = await processPDF(filePath, pdfQuality, progressCallback);
        result.fileType = "pdf";
        break;

      default:
        return {
          success: false,
          error: "Unknown file category",
          fileName,
        };
    }

    result.fileName = fileName;
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during file processing",
      fileName,
    };
  }
}

/**
 * Process image file based on options
 */
async function processImage(
  filePath: string,
  options: ProcessingOptions,
  progressCallback?: ProgressCallback,
): Promise<ProcessingResult> {
  const intermediateFiles: string[] = [];

  try {
    if (options.resize && options.compress && options.resizePreset) {
      // Two-stage: resize then compress
      const resizeResult = await resizeImage(filePath, options.resizePreset, progressCallback);
      if (resizeResult.success && resizeResult.outputPath) {
        intermediateFiles.push(resizeResult.outputPath);
        const compressResult = await compressImage(resizeResult.outputPath, progressCallback);
        if (compressResult.success) {
          compressResult.originalSize = resizeResult.originalSize;
          // Clean up intermediate file
          if (fs.existsSync(resizeResult.outputPath) && resizeResult.outputPath !== compressResult.outputPath) {
            fs.unlinkSync(resizeResult.outputPath);
          }
        }
        return compressResult;
      }
      return resizeResult;
    } else if (options.resize && options.resizePreset) {
      // Resize only
      return await resizeImage(filePath, options.resizePreset, progressCallback);
    } else if (options.compress) {
      // Compress only
      return await compressImage(filePath, progressCallback);
    }

    return {
      success: false,
      error: "No processing options specified",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error processing image",
    };
  }
}

/**
 * Process video file based on options
 */
async function processVideo(
  filePath: string,
  options: ProcessingOptions,
  progressCallback?: ProgressCallback,
): Promise<ProcessingResult> {
  const intermediateFiles: string[] = [];

  try {
    if (options.resize && options.compress && options.resizePreset) {
      // Two-stage: resize then compress
      const resizeResult = await resizeVideo(filePath, options.resizePreset, progressCallback);
      if (resizeResult.success && resizeResult.outputPath) {
        intermediateFiles.push(resizeResult.outputPath);
        const compressResult = await compressVideo(resizeResult.outputPath, progressCallback);
        if (compressResult.success) {
          compressResult.originalSize = resizeResult.originalSize;
          // Clean up intermediate file
          if (fs.existsSync(resizeResult.outputPath) && resizeResult.outputPath !== compressResult.outputPath) {
            fs.unlinkSync(resizeResult.outputPath);
          }
        }
        return compressResult;
      }
      return resizeResult;
    } else if (options.resize && options.resizePreset) {
      // Resize only
      return await resizeVideo(filePath, options.resizePreset, progressCallback);
    } else if (options.compress) {
      // Compress only
      return await compressVideo(filePath, progressCallback);
    }

    return {
      success: false,
      error: "No processing options specified",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error processing video",
    };
  }
}

/**
 * Process PDF file
 */
async function processPDF(
  filePath: string,
  quality: PDFQualityPreset,
  progressCallback?: ProgressCallback,
): Promise<ProcessingResult> {
  try {
    const result = await compressPDF(filePath, quality, progressCallback);
    return {
      success: result.success,
      outputPath: result.outputPath,
      originalSize: result.originalSize,
      processedSize: result.compressedSize,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error processing PDF",
    };
  }
}
