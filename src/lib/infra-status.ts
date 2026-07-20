// Infrastructure host list — polled by InfraStatusPanel via the local
// ping-agent's /ping endpoint (same code path as the WAN ping tiles).
// User-editable in Settings later; for now the defaults reflect the network
// the operator described (modem1 / modem2 / mikrotik / linux docker / cisco).

export interface InfraHost {
  id: string;
  label: string;
  fa: string;         // Farsi label
  host: string;
  role: "wan" | "router" | "server" | "switch";
  notes?: string;      // free-form specs (model, subnet, credentials note, ...)
  viaRouter?: boolean; // ping this host FROM the Mikrotik (REST /tool/ping) instead
                       // of directly from this box — needed for WAN IPs that live
                       // on a subnet only the router has an interface on.
}

const KEY = "exir.infra.hosts.v1";

export const DEFAULT_INFRA_HOSTS: InfraHost[] = [
  { id: "modem1",   label: "Modem 1 (WAN1)", fa: "مودم اول",         host: "192.168.1.1",   role: "wan",    notes: "", viaRouter: true },
  { id: "modem2",   label: "Modem 2 (WAN2)", fa: "مودم دوم",         host: "192.168.2.1",   role: "wan",    notes: "", viaRouter: true },
  { id: "mikrotik", label: "MikroTik Router", fa: "روتر میکروتیک",    host: "192.168.3.200", role: "router", notes: "" },
  { id: "linux",    label: "Linux Docker",   fa: "سرور لینوکس/داکر", host: "192.168.3.50",  role: "server", notes: "" },
  { id: "cisco",    label: "Cisco Switch",   fa: "سوئیچ سیسکو",       host: "192.168.3.254", role: "switch", notes: "" },
];

// Normalizes hosts loaded from storage/older versions so every field the UI
// relies on is always defined (older saves may not have `notes`/`viaRouter`).
function normalize(list: InfraHost[]): InfraHost[] {
  return list.map((h) => ({
    id: h.id,
    label: h.label ?? h.host,
    fa: h.fa ?? "",
    host: h.host ?? "",
    role: h.role ?? "server",
    notes: h.notes ?? "",
    viaRouter: !!h.viaRouter,
  }));
}

export function loadInfraHosts(): InfraHost[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as InfraHost[];
      if (Array.isArray(parsed) && parsed.length > 0) return normalize(parsed);
    }
  } catch { /* ignore */ }
  return DEFAULT_INFRA_HOSTS;
}

export function saveInfraHosts(hosts: InfraHost[]) {
  try { localStorage.setItem(KEY, JSON.stringify(hosts)); } catch { /* ignore */ }
  window.dispatchEvent(new Event("exir:infra-hosts"));
}

export function makeInfraHostId(): string {
  return `host_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
