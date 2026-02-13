import { showToast, Toast, getSelectedFinderItems, showHUD, getPreferenceValues } from "@raycast/api";
import { processBatch, generateBatchSummary } from "./utils/batch-processor";
import { ProcessingOptions, IMAGE_PRESETS, CompressionMode } from "./utils/types";

interface Preferences {
  compressionMode?: string;
  outputFolderName?: string;
  pdfQuality?: string;
  imageQuality?: string;
}

export default async function Command() {
  try {
    // Show initial loading toast
    await showToast({
      style: Toast.Style.Animated,
      title: "Compressing files...",
      message: "Getting selected files",
    });

    // Get selected files from Finder/Explorer
    const selectedFiles = await getSelectedFinderItems();

    if (selectedFiles.length === 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No files selected",
        message: "Please select one or more files to compress",
      });
      return;
    }

    const filePaths = selectedFiles.map((file) => file.path);
    const preferences = getPreferenceValues<Preferences>();
    const compressionMode = (preferences.compressionMode as CompressionMode) || CompressionMode.MaxOptimize;

    // Determine processing options based on compression mode
    let options: ProcessingOptions;

    switch (compressionMode) {
      case CompressionMode.Original:
        // Compress only - no resizing
        options = {
          compress: true,
          resize: false,
          compressionMode,
        };
        break;

      case CompressionMode.MaxOptimize:
        // Resize to 2K/1440p and compress
        options = {
          compress: true,
          resize: true,
          compressionMode,
          // Preset will be determined per-file based on type
          resizePreset: IMAGE_PRESETS.find((p) => p.name === "2K")!,
        };
        break;

      case CompressionMode.MinimumOptimize:
        // Resize to 1280px/720p and compress
        options = {
          compress: true,
          resize: true,
          compressionMode,
          resizePreset: IMAGE_PRESETS.find((p) => p.name === "Medium")!,
        };
        break;

      default:
        // Default to Max Optimize
        options = {
          compress: true,
          resize: true,
          compressionMode: CompressionMode.MaxOptimize,
          resizePreset: IMAGE_PRESETS.find((p) => p.name === "2K")!,
        };
    }

    // Process all files
    const result = await processBatch(filePaths, options);

    // Show summary
    const modeName =
      compressionMode === CompressionMode.Original
        ? "Optimized"
        : compressionMode === CompressionMode.MaxOptimize
          ? "Optimized (Max)"
          : "Optimized (Min)";

    const summary = generateBatchSummary(result, modeName);
    await showHUD(summary);

    // If there were errors, show them in a toast
    if (result.errors.length > 0 && result.errors.length < result.totalFiles) {
      const errorList = result.errors.map((e) => `${e.file}: ${e.error}`).join("\n");
      await showToast({
        style: Toast.Style.Failure,
        title: "Some files failed",
        message: errorList.substring(0, 200),
      });
    }
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Error",
      message: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}
