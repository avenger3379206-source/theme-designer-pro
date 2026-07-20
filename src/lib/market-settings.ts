// Grid layout preferences for the market page (columns / rows / card
// width+height, set directly in px so the person can size product cards
// exactly how they want). Small JSON blob → localStorage is fine (unlike
// product photos, which live in IndexedDB — see market.ts).

export interface MarketGridSettings {
  columns: number; // 2–10 columns
  rows: number; // 1–8 visible rows before the grid scrolls internally
  cardWidth: number; // px, minimum width of each product card
  cardHeight: number; // px, height of each product card (image + label strip)
}

// Taller by default than the first pass — portrait product photos
// (drinks, snacks) need more vertical room to not look cramped.
export const DEFAULT_MARKET_GRID: MarketGridSettings = {
  columns: 6,
  rows: 3,
  cardWidth: 150,
  cardHeight: 240,
};

export const MARKET_GRID_LIMITS = {
  columns: { min: 2, max: 10 },
  rows: { min: 1, max: 8 },
  cardWidth: { min: 90, max: 280 },
  cardHeight: { min: 140, max: 400 },
};

const KEY = "exir-market-grid-settings-v2";

export function loadMarketGrid(): MarketGridSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_MARKET_GRID;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_MARKET_GRID, ...parsed };
  } catch {
    return DEFAULT_MARKET_GRID;
  }
}

export function saveMarketGrid(s: MarketGridSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore quota errors */
  }
}
