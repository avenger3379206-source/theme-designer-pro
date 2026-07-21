// ─────────────────────────────────────────────────────────────────────────
// EXIR Ping Agent
// A tiny local HTTP server that performs REAL ICMP pings using the operating
// system's `ping` command, so the dashboard can show true latency for LAN
// devices (gateway, DNS, IPs) that browsers can never reach via fetch().
//
// It starts automatically alongside the project (see "dev" script in
// package.json) — you do NOT need to open it manually.
//
// The browser dashboard POSTs a list of hosts to http://localhost:8765/ping
// and gets back the latency (ms) for each, or -1 when the host is unreachable.
// ─────────────────────────────────────────────────────────────────────────

import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { platform } from "node:os";

const PORT = Number(process.env.PING_AGENT_PORT || 8765);
const IS_WIN = platform() === "win32";
const TIMEOUT_MS = 1500;

// Run a single OS ping and resolve to latency in ms, or -1 on loss/timeout.
function pingOne(host) {
  return new Promise((resolve) => {
    // Basic guard: only allow hostnames / IPs, never shell metacharacters.
    if (!/^[a-zA-Z0-9._-]+$/.test(host)) return resolve(-1);

    const args = IS_WIN
      ? ["-n", "1", "-w", String(TIMEOUT_MS), host]
      : ["-c", "1", "-W", String(Math.ceil(TIMEOUT_MS / 1000)), host];

    execFile("ping", args, { timeout: TIMEOUT_MS + 500 }, (err, stdout) => {
      if (err && !stdout) return resolve(-1);
      const text = String(stdout);
      // Windows: "time=16ms" / "time<1ms" / "Average = 16ms"
      // Unix:    "time=16.3 ms"
      let m = text.match(/time[=<]\s*([\d.]+)\s*ms/i);
      if (!m) m = text.match(/Average\s*=\s*([\d.]+)\s*ms/i);
      if (m) return resolve(Math.round(parseFloat(m[1])));
      // No time found → treat as loss (host did not reply).
      resolve(-1);
    });
  });
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const server = createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }

  if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
    const wantsHtml = req.url === "/";
    if (wantsHtml) {
      res.writeHead(200, { ...CORS, "Content-Type": "text/html; charset=utf-8" });
      return res.end(`<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EXIR Ping Agent</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #071018; color: #e8fff7; font-family: Tahoma, Arial, sans-serif; }
      main { width: min(560px, calc(100vw - 32px)); border: 1px solid rgba(51,255,170,.35); border-radius: 14px; padding: 24px; background: rgba(8,20,30,.82); box-shadow: 0 0 34px rgba(51,255,170,.12); }
      h1 { margin: 0 0 12px; font-size: 24px; }
      p { margin: 8px 0; color: #a7c7bd; line-height: 1.8; }
      code { direction: ltr; display: inline-block; color: #33ffaa; }
      .dot { display:inline-block; width:10px; height:10px; border-radius:50%; background:#33ffaa; box-shadow:0 0 12px #33ffaa; margin-left:8px; }
    </style>
  </head>
  <body>
    <main>
      <h1><span class="dot"></span>Ping Agent فعال است</h1>
      <p>این سرویس باید کنار داشبورد باز بماند تا پینگ واقعی DNS و IPهای لوکال را بگیرد.</p>
      <p>داشبورد: <code>http://localhost:8080</code></p>
      <p>وضعیت JSON: <code>http://localhost:${PORT}/health</code></p>
    </main>
  </body>
</html>`);
    }
    res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, agent: "exir-ping" }));
  }

  if (req.method === "POST" && req.url === "/ping") {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 10_000) req.destroy(); // guard
    });
    req.on("end", async () => {
      try {
        const { hosts } = JSON.parse(body || "{}");
        const list = Array.isArray(hosts) ? hosts.slice(0, 24) : [];
        const results = await Promise.all(
          list.map((h) => pingOne(String(h).replace(/^https?:\/\//, "").split("/")[0])),
        );
        res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
        res.end(JSON.stringify({ results }));
      } catch {
        res.writeHead(400, { ...CORS, "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "bad request" }));
      }
    });
    return;
  }

  // ── Steam status proxy ──────────────────────────────────────────────
  // The browser can't fetch crowbar.steamstat.us directly (no CORS headers),
  // so it always fell back to "unknown" (gray). We fetch it here from Node —
  // no CORS restriction — and hand the JSON back to the dashboard.
  if (req.method === "GET" && req.url === "/steam") {
    fetch("https://crowbar.steamstat.us/Barney", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://steamstat.us/",
        Origin: "https://steamstat.us",
      },
    })
      .then((r) => r.json())
      .then((json) => {
        res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
        res.end(JSON.stringify(json));
      })
      .catch((e) => {
        res.writeHead(502, { ...CORS, "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(e?.message || e) }));
      });
    return;
  }

  // ── VNC launcher ────────────────────────────────────────────────────
  // Spawns UltraVNC directly on the operator PC (no .bat download needed).
  if (req.method === "POST" && req.url === "/vnc") {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 10_000) req.destroy();
    });
    req.on("end", () => {
      try {
        const { viewerPath, host, port, password } = JSON.parse(body || "{}");
        if (!viewerPath || !host) throw new Error("viewerPath and host required");
        const args = ["-connect", `${host}:${port || 5900}`];
        if (password) args.push("-password", String(password));
        execFile(String(viewerPath), args, () => {});
        res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { ...CORS, "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }));
      }
    });
    return;
  }

  // ── QoS → Mikrotik ──────────────────────────────────────────────────
  // Sets a per-station simple-queue bandwidth limit via the Mikrotik REST API.
  // Configure once with env vars, e.g. in package.json or your shell:
  //   MIKROTIK_HOST=192.168.3.1  MIKROTIK_USER=admin  MIKROTIK_PASS=secret
  // Station IP defaults to 192.168.3.1<nn> for VIP<nn>.
  if (req.method === "POST" && req.url === "/qos") {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 10_000) req.destroy();
    });
    req.on("end", () => {
      void handleQos(body)
        .then((result) => {
          res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        })
        .catch((e) => {
          res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }));
        });
    });
    return;
  }

  res.writeHead(404, CORS);
  res.end();
});

