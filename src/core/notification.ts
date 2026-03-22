// ============================================================
// Buntron - Notification Module
// ============================================================

import { EventEmitter } from "events";
import type { NotificationOptions } from "../native/types";

export class Notification extends EventEmitter {
  private options: NotificationOptions;
  private _shown: boolean = false;

  constructor(options: NotificationOptions) {
    super();
    this.options = options;
  }

  /**
   * Show the notification using PowerShell toast
   */
  show(): void {
    if (this._shown) return;
    this._shown = true;

    const title = this.options.title.replace(/'/g, "''");
    const body = this.options.body.replace(/'/g, "''");

    // Use PowerShell BurntToast or basic notification
    const psScript = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$template = @"
<toast>
  <visual>
    <binding template="ToastText02">
      <text id="1">${title}</text>
      <text id="2">${body}</text>
    </binding>
  </visual>
</toast>
"@
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml($template)
$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Buntron').Show($toast)
`;

    // Fire and forget
    Bun.spawn(["powershell.exe", "-NoProfile", "-Command", psScript], {
      stdout: "ignore",
      stderr: "ignore",
    });

    this.emit("show");
  }

  /**
   * Close the notification
   */
  close(): void {
    this.emit("close");
  }

  /**
   * Check if notifications are supported
   */
  static isSupported(): boolean {
    return process.platform === "win32";
  }
}

export default Notification;
