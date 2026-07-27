// Live per-client disk health — polls each VIP's exir-client-agent
// (http://<ip>:8766/disk-health), which reads Windows' own SMART-derived
// HealthStatus via Get-PhysicalDisk. Separate from MSI Afterburner, which
// has no visibility into disk health at all.

export interface DiskInfo {
  name: string;
  health: string; // "Healthy" | "Warning" | "Unhealthy" | "Unknown"
  operational: string;
  mediaType: string; // "SSD" | "HDD" | "Unspecified"
  sizeGB: number | null;
  temperature: number | null;
  wearPercent: number | null; // % of rated SSD life used, when the drive reports it
  readErrorsUncorrected: number | null;
  powerOnHours: number | null;
}

export interface DiskHealthStatus {
  machine: string;
  ok: boolean;
  disks: DiskInfo[];
  error?: string;
  updatedAt: number;
}

export const DISK_HEALTH_EVT = "exir:disk-health";

declare global {
  interface Window {
    __exirDiskHealth?: Record<string, DiskHealthStatus>;
  }
}

export function publishDiskHealth(map: Record<string, DiskHealthStatus>) {
  if (typeof window === "undefined") return;
  window.__exirDiskHealth = map;
  window.dispatchEvent(new Event(DISK_HEALTH_EVT));
}

/** Fetches one client's disk health. Never throws — a single unreachable
 * station comes back as `{ ok: false, error }` instead of breaking the loop. */
export async function fetchDiskHealth(machine: string, host: string, timeoutMs = 8000): Promise<DiskHealthStatus> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(`http://${host}:8766/disk-health`, { signal: ctrl.signal }).finally(() =>
      clearTimeout(t),
    );
    const j = (await r.json().catch(() => ({}))) as Partial<DiskHealthStatus>;
    return {
      machine,
      ok: !!j.ok,
      disks: Array.isArray(j.disks) ? (j.disks as DiskInfo[]) : [],
      error: j.error || (!r.ok ? `client-agent HTTP ${r.status}` : undefined),
      updatedAt: Date.now(),
    };
  } catch (e) {
    return {
      machine,
      ok: false,
      disks: [],
      error: `client-agent unreachable: ${(e as Error).message}`,
      updatedAt: Date.now(),
    };
  }
}

const WEAR_WARNING_PERCENT = 85; // flag an SSD once it's used this much of its rated life

/** A disk worth alerting about: unhealthy per Windows, near end of life, or
 * has actually recorded uncorrected read errors (real data-integrity risk). */
export function diskHasProblem(d: DiskInfo): boolean {
  if (d.health && d.health !== "Healthy" && d.health !== "Unknown") return true;
  if (typeof d.wearPercent === "number" && d.wearPercent >= WEAR_WARNING_PERCENT) return true;
  if (typeof d.readErrorsUncorrected === "number" && d.readErrorsUncorrected > 0) return true;
  return false;
}

export function hasDiskProblem(s: DiskHealthStatus): boolean {
  if (!s.ok) return false; // agent unreachable is a connectivity issue, not a disk one
  return s.disks.some(diskHasProblem);
}
