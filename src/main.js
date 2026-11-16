import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { createStudentReport } from "./report.js";
import { CREDIT, guidanceHTML } from "./guidance.js";
import logoReversed from "./assets/university-logo-reversed.png";
import { analyze, point, THRESHOLD } from "./metrics.js";
import "./style.css";
const VERSION = "0.10.22-rc.20250304";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
const app = document.querySelector("#app");
app.innerHTML = `<header><div class="brand-row"><span>TEACHINGPOSE / STUDENT LAB</span><img class="university-logo" src="${logoReversed}" alt="Waipapa Taumata Rau, University of Auckland"></div><h1>PostureLab</h1><p>Explore alignment in two dimensions.</p></header>
<main><aside><b>Automatic posture observations for teaching</b><p>Upload front and side photographs to explore projected body alignment. Landmarks are detected automatically. Photos stay in browser memory until you clear or reload the session.</p><p class="scope-note">Teaching and research prototype. Not clinically validated; no diagnosis or established normal range.</p></aside>
<section class="toolbar"><label>Study code (optional, no names)<input id="code" maxlength="60" placeholder="e.g. CLASS-001"></label><button id="load">Load local analysis model</button><button id="clear">Clear session</button><p id="status" role="status" aria-live="polite">Load the model, select photographs, then confirm each view.</p></section>
<div class="views"></div>
${guidanceHTML(THRESHOLD)}
<section><h2>Your student report</h2><p>Download a clean report with your annotated photographs, measurements and reflection prompts. CSV and JSON are available for further study. Downloads may contain identifiable information.</p><button id="pdf" disabled>Download PDF report</button><button id="csv" disabled>Download CSV</button><button id="json" disabled>Download JSON</button><p id="report-status" role="status" aria-live="polite"></p></section>
</main><footer><p>${CREDIT}</p><p class="footer-note">Automatic pose estimation powered by MediaPipe. Teaching and research use.</p></footer>`;
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
document.querySelector("#pdf").onclick = async () => {
  const button = document.querySelector("#pdf"),
    status = document.querySelector("#report-status");
  button.disabled = true;
  status.textContent = "Preparing your student report…";
  try {
    const data = snapshot();
    const canvases = Object.fromEntries(
      Object.keys(data.views).map((v) => {
        const source = states[v].canvas,
          copy = document.createElement("canvas");
        copy.width = source.width;
        copy.height = source.height;
        copy.getContext("2d").drawImage(source, 0, 0);
        return [v, copy];
      }),
    );
    const pdf = await createStudentReport(data, canvases);
    pdf.save("posturelab-report.pdf");
    status.textContent =
      "Report downloaded. Store it securely and clear the session when finished.";
  } catch (error) {
    status.textContent = "Report could not be created. " + error.message;
  } finally {
    button.disabled = !Object.values(states).some((s) => s.result);
  }
};
