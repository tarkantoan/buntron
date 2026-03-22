// ============================================================
// Buntron - gdi32.dll FFI Bindings
// ============================================================

import { FFIType } from "bun:ffi";
import { loadLibrary } from "./ffi-helpers";

const gdi32 = loadLibrary("gdi32.dll", {
  GetDeviceCaps: {
    args: [FFIType.ptr, FFIType.i32],
    returns: FFIType.i32,
  },
  CreateSolidBrush: {
    args: [FFIType.u32],
    returns: FFIType.ptr,
  },
  DeleteObject: {
    args: [FFIType.ptr],
    returns: FFIType.bool,
  },
});

/** Device caps indices */
export const LOGPIXELSX = 88;
export const LOGPIXELSY = 90;
export const DESKTOPHORZRES = 118;
export const DESKTOPVERTRES = 117;

export class Gdi32 {
  /**
   * Get device capabilities (DPI, resolution, etc.)
   */
  static getDeviceCaps(hdc: number, index: number): number {
    return gdi32.symbols.GetDeviceCaps(hdc, index);
  }

  /**
   * Create a solid color brush
   */
  static createSolidBrush(color: number): number {
    return gdi32.symbols.CreateSolidBrush(color);
  }

  /**
   * Delete a GDI object
   */
  static deleteObject(obj: number): boolean {
    return !!gdi32.symbols.DeleteObject(obj);
  }

  /**
   * Get the DPI scale factor for the screen
   */
  static getDpiScale(hdc: number): number {
    const dpi = gdi32.symbols.GetDeviceCaps(hdc, LOGPIXELSX);
    return dpi / 96;
  }
}

export default Gdi32;
