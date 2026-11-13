# PostureLab / TeachingPose

First prototype for undergraduate teaching and research. **Not clinically validated; no diagnosis or normative classifications.** MediaPipe Pose inference, annotations and exports run on the user's device.

## Repository provenance

On 13 November 2026 the connected repository was empty, with intended default branch `main` and write access. A README-only baseline was initialized before developing `feat/posturelab-prototype`. The screenshot showed a separate StackBlitz import of `google-ai-edge/mediapipe-samples-web`; those files had not been pushed here. This independent app does not replace that workspace.

## Open in StackBlitz

1. Open https://stackblitz.com/github/ortegauriol/TeachingPose/tree/feat/posturelab-prototype . Use this branch until the PR is merged.
2. Allow WebContainers to start. Use desktop Chromium and open the preview in a new tab if the embedded preview has trouble. Do not paste these files over the Google demo.
3. Run `npm ci`, then `npm run dev` in the terminal. Open the port 5173 preview.
4. Click **Load local analysis model**. Internet access to `cdn.jsdelivr.net` and `storage.googleapis.com` is required for WASM/model downloads. Package and WASM versions match; the full float16 version 1 model is used.
5. Upload frontal and sagittal JPEG/PNG/WebP photographs (maximum 20 MB and 40 MP). Browser decoding handles orientation; images are reduced to a maximum 1800-pixel edge. Verify orientation visually.
6. Confirm each view and choose the visible anatomical side for sagittal analysis. Click **Analyze photograph** in each panel and inspect the numbered overlay.
7. Download CSV measurements, JSON landmarks/measurements, or a PDF with annotated photos. Use **Clear session** afterward.

After merging, use https://stackblitz.com/github/ortegauriol/TeachingPose . If StackBlitz shows the Google demo, open the feature-branch link above in a fresh project.

## Local development and verification

Use Node 22 LTS.

```sh
npm ci
npm test
npm run build
npm run dev
```

Browser smoke tests: `npx playwright test`. Configuration uses installed Microsoft Edge on Windows; elsewhere remove `channel` and run `npx playwright install chromium`. Tests cover input validation, session clearing, real model loading/no-person rejection, and CSV/JSON/PDF downloads with synthetic landmarks. They do not establish clinical accuracy.

Manual acceptance: test a no-person photo (no pose), multi-person photo (reject when multiple detected), cropping/occlusion (unavailable metrics), both sagittal sides, unchecked view (unavailable), replacement uploads (old data removed), and all exports. Compare PDF/CSV/JSON values with the screen. Detector counts are model estimates; human review must ensure one person. Positive-person inference and PDF layout require representative consented photographs before classroom use.

## Acquisition and measurement definitions

Use one consenting adult, full body, level camera at torso height, neutral stance, good light and plain background. Avoid mirrored photos. View confirmation is a human check, not automatic validation of the plane, camera roll or anatomical correctness.

Only image-coordinate x/y are used, scaled by width/height before geometry. This corrects aspect ratio, not perspective. No mm/cm are estimated.

| View     | Metric                                  | Definition                                                                                |
| -------- | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| Frontal  | Shoulder, hip and ear line inclinations | Angle to image horizontal wrapped to ±90°, positive downward toward image right           |
| Frontal  | Lateral trunk inclination               | Mid-hip to mid-shoulder relative to vertical, positive image-right                        |
| Sagittal | Trunk inclination                       | Selected hip to shoulder relative to vertical, positive image-right                       |
| Sagittal | Projected knee flexion                  | 180° minus hip–knee–ankle angle, unsigned; cannot distinguish hyperextension              |
| Sagittal | Ear–shoulder horizontal offset          | Signed image-right offset / selected shoulder–hip length × 100; not craniovertebral angle |

Visibility must be ≥0.65, finite x/y must be inside the 1% image margin, and segments must exceed one pixel. Unconfirmed view, missing/low-visibility/clipped landmarks or degenerate geometry produce null JSON and blank CSV values with reasons. Low resolution/full-body warnings prompt review. Thresholds are prototype heuristics, not validated confidence intervals. No automatic blur/view classification is claimed. Camera roll, rotation, occlusion, clothing and model bias affect results. Hip landmarks cannot estimate anatomical pelvic tilt; ear/shoulder landmarks are model estimates, not palpated markers.

## Privacy

No backend, image upload, localStorage, IndexedDB, service worker or analytics. Photos and derived data live in page memory until clear/reload. Replacement closes old bitmaps. External model/WASM requests disclose ordinary connection metadata, never photo pixels. Browser infrastructure may cache model/code assets. Explicit PDF export saves annotated images; JSON includes potentially sensitive landmarks and study code. Use no names or identifying study codes. Protect/delete exported files yourself. Never commit participant photos to this public repository.

## Sources and limitations

- MediaPipe IMAGE mode and browser API: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- Output definitions: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker

Still-image inference is synchronous and may briefly block the interface. A worker and formal reliability/validity study are future work.
