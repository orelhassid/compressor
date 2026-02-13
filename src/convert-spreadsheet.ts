import { showToast, Toast, getSelectedFinderItems, showHUD, getPreferenceValues } from "@raycast/api";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

interface Preferences {
  outputFolderName?: string;
  exportCsv?: boolean;
  exportJson?: boolean;
}

export default async function Command() {
  try {
    const preferences = getPreferenceValues<Preferences>();
    const outputFolderName = preferences.outputFolderName || "Converted";
    const exportCsv = preferences.exportCsv !== false; // Default true if undefined, but schema should set default
    const exportJson = preferences.exportJson === true;

    if (!exportCsv && !exportJson) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Configuration Error",
        message: "Please enable at least one output format (CSV or JSON) in preferences.",
      });
      return;
    }

    // Show initial loading toast
    await showToast({
      style: Toast.Style.Animated,
      title: "Converting spreadsheets...",
      message: "Getting selected files",
    });

    // Get selected files
    const selectedFiles = await getSelectedFinderItems();

    if (selectedFiles.length === 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No files selected",
        message: "Please select one or more XLS/XLSX files",
      });
      return;
    }

    // Filter for spreadsheet files
    const spreadsheetFiles = selectedFiles.filter((file) => {
      const ext = path.extname(file.path).toLowerCase();
      return ext === ".xlsx" || ext === ".xls" || ext === ".xlsm" || ext === ".xlsb";
    });

    if (spreadsheetFiles.length === 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No spreadsheet files found",
        message: "Please select .xlsx, .xls, .xlsm, or .xlsb files",
      });
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const file of spreadsheetFiles) {
      try {
        await showToast({
          style: Toast.Style.Animated,
          title: "Converting...",
          message: path.basename(file.path),
        });

        const workbook = XLSX.readFile(file.path);
        const sourceDir = path.dirname(file.path);
        const fileNameNoExt = path.basename(file.path, path.extname(file.path));
        const outputDir = path.join(sourceDir, outputFolderName);

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const sheetNames = workbook.SheetNames;

        // Export CSV
        if (exportCsv) {
          if (sheetNames.length === 1) {
            // Single sheet: simple filename
            const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetNames[0]]);
            const outputPath = path.join(outputDir, `${fileNameNoExt}.csv`);
            fs.writeFileSync(outputPath, csv);
          } else {
            // Multiple sheets: append sheet name
            for (const sheetName of sheetNames) {
              const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
              // Sanitize sheet name for filename
              const safeSheetName = sheetName.replace(/[^a-z0-9]/gi, "_");
              const outputPath = path.join(outputDir, `${fileNameNoExt}_${safeSheetName}.csv`);
              fs.writeFileSync(outputPath, csv);
            }
          }
        }

        // Export JSON
        if (exportJson) {
          const result: Record<string, unknown[]> = {};
          for (const sheetName of sheetNames) {
            const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
            result[sheetName] = json;
          }
          const outputPath = path.join(outputDir, `${fileNameNoExt}.json`);
          fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        }

        successCount++;
      } catch (error) {
        console.error(`Error processing ${file.path}:`, error);
        errorCount++;
        await showToast({
          style: Toast.Style.Failure,
          title: "Error converting file",
          message: `${path.basename(file.path)}: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    const message = `Converted ${successCount} file${successCount !== 1 ? "s" : ""}${errorCount > 0 ? `, ${errorCount} failed` : ""}`;
    await showHUD(message);
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Error",
      message: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}
