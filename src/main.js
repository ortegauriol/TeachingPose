import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { createStudentReport } from "./report.js";
import { CREDIT, guidanceHTML } from "./guidance.js";
import logoReversed from "./assets/university-logo-reversed.png";
import {
  analyze,
  resolveFacing,
  compareResults,
  CONDITIONS,
  VIEWS,
  CONDITION_LABELS,
  VIEW_LABELS,
  THRESHOLD,
} from "./metrics.js";
import { drawOverlay, guideLegend } from "./overlay.js";
import "./style.css";
const VERSION = "0.10.22-rc.20250304";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
const app = document.querySelector("#app");
app.innerHTML = `<header><div class="brand-row"><span>TEACHINGPOSE / STUDENT LAB</span><img class="university-logo" src="${logoReversed}" alt="Waipapa Taumata Rau, University of Auckland"></div><h1>PostureLab</h1><p>Observe. Compare. Explain.</p></header>
<main><aside><b>Automatic posture observations for teaching</b><p>Take front and side photos in comfortable standing, then in the instructed anatomical position. Compare body-segment relationships and develop your own interpretation. All landmarks are automatic; photos stay in browser memory.</p><p class="scope-note">Descriptive 2D projections. Not clinically validated. No diagnosis, normal range, or clinically meaningful change threshold.</p></aside>
<section class="toolbar"><label>Study code (optional, no names)<input id="code" maxlength="60" placeholder="e.g. CLASS-001"></label><button id="load">Load local analysis model</button><button id="clear">Clear session</button><p id="status" role="status" aria-live="polite">Load the model, select photographs, then confirm each view.</p></section>
<div class="views"></div>${guidanceHTML(THRESHOLD)}
<section class="comparisons"><p class="eyebrow">COMFORTABLE → INSTRUCTED</p><h2>Compare the two conditions</h2><p>Differences are instructed minus comfortable. They describe a response to instruction, not automatically improvement. Percentage differences are percentage points of the defined torso ratio. Use the same camera setup; rotation can affect the comparison.</p><div id="comparison-results"></div><div class="reflection"><b>Your interpretation</b><p>Which measurements changed together? What could camera position or landmark uncertainty explain? Which worksheet questions cannot be answered from these landmarks?</p></div></section>
<section><h2>Your student report</h2><p>Download annotated photographs and grouped comparisons. A partial session is allowed; missing photos and unavailable differences are clearly identified. CSV and JSON include condition labels and comparisons. Downloads may be identifiable.</p><button id="pdf" disabled>Download PDF report</button><button id="csv" disabled>Download CSV</button><button id="json" disabled>Download JSON</button><p id="report-status" role="status" aria-live="polite"></p></section>
</main><footer><p>${CREDIT}</p><p class="footer-note">Automatic pose estimation powered by MediaPipe. Teaching and research use.</p></footer>`;
const states = {};
let model,
  loading = false,
  busy = false,
  generation = 0,
  reportPending = false;
const format = (value, unit) =>
  value === null ? "Unavailable" : value.toFixed(1) + " " + unit;
const formatDelta = (value, unit) =>
  value === null
    ? "Unavailable"
    : (value > 0 ? "+" : "") +
      value.toFixed(1) +
      " " +
      (unit === "% torso" ? "pp" : unit);
