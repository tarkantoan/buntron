// ============================================================
// Buntron - Clipboard Module
// ============================================================

import { User32 } from "../native/user32";
import { Kernel32, GHND } from "../native/kernel32";
import { CF_UNICODETEXT } from "../native/types";
import { toBuffer, ptr } from "../native/ffi-helpers";

class ClipboardModule {
  /**
   * Read text from clipboard
   */
  readText(): string {
    if (!User32.openClipboard(null)) return "";

    try {
      const hData = User32.getClipboardData(CF_UNICODETEXT);
      if (!hData) return "";

      const pData = Kernel32.globalLock(hData);
      if (!pData) return "";

      try {
        // Read wide string from pointer
        const buf = toBuffer(pData, 0, 65536);
        let end = 0;
        for (let i = 0; i < 32768; i++) {
          if (buf.readUInt16LE(i * 2) === 0) {
            end = i;
            break;
          }
        }
        return buf.toString("utf16le", 0, end * 2);
      } finally {
        Kernel32.globalUnlock(hData);
      }
    } finally {
      User32.closeClipboard();
    }
  }

  /**
   * Write text to clipboard
   */
  writeText(text: string): void {
    if (!User32.openClipboard(null)) return;

    try {
      User32.emptyClipboard();

      // Allocate global memory for the string
      const byteLen = (text.length + 1) * 2; // UTF-16 + null terminator
      const hMem = Kernel32.globalAlloc(GHND, byteLen);
      if (!hMem) return;

      const pMem = Kernel32.globalLock(hMem);
      if (!pMem) {
        Kernel32.globalFree(hMem);
        return;
      }

      // Write UTF-16LE string to memory
      const buf = Buffer.alloc(byteLen);
      for (let i = 0; i < text.length; i++) {
        buf.writeUInt16LE(text.charCodeAt(i), i * 2);
      }
      buf.writeUInt16LE(0, text.length * 2); // null terminator

      // Copy to global memory
      const dst = toBuffer(pMem, 0, byteLen);
      buf.copy(dst);

      Kernel32.globalUnlock(hMem);
      User32.setClipboardData(CF_UNICODETEXT, hMem);
    } finally {
      User32.closeClipboard();
    }
  }

  /**
   * Check if clipboard has text
   */
  has(): boolean {
    const text = this.readText();
    return text.length > 0;
  }

  /**
   * Clear clipboard
   */
  clear(): void {
    if (User32.openClipboard(null)) {
      User32.emptyClipboard();
      User32.closeClipboard();
    }
  }
}

export const clipboard = new ClipboardModule();
export default clipboard;
