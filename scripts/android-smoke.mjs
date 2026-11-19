import { _android as android } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const app = "io.github.ortegauriol.posturelab";
const adb = (...args) => execFileSync("adb", args, {encoding:"utf8",timeout:30000}).trim();
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
await mkdir("android-smoke-results",{recursive:true});
let device, page;
try {
  adb("install","-r","android/app/build/outputs/apk/debug/app-debug.apk");
  adb("shell","svc","wifi","disable");
  adb("shell","svc","data","disable");
  adb("shell","cmd","connectivity","airplane-mode","enable");
  adb("shell","am","start","-n",app+"/.MainActivity");
  [device]=await android.devices();
  assert(device,"Android emulator is unavailable");
  const webview=await device.webView({pkg:app,timeout:90000});
  page=await webview.page();
  page.setDefaultTimeout(30000);
  const remoteRequests=[];
  page.on("request",request=>{if(/^https?:/.test(request.url()) && new URL(request.url()).hostname!=="localhost") remoteRequests.push(request.url());});
  await page.reload();
  await page.waitForFunction(()=>document.querySelector("#model-current")?.textContent.includes("MediaPipe Pose Full"),null,{timeout:120000});
  assert(await page.locator("body.native-app").count()===1);
  assert(await page.getByRole("button",{name:"Choose photograph",exact:true}).count()===4);
  assert(await page.getByRole("button",{name:"Take photograph",exact:true}).count()===4);
  assert(await page.evaluate(()=>window.Capacitor.isPluginAvailable("PostureLab")));
  await page.locator("#code").fill("ANDROID-SYNTHETIC-TEST");
  await page.locator("#interpretation").fill("Offline Android teaching report. Synthetic test data only.");
  await page.locator("#notes-status").filter({hasText:"Saved on this device"}).waitFor();
  await page.reload();
  await page.waitForFunction(()=>document.querySelector("#model-current")?.textContent.includes("MediaPipe Pose Full"),null,{timeout:120000});
  assert.equal(await page.locator("#code").inputValue(),"ANDROID-SYNTHETIC-TEST");
  assert.match(await page.locator("#interpretation").innerText(),/Offline Android teaching report/);

  async function saveDocument(buttonName) {
    await page.getByRole("button",{name:buttonName,exact:true}).click();
    let saved=false;
    for(let attempt=0;attempt<30;attempt++) {
      await pause(800);
      try {
        adb("shell","uiautomator","dump","/sdcard/posturelab-window.xml");
        const xml=adb("shell","cat","/sdcard/posturelab-window.xml");
        await writeFile("android-smoke-results/document-picker.xml",xml);
        const node=xml.match(/<node\b[^>]*(?:text="(?:SAVE|Save)"|content-desc="(?:SAVE|Save)")[^>]*>/);
        const bounds=node?.[0].match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
        if(!bounds) continue;
        const [,x1,y1,x2,y2]=bounds.map(Number);
        adb("shell","input","tap",String(Math.round((x1+x2)/2)),String(Math.round((y1+y2)/2)));
        saved=true; break;
      } catch {}
    }
    assert(saved,"Android Save dialog could not be confirmed");
    await page.locator("#report-status").filter({hasText:"File saved to your chosen location"}).waitFor();
  }
  await saveDocument("Save JSON");
  await saveDocument("Save PDF report");
  await page.getByText("Model settings",{exact:true}).click();
  await page.locator("#model-choice").selectOption("lite");
  await page.getByRole("button",{name:"Load selected model"}).click();
  await page.locator("#model-current").filter({hasText:"MediaPipe Pose Lite"}).waitFor({timeout:120000});
  assert.deepEqual(remoteRequests,[],"Native app requested external resources");
  await page.screenshot({path:"android-smoke-results/app.png",fullPage:true});
  await page.getByRole("button",{name:"Clear session",exact:true}).click();
  assert.equal(await page.locator("#interpretation").innerText(),"");
  await writeFile("android-smoke-results/result.json",JSON.stringify({passed:true,offline:true,nativeBridge:true,notesRestored:true,pdfSaved:true,jsonSaved:true,models:["full","lite"],remoteRequests},null,2));
  console.log("Installed Android app: offline Full/Lite loading, native PDF/JSON saving and notes recovery passed.");
} catch(error) {
  try { await writeFile("android-smoke-results/logcat.txt",adb("logcat","-d","-t","6000")); } catch {}
  try { await writeFile("android-smoke-results/webviews.txt",adb("shell","cat","/proc/net/unix")); } catch {}
  if(page) { try { await page.screenshot({path:"android-smoke-results/failure.png",fullPage:true}); } catch {} }
  throw error;
} finally { if(device) await device.close(); }
