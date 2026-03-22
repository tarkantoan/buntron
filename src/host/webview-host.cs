// ============================================================
// BuntronHost.cs - Native WebView2 Window Host
// ============================================================
// Compiled with: csc.exe /target:winexe /platform:anycpu
//   /reference:Microsoft.Web.WebView2.Core.dll
//   /reference:Microsoft.Web.WebView2.WinForms.dll
//   /reference:System.Windows.Forms.dll
//   /reference:System.Drawing.dll
//   /reference:System.Web.Extensions.dll
//   BuntronHost.cs
//
// Communication protocol: JSON over stdin/stdout
// Each message is a single line of JSON terminated by newline
// ============================================================

using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Runtime.InteropServices;

namespace Buntron
{
    // ---- JSON helpers ----
    static class Json
    {
        static readonly JavaScriptSerializer _ser = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
        public static string Serialize(object obj) { return _ser.Serialize(obj); }
        public static Dictionary<string, object> Deserialize(string json)
        { return _ser.Deserialize<Dictionary<string, object>>(json); }
    }

    // ---- Protocol ----
    static class Protocol
    {
        static readonly object _writeLock = new object();

        public static void SendEvent(string eventName, Dictionary<string, object> data = null)
        {
            var msg = new Dictionary<string, object> { { "event", eventName } };
            if (data != null)
                foreach (var kv in data)
                    msg[kv.Key] = kv.Value;
            WriteMessage(msg);
        }

        public static void SendReply(int requestId, Dictionary<string, object> data = null)
        {
            var msg = new Dictionary<string, object> { { "event", "reply" }, { "requestId", requestId } };
            if (data != null)
                foreach (var kv in data)
                    msg[kv.Key] = kv.Value;
            WriteMessage(msg);
        }

        public static void SendError(string message, int requestId = -1)
        {
            var msg = new Dictionary<string, object>
            {
                { "event", "error" },
                { "message", message }
            };
            if (requestId >= 0) msg["requestId"] = requestId;
            WriteMessage(msg);
        }

        static void WriteMessage(Dictionary<string, object> msg)
        {
            lock (_writeLock)
            {
                try
                {
                    Console.Out.WriteLine(Json.Serialize(msg));
                    Console.Out.Flush();
                }
                catch { /* ignore write errors */ }
            }
        }
    }

    // ---- Window wrapper ----
    class BuntronWindow : Form
    {
        public int WindowId { get; private set; }
        public WebView2 WebView { get; private set; }
        private bool _isReady = false;
        private Queue<Action> _pendingActions = new Queue<Action>();

