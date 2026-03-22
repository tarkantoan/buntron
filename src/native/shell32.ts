// ============================================================
// Buntron - shell32.dll FFI Bindings
// ============================================================

import { FFIType } from "bun:ffi";
import { loadLibrary, toWideString } from "./ffi-helpers";

const shell32 = loadLibrary("shell32.dll", {
  ShellExecuteW: {
    args: [
      FFIType.ptr,
      FFIType.ptr,
      FFIType.ptr,
      FFIType.ptr,
      FFIType.ptr,
      FFIType.i32,
    ],
    returns: FFIType.ptr,
  },
  Shell_NotifyIconW: {
    args: [FFIType.u32, FFIType.ptr],
    returns: FFIType.bool,
  },
  SHGetFolderPathW: {
    args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.u32, FFIType.ptr],
    returns: FFIType.i32,
  },
  ExtractIconW: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.u32],
    returns: FFIType.ptr,
  },
});

/** CSIDL folder constants */
export const CSIDL_DESKTOP = 0x0000;
export const CSIDL_PERSONAL = 0x0005; // My Documents
export const CSIDL_APPDATA = 0x001a;
export const CSIDL_LOCAL_APPDATA = 0x001c;
export const CSIDL_COMMON_APPDATA = 0x0023;
export const CSIDL_PROGRAM_FILES = 0x0026;
export const CSIDL_WINDOWS = 0x0024;

export class Shell32 {
  /**
   * Open a file, URL, or application
   */
  static shellExecute(
    hwnd: number | null,
    operation: string,
    file: string,
    parameters: string | null = null,
    directory: string | null = null,
    showCmd: number = 1,
  ): number {
    return shell32.symbols.ShellExecuteW(
      hwnd,
      toWideString(operation),
      toWideString(file),
      parameters ? toWideString(parameters) : null,
      directory ? toWideString(directory) : null,
      showCmd,
    );
  }

  /**
   * Open a URL in the default browser
   */
  static openExternal(url: string): boolean {
    const result = Shell32.shellExecute(null, "open", url);
    return result > 32;
  }

  /**
   * Open a file with its default application
   */
  static openPath(path: string): boolean {
    const result = Shell32.shellExecute(null, "open", path);
    return result > 32;
  }

  /**
   * Show a file in file explorer
   */
  static showItemInFolder(path: string): boolean {
    const result = Shell32.shellExecute(
      null,
      "open",
      "explorer.exe",
      `/select,"${path}"`,
    );
    return result > 32;
  }

  /**
   * Get special folder path
   */
  static getFolderPath(csidl: number): string {
    const { ptr } = require("bun:ffi");
    const buf = Buffer.alloc(520);
    const hr = shell32.symbols.SHGetFolderPathW(null, csidl, null, 0, ptr(buf));
    if (hr !== 0) return "";
    let end = 0;
    for (let i = 0; i < 260; i++) {
      if (buf.readUInt16LE(i * 2) === 0) {
        end = i;
        break;
      }
    }
    return buf.toString("utf16le", 0, end * 2);
  }

  /**
   * Get user's AppData path
   */
  static getAppDataPath(): string {
    return Shell32.getFolderPath(CSIDL_APPDATA);
  }

  /**
   * Get user's Documents path
   */
  static getDocumentsPath(): string {
    return Shell32.getFolderPath(CSIDL_PERSONAL);
  }

  /**
   * Get user's Desktop path
   */
  static getDesktopPath(): string {
    return Shell32.getFolderPath(CSIDL_DESKTOP);
  }

  /**
   * Extract an icon from an executable
   */
  static extractIcon(
    hInstance: number,
    path: string,
    iconIndex: number = 0,
  ): number {
    return shell32.symbols.ExtractIconW(
      hInstance,
      toWideString(path),
      iconIndex,
    );
  }
}

export default Shell32;
