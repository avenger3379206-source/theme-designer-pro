// Live per-client ping state.
//
// The ping-agent's /ping endpoint (localhost:8765) is used to probe every VIP
// station's LAN IP. When a known game is running, the VIP-side client agent is
// asked for the active remote game connection and pings that exact remote IP.
// Results are published to window.__exirClientPing
// and dispatched as a CustomEvent so every ClientCard can subscribe without
// prop-drilling (same pattern as CacheActivityPanel).

export interface RegionPing {
  label: string;   // e.g. "UAE", "EU", "RU", "Asia"
  host: string;    // host that was pinged
  ms: number;      // -1 = loss
}

export interface ClientPing {
  machine: string;
  ip: string;
  lanMs: number;        // ping to LAN IP of the client, -1 = loss
  gameName: string | null;   // detected human-readable game name
  gameHost: string | null;   // actual remote IP/host found on the client
  gamePort?: number | null;  // actual remote port when Windows exposes it
  gameMs: number | null;     // ping to gameHost, -1 = loss, null = no game
  regions: RegionPing[];     // per-region pings for the detected game's servers
  history: number[];    // last 20 lan samples for blink/avg (ms, -1 = loss)
  updatedAt: number;
}

export const CLIENT_PING_EVT = "exir:client-ping";

declare global {
  interface Window {
    __exirClientPing?: Record<string, ClientPing>;
  }
}

// ── Game detection ────────────────────────────────────────────────────
// Map process name (lower-case, no .exe) → { display name, server host to ping }.
// Best-effort well-known matchmaking / login endpoint. If a game isn't in this
// table, we still ping the LAN IP; the "game ping" column just says "—".
export const GAME_MAP: Record<string, { name: string; host: string }> = {
  "cs2":                { name: "CS2",         host: "steamcommunity.com" },
  "csgo":               { name: "CS:GO",       host: "steamcommunity.com" },
  "dota2":              { name: "Dota 2",      host: "steamcommunity.com" },
  "valorant-win64-shipping": { name: "Valorant", host: "playvalorant.com" },
  "valorant":           { name: "Valorant",    host: "playvalorant.com" },
  "riotclientservices": { name: "Riot",        host: "riotgames.com" },
  "leagueclient":       { name: "LoL",         host: "riotgames.com" },
  "league of legends":  { name: "LoL",         host: "riotgames.com" },
  "fortniteclient-win64-shipping": { name: "Fortnite", host: "fortnite.com" },
  "fortnite":           { name: "Fortnite",    host: "fortnite.com" },
  "fallguys_client_game": { name: "Fall Guys", host: "fallguys.com" },
  "fallguys":           { name: "Fall Guys",   host: "fallguys.com" },
  "r5apex":             { name: "Apex",        host: "ea.com" },
  "apex":               { name: "Apex",        host: "ea.com" },
  "pubg":               { name: "PUBG",        host: "pubg.com" },
  "tslgame":            { name: "PUBG",        host: "pubg.com" },
  "modernwarfare":      { name: "COD MW",      host: "callofduty.com" },
  "cod":                { name: "COD",         host: "callofduty.com" },
  "gta5":               { name: "GTA V",       host: "rockstargames.com" },
  "gtav":               { name: "GTA V",       host: "rockstargames.com" },
  "rainbowsix":         { name: "R6",          host: "ubisoft.com" },
  "rocketleague":       { name: "Rocket L.",   host: "rocketleague.com" },
  "minecraft":          { name: "Minecraft",   host: "minecraft.net" },
  "overwatch":          { name: "Overwatch",   host: "battle.net" },
  "wow":                { name: "WoW",         host: "battle.net" },
  "battlenet":          { name: "Battle.net",  host: "battle.net" },
};

export function detectGame(topProcess: string): { name: string; host: string } | null {
  if (!topProcess) return null;
  const key = topProcess.toLowerCase().replace(/\.exe$/, "").trim();
  if (GAME_MAP[key]) return GAME_MAP[key];
  for (const [k, v] of Object.entries(GAME_MAP)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

const AGENT_URL = "http://localhost:8765";

export interface ActualGamePingResult {
  ok: boolean;
  ms: number | null;
  remoteAddress?: string;
  remotePort?: number | null;
  error?: string;
}

/** Pings a list of hosts via the local ping-agent. Returns -1 for loss. */
export async function pingHosts(hosts: string[]): Promise<number[]> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(`${AGENT_URL}/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hosts }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t));
    if (!r.ok) return hosts.map(() => -1);
    const j = (await r.json()) as { results?: number[] };
    return Array.isArray(j.results) ? j.results : hosts.map(() => -1);
  } catch {
    return hosts.map(() => -1);
  }
}

/** Ask the VIP-side client agent for the live game connection and ping it there. */
export async function fetchActualGamePing(host: string, processName: string): Promise<ActualGamePingResult> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const r = await fetch(`http://${host}:8766/game/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ processName }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t));
    const j = (await r.json().catch(() => ({}))) as ActualGamePingResult;
    return {
      ok: !!j.ok,
      ms: typeof j.ms === "number" ? j.ms : null,
      remoteAddress: j.remoteAddress,
      remotePort: typeof j.remotePort === "number" ? j.remotePort : null,
      error: j.error || (!r.ok ? `client-agent HTTP ${r.status}` : undefined),
    };
  } catch (e) {
    return { ok: false, ms: null, error: `client-agent unreachable: ${(e as Error).message}` };
  }
}

export function publishClientPing(map: Record<string, ClientPing>) {
  if (typeof window === "undefined") return;
  window.__exirClientPing = map;
  window.dispatchEvent(new Event(CLIENT_PING_EVT));
}
