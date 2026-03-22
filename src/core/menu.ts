// ============================================================
// Buntron - Menu Module
// ============================================================

import type { MenuTemplate } from "../native/types";

export class Menu {
  private template: MenuTemplate[];

  constructor() {
    this.template = [];
  }

  /**
   * Build menu from template
   */
  static buildFromTemplate(template: MenuTemplate[]): Menu {
    const menu = new Menu();
    menu.template = template;
    return menu;
  }

  /**
   * Get the menu template
   */
  getTemplate(): MenuTemplate[] {
    return this.template;
  }

  /**
   * Append a menu item
   */
  append(item: MenuTemplate): void {
    this.template.push(item);
  }

  /**
   * Insert a menu item at index
   */
  insert(index: number, item: MenuTemplate): void {
    this.template.splice(index, 0, item);
  }

  /**
   * Get menu item by ID
   */
  getMenuItemById(id: string): MenuTemplate | null {
    return this.findById(this.template, id);
  }

  /**
   * Get all items
   */
  get items(): MenuTemplate[] {
    return this.template;
  }

  private findById(items: MenuTemplate[], id: string): MenuTemplate | null {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.submenu) {
        const found = this.findById(item.submenu, id);
        if (found) return found;
      }
    }
    return null;
  }
}

export class MenuItem {
  label: string;
  type: MenuTemplate["type"];
  click?: () => void;
  enabled: boolean;
  visible: boolean;
  checked: boolean;
  accelerator?: string;
  submenu?: Menu;
  id?: string;
  role?: string;

  constructor(options: MenuTemplate) {
    this.label = options.label || "";
    this.type = options.type || "normal";
    this.click = options.click;
    this.enabled = options.enabled !== false;
    this.visible = options.visible !== false;
    this.checked = options.checked || false;
    this.accelerator = options.accelerator;
    this.id = options.id;
    this.role = options.role;

    if (options.submenu) {
      this.submenu = Menu.buildFromTemplate(options.submenu);
    }
  }
}

export default Menu;
