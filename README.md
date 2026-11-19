# PostureLab / TeachingPose

**Android branch:** this branch adds a standalone Android test app with bundled offline models, native camera/photo selection and native save/share controls. See [ANDROID.md](ANDROID.md) for APK installation, privacy, build steps and device checks. The browser prototype is retained on `feat/posturelab-prototype`.

Automatic 2D posture observations for undergraduate teaching and research. **Not clinically validated. No diagnostic classifications, normal ranges or meaningful-change thresholds.** All landmarks are placed by MediaPipe, with no manual editing.

## Student workflow

1. Obtain consent and photograph comfortable standing without coaching.
2. Photograph the course's instructed anatomical standing position.
3. Upload front and side views of each condition (four independent slots). Keep the camera level, square to the participant and at the same position/distance/lens setting. Use full-body, unmirrored images.
4. The default MediaPipe Pose Full model loads automatically when the app opens. Wait for “Model ready,” confirm each view, and select the visible anatomical side for each side photo. Facing direction is estimated automatically; check the displayed estimate and override it only if needed.
5. Analyze each photo. Choose body-alignment guides, lower-limb guides or landmarks only. Gold points/green connections show the automatic pose; coral guides and letter keys explain measurement references.
6. Compare comfortable/instructed results, then develop your own interpretation. Partial sessions are supported. Failed detection requires a retake; no manual landmark correction is provided.
7. Download a student PDF, CSV or JSON, then clear the session.

Photo guidance, definitions, normalization and sign conventions are directly below the upload areas. Comparisons are grouped into head/shoulders, trunk/hips and lower limbs. A difference describes a response to instruction, not automatically improvement.

The photo workflow uses continuous vertical columns: comfortable standing (pale blue) and instructed standing (pale green), with front then side view in each. On mobile the complete comfortable workflow precedes the instructed workflow.

Model settings is an optional, collapsed section. Choose Full, Lite or Heavy and click Load selected model to switch; selecting an option alone does not load it. Analysis is disabled while a model loads, and a visible Retry model loading button appears after a failure. A failed replacement preserves the working model and existing results. A successful replacement releases the old model and clears all measurements/overlays, preserving photos, confirmations and interpretation notes for reanalysis. Reload starts with Full again. JSON records the model variant/URL globally and for each analyzed photo; CSV has an additional model_variant column. All variants use the same 33-landmark layout; switching does not establish anatomical accuracy or clinical validation.

## Measurements

**Front view (16):** shoulder, hip and ear line inclinations; lateral trunk inclination; shoulder, ear, hip, knee and ankle height differences; trunk lateral offset; hip offset relative to ankle midpoint; left/right knee projection angles; left/right knee offsets from hip–ankle lines; projected ankle separation.

**Side view (8):** trunk inclination; unsigned projected knee bend; ear–shoulder offset; ear, shoulder and hip offsets from ankle vertical; thigh and shank inclination.

Distances use percentages of torso length. Front reference: shoulder-midpoint to hip-midpoint distance. Side reference: selected shoulder-to-hip distance. Each photo uses its own reference; ratios are affected by projection and are not millimetres.

Front height differences are right y minus left y (positive = estimated left point higher). Front trunk/hip offsets are positive image-right. Knee projection angles/offsets are positive medially towards the other hip, using the projected hip–ankle line. Side directional measures are positive anterior using the selected facing direction; they use automatic facing detection or a selected override; uncertain direction asks for a choice. Side knee bend is unsigned and does not distinguish flexion from hyperextension.

All geometry uses image x/y scaled by image width/height. Visibility must be at least 0.65, coordinates must be inside the 1% image margin, and measured references must exceed one pixel. Visibility is not measurement accuracy. Missing/low-visibility/clipped landmarks, unconfirmed view or degenerate geometry withhold the affected values.

Differences are instructed minus comfortable. Ratio differences are percentage points. Front horizontal-line angle changes use the shortest difference modulo 180 degrees. Differences are withheld when either value is unavailable, either view is unconfirmed, or side-view photos have mismatched/unknown facing or mismatched anatomical side.

These estimates do not locate patellar centres, ASIS/PSIS, iliac crests, scapular borders, C7 or individual vertebrae. They cannot determine patellar tracking, 3D knee valgus, spinal curves, anatomical pelvic tilt, foot arches/pronation, Achilles alignment, loading or leg-length discrepancy. Camera roll is not measured or corrected; human view review remains required.

## Exports and privacy

