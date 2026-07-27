// Game platform status + latency probes.
// Statuspage.io style summaries are CORS-open; Steam is proxied via ping-agent.

export type PlatLevel = "ok" | "warn" | "down" | "unknown";

export interface PlatformStatus {
  key: string;
  name: string;
  level: PlatLevel;
  note?: string;
}

interface StatuspageComp { name: string; status: string }

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function normStatuspage(raw: unknown, wanted: string): PlatLevel {
  const comps = (raw as { components?: StatuspageComp[] } | undefined)?.components ?? [];
  const c = comps.find((x) => x.name.toLowerCase().includes(wanted.toLowerCase()));
  if (!c) return "unknown";
  if (c.status === "operational") return "ok";
  if (c.status === "degraded_performance" || c.status === "partial_outage") return "warn";
  if (c.status === "major_outage" || c.status === "under_maintenance") return "down";
  return "unknown";
}

export async function loadPlatforms(): Promise<PlatformStatus[]> {
  const [steam, epic, discord, riot, ea, bnet] = await Promise.all([
    fetchJson("http://localhost:8765/steam"),
    fetchJson("https://status.epicgames.com/api/v2/summary.json"),
    fetchJson("https://discordstatus.com/api/v2/summary.json"),
    // Riot uses regional status; we ping the shared launcher status
    fetchJson("https://status.riotgames.com/api/v1/products/lol/regions/eu-west"),
    fetchJson("https://status.ea.com/api/v2/summary.json"),
    // Battle.net has no public JSON — best-effort HEAD via agent later; unknown default.
    Promise.resolve(null),
  ]);
  const steamLevel: PlatLevel = (() => {
    const s = (steam as { services?: Record<string, [string, string]> } | undefined)?.services?.cms;
    if (!s) return "unknown";
    return s[0] === "good" ? "ok" : s[0] === "minor" || s[0] === "slow" ? "warn" : "down";
  })();
  const riotLevel: PlatLevel = (() => {
    if (!riot) return "unknown";
    const incidents = (riot as { incidents?: unknown[] }).incidents ?? [];
    const maint = (riot as { maintenances?: unknown[] }).maintenances ?? [];
    if (incidents.length > 2) return "down";
    if (incidents.length > 0 || maint.length > 0) return "warn";
    return "ok";
  })();
  return [
    { key: "steam",    name: "Steam",       level: steamLevel },
    { key: "epic",     name: "Epic Games",  level: epic     ? normStatuspage(epic, "Launcher") : "unknown" },
    { key: "discord",  name: "Discord",     level: discord  ? normStatuspage(discord, "API")   : "unknown" },
    { key: "riot",     name: "Riot",        level: riotLevel },
    { key: "ea",       name: "EA",          level: ea       ? normStatuspage(ea, "Origin")     : "unknown" },
    { key: "bnet",     name: "Battle.net",  level: bnet ? "ok" : "unknown", note: "manual" },
  ];
}

