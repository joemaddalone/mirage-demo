# Mirage Describe

Upload a photo, get back what the machine sees: objects, text, and the scene, drawn right on top of your image.

## Two versions

There are two ways to run the same app, and they can run at the same time.

| | Server | Browser |
|---|---|---|
| Run | `bun run index.ts` | `bun run wasm-app/serve.ts` |
| Open | http://localhost:3000 | http://localhost:3001 |
| Inference | `cactus` CLI on your machine | WebAssembly in the tab |
| Needs `cactus` installed | yes | no |

The browser version downloads the engine and weights on first use (~23 MB), then caches them. Nothing is uploaded: the image is read in the tab.

## What you need

- **Bun**: the JavaScript runtime ([bun.sh](https://bun.sh))
- **cactus**: with the `mirage describe` command available on your PATH (server version only) - `pip install -U cactus-compute`

## Run it

```bash

bun install
bun run index.ts
```

Then open **http://localhost:3000** in your browser.

For the browser version:

```bash
bun run start:wasm
```

Then open **http://localhost:3001**.

The browser version is plain static files: no server code runs after page
load. Anything that serves files works: `python3 -m http.server`

```bash
cd wasm-app && python3 -m http.server 8000
```

## Use it

1. Drop an image onto the page (or click to browse).
2. Hit **Describe image**.
3. Browse the results:
   - Boxes, masks, and labels overlaid on your photo
   - Object and text lists in the right panel: hover to highlight, click to pin
   - A **Min confidence** slider to hide weak detections
   - Raw JSON output at the bottom of the middle column
4. **Clear** resets everything for the next image.
