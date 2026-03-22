// ============================================================
// Buntron - kernel32.dll FFI Bindings
// ============================================================

import { FFIType } from "bun:ffi";
import { loadLibrary, toWideString } from "./ffi-helpers";

const kernel32 = loadLibrary("kernel32.dll", {
  GetModuleHandleW: {
    args: [FFIType.ptr],
    returns: FFIType.ptr,
  },
  GetLastError: {
    args: [],
    returns: FFIType.u32,
  },
  GlobalAlloc: {
    args: [FFIType.u32, FFIType.u64],
    returns: FFIType.ptr,
  },
  GlobalFree: {
    args: [FFIType.ptr],
    returns: FFIType.ptr,
  },
  GlobalLock: {
    args: [FFIType.ptr],
    returns: FFIType.ptr,
  },
  GlobalUnlock: {
    args: [FFIType.ptr],
    returns: FFIType.bool,
  },
  GetCurrentProcessId: {
    args: [],
    returns: FFIType.u32,
  },
  GetCurrentThreadId: {
    args: [],
    returns: FFIType.u32,
  },
  Sleep: {
    args: [FFIType.u32],
    returns: FFIType.void,
  },
  GetSystemPowerStatus: {
    args: [FFIType.ptr],
    returns: FFIType.bool,
  },
  CreateMutexW: {
    args: [FFIType.ptr, FFIType.bool, FFIType.ptr],
    returns: FFIType.ptr,
  },
  ReleaseMutex: {
    args: [FFIType.ptr],
    returns: FFIType.bool,
  },
  CloseHandle: {
    args: [FFIType.ptr],
    returns: FFIType.bool,
  },
  GetTempPathW: {
    args: [FFIType.u32, FFIType.ptr],
    returns: FFIType.u32,
  },
  GetEnvironmentVariableW: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.u32],
    returns: FFIType.u32,
  },
});

/** GlobalAlloc flags */
const GMEM_FIXED = 0x0000;
const GMEM_MOVEABLE = 0x0002;
const GMEM_ZEROINIT = 0x0040;
const GHND = GMEM_MOVEABLE | GMEM_ZEROINIT;

export class Kernel32 {
  /**
   * Get current module handle
   */
  static getModuleHandle(moduleName: string | null): number {
    return kernel32.symbols.GetModuleHandleW(
      moduleName ? toWideString(moduleName) : null,
    );
  }

  /**
   * Get last Win32 error code
   */
  static getLastError(): number {
    return kernel32.symbols.GetLastError();
  }

  /**
   * Allocate global memory
   */
  static globalAlloc(flags: number, size: number): number {
    return kernel32.symbols.GlobalAlloc(flags, size);
  }

  /**
   * Free global memory
   */
  static globalFree(hMem: number): number {
    return kernel32.symbols.GlobalFree(hMem);
  }

  /**
   * Lock global memory
   */
  static globalLock(hMem: number): number {
    return kernel32.symbols.GlobalLock(hMem);
  }

  /**
   * Unlock global memory
   */
  static globalUnlock(hMem: number): boolean {
    return !!kernel32.symbols.GlobalUnlock(hMem);
  }

  /**
   * Get current process ID
   */
  static getCurrentProcessId(): number {
    return kernel32.symbols.GetCurrentProcessId();
  }

  /**
   * Get current thread ID
   */
  static getCurrentThreadId(): number {
    return kernel32.symbols.GetCurrentThreadId();
  }

  /**
   * Sleep for specified milliseconds
   */
  static sleep(ms: number): void {
    kernel32.symbols.Sleep(ms);
  }

  /**
   * Get system power status (battery info)
   */
  static getSystemPowerStatus(): {
    acLineStatus: number;
    batteryFlag: number;
    batteryLifePercent: number;
    systemStatusFlag: number;
    batteryLifeTime: number;
    batteryFullLifeTime: number;
  } {
    const { ptr } = require("bun:ffi");
    const buf = Buffer.alloc(12);
    kernel32.symbols.GetSystemPowerStatus(ptr(buf));
    return {
      acLineStatus: buf.readUInt8(0),
      batteryFlag: buf.readUInt8(1),
      batteryLifePercent: buf.readUInt8(2),
      systemStatusFlag: buf.readUInt8(3),
      batteryLifeTime: buf.readUInt32LE(4),
      batteryFullLifeTime: buf.readUInt32LE(8),
    };
  }

  /**
   * Create a named mutex (for single-instance apps)
   */
  static createMutex(name: string): { handle: number; alreadyExists: boolean } {
    const handle = kernel32.symbols.CreateMutexW(
      null,
      true,
      toWideString(name),
    );
    const lastError = kernel32.symbols.GetLastError();
    return {
      handle,
      alreadyExists: lastError === 183, // ERROR_ALREADY_EXISTS
    };
  }

  /**
   * Release a mutex
   */
  static releaseMutex(handle: number): boolean {
    return !!kernel32.symbols.ReleaseMutex(handle);
  }

  /**
   * Close a handle
   */
  static closeHandle(handle: number): boolean {
    return !!kernel32.symbols.CloseHandle(handle);
  }

  /**
   * Get temp directory path
   */
  static getTempPath(): string {
    const { ptr, toBuffer } = require("bun:ffi");
    const buf = Buffer.alloc(520); // MAX_PATH * 2
    const len = kernel32.symbols.GetTempPathW(260, ptr(buf));
    return buf.toString("utf16le", 0, len * 2).replace(/\0/g, "");
  }

  /**
   * Get environment variable
   */
  static getEnvironmentVariable(name: string): string | null {
    const { ptr } = require("bun:ffi");
    const nameBuf = toWideString(name);
    const valueBuf = Buffer.alloc(65536); // 32K chars
    const len = kernel32.symbols.GetEnvironmentVariableW(
      nameBuf,
      ptr(valueBuf),
      32768,
    );
    if (len === 0) return null;
    return valueBuf.toString("utf16le", 0, len * 2);
  }
}

export { GMEM_FIXED, GMEM_MOVEABLE, GMEM_ZEROINIT, GHND };
export default Kernel32;
