import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, flexion, lineAngle } from "../src/metrics.js";
test("straight and bent projected knee", () => {
  assert.equal(flexion({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 20 }), 0);
  assert.equal(flexion({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }), 90);
});
test("line orientation independent of endpoint order", () => {
  assert.equal(lineAngle({ x: 10, y: 10 }, { x: 0, y: 10 }), 0);
});
test("pixel aspect ratio and confidence gating", () => {
  const l = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 1,
  }));
  l[11] = { x: 0.2, y: 0.2, visibility: 1 };
  l[12] = { x: 0.8, y: 0.3, visibility: 1 };
  const a = analyze(l, 1000, 500, "frontal", "left", true);
  assert.ok(Math.abs(a.rows[0].value - 4.76364) < 0.001);
  l[11].visibility = 0.1;
  assert.equal(
    analyze(l, 1000, 500, "frontal", "left", true).rows[0].value,
    null,
  );
});
test("unconfirmed view, clipping and degenerate geometry withheld", () => {
  const l = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 1,
  }));
  assert.equal(analyze(l, 1000, 500, "frontal").rows[0].value, null);
  assert.equal(
    analyze(l, 1000, 500, "frontal", "left", true).rows[0].value,
    null,
  );
  l[11].x = 0;
  assert.equal(
    analyze(l, 1000, 500, "frontal", "left", true).rows[0].value,
    null,
  );
});
