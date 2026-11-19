import { defineConfig } from "vite";

const bundled = process.env.VITE_POSTURELAB_ANDROID === "true";
export default defineConfig({
  publicDir: bundled ? "native-assets" : "public",
  plugins: bundled ? [{
    name: "android-offline-policy",
    transformIndexHtml(html) {
      const policy = "default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' data: blob:; worker-src 'self' blob:; font-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'";
      return html.replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" /><meta http-equiv="Content-Security-Policy" content="' + policy + '">');
    },
  }] : [],
});
