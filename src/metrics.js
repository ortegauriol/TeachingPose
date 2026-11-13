export const THRESHOLD = 0.65;
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
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
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
export function analyze(
  landmarks,
  w,
  h,
  view,
  side = "left",
  confirmed = false,
) {
  const p = (i) => point(landmarks, i, w, h),
    rows = [];
  const add = (name, unit, ids, fn) => {
    const points = ids.map(p);
    let reason = !confirmed
      ? "View and framing not confirmed"
      : points.some((x) => !x)
        ? "Missing, low visibility or out-of-frame landmark"
        : null;
    let value = reason ? null : fn(...points);
    if (value === null && !reason) reason = "Degenerate geometry";
    rows.push({ name, unit, value, reason, landmarks: ids });
  };
  if (view === "frontal") {
    add("Shoulder-line inclination", "deg", [11, 12], lineAngle);
    add("Hip-line inclination", "deg", [23, 24], lineAngle);
    add("Ear-line inclination", "deg", [7, 8], lineAngle);
    add("Lateral trunk inclination", "deg", [11, 12, 23, 24], (a, b, c, d) => {
      const s = mid(a, b),
        t = mid(c, d);
      return distance(s, t) < 1
        ? null
        : (Math.atan2(s.x - t.x, t.y - s.y) * 180) / Math.PI;
    });
  } else {
    const ids = side === "left" ? [7, 11, 23, 25, 27] : [8, 12, 24, 26, 28];
    add("Trunk inclination", "deg", [ids[1], ids[2]], (s, t) =>
      distance(s, t) < 1
        ? null
        : (Math.atan2(s.x - t.x, t.y - s.y) * 180) / Math.PI,
    );
    add("Projected knee flexion", "deg", ids.slice(2), flexion);
    add(
      "Ear–shoulder horizontal offset",
      "% torso length",
      ids.slice(0, 3),
      (e, s, t) =>
        distance(s, t) < 1 ? null : (100 * (e.x - s.x)) / distance(s, t),
    );
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
  warnings.push(
    "View, camera roll, blur and anatomical accuracy require human review; visibility is not measurement accuracy.",
  );
  return { rows, warnings };
}
