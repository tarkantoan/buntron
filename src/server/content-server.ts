// ============================================================
// Buntron - Content Server
// ============================================================
// Serves local HTML/CSS/JS/assets to WebView2 instances.
// Supports file watching for HMR in development mode.
// ============================================================

import { Server } from "bun";
import { resolve, extname, dirname, join } from "path";
import { existsSync, readFileSync, statSync } from "fs";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".ts": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".wasm": "application/wasm",
  ".map": "application/json",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

export class ContentServer {
  private server: Server | null = null;
  private port: number = 0;
  private fileRoutes: Map<string, string> = new Map(); // route -> file path
  private dirRoutes: Map<string, string> = new Map(); // route prefix -> directory
  private customRoutes: Map<
    string,
    (req: Request) => Response | Promise<Response>
  > = new Map();
  private hmrEnabled: boolean = false;
  private hmrClients: Set<any> = new Set();

  /**
   * Start the content server
   */
  async start(): Promise<number> {
    const self = this;

    this.server = Bun.serve({
      port: 0,
      fetch(req) {
        return self.handleRequest(req);
      },
    });

    this.port = this.server.port;
    return this.port;
  }

  /**
   * Stop the content server
   */
  stop(): void {
    if (this.server) {
      this.server.stop(true);
      this.server = null;
    }
    this.fileRoutes.clear();
    this.dirRoutes.clear();
    this.customRoutes.clear();
  }

  /**
   * Get server port
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Serve a single file and return its URL
   */
  serveFile(filePath: string): string {
    const absPath = resolve(filePath);
    const fileName = require("path").basename(absPath);

    // Serve the directory at root so both relative (./assets/) and
    // root-relative (/assets/) paths from Vite builds resolve correctly
    const dir = dirname(absPath);
    this.dirRoutes.set("", dir);

    return `http://127.0.0.1:${this.port}/${fileName}`;
  }

  /**
   * Serve an entire directory
   */
  serveDirectory(dirPath: string, routePrefix: string = "/app"): string {
    const absDir = resolve(dirPath);
    this.dirRoutes.set(routePrefix, absDir);
    return `http://127.0.0.1:${this.port}${routePrefix}`;
  }

  /**
   * Add a custom route handler
   */
  addRoute(
    path: string,
    handler: (req: Request) => Response | Promise<Response>,
  ): void {
    this.customRoutes.set(path, handler);
  }

  /**
   * Enable HMR (Hot Module Reload) in development mode
   */
  enableHMR(): void {
    this.hmrEnabled = true;
  }

  /**
   * Notify HMR clients of a file change
   */
  notifyHMR(filePath: string): void {
    if (!this.hmrEnabled) return;
    for (const client of this.hmrClients) {
      try {
        client.send(JSON.stringify({ type: "hmr:update", file: filePath }));
      } catch {
        this.hmrClients.delete(client);
      }
    }
  }

  // ---- Private ----

  private async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const pathname = decodeURIComponent(url.pathname);

    // CORS headers for local serving
    const headers: Record<string, string> = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Cache-Control": "no-cache",
    };

    // Options preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    // HMR endpoint
    if (pathname === "/__buntron_hmr__" && this.hmrEnabled) {
      return this.handleHMR(req);
    }

    // Custom routes
    const customHandler = this.customRoutes.get(pathname);
    if (customHandler) {
      return customHandler(req);
    }

    // File routes (exact match)
    const filePath = this.fileRoutes.get(pathname);
    if (filePath) {
      return this.serveStaticFile(filePath, headers);
    }

    // Directory routes (sort by prefix length descending so more specific routes match first)
    const sortedDirRoutes = [...this.dirRoutes.entries()].sort((a, b) => b[0].length - a[0].length);
    for (const [prefix, dir] of sortedDirRoutes) {
      if (pathname.startsWith(prefix)) {
        let relativePath = pathname.substring(prefix.length);
        if (relativePath === "" || relativePath === "/")
          relativePath = "/index.html";

        const targetPath = join(dir, relativePath);

        // Security: prevent directory traversal
        if (!resolve(targetPath).startsWith(resolve(dir))) {
          return new Response("Forbidden", { status: 403, headers });
        }

        if (existsSync(targetPath)) {
          const stat = statSync(targetPath);
          if (stat.isDirectory()) {
            // Try index.html
            const indexPath = join(targetPath, "index.html");
            if (existsSync(indexPath)) {
              return this.serveStaticFile(indexPath, headers);
            }
          } else {
            return this.serveStaticFile(targetPath, headers);
          }
        }
      }
    }

    return new Response("Not Found", { status: 404, headers });
  }

  private serveStaticFile(
    filePath: string,
    extraHeaders: Record<string, string> = {},
  ): Response {
    try {
      const ext = extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      const file = Bun.file(filePath);

      let body: any = file;

      // Inject HMR client script into HTML files
      if (this.hmrEnabled && (ext === ".html" || ext === ".htm")) {
        let html = readFileSync(filePath, "utf-8");
        html = this.injectHMRClient(html);
        body = html;
      }

      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          ...extraHeaders,
        },
      });
    } catch {
      return new Response("Internal Server Error", {
        status: 500,
        headers: extraHeaders,
      });
    }
  }

  private handleHMR(req: Request): Response {
    // Server-Sent Events for HMR
    const stream = new ReadableStream({
      start: (controller) => {
        const client = {
          send: (data: string) => {
            controller.enqueue(`data: ${data}\n\n`);
          },
        };
        this.hmrClients.add(client);

        // Send initial connected event
        client.send(JSON.stringify({ type: "hmr:connected" }));
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  private injectHMRClient(html: string): string {
    const hmrScript = `
<script>
(function() {
  var source = new EventSource('/__buntron_hmr__');
  source.onmessage = function(e) {
    try {
      var data = JSON.parse(e.data);
      if (data.type === 'hmr:update') {
        console.log('[Buntron HMR] Reloading...');
        location.reload();
      }
    } catch(err) {}
  };
  source.onerror = function() {
    source.close();
    setTimeout(function() { location.reload(); }, 2000);
  };
})();
</script>
`;
    // Inject before </head> or </body> or at the end
    if (html.includes("</head>")) {
      return html.replace("</head>", hmrScript + "</head>");
    } else if (html.includes("</body>")) {
      return html.replace("</body>", hmrScript + "</body>");
    } else {
      return html + hmrScript;
    }
  }

  private hashPath(path: string): string {
    // Simple hash for path to create unique route
    let hash = 0;
    for (let i = 0; i < path.length; i++) {
      const chr = path.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}

export default ContentServer;
