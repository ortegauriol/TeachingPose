import { jsPDF } from "jspdf";
import logoUrl from "./assets/university-logo.png";
import { CREDIT } from "./guidance.js";

const navy = [0, 51, 90],
  ink = [32, 50, 65],
  muted = [84, 103, 116];
const plain = (text) =>
  String(text)
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E°]/g, "?");
function logoImage() {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new Error(
          "The university logo could not load. Please retry the report.",
        ),
      );
    image.src = logoUrl;
  });
}

export async function createStudentReport(data, canvases) {
  const logo = await logoImage();
  const pdf = new jsPDF();
  pdf.setProperties({
    title: "PostureLab - Student posture report",
    author: "Dr. Pablo Ortega-Auriol",
    subject: "Automatic 2D posture observations for teaching",
  });
  const views = Object.entries(data.views);
  views.forEach(([view, result], page) => {
    if (page) pdf.addPage();
    pdf.setFillColor(...navy);
    pdf.rect(0, 0, 210, 4, "F");
    pdf.addImage(logo, "PNG", 146, 10, 48, (48 * logo.height) / logo.width);
    pdf.setTextColor(...navy);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("POSTURELAB", 16, 17);
    pdf.setFontSize(21);
    pdf.text("Student posture report", 16, 31);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.text(
      view === "frontal"
        ? "Front view / projected alignment"
        : "Side view / projected alignment",
      16,
      42,
    );
    pdf.setDrawColor(215, 225, 231);
    pdf.line(16, 49, 194, 49);
    pdf.setFontSize(9);
    pdf.setTextColor(...muted);
    pdf.text("STUDY CODE", 16, 58);
    pdf.text("DATE", 114, 58);
    pdf.text("VIEW CHECK", 159, 58);
    pdf.setTextColor(...ink);
    pdf.setFontSize(10);
    pdf.text(
      pdf.splitTextToSize(plain(data.studyCode || "Not supplied"), 88),
      16,
      65,
    );
    pdf.text(data.createdAt.slice(0, 10) + " UTC", 114, 65);
    pdf.text(result.viewConfirmed ? "Confirmed" : "Not confirmed", 159, 65);

    pdf.setFillColor(241, 245, 248);
    pdf.roundedRect(16, 79, 79, 137, 3, 3, "F");
    const canvas = canvases[view],
      scale = Math.min(71 / canvas.width, 129 / canvas.height);
    const width = canvas.width * scale,
      height = canvas.height * scale;
    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.9),
      "JPEG",
      16 + (79 - width) / 2,
      79 + (137 - height) / 2,
      width,
      height,
    );
    pdf.setFontSize(8);
    pdf.setTextColor(...muted);
    pdf.text("Automatic landmark overlay", 16, 222);

    pdf.setTextColor(...navy);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Your observations", 104, 84);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...muted);
    pdf.setFontSize(9);
    pdf.text(
      view === "sagittal"
        ? `Selected anatomical side: ${result.side}`
        : "Lines are measured in this photograph.",
      104,
      92,
    );
    let y = 102;
    for (const row of result.rows) {
      pdf.setTextColor(...ink);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      const label = pdf.splitTextToSize(plain(row.name), 88);
      pdf.text(label, 104, y);
      y += label.length * 4.3 + 2;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.text(
        row.value === null
          ? "Unavailable"
          : `${row.value.toFixed(1)} ${row.unit === "deg" ? "degrees" : "% torso length"}`,
        104,
        y,
      );
      y += 5;
      if (row.reason) {
        pdf.setFontSize(8);
        pdf.setTextColor(...muted);
        const reason = pdf.splitTextToSize(plain(row.reason), 88);
        pdf.text(reason, 104, y);
        y += reason.length * 3.5;
      }
      pdf.setDrawColor(224, 232, 236);
      pdf.line(104, y + 1, 194, y + 1);
      y += 7;
    }
    // A short, bounded checklist keeps quality information readable without spilling into the footer.
    const available = result.rows.filter((row) => row.value !== null).length;
    const quality = [
      `${available} of ${result.rows.length} measurements available.`,
      result.warnings.some((w) => w.startsWith("Low image"))
        ? "Low resolution: consider retaking this photo."
        : "",
      result.warnings.some((w) => w.startsWith("Full-body"))
        ? "Some body landmarks are obscured or outside the usable frame."
        : "Check that the overlay follows the visible body.",
    ]
      .filter(Boolean)
      .join(" ");
    pdf.setFillColor(235, 242, 247);
    pdf.roundedRect(16, 231, 178, 35, 3, 3, "F");
    pdf.setTextColor(...navy);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("Reflect on what you see", 21, 239);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...ink);
    pdf.text(
      pdf.splitTextToSize(
        quality +
          " What do you notice, and how might camera position or body rotation affect it?",
        167,
      ),
      21,
      245,
    );

    pdf.setTextColor(...muted);
    pdf.setFontSize(8);
    pdf.text(
      "2D teaching observations only. Not clinically validated. No normal range or diagnosis.",
      16,
      274,
    );
    pdf.text(
      "Positive = image right; line slopes down-right. Knee angle is unsigned; it cannot identify hyperextension.",
      16,
      279,
    );
    pdf.setDrawColor(215, 225, 231);
    pdf.line(16, 283, 194, 283);
    pdf.setFontSize(7.5);
    pdf.text(CREDIT, 16, 289);
    pdf.text(`${page + 1} / ${views.length}`, 194, 289, { align: "right" });
  });
  return pdf;
}