function viewData(state) {
  return state.result
    ? {
        width: state.canvas.width,
        height: state.canvas.height,
        side: state.view === "sagittal" ? state.side : null,
        facing: state.view === "sagittal" ? state.facing : null,
        facingSource: state.view === "sagittal" ? state.facingSource : null,
        facingSelection:
          state.view === "sagittal" ? state.facingSelection : null,
        viewConfirmed: state.confirmed,
        overlayMode: state.overlay,
        ...state.result,
      }
    : null;
}
function comparisons() {
  return Object.fromEntries(
    VIEWS.map((v) => [
      v,
      compareResults(
        viewData(states["comfortable-" + v]),
        viewData(states["instructed-" + v]),
        v,
      ),
    ]),
  );
}
function updateSummary() {
  for (const id of ["csv", "json", "pdf"])
    document.querySelector("#" + id).disabled =
      !Object.values(states).some((s) => s.result) ||
      (id === "pdf" && reportPending);
  const paired = comparisons();
  document.querySelector("#comparison-results").innerHTML = VIEWS.map(
    (v) =>
      `<h3>${VIEW_LABELS[v]}</h3>${!CONDITIONS.some((c) => states[c + "-" + v].result) ? "<p>Analyze at least one " + VIEW_LABELS[v].toLowerCase() + " photo to see the comparison.</p>" : `<div class="table-scroll"><table class="comparison-table"><thead><tr><th>Measurement</th><th>Comfortable</th><th>Instructed</th><th>Difference</th></tr></thead><tbody>${paired[v].map((r) => `<tr data-metric="${r.id}"><td>${r.name}<small>${r.group}</small></td><td data-label="Comfortable">${format(r.comfortable, r.unit)}</td><td data-label="Instructed">${format(r.instructed, r.unit)}</td><td data-label="Difference">${formatDelta(r.difference, r.unit)}${r.reason ? "<small>" + r.reason + "</small>" : ""}</td></tr>`).join("")}</tbody></table></div>`}`,
  ).join("");
}
for (const view of VIEWS)
  for (const condition of CONDITIONS) {
    const key = condition + "-" + view,
      section = document.createElement("section");
    section.dataset.session = key;
    section.innerHTML = `<p class="eyebrow">${CONDITION_LABELS[condition]} standing</p><h2>${VIEW_LABELS[view]}</h2><label>Photograph<input type="file" accept="image/jpeg,image/png,image/webp" data-file></label>
 ${view === "sagittal" ? '<div class="side-settings"><label>Visible anatomical side<select data-side><option value="left">Left</option><option value="right">Right</option></select></label><label>Facing direction (automatic)<select data-facing><option value="auto">Detect automatically</option><option value="left">Image left</option><option value="right">Image right</option></select></label></div><p class="facing-status" data-facing-status role="status" aria-live="polite">Facing direction will be estimated automatically after analysis.</p>' : ""}
 <label class="check"><input type="checkbox"> I confirm the view, full-body framing, unmirrored image and level camera.</label><button data-run>Analyze photograph</button><p data-message role="status">No photograph selected.</p>
 <label class="overlay-setting">Overlay guides<select data-overlay><option value="alignment">Body alignment</option><option value="knees">Lower-limb guides</option><option value="landmarks">Landmarks only</option></select></label>
 <canvas width="0" height="0" aria-label="Annotated ${condition} ${view} photograph"></canvas><p class="legend">Gold: estimated points · Green: connections · Coral: measurement guides</p><div data-results></div>`;
    document.querySelector(".views").append(section);
    const state = (states[key] = {
      key,
      view,
      condition,
      section,
      canvas: section.querySelector("canvas"),
      side: "left",
      facing: "unknown",
      facingSelection: "auto",
      facingSource: "unknown",
      overlay: "alignment",
      confirmed: false,
    });
    section.querySelector("[data-file]").onchange = async (e) => {
      const token = (state.token = (state.token || 0) + 1),
        session = generation;
      state.result = null;
      state.facing = "unknown";
      state.facingSource = "unknown";
      state.facingSelection = "auto";
      if (state.view === "sagittal")
        section.querySelector("[data-facing]").value = "auto";
      state.image?.close();
      state.image = null;
      state.canvas.width = 0;
      state.canvas.height = 0;
      state.confirmed = false;
      section.querySelector("input[type=checkbox]").checked = false;
      render(state);
      const file = e.target.files[0];
      if (!file) {
        section.querySelector("[data-message]").textContent =
          "No photograph selected.";
        return;
      }
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
          "Ready. Confirm view and check the overlay after analysis.";
      } catch (error) {
        if (session === generation && token === state.token)
          section.querySelector("[data-message]").textContent = error.message;
      }
    };
    section.querySelector("input[type=checkbox]").onchange = (e) => {
      state.confirmed = e.target.checked;
      recalculate(state);
    };
    for (const [selector, property] of [
      ["[data-side]", "side"],
      ["[data-facing]", "facingSelection"],
    ])
      section.querySelector(selector)?.addEventListener("change", (e) => {
        state[property] = e.target.value;
        recalculate(state);
      });
    section.querySelector("[data-overlay]").onchange = (e) => {
      state.overlay = e.target.value;
      render(state);
    };
    section.querySelector("[data-run]").onclick = () => {
      if (busy) return;
      if (!model || !state.image) {
        section.querySelector("[data-message]").textContent =
          "Load the model and select a photograph first.";
        return;
      }
      busy = true;
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
        recalculate(state);
      } catch (error) {
        state.result = null;
        render(state);
        section.querySelector("[data-message]").textContent = error.message;
      } finally {
        busy = false;
      }
    };
  }