The student PDF pairs annotated photos and provides grouped comparisons plus reflection prompts. A rich-text interpretation editor supports bold, italic, underline and bullet/numbered lists. Notes appear on separate paginated PDF pages and in JSON; a notes-only PDF/JSON is also allowed. CSV remains a measurement table. Missing photos/results are labelled. Display values have one decimal place; exports retain calculated values. PDF embeds decoded logo pixels instead of requesting the logo synchronously, so report creation works when synchronous asset requests are blocked.

Notes use lazily loaded DejaVu Sans subsets (regular/bold/italic/bold-italic), retaining Latin accents/macrons, Greek and common punctuation. The font license is in src/assets/LICENSE_DEJAVU.txt. Characters outside this coverage produce an explanatory error instead of silent text loss; JSON preserves all Unicode text.

JSON **schemaVersion 2** replaces the previous top-level views with:

- conditions.comfortable.frontal / sagittal
- conditions.instructed.frontal / sagittal
- comparisons.frontal / sagittal, keyed by stable metric IDs
- interpretation: sanitized html, plain text, formatted blocks and local draft timestamp (additive schema v2 field)

Each available photo includes resolved facing direction, its automatic/selected/unknown source, the selector setting, and other metadata, automatic landmarks, results, definitions, guide coordinates and quality warnings; no pixels or original filenames. CSV includes measurement/difference record types, condition/view/side/facing metadata, metric IDs, units and unavailable reasons. Missing values are null in JSON and blank in CSV; zero remains a real value.

Photos, landmarks and measurements stay in page memory until clear/reload. Only interpretation notes and study code are auto-saved to localStorage under posturelab.interpretation.v1: one draft per browser origin, saved after one second without typing, every 30 seconds while dirty, on blur and when leaving/hiding the page. Reload restores the notes and code, not photos/results. A visible status reports saving, restoration and failures; if storage is blocked/full, PDF and JSON still include current notes. Clearing the session or the notes draft removes the saved draft and cancels pending saves. Avoid identifying details and clear drafts on shared computers. Drafts are device-local, not synchronized or guaranteed against browser-data deletion. Paste inserts text only; persisted/exported formatting uses a rebuilt text-only HTML vocabulary with no attributes, links, scripts or media.

No backend, image upload, analytics or automatic image collection. Model/WASM downloads disclose normal connection metadata to their hosts, not photo pixels. Explicit PDF export saves images and notes; exports may identify people. Do not commit participant images to this public repository. Automated test examples use synthetic diagrams/landmarks only.

## Open in StackBlitz

Open https://stackblitz.com/github/ortegauriol/TeachingPose/tree/feat/posturelab-prototype . Use desktop Chrome/Edge. Run npm ci, then npm run dev; open port 5173. If embedded preview has trouble, open the preview in a new tab. Model loading needs access to cdn.jsdelivr.net and storage.googleapis.com.

After merging, https://stackblitz.com/github/ortegauriol/TeachingPose will use the default branch. Do not paste these files over the separate Google demonstration workspace.

## Local development and checks

Use Node 22 LTS.

```sh
npm ci
npm test
npm run build
npm run dev
```

Run npx playwright test for Edge integration checks on Windows. Elsewhere remove channel from playwright.config.js and install Playwright Chromium. Tests check hand-derived geometry, normalization, anatomical/image signs, null gating, angular wrapping, partial/mismatched comparisons, replacement/clearing, responsive layout, JPEG reports with synchronous requests blocked, rich-text restoration/clearing, 30-second backups, storage failures, sanitized drafts, exports, automatic model startup/retry, explicit switching/failure recovery, model provenance, and real Full/Lite model load/no-person rejection. Synthetic landmark tests validate software behavior, not anatomical accuracy.

Representative consented-photo repeatability studies remain necessary, including different body types, clothing, camera rotation, selected sides and occlusion. Inference is synchronous per still image and may briefly block the interface.

## Branding and provenance

University of Auckland primary PNGs were supplied by the user and included unchanged. Credit: **Adapted and created by Dr. Pablo Ortega-Auriol, Research Fellow**. No additional qualifications, department or institutional endorsement are asserted.

The connected repository was initially empty with intended default main and write access. A README baseline was initialized before the feature branch. The supplied screenshot showed a separate google-ai-edge/mediapipe-samples-web StackBlitz import; those demo files were not overwritten.

MediaPipe documentation: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker

Automatic facing is an image-space nose/ear heuristic with visibility gating, a separation threshold of max(2 pixels, 4% torso length), and a conflict check against the other visible ear. This orientation estimate needs visual review and is not clinically validated. New/replacement photos reset the selector to automatic. An explicit direction override recalculates stored landmarks immediately, without repeating inference. CSV includes facing_source.
