// ============================================================
// Buntron - Win32 Type Definitions
// ============================================================

/** Win32 handle types */
export type HWND = number;
export type HINSTANCE = number;
export type HICON = number;
export type HCURSOR = number;
export type HBRUSH = number;
export type HMENU = number;
export type HDC = number;
export type HFONT = number;
export type HBITMAP = number;
export type HMODULE = number;
export type HANDLE = number;
export type DWORD = number;
export type WORD = number;
export type BOOL = number;
export type UINT = number;
export type LONG = number;
export type LPARAM = number;
export type WPARAM = number;
export type LRESULT = number;

/** Common Win32 constants */
export const WM_DESTROY = 0x0002;
export const WM_CLOSE = 0x0010;
export const WM_QUIT = 0x0012;
export const WM_SIZE = 0x0005;
export const WM_MOVE = 0x0003;
export const WM_SETFOCUS = 0x0007;
export const WM_KILLFOCUS = 0x0008;
export const WM_COMMAND = 0x0111;
export const WM_SYSCOMMAND = 0x0112;
export const WM_HOTKEY = 0x0312;
export const WM_USER = 0x0400;
export const WM_APP = 0x8000;
export const WM_COPYDATA = 0x004a;
export const WM_TRAYICON = WM_APP + 1;

/** Window Styles */
export const WS_OVERLAPPED = 0x00000000;
export const WS_POPUP = 0x80000000;
export const WS_CHILD = 0x40000000;
export const WS_MINIMIZE = 0x20000000;
export const WS_VISIBLE = 0x10000000;
export const WS_DISABLED = 0x08000000;
export const WS_MAXIMIZE = 0x01000000;
export const WS_CAPTION = 0x00c00000;
export const WS_BORDER = 0x00800000;
export const WS_SYSMENU = 0x00080000;
export const WS_THICKFRAME = 0x00040000;
export const WS_MINIMIZEBOX = 0x00020000;
export const WS_MAXIMIZEBOX = 0x00010000;
export const WS_OVERLAPPEDWINDOW =
  WS_OVERLAPPED |
  WS_CAPTION |
  WS_SYSMENU |
  WS_THICKFRAME |
  WS_MINIMIZEBOX |
  WS_MAXIMIZEBOX;

/** Extended Window Styles */
export const WS_EX_TOPMOST = 0x00000008;
export const WS_EX_TOOLWINDOW = 0x00000080;
export const WS_EX_APPWINDOW = 0x00040000;
export const WS_EX_LAYERED = 0x00080000;
export const WS_EX_TRANSPARENT = 0x00000020;
export const WS_EX_COMPOSITED = 0x02000000;

/** ShowWindow commands */
export const SW_HIDE = 0;
export const SW_SHOWNORMAL = 1;
export const SW_SHOWMINIMIZED = 2;
export const SW_SHOWMAXIMIZED = 3;
export const SW_SHOW = 5;
export const SW_MINIMIZE = 6;
export const SW_RESTORE = 9;

/** System metrics */
export const SM_CXSCREEN = 0;
export const SM_CYSCREEN = 1;
export const SM_CXFULLSCREEN = 16;
export const SM_CYFULLSCREEN = 17;

/** MessageBox flags */
export const MB_OK = 0x00000000;
export const MB_OKCANCEL = 0x00000001;
export const MB_ABORTRETRYIGNORE = 0x00000002;
export const MB_YESNOCANCEL = 0x00000003;
export const MB_YESNO = 0x00000004;
export const MB_RETRYCANCEL = 0x00000005;
export const MB_ICONERROR = 0x00000010;
export const MB_ICONQUESTION = 0x00000020;
export const MB_ICONWARNING = 0x00000030;
export const MB_ICONINFORMATION = 0x00000040;

/** Dialog return values */
export const IDOK = 1;
export const IDCANCEL = 2;
export const IDABORT = 3;
export const IDRETRY = 4;
export const IDIGNORE = 5;
export const IDYES = 6;
export const IDNO = 7;

/** Open/Save file dialog flags */
export const OFN_READONLY = 0x00000001;
export const OFN_OVERWRITEPROMPT = 0x00000002;
export const OFN_HIDEREADONLY = 0x00000004;
export const OFN_NOCHANGEDIR = 0x00000008;
export const OFN_ALLOWMULTISELECT = 0x00000200;
export const OFN_PATHMUSTEXIST = 0x00000800;
export const OFN_FILEMUSTEXIST = 0x00001000;
export const OFN_CREATEPROMPT = 0x00002000;
export const OFN_EXPLORER = 0x00080000;

