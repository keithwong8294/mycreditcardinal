"use client";

import { useState, useMemo } from "react";
import { CARDS } from "@/lib/cards";
import { CATEGORIES } from "@/lib/categories";
import { CURRENCIES } from "@/lib/currencies";
import { cardGradient } from "@/lib/utils";
import type { Card } from "@/types";
import type { Perk } from "@/types/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "cards" | "valuations";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tryParseJson<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

function cppToCents(cpp: number): string {
  return `${(cpp / 100).toFixed(2)}¢`;
}

// ─── Card form ────────────────────────────────────────────────────────────────

const EMPTY_EARN = Object.fromEntries(CATEGORIES.map((c) => [c.id, 1]));

function CardForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Card | null;
  onSave: (card: Card) => void;
  onCancel: () => void;
}) {
  const blank: Card = {
    id: "",
    name: "",
    issuer: "",
    network: "Visa",
    currency: "cash",
    fee: 0,
    earn_json: { ...EMPTY_EARN },
    caps_json: {},
    sub_json: null,
    sub_hi_json: null,
    score: 0,
    perks_json: [],
    color_json: ["#1a1a2e", "#2d2d5e"],
    rotating: false,
    rot_cap: null,
    rot_opts: null,
    custom_select: false,
    custom_max: null,
    custom_rate: null,
    custom_opts: null,
    fico_min: null,
    status: "active",
  };

  const seed = initial ?? blank;

  const [id, setId] = useState(seed.id);
  const [name, setName] = useState(seed.name);
  const [issuer, setIssuer] = useState(seed.issuer);
  const [network, setNetwork] = useState(seed.network);
  const [currency, setCurrency] = useState(seed.currency);
  const [fee, setFee] = useState(String(seed.fee));
  const [score, setScore] = useState(String(seed.score));
  const [ficoMin, setFicoMin] = useState(seed.fico_min != null ? String(seed.fico_min) : "");
  const [status, setStatus] = useState<"active" | "discontinued">(seed.status);

  // JSON fields
  const [earnJson, setEarnJson] = useState(JSON.stringify(seed.earn_json, null, 2));
  const [capsJson, setCapsJson] = useState(JSON.stringify(seed.caps_json, null, 2));
  const [perksJson, setPerksJson] = useState(JSON.stringify(seed.perks_json, null, 2));
  const [colorJson, setColorJson] = useState(JSON.stringify(seed.color_json));
  const [subJson, setSubJson] = useState(
    seed.sub_json ? JSON.stringify(seed.sub_json, null, 2) : ""
  );
  const [subHiJson, setSubHiJson] = useState(
    seed.sub_hi_json ? JSON.stringify(seed.sub_hi_json, null, 2) : ""
  );

  // Rotating
  const [rotating, setRotating] = useState(seed.rotating);
  const [rotCap, setRotCap] = useState(seed.rot_cap != null ? String(seed.rot_cap) : "");
  const [rotOpts, setRotOpts] = useState(seed.rot_opts ? seed.rot_opts.join(", ") : "");

  // Custom select
  const [customSelect, setCustomSelect] = useState(seed.custom_select);
  const [customMax, setCustomMax] = useState(seed.custom_max != null ? String(seed.custom_max) : "");
  const [customRate, setCustomRate] = useState(seed.custom_rate != null ? String(seed.custom_rate) : "");
  const [customOpts, setCustomOpts] = useState(seed.custom_opts ? seed.custom_opts.join(", ") : "");

  const [errors, setErrors] = useState<string[]>([]);

  // Preview gradient from colorJson
  const previewGradient = useMemo(() => {
    const parsed = tryParseJson<string[]>(colorJson, []);
    return cardGradient(parsed);
  }, [colorJson]);

  function validate(): string[] {
    const errs: string[] = [];
    if (!id.trim()) errs.push("ID is required");
    if (!name.trim()) errs.push("Name is required");
    if (!issuer.trim()) errs.push("Issuer is required");
    try { JSON.parse(earnJson); } catch { errs.push("earn_json: invalid JSON"); }
    try { JSON.parse(capsJson); } catch { errs.push("caps_json: invalid JSON"); }
    try { JSON.parse(perksJson); } catch { errs.push("perks_json: invalid JSON"); }
    try { JSON.parse(colorJson); } catch { errs.push("color_json: invalid JSON"); }
    if (subJson.trim()) { try { JSON.parse(subJson); } catch { errs.push("sub_json: invalid JSON"); } }
    if (subHiJson.trim()) { try { JSON.parse(subHiJson); } catch { errs.push("sub_hi_json: invalid JSON"); } }
    return errs;
  }

  function handleSave() {
    const errs = validate();
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);

    const card: Card = {
      id: id.trim(),
      name: name.trim(),
      issuer: issuer.trim(),
      network: network.trim(),
      currency,
      fee: parseInt(fee) || 0,
      earn_json: tryParseJson(earnJson, { ...EMPTY_EARN }),
      caps_json: tryParseJson(capsJson, {}),
      sub_json: subJson.trim() ? tryParseJson(subJson, null) : null,
      sub_hi_json: subHiJson.trim() ? tryParseJson(subHiJson, null) : null,
      score: parseInt(score) || 0,
      perks_json: tryParseJson<Perk[]>(perksJson, []),
      color_json: tryParseJson<string[]>(colorJson, ["#1a1a2e", "#2d2d5e"]),
      rotating,
      rot_cap: rotating && rotCap.trim() ? parseInt(rotCap) || null : null,
      rot_opts:
        rotating && rotOpts.trim()
          ? rotOpts.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
      custom_select: customSelect,
      custom_max: customSelect && customMax.trim() ? parseInt(customMax) || null : null,
      custom_rate: customSelect && customRate.trim() ? parseFloat(customRate) || null : null,
      custom_opts:
        customSelect && customOpts.trim()
          ? customOpts.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
      fico_min: ficoMin.trim() ? parseInt(ficoMin) || null : null,
      status,
    };

    onSave(card);
  }

  return (
    <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
      {/* Card preview */}
      <div
        className="h-16 rounded-lg flex flex-col justify-end p-3"
        style={{ background: previewGradient }}
      >
        <div className="text-[9px] uppercase tracking-widest text-white/60">{issuer || "Issuer"}</div>
        <div className="text-[15px] font-semibold text-white leading-tight">{name || "Card name"}</div>
      </div>

      {/* Basic fields */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="ID (slug)">
          <input value={id} onChange={(e) => setId(e.target.value)} disabled={!!initial}
            className="field-input" placeholder="e.g. csr" />
        </Field>
        <Field label="Status">
          <Select value={status} onValueChange={(v) => v && setStatus(v as "active" | "discontinued")}>
            <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="discontinued">Discontinued</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className="field-input" placeholder="Sapphire Reserve" />
        </Field>
        <Field label="Issuer">
          <input value={issuer} onChange={(e) => setIssuer(e.target.value)} className="field-input" placeholder="Chase" />
        </Field>
        <Field label="Network">
          <input value={network} onChange={(e) => setNetwork(e.target.value)} className="field-input" placeholder="Visa" />
        </Field>
        <Field label="Currency">
          <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
            <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Annual fee ($)">
          <input type="number" min="0" value={fee} onChange={(e) => setFee(e.target.value)} className="field-input" />
        </Field>
        <Field label="Score (0–100)">
          <input type="number" min="0" max="100" value={score} onChange={(e) => setScore(e.target.value)} className="field-input" />
        </Field>
        <Field label="FICO min (optional)">
          <input type="number" min="300" max="850" value={ficoMin} onChange={(e) => setFicoMin(e.target.value)} className="field-input" placeholder="e.g. 720" />
        </Field>
        <Field label="Color JSON">
          <input value={colorJson} onChange={(e) => setColorJson(e.target.value)} className="field-input font-mono text-[11px]" placeholder='["#hex", "#hex"]' />
        </Field>
      </div>

      {/* Earn rates */}
      <JsonField label="earn_json" value={earnJson} onChange={setEarnJson} rows={14} />
      <JsonField label="caps_json" value={capsJson} onChange={setCapsJson} rows={4} />
      <JsonField label="perks_json" value={perksJson} onChange={setPerksJson} rows={6} />
      <JsonField label="sub_json (leave blank = no SUB)" value={subJson} onChange={setSubJson} rows={4} />
      <JsonField label="sub_hi_json (leave blank = none)" value={subHiJson} onChange={setSubHiJson} rows={4} />

      {/* Rotating */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-[13px] text-primary cursor-pointer">
          <input type="checkbox" checked={rotating} onChange={(e) => setRotating(e.target.checked)} className="accent-purple" />
          Rotating quarterly categories
        </label>
        {rotating && (
          <div className="grid grid-cols-2 gap-3 pl-5">
            <Field label="rot_cap (quarterly $)">
              <input type="number" value={rotCap} onChange={(e) => setRotCap(e.target.value)} className="field-input" placeholder="1500" />
            </Field>
            <Field label="rot_opts (comma-separated category IDs)">
              <input value={rotOpts} onChange={(e) => setRotOpts(e.target.value)} className="field-input text-[11px]" placeholder="dining, groceries, gas" />
            </Field>
          </div>
        )}
      </div>

      {/* Custom select */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-[13px] text-primary cursor-pointer">
          <input type="checkbox" checked={customSelect} onChange={(e) => setCustomSelect(e.target.checked)} className="accent-purple" />
          Custom-select categories
        </label>
        {customSelect && (
          <div className="grid grid-cols-2 gap-3 pl-5">
            <Field label="custom_max">
              <input type="number" min="1" value={customMax} onChange={(e) => setCustomMax(e.target.value)} className="field-input" placeholder="1" />
            </Field>
            <Field label="custom_rate (multiplier)">
              <input type="number" min="1" step="0.5" value={customRate} onChange={(e) => setCustomRate(e.target.value)} className="field-input" placeholder="5" />
            </Field>
            <div className="col-span-2">
              <Field label="custom_opts (comma-separated category IDs)">
                <input value={customOpts} onChange={(e) => setCustomOpts(e.target.value)} className="field-input text-[11px]" placeholder="dining, groceries, gas" />
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red/10 border border-red/20 rounded-lg p-3 space-y-1">
          {errors.map((e, i) => (
            <p key={i} className="text-[12px] text-red">{e}</p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1 sticky bottom-0 bg-white pb-1">
        <button onClick={onCancel} className="px-4 py-1.5 text-[13px] text-secondary border border-subtle rounded-lg hover:bg-hover transition-colors">
          Cancel
        </button>
        <button onClick={handleSave} className="px-4 py-1.5 text-[13px] font-medium bg-green hover:bg-green/90 text-white rounded-lg transition-colors">
          {initial ? "Save changes" : "Add card"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-secondary mb-1">{label}</label>
      {children}
    </div>
  );
}

function JsonField({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  let valid = true;
  if (value.trim()) {
    try { JSON.parse(value); } catch { valid = false; }
  }

  return (
    <div>
      <label className="block text-[11px] font-medium text-secondary mb-1">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 bg-field border rounded-md text-[11px] font-mono text-primary focus:outline-none resize-y ${
          valid ? "border-subtle focus:border-medium" : "border-red/40 bg-red/5"
        }`}
        spellCheck={false}
      />
    </div>
  );
}

// ─── Valuation editor ─────────────────────────────────────────────────────────

function ValuationEditor() {
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      CURRENCIES.map((c) => [c.id, { floor: c.floor, composite: c.composite, ceiling: c.ceiling }])
    )
  );
  const [saved, setSaved] = useState(false);

  function handleChange(
    currencyId: string,
    field: "floor" | "composite" | "ceiling",
    raw: string
  ) {
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n > 0) {
      setValues((prev) => ({
        ...prev,
        [currencyId]: { ...prev[currencyId], [field]: n },
      }));
      setSaved(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-tertiary">
        Values are in hundredths-of-cent (200 = 2.00¢/pt). Changes here are local and reset on reload.
        To persist, update <code className="bg-surface px-1 rounded text-[11px]">lib/currencies.ts</code> directly.
      </p>
      <div className="bg-white border border-subtle rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 px-4 py-2 bg-surface border-b border-subtle">
          <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold">Currency</span>
          <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold text-center">Floor</span>
          <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold text-center">MCC</span>
          <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold text-center">Ceiling</span>
        </div>
        {CURRENCIES.map((c) => {
          const v = values[c.id];
          return (
            <div key={c.id} className="grid grid-cols-[1fr_80px_80px_80px] gap-2 px-4 py-2.5 border-b border-subtle last:border-b-0 items-center">
              <div>
                <div className="text-[13px] font-medium text-primary">{c.name}</div>
                <div className="text-[10px] text-tertiary">
                  {cppToCents(v.floor)} – {cppToCents(v.composite)} – {cppToCents(v.ceiling)}
                </div>
              </div>
              {(["floor", "composite", "ceiling"] as const).map((field) => (
                <input
                  key={field}
                  type="number"
                  min="1"
                  value={v[field]}
                  onChange={(e) => handleChange(c.id, field, e.target.value)}
                  className="w-full px-2 py-1 bg-field border border-subtle rounded-md text-[12px] text-center text-primary focus:outline-none focus:border-medium"
                />
              ))}
            </div>
          );
        })}
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => setSaved(true)}
          className="px-4 py-1.5 text-[13px] font-medium bg-green hover:bg-green/90 text-white rounded-lg transition-colors"
        >
          {saved ? "Saved ✓" : "Save valuations"}
        </button>
      </div>
    </div>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function AdminClient() {
  const [tab, setTab] = useState<Tab>("cards");
  const [localCards, setLocalCards] = useState<Card[]>([...CARDS]);
  const [editCard, setEditCard] = useState<Card | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return localCards.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.issuer.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  }, [localCards, search]);

  function openAdd() {
    setEditCard(null);
    setIsAddMode(true);
    setShowForm(true);
  }

  function openEdit(card: Card) {
    setEditCard(card);
    setIsAddMode(false);
    setShowForm(true);
  }

  function handleSave(card: Card) {
    if (isAddMode) {
      setLocalCards((prev) => [...prev, card]);
    } else {
      setLocalCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));
    }
    setShowForm(false);
    setEditCard(null);
  }

  function handleDelete(cardId: string) {
    if (!confirm(`Delete card "${cardId}"? This only affects this session.`)) return;
    setLocalCards((prev) => prev.filter((c) => c.id !== cardId));
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[14px] font-semibold text-secondary uppercase tracking-wider">
          Admin
        </h1>
        <span className="text-[11px] text-amber bg-amber/10 border border-amber/20 rounded-full px-2 py-0.5">
          Local session only — changes don&apos;t persist to DB
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-subtle">
        {(["cards", "valuations"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-[13px] font-medium capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-green text-green"
                : "text-secondary hover:text-primary"
            }`}
          >
            {t === "cards" ? `Cards (${localCards.length})` : "Valuations"}
          </button>
        ))}
      </div>

      {tab === "cards" && (
        <>
          {/* Toolbar */}
          {!showForm && (
            <div className="flex gap-2">
              <input
                type="search"
                placeholder="Search cards…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 sm:flex-none sm:w-52 px-3 py-1.5 bg-white border border-subtle rounded-lg text-[13px] text-primary placeholder:text-tertiary focus:outline-none focus:border-medium"
              />
              <button
                onClick={openAdd}
                className="px-3 py-1.5 text-[12px] font-medium bg-green hover:bg-green/90 text-white rounded-lg transition-colors"
              >
                + Add card
              </button>
            </div>
          )}

          {/* Form */}
          {showForm && (
            <div className="bg-white border border-subtle rounded-lg p-4">
              <h2 className="text-[13px] font-semibold text-primary mb-4">
                {isAddMode ? "Add new card" : `Editing: ${editCard?.name}`}
              </h2>
              <CardForm
                initial={isAddMode ? null : editCard}
                onSave={handleSave}
                onCancel={() => { setShowForm(false); setEditCard(null); }}
              />
            </div>
          )}

          {/* Card table */}
          {!showForm && (
            <div className="bg-white border border-subtle rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_80px_80px_80px_90px] gap-2 px-4 py-2 bg-surface border-b border-subtle">
                <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold">Card</span>
                <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold">Fee</span>
                <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold">Score</span>
                <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold">Status</span>
                <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold text-right">Actions</span>
              </div>
              {filtered.map((card) => (
                <div
                  key={card.id}
                  className="grid grid-cols-[1fr_80px_80px_80px_90px] gap-2 px-4 py-2.5 border-b border-subtle last:border-b-0 items-center"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-8 h-5 rounded shrink-0"
                      style={{ background: cardGradient(card.color_json) }}
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-primary truncate">{card.name}</div>
                      <div className="text-[10px] text-tertiary">{card.issuer} · {card.id}</div>
                    </div>
                  </div>
                  <span className="text-[12px] text-secondary">{card.fee === 0 ? "No fee" : `$${card.fee}`}</span>
                  <span className="text-[12px] text-secondary tabular-nums">{card.score}</span>
                  <span className={`text-[11px] font-medium ${card.status === "active" ? "text-green" : "text-tertiary"}`}>
                    {card.status}
                  </span>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => openEdit(card)}
                      className="text-[11px] text-blue hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(card.id)}
                      className="text-[11px] text-red hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="py-8 text-center text-[13px] text-tertiary">No cards match.</div>
              )}
            </div>
          )}
        </>
      )}

      {tab === "valuations" && <ValuationEditor />}
    </div>
  );
}
