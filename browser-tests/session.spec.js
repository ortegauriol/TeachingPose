import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("session upload, confirmation, validation and clearing", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "PostureLab", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download JSON" }),
  ).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath("preview.png"),
    fullPage: true,
  });
  const front = page.locator(".views section").first();
  await front.getByRole("button", { name: "Analyze photograph" }).click();
  await expect(front.locator("[data-message]")).toContainText("Load the model");
  await front
    .locator("input[type=file]")
    .setInputFiles({
      name: "bad.png",
      mimeType: "image/png",
      buffer: Buffer.from("invalid"),
    });
  await expect(front.locator("[data-message]")).not.toContainText(
    "No photograph",
  );
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 900;
    return c.toDataURL().split(",")[1];
  });
  await front
    .locator("input[type=file]")
    .setInputFiles({
      name: "blank.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await expect(front.locator("[data-message]")).toContainText("Ready.");
  await front.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Clear session" }).click();
  await expect(front.getByRole("checkbox")).not.toBeChecked();
  await expect(front.locator("canvas")).toHaveAttribute("width", "0");
  expect(errors).toEqual([]);
});
test("deterministic landmarks produce consistent JSON, CSV and PDF exports", async ({
  page,
}) => {
  const landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.2,
    z: 0,
    visibility: 0.99,
  }));
  for (const [i, x, y] of [
    [7, 0.4, 0.15],
    [8, 0.6, 0.15],
    [11, 0.35, 0.3],
    [12, 0.65, 0.3],
    [23, 0.4, 0.55],
    [24, 0.6, 0.55],
    [25, 0.4, 0.72],
    [26, 0.6, 0.72],
    [27, 0.4, 0.9],
    [28, 0.6, 0.9],
  ])
    Object.assign(landmarks[i], { x, y });
  // Replace only the inference dependency in the test response. Production has no test hook.
  await page.route("**/src/main.js*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    return route.fulfill({
      response,
      contentType: "text/javascript",
      body: source.replace(
        /import\s*\{\s*FilesetResolver,\s*PoseLandmarker\s*\}\s*from\s*[^;]+;/,
        `const FilesetResolver={forVisionTasks:async()=>({})}; const PoseLandmarker={POSE_CONNECTIONS:[{start:11,end:12}],createFromOptions:async()=>({detect:()=>({landmarks:[${JSON.stringify(landmarks)}]})})};`,
      ),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Load local analysis model" }).click();
  await expect(page.locator("#status")).toContainText("Model ready");
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 900;
    return c.toDataURL().split(",")[1];
  });
  const front = page.locator(".views section").first();
  await front
    .locator("input[type=file]")
    .setInputFiles({
      name: "fixture.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await expect(front.locator("[data-message]")).toContainText("Ready.");
  await front.getByRole("checkbox").check();
  await front.getByRole("button", { name: "Analyze photograph" }).click();
  await expect(front.locator("table")).toContainText("0.00 deg");
  for (const [name, extension] of [
    ["Download JSON", "json"],
    ["Download CSV", "csv"],
    ["Download PDF report", "pdf"],
  ]) {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toMatch(
      new RegExp("\\." + extension + "$"),
    );
    const data = await readFile(await download.path());
    if (extension === "json") {
      const result = JSON.parse(data);
      expect(result.views.frontal.rows[0].value).toBe(0);
      expect(result.views.frontal.landmarks).toHaveLength(33);
      expect(data.toString()).not.toContain("data:image");
    }
    if (extension === "csv")
      expect(data.toString()).toContain(
        '"Shoulder-line inclination","0","deg"',
      );
    if (extension === "pdf")
      expect(data.subarray(0, 5).toString()).toBe("%PDF-");
  }
});
test("real model loads and rejects an empty photograph", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page.getByRole("button", { name: "Load local analysis model" }).click();
  await expect(page.locator("#status")).toHaveText(
    "Model ready. Select photographs to begin.",
    { timeout: 90000 },
  );
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 900;
    const x = c.getContext("2d");
    x.fillStyle = "white";
    x.fillRect(0, 0, 600, 900);
    return c.toDataURL().split(",")[1];
  });
  const front = page.locator(".views section").first();
  await front
    .locator("input[type=file]")
    .setInputFiles({
      name: "blank.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await expect(front.locator("[data-message]")).toContainText("Ready.");
  await front.getByRole("button", { name: "Analyze photograph" }).click();
  await expect(front.locator("[data-message]")).toContainText(
    "No pose detected",
  );
  await expect(
    page.getByRole("button", { name: "Download JSON" }),
  ).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath("preview.png"),
    fullPage: true,
  });
});