// Tier → Mikrotik max-limit (upload/download). "UNL" removes the limit.
const TIER_LIMIT = {
  "500K": "512k/512k",
  "1M": "1M/1M",
  "2M": "2M/2M",
};

async function handleQos(body) {
  const { machine, enabled, tier } = JSON.parse(body || "{}");
  const host = process.env.MIKROTIK_HOST;
  const user = process.env.MIKROTIK_USER;
  const pass = process.env.MIKROTIK_PASS;
  if (!host || !user) {
    return { ok: false, note: "mikrotik not configured (set MIKROTIK_HOST/USER/PASS)" };
  }
  const nn = String(machine || "").replace(/\D/g, "").padStart(2, "0");
  const target = `${process.env.MIKROTIK_SUBNET || "192.168.3.1"}${nn}`;
  const queueName = `qos-${machine}`;
  const auth = "Basic " + Buffer.from(`${user}:${pass || ""}`).toString("base64");
  const base = `https://${host}/rest`;
  const opts = (method, payload) => ({
    method,
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  // Ignore self-signed cert issues on the LAN router.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  // Find existing queue for this station.
  const listRes = await fetch(
    `${base}/queue/simple?name=${encodeURIComponent(queueName)}`,
    opts("GET"),
  );
  const list = listRes.ok ? await listRes.json() : [];
  const existing = Array.isArray(list) && list[0];

  const limit = enabled && tier !== "off" && tier !== "UNL" ? TIER_LIMIT[tier] : null;
  const disabled = !enabled || tier === "off";

  if (existing) {
    const payload = {
      target,
      "max-limit": limit || "0/0",
      disabled: disabled || !limit ? "true" : "false",
    };
    await fetch(`${base}/queue/simple/${existing[".id"]}`, opts("PATCH", payload));
  } else {
    const payload = {
      name: queueName,
      target,
      "max-limit": limit || "0/0",
      disabled: disabled || !limit ? "true" : "false",
    };
    await fetch(`${base}/queue/simple`, opts("PUT", payload));
  }
  return { ok: true, machine, tier, limit: limit || "unlimited" };
}

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  ⚡ EXIR ping agent ready → http://localhost:${PORT}  (real ICMP ping)\n`);
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.log(`  ℹ️  Ping agent already running on port ${PORT} — skipping.`);
  } else {
    console.error("  ping agent error:", e.message);
  }
});
