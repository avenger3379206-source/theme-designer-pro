import { useEffect, useState } from "react";
import { Camera, Settings2, Plus, Trash2, ExternalLink, RotateCcw, Radio } from "lucide-react";
import {
  CAMERA_PRESETS,
  addCamera,
  fillTemplate,
  loadCameraConfig,
  removeCamera,
  saveCameraConfig,
  updateCamera,
  type CameraConfig,
  type CameraEntry,
} from "@/lib/camera-config";
import { isComposing } from "@/lib/compose-lock";

const MOTION_WINDOW_MS = 15_000; // a camera counts as "motion active" for this long after its last event
const MOTION_POLL_MS = 5_000;

// ── Live preview tile ───────────────────────────────────────────────────
function CameraTile({
  cam,
  motionActive,
}: {
  cam: CameraEntry;
  motionActive: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // MJPEG streams sometimes stall silently (NVR restart, network blip) without
  // firing onError — force a fresh <img> mount every 2 min so a dead stream
  // doesn't just sit frozen on the last frame forever.
  useEffect(() => {
    const id = setInterval(() => setReloadKey((k) => k + 1), 120_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded-lg border bg-black/40 ${
        motionActive ? "border-amber-400/80" : "border-border/50"
      }`}
      style={motionActive ? { boxShadow: "0 0 14px var(--neon-red)55" } : undefined}
    >
      <div className="aspect-video w-full">
        {cam.liveEmbedUrl && !imgError ? (
          <img
            key={reloadKey}
            src={cam.liveEmbedUrl}
            alt={cam.name}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-surface/40 text-center">
            <Camera size={22} className="text-muted-foreground/50" />
            <span className="font-mono text-[11px] text-muted-foreground">
              {cam.liveEmbedUrl ? "تصویر زنده در دسترس نیست" : "بدون پیش‌نمایش زنده"}
            </span>
            {imgError && (
              <button
                onClick={() => {
                  setImgError(false);
                  setReloadKey((k) => k + 1);
                }}
                className="mt-1 flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
              >
                <RotateCcw size={10} /> تلاش دوباره
              </button>
            )}
          </div>
        )}
      </div>

      {/* Overlay: name + motion badge + quick-launch */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-2 py-1.5">
        <span className="font-mono text-xs font-bold text-white drop-shadow">{cam.name}</span>
        {motionActive && (
          <span className="flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
            <Radio size={10} className="animate-pulse" /> حرکت
          </span>
        )}
      </div>

      {cam.quickLaunchUrl && (
        <a
          href={cam.quickLaunchUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={`باز کردن ${cam.name} در NVR`}
          className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full border border-cyan-400/60 bg-black/60 px-2 py-1 font-mono text-[10px] text-cyan-200 backdrop-blur hover:bg-cyan-500/20"
        >
          <ExternalLink size={11} /> باز کردن سریع
        </a>
      )}
    </div>
  );
}

// ── Settings drawer: add / edit / remove cameras ────────────────────────
function CameraSettingsDrawer({
  cfg,
  onChange,
}: {
  cfg: CameraConfig;
  onChange: (c: CameraConfig) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-3 rounded-lg border border-border/50 bg-background/30 p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          <Settings2 size={13} className="text-cyan-300" /> تنظیمات دوربین‌ها
        </span>
        <span className="text-[11px] text-muted-foreground">{open ? "بستن ▲" : "باز کردن ▼"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {cfg.cameras.length === 0 && (
            <p className="font-mono text-[11px] text-muted-foreground">
              هنوز دوربینی اضافه نشده. با «افزودن دوربین» شروع کن.
            </p>
          )}
          {cfg.cameras.map((cam) => (
            <CameraEditRow
              key={cam.id}
              cam={cam}
              onSave={(patch) => onChange(updateCamera(cfg, cam.id, patch))}
              onDelete={() => onChange(removeCamera(cfg, cam.id))}
            />
          ))}
          <button
            onClick={() => onChange(addCamera(cfg))}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-400/60 bg-cyan-500/10 px-3 py-1.5 font-mono text-xs text-cyan-200 hover:bg-cyan-500/20"
          >
            <Plus size={13} /> افزودن دوربین
          </button>
        </div>
      )}
    </div>
  );
}

function CameraEditRow({
  cam,
  onSave,
  onDelete,
}: {
  cam: CameraEntry;
  onSave: (patch: Partial<CameraEntry>) => void;
  onDelete: () => void;
}) {
  const [presetId, setPresetId] = useState("custom");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [camId, setCamId] = useState("");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");

  const preset = CAMERA_PRESETS.find((p) => p.id === presetId) ?? CAMERA_PRESETS[CAMERA_PRESETS.length - 1];

  function applyPreset() {
    const vars = { host, port, cam: camId, user, pass };
    onSave({
      quickLaunchUrl: preset.quickLaunchTemplate ? fillTemplate(preset.quickLaunchTemplate, vars) : cam.quickLaunchUrl,
      liveEmbedUrl: preset.liveEmbedTemplate ? fillTemplate(preset.liveEmbedTemplate, vars) : cam.liveEmbedUrl,
    });
  }

  return (
    <div className="rounded-lg border border-border/60 bg-surface/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <input
          value={cam.name}
          onChange={(e) => onSave({ name: e.target.value })}
          placeholder="اسم دوربین (مثلاً ورودی)"
          className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5 font-mono text-xs text-foreground"
        />
        <button
          onClick={onDelete}
          title="حذف دوربین"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-red-500/50 text-red-300 hover:bg-red-500/10"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Preset helper */}
      <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <select
          value={presetId}
          onChange={(e) => setPresetId(e.target.value)}
          className="col-span-2 rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 font-mono text-xs text-foreground sm:col-span-1"
        >
          {CAMERA_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="host/IP" className="rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 font-mono text-xs" />
        <input value={port} onChange={(e) => setPort(e.target.value)} placeholder="port" className="rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 font-mono text-xs" />
        <input value={camId} onChange={(e) => setCamId(e.target.value)} placeholder="camera id / short name" className="rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 font-mono text-xs" />
        <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="user (اگه لازمه)" className="rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 font-mono text-xs" />
        <input value={pass} onChange={(e) => setPass(e.target.value)} placeholder="pass/key (اگه لازمه)" className="rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 font-mono text-xs" />
      </div>
      <div className="mb-2 flex items-center gap-2">
        <button
          onClick={applyPreset}
          className="rounded-lg border border-cyan-400/60 bg-cyan-500/10 px-2.5 py-1 font-mono text-[11px] text-cyan-200 hover:bg-cyan-500/20"
        >
          ساخت آدرس‌ها از preset
        </button>
        <span className="font-mono text-[10px] text-muted-foreground">{preset.hint}</span>
      </div>

      {/* Raw URLs — always editable directly too */}
      <div className="space-y-1.5">
        <input
          value={cam.quickLaunchUrl}
          onChange={(e) => onSave({ quickLaunchUrl: e.target.value })}
          placeholder="آدرس «باز کردن سریع» (لینک وب NVR برای این دوربین)"
          dir="ltr"
          className="w-full rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5 font-mono text-[11px] text-foreground"
        />
        <input
          value={cam.liveEmbedUrl}
          onChange={(e) => onSave({ liveEmbedUrl: e.target.value })}
          placeholder="آدرس پخش زنده MJPEG (برای نمایش داخل داشبورد)"
          dir="ltr"
          className="w-full rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5 font-mono text-[11px] text-foreground"
        />
        <input
          value={cam.motionKey}
          onChange={(e) => onSave({ motionKey: e.target.value })}
          placeholder="motion key (همینو تو وب‌هوک NVR به ?camera= بده)"
          dir="ltr"
          className="w-full rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5 font-mono text-[11px] text-foreground"
        />
      </div>
      {cam.motionKey && (
        <p className="mt-1.5 font-mono text-[10px] text-muted-foreground" dir="ltr">
          webhook: http://&lt;this-pc-ip&gt;:8765/camera-motion?camera={cam.motionKey}
        </p>
      )}
    </div>
  );
}

export function CctvPanel() {
  const [cfg, setCfg] = useState<CameraConfig>(() => loadCameraConfig());
  const [motion, setMotion] = useState<Record<string, number>>({});

  useEffect(() => {
    const refresh = () => setCfg(loadCameraConfig());
    window.addEventListener("exir:cctv-config", refresh);
    return () => window.removeEventListener("exir:cctv-config", refresh);
  }, []);

  useEffect(() => {
    let alive = true;
    async function poll() {
      if (isComposing()) return;
      try {
        const r = await fetch("http://localhost:8765/camera-motion");
        const json = (await r.json()) as { motion?: Record<string, number> };
        if (alive) setMotion(json.motion || {});
      } catch {
        /* agent offline */
      }
    }
    poll();
    const id = setInterval(poll, MOTION_POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  function handleChange(next: CameraConfig) {
    saveCameraConfig(next);
    setCfg(next);
  }

  const now = Date.now();
  const activeMotionCount = cfg.cameras.filter(
    (c) => c.motionKey && motion[c.motionKey] && now - motion[c.motionKey] < MOTION_WINDOW_MS,
  ).length;

  return (
    <div className="mb-3 rounded-xl p-3 glass-panel">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-mono text-sm uppercase tracking-[0.3em] text-muted-foreground">
          <Camera size={14} /> ▸ <span className="font-fa" lang="fa">دوربین‌ها</span> · cctv
        </h3>
        {activeMotionCount > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 font-mono text-[11px] font-bold text-red-300">
            <Radio size={12} className="animate-pulse" /> {activeMotionCount} دوربین با حرکت فعال
          </span>
        )}
      </div>

      <CameraSettingsDrawer cfg={cfg} onChange={handleChange} />

      {cfg.cameras.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/50 py-10 text-center">
          <Camera size={26} className="text-muted-foreground/40" />
          <p className="font-mono text-xs text-muted-foreground">
            هنوز دوربینی تنظیم نشده — از «تنظیمات دوربین‌ها» بالا شروع کن.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cfg.cameras.map((cam) => (
            <CameraTile
              key={cam.id}
              cam={cam}
              motionActive={!!(cam.motionKey && motion[cam.motionKey] && now - motion[cam.motionKey] < MOTION_WINDOW_MS)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
