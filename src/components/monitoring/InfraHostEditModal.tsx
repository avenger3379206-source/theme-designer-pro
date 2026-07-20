import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HardDrive, Network, Router, Radio, Server, Trash2, X } from "lucide-react";
import type { InfraHost } from "@/lib/infra-status";
import { setComposing } from "@/lib/compose-lock";

interface Props {
  host: InfraHost;
  /** true when this is a brand-new host that hasn't been saved yet */
  isNew?: boolean;
  onSave: (host: InfraHost) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const ROLES: { id: InfraHost["role"]; label: string; fa: string; Icon: typeof Radio }[] = [
  { id: "wan", label: "WAN / Modem", fa: "مودم / WAN", Icon: Radio },
  { id: "router", label: "Router", fa: "روتر", Icon: Router },
  { id: "server", label: "Server", fa: "سرور", Icon: Server },
  { id: "switch", label: "Switch", fa: "سوئیچ", Icon: HardDrive },
];

export function InfraHostEditModal({ host, isNew, onSave, onDelete, onClose }: Props) {
  const [label, setLabel] = useState(host.label);
  const [fa, setFa] = useState(host.fa);
  const [ip, setIp] = useState(host.host);
  const [role, setRole] = useState<InfraHost["role"]>(host.role);
  const [notes, setNotes] = useState(host.notes ?? "");
  const [viaRouter, setViaRouter] = useState(!!host.viaRouter);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Pause background dashboard polling while this form is open, same fix as
  // SendMessageModal — otherwise the periodic ping tick can steal focus
  // out of the inputs while typing.
  useEffect(() => {
    setComposing(true);
    return () => setComposing(false);
  }, []);

  function handleSave() {
    const trimmedIp = ip.trim();
    if (!trimmedIp) {
      setError("آدرس آی‌پی یا هاست را وارد کن");
      return;
    }
    onSave({
      id: host.id,
      label: label.trim() || trimmedIp,
      fa: fa.trim(),
      host: trimmedIp,
      role,
      notes: notes.trim(),
      viaRouter,
    });
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "oklch(0.05 0.02 260 / 0.65)", backdropFilter: "blur(16px) saturate(140%)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
        className="font-fa relative w-full max-w-md overflow-hidden rounded-2xl p-5 glass-panel neon-border-magenta"
        lang="fa"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network size={16} className="text-fuchsia-400" />
            <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-glow-magenta">
              {isNew ? "افزودن دستگاه زیرساخت" : "ویرایش دستگاه"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-border/60 p-1 text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              آی‌پی / هاست (IP آدرس)
            </span>
            <input
              dir="ltr"
              autoFocus
              value={ip}
              onChange={(e) => { setIp(e.target.value); setError(null); }}
              placeholder="مثلاً 192.168.1.1"
              className="mt-1 w-full rounded border border-border bg-background/60 px-2.5 py-1.5 text-xs outline-none focus:border-fuchsia-500"
            />
            {error && <div className="mt-1 text-[10px] text-red-400">{error}</div>}
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 p-2.5 text-xs">
            <input
              type="checkbox"
              checked={viaRouter}
              onChange={(e) => setViaRouter(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              پینگ از طریق میکروتیک (روتر)
              <span className="mt-0.5 block font-mono text-[9px] leading-4 text-muted-foreground">
                برای آی‌پی‌هایی که سرور مستقیم بهشون دسترسی نداره (مثلاً WAN1/WAN2 که پشت فیل‌اورن) — روتر خودش پینگ می‌گیره و جواب رو برمی‌گردونه. نیاز به تنظیم یوزر/پس میکروتیک در Settings داره.
              </span>
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                برچسب فارسی
              </span>
              <input
                dir="rtl"
                value={fa}
                onChange={(e) => setFa(e.target.value)}
                placeholder="مثلاً مودم اول"
                className="mt-1 w-full rounded border border-border bg-background/60 px-2.5 py-1.5 text-xs outline-none focus:border-fuchsia-500"
              />
            </div>
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                برچسب انگلیسی
              </span>
              <input
                dir="ltr"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Modem 1 (WAN1)"
                className="mt-1 w-full rounded border border-border bg-background/60 px-2.5 py-1.5 text-xs outline-none focus:border-fuchsia-500"
              />
            </div>
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">نوع دستگاه</span>
            <div className="mt-1.5 grid grid-cols-4 gap-1.5">
              {ROLES.map(({ id, fa: rfa, Icon }) => (
                <button
                  key={id}
                  onClick={() => setRole(id)}
                  className="flex flex-col items-center gap-1 rounded-md border py-2 text-[10px]"
                  style={{
                    borderColor: role === id ? "var(--neon-magenta)70" : undefined,
                    background: role === id ? "var(--neon-magenta)15" : undefined,
                    color: role === id ? "var(--neon-magenta)" : undefined,
                  }}
                >
                  <Icon size={14} />
                  {rfa}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              مشخصات (اختیاری)
            </span>
            <textarea
              dir="rtl"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="مدل دستگاه، رنج آی‌پی، پورت مدیریت، رمز عبور و..."
              className="mt-1 w-full resize-none rounded border border-border bg-background/60 px-2.5 py-1.5 text-xs outline-none focus:border-fuchsia-500"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          {!isNew && (
            <button
              onClick={() => onDelete(host.id)}
              title="حذف این دستگاه"
              className="flex items-center justify-center gap-1.5 rounded-md border border-red-500/40 px-3 py-2.5 text-xs font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/10"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-border/60 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            انصراف
          </button>
          <button
            onClick={handleSave}
            className="flex-1 rounded-md py-2.5 text-xs font-bold uppercase tracking-widest neon-border-magenta hover:brightness-125"
          >
            ذخیره
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
