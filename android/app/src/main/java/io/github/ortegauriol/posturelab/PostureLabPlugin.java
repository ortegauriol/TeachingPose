package io.github.ortegauriol.posturelab;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import androidx.exifinterface.media.ExifInterface;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.UUID;

/** Native I/O only. Landmark inference remains in the bundled browser runtime. */
@CapacitorPlugin(name = "PostureLab")
public class PostureLabPlugin extends Plugin {
    private File captureFile;
    private byte[] pendingExport;
    private boolean photoPending;

    private File captureDirectory() { return new File(getContext().getCacheDir(), "posturelab-capture"); }
    private File exportDirectory() { return new File(getContext().getCacheDir(), "posturelab-exports"); }

    @Override public void load() {
        // Interrupted captures are temporary, never a persistent participant-photo library.
        deleteFiles(captureDirectory(), System.currentTimeMillis() - 10L * 60 * 1000);
        deleteFiles(exportDirectory(), System.currentTimeMillis() - 24L * 60 * 60 * 1000);
    }

    public static void removeInterruptedCaptures(Context context) {
        deleteFiles(new File(context.getCacheDir(), "posturelab-capture"), 0);
    }

    private static boolean deleteFiles(File directory, long olderThan) {
        File[] files = directory.listFiles();
        if (files == null) return true;
        boolean removed = true;
        for (File file : files) {
            if (file.isFile() && (olderThan == 0 || file.lastModified() < olderThan) && !file.delete()) removed = false;
        }
        return removed;
    }

    @PluginMethod public void pickPhoto(PluginCall call) {
        if (photoPending) { call.reject("Finish selecting the current photograph first."); return; }
        photoPending = true;
        Intent intent = Build.VERSION.SDK_INT >= 33
            ? new Intent(MediaStore.ACTION_PICK_IMAGES)
            : new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try { startActivityForResult(call, intent, "pickedPhoto"); }
        catch (Exception error) { photoPending = false; call.reject("The photo picker could not open.", error); }
    }

