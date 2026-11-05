import type { ElpodElysia } from "@elpod/core";
import { resolve } from "node:path";

export class DashboardController {
  routes(app: ElpodElysia) {
    return app
      .get("/", () => serveDashboard("index.html"))
      .get("/*", ({ request }) => {
        const path = new URL(request.url).pathname.slice("/admin/".length);
        if (!path || path.includes("..") || !/^[A-Za-z0-9._/-]+$/.test(path)) {
          return new Response("Not found", { status: 404 });
        }
        return serveDashboard(path);
      });
  }
}

async function serveDashboard(relativePath: string): Promise<Response> {
  const root = resolve("dist/dashboard");
  const filePath = resolve(root, relativePath);
  if (!filePath.startsWith(`${root}/`)) return new Response("Not found", { status: 404 });

  const file = Bun.file(filePath);
  if (!(await file.exists())) return new Response("Not found", { status: 404 });

  const extension = relativePath.split(".").at(-1)?.toLowerCase();
  const contentTypes: Record<string, string> = {
    css: "text/css; charset=utf-8",
    html: "text/html; charset=utf-8",
    ico: "image/x-icon",
    js: "text/javascript; charset=utf-8",
    json: "application/json; charset=utf-8",
    png: "image/png",
    svg: "image/svg+xml",
    webp: "image/webp",
  };
  return new Response(file, {
    headers: {
      "content-type": (extension && contentTypes[extension]) || "application/octet-stream",
      "x-content-type-options": "nosniff",
    },
  });
}