        public BuntronWindow(int id, Dictionary<string, object> options)
        {
            WindowId = id;

            // Parse options
            int width = GetInt(options, "width", 800);
            int height = GetInt(options, "height", 600);
            string title = GetStr(options, "title", "Buntron");
            bool resizable = GetBool(options, "resizable", true);
            bool frame = GetBool(options, "frame", true);
            bool show = GetBool(options, "show", true);
            bool center = GetBool(options, "center", true);
            bool maximizable = GetBool(options, "maximizable", true);
            bool minimizable = GetBool(options, "minimizable", true);
            bool alwaysOnTop = GetBool(options, "alwaysOnTop", false);
            bool fullscreen = GetBool(options, "fullscreen", false);
            string bgColor = GetStr(options, "backgroundColor", "#FFFFFF");
            int x = GetInt(options, "x", -1);
            int y = GetInt(options, "y", -1);
            int minWidth = GetInt(options, "minWidth", 0);
            int minHeight = GetInt(options, "minHeight", 0);
            int maxWidth = GetInt(options, "maxWidth", 0);
            int maxHeight = GetInt(options, "maxHeight", 0);

            // Setup form
            this.Text = title;
            this.ClientSize = new Size(width, height);
            this.StartPosition = center ? FormStartPosition.CenterScreen : FormStartPosition.Manual;
            if (!center && x >= 0 && y >= 0) this.Location = new Point(x, y);
            this.MaximizeBox = maximizable;
            this.MinimizeBox = minimizable;
            this.TopMost = alwaysOnTop;

            if (!frame)
            {
                this.FormBorderStyle = FormBorderStyle.None;
            }
            else if (!resizable)
            {
                this.FormBorderStyle = FormBorderStyle.FixedSingle;
            }

            if (minWidth > 0 || minHeight > 0)
                this.MinimumSize = new Size(minWidth, minHeight);
            if (maxWidth > 0 || maxHeight > 0)
                this.MaximumSize = new Size(maxWidth, maxHeight);

            // Parse background color
            try
            {
                if (bgColor.StartsWith("#"))
                {
                    int r = Convert.ToInt32(bgColor.Substring(1, 2), 16);
                    int g = Convert.ToInt32(bgColor.Substring(3, 2), 16);
                    int b = Convert.ToInt32(bgColor.Substring(5, 2), 16);
                    this.BackColor = Color.FromArgb(r, g, b);
                }
            }
            catch { }

            // Create WebView2
            WebView = new WebView2();
            WebView.Dock = DockStyle.Fill;
            WebView.DefaultBackgroundColor = this.BackColor;
            this.Controls.Add(WebView);

            // Events
            this.FormClosing += OnFormClosing;
            this.Resize += OnResize;
            this.Move += OnMove;
            this.Activated += (s, e) => Protocol.SendEvent("windowFocused", D("windowId", WindowId));
            this.Deactivate += (s, e) => Protocol.SendEvent("windowBlurred", D("windowId", WindowId));

            if (fullscreen) this.WindowState = FormWindowState.Maximized;
            if (!show) this.Opacity = 0;

            this.Show();
            if (!show)
            {
                this.Hide();
                this.Opacity = 1;
            }
        }

        public async Task InitWebView(string url, string userDataFolder, string preloadScript = null, bool devTools = true)
        {
            try
            {
                var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
                await WebView.EnsureCoreWebView2Async(env);

                WebView.CoreWebView2.Settings.AreDevToolsEnabled = devTools;
                WebView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                WebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = devTools;
                WebView.CoreWebView2.Settings.IsZoomControlEnabled = false;

                // Inject preload script
                if (!string.IsNullOrEmpty(preloadScript))
                {
                    await WebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(preloadScript);
                }

                // Handle web message (IPC from renderer)
                WebView.CoreWebView2.WebMessageReceived += (s, e) =>
                {
                    Protocol.SendEvent("webMessage", new Dictionary<string, object>
                    {
                        { "windowId", WindowId },
                        { "message", e.WebMessageAsJson }
                    });
                };

                // Handle navigation
                WebView.CoreWebView2.NavigationCompleted += (s, e) =>
                {
                    Protocol.SendEvent("navigationCompleted", new Dictionary<string, object>
                    {
                        { "windowId", WindowId },
                        { "isSuccess", e.IsSuccess }
                    });
                };

                // Handle new window requests (open in same window or external browser)
                WebView.CoreWebView2.NewWindowRequested += (s, e) =>
                {
                    e.Handled = true;
                    Protocol.SendEvent("newWindowRequested", new Dictionary<string, object>
                    {
                        { "windowId", WindowId },
                        { "uri", e.Uri }
                    });
                };

                // Handle document title changed
                WebView.CoreWebView2.DocumentTitleChanged += (s, e) =>
                {
                    Protocol.SendEvent("titleChanged", new Dictionary<string, object>
                    {
                        { "windowId", WindowId },
                        { "title", WebView.CoreWebView2.DocumentTitle }
                    });
                };

                // Navigate
                WebView.CoreWebView2.Navigate(url);
                _isReady = true;

                // Execute pending actions
                while (_pendingActions.Count > 0)
                {
                    var action = _pendingActions.Dequeue();
                    action();
                }
            }
            catch (Exception ex)
            {
                Protocol.SendError("WebView2 init failed: " + ex.Message);
            }
        }

