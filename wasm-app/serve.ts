// Static host for the WebAssembly build of Mirage describe.
// Deliberately separate from ../index.ts (the native `cactus mirage describe`
// version) so both can be demoed side by side: this one on :3001, that one on
// :3000. Run with:  bun run wasm-app/serve.ts
//
// The only job beyond serving files is handing the browser mirage.cact. The
// weights are cached under ./models and downloaded from Hugging Face on the
// first request, so the app itself never needs a build step.

const PORT = Number(process.env.WASM_PORT || 3001);
const ROOT = new URL("./", import.meta.url);
const MODEL_PATH = new URL("./models/mirage.cact", import.meta.url);
const MODEL_URL =
  "https://huggingface.co/Cactus-Compute/mirage/resolve/main/mirage.cact";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
};

const ALLOWED = new Set([
  "index.html",
  "styles.css",
  "app.js",
  "vendor/cactus.js",
  "vendor/cactus.wasm",
]);

let modelDownload: Promise<void> | null = null;

async function ensureModel(): Promise<void> {
  if (await Bun.file(MODEL_PATH).exists()) return;
  if (!modelDownload) {
    modelDownload = (async () => {
      console.log(
        "mirage.cact not cached — downloading ~22 MB from Hugging Face…",
      );
      const res = await fetch(MODEL_URL);
      if (!res.ok || !res.body)
        throw new Error(`model download failed: HTTP ${res.status}`);
      await Bun.write(MODEL_PATH, res);
      console.log("mirage.cact cached in wasm-app/models/.");
    })().finally(() => {
      modelDownload = null;
    });
  }
  return modelDownload;
}

function notFound(msg = "Not found"): Response {
  return new Response(msg, { status: 404 });
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/models/mirage.cact") {
      try {
        await ensureModel();
        return new Response(Bun.file(MODEL_PATH), {
          headers: {
            "content-type": "application/octet-stream",
            // Weights are fixed per release; let the browser keep them.
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      } catch (err) {
        return Response.json(
          { error: err instanceof Error ? err.message : String(err) },
          { status: 502 },
        );
      }
    }

    const filePath =
      url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (!ALLOWED.has(filePath)) return notFound();
    const file = Bun.file(new URL(filePath, ROOT));
    if (!(await file.exists())) return notFound(`Missing ${filePath}`);
    const ext = filePath.slice(filePath.lastIndexOf("."));
    return new Response(file, {
      headers: {
        "content-type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      },
    });
  },
});

console.log(`Mirage wasm UI → http://localhost:${PORT}`);
