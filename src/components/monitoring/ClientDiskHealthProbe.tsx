// Background poller that asks every online VIP's exir-client-agent for its
// disk SMART health. Mounted once in the Dashboard route — renders nothing.

import { useEffect, useRef } from "react";
import type { ClientStatus } from "@/lib/monitoring-types";
import { ipFromMachine } from "@/lib/cache-activity";
import { fetchDiskHealth, publishDiskHealth, type DiskHealthStatus } from "@/lib/disk-health";
import { getMachine, loadVncConfig } from "@/lib/vnc-config";
import { isComposing } from "@/lib/compose-lock";

// Disk health changes on the order of days, not seconds — polling every 5
// minutes is already generous and keeps the WMI/Storage queries from ever
// becoming a noticeable load across 12 stations.
const POLL_MS = 5 * 60_000;

interface Props {
  clients: ClientStatus[];
}

export function ClientDiskHealthProbe({ clients }: Props) {
  const clientsRef = useRef<ClientStatus[]>(clients);
  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  useEffect(() => {
    const state: Record<string, DiskHealthStatus> = {};
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

      const results = await Promise.all(jobs.map((j) => fetchDiskHealth(j.machine, j.ip)));
      if (!alive) return;
      for (const r of results) state[r.machine] = r;
      publishDiskHealth({ ...state });
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