        public void ExecuteWhenReady(Action action)
        {
            if (_isReady) action();
            else _pendingActions.Enqueue(action);
        }

        private void OnFormClosing(object sender, FormClosingEventArgs e)
        {
            Protocol.SendEvent("windowClosed", D("windowId", WindowId));
        }

        private void OnResize(object sender, EventArgs e)
        {
            string state = "normal";
            if (this.WindowState == FormWindowState.Minimized) state = "minimized";
            else if (this.WindowState == FormWindowState.Maximized) state = "maximized";

            Protocol.SendEvent("windowResized", new Dictionary<string, object>
            {
                { "windowId", WindowId },
                { "width", this.ClientSize.Width },
                { "height", this.ClientSize.Height },
                { "state", state }
            });
        }

        private void OnMove(object sender, EventArgs e)
        {
            Protocol.SendEvent("windowMoved", new Dictionary<string, object>
            {
                { "windowId", WindowId },
                { "x", this.Location.X },
                { "y", this.Location.Y }
            });
        }

        // Helpers
        static int GetInt(Dictionary<string, object> d, string key, int def)
        {
            if (d != null && d.ContainsKey(key) && d[key] != null)
            {
                try { return Convert.ToInt32(d[key]); } catch { }
            }
            return def;
        }

        static string GetStr(Dictionary<string, object> d, string key, string def)
        {
            if (d != null && d.ContainsKey(key) && d[key] != null)
                return d[key].ToString();
            return def;
        }

        static bool GetBool(Dictionary<string, object> d, string key, bool def)
        {
            if (d != null && d.ContainsKey(key) && d[key] != null)
            {
                try { return Convert.ToBoolean(d[key]); } catch { }
            }
            return def;
        }

        static Dictionary<string, object> D(string k, object v)
        {
            return new Dictionary<string, object> { { k, v } };
        }
    }

    // ---- Tray Icon ----
    class BuntronTray : IDisposable
    {
        private NotifyIcon _icon;
        private ContextMenuStrip _menu;

        public BuntronTray(string tooltip, string iconPath = null)
        {
            _icon = new NotifyIcon();
            _icon.Text = tooltip ?? "Buntron App";
            _icon.Visible = true;

            if (!string.IsNullOrEmpty(iconPath) && File.Exists(iconPath))
                _icon.Icon = new Icon(iconPath);
            else
                _icon.Icon = SystemIcons.Application;

            _icon.MouseClick += (s, e) =>
            {
                if (e.Button == MouseButtons.Left)
                    Protocol.SendEvent("trayClicked", new Dictionary<string, object> { { "button", "left" } });
                else if (e.Button == MouseButtons.Right)
                    Protocol.SendEvent("trayClicked", new Dictionary<string, object> { { "button", "right" } });
            };

            _icon.DoubleClick += (s, e) => Protocol.SendEvent("trayDoubleClicked");
        }

        public void SetTooltip(string text) { _icon.Text = text; }
        public void SetIcon(string path)
        {
            if (File.Exists(path)) _icon.Icon = new Icon(path);
        }

        public void ShowBalloon(string title, string message, ToolTipIcon icon = ToolTipIcon.Info)
        {
            _icon.ShowBalloonTip(3000, title, message, icon);
        }

