import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { jsPDF } from "jspdf";
import { analyze, point, THRESHOLD } from "./metrics.js";
import "./style.css";
const VERSION = "0.10.22-rc.20250304";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
const app = document.querySelector("#app");
app.innerHTML = `<header><span>TEACHINGPOSE / RESEARCH STUDIO</span><h1>PostureLab</h1><p>Explore alignment in two dimensions.</p></header><main><aside><b>Teaching and research prototype</b><p>Projected image measurements only. No clinical validation, diagnosis, normal ranges or anatomical pelvic tilt.</p><p>Photos stay in browser memory. No image upload, analytics or browser storage. Model/WASM downloads need internet; explicit exports save files to your device.</p></aside><section class="toolbar"><label>Study code (optional, no names)<input id="code" maxlength="60" placeholder="e.g. CLASS-001"></label><button id="load">Load local analysis model</button><button id="clear">Clear session</button><p id="status" role="status" aria-live="polite">Load the model, select photographs, then confirm each view.</p></section><div class="views"></div><section><h2>Export this session</h2><p>CSV contains measurements; JSON contains measurements and normalized landmarks (no pixels or filenames). PDF contains annotated photos. Exported files may be sensitive.</p><button id="csv" disabled>Download CSV</button><button id="json" disabled>Download JSON</button><button id="pdf" disabled>Download PDF report</button></section><section><h2>How to read these results</h2><p>Use one consenting adult, full body, level camera at torso height, neutral stance, good lighting and a plain background. Confirm frontal or true side view yourself. Choose the visible anatomical side in a sagittal photo. Avoid mirrored images.</p><p>Angles use image pixels corrected for aspect ratio. Horizontal line angles are wrapped to ±90°; positive means downward to image right. Trunk inclination is positive toward image right. Knee flexion is 180° minus the hip–knee–ankle angle, unsigned. Ear offset is signed toward image right, divided by shoulder–hip distance. These are projections affected by rotation, perspective and camera roll.</p><p>Landmarks require visibility ≥ ${THRESHOLD} and must be inside the image. Unavailable values remain blank in CSV and null in JSON. View confirmation is a human check, not automatic validation.</p></section></main>`;
const states = { frontal: {}, sagittal: {} };
let model,
  loading = false,
  busy = false,
  generation = 0;
