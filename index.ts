import { unlink } from "node:fs/promises";

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = new URL("./public/", import.meta.url);

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

async function serveStatic(pathname: string): Promise<Response | null> {
  const filePath = pathname === "/" ? "index.html" : pathname.slice(1);
  // Block path traversal — only serve flat files inside public/.
  if (filePath.includes("..") || filePath.includes("/") || filePath.includes("\\")) {
    return null;
  }
  const file = Bun.file(new URL(filePath, PUBLIC_DIR));
  if (!(await file.exists())) return null;
  const ext = filePath.slice(filePath.lastIndexOf("."));
  return new Response(file, {
    headers: { "content-type": CONTENT_TYPES[ext] ?? "application/octet-stream" },
  });
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/api/health") {
      return Response.json({ ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/describe") {
      const t0 = Date.now();
      let tmpPath: string | null = null;
      try {
        const form = await req.formData();
        const image = form.get("image");
        if (!(image instanceof File)) {
          return Response.json({ error: "No 'image' file field in form data." }, { status: 400 });
        }

        const ext =
          (image.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "").slice(0, 5) || "jpg";
        tmpPath = `/tmp/mirage-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        await Bun.write(tmpPath, image);

        const proc = Bun.spawn(["cactus", "mirage", "describe", tmpPath], {
          stdout: "pipe",
          stderr: "pipe",
        });
        const [stdout, stderr, exitCode] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
          proc.exited,
        ]);

        if (exitCode !== 0) {
          return Response.json(
            { error: `cactus exited with code ${exitCode}: ${stderr.slice(0, 1000)}` },
            { status: 500 }
          );
        }

        let result: unknown;
        try {
          result = JSON.parse(stdout);
        } catch {
          return Response.json(
            { error: "cactus did not return valid JSON.", raw: stdout.slice(0, 2000) },
            { status: 500 }
          );
        }

        return Response.json({
          result,
          filename: image.name,
          serverMs: Date.now() - t0,
        });
      } catch (err) {
        return Response.json(
          { error: err instanceof Error ? err.message : String(err) },
          { status: 500 }
        );
      } finally {
        if (tmpPath) {
          try {
            await unlink(tmpPath);
          } catch {}
        }
      }
    }

    if (req.method === "GET") {
      const staticRes = await serveStatic(url.pathname);
      if (staticRes) return staticRes;
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Mirage web UI → http://localhost:${PORT}`);