        public void SetContextMenu(List<Dictionary<string, object>> items)
        {
            _menu = new ContextMenuStrip();
            foreach (var item in items)
            {
                string label = item.ContainsKey("label") ? item["label"].ToString() : "";
                string type = item.ContainsKey("type") ? item["type"].ToString() : "normal";
                string id = item.ContainsKey("id") ? item["id"].ToString() : "";

                if (type == "separator")
                {
                    _menu.Items.Add(new ToolStripSeparator());
                }
                else
                {
                    var menuItem = new ToolStripMenuItem(label);
                    string menuId = id;
                    menuItem.Click += (s, e) =>
                    {
                        Protocol.SendEvent("trayMenuClicked", new Dictionary<string, object> { { "id", menuId } });
                    };
                    if (item.ContainsKey("enabled"))
                        menuItem.Enabled = Convert.ToBoolean(item["enabled"]);
                    if (item.ContainsKey("checked") && type == "checkbox")
                        menuItem.Checked = Convert.ToBoolean(item["checked"]);
                    _menu.Items.Add(menuItem);
                }
            }
            _icon.ContextMenuStrip = _menu;
        }

        public void Dispose()
        {
            _icon.Visible = false;
            _icon.Dispose();
            if (_menu != null) _menu.Dispose();
        }
    }

    // ---- Main Application ----
    static class Program
    {
        static Dictionary<int, BuntronWindow> _windows = new Dictionary<int, BuntronWindow>();
        static BuntronTray _tray;
        static int _nextWindowId = 1;
        static string _userDataFolder;
        static bool _running = true;
        static Form _hiddenForm; // Message pump form

        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            // Parse args
            _userDataFolder = args.Length > 0 ? args[0] : Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Buntron", "WebView2Data");

            Directory.CreateDirectory(_userDataFolder);

            // Hidden form for message pump and Invoke
            _hiddenForm = new Form
            {
                ShowInTaskbar = false,
                WindowState = FormWindowState.Minimized,
                FormBorderStyle = FormBorderStyle.None,
                Opacity = 0
            };
            _hiddenForm.Load += (s, e) =>
            {
                _hiddenForm.Visible = false;
                // Start stdin reader thread
                var thread = new Thread(StdinReader) { IsBackground = true };
                thread.Start();
                Protocol.SendEvent("ready");
            };

            Application.Run(_hiddenForm);
        }

        static void StdinReader()
        {
            try
            {
                string line;
                while (_running && (line = Console.In.ReadLine()) != null)
                {
                    if (string.IsNullOrWhiteSpace(line)) continue;
                    try
                    {
                        var cmd = Json.Deserialize(line);
                        _hiddenForm.BeginInvoke(new Action(() => ProcessCommand(cmd)));
                    }
                    catch (Exception ex)
                    {
                        Protocol.SendError("Parse error: " + ex.Message);
                    }
                }
            }
            catch { }

            // Stdin closed = parent died, exit
            _hiddenForm.BeginInvoke(new Action(() => Shutdown()));
        }

