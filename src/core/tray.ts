// ============================================================
// Buntron - System Tray Module
// ============================================================

import { EventEmitter } from "events";
import { BuntronApp } from "./app";
import type { TrayOptions, MenuTemplate } from "../native/types";

export class Tray extends EventEmitter {
  private _tooltip: string;
  private _iconPath: string;
  private _isDestroyed: boolean = false;
  private _contextMenu: MenuTemplate[] | null = null;

  constructor(iconPath: string, tooltip?: string) {
    super();
    this._iconPath = iconPath;
    this._tooltip = tooltip || "";
    this.create();
  }

  private async create(): Promise<void> {
    const app = BuntronApp.getInstance();
    if (!app || !app.isReady) return;

    await app.host.sendCommand("trayCreate", {
      tooltip: this._tooltip,
      iconPath: this._iconPath,
    });

    // Listen for tray events from host
    app.host.on("trayClicked", (evt: any) => {
      this.emit("click", evt);
    });

    app.host.on("trayDoubleClicked", () => {
      this.emit("double-click");
    });

    app.host.on("trayMenuClicked", (evt: any) => {
      this.emit("menu-click", evt.id);
      // Find and call the menu item's click handler
      if (this._contextMenu) {
        const item = this.findMenuItem(this._contextMenu, evt.id);
        if (item?.click) item.click();
      }
    });
  }

  /**
   * Set the tray tooltip
   */
  setToolTip(tooltip: string): void {
    this._tooltip = tooltip;
    const app = BuntronApp.getInstance();
    if (app) app.host.sendCommandFire("traySetTooltip", { tooltip });
  }

  /**
   * Set the tray context menu
   */
  setContextMenu(menu: MenuTemplate[]): void {
    this._contextMenu = menu;
    const app = BuntronApp.getInstance();
    if (!app) return;

    // Convert MenuTemplate to serializable format
    const items = menu.map((item, idx) => ({
      id: item.id || `item_${idx}`,
      label: item.label || "",
      type: item.type || "normal",
      enabled: item.enabled !== false,
      checked: item.checked || false,
    }));

    app.host.sendCommandFire("traySetMenu", { items });
  }

  /**
   * Display a balloon notification from the tray
   */
  displayBalloon(options: {
    title: string;
    content: string;
    iconType?: string;
  }): void {
    const app = BuntronApp.getInstance();
    if (!app) return;
    app.host.sendCommandFire("trayBalloon", {
      title: options.title,
      body: options.content,
    });
  }

  /**
   * Get tooltip text
   */
  getToolTip(): string {
    return this._tooltip;
  }

  /**
   * Destroy the tray icon
   */
  destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    const app = BuntronApp.getInstance();
    if (app) app.host.sendCommandFire("trayDestroy");
  }

  /**
   * Check if tray is destroyed
   */
  isDestroyed(): boolean {
    return this._isDestroyed;
  }

  private findMenuItem(items: MenuTemplate[], id: string): MenuTemplate | null {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.submenu) {
        const found = this.findMenuItem(item.submenu, id);
        if (found) return found;
      }
    }
    return null;
  }
}

export default Tray;
