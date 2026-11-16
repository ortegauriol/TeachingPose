export const THRESHOLD = 0.65;
export const CONDITIONS = ["comfortable", "instructed"];
export const VIEWS = ["frontal", "sagittal"];
export const CONDITION_LABELS = {
  comfortable: "Comfortable",
  instructed: "Instructed",
};
export const VIEW_LABELS = { frontal: "Front view", sagittal: "Side view" };

export function point(l, i, w, h) {
  const p = l[i];
  return p &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    p.x > 0.01 &&
    p.x < 0.99 &&
    p.y > 0.01 &&
    p.y < 0.99 &&
    (p.visibility ?? 0) >= THRESHOLD
    ? { x: p.x * w, y: p.y * h }
    : null;
}
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export function lineAngle(a, b) {
  if (distance(a, b) < 1) return null;
  let d = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  while (d > 90) d -= 180;
  while (d < -90) d += 180;
  return d;
}
export function flexion(a, b, c) {
  const u = distance(a, b),
    v = distance(c, b);
  if (u < 1 || v < 1) return null;
  const cosine =
    ((a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y)) / (u * v);
  return 180 - (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
}
// Signed perpendicular distance: positive towards the other hip (medial in this projection).
export function kneeOffset(hip, knee, ankle, otherHip) {
  const len = distance(hip, ankle),
    medial = Math.sign(otherHip.x - hip.x);
  if (len < 1 || ankle.y - hip.y < 1 || !medial) return null;
  return (
    (medial *
      ((knee.x - hip.x) * (ankle.y - hip.y) -
        (knee.y - hip.y) * (ankle.x - hip.x))) /
    len
  );
}
export const CATALOG = [
  [
    "shoulder_angle",
    "frontal",
    "Head and shoulders",
    "Shoulder-line inclination",
    "deg",
    "Estimated shoulder line to horizontal; positive slopes down to image right.",
  ],
  [
    "hip_angle",
    "frontal",
    "Trunk and hips",
    "Hip-line inclination",
    "deg",
    "Estimated hip line to horizontal; not iliac crest or ASIS/PSIS alignment.",
  ],
  [
    "ear_angle",
    "frontal",
    "Head and shoulders",
    "Ear-line inclination",
    "deg",
    "Estimated ear line to horizontal; not earlobe or cervical alignment.",
  ],
  [
    "trunk_lateral_angle",
    "frontal",
    "Trunk and hips",
    "Lateral trunk inclination",
    "deg",
    "Hip midpoint to shoulder midpoint relative to vertical; positive image right.",
  ],
  [
    "shoulder_height",
    "frontal",
    "Head and shoulders",
    "Shoulder-height difference",
    "% torso",
    "Right y minus left y; positive means estimated left shoulder is higher.",
  ],
  [
    "ear_height",
    "frontal",
    "Head and shoulders",
    "Ear-height difference",
    "% torso",
    "Right y minus left y; positive means estimated left ear is higher.",
  ],
  [
    "hip_height",
    "frontal",
    "Trunk and hips",
    "Hip-height difference",
    "% torso",
    "Right y minus left y; positive means estimated left hip is higher. Not pelvic tilt.",
  ],
  [
    "knee_height",
    "frontal",
    "Lower limbs",
    "Knee-height difference",
    "% torso",
    "Right y minus left y; positive means estimated left knee is higher. Not patellar height.",
  ],
  [
    "trunk_offset",
    "frontal",
    "Trunk and hips",
    "Trunk lateral offset",
    "% torso",
    "Shoulder midpoint x minus hip midpoint x; positive image right.",
  ],
  [
    "hip_ankle_offset",
    "frontal",
    "Trunk and hips",
    "Hip offset from ankle midpoint",
    "% torso",
    "Hip midpoint x minus ankle midpoint x; positive image right. Not weight distribution.",
  ],
  [
    "left_knee_angle",
    "frontal",
    "Lower limbs",
    "Left knee projection angle",
    "deg",
    "Hip–knee–ankle deviation from straight; positive knee displaced medially in the image. Not patellar tracking or 3D valgus.",
  ],
  [
    "right_knee_angle",
    "frontal",
    "Lower limbs",
    "Right knee projection angle",
    "deg",
    "Hip–knee–ankle deviation from straight; positive knee displaced medially in the image. Not patellar tracking or 3D valgus.",
  ],
  [
    "left_knee_offset",
    "frontal",
    "Lower limbs",
    "Left knee offset from hip–ankle line",
    "% torso",
    "Perpendicular knee displacement from hip–ankle line; positive towards the other hip.",
  ],
  [
    "right_knee_offset",
    "frontal",
    "Lower limbs",
    "Right knee offset from hip–ankle line",
    "% torso",
    "Perpendicular knee displacement from hip–ankle line; positive towards the other hip.",
  ],
  [
    "stance_width",
    "frontal",
    "Lower limbs",
    "Projected ankle separation",
    "% torso",
    "Absolute horizontal separation of ankle points; not arch shape, pronation or loading.",
  ],
  [
    "ankle_height",
    "frontal",
    "Lower limbs",
    "Ankle-height difference",
    "% torso",
    "Right y minus left y; positive means estimated left ankle is higher.",
  ],
  [
    "trunk_angle",
    "sagittal",
    "Trunk and hips",
    "Trunk inclination",
    "deg",
    "Selected hip to shoulder relative to vertical; positive anterior, using confirmed facing direction. Not spinal curvature.",
  ],
  [
    "knee_bend",
    "sagittal",
    "Lower limbs",
    "Projected knee bend",
    "deg",
    "180° minus hip–knee–ankle angle. Unsigned; cannot distinguish flexion from hyperextension.",
  ],
  [
    "ear_shoulder_offset",
    "sagittal",
    "Head and shoulders",
    "Ear–shoulder horizontal offset",
    "% torso",
    "Ear x minus shoulder x, oriented by facing; positive anterior. Not a craniovertebral angle.",
  ],
  [
    "ear_ankle_offset",
    "sagittal",
    "Head and shoulders",
    "Ear offset from ankle vertical",
    "% torso",
    "Ear displacement from image vertical through selected ankle; positive anterior. Not a centre-of-gravity line.",
  ],
  [
    "shoulder_ankle_offset",
    "sagittal",
    "Head and shoulders",
    "Shoulder offset from ankle vertical",
    "% torso",
    "Estimated shoulder displacement from selected ankle vertical; positive anterior. Not humeral-head position.",
  ],
  [
    "hip_offset",
    "sagittal",
    "Trunk and hips",
    "Hip offset from ankle vertical",
    "% torso",
    "Estimated hip displacement from selected ankle vertical; positive anterior. Not greater-trochanter position.",
  ],
  [
    "thigh_angle",
    "sagittal",
    "Lower limbs",
    "Thigh inclination",
    "deg",
    "Knee to hip relative to upward vertical; positive hip anterior to knee.",
  ],
  [
    "shank_angle",
    "sagittal",
    "Lower limbs",
    "Shank inclination",
    "deg",
    "Ankle to knee relative to upward vertical; positive knee anterior to ankle.",
  ],
].map(([id, view, group, name, unit, definition]) => ({
  id,
  view,
  group,
  name,
  unit,
  definition,
}));

export function analyze(
  landmarks,
  w,
  h,
  view,
  side = "left",
  confirmed = false,
  facing = "unknown",
) {
  const p = (i) => point(landmarks, i, w, h),
    rows = [],
    guides = [];
  const bodyIds =
    view === "frontal"
      ? [11, 12, 23, 24]
      : side === "left"
        ? [11, 23]
        : [12, 24];
  const torso = () => {
    const q = bodyIds.map(p);
    if (q.some((x) => !x)) return null;
    return view === "frontal"
      ? distance(midpoint(q[0], q[1]), midpoint(q[2], q[3]))
      : distance(q[0], q[1]);
  };
  const add = (id, ids, fn, directional = false) => {
    const meta = CATALOG.find((m) => m.id === id),
      normalized = meta.unit === "% torso";
    const required = [...new Set([...ids, ...(normalized ? bodyIds : [])])],
      points = ids.map(p);
    let reason = !confirmed
      ? "View and framing not confirmed"
      : directional && !["left", "right"].includes(facing)
        ? "Select the direction the participant faces"
        : required.some((i) => !p(i))
          ? "Missing, low visibility or out-of-frame landmark"
          : null;
    const t = normalized ? torso() : 1;
    let value = reason || t === null || t < 1 ? null : fn(...points);
    if (value !== null && normalized) value = (100 * value) / t;
    if (value !== null && !Number.isFinite(value)) value = null;
    if (value === null && !reason)
      reason = "Degenerate segment or torso reference";
    rows.push({ ...meta, value, reason, landmarks: required });
  };
  const guide = (a, b, label, mode = "alignment") => {
    if (a && b && confirmed) guides.push({ from: a, to: b, label, mode });
  };
  if (view === "frontal") {
    add("shoulder_angle", [11, 12], lineAngle);
    add("hip_angle", [23, 24], lineAngle);
    add("ear_angle", [7, 8], lineAngle);
    add("trunk_lateral_angle", [11, 12, 23, 24], (a, b, c, d) => {
      const s = midpoint(a, b),
        t = midpoint(c, d);
      return distance(s, t) < 1
        ? null
        : (Math.atan2(s.x - t.x, t.y - s.y) * 180) / Math.PI;
    });
    for (const [id, l, r] of [
      ["shoulder_height", 11, 12],
      ["ear_height", 7, 8],
      ["hip_height", 23, 24],
      ["knee_height", 25, 26],
      ["ankle_height", 27, 28],
    ])
      add(id, [l, r], (a, b) => b.y - a.y);
    add(
      "trunk_offset",
      [11, 12, 23, 24],
      (a, b, c, d) => midpoint(a, b).x - midpoint(c, d).x,
    );
    add(
      "hip_ankle_offset",
      [23, 24, 27, 28],
      (a, b, c, d) => midpoint(a, b).x - midpoint(c, d).x,
    );
    add("stance_width", [27, 28], (a, b) => Math.abs(b.x - a.x));
    for (const [label, hip, knee, ankle, other] of [
      ["left", 23, 25, 27, 24],
      ["right", 24, 26, 28, 23],
    ]) {
      add(label + "_knee_angle", [hip, knee, ankle, other], (a, b, c, d) => {
        const offset = kneeOffset(a, b, c, d),
          angle = flexion(a, b, c);
        return offset === null || angle === null
          ? null
          : Math.sign(offset) * angle;
      });
      add(label + "_knee_offset", [hip, knee, ankle, other], kneeOffset);
      const a = p(hip),
        b = p(knee),
        c = p(ankle);
      guide(a, c, label + " hip–ankle", "knees");
      if (a && b && c && distance(a, c) >= 1) {
        const u =
          ((b.x - a.x) * (c.x - a.x) + (b.y - a.y) * (c.y - a.y)) /
          distance(a, c) ** 2;
        guide(
          b,
          { x: a.x + u * (c.x - a.x), y: a.y + u * (c.y - a.y) },
          label + " knee offset",
          "knees",
        );
      }
    }
    const s = p(11) && p(12) ? midpoint(p(11), p(12)) : null,
      t = p(23) && p(24) ? midpoint(p(23), p(24)) : null,
      a = p(27) && p(28) ? midpoint(p(27), p(28)) : null;
    guide(p(11), p(12), "Shoulders");
    guide(p(23), p(24), "Hips");
    if (s && t) {
      guide(t, s, "Trunk");
      guide(s, { x: t.x, y: s.y }, "Trunk offset");
    }
    if (a && t) {
      guide(a, { x: a.x, y: h * 0.08 }, "Ankle-midpoint vertical");
      guide(t, { x: a.x, y: t.y }, "Hip offset");
    }
  } else {
    const [ear, shoulder, hip, knee, ankle] =
        side === "left" ? [7, 11, 23, 25, 27] : [8, 12, 24, 26, 28],
      sign = facing === "left" ? -1 : 1;
    const inclination = (a, b) =>
      distance(a, b) < 1
        ? null
        : (sign * Math.atan2(a.x - b.x, b.y - a.y) * 180) / Math.PI;
    add("trunk_angle", [shoulder, hip], inclination, true);
    add("knee_bend", [hip, knee, ankle], flexion);
    add(
      "ear_shoulder_offset",
      [ear, shoulder],
      (a, b) => sign * (a.x - b.x),
      true,
    );
    for (const [id, i] of [
      ["ear_ankle_offset", ear],
      ["shoulder_ankle_offset", shoulder],
      ["hip_offset", hip],
    ])
      add(id, [i, ankle], (a, b) => sign * (a.x - b.x), true);
    add("thigh_angle", [hip, knee], inclination, true);
    add("shank_angle", [knee, ankle], inclination, true);
    const a = p(ankle);
    if (a) {
      guide(a, { x: a.x, y: h * 0.06 }, "Ankle vertical");
      for (const [i, label] of [
        [ear, "Ear"],
        [shoulder, "Shoulder"],
        [hip, "Hip"],
      ]) {
        const b = p(i);
        if (b) guide(b, { x: a.x, y: b.y }, label + " offset");
      }
    }
    guide(p(hip), p(knee), "Thigh", "knees");
    guide(p(knee), p(ankle), "Shank", "knees");
  }
  const warnings = [];
  if (Math.min(w, h) < 480)
    warnings.push(
      "Low image resolution: use at least 480 pixels on the short edge.",
    );
  const required =
    view === "frontal"
      ? [0, 11, 12, 23, 24, 27, 28]
      : side === "left"
        ? [0, 7, 11, 23, 25, 27]
        : [0, 8, 12, 24, 26, 28];
  if (required.some((i) => !p(i)))
    warnings.push(
      "Full-body framing or landmark visibility is insufficient. Inspect the overlay.",
    );
  if (view === "sagittal" && !["left", "right"].includes(facing))
    warnings.push(
      "Select facing direction to interpret anterior/posterior measurements.",
    );
  warnings.push(
    "2D projections only. Camera level, view and anatomical accuracy require human review; visibility is not measurement accuracy.",
  );
  return { rows, warnings, guides, torsoLengthPixels: torso() };
}
export function compareResults(comfortable, instructed, view) {
  return CATALOG.filter((m) => m.view === view).map((meta) => {
    const a = comfortable?.rows.find((r) => r.id === meta.id),
      b = instructed?.rows.find((r) => r.id === meta.id);
    let reason =
      !comfortable || !instructed
        ? "Analyze both conditions"
        : !comfortable.viewConfirmed || !instructed.viewConfirmed
          ? "Confirm both views"
          : view === "sagittal" &&
              (comfortable.side !== instructed.side ||
                comfortable.facing !== instructed.facing ||
                !["left", "right"].includes(comfortable.facing))
            ? "Use the same anatomical side and facing direction in both photos"
            : a?.value == null || b?.value == null
              ? "Measurement unavailable in one or both conditions"
              : null;
    let difference = reason ? null : b.value - a.value;
    if (
      difference !== null &&
      ["shoulder_angle", "hip_angle", "ear_angle"].includes(meta.id)
    ) {
      while (difference > 90) difference -= 180;
      while (difference < -90) difference += 180;
    }
    return {
      ...meta,
      comfortable: a?.value ?? null,
      instructed: b?.value ?? null,
      difference,
      reason,
    };
  });
}