    @ActivityCallback private void pickedPhoto(PluginCall call, ActivityResult result) {
        if (call == null) { photoPending = false; return; }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) { cancelPhoto(call); return; }
        if (!"content".equals(uri.getScheme())) { photoPending = false; call.reject("Choose a local photograph."); return; }
        getBridge().execute(() -> deliverPhoto(call, uri, false));
    }

    @PluginMethod public void takePhoto(PluginCall call) {
        if (photoPending) { call.reject("Finish selecting the current photograph first."); return; }
        photoPending = true;
        try {
            File directory = captureDirectory();
            if (!directory.exists() && !directory.mkdirs()) throw new Exception("Camera cache unavailable");
            captureFile = File.createTempFile("capture-", ".jpg", directory);
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", captureFile);
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, uri);
            intent.setClipData(ClipData.newRawUri("Temporary PostureLab photograph", uri));
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(call, intent, "capturedPhoto");
        } catch (Exception error) {
            cleanupCapture(); photoPending = false;
            call.reject("The camera could not open. You can choose an existing photograph instead.", error);
        }
    }

    @ActivityCallback private void capturedPhoto(PluginCall call, ActivityResult result) {
        if (call == null) { cleanupCapture(); photoPending = false; return; }
        if (result.getResultCode() != Activity.RESULT_OK || captureFile == null) { cancelPhoto(call); return; }
        getBridge().execute(() -> deliverPhoto(call, Uri.fromFile(captureFile), true));
    }

    private void cancelPhoto(PluginCall call) {
        boolean removed = cleanupCapture(); photoPending = false;
        if (!removed) { call.reject("The temporary capture could not be deleted. Clear the app's storage before sharing this device."); return; }
        JSObject response = new JSObject(); response.put("cancelled", true); call.resolve(response);
    }

    private boolean cleanupCapture() {
        if (captureFile != null && captureFile.exists() && !captureFile.delete()) return false;
        captureFile = null;
        return true;
    }

    private InputStream open(Uri uri) throws Exception {
        InputStream stream = getContext().getContentResolver().openInputStream(uri);
        if (stream == null) throw new Exception("Photograph could not be read");
        return stream;
    }

    private void deliverPhoto(PluginCall call, Uri uri, boolean captured) {
        Bitmap bitmap = null;
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options(); bounds.inJustDecodeBounds = true;
            try (InputStream stream = open(uri)) { BitmapFactory.decodeStream(stream, null, bounds); }
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw new Exception("Unsupported or damaged photograph");
            if ((long) bounds.outWidth * bounds.outHeight > 40000000L) throw new Exception("Image exceeds 40 megapixels. Use a lower camera resolution or resize it first.");
            int orientation;
            try (InputStream stream = open(uri)) { orientation = new ExifInterface(stream).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL); }
            BitmapFactory.Options options = new BitmapFactory.Options(); options.inSampleSize = 1;
            while (Math.max(bounds.outWidth, bounds.outHeight) / (options.inSampleSize * 2) >= 1800) options.inSampleSize *= 2;
            try (InputStream stream = open(uri)) { bitmap = BitmapFactory.decodeStream(stream, null, options); }
            if (bitmap == null) throw new Exception("Photograph could not be decoded");
            float scale = Math.min(1f, 1800f / Math.max(bitmap.getWidth(), bitmap.getHeight()));
            Matrix matrix = new Matrix();
            switch (orientation) {
                case ExifInterface.ORIENTATION_FLIP_HORIZONTAL: matrix.setScale(-1, 1); break;
                case ExifInterface.ORIENTATION_ROTATE_180: matrix.setRotate(180); break;
                case ExifInterface.ORIENTATION_FLIP_VERTICAL: matrix.setScale(1, -1); break;
                case ExifInterface.ORIENTATION_TRANSPOSE: matrix.setRotate(90); matrix.postScale(-1, 1); break;
                case ExifInterface.ORIENTATION_ROTATE_90: matrix.setRotate(90); break;
                case ExifInterface.ORIENTATION_TRANSVERSE: matrix.setRotate(-90); matrix.postScale(-1, 1); break;
                case ExifInterface.ORIENTATION_ROTATE_270: matrix.setRotate(270); break;
                default: break;
            }
            matrix.postScale(scale, scale);
            Bitmap normalized = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
            if (normalized != bitmap) { bitmap.recycle(); bitmap = normalized; }
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 95, bytes)) throw new Exception("Photograph could not be prepared");
            JSObject response = new JSObject();
            response.put("dataUrl", "data:image/jpeg;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP));
            response.put("cancelled", false);
            if (captured && !cleanupCapture()) throw new Exception("The temporary capture could not be deleted. Clear the app's storage before sharing this device.");
            call.resolve(response);
        } catch (Exception error) { call.reject(error.getMessage(), error); }
        finally {
            if (bitmap != null) bitmap.recycle();
            if (captured) cleanupCapture();
            photoPending = false;
        }
    }

    private byte[] exportBytes(PluginCall call) throws Exception {
        String data = call.getString("base64", "");
        if (data.length() == 0 || data.length() > 48000000) throw new Exception("Export is empty or too large. Use fewer or smaller photographs.");
        return Base64.decode(data, Base64.DEFAULT);
    }

    private String exportName(PluginCall call) throws Exception {
        String name = call.getString("filename", "");
        if (!name.matches("posturelab[-a-zA-Z0-9]*\\.(pdf|csv|json)")) throw new Exception("Unsupported export filename");
        return name;
    }

    private String exportMime(PluginCall call) throws Exception {
        String name = exportName(call);
        return name.endsWith(".pdf") ? "application/pdf" : (name.endsWith(".json") ? "application/json" : "text/csv");
    }

    @PluginMethod public void saveFile(PluginCall call) {
        if (pendingExport != null) { call.reject("Finish saving the current report first."); return; }
        try {
            pendingExport = exportBytes(call);
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(exportMime(call));
            intent.putExtra(Intent.EXTRA_TITLE, exportName(call));
            startActivityForResult(call, intent, "savedFile");
        } catch (Exception error) { pendingExport = null; call.reject("The export could not be saved. " + error.getMessage(), error); }
    }

    @ActivityCallback private void savedFile(PluginCall call, ActivityResult result) {
        if (call == null) { pendingExport = null; return; }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            pendingExport = null; JSObject response = new JSObject(); response.put("cancelled", true); call.resolve(response); return;
        }
        getBridge().execute(() -> {
            try {
                if (pendingExport == null) throw new Exception("Export was interrupted. Please create it again.");
                try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                    if (stream == null) throw new Exception("The selected destination is not writable");
                    stream.write(pendingExport);
                }
                JSObject response = new JSObject(); response.put("cancelled", false); call.resolve(response);
            } catch (Exception error) { call.reject("The export could not be saved. " + error.getMessage(), error); }
            finally { pendingExport = null; }
        });
    }

    @PluginMethod public void shareFile(PluginCall call) {
        try {
            File directory = exportDirectory();
            if (!directory.exists() && !directory.mkdirs()) throw new Exception("Share cache unavailable");
            File file = new File(directory, "posturelab-" + UUID.randomUUID() + "-" + exportName(call));
            try (OutputStream stream = new FileOutputStream(file)) { stream.write(exportBytes(call)); }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(Intent.ACTION_SEND).setType(exportMime(call));
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.setClipData(ClipData.newRawUri("PostureLab export", uri));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(call, Intent.createChooser(intent, "Share PostureLab report"), "sharedFile");
        } catch (Exception error) { call.reject("The share sheet could not open. " + error.getMessage(), error); }
    }

    @ActivityCallback private void sharedFile(PluginCall call, ActivityResult result) {
        // Android does not reliably report whether a receiving app completed a transfer.
        if (call != null) { JSObject response = new JSObject(); response.put("shareSheetClosed", true); call.resolve(response); }
    }

    @PluginMethod public void clearTemporaryFiles(PluginCall call) {
        boolean capturesRemoved = photoPending || deleteFiles(captureDirectory(), 0);
        boolean exportsRemoved = deleteFiles(exportDirectory(), 0);
        if (!capturesRemoved || !exportsRemoved) { call.reject("Temporary files could not be deleted."); return; }
        call.resolve();
    }

    @Override protected Bundle saveInstanceState() {
        // Never put photo bytes or report base64 into Android's saved-state Bundle.
        Bundle state = new Bundle();
        if (captureFile != null) state.putString("capture", captureFile.getName());
        return state;
    }

    @Override protected void restoreState(Bundle state) {
        String name = state.getString("capture");
        if (name != null && name.matches("capture-[a-zA-Z0-9-]+\\.jpg")) captureFile = new File(captureDirectory(), name);
    }
}
