import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./android-browser-tests",
  timeout: 120000,
  use: { channel: "msedge", baseURL: "http://127.0.0.1:5176" },
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5176 --strictPort",
    url: "http://127.0.0.1:5176",
    reuseExistingServer: !process.env.CI,
  },
});
