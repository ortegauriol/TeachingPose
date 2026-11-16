import { jsPDF } from "jspdf";
import logoUrl from "./assets/university-logo.png";
import { guideLegend } from "./overlay.js";
import { CREDIT } from "./guidance.js";
import { noteBlocks } from "./notes.js";
import { CONDITIONS, CONDITION_LABELS, VIEW_LABELS, VIEWS } from "./metrics.js";
const navy = [0, 51, 90],
  ink = [32, 50, 65],
  muted = [84, 103, 116];
const plain = (text) =>
  String(text)
    .replace(/[–—]/g, "-")
    .replace(/·/g, ";")
    .replace(/[^\x20-\x7E°]/g, "?");
function logoImage() {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      // Embed decoded pixels, avoiding jsPDF's second, synchronous URL request.
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      resolve({ data: canvas.toDataURL("image/jpeg", 0.95), width: canvas.width, height: canvas.height });
    };
    image.onerror = () =>
      reject(
        Error("The university logo could not load. Please retry the report."),
      );
    image.src = logoUrl;
  });
}
export async function createStudentReport(data, canvases) {
  const logo = await logoImage(),
    pdf = new jsPDF();
  let pages = 0;
  pdf.setProperties({
    title: "PostureLab - Student comparison report",
    author: "Dr. Pablo Ortega-Auriol",
    subject: "Automatic 2D posture observations and response to instruction",
  });
  const text = (value, x, y, size = 10, color = ink, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    pdf.text(plain(value), x, y);
  };
  const wrap = (value, x, y, width, size = 9, color = ink) => {
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(plain(value), width);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...color);
    pdf.text(lines, x, y);
    return lines.length * size * 0.4;
  };
  function page(title, subtitle) {
    if (pages++) pdf.addPage();
    pdf.setFillColor(...navy);
    pdf.rect(0, 0, 210, 4, "F");
    pdf.addImage(logo.data, "JPEG", 146, 10, 48, (48 * logo.height) / logo.width, "university-logo");
    text("POSTURELAB", 16, 17, 10, navy, true);
    text("Student posture report", 16, 31, 21, navy, true);
    text(title, 16, 43, 12, navy);
    text(subtitle, 16, 51, 9, muted);
    pdf.setDrawColor(215, 225, 231);
    pdf.line(16, 56, 194, 56);
    wrap("Study code: " + (data.studyCode || "Not supplied"), 16, 64, 112, 9);
    text(data.displayDate || data.createdAt.slice(0, 10), 148, 64, 9, muted);
  }
  const value = (x) => (x === null ? "n/a" : x.toFixed(1)),
    delta = (x) => (x === null ? "n/a" : (x > 0 ? "+" : "") + x.toFixed(1));
  for (const view of VIEWS) {
    if (!CONDITIONS.some((c) => data.conditions[c]?.[view])) continue;
    const comparison = data.comparisons[view],
      available = comparison.filter((r) => r.difference !== null).length;
    page(
      VIEW_LABELS[view] + " / photographs",
      "Comfortable standing compared with instructed anatomical standing",
    );
    CONDITIONS.forEach((c, index) => {
      const x = 16 + index * 92,
        result = data.conditions[c]?.[view],
        canvas = canvases[c + "-" + view];
      text(CONDITION_LABELS[c], x, 78, 11, navy, true);
      pdf.setFillColor(241, 245, 248);
      pdf.roundedRect(x, 83, 86, 103, 3, 3, "F");
      if (canvas) {
        const scale = Math.min(78 / canvas.width, 95 / canvas.height),
          w = canvas.width * scale,
          h = canvas.height * scale;
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.9),
          "JPEG",
          x + (86 - w) / 2,
          83 + (103 - h) / 2,
          w,
          h,
          c + "-" + view,
        );
      } else text("No analyzed photograph", x + 8, 135, 9, muted);
      if (result)
        wrap(
          guideLegend(result, result.overlayMode || "alignment"),
          x,
          193,
          86,
          8,
        );
      wrap(
        result
          ? (result.viewConfirmed
              ? "View confirmed. "
              : "View not confirmed. ") +
              (view === "sagittal"
                ? "Side: " + result.side + "; facing: " + result.facing + ". "
                : "") +
              result.rows.filter((r) => r.value !== null).length +
              "/" +
              result.rows.length +
              " measurements available."
          : "This condition has not been analyzed.",
        x,
        209,
        86,
        8,
      );
    });
    text(
      available + " of " + comparison.length + " differences available",
      16,
      227,
      11,
      navy,
      true,
    );
    wrap(
      "Differences describe a response to instruction, not automatically improvement. Camera position, body rotation and landmark uncertainty can affect the comparison.",
      16,
      234,
      178,
      9,
    );
    pdf.setFillColor(235, 242, 247);
    pdf.roundedRect(16, 249, 178, 19, 3, 3, "F");
    wrap(
      "Your interpretation: Which relationships changed together? What else would you need to answer the worksheet questions?",
      21,
      256,
      167,
      9,
    );

    page(
      VIEW_LABELS[view] + " / measurements",
      "Grouped evidence for your own interpretation",
    );
    let y = 77;
    const reasons = [
      ...new Set(comparison.map((r) => r.reason).filter(Boolean)),
    ];
    if (reasons.length) {
      y +=
        wrap(
          "Unavailable differences: " + reasons.join("; ") + ".",
          16,
          y,
          178,
          8,
          muted,
        ) + 4;
    }
    y +=
      wrap(
        "Differences = instructed minus comfortable. Distances are % torso; their differences are percentage points (pp). n/a = unavailable. No significance threshold has been established.",
        16,
        y,
        178,
        8,
        muted,
      ) + 5;
    function tableHeader() {
      pdf.setFillColor(...navy);
      pdf.rect(16, y, 178, 9, "F");
      text("Measurement / unit", 19, y + 6, 9, [255, 255, 255], true);
      text("Comfortable", 100, y + 6, 8, [255, 255, 255], true);
      text("Instructed", 135, y + 6, 8, [255, 255, 255], true);
      text("Difference", 167, y + 6, 8, [255, 255, 255], true);
      y += 15;
    }
    tableHeader();
    for (const group of [
      "Head and shoulders",
      "Trunk and hips",
      "Lower limbs",
    ]) {
      const rows = comparison.filter((r) => r.group === group);
      if (!rows.length) continue;
      if (y + 22 > 263) {
        page(
          VIEW_LABELS[view] + " / measurements continued",
          "Same definitions and signs as the preceding table",
        );
        y = 80;
        tableHeader();
      }
      text(group, 18, y, 9.5, navy, true);
      y += 6;
      for (const r of rows) {
        pdf.setFontSize(8.5);
        const lines = pdf.splitTextToSize(
            plain(r.name + " (" + r.unit + ")"),
            77,
          ),
          height = Math.max(8, lines.length * 3.5 + 2);
        if (y + height > 263) {
          page(
            VIEW_LABELS[view] + " / measurements continued",
            group + " - continued",
          );
          y = 80;
          tableHeader();
        }
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(...ink);
        pdf.text(lines, 18, y);
        text(value(r.comfortable), 104, y, 10);
        text(value(r.instructed), 139, y, 10);
        text(delta(r.difference), 171, y, 10);
        y += height;
        pdf.setDrawColor(224, 232, 236);
        pdf.line(16, y - 3, 194, y - 3);
      }
      y += 2;
    }
  }
  const blocks = noteBlocks(data.interpretation?.html || "");
  if (blocks.length) {
    const { registerNoteFonts, supportsNoteText } = await import("./note-fonts.js");
    if (!blocks.every(block => block.runs.every(run => supportsNoteText(run.text)))) {
      throw Error("Some note characters are outside the PDF font's Latin and Greek coverage. Download JSON to preserve all text, or edit those characters and retry.");
    }
    registerNoteFonts(pdf);
    page("Your interpretation", "Student observations, reasoning and questions");
    let y = 80;
    const newLine = () => {
      y += 5.5;
      if (y > 262) {
        page("Your interpretation / continued", "Student observations, reasoning and questions");
        y = 80;
      }
    };
    for (const block of blocks) {
      let x = 18;
      const runs = [{ text: block.prefix }, ...block.runs];
      for (const run of runs) {
        const style = run.bold ? (run.italic ? "bolditalic" : "bold") : (run.italic ? "italic" : "normal");
        for (const token of run.text.split(/(\s+)/).filter(Boolean)) {
          // Split very long unbroken words, retaining style across page boundaries.
          let fragment = "";
          for (const character of token) {
            pdf.setFont("PostureNotes", style);
            pdf.setFontSize(10);
            if (pdf.getTextWidth(fragment + character) > 172) {
              if (x > 18) { newLine(); x = 18; }
              draw(fragment); newLine(); x = 18; fragment = "";
            }
            fragment += character;
          }
          if (x + pdf.getTextWidth(fragment) > 190) { newLine(); x = 18; }
          if (x === 18 && !fragment.trim()) continue;
          draw(fragment);
        }
        function draw(value) {
          pdf.setFont("PostureNotes", style);
          pdf.setFontSize(10);
          pdf.setTextColor(...ink);
          pdf.text(value, x, y);
          const width = pdf.getTextWidth(value);
          if (run.underline) { pdf.setDrawColor(...ink); pdf.line(x, y + 0.8, x + width, y + 0.8); }
          x += width;
        }
      }
      newLine();
      y += 2;
    }
  }
  const count = pdf.getNumberOfPages();
  for (let n = 1; n <= count; n++) {
    pdf.setPage(n);
    text(
      "Teaching observations only. Not clinically validated. No diagnosis or normal range.",
      16,
      275,
      8,
      muted,
    );
    text(
      "Definitions and sign conventions are provided below the photo upload areas in PostureLab.",
      16,
      280,
      8,
      muted,
    );
    pdf.setDrawColor(215, 225, 231);
    pdf.line(16, 283, 194, 283);
    text(CREDIT, 16, 289, 7.5, muted);
    pdf.setFontSize(8);
    pdf.text(n + " / " + count, 194, 289, { align: "right" });
  }
  return pdf;
}