        static void ProcessCommand(Dictionary<string, object> cmd)
        {
            string command = cmd.ContainsKey("cmd") ? cmd["cmd"].ToString() : "";
            int requestId = cmd.ContainsKey("id") ? Convert.ToInt32(cmd["id"]) : -1;
            var p = cmd.ContainsKey("params") ? cmd["params"] as Dictionary<string, object> : new Dictionary<string, object>();

            try
            {
                switch (command)
                {
                    case "createWindow": CmdCreateWindow(requestId, p); break;
                    case "closeWindow": CmdCloseWindow(requestId, p); break;
                    case "destroyWindow": CmdDestroyWindow(requestId, p); break;
                    case "setTitle": CmdSetTitle(requestId, p); break;
                    case "setSize": CmdSetSize(requestId, p); break;
                    case "setPosition": CmdSetPosition(requestId, p); break;
                    case "setMinSize": CmdSetMinSize(requestId, p); break;
                    case "setMaxSize": CmdSetMaxSize(requestId, p); break;
                    case "minimize": CmdMinimize(requestId, p); break;
                    case "maximize": CmdMaximize(requestId, p); break;
                    case "restore": CmdRestore(requestId, p); break;
                    case "show": CmdShow(requestId, p); break;
                    case "hide": CmdHide(requestId, p); break;
                    case "focus": CmdFocus(requestId, p); break;
                    case "setFullscreen": CmdSetFullscreen(requestId, p); break;
                    case "setAlwaysOnTop": CmdSetAlwaysOnTop(requestId, p); break;
                    case "setResizable": CmdSetResizable(requestId, p); break;
                    case "navigate": CmdNavigate(requestId, p); break;
                    case "executeJs": CmdExecuteJs(requestId, p); break;
                    case "openDevTools": CmdOpenDevTools(requestId, p); break;
                    case "postMessage": CmdPostMessage(requestId, p); break;
                    case "setOpacity": CmdSetOpacity(requestId, p); break;
                    case "flashFrame": CmdFlashFrame(requestId, p); break;
                    case "getWindowInfo": CmdGetWindowInfo(requestId, p); break;

                    // Tray
                    case "trayCreate": CmdTrayCreate(requestId, p); break;
                    case "trayDestroy": CmdTrayDestroy(requestId, p); break;
                    case "traySetTooltip": CmdTraySetTooltip(requestId, p); break;
                    case "traySetMenu": CmdTraySetMenu(requestId, p); break;
                    case "trayBalloon": CmdTrayBalloon(requestId, p); break;

                    // App
                    case "quit": Shutdown(); break;

                    default:
                        Protocol.SendError("Unknown command: " + command, requestId);
                        break;
                }
            }
            catch (Exception ex)
            {
                Protocol.SendError("Command error [" + command + "]: " + ex.Message, requestId);
            }
        }

        // ---- Window commands ----

        static async void CmdCreateWindow(int requestId, Dictionary<string, object> p)
        {
            int id = _nextWindowId++;
            var win = new BuntronWindow(id, p);
            _windows[id] = win;

            string url = GetStr(p, "url", "about:blank");
            string preload = GetStr(p, "preloadScript", null);
            bool devTools = GetBool(p, "devTools", true);

            win.FormClosed += (s, e) =>
            {
                _windows.Remove(id);
                if (_windows.Count == 0)
                    Protocol.SendEvent("allWindowsClosed");
            };

            await win.InitWebView(url, _userDataFolder, preload, devTools);

            Protocol.SendReply(requestId, new Dictionary<string, object>
            {
                { "windowId", id },
                { "handle", (long)win.Handle }
            });
        }

