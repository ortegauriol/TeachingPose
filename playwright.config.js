import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./browser-tests",
  use: { channel: "msedge", baseURL: "http://127.0.0.1:5175" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5175 --strictPort",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: !process.env.CI,
  },
});