// Keep each condition's front and side photographs together in DOM and visual order.
for (const [index, condition] of CONDITIONS.entries()) {
  const flow = document.createElement("div");
  flow.className = "condition-flow " + condition;
  flow.setAttribute("role", "group");
  flow.setAttribute("aria-labelledby", condition + "-title");
  flow.innerHTML = `<div class="flow-heading"><p class="eyebrow">Stage ${index + 1}</p><h2 id="${condition}-title">${CONDITION_LABELS[condition]} standing</h2><p>${condition === "comfortable" ? "Start here. Complete the front view, then the side view, without coaching the participant." : "Next, repeat both views after the course's anatomical standing instructions."}</p></div>`;
  for (const [step, view] of VIEWS.entries()) {
    const section = states[condition + "-" + view].section;
    section.querySelector(".eyebrow").remove();
    section.querySelector("h2").outerHTML =
      `<h3 class="photo-heading"><span>${step + 1}.</span> ${VIEW_LABELS[view]}</h3>`;
    if (step) {
      const transition = document.createElement("p");
      transition.className = "flow-transition";
      transition.textContent = "↓ Continue to the side view";
      flow.append(transition);
    }
    flow.append(section);
  }
  document.querySelector(".views").append(flow);
}
function recalculate(state) {
  if (state.result) {
    if (state.view === "sagittal") {
      const resolved = resolveFacing(
        state.result.landmarks,
        state.canvas.width,
        state.canvas.height,
        state.side,
        state.facingSelection,
      );
      state.facing = resolved.facing;
      state.facingSource = resolved.source;
      state.facingMessage = resolved.message;
    }
    Object.assign(
      state.result,
      analyze(
        state.result.landmarks,
        state.canvas.width,
        state.canvas.height,
        state.view,
        state.side,
        state.confirmed,
        state.facing,
      ),
    );
    const available = state.result.rows.filter(
      (row) => row.value !== null,
    ).length;
    state.section.querySelector("[data-message]").textContent =
      state.view === "sagittal" && state.facing === "unknown"
        ? `Pose detected. Action needed: choose facing direction above. ${available} of ${state.result.rows.length} measurements available.`
        : `Analysis complete. ${available} of ${state.result.rows.length} measurements available. Inspect the overlay.`;
  }
  render(state);
}
function render(state) {
  if (state.view === "sagittal") {
    const needsInput = Boolean(state.result && state.facing === "unknown");
    const status = state.section.querySelector("[data-facing-status]");
    status.textContent = state.result
      ? state.facingMessage
      : "Facing direction will be estimated automatically after analysis.";
    status.classList.toggle("needs-input", needsInput);
    state.section
      .querySelector("[data-facing]")
      .setAttribute("aria-invalid", String(needsInput));
  }
  drawOverlay(
    state.canvas,
    state.image,
    state.result?.landmarks,
    PoseLandmarker.POSE_CONNECTIONS,
    state.result,
    state.overlay,
  );
  state.section.querySelector(".legend").textContent =
    "Gold: estimated points · Green: connections · Coral: guides. " +
    guideLegend(state.result, state.overlay);
  const r = state.result;
  state.section.querySelector("[data-results]").innerHTML = r
    ? `<p><strong>${r.rows.filter((x) => x.value !== null).length} of ${r.rows.length} measurements available</strong></p><ul class="quality-notes">${r.warnings.map((w) => "<li>" + w + "</li>").join("")}</ul><details><summary>View this photo's measurements</summary>${[
        ...new Set(r.rows.map((x) => x.group)),
      ]
        .map(
          (group) =>
            `<h3>${group}</h3><table><thead><tr><th>Measurement</th><th>Value</th></tr></thead><tbody>${r.rows
              .filter((x) => x.group === group)
              .map(
                (x) =>
                  `<tr><td>${x.name}</td><td>${format(x.value, x.unit)}${x.reason ? "<small>" + x.reason + "</small>" : ""}</td></tr>`,
              )
              .join("")}</tbody></table>`,
        )
        .join("")}</details>`
    : "";
  updateSummary();
}
updateSummary();
document.querySelector("#load").onclick = async () => {
  if (loading || model) return;
  loading = true;
  const status = document.querySelector("#status");
  status.textContent =
    "Downloading the analysis model. Processing will run on this device…";
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
  } catch (error) {
    status.textContent =
      "Model could not load. Check internet access and retry. " + error.message;
  } finally {
    loading = false;
  }
};
document.querySelector("#clear").onclick = () => {
  generation++;
  for (const s of Object.values(states)) {
    s.token = (s.token || 0) + 1;
    s.image?.close();
    s.image = null;
    s.result = null;
    s.confirmed = false;
    s.side = "left";
    s.facing = "unknown";
    s.facingSource = "unknown";
    s.facingSelection = "auto";
    s.overlay = "alignment";
    s.section.querySelector("input[type=file]").value = "";
    s.section.querySelector("input[type=checkbox]").checked = false;
    for (const [selector, value] of [
      ["[data-side]", "left"],
      ["[data-facing]", "auto"],
      ["[data-overlay]", "alignment"],
    ]) {
      const el = s.section.querySelector(selector);
      if (el) el.value = value;
    }
    s.canvas.width = 0;
    s.canvas.height = 0;
    s.section.querySelector("[data-message]").textContent = "Session cleared.";
    render(s);
  }
  document.querySelector("#code").value = "";
  document.querySelector("#report-status").textContent = "";
};
function snapshot() {
  return {
    schemaVersion: 2,
    createdAt: new Date().toISOString(),
    displayDate: new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date()),
    studyCode: document.querySelector("#code").value,
    purpose: "Teaching and research only; not clinically validated",
    method: {
      model: MODEL,
      packageVersion: VERSION,
      visibilityThreshold: THRESHOLD,
      coordinates: "Aspect-corrected image x/y; z is not used",
      distanceUnit:
        "% torso: front midpoint-to-midpoint length; side selected shoulder-to-hip length",
      differences:
        "Instructed minus comfortable; percentage points for ratios; shortest modulo-180 change for front line angles",
      signs:
        "See metric definitions: front offsets image-right; heights left-higher; knee projections medial; side directional measurements anterior",
    },
    conditions: Object.fromEntries(
      CONDITIONS.map((c) => [
        c,
        Object.fromEntries(
          VIEWS.filter((v) => states[c + "-" + v].result).map((v) => [
            v,
            viewData(states[c + "-" + v]),
          ]),
        ),
      ]),
    ),
    comparisons: comparisons(),
  };
}
function download(content, type, ext) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = "posturelab." + ext;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.querySelector("#json").onclick = () =>
  download(JSON.stringify(snapshot(), null, 2), "application/json", "json");
