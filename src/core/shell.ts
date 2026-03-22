// ============================================================
// Buntron - Shell Module
// ============================================================

import { Shell32 } from "../native/shell32";

class ShellModule {
  /**
   * Open a URL in the default browser
   */
  async openExternal(url: string): Promise<void> {
    Shell32.openExternal(url);
  }

  /**
   * Open a file with its default application
   */
  async openPath(path: string): Promise<string> {
    const success = Shell32.openPath(path);
    return success ? "" : "Failed to open path";
  }

  /**
   * Show a file in its containing folder (Explorer)
   */
  showItemInFolder(fullPath: string): void {
    Shell32.showItemInFolder(fullPath);
  }

  /**
   * Play the system beep sound
   */
  beep(): void {
    Bun.spawnSync([
      "powershell.exe",
      "-NoProfile",
      "-Command",
      "[Console]::Beep()",
    ]);
  }

  /**
   * Read a shortcut's target (Windows .lnk files)
   */
  async readShortcutLink(shortcutPath: string): Promise<{ target: string }> {
    const psScript = `
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
$shortcut.TargetPath
`;
    const proc = Bun.spawnSync([
      "powershell.exe",
      "-NoProfile",
      "-Command",
      psScript,
    ]);
    return { target: proc.stdout.toString().trim() };
  }

  /**
   * Move an item to the recycle bin
   */
  async trashItem(path: string): Promise<void> {
    const psScript = `
Add-Type -AssemblyName Microsoft.VisualBasic
[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile(
  '${path.replace(/'/g, "''")}',
  'OnlyErrorDialogs',
  'SendToRecycleBin'
)
`;
    Bun.spawnSync(["powershell.exe", "-NoProfile", "-Command", psScript]);
  }
}

export const shell = new ShellModule();
export default shell;
