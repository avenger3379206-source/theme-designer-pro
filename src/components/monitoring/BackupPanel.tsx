import { useRef, useState } from "react";
import { DatabaseBackup, Download, Upload, TriangleAlert } from "lucide-react";
import { downloadBackup, exportBackup, importBackup } from "@/lib/backup";

export function BackupPanel() {
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setBusy("export");
    setMessage(null);
    try {
      const blob = await exportBackup();
      downloadBackup(blob);
      setMessage({ ok: true, text: "فایل بکاپ دانلود شد." });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "دانلود بکاپ شکست خورد." });
    } finally {
      setBusy(null);
    }
  }

  async function handleImportFile(file: File | null) {
    if (!file) return;
    const sure = confirm(
      "با بازیابی این فایل، تنظیمات و داده‌های فعلی داشبورد (تم، رزروها، مارکت، گزارش‌ها و ...) با محتوای بکاپ جایگزین می‌شن. ادامه بدم؟",
    );
    if (!sure) return;
    setBusy("import");
    setMessage(null);
    const res = await importBackup(file);
    setBusy(null);
    if (!res.ok) {
      setMessage({ ok: false, text: res.error || "بازیابی بکاپ شکست خورد." });
      return;
    }
    setMessage({ ok: true, text: "بازیابی موفق بود. صفحه در حال بارگذاری مجدده…" });
    setTimeout(() => window.location.reload(), 1500);
  }

  return (
    <div className="mb-6 rounded-xl p-5 glass-panel">
      <div className="mb-2 flex items-center gap-2">
        <DatabaseBackup size={16} className="text-cyan-300" />
        <h2 className="font-mono text-sm font-bold uppercase tracking-[0.2em] text-glow-cyan">
          Backup & Restore · پشتیبان‌گیری
        </h2>
      </div>
      <p className="mb-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
        همه‌چیز (تم، تنظیمات گیج، لوگو، رزروها، مارکت، گزارش روزانه، هشدارها و...) فقط روی همین
        مرورگر ذخیره می‌شه. اگه کش پاک بشه یا سیستم عوض بشه، همه‌چیز از دست می‌ره — پس بهتره هر
        از گاهی یه بکاپ بگیری.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={handleExport}
          disabled={busy !== null}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-3 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
        >
          <Download size={14} /> {busy === "export" ? "در حال آماده‌سازی…" : "دانلود بکاپ (JSON)"}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy !== null}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-surface/60 px-3 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <Upload size={14} /> {busy === "import" ? "در حال بازیابی…" : "بازیابی از فایل"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            handleImportFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </div>

      {message && (
        <p
          className={`mt-3 font-mono text-[11px] ${message.ok ? "text-emerald-300" : "text-red-300"}`}
        >
          {message.text}
        </p>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber-300" />
        <p className="font-mono text-[10px] leading-relaxed text-amber-100/90">
          بازیابی، داده‌های فعلی رو کامل جایگزین می‌کنه — قابل بازگشت نیست. اگه لازم شد، اول یه
          بکاپ از وضعیت فعلی بگیر.
        </p>
      </div>
    </div>
  );
}
