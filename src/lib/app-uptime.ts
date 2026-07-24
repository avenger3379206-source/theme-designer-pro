// Session uptime — how long THIS instance of the monitoring app has been
// running, independent of the raw "uptime" field coming from Exir-Server.json.
//
// Why: that JSON field is written by the external hardware-monitor agent and
// reflects the physical PC's own uptime, so it never changes just because the
// dashboard project/tab was closed, reopened, or the dev server restarted —
// which is what looked "stuck"/"never resets" from the UI. This value instead
// resets to 0 every time the app itself (re)starts, matching what people
// expect from an "UPTIME" pill on the dashboard.

const APP_STARTED_AT = Date.now();

export function getAppUptimeMs(): number {
  return Date.now() - APP_STARTED_AT;
}

export function formatUptime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  parts.push(`${String(hours).padStart(2, "0")}h`);
  parts.push(`${String(mins).padStart(2, "0")}m`);
  parts.push(`${String(secs).padStart(2, "0")}s`);
  return parts.join(" ");
}
