# PostureLab Android test app

This branch packages the current teaching prototype as a standalone Android app. It is a teaching/research prototype, not a clinically validated assessment or a diagnostic product. Adapted and created by Dr. Pablo Ortega-Auriol, Research Fellow.

## Install and test

1. Open the **Android test APK** workflow run for `feat/posturelab-android` in GitHub Actions.
2. Download the **posturelab-android-debug** artifact and extract `app-debug.apk`.
3. Transfer the APK to an Android phone (Android 7/API 24 or newer), open it, and permit installation from that source if Android asks. No Google Play listing is required for this test build.
4. Open **PostureLab**. Full initializes automatically; all three models and their WebAssembly runtime are included, so analysis can work in airplane mode. Keep Android System WebView updated.
5. Choose or take comfortable front/side photographs, then repeat for instructed standing. Review orientation, framing and the estimated landmarks, confirm the views and analyze. Side-facing estimation and all existing quality gates still apply.
6. Add your interpretation and use **Save PDF report**, **Save CSV**, **Save JSON**, or **Share PDF report**. Save lets you choose the destination. The share sheet does not confirm whether the recipient app actually completed a transfer.
7. Check that your export is present/readable, then **Clear session** before another participant uses the phone.

Test APKs use a development signing key. A future build from a different build machine may require uninstalling the previous test version first; uninstalling removes its local notes. Export notes before uninstalling. A production release needs a securely managed signing identity and a separate release process.

## What stays on the device

- No image upload, backend, analytics or cloud draft synchronization is added. The Android content policy permits bundled resources and blocks external fetches. Full/Lite/Heavy all run locally on CPU.
- Selected gallery originals are not modified or copied into a participant-photo collection. Android returns a selected content URI; the app reads it into memory, corrects EXIF orientation and reduces the longest edge to 1800 pixels. The existing 40-megapixel limit is checked before decoding. HEIC support depends on the phone's decoder.
- The system camera uses a temporary private capture file, deleted after decoding or cancellation. Interrupted captures are removed on a fresh launch; stale captures are also cleaned on plugin initialization. The chosen camera app may have its own behavior.
- Loaded photos, landmarks and measurements remain in app memory. Closing/reloading, Android terminating the app, or a failed process restoration can discard them. Notes and study code retain the existing local autosave. Backups and device-transfer extraction are disabled for app data.
- Saving an export is an explicit action and can write annotated photographs to the selected destination. Sharing creates a private cached report and grants the recipient access only to that file. **Clear session** removes cached shares; stale share copies are removed after 24 hours when the plugin next initializes. Files saved elsewhere or copied by another app must be managed separately.
- Native bridge logging is disabled so base64 report/photo data is not written to Capacitor's debug logs. Do not use identifiable participant data in automated tests.

## Build from source

Use Node 22+, JDK 21, Android SDK 36/build-tools 36.0.0, and Android Studio 2025.2.1 or newer. Java/SDK tools are not required just to use the desktop browser app.

```text
npm ci
npm test
npm run android:sync
```

The sync command checks the pinned SHA-256 model hashes, downloads missing official model files, copies the pinned MediaPipe WebAssembly files, builds the Android web assets with the offline content policy, and synchronizes the native project. Generated model/web assets are ignored by Git; they are packaged into the APK at build time. Model sources/checksums are recorded in `android-models.json`, and redistribution notices are included in the app's assets.

On Windows:

```text
cd android
.\gradlew.bat assembleDebug lintDebug
```

On macOS/Linux:

```text
cd android
./gradlew assembleDebug lintDebug
```

The APK is at `android/app/build/outputs/apk/debug/app-debug.apk`. `npm run android:open` opens the native project; `npm run android:run` installs on a connected device/emulator after syncing. No hosted server or live-development URL is configured in the APK. The normal `npm run dev` / `npm run build` commands continue to build the browser version.

## Verification

- `npm test`: projected geometry, signs, normalization and quality gates.
- `npx playwright test`: browser workflows plus a mocked Android bridge test for photo selection/cancellation, camera failure, native export encoding, PDF save/share, save cancellation, local-draft privacy and cache-clear requests.
- After `npm run android:sync`, `npx playwright test --config playwright.bundled.config.js`: real Full/Lite/Heavy loading and no-person rejection, external network requests blocked, report generation under the Android content policy.
- GitHub Actions: compile and lint the native code, upload a debug APK, install it in an Android emulator, disable Wi-Fi/data, connect to its debug WebView and test automatic Full/Lite loading, note recovery and native PDF/JSON destination-picker exports. Smoke output is a separate artifact.

Before classroom distribution, test on the intended physical phones: select JPEG/HEIC/rotated photos; take/cancel camera captures; rotate the screen; test low-memory/background interruption; confirm all four photo slots and the visible-side/facing controls; open saved PDFs/CSV/JSON; confirm share recipients can read their files; clear notes and temporary files; and test airplane mode. Emulator/geometry checks are software verification, not clinical or anatomical validation.
