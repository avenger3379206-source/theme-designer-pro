import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ImagePlus,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  ShoppingCart,
  Store,
  Trash2,
  X,
} from "lucide-react";
import {
  MAX_PRODUCT_IMAGE_BYTES,
  clearProductsCategory,
  deleteCategory,
  deleteProduct,
  loadCategories,
  loadProducts,
  newMarketId,
  saveCategory,
  saveProduct,
  type MarketCategory,
  type MarketProduct,
} from "@/lib/market";
import {
  DEFAULT_MARKET_GRID,
  MARKET_GRID_LIMITS,
  loadMarketGrid,
  saveMarketGrid,
  type MarketGridSettings,
} from "@/lib/market-settings";

export const Route = createFileRoute("/market")({
  head: () => ({ meta: [{ title: "فروشگاه · Exir Gamenet" }] }),
  component: MarketPage,
});

function money(n: number) {
  return n.toLocaleString("fa-IR");
}

function MarketPage() {
  const [categories, setCategories] = useState<MarketCategory[]>([]);
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [grid, setGrid] = useState<MarketGridSettings>(() => DEFAULT_MARKET_GRID);
  const [showSettings, setShowSettings] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MarketProduct | "new" | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [cats, prods] = await Promise.all([loadCategories(), loadProducts()]);
    setCategories(cats);
    setProducts(prods);
    setLoading(false);
  }

  useEffect(() => {
    setGrid(loadMarketGrid());
    refresh();
  }, []);

  // object URLs for product images — created once per product blob, revoked on change/unmount.
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const created: string[] = [];
    const next: Record<string, string> = {};
    for (const p of products) {
      if (p.image) {
        const url = URL.createObjectURL(p.image.blob);
        next[p.id] = url;
        created.push(url);
      }
    }
    setImageUrls(next);
    return () => {
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [products]);

  const visibleProducts = useMemo(
    () =>
      activeCategory === "all" ? products : products.filter((p) => p.categoryId === activeCategory),
    [products, activeCategory],
  );

  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => {
          const p = products.find((x) => x.id === id);
          return p ? { product: p, qty, subtotal: p.price * qty } : null;
        })
        .filter((x): x is { product: MarketProduct; qty: number; subtotal: number } => x !== null),
    [cart, products],
  );
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cartLines.reduce((s, l) => s + l.subtotal, 0);

  function addToCart(id: string) {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }
  function decFromCart(id: string) {
    setCart((prev) => {
      const next = { ...prev };
      const q = (next[id] || 0) - 1;
      if (q <= 0) delete next[id];
      else next[id] = q;
      return next;
    });
  }
  function removeFromCart(id: string) {
    setCart((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }
  function clearCart() {
    setCart({});
  }

  function updateGrid(patch: Partial<MarketGridSettings>) {
    setGrid((prev) => {
      const next = { ...prev, ...patch };
      saveMarketGrid(next);
      return next;
    });
  }

  async function addCategory(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const cat: MarketCategory = { id: newMarketId(), name: trimmed, order: Date.now() };
    await saveCategory(cat);
    await refresh();
  }
  async function renameCategory(cat: MarketCategory, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    await saveCategory({ ...cat, name: trimmed });
    await refresh();
  }
  async function removeCategory(cat: MarketCategory) {
    if (!confirm(`دسته «${cat.name}» حذف بشه؟ محصولاتش بدون‌دسته می‌مونن.`)) return;
    await clearProductsCategory(cat.id);
    await deleteCategory(cat.id);
    if (activeCategory === cat.id) setActiveCategory("all");
    await refresh();
  }

  async function removeProduct(p: MarketProduct) {
    if (!confirm(`محصول «${p.name}» حذف بشه؟`)) return;
    await deleteProduct(p.id);
    removeFromCart(p.id);
    await refresh();
  }

  const gridMaxHeight = grid.rows * grid.cardHeight + (grid.rows - 1) * 12 + 8;

  return (
    <div
      dir="rtl"
      className="font-fa relative flex h-screen flex-col overflow-hidden bg-background text-foreground"
      lang="fa"
    >
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: "linear-gradient(180deg, oklch(0.1 0.02 260), oklch(0.07 0.02 260))" }}
      />
      <div className="pointer-events-none fixed inset-0 -z-10 grid-bg opacity-30" />

      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface/60 px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <ArrowRight size={14} /> بازگشت
          </Link>
          <div className="flex items-center gap-2">
            <Store size={20} className="text-glow-cyan" />
            <h1 className="font-mono text-xl font-black uppercase tracking-[0.15em] text-glow-cyan">
              فروشگاه
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowSettings((s) => !s)}
              title="تنظیمات چیدمان"
              className="flex size-10 items-center justify-center rounded-lg border border-border/60 bg-surface/60 text-muted-foreground transition hover:text-cyan-300"
            >
              <Settings2 size={16} />
            </button>
            {showSettings && (
              <GridSettingsPopover
                grid={grid}
                onChange={updateGrid}
                onClose={() => setShowSettings(false)}
              />
            )}
          </div>
          <button
            onClick={() => setEditingProduct("new")}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/20"
          >
            <Plus size={14} /> افزودن محصول
          </button>
        </div>
      </header>

      {/* Body: categories + grid */}
      <div className="flex min-h-0 flex-1">
        <CategorySidebar
          categories={categories}
          active={activeCategory}
          onSelect={setActiveCategory}
          onAdd={addCategory}
          onRename={renameCategory}
          onRemove={removeCategory}
          productCounts={useMemo(() => {
            const m = new Map<string, number>();
            for (const p of products) {
              if (p.categoryId) m.set(p.categoryId, (m.get(p.categoryId) || 0) + 1);
            }
            return m;
          }, [products])}
          totalCount={products.length}
        />

        <main className="min-w-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center font-mono text-xs text-muted-foreground">
              در حال بارگذاری…
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <Store size={32} className="opacity-40" />
              <p className="font-mono text-xs">
                هنوز محصولی ثبت نشده. با دکمه «افزودن محصول» شروع کن.
              </p>
            </div>
          ) : (
            <div
              className="grid gap-3 overflow-y-auto pl-1"
              style={{
                gridTemplateColumns: `repeat(${grid.columns}, minmax(${grid.cardWidth}px, 1fr))`,
                maxHeight: gridMaxHeight,
              }}
            >
              {visibleProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  imageUrl={imageUrls[p.id]}
                  qty={cart[p.id] || 0}
                  cardHeight={grid.cardHeight}
                  onAdd={() => addToCart(p.id)}
                  onEdit={() => setEditingProduct(p)}
                  onDelete={() => removeProduct(p)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Cart bar */}
      <CartBar
        lines={cartLines}
        count={cartCount}
        total={cartTotal}
        onDec={decFromCart}
        onInc={addToCart}
        onClear={clearCart}
      />

      {editingProduct && (
        <ProductModal
          product={editingProduct === "new" ? null : editingProduct}
          categories={categories}
          onClose={() => setEditingProduct(null)}
          onSaved={async () => {
            setEditingProduct(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

// ── Category sidebar ───────────────────────────────────────────────────

function CategorySidebar({
  categories,
  active,
  onSelect,
  onAdd,
  onRename,
  onRemove,
  productCounts,
  totalCount,
}: {
  categories: MarketCategory[];
  active: string | "all";
  onSelect: (id: string | "all") => void;
  onAdd: (name: string) => void;
  onRename: (cat: MarketCategory, name: string) => void;
  onRemove: (cat: MarketCategory) => void;
  productCounts: Map<string, number>;
  totalCount: number;
}) {
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function submitNew() {
    if (!newName.trim()) return;
    onAdd(newName);
    setNewName("");
  }

  return (
    <aside className="flex w-52 shrink-0 flex-col gap-3 overflow-y-auto border-l border-border/60 p-3">
      <div className="flex gap-1.5">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitNew()}
          placeholder="دسته جدید…"
          className="min-w-0 flex-1 rounded border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-cyan-500"
        />
        <button
          onClick={submitNew}
          className="flex size-8 shrink-0 items-center justify-center rounded border border-cyan-500/50 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <button
          onClick={() => onSelect("all")}
          className="flex items-center justify-between rounded-lg border px-2.5 py-2 text-xs font-bold uppercase tracking-wider transition"
          style={
            active === "all"
              ? {
                  borderColor: "var(--neon-cyan)",
                  background: "oklch(0.85 0.18 200 / 0.12)",
                  color: "var(--neon-cyan)",
                }
              : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
          }
        >
          <span>همه محصولات</span>
          <span className="font-mono text-[10px] opacity-70">{totalCount}</span>
        </button>

        {categories.map((cat) => (
          <div
            key={cat.id}
            className="group flex items-center gap-1 rounded-lg border px-1.5 py-1 transition"
            style={
              active === cat.id
                ? { borderColor: "var(--neon-cyan)", background: "oklch(0.85 0.18 200 / 0.12)" }
                : { borderColor: "var(--border)" }
            }
          >
            {renamingId === cat.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onRename(cat, renameValue);
                    setRenamingId(null);
                  }
                  if (e.key === "Escape") setRenamingId(null);
                }}
                onBlur={() => {
                  onRename(cat, renameValue);
                  setRenamingId(null);
                }}
                className="min-w-0 flex-1 rounded border border-cyan-500/50 bg-background/60 px-1.5 py-1 text-xs outline-none"
              />
            ) : (
              <button
                onClick={() => onSelect(cat.id)}
                className="flex min-w-0 flex-1 items-center justify-between px-1 py-1 text-right text-xs font-bold"
                style={{ color: active === cat.id ? "var(--neon-cyan)" : undefined }}
              >
                <span className="truncate">{cat.name}</span>
                <span className="shrink-0 font-mono text-[10px] opacity-70">
                  {productCounts.get(cat.id) || 0}
                </span>
              </button>
            )}
            <button
              onClick={() => {
                setRenamingId(cat.id);
                setRenameValue(cat.name);
              }}
              className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:text-cyan-300 group-hover:opacity-100"
              title="ویرایش نام"
            >
              <Pencil size={11} />
            </button>
            <button
              onClick={() => onRemove(cat)}
              className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:text-red-400 group-hover:opacity-100"
              title="حذف دسته"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}

        {categories.length === 0 && (
          <p className="px-1 font-mono text-[10px] leading-relaxed text-muted-foreground/70">
            مثلاً: خوراکی، نوشیدنی، یخچال…
          </p>
        )}
      </div>
    </aside>
  );
}

// ── Product card ────────────────────────────────────────────────────────

function ProductCard({
  product,
  imageUrl,
  qty,
  cardHeight,
  onAdd,
  onEdit,
  onDelete,
}: {
  product: MarketProduct;
  imageUrl?: string;
  qty: number;
  cardHeight: number;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Scale name/price text with the configured card height so bigger cards
  // (set from the layout settings) actually read bigger, not just "taller".
  const nameSize = cardHeight >= 260 ? "text-base" : cardHeight >= 190 ? "text-sm" : "text-xs";
  const priceSize = cardHeight >= 260 ? "text-xl" : cardHeight >= 190 ? "text-lg" : "text-base";

  return (
    <div
      onClick={onAdd}
      className="group relative cursor-pointer overflow-hidden rounded-xl glass-panel transition hover:-translate-y-0.5 hover:neon-border-cyan active:scale-[0.97]"
      style={{ height: cardHeight }}
      title="برای افزودن به سبد کلیک کن"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={product.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/40">
          <ImagePlus size={22} className="text-muted-foreground/40" />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-2 pb-2 pt-8">
        <div className={`truncate text-center font-bold text-white ${nameSize}`}>
          {product.name}
        </div>
        <div className={`font-fa text-center font-black text-glow-cyan ${priceSize}`}>
          {money(product.price)} <span className="text-[0.6em] font-normal">تومان</span>
        </div>
      </div>

      {qty > 0 && (
        <div
          className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full font-mono text-[11px] font-bold pulse-dot"
          style={{
            background: "var(--neon-cyan)",
            color: "oklch(0.1 0.02 260)",
            boxShadow: "0 0 10px var(--neon-cyan)",
          }}
        >
          {qty}
        </div>
      )}

      <div className="absolute top-1.5 left-1.5 flex gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="flex size-6 items-center justify-center rounded-md bg-black/70 text-cyan-300 hover:bg-black/90"
          title="ویرایش"
        >
          <Pencil size={11} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex size-6 items-center justify-center rounded-md bg-black/70 text-red-400 hover:bg-black/90"
          title="حذف"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

// ── Cart bar ────────────────────────────────────────────────────────────

function CartBar({
  lines,
  count,
  total,
  onDec,
  onInc,
  onClear,
}: {
  lines: { product: MarketProduct; qty: number; subtotal: number }[];
  count: number;
  total: number;
  onDec: (id: string) => void;
  onInc: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <footer className="flex shrink-0 items-center gap-4 border-t border-border/60 bg-surface/70 px-4 py-3 backdrop-blur-sm">
      <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-x-auto">
        {lines.length === 0 ? (
          <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <ShoppingCart size={14} /> سبد خالیه — روی محصولات کلیک کن
          </span>
        ) : (
          lines.map(({ product, qty, subtotal }) => (
            <div
              key={product.id}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-2"
            >
              <span className="font-fa max-w-[130px] truncate text-base font-bold">
                {product.name}
              </span>
              <button
                onClick={() => onDec(product.id)}
                className="flex size-6 items-center justify-center rounded bg-black/30 text-muted-foreground hover:text-red-300"
              >
                <Minus size={12} />
              </button>
              <span className="font-fa text-lg font-black text-glow-cyan">× {qty}</span>
              <button
                onClick={() => onInc(product.id)}
                className="flex size-6 items-center justify-center rounded bg-black/30 text-muted-foreground hover:text-cyan-300"
              >
                <Plus size={12} />
              </button>
              <span className="font-fa text-base font-bold text-muted-foreground">
                {money(subtotal)}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="flex shrink-0 items-center gap-4 border-r border-border/60 pr-4">
        <button
          onClick={onClear}
          disabled={lines.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition hover:text-red-300 disabled:opacity-30"
        >
          <RotateCcw size={12} /> خالی کردن سبد
        </button>
        <div className="text-center">
          <div className="font-fa text-sm font-bold text-muted-foreground">{count} کالا</div>
          <div
            className="font-fa text-3xl font-black text-glow-green"
            style={{ color: "var(--neon-green)" }}
          >
            {money(total)} <span className="text-base font-bold">تومان</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Grid settings popover ──────────────────────────────────────────────

function GridSettingsPopover({
  grid,
  onChange,
  onClose,
}: {
  grid: MarketGridSettings;
  onChange: (patch: Partial<MarketGridSettings>) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-12 z-20 w-72 rounded-xl p-4 glass-panel neon-border-cyan"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          چیدمان شبکه محصولات
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={13} />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="flex items-center justify-between font-mono text-[10px] uppercase text-muted-foreground">
            تعداد ستون <span className="text-cyan-300">{grid.columns}</span>
          </label>
          <input
            type="range"
            min={MARKET_GRID_LIMITS.columns.min}
            max={MARKET_GRID_LIMITS.columns.max}
            value={grid.columns}
            onChange={(e) => onChange({ columns: Number(e.target.value) })}
            className="mt-1 w-full accent-cyan-400"
          />
        </div>
        <div>
          <label className="flex items-center justify-between font-mono text-[10px] uppercase text-muted-foreground">
            تعداد سطر قابل‌نمایش <span className="text-cyan-300">{grid.rows}</span>
          </label>
          <input
            type="range"
            min={MARKET_GRID_LIMITS.rows.min}
            max={MARKET_GRID_LIMITS.rows.max}
            value={grid.rows}
            onChange={(e) => onChange({ rows: Number(e.target.value) })}
            className="mt-1 w-full accent-cyan-400"
          />
        </div>
        <div>
          <label className="flex items-center justify-between font-mono text-[10px] uppercase text-muted-foreground">
            عرض محصول <span className="text-cyan-300">{grid.cardWidth}px</span>
          </label>
          <input
            type="range"
            min={MARKET_GRID_LIMITS.cardWidth.min}
            max={MARKET_GRID_LIMITS.cardWidth.max}
            step={5}
            value={grid.cardWidth}
            onChange={(e) => onChange({ cardWidth: Number(e.target.value) })}
            className="mt-1 w-full accent-cyan-400"
          />
        </div>
        <div>
          <label className="flex items-center justify-between font-mono text-[10px] uppercase text-muted-foreground">
            ارتفاع محصول <span className="text-cyan-300">{grid.cardHeight}px</span>
          </label>
          <input
            type="range"
            min={MARKET_GRID_LIMITS.cardHeight.min}
            max={MARKET_GRID_LIMITS.cardHeight.max}
            step={5}
            value={grid.cardHeight}
            onChange={(e) => onChange({ cardHeight: Number(e.target.value) })}
            className="mt-1 w-full accent-cyan-400"
          />
        </div>
        <button
          onClick={() => onChange(DEFAULT_MARKET_GRID)}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-border/60 py-1.5 font-mono text-[10px] uppercase text-muted-foreground hover:text-foreground"
        >
          <RotateCcw size={11} /> پیش‌فرض
        </button>
      </div>
    </div>
  );
}

// ── Add/Edit product modal ─────────────────────────────────────────────

function ProductModal({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: MarketProduct | null;
  categories: MarketCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product?.price ?? 0);
  const [categoryId, setCategoryId] = useState<string | null>(
    product?.categoryId ?? categories[0]?.id ?? null,
  );
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!product?.image) return;
    const url = URL.createObjectURL(product.image.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [product]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_PRODUCT_IMAGE_BYTES) {
      setError("حجم تصویر باید کمتر از ۱۰ مگابایت باشه");
      return;
    }
    if (!f.type.startsWith("image/")) {
      setError("فایل انتخاب‌شده تصویر نیست");
      return;
    }
    setError(null);
    setFile(f);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
  }

  async function onSave() {
    if (!name.trim()) {
      setError("نام محصول رو وارد کن");
      return;
    }
    if (!price || price <= 0) {
      setError("قیمت معتبر وارد کن");
      return;
    }
    setSaving(true);
    setError(null);
    const rec: MarketProduct = {
      id: product?.id ?? newMarketId(),
      name: name.trim(),
      price: Math.round(price),
      categoryId,
      order: product?.order ?? Date.now(),
      createdAt: product?.createdAt ?? Date.now(),
      image: file ? { blob: file, type: file.type } : (product?.image ?? null),
    };
    try {
      await saveProduct(rec);
      onSaved();
    } catch {
      setError("ذخیره‌سازی ناموفق بود");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{
        background: "oklch(0.05 0.02 260 / 0.65)",
        backdropFilter: "blur(16px) saturate(140%)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
        className="font-fa relative grid w-full max-w-lg gap-4 rounded-2xl p-6 glass-panel neon-border-cyan"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-glow-cyan">
            {product ? "ویرایش محصول" : "افزودن محصول جدید"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md border border-border/60 p-1 text-muted-foreground hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => fileRef.current?.click()}
            className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border/60 bg-surface/40 hover:border-cyan-500/60"
            style={{ width: 110, aspectRatio: "3 / 4" }}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <ImagePlus size={20} />
                <span className="text-[10px]">انتخاب تصویر</span>
              </div>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
          />

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase text-muted-foreground">
                نام محصول
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً: نوشابه قوطی"
                className="mt-1 w-full rounded border border-border bg-background/60 px-2.5 py-2 text-sm outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-muted-foreground">
                قیمت (تومان)
              </label>
              <input
                type="number"
                min={0}
                value={price || ""}
                onChange={(e) => setPrice(Number(e.target.value))}
                placeholder="0"
                className="mt-1 w-full rounded border border-border bg-background/60 px-2.5 py-2 text-sm outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-muted-foreground">
                دسته‌بندی
              </label>
              <select
                value={categoryId ?? ""}
                onChange={(e) => setCategoryId(e.target.value || null)}
                className="mt-1 w-full rounded border border-border bg-background/60 px-2.5 py-2 text-sm outline-none focus:border-cyan-500"
              >
                <option value="">بدون دسته</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground/70">
          هر فرمت تصویری پشتیبانی می‌شه (JPG, PNG, WEBP, …) تا حجم ۱۰ مگابایت. همه‌ی تصاویر با یک
          اندازه‌ی ثابت نمایش داده می‌شن.
        </p>

        {error && (
          <div
            className="rounded border px-2.5 py-1.5 text-xs"
            style={{
              borderColor: "var(--neon-red)55",
              color: "var(--neon-red)",
              background: "var(--neon-red)10",
            }}
          >
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-border/60 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            انصراف
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-2.5 text-xs font-bold uppercase tracking-widest neon-border-cyan hover:brightness-125 disabled:opacity-50"
          >
            {saving ? "در حال ذخیره…" : "ذخیره"}
          </button>
        </div>
      </div>
    </div>
  );
}