for (const view of Object.keys(states)) {
  const section = document.createElement("section");
  section.innerHTML = `<h2>${view === "frontal" ? "01 / Frontal" : "02 / Sagittal"}</h2><label>Photograph<input type="file" accept="image/jpeg,image/png,image/webp" data-file></label>${view === "sagittal" ? '<label>Visible anatomical side<select><option value="left">Left</option><option value="right">Right</option></select></label>' : ""}<label class="check"><input type="checkbox"> I confirm this view, full-body framing and a level camera.</label><button data-run>Analyze photograph</button><p data-message role="status">No photograph selected.</p><canvas width="0" height="0" aria-label="Annotated ${view} photograph"></canvas><div data-results></div>`;
  document.querySelector(".views").append(section);
  const state = states[view];
  Object.assign(state, {
    section,
    canvas: section.querySelector("canvas"),
    side: "left",
    confirmed: false,
  });
  section.querySelector("[data-file]").onchange = async (e) => {
    const token = (state.token = (state.token || 0) + 1),
      session = generation;
    state.result = null;
    state.image?.close();
    state.image = null;
    state.canvas.width = 0;
    state.canvas.height = 0;
    render(view);
    section.querySelector("input[type=checkbox]").checked = false;
    state.confirmed = false;
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 20 * 1024 * 1024
      )
        throw Error("Use a JPEG, PNG or WebP up to 20 MB.");
      const image = await createImageBitmap(file);
      if (session !== generation || token !== state.token) {
        image.close();
        return;
      }
      if (image.width * image.height > 40000000) {
        image.close();
        throw Error("Image exceeds 40 megapixels. Resize it first.");
      }
      const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
      state.canvas.width = Math.round(image.width * scale);
      state.canvas.height = Math.round(image.height * scale);
      state.canvas
        .getContext("2d")
        .drawImage(image, 0, 0, state.canvas.width, state.canvas.height);
      image.close();
      const bitmap = await createImageBitmap(state.canvas);
      if (session !== generation || token !== state.token) {
        bitmap.close();
        return;
      }
      state.image = bitmap;
      section.querySelector("[data-message]").textContent =
        "Ready. Confirm view and inspect the overlay after analysis.";
    } catch (err) {
      section.querySelector("[data-message]").textContent = err.message;
    }
  };
  section.querySelector("input[type=checkbox]").onchange = (e) => {
    state.confirmed = e.target.checked;
    recalculate(view);
  };
  section.querySelector("select")?.addEventListener("change", (e) => {
    state.side = e.target.value;
    recalculate(view);
  });
  section.querySelector("[data-run]").onclick = async () => {
    if (busy) return;
    if (!model || !state.image) {
      section.querySelector("[data-message]").textContent =
        "Load the model and select a photograph first.";
      return;
    }
    busy = true;
    document.querySelector("#clear").disabled = true;
    try {
      const result = model.detect(state.image);
      state.result = null;
      if (result.landmarks.length !== 1)
        throw Error(
          result.landmarks.length
            ? "Multiple people detected. Use a single-person photograph."
            : "No pose detected. Try better lighting and full-body framing.",
        );
      state.result = { landmarks: result.landmarks[0] };
      recalculate(view);
      section.querySelector("[data-message]").textContent =
        "Analysis complete. Review every landmark before using results.";
    } catch (err) {
      state.result = null;
      render(view);
      section.querySelector("[data-message]").textContent = err.message;
    } finally {
      busy = false;
      document.querySelector("#clear").disabled = false;
    }
  };
}
function recalculate(view) {
  const s = states[view];
  if (s.result)
    Object.assign(
      s.result,
      analyze(
        s.result.landmarks,
        s.canvas.width,
        s.canvas.height,
        view,
        s.side,
        s.confirmed,
      ),
    );
  render(view);
}
function render(view) {
  const s = states[view],
    r = s.result,
    ctx = s.canvas.getContext("2d");
  if (s.image) ctx.drawImage(s.image, 0, 0);
  if (r) {
    ctx.strokeStyle = "#1affc5";
    ctx.lineWidth = 3;
    for (const { start, end } of PoseLandmarker.POSE_CONNECTIONS) {
      const a = point(r.landmarks, start, s.canvas.width, s.canvas.height),
        b = point(r.landmarks, end, s.canvas.width, s.canvas.height);
      if (a && b) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    r.landmarks.forEach((_, i) => {
      const p = point(r.landmarks, i, s.canvas.width, s.canvas.height);
      if (p) {
        ctx.fillStyle = "#ffcf70";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "18px sans-serif";
        ctx.fillText(String(i), p.x + 6, p.y);
      }
    });
  }
  s.section.querySelector("[data-results]").innerHTML = r
    ? `<ul>${r.warnings.map((x) => `<li>${x}</li>`).join("")}</ul><table><thead><tr><th>2D metric</th><th>Value</th></tr></thead><tbody>${r.rows.map((x) => `<tr><td>${x.name}</td><td>${x.value === null ? "Unavailable" : x.value.toFixed(2) + " " + x.unit}${x.reason ? `<small>${x.reason}</small>` : ""}</td></tr>`).join("")}</tbody></table>`
    : "";
  for (const id of ["csv", "json", "pdf"])
    document.querySelector("#" + id).disabled = !Object.values(states).some(
      (x) => x.result,
    );
}
document.querySelector("#load").onclick = async () => {
  if (loading || model) return;
  loading = true;
  const status = document.querySelector("#status");
  status.textContent =
    "Downloading model and WebAssembly. Inference will run on this device…";
  try {
    const files = await FilesetResolver.forVisionTasks(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`,
    );
    model = await PoseLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
      runningMode: "IMAGE",
      numPoses: 2,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      outputSegmentationMasks: false,
    });
    status.textContent = "Model ready. Select photographs to begin.";
    document.querySelector("#load").disabled = true;
  } catch (e) {
    status.textContent =
      "Model could not load. Check internet access and retry. " + e.message;
  } finally {
    loading = false;
  }
};
document.querySelector("#clear").onclick = () => {
  generation++;
  for (const [v, s] of Object.entries(states)) {
    s.token = (s.token || 0) + 1;
    s.image?.close();
    s.image = null;
    s.result = null;
    s.confirmed = false;
    s.section.querySelector("input[type=file]").value = "";
    s.section.querySelector("input[type=checkbox]").checked = false;
    s.canvas.width = 0;
    s.canvas.height = 0;
    s.section.querySelector("[data-message]").textContent = "Session cleared.";
    render(v);
  }
  document.querySelector("#code").value = "";
};
function snapshot() {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    studyCode: document.querySelector("#code").value,
    purpose: "Teaching and research only; not clinically validated",
    method: {
      model: MODEL,
      packageVersion: VERSION,
      visibilityThreshold: THRESHOLD,
      coordinates:
        "normalized image coordinates; z is model estimate, not used in metrics",
      signConvention:
        "positive image-right; line positive downward to image-right",
    },
    views: Object.fromEntries(
      Object.entries(states)
        .filter(([, s]) => s.result)
        .map(([v, s]) => [
          v,
          {
            width: s.canvas.width,
            height: s.canvas.height,
            side: v === "sagittal" ? s.side : null,
            viewConfirmed: s.confirmed,
            ...s.result,
          },
        ]),
    ),
  };
}
function download(content, type, ext) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "posturelab." + ext;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.querySelector("#json").onclick = () =>
  download(JSON.stringify(snapshot(), null, 2), "application/json", "json");
document.querySelector("#csv").onclick = () => {
  const data = snapshot(),
    quote = (x) => '"' + String(x ?? "").replaceAll('"', '""') + '"';
  const rows = [
    [
      "view",
      "side",
      "confirmed",
      "metric",
      "value",
      "unit",
      "unavailable_reason",
    ],
    ...Object.entries(data.views).flatMap(([v, s]) =>
      s.rows.map((r) => [
        v,
        s.side,
        s.viewConfirmed,
        r.name,
        r.value,
        r.unit,
        r.reason,
      ]),
    ),
  ];
  download(
    rows.map((r) => r.map(quote).join(",")).join("\r\n"),
    "text/csv;charset=utf-8",
    "csv",
  );
};
document.querySelector("#pdf").onclick = () => {
  const data = snapshot(),
    pdf = new jsPDF();
  Object.entries(data.views).forEach(([v, s], i) => {
    if (i) pdf.addPage();
    pdf.setFontSize(20);
    pdf.text("PostureLab / " + v, 15, 20);
    pdf.setFontSize(10);
    pdf.text(
      "Teaching and research only. Not clinically validated. 2D projections.",
      15,
      29,
    );
    pdf.text("Generated: " + data.createdAt, 15, 36);
    pdf.text(
      "Study code: " + data.studyCode.replace(/[^\x20-\x7E]/g, "?"),
      15,
      43,
    );
    const canvas = states[v].canvas,
      scale = Math.min(180 / canvas.width, 125 / canvas.height);
    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.85),
      "JPEG",
      15,
      50,
      canvas.width * scale,
      canvas.height * scale,
    );
    let y = 185;
    for (const r of s.rows) {
      pdf.text(
        `${r.name.replace("–", "-")}: ${r.value === null ? "Unavailable (" + r.reason + ")" : r.value.toFixed(2) + " " + r.unit}`,
        15,
        y,
      );
      y += 9;
    }
    for (const text of [
      "Visible side: " +
        (s.side || "both") +
        ". View confirmed: " +
        s.viewConfirmed,
      ...s.warnings,
      "Signs: image-right positive; horizontal lines downward-right positive. Knee is unsigned.",
      "No diagnostic interpretation. Camera roll and out-of-plane rotation affect results.",
    ]) {
      const lines = pdf.splitTextToSize(text, 180);
      if (y + lines.length * 5 > 280) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(lines, 15, y);
      y += lines.length * 5 + 3;
    }
  });
  pdf.save("posturelab-report.pdf");
};

