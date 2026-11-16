import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, compareResults } from "../src/metrics.js";
function fixture() {
  const l = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.15,
    visibility: 1,
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
const row = (a, id) => a.rows.find((r) => r.id === id);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test("normalized offsets and bilateral medial knee signs match hand geometry", () => {
  const l = fixture();
  l[25].x = 0.4;
  l[26].x = 0.6;
  const a = analyze(l, 1000, 1000, "frontal", "left", true);
  near(row(a, "left_knee_offset").value, (100 * 50) / 300);
  near(row(a, "right_knee_offset").value, (100 * 50) / 300);
  near(
    row(a, "left_knee_angle").value,
    (2 * Math.atan(50 / 200) * 180) / Math.PI,
  );
  near(row(a, "stance_width").value, 100);
  l[25].x = 0.3;
  assert.ok(
    row(analyze(l, 1000, 1000, "frontal", "left", true), "left_knee_angle")
      .value < 0,
  );
});
test("height signs, translation and image scale preserve the defined ratios", () => {
  const l = fixture();
  l[26].y = 0.77;
  const a = analyze(l, 1000, 1000, "frontal", "left", true);
  near(row(a, "knee_height").value, (100 * 20) / 300);
  const b = analyze(l, 2000, 2000, "frontal", "left", true);
  for (const r of a.rows) near(r.value, row(b, r.id).value);
  const moved = l.map((p) => ({ ...p, x: p.x + 0.02, y: p.y - 0.02 }));
  const c = analyze(moved, 1000, 1000, "frontal", "left", true);
  for (const r of a.rows) near(r.value, row(c, r.id).value);
});
test("anatomical medial knee signs survive horizontal reflection; image-right offsets reverse", () => {
  const l = fixture();
  l[25].x = 0.4;
  l[11].x += 0.05;
  l[12].x += 0.05;
  const a = analyze(l, 1000, 1000, "frontal", "left", true),
    b = analyze(
      l.map((p) => ({ ...p, x: 1 - p.x })),
      1000,
      1000,
      "frontal",
      "left",
      true,
    );
  near(row(a, "left_knee_angle").value, row(b, "left_knee_angle").value);
  near(row(a, "trunk_offset").value, -row(b, "trunk_offset").value);
});
test("side offsets require facing direction and use selected shoulder-hip normalization", () => {
  const l = fixture();
  Object.assign(l[7], { x: 0.65 });
  Object.assign(l[11], { x: 0.6 });
  Object.assign(l[23], { x: 0.55 });
  Object.assign(l[25], { x: 0.5 });
  Object.assign(l[27], { x: 0.5 });
  const a = analyze(l, 1000, 1000, "sagittal", "left", true, "right"),
    b = analyze(l, 1000, 1000, "sagittal", "left", true, "left");
  near(row(a, "ear_ankle_offset").value, (100 * 150) / Math.hypot(50, 300));
  near(row(a, "hip_offset").value, (100 * 50) / Math.hypot(50, 300));
  near(row(a, "thigh_angle").value, (Math.atan(50 / 200) * 180) / Math.PI);
  near(row(a, "shank_angle").value, 0);
  near(row(a, "ear_ankle_offset").value, -row(b, "ear_ankle_offset").value);
  const unknown = analyze(l, 1000, 1000, "sagittal", "left", true);
  assert.equal(row(unknown, "ear_ankle_offset").value, null);
  assert.notEqual(row(unknown, "knee_bend").value, null);
  l[12].visibility = 0;
  assert.equal(
    row(
      analyze(l, 1000, 1000, "sagittal", "right", true, "right"),
      "hip_offset",
    ).value,
    null,
  );
});
test("each metric withholds missing references, clipping and degenerate geometry", () => {
  const l = fixture();
  l[11].visibility = 0;
  const a = analyze(l, 1000, 1000, "frontal", "left", true);
  assert.equal(row(a, "knee_height").value, null);
  assert.notEqual(row(a, "left_knee_angle").value, null);
  const empty = analyze(fixture(), 1000, 1000, "frontal");
  assert.ok(empty.rows.every((r) => r.value === null));
  const degenerate = fixture();
  degenerate[27] = { ...degenerate[23] };
  assert.equal(
    row(
      analyze(degenerate, 1000, 1000, "frontal", "left", true),
      "left_knee_angle",
    ).value,
    null,
  );
  l[25].x = 0;
  assert.equal(
    row(analyze(l, 1000, 1000, "frontal", "left", true), "left_knee_angle")
      .value,
    null,
  );
});
test("paired differences handle missing conditions, metadata and angular wrap", () => {
  const result = analyze(fixture(), 1000, 1000, "frontal", "left", true),
    a = { ...result, viewConfirmed: true },
    b = structuredClone(a);
  row(a, "shoulder_angle").value = 89;
  row(b, "shoulder_angle").value = -89;
  near(
    compareResults(a, b, "frontal").find((r) => r.id === "shoulder_angle")
      .difference,
    2,
  );
  assert.ok(
    compareResults(a, null, "frontal").every((r) => r.difference === null),
  );
  const s = {
    ...analyze(fixture(), 1000, 1000, "sagittal", "left", true, "right"),
    side: "left",
    facing: "right",
    viewConfirmed: true,
  };
  assert.ok(
    compareResults(s, { ...s, side: "right" }, "sagittal").every(
      (r) => r.difference === null,
    ),
  );
  assert.ok(
    compareResults(s, { ...s, facing: "left" }, "sagittal").every(
      (r) => r.difference === null,
    ),
  );
  const unconfirmed = { ...s, viewConfirmed: false };
  assert.ok(
    compareResults(s, unconfirmed, "sagittal").every(
      (r) => r.difference === null,
    ),
  );
});