        static void CmdCloseWindow(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null) { win.Close(); Protocol.SendReply(requestId); }
        }

        static void CmdDestroyWindow(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null)
            {
                if (win.WebView != null) win.WebView.Dispose();
                win.Close();
                win.Dispose();
                Protocol.SendReply(requestId);
            }
        }

        static void CmdSetTitle(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null) { win.Text = GetStr(p, "title", win.Text); Protocol.SendReply(requestId); }
        }

        static void CmdSetSize(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null)
            {
                int w = GetInt(p, "width", win.ClientSize.Width);
                int h = GetInt(p, "height", win.ClientSize.Height);
                win.ClientSize = new Size(w, h);
                Protocol.SendReply(requestId);
            }
        }

        static void CmdSetPosition(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null)
            {
                int x = GetInt(p, "x", win.Location.X);
                int y = GetInt(p, "y", win.Location.Y);
                win.Location = new Point(x, y);
                Protocol.SendReply(requestId);
            }
        }

        static void CmdSetMinSize(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null)
            {
                int w = GetInt(p, "width", 0);
                int h = GetInt(p, "height", 0);
                win.MinimumSize = new Size(w, h);
                Protocol.SendReply(requestId);
            }
        }

        static void CmdSetMaxSize(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null)
            {
                int w = GetInt(p, "width", 0);
                int h = GetInt(p, "height", 0);
                win.MaximumSize = new Size(w, h);
                Protocol.SendReply(requestId);
            }
        }

        static void CmdMinimize(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null) { win.WindowState = FormWindowState.Minimized; Protocol.SendReply(requestId); }
        }

        static void CmdMaximize(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null) { win.WindowState = FormWindowState.Maximized; Protocol.SendReply(requestId); }
        }

        static void CmdRestore(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null) { win.WindowState = FormWindowState.Normal; Protocol.SendReply(requestId); }
        }

        static void CmdShow(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null) { win.Show(); Protocol.SendReply(requestId); }
        }

        static void CmdHide(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null) { win.Hide(); Protocol.SendReply(requestId); }
        }

        static void CmdFocus(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null) { win.Activate(); win.BringToFront(); Protocol.SendReply(requestId); }
        }

        static void CmdSetFullscreen(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null)
            {
                bool fs = GetBool(p, "fullscreen", true);
                if (fs)
                {
                    win.FormBorderStyle = FormBorderStyle.None;
                    win.WindowState = FormWindowState.Maximized;
                }
                else
                {
                    win.FormBorderStyle = FormBorderStyle.Sizable;
                    win.WindowState = FormWindowState.Normal;
                }
                Protocol.SendReply(requestId);
            }
        }

        static void CmdSetAlwaysOnTop(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null) { win.TopMost = GetBool(p, "onTop", true); Protocol.SendReply(requestId); }
        }

        static void CmdSetResizable(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null)
            {
                bool r = GetBool(p, "resizable", true);
                win.FormBorderStyle = r ? FormBorderStyle.Sizable : FormBorderStyle.FixedSingle;
                Protocol.SendReply(requestId);
            }
        }

        static void CmdNavigate(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null)
            {
                string url = GetStr(p, "url", "");
                win.ExecuteWhenReady(() => win.WebView.CoreWebView2.Navigate(url));
                Protocol.SendReply(requestId);
            }
        }

        static async void CmdExecuteJs(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null)
            {
                string code = GetStr(p, "code", "");
                try
                {
                    string result = await win.WebView.CoreWebView2.ExecuteScriptAsync(code);
                    Protocol.SendReply(requestId, new Dictionary<string, object> { { "result", result } });
                }
                catch (Exception ex)
                {
                    Protocol.SendError(ex.Message, requestId);
                }
            }
        }

        static void CmdOpenDevTools(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null)
            {
                win.ExecuteWhenReady(() => win.WebView.CoreWebView2.OpenDevToolsWindow());
                Protocol.SendReply(requestId);
            }
        }

        static void CmdPostMessage(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null)
            {
                string msg = GetStr(p, "message", "");
                win.ExecuteWhenReady(() => win.WebView.CoreWebView2.PostWebMessageAsJson(msg));
                Protocol.SendReply(requestId);
            }
        }

        static void CmdSetOpacity(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null)
            {
                double op = p.ContainsKey("opacity") ? Convert.ToDouble(p["opacity"]) : 1.0;
                win.Opacity = Math.Max(0.0, Math.Min(1.0, op));
                Protocol.SendReply(requestId);
            }
        }

        static void CmdFlashFrame(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null)
            {
                bool flash = GetBool(p, "flash", true);
                FlashWindowEx(win.Handle, flash);
                Protocol.SendReply(requestId);
            }
        }

        static void CmdGetWindowInfo(int requestId, Dictionary<string, object> p)
        {
            var win = GetWindow(p);
            if (win != null)
            {
                string state = "normal";
                if (!win.Visible) state = "hidden";
                else if (win.WindowState == FormWindowState.Minimized) state = "minimized";
                else if (win.WindowState == FormWindowState.Maximized) state = "maximized";

                Protocol.SendReply(requestId, new Dictionary<string, object>
                {
                    { "windowId", win.WindowId },
                    { "title", win.Text },
                    { "x", win.Location.X },
                    { "y", win.Location.Y },
                    { "width", win.ClientSize.Width },
                    { "height", win.ClientSize.Height },
                    { "state", state },
                    { "visible", win.Visible },
                    { "focused", win == Form.ActiveForm },
                    { "topMost", win.TopMost },
                    { "opacity", win.Opacity }
                });
            }
        }

        // ---- Tray commands ----

        static void CmdTrayCreate(int requestId, Dictionary<string, object> p)
        {
            if (_tray != null) _tray.Dispose();
            _tray = new BuntronTray(GetStr(p, "tooltip", "Buntron"), GetStr(p, "iconPath", null));
            Protocol.SendReply(requestId);
        }

        static void CmdTrayDestroy(int requestId, Dictionary<string, object> p)
        {
            if (_tray != null) _tray.Dispose();
            _tray = null;
            Protocol.SendReply(requestId);
        }

        static void CmdTraySetTooltip(int requestId, Dictionary<string, object> p)
        {
            if (_tray != null) _tray.SetTooltip(GetStr(p, "tooltip", ""));
            Protocol.SendReply(requestId);
        }

        static void CmdTraySetMenu(int requestId, Dictionary<string, object> p)
        {
            if (_tray != null && p.ContainsKey("items"))
            {
                var rawItems = p["items"] as System.Collections.ArrayList;
                var items = new List<Dictionary<string, object>>();
                if (rawItems != null)
                    foreach (var item in rawItems)
                        items.Add(item as Dictionary<string, object>);
                _tray.SetContextMenu(items);
            }
            Protocol.SendReply(requestId);
        }

        static void CmdTrayBalloon(int requestId, Dictionary<string, object> p)
        {
            if (_tray != null) _tray.ShowBalloon(GetStr(p, "title", ""), GetStr(p, "body", ""));
            Protocol.SendReply(requestId);
        }

        // ---- Helpers ----

        static BuntronWindow GetWindow(Dictionary<string, object> p)
        {
            int id = GetInt(p, "windowId", -1);
            if (id < 0 || !_windows.ContainsKey(id))
            {
                Protocol.SendError("Window " + id + " not found");
                return null;
            }
            return _windows[id];
        }

        static void Shutdown()
        {
            _running = false;
            if (_tray != null) _tray.Dispose();
            foreach (var win in new List<BuntronWindow>(_windows.Values))
            {
                try { if (win.WebView != null) win.WebView.Dispose(); win.Close(); win.Dispose(); } catch { }
            }
            _windows.Clear();
            Application.Exit();
        }

        static int GetInt(Dictionary<string, object> d, string key, int def)
        {
            if (d != null && d.ContainsKey(key) && d[key] != null)
            {
                try { return Convert.ToInt32(d[key]); } catch { }
            }
            return def;
        }

        static string GetStr(Dictionary<string, object> d, string key, string def)
        {
            if (d != null && d.ContainsKey(key) && d[key] != null)
                return d[key].ToString();
            return def;
        }

        static bool GetBool(Dictionary<string, object> d, string key, bool def)
        {
            if (d != null && d.ContainsKey(key) && d[key] != null)
            {
                try { return Convert.ToBoolean(d[key]); } catch { }
            }
            return def;
        }

        // ---- P/Invoke for flash ----
        [DllImport("user32.dll")]
        static extern bool FlashWindowEx(ref FLASHWINFO pwfi);

        struct FLASHWINFO
        {
            public uint cbSize;
            public IntPtr hwnd;
            public uint dwFlags;
            public uint uCount;
            public uint dwTimeout;
        }

        static void FlashWindowEx(IntPtr hwnd, bool flash)
        {
            var fInfo = new FLASHWINFO();
            fInfo.cbSize = (uint)Marshal.SizeOf(fInfo);
            fInfo.hwnd = hwnd;
            fInfo.dwFlags = flash ? 0x0003u : 0u; // FLASHW_ALL or FLASHW_STOP
            fInfo.uCount = flash ? 3u : 0u;
            fInfo.dwTimeout = 0;
            FlashWindowEx(ref fInfo);
        }
    }
}