/** Notify icon flags */
export const NIF_MESSAGE = 0x00000001;
export const NIF_ICON = 0x00000002;
export const NIF_TIP = 0x00000004;
export const NIF_INFO = 0x00000010;
export const NIM_ADD = 0x00000000;
export const NIM_MODIFY = 0x00000001;
export const NIM_DELETE = 0x00000002;

/** SetWindowPos flags */
export const SWP_NOSIZE = 0x0001;
export const SWP_NOMOVE = 0x0002;
export const SWP_NOZORDER = 0x0004;
export const SWP_NOACTIVATE = 0x0010;
export const SWP_SHOWWINDOW = 0x0040;
export const HWND_TOPMOST = -1;
export const HWND_NOTOPMOST = -2;
export const HWND_TOP = 0;

/** Clipboard formats */
export const CF_TEXT = 1;
export const CF_UNICODETEXT = 13;

/** Monitor info flags */
export const MONITOR_DEFAULTTOPRIMARY = 0x00000001;
export const MONITOR_DEFAULTTONEAREST = 0x00000002;

/** Virtual key codes */
export const VK_SHIFT = 0x10;
export const VK_CONTROL = 0x11;
export const VK_MENU = 0x12; // Alt
export const VK_ESCAPE = 0x1b;
export const VK_RETURN = 0x0d;
export const VK_TAB = 0x09;
export const VK_SPACE = 0x20;
export const VK_F1 = 0x70;
export const VK_F2 = 0x71;
export const VK_F3 = 0x72;
export const VK_F4 = 0x73;
export const VK_F5 = 0x74;
export const VK_F6 = 0x75;
export const VK_F7 = 0x76;
export const VK_F8 = 0x77;
export const VK_F9 = 0x78;
export const VK_F10 = 0x79;
export const VK_F11 = 0x7a;
export const VK_F12 = 0x7b;

/** Hotkey modifiers */
export const MOD_ALT = 0x0001;
export const MOD_CONTROL = 0x0002;
export const MOD_SHIFT = 0x0004;
export const MOD_WIN = 0x0008;
export const MOD_NOREPEAT = 0x4000;

/** GWL constants */
export const GWL_STYLE = -16;
export const GWL_EXSTYLE = -20;

/** Buntron-specific types */
export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenInfo {
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
  scaleFactor: number;
}

export interface BrowserWindowOptions {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  title?: string;
  icon?: string;
  show?: boolean;
  center?: boolean;
  resizable?: boolean;
  minimizable?: boolean;
  maximizable?: boolean;
  closable?: boolean;
  alwaysOnTop?: boolean;
  fullscreen?: boolean;
  frame?: boolean;
  transparent?: boolean;
  backgroundColor?: string;
  webPreferences?: WebPreferences;
}

export interface WebPreferences {
  preload?: string;
  nodeIntegration?: boolean;
  contextIsolation?: boolean;
  devTools?: boolean;
  javascript?: boolean;
  webSecurity?: boolean;
  zoomFactor?: number;
}

export interface DialogOptions {
  title?: string;
  message?: string;
  detail?: string;
  type?: "none" | "info" | "error" | "question" | "warning";
  buttons?: string[];
  defaultId?: number;
  cancelId?: number;
}

export interface FileDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: FileFilter[];
  properties?: Array<
    "openFile" | "openDirectory" | "multiSelections" | "createDirectory"
  >;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface TrayOptions {
  icon: string;
  tooltip?: string;
}

export interface MenuTemplate {
  label?: string;
  type?: "normal" | "separator" | "submenu" | "checkbox" | "radio";
  click?: () => void;
  enabled?: boolean;
  visible?: boolean;
  checked?: boolean;
  accelerator?: string;
  submenu?: MenuTemplate[];
  id?: string;
  role?: string;
}

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  silent?: boolean;
}

/** IPC Protocol types */
export interface IPCMessage {
  id: number;
  channel: string;
  args: any[];
  type: "send" | "invoke" | "reply" | "event";
  senderId?: number;
  error?: string;
}

/** Host protocol types */
export interface HostCommand {
  id: number;
  cmd: string;
  params: Record<string, any>;
}

export interface HostEvent {
  event: string;
  windowId?: number;
  requestId?: number;
  data?: Record<string, any>;
}

export type WindowState =
  | "normal"
  | "minimized"
  | "maximized"
  | "fullscreen"
  | "hidden";
