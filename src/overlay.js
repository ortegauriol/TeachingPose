import { point, distance } from "./metrics.js";
export const visibleGuides = (result, mode) =>
  (result?.guides ?? []).filter(
    (line) => line.mode === mode && distance(line.from, line.to) >= 1,
  );
export const guideLegend = (result, mode) =>
  visibleGuides(result, mode)
    .map((line, i) => String.fromCharCode(65 + i) + ": " + line.label)
    .join(" · ");

export function drawOverlay(
  canvas,
  image,
  landmarks,
  connections,
  result,
  mode = "alignment",
) {
  const ctx = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!image) return;
  ctx.drawImage(image, 0, 0);
  if (!landmarks) return;
  const width = Math.max(2, w / 350),
    radius = Math.max(3, w / 180);
  ctx.lineWidth = width;
  ctx.strokeStyle = "#13cda6";
  for (const { start, end } of connections) {
    const a = point(landmarks, start, w, h),
      b = point(landmarks, end, w, h);
    if (a && b) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  landmarks.forEach((_, i) => {
    const p = point(landmarks, i, w, h);
    if (p) {
      ctx.fillStyle = "#ffc857";
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  if (mode === "landmarks") return;
  const fontSize = Math.max(14, w / 28),
    boxes = [];
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.lineJoin = "round";
  for (const [index, line] of visibleGuides(result, mode).entries()) {
    ctx.setLineDash([width * 3, width * 2]);
    ctx.strokeStyle = "#ef7865";
    ctx.lineWidth = width * 1.5;
    ctx.beginPath();
    ctx.moveTo(line.from.x, line.from.y);
    ctx.lineTo(line.to.x, line.to.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const label = String.fromCharCode(65 + index),
      tw = ctx.measureText(label).width,
      x = Math.max(4, Math.min(w - tw - 12, (line.from.x + line.to.x) / 2 + 8));
    let y = Math.max(
      fontSize + 6,
      Math.min(h - 8, (line.from.y + line.to.y) / 2 - 8),
    );
    while (
      y > fontSize * 2 &&
      boxes.some(
        (b) => Math.abs(b.x - x) < tw + 12 && Math.abs(b.y - y) < fontSize + 6,
      )
    )
      y -= fontSize + 8;
    boxes.push({ x, y });
    ctx.fillStyle = "#173749";
    ctx.fillRect(x - 4, y - fontSize, tw + 8, fontSize + 5);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, x, y);
  }
}