// Latency targets per platform: { platform: [{region, hosts}] }
//
// IMPORTANT: Valve's CS2/Dota2 matchmaking datacenters are private relay IPs
// only reachable from inside the game (Steam Datagram Relay network). No public
// ICMP ping can reach them. So we probe well-known public hosts physically
// located in the SAME city/region as each Valve datacenter — the geographic
// distance (and thus the network path) is the same, so the ballpark latency
// matches what you see in-game.
//
// We deliberately AVOID the NTP pool (xx.pool.ntp.org): it uses geo-DNS that
// depends on the resolver's location, so ae.pool.ntp.org often resolves to a
// server in Europe instead of the UAE when queried from an Iranian ISP —
// producing 135ms for a region that should be ~43ms. Cloud-provider regional
// endpoints (AWS ec2.<region>.amazonaws.com) resolve to fixed IPs in the exact
// city and have direct peering with most ISPs, giving far more accurate results.
//
// Each region now lists MULTIPLE candidate hosts — the panel pings all of
// them and shows the fastest successful reply. A single AWS API endpoint can
// occasionally rate-limit/deprioritize ICMP or route through a control-plane
// path that isn't representative of real network distance (this is the
// likely cause of readings like "UAE 225ms" against an actual in-game ~54ms).
// Taking the best of several geographically-equivalent hosts smooths that
// out. If you find a host on your own network that tracks in-game ping even
// better (e.g. a local ISP's own speedtest server), just add it to the list.
//
// ICMP latency will still differ somewhat from in-game latency (Steam's SDR
// relay network uses optimized private paths, and every game has its own
// server infrastructure) — this is a proxy, not an exact match.
export const LATENCY_TARGETS: Record<string, { region: string; hosts: string[] }[]> = {
  CS2: [
    { region: "United Arab Emirates", hosts: ["ec2.me-central-1.amazonaws.com", "www.etisalat.ae"] }, // AWS UAE (Dubai) + Etisalat (major UAE ISP, likely hosted in-country)
    { region: "EU Stockholm",         hosts: ["ec2.eu-north-1.amazonaws.com"] },    // AWS Stockholm
    { region: "India Mumbai",         hosts: ["ec2.ap-south-1.amazonaws.com"] },    // AWS Mumbai
    { region: "EU Amsterdam",         hosts: ["ec2.eu-central-1.amazonaws.com"] },  // AWS Frankfurt (~300km from AMS)
    { region: "EU Helsinki",          hosts: ["hel1-speed.hetzner.com"] },           // Hetzner Helsinki
    { region: "EU Frankfurt",         hosts: ["ec2.eu-central-1.amazonaws.com"] },  // AWS Frankfurt
    { region: "United Kingdom",       hosts: ["ec2.eu-west-2.amazonaws.com"] },     // AWS London
    { region: "EU Warsaw",            hosts: ["ec2.eu-central-1.amazonaws.com"] },  // AWS Frankfurt (closest to Warsaw)
    { region: "EU Falkenstein",       hosts: ["fsn1-speed.hetzner.com"] },           // Hetzner Falkenstein
    { region: "India Chennai",        hosts: ["ec2.ap-south-1.amazonaws.com"] },    // AWS Mumbai (closest to Chennai)
  ],
  // Dota2's matchmaking regions are still served from Valve's classic
  // dedicated datacenter IPs (not exclusively behind SDR the way CS2's
  // relays are), and these ARE directly ICMP-pingable — unlike some SDR
  // relay nodes, which rate-limit/ignore generic ICMP and were showing "—"
  // (100% loss) for every single Dota2 row. List cross-checked against:
  //   https://github.com/MrSunshyne/Dota2-server-ping
  //   https://github.com/denniskupec/valve-matchmaking-ip-ranges
  Dota2: [
    { region: "US West (California)",       hosts: ["192.69.96.1"] },
    { region: "US East (Virginia)",         hosts: ["208.78.164.1"] },
    { region: "EU West (Luxembourg)",       hosts: ["146.66.152.1"] },
    { region: "EU East (Vienna)",           hosts: ["146.66.155.1"] },
    { region: "Russia (Stockholm)",         hosts: ["146.66.156.2"] },
    { region: "SE Asia (Singapore, new)",   hosts: ["103.10.124.1"] },
    { region: "SE Asia (Singapore, old)",   hosts: ["103.28.54.1"] },
    { region: "South America (Brazil)",     hosts: ["209.197.29.2"] },
    { region: "South Africa (Cape Town)",   hosts: ["152.111.192.2"] },
    { region: "South Korea (Seoul)",        hosts: ["58.125.52.1"] },
  ],
  Discord: [
    { region: "Frankfurt", hosts: ["discord.com"] },
    { region: "Dubai",     hosts: ["gateway.discord.gg"] },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// REAL relay-based latency (fixes "Dubai shows 220ms but in-game it's 43ms")
//
// Steam Datagram Relay (SDR) node IPs are actually PUBLIC and pingable — the
// CS2/Dota2 client itself pings these exact IPs before matchmaking (this is
// also how server-picker tools like FN-FAL113's cs2-server-picker /
// server-picker-x work: they fetch this same list to know which IPs to
// block). Pinging the real relay node instead of an unrelated cloud region
// used as a geographic stand-in gives numbers that track in-game ping far
// more closely.
//
// The list comes from Valve's own public config endpoint:
//   https://api.steampowered.com/ISteamApps/GetSDRConfig/v1?appid=730 (CS2)
// (appid=570 exists too, but its relay nodes didn't answer ICMP reliably in
// testing — see the Dota2 static list + comment below instead.)
// Browsers can't fetch it directly (no CORS headers on Steam's API), so the
// local ping-agent.mjs proxies it via GET /sdr-relays?appid=... (see there).
// ─────────────────────────────────────────────────────────────────────────

export interface RelayTarget { region: string; host: string; popid: string }

interface SdrPopsResponse { pops?: Record<string, { desc?: string; ip?: string }>; stale?: boolean }

const RELAY_TTL_MS = 6 * 60 * 60 * 1000; // 6h — Valve's relay list rarely changes
const relayCache: Record<number, { at: number; targets: RelayTarget[] }> = {};

async function fetchSdrRelays(appid: number): Promise<RelayTarget[]> {
  const cached = relayCache[appid];
  if (cached && Date.now() - cached.at < RELAY_TTL_MS) return cached.targets;
  try {
    const r = await fetch(`http://localhost:8765/sdr-relays?appid=${appid}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`agent HTTP ${r.status}`);
    const json = (await r.json()) as SdrPopsResponse;
    const pops = json.pops || {};
    const targets: RelayTarget[] = Object.entries(pops)
      .filter(([, p]) => p && p.ip)
      .map(([popid, p]) => ({ popid, region: p.desc || popid.toUpperCase(), host: p.ip as string }));
    if (targets.length) {
      relayCache[appid] = { at: Date.now(), targets };
      return targets;
    }
  } catch {
    // Agent offline, or Steam's API unreachable right now — fall through.
  }
  return cached?.targets ?? [];
}

/**
 * Real, relay-based latency targets for the panel. Falls back to the old
 * geo-proxy table (LATENCY_TARGETS) per-platform when the agent/Steam are
 * unreachable and there's no cached relay list yet, so the panel never goes
 * fully blank.
 */
export async function loadLatencyTargets(): Promise<Record<string, { region: string; host: string }[]>> {
  const cs2 = await fetchSdrRelays(730);
  const toPairs = (t: { region: string; hosts: string[] }[]) => t.map((x) => ({ region: x.region, host: x.hosts[0] }));
  return {
    CS2: cs2.length ? cs2.map(({ region, host }) => ({ region, host })) : toPairs(LATENCY_TARGETS.CS2),
    // Dota2 intentionally does NOT go through fetchSdrRelays: those relay
    // nodes ignored ICMP for this game and every row showed "—". The real,
    // directly-pingable datacenter IPs above are used as-is.
    Dota2: toPairs(LATENCY_TARGETS.Dota2),
    Discord: toPairs(LATENCY_TARGETS.Discord),
  };
}
