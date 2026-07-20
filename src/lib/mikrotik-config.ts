export interface MikrotikConfig {
  host: string;
  user: string;
  pass: string;
  subnet: string;
  useHttps: boolean;
}

const KEY = "exir.mikrotik.config.v1";

export const DEFAULT_MIKROTIK_CONFIG: MikrotikConfig = {
  host: "192.168.3.200",
  user: "",
  pass: "",
  subnet: "192.168.3.0/24",
  useHttps: true,
};

export function loadMikrotikConfig(): MikrotikConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_MIKROTIK_CONFIG;
    const parsed = JSON.parse(raw) as Partial<MikrotikConfig>;
    return {
      host: parsed.host || "",
      user: parsed.user || "",
      pass: parsed.pass || "",
      subnet: parsed.subnet || DEFAULT_MIKROTIK_CONFIG.subnet,
      useHttps: parsed.useHttps !== false,
    };
  } catch {
    return DEFAULT_MIKROTIK_CONFIG;
  }
}

export function saveMikrotikConfig(cfg: MikrotikConfig) {
  localStorage.setItem(KEY, JSON.stringify(cfg));
  window.dispatchEvent(new Event("exir:mikrotik-config"));
}

export async function pushMikrotikConfigToAgent(cfg: MikrotikConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch("http://localhost:8765/mikrotik/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return { ok: !!j.ok, error: j.error || (!r.ok ? `agent HTTP ${r.status}` : undefined) };
  } catch (e) {
    return { ok: false, error: `agent unreachable: ${(e as Error).message}` };
  }
}