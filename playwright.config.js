import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./browser-tests",
  use: { channel: "msedge", baseURL: "http://127.0.0.1:5174" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5174",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: !process.env.CI,
  },
});
