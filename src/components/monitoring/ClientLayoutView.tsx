import type { ClientStatus } from "@/lib/monitoring-types";
import { ClientCard } from "./ClientCard";

interface Props {
  clients: ClientStatus[];
  onSelect: (c: ClientStatus) => void;
  layout: "grid" | "hex" | "list";
}

export function ClientLayoutView({ clients, onSelect, layout }: Props) {
  if (layout === "hex") return <HexLayout clients={clients} onSelect={onSelect} />;
  if (layout === "list") return <ListLayout clients={clients} onSelect={onSelect} />;
  return <GridLayout clients={clients} onSelect={onSelect} />;
}

function GridLayout({ clients, onSelect }: { clients: ClientStatus[]; onSelect: (c: ClientStatus) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {clients.map((c) => (
        <ClientCard key={c.machine} client={c} onClick={() => onSelect(c)} />
      ))}
    </div>
  );
}

function ListLayout({ clients, onSelect }: { clients: ClientStatus[]; onSelect: (c: ClientStatus) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {clients.map((c) => (
        <ClientCard key={c.machine} client={c} onClick={() => onSelect(c)} />
      ))}
    </div>
  );
}

/**
 * Honeycomb hex layout: odd rows are offset by half a hex width.
 * Each cell is a hexagon-shaped clip-path container holding a ClientCard.
 */
function HexLayout({ clients, onSelect }: { clients: ClientStatus[]; onSelect: (c: ClientStatus) => void }) {
  // Group into rows of 4 for a balanced honeycomb
  const ROW_SIZE = 4;
  const rows: ClientStatus[][] = [];
  for (let i = 0; i < clients.length; i += ROW_SIZE) {
    rows.push(clients.slice(i, i + ROW_SIZE));
  }

  return (
    <div className="flex flex-col items-center gap-[calc(var(--hex-h)/4)]">
      {rows.map((row, ri) => (
        <div
          key={ri}
          className="flex gap-[calc(var(--hex-w)/2)]"
          style={{ marginLeft: ri % 2 === 1 ? "calc(var(--hex-w) / 2)" : 0 }}
        >
          {row.map((c) => (
            <HexCell key={c.machine} client={c} onSelect={onSelect} />
          ))}
        </div>
      ))}
    </div>
  );
}

function HexCell({ client, onSelect }: { client: ClientStatus; onSelect: (c: ClientStatus) => void }) {
  return (
    <div
      className="hex-clip relative cursor-pointer transition-transform duration-300 hover:-translate-y-1 hover:scale-105"
      style={
        {
          "--hex-w": "220px",
          "--hex-h": "250px",
          width: "var(--hex-w)",
          height: "var(--hex-h)",
        } as React.CSSProperties
      }
      onClick={() => onSelect(client)}
    >
      <div className="hex-clip absolute inset-0 glass-panel" />
      <div className="hex-clip relative h-full overflow-hidden p-3">
        <ClientCard client={client} onClick={() => onSelect(client)} />
      </div>
    </div>
  );
}
