import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("bundled Full, Lite and Heavy initialize offline under the Android content policy", async ({page})=>{
  const remote=[],errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:5176)/,route=>{remote.push(route.request().url());return route.abort();});
  const response=await page.goto("/");
  expect(await response.text()).toContain("Content-Security-Policy");
  await expect(page.locator("#status")).toContainText("Model ready",{timeout:90000});
  const png=await page.evaluate(()=>{
    const c=document.createElement("canvas");c.width=600;c.height=900;c.getContext("2d").fillRect(0,0,600,900);return c.toDataURL().split(",")[1];
  });
  const card=page.locator('[data-session="comfortable-frontal"]');
  await card.locator("input[type=file]").setInputFiles({name:"blank.png",mimeType:"image/png",buffer:Buffer.from(png,"base64")});
  await expect(card.locator("[data-message]")).toContainText("Ready.");
  await card.getByRole("button",{name:"Analyze photograph"}).click();
  await expect(card.locator("[data-message]")).toContainText("No pose detected");
  await page.getByText("Model settings",{exact:true}).click();
  for(const variant of ["lite","heavy"]) {
    await page.locator("#model-choice").selectOption(variant);
    await page.getByRole("button",{name:"Load selected model"}).click();
    await expect(page.locator("#model-current")).toContainText("Pose "+variant[0].toUpperCase()+variant.slice(1),{timeout:90000});
    await card.getByRole("button",{name:"Analyze photograph"}).click();
    await expect(card.locator("[data-message]")).toContainText("No pose detected");
  }
  await page.locator("#interpretation").fill("Offline report: Māori and Greek αβ remain readable.");
  const pending=page.waitForEvent("download");
  await page.getByRole("button",{name:"Download PDF report"}).click();
  const pdf=await readFile(await(await pending).path());
  expect(pdf.subarray(0,5).toString()).toBe("%PDF-");
  expect(remote).toEqual([]);
  expect(errors).toEqual([]);
});