document.querySelector("#csv").onclick = () => {
  const data = snapshot(),
    rows = [
      [
        "record_type",
        "condition",
        "view",
        "side",
        "facing",
        "confirmed",
        "metric_id",
        "metric",
        "value",
        "unit",
        "unavailable_reason",
        "facing_source",
      ],
    ];
  for (const [c, views] of Object.entries(data.conditions))
    for (const [v, s] of Object.entries(views))
      for (const r of s.rows)
        rows.push([
          "measurement",
          c,
          v,
          s.side,
          s.facing,
          s.viewConfirmed,
          r.id,
          r.name,
          r.value,
          r.unit,
          r.reason,
          s.facingSource,
        ]);
  for (const [v, metrics] of Object.entries(data.comparisons))
    for (const r of metrics)
      rows.push([
        "difference",
        "instructed_minus_comfortable",
        v,
        "",
        "",
        "",
        r.id,
        r.name,
        r.difference,
        r.unit === "% torso" ? "percentage points" : r.unit,
        r.reason,
        "",
      ]);
  const quote = (x) => '"' + String(x ?? "").replaceAll('"', '""') + '"';
  download(
    rows.map((r) => r.map(quote).join(",")).join("\r\n"),
    "text/csv;charset=utf-8",
    "csv",
  );
};
document.querySelector("#pdf").onclick = async () => {
  if (reportPending) return;
  reportPending = true;
  updateSummary();
  const status = document.querySelector("#report-status"),
    session = generation;
  status.textContent = "Preparing your student report…";
  try {
    const data = snapshot(),
      canvases = {};
    for (const s of Object.values(states)) {
      if (!s.result) continue;
      const copy = document.createElement("canvas");
      copy.width = s.canvas.width;
      copy.height = s.canvas.height;
      copy.getContext("2d").drawImage(s.canvas, 0, 0);
      canvases[s.key] = copy;
    }
    const pdf = await createStudentReport(data, canvases);
    if (session === generation) {
      pdf.save("posturelab-report.pdf");
      status.textContent =
        "Report downloaded. Store it securely and clear the session when finished.";
    }
  } catch (error) {
    if (session === generation)
      status.textContent = "Report could not be created. " + error.message;
  } finally {
    reportPending = false;
    updateSummary();
  }
};
