"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Toast } from "@/lib/reviewUi";

type Product = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  benefits: string | null;
  icon_emoji: string;
  color_hex: string;
  category: string;
  apply_link: string;
  apply_product_key: string | null;
  display_order: number;
  is_active: boolean;
};

const EMPTY: Omit<Product, "id"> = {
  slug: "", name: "", tagline: "", description: "", benefits: "",
  icon_emoji: "📦", color_hex: "#1B2A4A", category: "product",
  apply_link: "/apply", apply_product_key: "", display_order: 0, is_active: true,
};

export default function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("products").select("*").order("display_order", { ascending: true });
    setProducts((data as Product[]) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(p: Product) {
    const { error } = await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) { setToast({ kind: "error", message: error.message }); return; }
    load();
  }

  async function move(p: Product, dir: -1 | 1) {
    const idx = products.findIndex((x) => x.id === p.id);
    const swapWith = products[idx + dir];
    if (!swapWith) return;
    await supabase.from("products").update({ display_order: swapWith.display_order }).eq("id", p.id);
    await supabase.from("products").update({ display_order: p.display_order }).eq("id", swapWith.id);
    load();
  }

  async function remove(p: Product) {
    if (!confirm(`Remove "${p.name}" from the showcase? This can't be undone, but you can re-add it later.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) { setToast({ kind: "error", message: error.message }); return; }
    setToast({ kind: "success", message: `${p.name} removed` });
    load();
  }

  return (
    <div>
      <div className="bar">
        <h2>Showcase products</h2>
        <button className="btn" onClick={() => setEditing("new")}>Add product</button>
      </div>
      <p className="hint">These appear on the public homepage (suibingitservices.online). Reorder, edit, or hide any of them — no code changes needed.</p>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th></th><th>Product</th><th>Category</th><th>Visible</th><th></th></tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan={5} className="empty">No products yet. Click "Add product".</td></tr>
            ) : products.map((p, i) => (
              <tr key={p.id}>
                <td className="iconCell" style={{ color: p.color_hex }} data-label="">{p.icon_emoji}</td>
                <td data-label="Product">
                  <div className="pname">{p.name}</div>
                  <div className="ptag">{p.tagline}</div>
                </td>
                <td className="cat" data-label="Category">{p.category}</td>
                <td data-label="Visible">
                  <button className={`pill ${p.is_active ? "on" : "off"}`} onClick={() => toggleActive(p)}>
                    {p.is_active ? "Visible" : "Hidden"}
                  </button>
                </td>
                <td className="r actions" data-label="">
                  <button className="iconBtn" disabled={i === 0} onClick={() => move(p, -1)} title="Move up">↑</button>
                  <button className="iconBtn" disabled={i === products.length - 1} onClick={() => move(p, 1)} title="Move down">↓</button>
                  <button className="mini" onClick={() => setEditing(p)}>Edit</button>
                  <button className="mini danger" onClick={() => remove(p)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProductForm
          initial={editing === "new" ? null : editing}
          nextOrder={products.length}
          onCancel={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); setToast({ kind: "success", message: msg }); load(); }}
          onError={(msg) => setToast({ kind: "error", message: msg })}
        />
      )}

      {toast && <Toast kind={toast.kind} message={toast.message} onDone={() => setToast(null)} />}

      <style jsx>{`
        .bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        h2 { font-size: 18px; font-weight: 700; color: var(--ink); }
        .hint { font-size: 13px; color: var(--muted); margin-bottom: 16px; line-height: 1.5; }
        .table-wrap { overflow-x: auto; }
        @media (max-width: 640px) {
          table, thead, tbody, th, td, tr { display: block; }
          thead { display: none; }
          .table-wrap { overflow-x: visible; }
          tr { background: #fff; border: 1px solid var(--line); border-radius: var(--radius-sm); margin-bottom: 10px; padding: 12px 14px; }
          td { border-bottom: none; padding: 6px 0; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
          td[data-label]::before { content: attr(data-label); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); flex-shrink: 0; }
          td[data-label=""]::before { display: none; }
          td.r.actions { justify-content: flex-end; flex-wrap: wrap; }
          td.empty { display: block; text-align: center; }
        }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); padding: 10px 14px; border-bottom: 1px solid var(--line); }
        td { padding: 11px 14px; border-bottom: 1px solid var(--line); vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        .iconCell { font-size: 22px; text-align: center; width: 44px; }
        .pname { font-weight: 700; color: var(--ink); font-size: 14px; }
        .ptag { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .cat { font-size: 12px; color: var(--ink-2); text-transform: capitalize; }
        .pill { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; border: none; cursor: pointer; }
        .pill.on { background: var(--green-soft); color: var(--green); }
        .pill.off { background: var(--paper-2); color: var(--muted); }
        .r { text-align: right; }
        .actions { display: flex; gap: 6px; justify-content: flex-end; align-items: center; }
        .iconBtn { background: var(--paper-2); border: 1px solid var(--line-strong); border-radius: 6px; width: 26px; height: 26px; cursor: pointer; font-size: 12px; color: var(--ink-2); }
        .iconBtn:disabled { opacity: 0.35; cursor: default; }
        .mini { background: var(--navy-soft); color: var(--navy); border: none; border-radius: var(--radius-sm); padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .mini.danger { background: var(--red-soft); color: var(--red); }
        .empty { text-align: center; color: var(--muted); padding: 30px; }
      `}</style>
    </div>
  );
}

function ProductForm({ initial, nextOrder, onCancel, onSaved, onError }: {
  initial: Product | null; nextOrder: number;
  onCancel: () => void; onSaved: (msg: string) => void; onError: (msg: string) => void;
}) {
  const [f, setF] = useState<Omit<Product, "id">>(initial ? { ...initial } : { ...EMPTY, display_order: nextOrder });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const up = (k: keyof typeof f, v: any) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setErr(null);
    if (!f.slug.trim() || !f.name.trim()) { setErr("Slug and name are required."); return; }
    const cleanSlug = f.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    setBusy(true);
    const payload = { ...f, slug: cleanSlug, apply_product_key: f.apply_product_key?.trim() || null };
    const { error } = initial
      ? await supabase.from("products").update(payload).eq("id", initial.id)
      : await supabase.from("products").insert(payload);
    setBusy(false);
    if (error) { setErr(error.message); onError(error.message); return; }
    onSaved(initial ? `${f.name} updated` : `${f.name} added to the showcase`);
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mh">
          <h3>{initial ? "Edit product" : "Add product"}</h3>
          <button className="x" onClick={onCancel} type="button">✕</button>
        </div>

        <div className="two">
          <div>
            <label>Icon (emoji)</label>
            <input value={f.icon_emoji} onChange={(e) => up("icon_emoji", e.target.value)} placeholder="📦" />
          </div>
          <div>
            <label>Accent colour</label>
            <input type="color" value={f.color_hex} onChange={(e) => up("color_hex", e.target.value)} style={{ height: 40, padding: 4 }} />
          </div>
        </div>

        <label>Name</label>
        <input value={f.name} onChange={(e) => up("name", e.target.value)} placeholder="SUIBING Bucket" />

        <label>URL slug (unique, lowercase)</label>
        <input value={f.slug} onChange={(e) => up("slug", e.target.value)} placeholder="bucket" />

        <label>Tagline (one line)</label>
        <input value={f.tagline ?? ""} onChange={(e) => up("tagline", e.target.value)} placeholder="Your school's records, safe in one place." />

        <label>Description</label>
        <textarea rows={3} value={f.description ?? ""} onChange={(e) => up("description", e.target.value)} />

        <label>Benefits (one per line — shown as a checklist)</label>
        <textarea rows={4} value={f.benefits ?? ""} onChange={(e) => up("benefits", e.target.value)} placeholder={"Free onboarding training\nYour data stays yours"} />

        <div className="two">
          <div>
            <label>Category</label>
            <select value={f.category} onChange={(e) => up("category", e.target.value)}>
              <option value="product">Product</option>
              <option value="service">Service</option>
            </select>
          </div>
          <div>
            <label>Visible</label>
            <select value={f.is_active ? "yes" : "no"} onChange={(e) => up("is_active", e.target.value === "yes")}>
              <option value="yes">Yes</option>
              <option value="no">No (hidden)</option>
            </select>
          </div>
        </div>

        <label>Apply link (where the button goes)</label>
        <input value={f.apply_link} onChange={(e) => up("apply_link", e.target.value)} placeholder="/apply" />
        <label>Pre-fill product key on /apply (optional)</label>
        <input value={f.apply_product_key ?? ""} onChange={(e) => up("apply_product_key", e.target.value)} placeholder="bucket" />

        {err && <div className="err">{err}</div>}
        <div className="mf">
          <button className="btn ghost" type="button" onClick={onCancel}>Cancel</button>
          <button className="btn ok" type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : initial ? "Save changes" : "Add product"}</button>
        </div>

        <style jsx>{`
          .overlay { position: fixed; inset: 0; background: rgba(15,20,32,0.6); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 300; backdrop-filter: blur(3px); overflow-y: auto; }
          .modal { width: 100%; max-width: 480px; padding: 24px; margin: 20px 0; }
          .mh { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
          h3 { font-size: 17px; font-weight: 700; color: var(--ink); }
          .x { background: none; border: none; font-size: 16px; color: var(--muted); cursor: pointer; }
          label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 12px 0 5px; }
          input, select, textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 13.5px; font-family: inherit; background: #fff; box-sizing: border-box; }
          input:focus, select:focus, textarea:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
          textarea { resize: vertical; }
          .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 12px; }
          .mf { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
        `}</style>
      </div>
    </div>
  );
}
