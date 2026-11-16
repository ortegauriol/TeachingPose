export const CREDIT =
  "Adapted and created by Dr. Pablo Ortega-Auriol, Research Fellow";

export const DEFINITIONS = [
  [
    "Frontal",
    "Shoulder-line inclination",
    "Angle of the estimated shoulder line to image horizontal. Positive slopes down towards image right.",
  ],
  [
    "Frontal",
    "Hip-line inclination",
    "Angle of the estimated hip line to image horizontal. This is not ASIS/PSIS pelvic tilt.",
  ],
  [
    "Frontal",
    "Ear-line inclination",
    "Angle of the estimated ear line to image horizontal. This describes a projected line, not cervical spine alignment.",
  ],
  [
    "Frontal",
    "Lateral trunk inclination",
    "Line from the hip midpoint to the shoulder midpoint relative to image vertical. Positive leans towards image right.",
  ],
  [
    "Sagittal",
    "Trunk inclination",
    "Line from the selected hip to shoulder relative to image vertical. Positive leans towards image right; this does not necessarily mean forwards.",
  ],
  [
    "Sagittal",
    "Projected knee flexion",
    "180° minus the hip–knee–ankle angle on the selected side. Zero is a straight projected line. The unsigned angle cannot distinguish flexion from hyperextension.",
  ],
  [
    "Sagittal",
    "Ear–shoulder horizontal offset",
    "Horizontal ear-to-shoulder displacement divided by shoulder-to-hip length × 100. Positive is image right. This is not a craniovertebral angle.",
  ],
];

export function guidanceHTML(threshold) {
  return `<section class="guidance" aria-labelledby="guidance-title">
    <p class="eyebrow">PHOTO GUIDE &amp; MEASUREMENT NOTES</p>
    <h2 id="guidance-title">Understand your photographs</h2>
    <div class="guide-grid"><div><h3>Before you upload</h3><ol>
      <li>Obtain consent. Use one adult participant, suitable fitted clothing and no footwear; include the whole body.</li>
      <li>Keep the camera level and facing the participant squarely, at approximately torso height. Use good lighting and a plain background.</li>
      <li>Take a front-facing photo and a true side-view photo. Avoid mirrored images. Select the visible anatomical side for the side view.</li>
      <li>Use JPEG, PNG or WebP, up to 20 MB and 40 megapixels. Images are reduced to a maximum 1800-pixel edge for analysis.</li>
    </ol></div><div><h3>After analysis</h3><p>The estimator places every landmark automatically. Check the overlay visually; there is no manual placement or correction. If it misses the body, retake the photo.</p><p>A result marked <strong>Unavailable</strong> has insufficient landmarks or an unconfirmed view. It is not a zero result.</p><p>These are descriptive 2D projections for teaching. They do not diagnose a condition, explain pain, or establish a normal range.</p></div></div>
    <details open><summary>What each measurement means</summary><div class="table-scroll"><table><thead><tr><th>View</th><th>Measurement</th><th>Definition</th></tr></thead><tbody>${DEFINITIONS.map(([v, n, d]) => `<tr><td>${v}</td><td>${n}</td><td>${d}</td></tr>`).join("")}</tbody></table></div></details>
    <details><summary>Technical method, horizontal reference and limits</summary>
      <p>Horizontal and vertical follow the photo edges. Gravity is not measured and camera roll is not corrected automatically. A level camera is essential. Pixel x/y coordinates are scaled by image width/height before geometry; this corrects aspect ratio, not perspective.</p>
      <p>Line inclinations are wrapped to ±90°. Landmark visibility must be at least ${threshold}; visibility is a model score, not a probability that a measurement is accurate. Coordinates must lie inside the 1% image margin and measured segments must exceed one pixel.</p>
      <p>The model estimates shoulders, hips, knees, ankles and ears. It does not identify C7, ASIS/PSIS, scapular borders, patellar tracking or vertebral curvature. It cannot provide anatomical pelvic tilt, thoracic kyphosis, lumbar lordosis or clinical leg length from these photos.</p>
      <p>No reference range has been established for this tool. Left/right are anatomical labels; numerical signs refer to image direction. Body rotation, clothing, occlusion and camera position affect the results.</p>
    </details>
    <details><summary>Privacy and downloads</summary><p>Photos and session data stay in browser memory until cleared or the page is reloaded. There is no image upload or automatic saving. The model and WebAssembly download from external hosts. The PDF explicitly saves annotated photos to your device; CSV and JSON save derived data. Treat downloads as potentially identifiable and store or delete them appropriately.</p></details>
  </section>`;
}
