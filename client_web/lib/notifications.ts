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

export async function notifyOS(title: string, body: string) {//ne s'execute que si on est dans un environnement Tauri (desktop) et pas dans un navigateur web
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return;
  }

  try {
    const granted = await ensurePermission();
    if (!granted) return;
    sendNotification({ title, body });
  } catch (e) {
    console.error("Erreur envoi notification OS:", e);
  }
}