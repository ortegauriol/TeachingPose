import { spawnSync } from "node:child_process";
const run = (file, args, env = process.env) => {
  const result = spawnSync(process.execPath, [file, ...args], { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status || 1);
};
run("scripts/prepare-android-assets.mjs", []);
run("node_modules/vite/bin/vite.js", ["build"], { ...process.env, VITE_POSTURELAB_ANDROID: "true" });
run("node_modules/@capacitor/cli/bin/capacitor", ["sync", "android"]);
