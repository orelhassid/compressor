import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { environment } from "@raycast/api";

const execFileAsync = promisify(execFile);

// Cache for Ghostscript path to avoid multiple lookups
let cachedGhostscriptPath: string | null = null;

export interface PDFCompressionResult {
  success: boolean;
  outputPath?: string;
  originalSize?: number;
  compressedSize?: number;
  error?: string;
}

export type PDFQualityPreset = "high" | "medium" | "low";

/**
 * Get Ghostscript path - checks system locations
 * Uses caching to avoid repeated lookups
 */
export function getGhostscriptPath(): string {
  // Return cached path if available
  if (cachedGhostscriptPath !== null && fs.existsSync(cachedGhostscriptPath)) {
    return cachedGhostscriptPath;
  }

  const isWindows = process.platform === "win32";
  const exeName = isWindows ? "gswin64c.exe" : "gs";

  let foundPath = "";

  // Priority 1: Check common system locations
  if (isWindows) {
    // Windows common installation paths
    const windowsPaths = [
      "C:\\Program Files\\gs\\gs10.04.0\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs10.03.1\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs10.03.0\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs10.02.1\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs10.02.0\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs10.01.2\\bin\\gswin64c.exe",
      "C:\\Program Files (x86)\\gs\\gs10.04.0\\bin\\gswin64c.exe",
      "C:\\Program Files (x86)\\gs\\gs10.03.1\\bin\\gswin64c.exe",
      "C:\\Program Files (x86)\\gs\\gs10.03.0\\bin\\gswin64c.exe",
    ];

    // Also check for any gs installation in Program Files
    try {
      const programFiles = ["C:\\Program Files\\gs", "C:\\Program Files (x86)\\gs"];
      for (const baseDir of programFiles) {
        if (fs.existsSync(baseDir)) {
          const versions = fs.readdirSync(baseDir);
          for (const version of versions) {
            const gsPath = path.join(baseDir, version, "bin", "gswin64c.exe");
            if (fs.existsSync(gsPath)) {
              windowsPaths.unshift(gsPath); // Add to front (higher priority)
            }
          }
        }
      }
    } catch {
      // Ignore errors in directory scanning
    }

    for (const winPath of windowsPaths) {
      if (fs.existsSync(winPath)) {
        foundPath = winPath;
        break;
      }
    }
  } else {
    // macOS/Linux common locations
    const unixPaths = [
      "/opt/homebrew/bin/gs", // macOS Homebrew (Apple Silicon)
      "/usr/local/bin/gs", // macOS Homebrew (Intel)
      "/usr/bin/gs", // Linux standard
      "/opt/local/bin/gs", // MacPorts
    ];

    for (const unixPath of unixPaths) {
      if (fs.existsSync(unixPath)) {
        foundPath = unixPath;
        break;
      }
    }
  }

  // Priority 2: Bundled asset (if we decide to bundle it)
  if (!foundPath) {
    const assetPath = path.join(environment.assetsPath, exeName);
    if (fs.existsSync(assetPath)) {
      foundPath = assetPath;
    }
  }

  // Final fallback: just "gs" (will try PATH)
  if (!foundPath) {
    foundPath = exeName;
  }

  // Cache the found path
  cachedGhostscriptPath = foundPath;
  return foundPath;
}

/**
 * Get Ghostscript settings based on quality preset
 */
function getGhostscriptSettings(quality: PDFQualityPreset): {
  preset: string;
  dpi: number;
  description: string;
} {
  switch (quality) {
    case "high":
      return {
        preset: "/prepress",
        dpi: 300,
        description: "High Quality (300 DPI, print-ready)",
      };
    case "medium":
      return {
        preset: "/ebook",
        dpi: 150,
        description: "Medium Quality (150 DPI, web/email)",
      };
    case "low":
      return {
        preset: "/screen",
        dpi: 72,
        description: "Low Quality (72 DPI, maximum compression)",
      };
    default:
      return {
        preset: "/ebook",
        dpi: 150,
        description: "Medium Quality (150 DPI, web/email)",
      };
  }
}

/**
 * Compress a PDF using Ghostscript
 * Optimizes PDF size while maintaining quality based on preset
 */
export async function compressPDF(
  inputPath: string,
  quality: PDFQualityPreset = "medium",
  progressCallback?: (stage: string, percentage: number, message?: string) => void,
): Promise<PDFCompressionResult> {
  try {
    progressCallback?.("Analyzing", 10, "Reading PDF metadata");

    const stats = fs.statSync(inputPath);
    const originalSize = stats.size;

    const ext = path.extname(inputPath).toLowerCase();
    const dir = path.dirname(inputPath);
    const basename = path.basename(inputPath, ext);
    const outputPath = path.join(dir, `${basename}.min.pdf`);

    const gsPath = getGhostscriptPath();
    const settings = getGhostscriptSettings(quality);

    progressCallback?.("Compressing", 40, `Optimizing with ${settings.description}`);

    // Ghostscript command for PDF compression
    const args = [
      "-sDEVICE=pdfwrite",
      `-dPDFSETTINGS=${settings.preset}`,
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      "-dCompatibilityLevel=1.4",
      `-dColorImageResolution=${settings.dpi}`,
      `-dGrayImageResolution=${settings.dpi}`,
      `-dMonoImageResolution=${settings.dpi}`,
      "-dColorImageDownsampleType=/Bicubic",
      "-dGrayImageDownsampleType=/Bicubic",
      "-dMonoImageDownsampleType=/Bicubic",
      "-dCompressFonts=true",
      "-dDetectDuplicateImages=true",
      "-dDownsampleColorImages=true",
      "-dDownsampleGrayImages=true",
      "-dDownsampleMonoImages=true",
      `-sOutputFile=${outputPath}`,
      inputPath,
    ];

    const { stderr } = await execFileAsync(gsPath, args, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large PDFs
      windowsHide: process.platform === "win32",
    });

    progressCallback?.("Finalizing", 90, "Saving compressed PDF");

    if (!fs.existsSync(outputPath)) {
      throw new Error(`Output file not created. Ghostscript stderr: ${stderr}`);
    }

    const compressedStats = fs.statSync(outputPath);
    const compressedSize = compressedStats.size;

    // If compressed file is larger than original, use original
    if (compressedSize >= originalSize) {
      fs.unlinkSync(outputPath);
      progressCallback?.("Finalizing", 100, "Original file is already optimized");
      return {
        success: true,
        outputPath: inputPath,
        originalSize,
        compressedSize: originalSize,
      };
    }

    progressCallback?.("Finalizing", 100, "Complete");

    return {
      success: true,
      outputPath,
      originalSize,
      compressedSize,
    };
  } catch (error) {
    let errorMessage = error instanceof Error ? error.message : "Unknown error during PDF compression";

    // Add helpful debugging info
    if (errorMessage.includes("spawn") || errorMessage.includes("ENOENT")) {
      const gsPath = getGhostscriptPath();
      errorMessage = `Ghostscript not found. Tried: ${gsPath}. Please install Ghostscript from https://ghostscript.com/releases/gsdnld.html (Windows) or via 'brew install ghostscript' (macOS). Error: ${errorMessage}`;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}
