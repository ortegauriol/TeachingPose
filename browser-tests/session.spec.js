import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const card = (page, key) => page.locator('[data-session="' + key + '"]');
function fixture() {
  const l = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.15,
    z: 0,
    visibility: 0.99,
  }));
  for (const [i, x, y] of [
    [7, 0.4, 0.15],
    [8, 0.6, 0.15],
    [11, 0.3, 0.25],
    [12, 0.7, 0.25],
    [23, 0.35, 0.55],
    [24, 0.65, 0.55],
    [25, 0.35, 0.75],
    [26, 0.65, 0.75],
    [27, 0.35, 0.95],
    [28, 0.65, 0.95],
  ])
    Object.assign(l[i], { x, y });
  return l;
}
async function mockModel(page, poses) {
  await page.route("**/src/main.js*", async (route) => {
    const response = await route.fetch(),
      source = await response.text();
    return route.fulfill({
      response,
      contentType: "text/javascript",
      body: source.replace(
        /import\s*\{\s*FilesetResolver,\s*PoseLandmarker\s*\}\s*from\s*[^;]+;/,
        `let call=0;const poses=${JSON.stringify(poses)};const FilesetResolver={forVisionTasks:async()=>({})};const PoseLandmarker={POSE_CONNECTIONS:[{start:11,end:12},{start:11,end:23},{start:12,end:24},{start:23,end:25},{start:25,end:27},{start:24,end:26},{start:26,end:28}],createFromOptions:async()=>({detect:()=>({landmarks:[poses[Math.min(call++,poses.length-1)]]})})};`,
      ),
    });
  });
}
async function photo(page, landmarks = fixture()) {
  const png = await page.evaluate((l) => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 900;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, 600, 900);
    ctx.strokeStyle = "#aebfca";
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    for (const [a, b] of [
      [11, 12],
      [11, 23],
      [12, 24],
      [23, 24],
      [23, 25],
      [25, 27],
      [24, 26],
      [26, 28],
    ]) {
      ctx.beginPath();
      ctx.moveTo(l[a].x * 600, l[a].y * 900);
      ctx.lineTo(l[b].x * 600, l[b].y * 900);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(300, 130, 35, 0, Math.PI * 2);
    ctx.stroke();
    return c.toDataURL().split(",")[1];
  }, landmarks);
  return {
    name: "synthetic.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  };
}
async function upload(
  page,
  key,
  image,
  { facing = "right", confirmed = true } = {},
) {
  const c = card(page, key);
  await c.locator("input[type=file]").setInputFiles(image);
  await expect(c.locator("[data-message]")).toContainText("Ready.");
  if (key.includes("sagittal"))
    await c.locator("[data-facing]").selectOption(facing);
  if (confirmed) await c.getByRole("checkbox").check();
  await c.getByRole("button", { name: "Analyze photograph" }).click();
  await expect(c.locator("[data-message]")).toContainText("Analysis complete.");
}
test("four photo slots, guidance, input validation, clearing and mobile layout", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "PostureLab", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".views section")).toHaveCount(4);
  await expect(page.locator(".views > .condition-flow")).toHaveCount(2);
  expect(
    await page
      .locator(".views [data-session]")
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.session)),
  ).toEqual([
    "comfortable-frontal",
    "comfortable-sagittal",
    "instructed-frontal",
    "instructed-sagittal",
  ]);
  await expect(page.locator("footer")).toContainText(
    "Dr. Pablo Ortega-Auriol, Research Fellow",
  );
  await expect(page.locator("header img")).toBeVisible();
  expect(
    await page
      .locator(".views")
      .evaluate((el) => el.nextElementSibling.classList.contains("guidance")),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Download JSON" }),
  ).toBeDisabled();
  const c = card(page, "comfortable-frontal");
  await c.getByRole("button", { name: "Analyze photograph" }).click();
  await expect(c.locator("[data-message]")).toContainText("Load the model");
  await c.locator("input[type=file]").setInputFiles({
    name: "bad.png",
    mimeType: "image/png",
    buffer: Buffer.from("invalid"),
  });
  await expect(c.locator("[data-message]")).not.toContainText("No photograph");
  await c.locator("input[type=file]").setInputFiles(await photo(page));
  await expect(c.locator("[data-message]")).toContainText("Ready.");
  await c.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Clear session" }).click();
  await expect(c.getByRole("checkbox")).not.toBeChecked();
  for (const key of [
    "comfortable-frontal",
    "instructed-frontal",
    "comfortable-sagittal",
    "instructed-sagittal",
  ])
    await expect(card(page, key).locator("canvas")).toHaveAttribute(
      "width",
      "0",
    );
  await page.screenshot({
    path: testInfo.outputPath("preview.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("mobile.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("paired metrics, metadata safeguards, annotated overlays and all exports", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const a = fixture(),
    b = fixture();
  a[25].x = 0.4;
  b[11].x += 0.03;
  b[12].x += 0.03;
  const side = fixture();
  for (const i of [7, 11, 23, 25, 27]) side[i].x = 0.5;
  side[7].x = 0.6;
  const side2 = structuredClone(side);
  side2[7].x = 0.55;
  await mockModel(page, [a, b, side, side2]);
  await page.goto("/");
  await page.getByRole("button", { name: "Load local analysis model" }).click();
  await expect(page.locator("#status")).toContainText("Model ready");
  await upload(page, "comfortable-frontal", await photo(page, a));
  await expect(
    page.locator('.comparisons [data-metric="left_knee_angle"]'),
  ).toContainText("Analyze both conditions");
  await upload(page, "instructed-frontal", await photo(page, b));
  await expect(
    page.locator('.comparisons [data-metric="left_knee_angle"]'),
  ).toContainText("-18.9 deg");
  await upload(page, "comfortable-sagittal", await photo(page, side));
  await upload(page, "instructed-sagittal", await photo(page, side2));
  const c = card(page, "comfortable-frontal");
  await c.locator("[data-overlay]").selectOption("knees");
  await page.locator("#code").fill("SYNTHETIC DEMO - NOT A PARTICIPANT");
  await page.screenshot({
    path: testInfo.outputPath("paired-preview.png"),
    fullPage: true,
  });
  for (const [name, extension] of [
    ["Download JSON", "json"],
    ["Download CSV", "csv"],
    ["Download PDF report", "pdf"],
  ]) {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    const download = await pending,
      data = await readFile(await download.path());
    if (extension === "json") {
      const result = JSON.parse(data);
      expect(result.schemaVersion).toBe(2);
      expect(result.conditions.comfortable.frontal.landmarks).toHaveLength(33);
      expect(result.comparisons.frontal).toHaveLength(16);
      expect(result.comparisons.sagittal).toHaveLength(8);
      expect(
        result.comparisons.frontal.find((r) => r.id === "left_knee_angle")
          .difference,
      ).toBeCloseTo((-2 * Math.atan(30 / 180) * 180) / Math.PI, 6);
      expect(
        result.comparisons.sagittal.find((r) => r.id === "ear_ankle_offset")
          .difference,
      ).toBeCloseTo((-100 * 30) / 270, 6);
      expect(data.toString()).not.toContain("data:image");
      await download.saveAs(testInfo.outputPath("paired.json"));
    }
    if (extension === "csv") {
      expect(data.toString()).toContain(
        '"measurement","comfortable","frontal"',
      );
      expect(data.toString()).toContain(
        '"difference","instructed_minus_comfortable","frontal"',
      );
      await download.saveAs(testInfo.outputPath("paired.csv"));
    }
    if (extension === "pdf") {
      expect(data.subarray(0, 5).toString()).toBe("%PDF-");
      await download.saveAs(testInfo.outputPath("student-report.pdf"));
    }
  }
  await card(page, "instructed-sagittal")
    .locator("[data-side]")
    .selectOption("right");
  await expect(
    page.locator('.comparisons [data-metric="ear_ankle_offset"]'),
  ).toContainText("Use the same anatomical side");
  await card(page, "instructed-sagittal")
    .locator("[data-side]")
    .selectOption("left");
  await card(page, "instructed-sagittal")
    .locator("[data-facing]")
    .selectOption("left");
  await expect(
    page.locator('.comparisons [data-metric="ear_ankle_offset"]'),
  ).toContainText("Use the same anatomical side");
  await card(page, "instructed-frontal")
    .locator("input[type=file]")
    .setInputFiles(await photo(page));
  await expect(
    page.locator('.comparisons [data-metric="left_knee_angle"]'),
  ).toContainText("Analyze both conditions");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF report" }).click();
  await (await pending).saveAs(testInfo.outputPath("partial-report.pdf"));
  await page.getByRole("button", { name: "Clear session" }).click();
  await expect(
    page.getByRole("button", { name: "Download JSON" }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});
test("facing is detected automatically and uncertainty is resolved without rerunning inference", async ({
  page,
}, testInfo) => {
  const left = fixture();
  for (const i of [7, 11, 23, 25, 27]) left[i].x = 0.5;
  left[8].x = 0.51;
  left[0].x = 0.35;
  const ambiguous = structuredClone(left);
  ambiguous[0].x = 0.5;
  await mockModel(page, [left, left, ambiguous]);
  await page.goto("/");
  await page.getByRole("button", { name: "Load local analysis model" }).click();
  await expect(page.locator("#status")).toContainText("Model ready");
  // Deliberately leave the facing controls untouched for the first two photographs.
  for (const key of ["comfortable-sagittal", "instructed-sagittal"]) {
    const c = card(page, key);
    await c.locator("input[type=file]").setInputFiles(await photo(page, left));
    await expect(c.locator("[data-message]")).toContainText("Ready.");
    await c.getByRole("checkbox").check();
    await c.getByRole("button", { name: "Analyze photograph" }).click();
    await expect(c.locator("[data-facing-status]")).toContainText(
      "Facing detected: image left",
    );
    await expect(c.locator("[data-results]")).toContainText(
      "8 of 8 measurements available",
    );
  }
  await expect(
    page.locator('.comparisons [data-metric="ear_ankle_offset"]'),
  ).toContainText("0.0 pp");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  const data = JSON.parse(await readFile(await (await pending).path()));
  expect(data.conditions.comfortable.sagittal.facingSource).toBe("automatic");
  expect(data.conditions.comfortable.sagittal.facing).toBe("left");
  await page.screenshot({
    path: testInfo.outputPath("auto-facing.png"),
    fullPage: true,
  });
  const c = card(page, "comfortable-sagittal");
  await c
    .locator("input[type=file]")
    .setInputFiles(await photo(page, ambiguous));
  await expect(c.locator("[data-message]")).toContainText("Ready.");
  await c.getByRole("checkbox").check();
  await c.getByRole("button", { name: "Analyze photograph" }).click();
  await expect(c.locator("[data-facing-status]")).toContainText(
    "Facing direction is uncertain",
  );
  await expect(c.locator("[data-facing]")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(c.locator("[data-results]")).toContainText(
    "1 of 8 measurements available",
  );
  await c.locator("[data-facing]").selectOption("left");
  await expect(c.locator("[data-results]")).toContainText(
    "8 of 8 measurements available",
  );
  await expect(c.locator("[data-message]")).toContainText(
    "8 of 8 measurements available",
  );
  await expect(c.locator("[data-facing-status]")).toContainText(
    "Facing selected: image left",
  );
  await c.locator("[data-facing]").selectOption("auto");
  await expect(c.locator("[data-results]")).toContainText(
    "1 of 8 measurements available",
  );
});
test("real model loads and rejects an empty photograph", async ({ page }) => {
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
    c.getContext("2d").fillRect(0, 0, 600, 900);
    return c.toDataURL().split(",")[1];
  });
  const c = card(page, "comfortable-frontal");
  await c.locator("input[type=file]").setInputFiles({
    name: "blank.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await expect(c.locator("[data-message]")).toContainText("Ready.");
  await c.getByRole("button", { name: "Analyze photograph" }).click();
  await expect(c.locator("[data-message]")).toContainText("No pose detected");
  await expect(
    page.getByRole("button", { name: "Download JSON" }),
  ).toBeDisabled();
});
