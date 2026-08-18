import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

let permissionChecked = false;
let permissionGranted = false;

async function ensurePermission(): Promise<boolean> {
  if (permissionChecked) return permissionGranted;

  permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    const result = await requestPermission();
    permissionGranted = result === "granted";
  }
  permissionChecked = true;
  return permissionGranted;
}

export async function notifyOS(title: string, body: string) {
  console.log("[DEBUG] notifyOS appelé:", title, body);
  console.log("[DEBUG] dans Tauri ?", typeof window !== "undefined" && "__TAURI_INTERNALS__" in window);

  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    console.log("[DEBUG] pas dans Tauri, on arrête");
    return;
  }

  try {
    const granted = await ensurePermission();
    console.log("[DEBUG] permission accordée ?", granted);
    if (!granted) return;
    sendNotification({ title, body });
    console.log("[DEBUG] sendNotification appelé avec succès");
  } catch (e) {
    console.error("[DEBUG] Erreur envoi notification OS:", e);
  }
}