import { Capacitor, registerPlugin } from "@capacitor/core";
const native = registerPlugin("PostureLab");
export const isAndroid = Capacitor.getPlatform() === "android";
export const bundledModels = import.meta.env.VITE_POSTURELAB_ANDROID === "true";

export async function chooseNativePhoto(source) {
  if (!isAndroid) throw Error("Android photo controls are unavailable.");
  const result = await native[source === "camera" ? "takePhoto" : "pickPhoto"]();
  if (result.cancelled) return null;
  if (!result.dataUrl?.startsWith("data:image/jpeg;base64,")) throw Error("The photograph could not be read.");
  const response = await fetch(result.dataUrl);
  return new File([await response.blob()], "phone-photo.jpg", { type: "image/jpeg" });
}

function base64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(Error("The export could not be prepared."));
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(blob);
  });
}

export async function deliverExport(blob, filename, share = false) {
  if (isAndroid) {
    if (blob.size > 32 * 1024 * 1024) throw Error("The export is too large for this phone. Try fewer or smaller photographs.");
    const options = { filename, base64: await base64(blob) };
    const result = await native[share ? "shareFile" : "saveFile"](options);
    if (result.cancelled) return "Save cancelled. Your session is still available.";
    return share
      ? "Share sheet closed. Check that the receiving app has your report before clearing the session."
      : "File saved to your chosen location. Store it securely.";
  }
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "File downloaded. Store it securely and clear the session when finished.";
}

export async function clearNativeTemporaryFiles() {
  if (isAndroid) await native.clearTemporaryFiles();
}
