// CCTV camera configuration — a list of cameras, each with a "quick launch"
// URL (opens the full NVR web UI / camera page in a new tab, same idea as
// the VNC quick-connect button) and an optional "live embed" URL (an MJPEG
// or snapshot-refresh URL that can sit directly in an <img> tag — browsers
// can't play raw RTSP, but every common NVR package re-exposes an MJPEG
// endpoint that works fine in <img>). Persisted in localStorage, same
// pattern as vnc-config.ts.

export interface CameraEntry {
  id: string;
  name: string; // e.g. "ورودی", "سالن VIP"
  quickLaunchUrl: string; // opened in a new tab on click
  liveEmbedUrl: string; // <img src="..."> target; "" = no live preview
  motionKey: string; // identifier this camera's NVR will send in its motion webhook (see ping-agent.mjs /camera-motion)
}

export interface CameraConfig {
  cameras: CameraEntry[];
}

const STORAGE_KEY = "exir.cctv.config.v1";

export function defaultConfig(): CameraConfig {
  return { cameras: [] };
}

function genId(): string {
  return `cam_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function loadCameraConfig(): CameraConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig();
    const parsed = JSON.parse(raw) as Partial<CameraConfig>;
    if (!Array.isArray(parsed.cameras)) return defaultConfig();
    return {
      cameras: parsed.cameras.map((c) => ({
        id: c.id || genId(),
        name: c.name || "دوربین",
        quickLaunchUrl: c.quickLaunchUrl || "",
        liveEmbedUrl: c.liveEmbedUrl || "",
        motionKey: c.motionKey || "",
      })),
    };
  } catch {
    return defaultConfig();
  }
}

export function saveCameraConfig(cfg: CameraConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    window.dispatchEvent(new Event("exir:cctv-config"));
  } catch {
    /* ignore quota errors */
  }
}

export function addCamera(cfg: CameraConfig, name = "دوربین جدید"): CameraConfig {
  const cam: CameraEntry = { id: genId(), name, quickLaunchUrl: "", liveEmbedUrl: "", motionKey: "" };
  const next = { cameras: [...cfg.cameras, cam] };
  saveCameraConfig(next);
  return next;
}

export function updateCamera(cfg: CameraConfig, id: string, patch: Partial<CameraEntry>): CameraConfig {
  const next = { cameras: cfg.cameras.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
  saveCameraConfig(next);
  return next;
}

export function removeCamera(cfg: CameraConfig, id: string): CameraConfig {
  const next = { cameras: cfg.cameras.filter((c) => c.id !== id) };
  saveCameraConfig(next);
  return next;
}

// ── NVR platform presets ────────────────────────────────────────────────
// Fill in {host}/{port}/{cam}/{user}/{pass} and you get a working MJPEG /
// quick-launch URL for that platform. Exact paths can vary by version/
// config — these are the standard defaults for each.
export interface CameraPreset {
  id: string;
  label: string;
  quickLaunchTemplate: string;
  liveEmbedTemplate: string;
  hint: string;
}

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: "blueiris",
    label: "Blue Iris",
    quickLaunchTemplate: "http://{host}:{port}/ui3.htm",
    liveEmbedTemplate: "http://{host}:{port}/mjpg/{cam}/video.mjpg?user={user}&pw={pass}",
    hint: "پورت پیش‌فرض معمولاً 81 هست. {cam} = short name دوربین توی Blue Iris (نه اسم نمایشی).",
  },
  {
    id: "ispy",
    label: "iSpy / Agent DVR",
    quickLaunchTemplate: "http://{host}:{port}/",
    liveEmbedTemplate: "http://{host}:{port}/mjpeg/{cam}?authid={user}&authkey={pass}",
    hint: "پورت پیش‌فرض وب سرور Agent DVR معمولاً 8090 هست. {cam} = Object ID دوربین.",
  },
  {
    id: "zoneminder",
    label: "ZoneMinder",
    quickLaunchTemplate: "http://{host}/zm/index.php?view=watch&mid={cam}",
    liveEmbedTemplate: "http://{host}/zm/cgi-bin/nph-zms?mode=jpeg&monitor={cam}&user={user}&pass={pass}",
    hint: "{cam} = Monitor ID عددی (توی ZoneMinder Console دیده می‌شه).",
  },
  {
    id: "shinobi",
    label: "Shinobi",
    quickLaunchTemplate: "http://{host}:{port}/",
    liveEmbedTemplate: "http://{host}:{port}/{pass}/mjpeg/{user}/{cam}",
    hint: "اینجا {pass} = API Key و {user} = Group Key هستن (نه رمز واقعی)؛ {cam} = Monitor ID.",
  },
  {
    id: "custom",
    label: "سفارشی / سایر",
    quickLaunchTemplate: "",
    liveEmbedTemplate: "",
    hint: "اگه پلتفرم دیگه‌ای دارید یا آدرس MJPEG رو از قبل دارید، مستقیم اینجا بچسبونیدش.",
  },
];

export function fillTemplate(
  template: string,
  vars: { host: string; port: string; cam: string; user: string; pass: string },
): string {
  return template
    .replace(/\{host\}/g, vars.host)
    .replace(/\{port\}/g, vars.port)
    .replace(/\{cam\}/g, vars.cam)
    .replace(/\{user\}/g, vars.user)
    .replace(/\{pass\}/g, vars.pass);
}
