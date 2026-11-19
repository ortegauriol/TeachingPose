import { mkdir, readFile, writeFile, cp } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "android-models.json");
const record = process.argv.includes("--record-checksums");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
await mkdir(path.join(root, "native-assets/models"), { recursive: true });
for (const model of manifest.models) {
  const destination = path.join(root, "native-assets/models", model.filename);
  let bytes;
  try { bytes = await readFile(destination); } catch {}
  if (!bytes || (model.sha256 && digest(bytes) !== model.sha256)) {
    if (!model.sha256 && !record) throw Error("Missing pinned checksum for " + model.filename);
    console.log("Downloading official model: " + model.filename);
    const response = await fetch(model.url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw Error("Model download failed: " + response.status);
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 100000 || bytes.length > 50000000) throw Error("Unexpected model size");
  }
  const sha256 = digest(bytes);
  if (model.sha256 && sha256 !== model.sha256) throw Error("Model checksum mismatch: " + model.filename);
  if (record) { model.sha256 = sha256; model.bytes = bytes.length; }
  await writeFile(destination, bytes);
  console.log("Verified " + model.filename + " (" + bytes.length + " bytes)");
}
if (record) await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
const installed = JSON.parse(await readFile(path.join(root,"node_modules/@mediapipe/tasks-vision/package.json"), "utf8"));
if (installed.version !== manifest.packageVersion) throw Error("MediaPipe package does not match the bundled model manifest");
await mkdir(path.join(root, "native-assets/mediapipe"), { recursive: true });
await cp(path.join(root, "node_modules/@mediapipe/tasks-vision/wasm"), path.join(root, "native-assets/mediapipe/wasm"), { recursive: true });
await mkdir(path.join(root, "native-assets/licenses"), { recursive: true });
for (const [source, name] of [
  ["third-party/MediaPipe-LICENSE.txt", "MediaPipe-Apache-2.0.txt"],
  ["node_modules/@capacitor/core/LICENSE", "Capacitor-MIT.txt"],
  ["src/assets/LICENSE_DEJAVU.txt", "DejaVu-fonts.txt"],
]) await cp(path.join(root,source),path.join(root,"native-assets/licenses",name));
console.log("Android assets ready. All pose models and WebAssembly are bundled locally.");
