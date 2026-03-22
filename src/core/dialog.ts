// ============================================================
// Buntron - Dialog Module
// ============================================================

import { User32 } from "../native/user32";
import {
  MB_OK,
  MB_OKCANCEL,
  MB_YESNO,
  MB_YESNOCANCEL,
  MB_ICONERROR,
  MB_ICONQUESTION,
  MB_ICONWARNING,
  MB_ICONINFORMATION,
  IDOK,
  IDCANCEL,
  IDYES,
  IDNO,
} from "../native/types";
import type { DialogOptions, FileDialogOptions } from "../native/types";
import { BuntronApp } from "./app";

class DialogModule {
  /**
   * Show a message box dialog
   */
  async showMessageBox(
    options: DialogOptions,
  ): Promise<{ response: number; checkboxChecked: boolean }> {
    let flags = MB_OK;

    // Map buttons
    const buttons = options.buttons || ["OK"];
    if (buttons.length === 1) flags = MB_OK;
    else if (buttons.length === 2) {
      if (buttons.includes("Yes") && buttons.includes("No")) flags = MB_YESNO;
      else flags = MB_OKCANCEL;
    } else if (buttons.length === 3) flags = MB_YESNOCANCEL;

    // Map icon type
    switch (options.type) {
      case "error":
        flags |= MB_ICONERROR;
        break;
      case "question":
        flags |= MB_ICONQUESTION;
        break;
      case "warning":
        flags |= MB_ICONWARNING;
        break;
      case "info":
        flags |= MB_ICONINFORMATION;
        break;
    }

    const text = [options.message || "", options.detail || ""]
      .filter(Boolean)
      .join("\n\n");
    const result = User32.messageBox(
      null,
      text,
      options.title || "Buntron",
      flags,
    );

    // Map result back to button index
    let response = 0;
    switch (result) {
      case IDOK:
        response = 0;
        break;
      case IDCANCEL:
        response = options.cancelId ?? 1;
        break;
      case IDYES:
        response = 0;
        break;
      case IDNO:
        response = 1;
        break;
    }

    return { response, checkboxChecked: false };
  }

  /**
   * Show an error dialog
   */
  showErrorBox(title: string, content: string): void {
    User32.messageBox(null, content, title, MB_OK | MB_ICONERROR);
  }

  /**
   * Show open file dialog (via host process)
   */
  async showOpenDialog(
    options: FileDialogOptions = {},
  ): Promise<{ canceled: boolean; filePaths: string[] }> {
    // Use PowerShell for file dialog (more reliable than FFI for common dialogs)
    const multiSelect =
      options.properties?.includes("multiSelections") ?? false;
    const openDir = options.properties?.includes("openDirectory") ?? false;

    let psScript: string;
    if (openDir) {
      psScript = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '${(options.title || "Select Folder").replace(/'/g, "''")}'
$result = $dialog.ShowDialog()
if ($result -eq 'OK') { $dialog.SelectedPath } else { '' }
`;
    } else {
      const filter =
        options.filters
          ?.map(
            (f) => `${f.name}|${f.extensions.map((e) => `*.${e}`).join(";")}`,
          )
          .join("|") || "All Files|*.*";

      psScript = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = '${(options.title || "Open File").replace(/'/g, "''")}'
$dialog.Filter = '${filter.replace(/'/g, "''")}'
$dialog.Multiselect = $${multiSelect}
${options.defaultPath ? `$dialog.InitialDirectory = '${options.defaultPath.replace(/'/g, "''")}'` : ""}
$result = $dialog.ShowDialog()
if ($result -eq 'OK') { $dialog.FileNames -join '|' } else { '' }
`;
    }

    const proc = Bun.spawnSync([
      "powershell.exe",
      "-NoProfile",
      "-Command",
      psScript,
    ]);
    const output = proc.stdout.toString().trim();

    if (!output) {
      return { canceled: true, filePaths: [] };
    }

    return { canceled: false, filePaths: output.split("|") };
  }

  /**
   * Show save file dialog
   */
  async showSaveDialog(
    options: FileDialogOptions = {},
  ): Promise<{ canceled: boolean; filePath: string }> {
    const filter =
      options.filters
        ?.map((f) => `${f.name}|${f.extensions.map((e) => `*.${e}`).join(";")}`)
        .join("|") || "All Files|*.*";

    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.SaveFileDialog
$dialog.Title = '${(options.title || "Save File").replace(/'/g, "''")}'
$dialog.Filter = '${filter.replace(/'/g, "''")}'
${options.defaultPath ? `$dialog.InitialDirectory = '${options.defaultPath.replace(/'/g, "''")}'` : ""}
$result = $dialog.ShowDialog()
if ($result -eq 'OK') { $dialog.FileName } else { '' }
`;

    const proc = Bun.spawnSync([
      "powershell.exe",
      "-NoProfile",
      "-Command",
      psScript,
    ]);
    const output = proc.stdout.toString().trim();

    if (!output) {
      return { canceled: true, filePath: "" };
    }

    return { canceled: false, filePath: output };
  }
}

export const dialog = new DialogModule();
export default dialog;
