// ============================================================
// Buntron - FFI Helper Utilities
// ============================================================

import { dlopen, FFIType, suffix, ptr, toBuffer, CString } from "bun:ffi";

export type FFILib = ReturnType<typeof dlopen>;

const loadedLibs = new Map<string, FFILib>();

/**
 * Load a DLL and cache it
 */
export function loadLibrary(
  name: string,
  symbols: Record<string, any>,
): FFILib {
  const key = name.toLowerCase();
  if (loadedLibs.has(key)) {
    return loadedLibs.get(key)!;
  }
  try {
    const lib = dlopen(name, symbols);
    loadedLibs.set(key, lib);
    return lib;
  } catch (err) {
    throw new Error(
      `[Buntron] Failed to load ${name}: ${(err as Error).message}`,
    );
  }
}

/**
 * Encode a string as a null-terminated UTF-16LE buffer (LPCWSTR)
 */
export function toWideString(str: string): Buffer {
  const buf = Buffer.alloc((str.length + 1) * 2);
  for (let i = 0; i < str.length; i++) {
    buf.writeUInt16LE(str.charCodeAt(i), i * 2);
  }
  buf.writeUInt16LE(0, str.length * 2);
  return buf;
}

/**
 * Decode a UTF-16LE buffer to a JavaScript string
 */
export function fromWideString(pointer: number, maxLen: number = 512): string {
  if (!pointer) return "";
  const buf = toBuffer(pointer, 0, maxLen * 2);
  let end = 0;
  for (let i = 0; i < maxLen; i++) {
    if (buf.readUInt16LE(i * 2) === 0) {
      end = i;
      break;
    }
  }
  return buf.toString("utf16le", 0, end * 2);
}

/**
 * Allocate a zeroed buffer and return its pointer
 */
export function allocStruct(size: number): { buffer: Buffer; pointer: number } {
  const buffer = Buffer.alloc(size);
  return { buffer, pointer: ptr(buffer) };
}

/**
 * Convert COLORREF (0x00BBGGRR) from hex string (#RRGGBB)
 */
export function hexToColorRef(hex: string): number {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return (b << 16) | (g << 8) | r;
}

/**
 * Check if running on 64-bit
 */
export function is64Bit(): boolean {
  return process.arch === "x64";
}

/**
 * Get system directory path
 */
export function getSystemDir(): string {
  return is64Bit() ? "C:\\Windows\\System32" : "C:\\Windows\\SysWOW64";
}

/**
 * Create pointer-sized buffer
 */
export function ptrSize(): number {
  return is64Bit() ? 8 : 4;
}

/**
 * Write pointer to buffer at offset
 */
export function writePtr(buf: Buffer, offset: number, value: number): void {
  if (is64Bit()) {
    buf.writeBigInt64LE(BigInt(value), offset);
  } else {
    buf.writeInt32LE(value, offset);
  }
}

/**
 * Read pointer from buffer at offset
 */
export function readPtr(buf: Buffer, offset: number): number {
  if (is64Bit()) {
    return Number(buf.readBigInt64LE(offset));
  } else {
    return buf.readInt32LE(offset);
  }
}

export { FFIType, ptr, toBuffer, CString };
