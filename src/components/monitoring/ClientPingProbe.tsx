// Background poller that pings every online VIP's LAN IP + (if a game is
// detected from topProcess) the actual remote game connection on that VIP.
// Mounted once in the Dashboard route — renders nothing.

import { useEffect, useRef } from "react";
import type { ClientStatus } from "@/lib/monitoring-types";
import { ipFromMachine } from "@/lib/cache-activity";
import {
  detectGame,
  fetchActualGamePing,
  pingHosts,
  publishClientPing,
  type ClientPing,
} from "@/lib/client-ping";
import { getMachine, loadVncConfig } from "@/lib/vnc-config";
import { isComposing } from "@/lib/compose-lock";

const POLL_MS = 3000;
const HISTORY = 20;

interface Props { clients: ClientStatus[] }

export function ClientPingProbe({ clients }: Props) {
  const clientsRef = useRef<ClientStatus[]>(clients);
  useEffect(() => { clientsRef.current = clients; }, [clients]);

  useEffect(() => {
    const state: Record<string, ClientPing> = {};
    let alive = true;

    async function tick() {
      if (isComposing()) return;
      const cfg = loadVncConfig();
      const list = clientsRef.current.filter((c) => c.online !== false);
      if (!list.length) return;

      // Build one flat list of LAN hosts to ping in a single agent call.
      const jobs: {
        machine: string;
        ip: string;
        gameName: string | null;
        topProcess: string;
      }[] = [];
      const hosts: string[] = [];
      for (const c of list) {
        const mapped = getMachine(cfg, c.machine);
        const ip = mapped?.host || ipFromMachine(c.machine) || "";
        if (!ip) continue;
        const g = detectGame(c.topProcess || "");
        jobs.push({
          machine: c.machine,
          ip,
          gameName: g?.name || null,
          topProcess: c.topProcess || "",
        });
        hosts.push(ip);
      }
      if (!hosts.length) return;

      // ping-agent caps each /ping call to 24 hosts, so chunk.
      const CHUNK = 24;
      const results: number[] = [];
      for (let i = 0; i < hosts.length; i += CHUNK) {
        const part = await pingHosts(hosts.slice(i, i + CHUNK));
        results.push(...part);
      }
      const gameResults = await Promise.all(
        jobs.map((j) => (j.gameName ? fetchActualGamePing(j.ip, j.topProcess) : Promise.resolve(null))),
      );
      if (!alive) return;
      let idx = 0;
      for (let jobIndex = 0; jobIndex < jobs.length; jobIndex++) {
        const j = jobs[jobIndex];
        const lanMs = results[idx++] ?? -1;
        const actual = gameResults[jobIndex];
        const gameMs = j.gameName ? (actual?.ok && typeof actual.ms === "number" ? actual.ms : -1) : null;
        const prev = state[j.machine];
        const history = [...(prev?.history || []), lanMs].slice(-HISTORY);
        state[j.machine] = {
          machine: j.machine,
          ip: j.ip,
          lanMs,
          gameName: j.gameName,
          gameHost: actual?.remoteAddress || null,
          gamePort: actual?.remotePort ?? null,
          gameMs,
          regions: [],
          history,
          updatedAt: Date.now(),
        };
      }
      publishClientPing({ ...state });
    }

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return null;
}
