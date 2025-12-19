import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { environment } from "@raycast/api";

const execFileAsync = promisify(execFile);

export interface CompressionResult {
    success: boolean;
    outputPath?: string;
    originalSize?: number;
    compressedSize?: number;
    error?: string;
}

/**
 * Get ffmpeg path - prioritizes bundled asset
 */
function getFfmpegPath(): string {
    // Priority 1: Bundled asset (this is what Raycast bundles with the extension)
    const assetPath = path.join(environment.assetsPath, "ffmpeg.exe");
    if (fs.existsSync(assetPath)) {
        return assetPath;
    }

    // Priority 2: Try ffmpeg-static from node_modules (dev mode)
    try {
        const ffmpegStatic = require("ffmpeg-static");
        if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
            return ffmpegStatic;
        }
    } catch (e) {
        // Not available
    }

    // Priority 3: Development fallbacks
    const devPaths = [
        path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg.exe"),
        path.join(__dirname, "..", "..", "node_modules", "ffmpeg-static", "ffmpeg.exe"),
    ];

    for (const devPath of devPaths) {
        if (fs.existsSync(devPath)) {
            return devPath;
        }
    }

    // Last resort: system ffmpeg (will fail with helpful error)
    return "ffmpeg";
}

/**
 * Compress an image using ffmpeg
 * Converts to WebP format with optimized settings inspired by Squoosh
 */
export async function compressImage(inputPath: string): Promise<CompressionResult> {
    try {
        const stats = fs.statSync(inputPath);
        const originalSize = stats.size;

        const ext = path.extname(inputPath).toLowerCase();
        const dir = path.dirname(inputPath);
        const basename = path.basename(inputPath, ext);
        const outputPath = path.join(dir, `${basename}.min.webp`);

        const ffmpegPath = getFfmpegPath();

        // Use ffmpeg to convert to WebP with high quality settings
        const { stderr } = await execFileAsync(
            ffmpegPath,
            [
                "-i",
                inputPath,
                "-c:v",
                "libwebp",
                "-quality",
                "80",
                "-compression_level",
                "6",
                "-y", // Overwrite output file
                outputPath,
            ],
            {
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer
                windowsHide: true,
            }
        );

        if (!fs.existsSync(outputPath)) {
            throw new Error(`Output file not created. FFmpeg stderr: ${stderr}`);
        }

        const compressedStats = fs.statSync(outputPath);
        const compressedSize = compressedStats.size;

        return {
            success: true,
            outputPath,
            originalSize,
            compressedSize,
        };
    } catch (error) {
        let errorMessage = error instanceof Error ? error.message : "Unknown error during image compression";

        // Add helpful debugging info
        if (errorMessage.includes("spawn") || errorMessage.includes("ENOENT")) {
            const ffmpegPath = getFfmpegPath();
            const assetPath = path.join(environment.assetsPath, "ffmpeg.exe");
            errorMessage = `FFmpeg not found. Tried: ${ffmpegPath}. Asset path: ${assetPath}. Error: ${errorMessage}`;
        }

        return {
            success: false,
            error: errorMessage,
        };
    }
}

/**
 * Compress a video using ffmpeg
 * Uses H.264 codec with CRF for web-optimized output
 */
export async function compressVideo(inputPath: string): Promise<CompressionResult> {
    try {
        const stats = fs.statSync(inputPath);
        const originalSize = stats.size;

        const ext = path.extname(inputPath).toLowerCase();
        const dir = path.dirname(inputPath);
        const basename = path.basename(inputPath, ext);
        const outputPath = path.join(dir, `${basename}.min.mp4`);

        const ffmpegPath = getFfmpegPath();

        // Use ffmpeg with web-optimized settings
        const { stderr } = await execFileAsync(
            ffmpegPath,
            [
                "-i",
                inputPath,
                "-c:v",
                "libx264",
                "-crf",
                "23",
                "-preset",
                "medium",
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                "-movflags",
                "+faststart",
                "-y", // Overwrite output file
                outputPath,
            ],
            {
                maxBuffer: 50 * 1024 * 1024, // 50MB buffer for video
                windowsHide: true,
            }
        );

        if (!fs.existsSync(outputPath)) {
            throw new Error(`Output file not created. FFmpeg stderr: ${stderr}`);
        }

        const compressedStats = fs.statSync(outputPath);
        const compressedSize = compressedStats.size;

        return {
            success: true,
            outputPath,
            originalSize,
            compressedSize,
        };
    } catch (error) {
        let errorMessage = error instanceof Error ? error.message : "Unknown error during video compression";

        // Add helpful debugging info
        if (errorMessage.includes("spawn") || errorMessage.includes("ENOENT")) {
            const ffmpegPath = getFfmpegPath();
            const assetPath = path.join(environment.assetsPath, "ffmpeg.exe");
            errorMessage = `FFmpeg not found. Tried: ${ffmpegPath}. Asset path: ${assetPath}. Error: ${errorMessage}`;
        }

        return {
            success: false,
            error: errorMessage,
        };
    }
}
