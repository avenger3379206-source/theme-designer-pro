// Background poller that asks every online VIP's exir-client-agent for its
// current keyboard/mouse/headset/controller/monitor status. Mounted once in
// the Dashboard route — renders nothing.

import { useEffect, useRef } from "react";
import type { ClientStatus } from "@/lib/monitoring-types";
import { ipFromMachine } from "@/lib/cache-activity";
import { fetchPeripherals, publishPeripherals, type PeripheralStatus } from "@/lib/peripheral-monitor";
import { getMachine, loadVncConfig } from "@/lib/vnc-config";
import { isComposing } from "@/lib/compose-lock";

// Peripheral state changes far less often than ping/temps — a light 20s
// poll is plenty and keeps 12 stations from hammering their agents.
const POLL_MS = 20_000;

interface Props {
  clients: ClientStatus[];
}

export function ClientPeripheralProbe({ clients }: Props) {
  const clientsRef = useRef<ClientStatus[]>(clients);
  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  useEffect(() => {
    const state: Record<string, PeripheralStatus> = {};
    let alive = true;

    async function tick() {
      if (isComposing()) return;
      const cfg = loadVncConfig();
      const list = clientsRef.current.filter((c) => c.online !== false);
      if (!list.length) return;

      const jobs = list
        .map((c) => {
          const mapped = getMachine(cfg, c.machine);
          const ip = mapped?.host || ipFromMachine(c.machine) || "";
          return ip ? { machine: c.machine, ip } : null;
        })
        .filter((j): j is { machine: string; ip: string } => j !== null);
      if (!jobs.length) return;

      const results = await Promise.all(jobs.map((j) => fetchPeripherals(j.machine, j.ip)));
      if (!alive) return;
      for (const r of results) state[r.machine] = r;
      publishPeripherals({ ...state });
    }

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return null;
}
