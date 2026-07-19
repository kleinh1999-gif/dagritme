import React, { useState, useEffect, useRef } from "react";
import {
  CalendarDays, Dumbbell, CheckSquare, Plus, X, ChevronLeft, ChevronRight,
  Trash2, Check, Clock, Sun, Search, Download, RotateCcw, Play, Flag,
  LayoutGrid, ArrowRight, MapPin, Briefcase, Navigation, LocateFixed, Info,
  LogIn, LogOut, RefreshCw, ExternalLink, ShieldCheck, Gamepad2,
} from "lucide-react";

/* ============================================================
   OPSLAG — met veilige fallback als window.storage niet bestaat
   (bijv. buiten Claude.ai's artifact-omgeving). Nooit blokkerend.
============================================================ */

/* ============================================================
   OPSLAG — gebruikt window.storage als dat bestaat (bijv. binnen
   Claude.ai), anders localStorage (voor een eigen, echte deploy).
   Nooit blokkerend: bij een fout wordt altijd de fallback-waarde
   teruggegeven, zodat de app nooit blijft hangen op "Laden…".
============================================================ */

const LS_PREFIX = "dagritme:";

async function storeGet(key, fallback) {
  try {
    if (typeof window === "undefined") return fallback;
    if (window.storage) {
      const r = await window.storage.get(key, false);
      return r ? JSON.parse(r.value) : fallback;
    }
    const raw = window.localStorage?.getItem(LS_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

async function storeSet(key, value) {
  try {
    if (typeof window === "undefined") return;
    if (window.storage) {
      await window.storage.set(key, JSON.stringify(value), false);
      return;
    }
    window.localStorage?.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error("Opslaan mislukt voor", key, e);
  }
}

/* ============================================================
   HELPERS
============================================================ */

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const fmtDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const todayStr = () => fmtDate(new Date());

const parseDate = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const fmtTime = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const fmtDayTime = (ts) => {
  const d = new Date(ts);
  const isToday = fmtDate(d) === todayStr();
  return `${isToday ? "Vandaag" : `${d.getDate()} ${DUTCH_MONTHS[d.getMonth()]}`}, ${fmtTime(ts)}`;
};

const relTime = (ts) => {
  const mins = Math.max(1, Math.floor((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins}m geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u geleden`;
  return `${Math.floor(hours / 24)}d geleden`;
};

const dateBadge = (dateStr) => {
  if (!dateStr) return null;
  const d = parseDate(dateStr);
  const today = parseDate(todayStr());
  const diffDays = Math.round((d - today) / 86400000);
  if (diffDays === 0) return { text: "Vandaag", tone: "today" };
  if (diffDays === 1) return { text: "Morgen", tone: "soon" };
  if (diffDays < 0) return { text: `Te laat · ${d.getDate()} ${DUTCH_MONTHS[d.getMonth()]}`, tone: "late" };
  if (diffDays <= 6) return { text: `${DUTCH_DAYS_FULL[(d.getDay() + 6) % 7]} ${d.getDate()} ${DUTCH_MONTHS[d.getMonth()]}`, tone: "future" };
  return { text: `${d.getDate()} ${DUTCH_MONTHS[d.getMonth()]}`, tone: "future" };
};

// Afstand in meters tussen twee lat/lng-punten (Haversine)
const distanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

function loadGoogleIdentityScript() {
  return new Promise((resolve, reject) => {
    try {
      if (window.google?.accounts?.oauth2) return resolve();
      const existing = document.getElementById("gsi-client");
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("Kon Google-script niet laden")));
        return;
      }
      const script = document.createElement("script");
      script.id = "gsi-client";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Kon Google-script niet laden"));
      document.head.appendChild(script);
    } catch (e) {
      reject(e);
    }
  });
}

/* ============================================================
   STATISCHE DATA
============================================================ */

const DUTCH_DAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const DUTCH_DAYS_FULL = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];
const DUTCH_MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

const EVENT_COLORS = [
  { name: "Rood", value: "#E4002B" },
  { name: "Groen", value: "#34D399" },
  { name: "Amber", value: "#F5B942" },
  { name: "Blauw", value: "#60A5FA" },
  { name: "Paars", value: "#A78BFA" },
];

const EXERCISE_LIBRARY = [
  "Bankdrukken", "Schouderdrukken", "Triceps pushdown", "Zijwaartse heffing", "Chestpress machine",
  "Optrekken", "Roeien", "Lat pulldown", "Biceps curl", "Face pull",
  "Squat", "Beenpers", "Beenstrekker", "Beenbuiger", "Kuitheffing",
  "Deadlift", "Hip thrust", "Plank", "Ab wheel", "Cardio (loopband)",
];

const TEMPLATES = [
  { id: "upperA", name: "Upper A", exercises: ["Bankdrukken", "Roeien", "Schouderdrukken", "Lat pulldown", "Biceps curl", "Triceps pushdown"] },
  { id: "upperB", name: "Upper B", exercises: ["Chestpress machine", "Optrekken", "Zijwaartse heffing", "Face pull", "Biceps curl"] },
  { id: "lowerA", name: "Lower A", exercises: ["Squat", "Beenpers", "Beenstrekker", "Beenbuiger", "Kuitheffing"] },
  { id: "lowerB", name: "Lower B", exercises: ["Deadlift", "Hip thrust", "Beenpers", "Kuitheffing", "Plank"] },
];

const DEFAULT_WORK_CONFIG = { enabled: false, label: "", lat: null, lng: null, radius: 100, workdays: [0, 1, 2, 3, 4] };

const DEFAULT_GAMES = [
  { id: uid(), name: "GTA 6", addedAt: Date.now() },
  { id: uid(), name: "Rocket League", addedAt: Date.now() },
  { id: uid(), name: "Apex Legends", addedAt: Date.now() },
];

const NAV = [
  { id: "home", label: "Overzicht", icon: LayoutGrid },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "gym", label: "Gym", icon: Dumbbell },
  { id: "tasks", label: "Taken", icon: CheckSquare },
  { id: "work", label: "Werk", icon: Briefcase },
  { id: "games", label: "Games", icon: Gamepad2 },
];

/* ============================================================
   UI-BOUWSTENEN
   Alle CUSTOM kleuren lopen via de eigen CSS-classes hieronder
   (zie <GlobalStyles/>) — geen Tailwind arbitrary-values zoals
   bg-[#131417], want die werken niet zonder JIT-compiler.
   Layout/spacing/typografie blijft gewoon Tailwind (dat zijn
   altijd standaard, niet-arbitraire classes).
============================================================ */

function GlobalStyles() {
  return (
    <style>{`
      :root { color-scheme: dark; }
      html, body { background-color: #08090A; }

      .app-bg { background-color: #08090A; }
      .card {
        background-color: #131417;
        border: 1px solid rgba(255,255,255,0.07);
      }
      .card-accent-top { border-top: 2px solid #E4002B; }

      .btn-primary {
        background-color: #E4002B; color: #ffffff; border: none;
      }
      .btn-primary:hover:not(:disabled) { background-color: #FF1F44; }
      .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
      .btn-primary:focus-visible { outline: 2px solid #FF3355; outline-offset: 2px; }

      .btn-ghost { border: 1px solid rgba(255,255,255,0.12); color: #e2e8f0; background: transparent; }
      .btn-ghost:hover:not(:disabled) { background-color: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.25); }
      .btn-ghost:focus-visible { outline: 2px solid #FF3355; outline-offset: 2px; }
      .btn-ghost-danger { color: #f87171; border-color: rgba(248,113,113,0.25); }
      .btn-ghost-danger:hover { background-color: rgba(248,113,113,0.1); }

      .icon-btn { color: #cbd5e1; background: transparent; }
      .icon-btn:hover { color: #ffffff; background-color: rgba(255,255,255,0.06); }

      .accent-text { color: #FF7E93; }
      .accent-text-strong { color: #FF3355; }
      .accent-bg-soft { background-color: rgba(228,0,43,0.15); }
      .accent-bg-soft-strong { background-color: rgba(228,0,43,0.25); }
      .accent-border { border-color: #E4002B; }
      .accent-border-soft:hover { border-color: rgba(228,0,43,0.5); }
      .accent-fill { background-color: #E4002B; }
      .accent-dot { background-color: #FF7E93; }

      .modal-bg { background-color: #101113; }
      .mobile-nav-bg { background-color: rgba(12,13,15,0.96); }
      .nav-item-active { background-color: rgba(228,0,43,0.15); color: #FF7E93; }
      .tab-active { background-color: #E4002B; color: #ffffff; }
      .tab-inactive { color: #94a3b8; background: transparent; }
      .tab-inactive:hover { color: #ffffff; }

      .toggle-track-on { background-color: #E4002B; }
      .toggle-track-off { background-color: rgba(255,255,255,0.1); }

      .input-field {
        background-color: #08090A;
        border: 1px solid rgba(255,255,255,0.12);
        color: #ffffff !important;
        -webkit-text-fill-color: #ffffff !important;
        caret-color: #ffffff !important;
      }
      .input-field::placeholder { color: #64748b !important; -webkit-text-fill-color: #64748b !important; opacity: 1 !important; }
      .input-field:focus { outline: none; border-color: #FF3355; box-shadow: 0 0 0 2px rgba(255,51,85,0.35); }

      input, textarea, select {
        color: #ffffff !important;
        -webkit-text-fill-color: #ffffff !important;
        caret-color: #ffffff !important;
        color-scheme: dark;
      }

      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-thumb { background: #2E3033; border-radius: 8px; }
      ::-webkit-scrollbar-track { background: transparent; }
      input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.75) sepia(1) saturate(6) hue-rotate(-40deg); cursor: pointer; }
      input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      .tabular-num { font-variant-numeric: tabular-nums; }
      @keyframes spin { to { transform: rotate(360deg); } }
      .spin { animation: spin 1s linear infinite; }
    `}</style>
  );
}

const inputCls = "input-field w-full rounded-2xl px-4 py-3 text-sm";

const IconBtn = ({ onClick, children, label, className = "" }) => (
  <button
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`icon-btn inline-flex items-center justify-center rounded-full w-10 h-10 transition-colors ${className}`}
  >
    {children}
  </button>
);

const Card = ({ children, className = "", accent }) => (
  <div className={`card rounded-3xl ${accent ? "card-accent-top" : ""} ${className}`}>{children}</div>
);

const PrimaryBtn = ({ onClick, children, className = "", type = "button", disabled }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`btn-primary inline-flex items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold px-5 py-3 transition-colors ${className}`}
  >
    {children}
  </button>
);

const GhostBtn = ({ onClick, children, className = "", danger }) => (
  <button
    onClick={onClick}
    className={`${danger ? "btn-ghost-danger" : "btn-ghost"} inline-flex items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold px-5 py-3 transition-colors ${className}`}
  >
    {children}
  </button>
);

const Modal = ({ onClose, children, title, wide }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
    <div
      onClick={(e) => e.stopPropagation()}
      className={`modal-bg card-accent-top w-full ${wide ? "sm:max-w-lg" : "sm:max-w-sm"} rounded-t-[2rem] sm:rounded-[2rem] max-h-[90vh] overflow-y-auto shadow-2xl`}
    >
      <div className="modal-bg flex items-center justify-between px-6 pt-6 pb-2 sticky top-0">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <IconBtn onClick={onClose} label="Sluiten"><X size={18} /></IconBtn>
      </div>
      <div className="px-6 pb-7 pt-2">{children}</div>
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <label className="block mb-4">
    <span className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</span>
    {children}
  </label>
);

const Tabs = ({ value, onChange, options }) => (
  <div className="card rounded-2xl p-1 flex w-full max-w-xs mb-4">
    {options.map(([v, l]) => (
      <button
        key={v}
        onClick={() => onChange(v)}
        className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-colors ${value === v ? "tab-active" : "tab-inactive"}`}
      >
        {l}
      </button>
    ))}
  </div>
);

const InfoNote = ({ children }) => (
  <Card className="p-4 flex gap-3">
    <Info size={17} className="text-slate-500 shrink-0 mt-0.5" />
    <p className="text-xs text-slate-400 leading-relaxed">{children}</p>
  </Card>
);

/* ============================================================
   OVERZICHT (startscherm) — alleen vandaag, geen navigatieknoppen
============================================================ */

function DashboardModule({ greeting, now, events, tasks, toggleTask, games, feeds }) {
  const today = todayStr();
  const todayEvents = events.filter((e) => e.date === today).sort((a, b) => a.start.localeCompare(b.start));
  const todayTasks = tasks.filter((t) => !t.done && t.date && t.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const todayNews = games
    .flatMap((g) => {
      const feed = feeds[g.id];
      if (!feed?.items) return [];
      return feed.items.filter((it) => fmtDate(new Date(it.created)) === today).map((it) => ({ ...it, game: g.name }));
    })
    .sort((a, b) => b.created - a.created);

  return (
    <div className="pb-24 md:pb-8 space-y-4">
      <div className="mb-2">
        <p className="text-sm text-slate-500 mb-1">{DUTCH_DAYS_FULL[(now.getDay() + 6) % 7]} {now.getDate()} {DUTCH_MONTHS[now.getMonth()]}</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">{greeting}.</h1>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2.5 mb-3.5">
          <span className="accent-bg-soft w-8 h-8 rounded-xl flex items-center justify-center shrink-0"><CalendarDays size={15} className="accent-text" /></span>
          <p className="text-sm font-bold text-white">Agenda vandaag</p>
        </div>
        {todayEvents.length === 0 ? (
          <p className="text-sm text-slate-500">Geen afspraken vandaag.</p>
        ) : (
          <div className="space-y-2.5">
            {todayEvents.map((ev) => (
              <div key={ev.id} className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                <span className="tabular-num text-sm text-slate-400 shrink-0">{ev.start}</span>
                <span className="text-sm text-slate-100 truncate">{ev.title}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2.5 mb-3.5">
          <span className="accent-bg-soft w-8 h-8 rounded-xl flex items-center justify-center shrink-0"><CheckSquare size={15} className="accent-text" /></span>
          <p className="text-sm font-bold text-white">Taken vandaag</p>
        </div>
        {todayTasks.length === 0 ? (
          <p className="text-sm text-slate-500">Geen taken voor vandaag.</p>
        ) : (
          <div className="space-y-2">
            {todayTasks.map((t) => (
              <button key={t.id} onClick={() => toggleTask(t.id)} className="w-full flex items-center gap-2.5 text-left group">
                <span className="w-5 h-5 rounded-md border border-white/20 group-hover:border-white/50 flex items-center justify-center shrink-0 transition-colors" />
                <span className="text-sm text-slate-100 group-hover:text-white">{t.text}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2.5 mb-3.5">
          <span className="accent-bg-soft w-8 h-8 rounded-xl flex items-center justify-center shrink-0"><Gamepad2 size={15} className="accent-text" /></span>
          <p className="text-sm font-bold text-white">Game nieuws vandaag</p>
        </div>
        {todayNews.length === 0 ? (
          <p className="text-sm text-slate-500">Geen nieuw nieuws vandaag voor je games.</p>
        ) : (
          <div className="space-y-3">
            {todayNews.slice(0, 6).map((item) => (
              <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="block group">
                <p className="accent-text text-[11px] font-bold uppercase tracking-wide mb-0.5">{item.game}</p>
                <p className="text-sm text-slate-200 group-hover:text-white leading-snug">{item.title}</p>
              </a>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================================================
   AGENDA
============================================================ */

function EventModal({ initial, defaultDate, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [date, setDate] = useState(initial?.date || defaultDate || todayStr());
  const [start, setStart] = useState(initial?.start || "09:00");
  const [end, setEnd] = useState(initial?.end || "10:00");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [color, setColor] = useState(initial?.color || EVENT_COLORS[0].value);

  const save = () => {
    if (!title.trim()) return;
    onSave({ id: initial?.id || uid(), title: title.trim(), date, start, end, notes: notes.trim(), color });
  };

  return (
    <Modal title={initial ? "Afspraak bewerken" : "Nieuwe afspraak"} onClose={onClose}>
      <Field label="Titel">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bijv. Tandarts" autoFocus />
      </Field>
      <Field label="Datum">
        <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Van"><input type="time" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Tot"><input type="time" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <Field label="Notities">
        <textarea className={`${inputCls} min-h-[70px] resize-none`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optioneel" />
      </Field>
      <div className="mb-5">
        <span className="block text-xs font-semibold text-slate-500 mb-2">Kleur</span>
        <div className="flex gap-2">
          {EVENT_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              aria-label={c.name}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: c.value, outline: color === c.value ? "2px solid white" : "none", outlineOffset: "2px" }}
            >
              {color === c.value && <Check size={14} className="text-white" />}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <PrimaryBtn onClick={save} className="flex-1">Opslaan</PrimaryBtn>
        {initial && <GhostBtn danger onClick={() => onDelete(initial.id)} className="!px-3"><Trash2 size={15} /></GhostBtn>}
      </div>
    </Modal>
  );
}

function GoogleCalendarModal({ onClose, onExport, clientId, setClientId, email, lastSync, syncing, error, onConnect, onDisconnect, onSync }) {
  const [editingClientId, setEditingClientId] = useState(clientId);

  return (
    <Modal title="Google Agenda koppelen" onClose={onClose} wide>
      {!email ? (
        <>
          <div className="rounded-xl px-3.5 py-3 mb-4 flex gap-2.5" style={{ backgroundColor: "rgba(245,185,66,0.1)", border: "1px solid rgba(245,185,66,0.2)" }}>
            <ShieldCheck size={16} className="text-amber-300 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200 leading-relaxed">
              Voor echte inlog heeft deze app een eigen, gratis Google Client ID nodig — die kan alleen jij aanmaken (gratis, ~5 min, geen creditcard). Geen enkele app kan namens jou bij Google inloggen zonder zo'n registratie.
            </p>
          </div>

          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">Zo maak je een gratis Client ID</p>
          <ol className="space-y-2 mb-4">
            {[
              <>Ga naar <b className="text-slate-200">console.cloud.google.com</b> en maak een gratis project aan.</>,
              <>Ga naar <b className="text-slate-200">"OAuth-toestemmingsscherm"</b>, kies "Extern" en voeg jezelf toe als testgebruiker.</>,
              <>Ga naar <b className="text-slate-200">"Inloggegevens" → "OAuth-client-ID"</b>, type "Webtoepassing".</>,
              <>Voeg bij <b className="text-slate-200">"Geautoriseerde JavaScript-bronnen"</b> de exacte URL toe waar deze app draait.</>,
              <>Kopieer de <b className="text-slate-200">Client ID</b> en plak 'm hieronder.</>,
            ].map((step, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-300">
                <span className="shrink-0 w-5 h-5 rounded-full bg-white/10 text-[11px] flex items-center justify-center font-medium text-slate-200">{i + 1}</span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="accent-text inline-flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 mb-4">
            Open Google Cloud Console <ExternalLink size={12} />
          </a>

          <Field label="Client ID">
            <input className={inputCls} placeholder="xxxxxxxx.apps.googleusercontent.com" value={editingClientId} onChange={(e) => setEditingClientId(e.target.value)} />
          </Field>
          {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
          <PrimaryBtn onClick={() => { setClientId(editingClientId.trim()); onConnect(editingClientId.trim()); }} disabled={!editingClientId.trim() || syncing} className="w-full">
            {syncing ? "Bezig…" : <><LogIn size={15} /> Inloggen met Google</>}
          </PrimaryBtn>
        </>
      ) : (
        <>
          <div className="rounded-xl px-3.5 py-3 mb-4 flex items-center gap-2.5" style={{ backgroundColor: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}>
            <ShieldCheck size={16} className="text-emerald-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-emerald-200 font-semibold truncate">Verbonden als {email}</p>
              <p className="text-xs text-emerald-300/70 mt-0.5">{lastSync ? `Laatst gesynchroniseerd: ${fmtDayTime(lastSync)}` : "Nog niet gesynchroniseerd"}</p>
            </div>
          </div>
          {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
          <div className="flex gap-2 mb-2">
            <PrimaryBtn onClick={onSync} disabled={syncing} className="flex-1"><RefreshCw size={15} className={syncing ? "spin" : ""} /> {syncing ? "Bezig…" : "Nu synchroniseren"}</PrimaryBtn>
            <GhostBtn danger onClick={onDisconnect} className="!px-3"><LogOut size={15} /></GhostBtn>
          </div>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">Haalt afspraken op (7 dagen terug t/m 60 vooruit) en stuurt nieuwe afspraken uit deze app terug naar Google.</p>
        </>
      )}

      <div className="mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-xs text-slate-500 mb-2">Liever geen koppeling? Exporteer je afspraken als bestand:</p>
        <GhostBtn onClick={onExport} className="w-full"><Download size={15} /> Download .ics-bestand</GhostBtn>
      </div>
    </Modal>
  );
}

function AgendaModule({ events, setEvents, onAdd, onUpdate, onDelete, googleClientId, setGoogleClientId, googleEmail, setGoogleEmail, googleLastSync, setGoogleLastSync }) {
  const [view, setView] = useState("month");
  const [refDate, setRefDate] = useState(new Date());
  const [modal, setModal] = useState(null);
  const [showGCal, setShowGCal] = useState(false);
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const tokenClientRef = useRef(null);
  const accessTokenRef = useRef(null);

  const eventsByDate = {};
  events.forEach((e) => { (eventsByDate[e.date] ||= []).push(e); });

  const step = (dir) => {
    if (view === "month") setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() + dir, 1));
    else if (view === "week") setRefDate(new Date(refDate.getTime() + dir * 7 * 86400000));
    else setRefDate(new Date(refDate.getTime() + dir * 86400000));
  };

  const headerLabel =
    view === "month" ? `${DUTCH_MONTHS[refDate.getMonth()]} ${refDate.getFullYear()}`
    : view === "week" ? `Week van ${refDate.getDate()} ${DUTCH_MONTHS[refDate.getMonth()]}`
    : `${DUTCH_DAYS_FULL[(refDate.getDay() + 6) % 7]} ${refDate.getDate()} ${DUTCH_MONTHS[refDate.getMonth()]}`;

  const monthMatrix = () => {
    const first = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7;
    const start = new Date(first.getTime() - startOffset * 86400000);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * 86400000));
  };

  const weekDays = () => {
    const startOffset = (refDate.getDay() + 6) % 7;
    const start = new Date(refDate.getTime() - startOffset * 86400000);
    return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86400000));
  };

  const exportIcs = () => {
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dagritme//NL"];
    events.forEach((e) => {
      const dt = (date, time) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
      lines.push("BEGIN:VEVENT", `UID:${e.id}@dagritme`, `DTSTART:${dt(e.date, e.start)}`, `DTEND:${dt(e.date, e.end)}`, `SUMMARY:${e.title}`, `DESCRIPTION:${e.notes || ""}`, "END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "agenda.ics";
    a.click();
  };

  const ensureTokenClient = async (clientId) => {
    if (!clientId.trim()) throw new Error("Vul eerst een Client ID in.");
    await loadGoogleIdentityScript();
    if (!tokenClientRef.current || tokenClientRef.current._clientId !== clientId) {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email",
        callback: () => {},
      });
      tokenClientRef.current._clientId = clientId;
    }
    return tokenClientRef.current;
  };

  const requestAccessToken = (clientId, forcePrompt) =>
    new Promise(async (resolve, reject) => {
      try {
        const client = await ensureTokenClient(clientId);
        client.callback = (resp) => {
          if (resp.error) { reject(new Error("Google-inlog geweigerd of geannuleerd.")); return; }
          accessTokenRef.current = resp.access_token;
          resolve(resp.access_token);
        };
        client.requestAccessToken({ prompt: forcePrompt ? "consent" : "" });
      } catch (e) { reject(e); }
    });

  const handleGoogleConnect = async (clientId) => {
    setGoogleError(""); setGoogleSyncing(true);
    try {
      const token = await requestAccessToken(clientId, true);
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Kon accountgegevens niet ophalen.");
      const info = await res.json();
      setGoogleEmail(info.email || "verbonden account");
    } catch (e) {
      setGoogleError(e.message || "Inloggen mislukt. Controleer je Client ID en geautoriseerde bron.");
    }
    setGoogleSyncing(false);
  };

  const handleGoogleDisconnect = () => {
    if (accessTokenRef.current && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(accessTokenRef.current, () => {});
    }
    accessTokenRef.current = null;
    setGoogleEmail("");
    setGoogleLastSync(null);
  };

  const handleGoogleSync = async () => {
    setGoogleError(""); setGoogleSyncing(true);
    try {
      let token = accessTokenRef.current;
      if (!token) token = await requestAccessToken(googleClientId, false);

      const toPush = events.filter((e) => !e.googleId);
      for (const ev of toPush) {
        const body = { summary: ev.title, description: ev.notes || "", start: { dateTime: `${ev.date}T${ev.start}:00` }, end: { dateTime: `${ev.date}T${ev.end}:00` } };
        const createRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          setEvents((prev) => prev.map((e) => (e.id === ev.id ? { ...e, googleId: created.id } : e)));
        }
      }

      const timeMin = new Date(Date.now() - 7 * 86400000).toISOString();
      const timeMax = new Date(Date.now() + 60 * 86400000).toISOString();
      const listRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=250`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!listRes.ok) throw new Error("Ophalen van Google Agenda mislukt.");
      const listData = await listRes.json();
      const gEvents = (listData.items || []).filter((e) => e.start?.dateTime || e.start?.date);

      setEvents((prev) => {
        const byGoogleId = new Map(prev.filter((e) => e.googleId).map((e) => [e.googleId, e]));
        const localOnly = prev.filter((e) => !e.googleId);
        const merged = gEvents.map((g) => {
          const isAllDay = !!g.start.date;
          const existing = byGoogleId.get(g.id);
          return {
            id: existing?.id || uid(), googleId: g.id, title: g.summary || "(Geen titel)",
            date: isAllDay ? g.start.date : g.start.dateTime.slice(0, 10),
            start: isAllDay ? "00:00" : g.start.dateTime.slice(11, 16),
            end: isAllDay ? "23:59" : (g.end?.dateTime || g.start.dateTime).slice(11, 16),
            notes: g.description || "", color: existing?.color || EVENT_COLORS[0].value,
          };
        });
        return [...localOnly, ...merged];
      });
      setGoogleLastSync(Date.now());
    } catch (e) {
      setGoogleError(e.message || "Synchroniseren mislukt.");
    }
    setGoogleSyncing(false);
  };

  return (
    <div className="pb-24 md:pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-1">
          <IconBtn onClick={() => step(-1)} label="Vorige"><ChevronLeft size={18} /></IconBtn>
          <span className="text-sm font-bold text-white min-w-[9rem] text-center">{headerLabel}</span>
          <IconBtn onClick={() => step(1)} label="Volgende"><ChevronRight size={18} /></IconBtn>
          <GhostBtn onClick={() => setRefDate(new Date())} className="!px-3 !py-1.5 ml-1">Vandaag</GhostBtn>
        </div>
        <div className="flex items-center gap-2">
          <div className="card rounded-2xl p-1 flex">
            {[["day", "Dag"], ["week", "Week"], ["month", "Maand"]].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${view === v ? "tab-active" : "tab-inactive"}`}>{l}</button>
            ))}
          </div>
          <GhostBtn onClick={() => setShowGCal(true)} className="!px-3 !py-1.5"><CalendarDays size={14} /> Google Agenda</GhostBtn>
          <PrimaryBtn onClick={() => setModal({ mode: "new", date: todayStr() })} className="!px-3 !py-1.5"><Plus size={15} /></PrimaryBtn>
        </div>
      </div>

      {view === "month" && (
        <Card className="p-3">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DUTCH_DAYS.map((d) => <div key={d} className="text-center text-xs font-bold text-slate-500 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthMatrix().map((d, i) => {
              const key = fmtDate(d);
              const inMonth = d.getMonth() === refDate.getMonth();
              const isToday = key === todayStr();
              const dayEvents = eventsByDate[key] || [];
              return (
                <button key={i} onClick={() => setModal({ mode: "new", date: key })} className="text-left rounded-xl p-1.5 min-h-[64px] hover:bg-white/5 transition-colors">
                  <span className={`text-xs ${isToday ? "accent-fill text-white rounded-full w-5 h-5 inline-flex items-center justify-center font-bold" : inMonth ? "text-slate-300" : "text-slate-600"}`}>{d.getDate()}</span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div key={ev.id} onClick={(e) => { e.stopPropagation(); setModal({ mode: "edit", event: ev }); }} className="text-[10px] truncate rounded px-1 py-0.5 text-white" style={{ backgroundColor: ev.color }}>
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && <p className="text-[10px] text-slate-500">+{dayEvents.length - 2}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {view === "week" && (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {weekDays().map((d) => {
            const key = fmtDate(d);
            const dayEvents = (eventsByDate[key] || []).sort((a, b) => a.start.localeCompare(b.start));
            return (
              <Card key={key} className="p-3">
                <p className="text-xs font-bold text-slate-400 mb-2">{DUTCH_DAYS[(d.getDay() + 6) % 7]} {d.getDate()}</p>
                <div className="space-y-1.5">
                  {dayEvents.map((ev) => (
                    <button key={ev.id} onClick={() => setModal({ mode: "edit", event: ev })} className="w-full text-left rounded-lg px-2 py-1.5 text-xs text-white" style={{ backgroundColor: ev.color }}>
                      <span className="tabular-num">{ev.start}</span> {ev.title}
                    </button>
                  ))}
                  <button onClick={() => setModal({ mode: "new", date: key })} className="w-full text-left text-xs text-slate-500 hover:text-white py-1">+ Toevoegen</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {view === "day" && (
        <Card className="p-4">
          {(eventsByDate[fmtDate(refDate)] || []).sort((a, b) => a.start.localeCompare(b.start)).map((ev) => (
            <button key={ev.id} onClick={() => setModal({ mode: "edit", event: ev })} className="w-full text-left flex items-center gap-3 py-2.5 border-b border-white/[0.06] last:border-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
              <span className="tabular-num text-sm text-slate-400 w-12 shrink-0">{ev.start}</span>
              <span className="text-sm text-slate-100">{ev.title}</span>
            </button>
          ))}
          {(eventsByDate[fmtDate(refDate)] || []).length === 0 && <p className="text-sm text-slate-500 py-6 text-center">Geen afspraken.</p>}
          <PrimaryBtn onClick={() => setModal({ mode: "new", date: fmtDate(refDate) })} className="w-full mt-3"><Plus size={15} /> Afspraak toevoegen</PrimaryBtn>
        </Card>
      )}

      {modal && (
        <EventModal
          initial={modal.event} defaultDate={modal.date} onClose={() => setModal(null)}
          onSave={(ev) => { modal.mode === "new" ? onAdd(ev) : onUpdate(ev); setModal(null); }}
          onDelete={(id) => { onDelete(id); setModal(null); }}
        />
      )}
      {showGCal && (
        <GoogleCalendarModal
          onClose={() => setShowGCal(false)} onExport={exportIcs}
          clientId={googleClientId} setClientId={setGoogleClientId} email={googleEmail} lastSync={googleLastSync}
          syncing={googleSyncing} error={googleError} onConnect={handleGoogleConnect} onDisconnect={handleGoogleDisconnect} onSync={handleGoogleSync}
        />
      )}
    </div>
  );
}

/* ============================================================
   GYM-TRACKER
============================================================ */

function ExercisePicker({ onPick, onClose, library, addToLibrary }) {
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState("");
  const all = [...new Set([...EXERCISE_LIBRARY, ...library])];
  const filtered = all.filter((n) => n.toLowerCase().includes(q.toLowerCase()));

  return (
    <Modal title="Oefening toevoegen" onClose={onClose}>
      <input className={inputCls} placeholder="Zoeken…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="max-h-64 overflow-y-auto mt-3 space-y-1">
        {filtered.map((name) => (
          <button key={name} onClick={() => onPick(name)} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/5 text-sm text-slate-100">{name}</button>
        ))}
        {filtered.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">Geen resultaten.</p>}
      </div>
      <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <input className={inputCls} placeholder="Eigen oefening toevoegen…" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && custom.trim() && (addToLibrary(custom.trim()), onPick(custom.trim()))} />
        <PrimaryBtn onClick={() => custom.trim() && (addToLibrary(custom.trim()), onPick(custom.trim()))} className="!px-4 shrink-0"><Plus size={15} /></PrimaryBtn>
      </div>
    </Modal>
  );
}

function ActiveWorkout({ workout, setWorkout, onFinish, onCancel, library, addToLibrary, history }) {
  const [picking, setPicking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedRef = useRef(workout.startedAt);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  const updateExercise = (id, fn) => setWorkout((w) => ({ ...w, exercises: w.exercises.map((ex) => (ex.id === id ? fn(ex) : ex)) }));
  const removeExercise = (id) => setWorkout((w) => ({ ...w, exercises: w.exercises.filter((ex) => ex.id !== id) }));
  const addExercise = (name) => {
    setWorkout((w) => ({ ...w, exercises: [...w.exercises, { id: uid(), name, sets: [{ reps: "", weight: "" }] }] }));
    setPicking(false);
  };

  const lastValueFor = (name) => {
    for (const h of [...history].sort((a, b) => b.startedAt - a.startedAt)) {
      const ex = h.exercises.find((e) => e.name === name);
      const set = ex?.sets?.filter((s) => s.reps && s.weight).at(-1);
      if (set) return set;
    }
    return null;
  };

  return (
    <div className="pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-white">{workout.name}</h2>
          <p className="accent-text-strong text-sm flex items-center gap-1 mt-0.5 tabular-num"><Clock size={13} /> {mm}:{ss}</p>
        </div>
        <div className="flex gap-2">
          <GhostBtn danger onClick={onCancel} className="!px-3 !py-2">Annuleren</GhostBtn>
          <PrimaryBtn onClick={onFinish} className="!px-3 !py-2"><Flag size={14} /> Voltooien</PrimaryBtn>
        </div>
      </div>

      <div className="space-y-3">
        {workout.exercises.map((ex) => {
          const last = lastValueFor(ex.name);
          return (
            <Card key={ex.id} accent className="p-3.5">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-sm font-bold text-white">{ex.name}</h3>
                <div className="flex items-center gap-2">
                  {last && <span className="text-[11px] text-slate-500 tabular-num">vorige: {last.weight}kg × {last.reps}</span>}
                  <IconBtn onClick={() => removeExercise(ex.id)} label="Verwijder oefening" className="w-7 h-7"><Trash2 size={14} /></IconBtn>
                </div>
              </div>

              <div className="space-y-2">
                {ex.sets.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-2xl p-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                    <span className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">{i + 1}</span>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div>
                        <p className="accent-text-strong text-[10px] font-bold mb-1 text-center">KG</p>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateExercise(ex.id, (exr) => ({ ...exr, sets: exr.sets.map((st, si) => si === i ? { ...st, weight: String(Math.max(0, (Number(st.weight) || 0) - 2.5)) } : st) }))} className="w-8 h-8 shrink-0 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-white text-base font-bold">−</button>
                          <input type="number" inputMode="decimal" placeholder="0" className="w-full min-w-0 bg-transparent text-center text-lg font-bold text-white tabular-num focus:outline-none" value={s.weight} onChange={(e) => updateExercise(ex.id, (exr) => ({ ...exr, sets: exr.sets.map((st, si) => si === i ? { ...st, weight: e.target.value } : st) }))} />
                          <button onClick={() => updateExercise(ex.id, (exr) => ({ ...exr, sets: exr.sets.map((st, si) => si === i ? { ...st, weight: String((Number(st.weight) || 0) + 2.5) } : st) }))} className="w-8 h-8 shrink-0 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-white text-base font-bold">+</button>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 mb-1 text-center">REPS</p>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateExercise(ex.id, (exr) => ({ ...exr, sets: exr.sets.map((st, si) => si === i ? { ...st, reps: String(Math.max(0, (Number(st.reps) || 0) - 1)) } : st) }))} className="w-8 h-8 shrink-0 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-white text-base font-bold">−</button>
                          <input type="number" inputMode="numeric" placeholder="0" className="w-full min-w-0 bg-transparent text-center text-lg font-bold text-white tabular-num focus:outline-none" value={s.reps} onChange={(e) => updateExercise(ex.id, (exr) => ({ ...exr, sets: exr.sets.map((st, si) => si === i ? { ...st, reps: e.target.value } : st) }))} />
                          <button onClick={() => updateExercise(ex.id, (exr) => ({ ...exr, sets: exr.sets.map((st, si) => si === i ? { ...st, reps: String((Number(st.reps) || 0) + 1) } : st) }))} className="w-8 h-8 shrink-0 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-white text-base font-bold">+</button>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => updateExercise(ex.id, (exr) => ({ ...exr, sets: exr.sets.filter((_, si) => si !== i) }))} className="w-7 h-7 shrink-0 flex items-center justify-center text-slate-600 hover:text-red-400" title="Set verwijderen"><X size={15} /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => updateExercise(ex.id, (exr) => ({ ...exr, sets: [...exr.sets, { reps: exr.sets.at(-1)?.reps || "", weight: exr.sets.at(-1)?.weight || "" }] }))} className="accent-text text-xs font-bold mt-2.5 hover:opacity-80">+ Set toevoegen</button>
            </Card>
          );
        })}
      </div>

      <button onClick={() => setPicking(true)} className="w-full mt-3 py-3 rounded-2xl text-sm font-bold text-slate-400 hover:text-white transition-colors" style={{ border: "1px dashed rgba(255,255,255,0.15)" }}>+ Oefening toevoegen</button>

      {picking && <ExercisePicker onPick={addExercise} onClose={() => setPicking(false)} library={library} addToLibrary={addToLibrary} />}
    </div>
  );
}

function HistoryTab({ history }) {
  if (history.length === 0) return <p className="text-sm text-slate-500 text-center py-12">Nog geen trainingen afgerond.</p>;
  const sorted = [...history].sort((a, b) => b.startedAt - a.startedAt);
  return (
    <div className="space-y-3">
      {sorted.map((w) => {
        const d = new Date(w.startedAt);
        const totalSets = w.exercises.reduce((s, e) => s + e.sets.filter((st) => st.reps && st.weight).length, 0);
        return (
          <Card key={w.id} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-white">{w.name}</p>
              <p className="text-xs text-slate-500">{d.getDate()} {DUTCH_MONTHS[d.getMonth()]}</p>
            </div>
            <p className="text-xs text-slate-500 mb-2">{w.exercises.length} oefeningen · {totalSets} sets</p>
            <div className="flex flex-wrap gap-1.5">
              {w.exercises.map((ex) => <span key={ex.id} className="text-[11px] bg-white/[0.06] text-slate-300 rounded-full px-2 py-1">{ex.name}</span>)}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function GymModule({ active, setActive, history, addHistory, library, addToLibrary }) {
  const [tab, setTab] = useState("start");
  const [customName, setCustomName] = useState("");

  const startTemplate = (t) => setActive({ id: uid(), name: t.name, startedAt: Date.now(), exercises: t.exercises.map((name) => ({ id: uid(), name, sets: [{ reps: "", weight: "" }] })) });
  const startCustom = () => { if (!customName.trim()) return; setActive({ id: uid(), name: customName.trim(), startedAt: Date.now(), exercises: [] }); setCustomName(""); };
  const finish = () => { addHistory(active); setActive(null); };

  if (active) return <ActiveWorkout workout={active} setWorkout={setActive} onFinish={finish} onCancel={() => setActive(null)} library={library} addToLibrary={addToLibrary} history={history} />;

  return (
    <div className="pb-24 md:pb-8">
      <Tabs value={tab} onChange={setTab} options={[["start", "Starten"], ["history", "Geschiedenis"]]} />
      {tab === "start" ? (
        <>
          <p className="accent-text-strong text-xs uppercase tracking-wide font-bold mb-2">Upper / Lower split</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => startTemplate(t)} className="card accent-border-soft text-left p-4 rounded-3xl transition-colors group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white">{t.name}</span>
                  <Play size={14} className="text-slate-500 group-hover:accent-text" />
                </div>
                <p className="text-xs text-slate-500">{t.exercises.slice(0, 3).join(", ")}{t.exercises.length > 3 ? "…" : ""}</p>
              </button>
            ))}
          </div>
          <p className="accent-text-strong text-xs uppercase tracking-wide font-bold mb-2">Vrije training</p>
          <Card className="p-3 flex gap-2">
            <input className={inputCls} placeholder="Naam van de training" value={customName} onChange={(e) => setCustomName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && startCustom()} />
            <PrimaryBtn onClick={startCustom} className="!px-4 shrink-0"><Plus size={15} /></PrimaryBtn>
          </Card>
        </>
      ) : (
        <HistoryTab history={history} />
      )}
    </div>
  );
}

/* ============================================================
   TAKEN
============================================================ */

function TasksModule({ tasks, addTask, toggleTask, deleteTask }) {
  const [tab, setTab] = useState("active");
  const [text, setText] = useState("");
  const [showDate, setShowDate] = useState(false);
  const [date, setDate] = useState("");

  const activeTasks = tasks.filter((t) => !t.done).sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return b.createdAt - a.createdAt;
  });
  const archivedTasks = tasks.filter((t) => t.done).sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));

  const submit = () => {
    if (!text.trim()) return;
    addTask(text.trim(), date || null);
    setText(""); setDate(""); setShowDate(false);
  };

  const toneStyle = {
    today: { backgroundColor: "rgba(228,0,43,0.15)", color: "#FF7E93" },
    soon: { backgroundColor: "rgba(245,158,11,0.15)", color: "#fcd34d" },
    late: { backgroundColor: "rgba(228,0,43,0.25)", color: "#FF3355", fontWeight: 700 },
    future: { backgroundColor: "rgba(255,255,255,0.06)", color: "#94a3b8" },
  };

  return (
    <div className="pb-24 md:pb-8">
      <Card className="p-2 mb-4">
        <div className="flex gap-2">
          <input className={inputCls} placeholder="Nieuwe taak of notitie…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          <IconBtn onClick={() => setShowDate((v) => !v)} label="Datum toevoegen" className={showDate || date ? "accent-text" : ""}><CalendarDays size={17} /></IconBtn>
          <PrimaryBtn onClick={submit} className="!px-4 shrink-0"><Plus size={15} /></PrimaryBtn>
        </div>
        {showDate && (
          <div className="flex items-center gap-2 mt-2 pt-2 px-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-xs font-bold text-slate-400 shrink-0">Herinner op</span>
            <input type="date" className={`${inputCls} !py-1.5 flex-1`} value={date} onChange={(e) => setDate(e.target.value)} />
            {date && <button onClick={() => setDate("")} className="text-xs text-slate-500 hover:text-white shrink-0">Wissen</button>}
          </div>
        )}
      </Card>

      <Tabs value={tab} onChange={setTab} options={[["active", `Actief (${activeTasks.length})`], ["archived", `Gearchiveerd (${archivedTasks.length})`]]} />

      <div className="space-y-1.5">
        {(tab === "active" ? activeTasks : archivedTasks).length === 0 && (
          <p className="text-sm text-slate-500 text-center py-12">{tab === "active" ? "Geen openstaande taken. Goed bezig." : "Nog niets gearchiveerd."}</p>
        )}
        {(tab === "active" ? activeTasks : archivedTasks).map((t) => {
          const badge = tab === "active" ? dateBadge(t.date) : null;
          return (
            <Card key={t.id} className="flex items-center gap-3 px-3.5 py-3">
              <button onClick={() => toggleTask(t.id)} aria-label={t.done ? "Herstel taak" : "Taak afvinken"} className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${t.done ? "accent-fill" : "border-white/20 hover:border-white/50"}`} style={t.done ? { borderColor: "#E4002B" } : {}}>
                {t.done && <Check size={13} className="text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <span className={`text-sm block ${t.done ? "text-slate-500 line-through" : "text-slate-100"}`}>{t.text}</span>
                {badge && <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={toneStyle[badge.tone]}>{badge.text}</span>}
              </div>
              {t.done ? (
                <button onClick={() => toggleTask(t.id)} className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors"><RotateCcw size={13} /> Herstel</button>
              ) : (
                <IconBtn onClick={() => deleteTask(t.id)} label="Taak verwijderen" className="w-7 h-7"><Trash2 size={14} /></IconBtn>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   WERK / LOCATIE-HERINNERING
============================================================ */

function WorkModule({ config, setConfig, history, clearHistory, liveStatus, notifPermission, onRequestNotif }) {
  const [addressQuery, setAddressQuery] = useState(config.label || "");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [locating, setLocating] = useState(false);

  const searchAddress = async () => {
    if (!addressQuery.trim()) return;
    setSearching(true); setSearchError("");
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addressQuery)}`);
      const data = await res.json();
      if (data?.[0]) setConfig((p) => ({ ...p, label: addressQuery.trim(), lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }));
      else setSearchError("Adres niet gevonden. Probeer preciezer, of gebruik 'Huidige locatie'.");
    } catch (e) {
      setSearchError("Zoeken mislukt. Gebruik 'Huidige locatie' als alternatief.");
    }
    setSearching(false);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { setSearchError("Locatie is niet beschikbaar in deze browser."); return; }
    setLocating(true); setSearchError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setConfig((p) => ({ ...p, label: addressQuery.trim() || p.label || "Werklocatie", lat: pos.coords.latitude, lng: pos.coords.longitude })); setLocating(false); },
      () => { setSearchError("Kon huidige locatie niet ophalen. Controleer locatietoestemming."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const toggleWorkday = (idx) => setConfig((p) => ({ ...p, workdays: p.workdays.includes(idx) ? p.workdays.filter((d) => d !== idx) : [...p.workdays, idx].sort() }));
  const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="pb-24 md:pb-8 space-y-4">
      <InfoNote>
        Dit werkt via je browserlocatie zolang deze app open staat (voor- of kort achtergrond). Volledig op de achtergrond werken, ook met een gesloten app, kan alleen met een native app.
      </InfoNote>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="accent-bg-soft w-9 h-9 rounded-xl flex items-center justify-center shrink-0"><Briefcase size={16} className="accent-text" /></span>
            <div><p className="text-sm font-bold text-white">Locatieherinnering</p><p className="text-xs text-slate-500">{config.enabled ? "Actief" : "Uitgeschakeld"}</p></div>
          </div>
          <button onClick={() => setConfig((p) => ({ ...p, enabled: !p.enabled }))} className={`w-12 h-7 rounded-full relative shrink-0 transition-colors ${config.enabled ? "toggle-track-on" : "toggle-track-off"}`}>
            <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform ${config.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>

        {config.enabled && (
          <div className="mt-3 pt-3 space-y-2 text-xs" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Locatietoestemming</span>
              <span className={liveStatus.geoError ? "text-red-400" : liveStatus.watching ? "text-emerald-400" : "text-slate-400"}>{liveStatus.geoError ? "Geweigerd / fout" : liveStatus.watching ? "Actief" : "Wachten…"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Meldingen (systeem)</span>
              {notifPermission === "granted" ? <span className="text-emerald-400">Toegestaan</span> : <button onClick={onRequestNotif} className="accent-text font-semibold hover:opacity-80">Inschakelen</button>}
            </div>
            {config.lat != null && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Afstand tot werk</span>
                <span className="tabular-num text-white font-semibold">{liveStatus.distance != null ? `${Math.round(liveStatus.distance)} m` : "—"}{liveStatus.insideZone ? " · binnen zone" : ""}</span>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <p className="text-sm font-bold text-white mb-3">Werklocatie</p>
        <Field label="Adres">
          <div className="flex gap-2">
            <input className={inputCls} placeholder="Bijv. Spoorstraat 56, Nijmegen" value={addressQuery} onChange={(e) => setAddressQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchAddress()} />
            <IconBtn onClick={searchAddress} label="Zoek adres" className="shrink-0 border border-white/10">
              {searching ? <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-400 border-t-transparent spin" /> : <Search size={16} />}
            </IconBtn>
          </div>
        </Field>
        <button onClick={useCurrentLocation} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold text-slate-400 hover:text-white transition-colors" style={{ border: "1px dashed rgba(255,255,255,0.15)" }}>
          <LocateFixed size={14} className={locating ? "spin" : ""} /> {locating ? "Bezig met ophalen…" : "Gebruik huidige locatie als werklocatie"}
        </button>
        {searchError && <p className="text-xs text-red-400 mt-2">{searchError}</p>}
        {config.lat != null && <p className="text-xs text-slate-500 mt-2 flex items-center gap-1"><MapPin size={12} /> {config.lat.toFixed(5)}, {config.lng.toFixed(5)}</p>}

        <div className="mt-4">
          <Field label={`Straal (${config.radius} meter)`}>
            <input type="range" min="30" max="500" step="10" value={config.radius} onChange={(e) => setConfig((p) => ({ ...p, radius: Number(e.target.value) }))} className="w-full" style={{ accentColor: "#E4002B" }} />
          </Field>
        </div>

        <div className="mt-3">
          <span className="block text-xs font-semibold text-slate-500 mb-2">Actief op</span>
          <div className="flex gap-1.5 flex-wrap">
            {DUTCH_DAYS.map((d, i) => (
              <button key={i} onClick={() => toggleWorkday(i)} className={`w-10 h-10 rounded-xl text-xs font-bold transition-colors ${config.workdays.includes(i) ? "tab-active" : "bg-white/[0.04] text-slate-400 hover:text-white"}`}>{d}</button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-white">Geschiedenis</p>
          {history.length > 0 && <button onClick={clearHistory} className="text-xs text-slate-500 hover:text-red-400">Wissen</button>}
        </div>
        {sortedHistory.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">Nog geen meldingen geregistreerd.</p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {sortedHistory.map((h) => (
              <div key={h.id} className="flex items-center gap-2.5 text-sm py-1.5">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${h.type === "arrival" ? "" : "accent-bg-soft"}`} style={h.type === "arrival" ? { backgroundColor: "rgba(52,211,153,0.15)", color: "#34d399" } : { color: "#FF7E93" }}>
                  {h.type === "arrival" ? <LocateFixed size={13} /> : <Navigation size={13} />}
                </span>
                <div className="flex-1"><p className="text-slate-100">{h.type === "arrival" ? "Aangekomen bij werk" : "Werk verlaten"}</p><p className="text-xs text-slate-500 tabular-num">{fmtDayTime(h.timestamp)}</p></div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================================================
   GAMES / NIEUWS
============================================================ */

function GamesModule({ games, setGames, feeds, fetchNews }) {
  const [newGame, setNewGame] = useState("");

  const addGame = () => { if (!newGame.trim()) return; setGames((p) => [...p, { id: uid(), name: newGame.trim(), addedAt: Date.now() }]); setNewGame(""); };
  const removeGame = (id) => setGames((p) => p.filter((g) => g.id !== id));

  return (
    <div className="pb-24 md:pb-8 space-y-4">
      <InfoNote>
        Nieuws komt live van Reddit-zoekresultaten per game — er bestaat geen gratis gamenieuws-API zonder eigen server. Lukt laden een keer niet, dan krijg je een directe zoeklink als alternatief.
      </InfoNote>

      <Card className="p-3 flex gap-2">
        <input className={inputCls} placeholder="Game toevoegen, bijv. GTA 6" value={newGame} onChange={(e) => setNewGame(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGame()} />
        <PrimaryBtn onClick={addGame} className="!px-4 shrink-0"><Plus size={15} /></PrimaryBtn>
      </Card>

      {games.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12">Nog geen games toegevoegd.</p>
      ) : (
        <div className="space-y-3">
          {games.map((g) => {
            const feed = feeds[g.id] || { loading: true, items: [] };
            return (
              <Card key={g.id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="accent-bg-soft w-9 h-9 rounded-xl flex items-center justify-center shrink-0"><Gamepad2 size={16} className="accent-text" /></span>
                    <p className="text-sm font-bold text-white truncate">{g.name}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <IconBtn onClick={() => fetchNews(g)} label="Vernieuwen" className="w-8 h-8"><RefreshCw size={14} className={feed.loading ? "spin" : ""} /></IconBtn>
                    <IconBtn onClick={() => removeGame(g.id)} label="Verwijderen" className="w-8 h-8"><Trash2 size={14} /></IconBtn>
                  </div>
                </div>

                {feed.error && feed.items.length === 0 ? (
                  <div className="text-xs text-slate-400">
                    <p className="mb-2">Kon geen live nieuws laden.</p>
                    <a href={`https://news.google.com/search?q=${encodeURIComponent(g.name)}`} target="_blank" rel="noreferrer" className="accent-text inline-flex items-center gap-1 font-semibold hover:opacity-80">Zoek nieuws over {g.name} <ExternalLink size={11} /></a>
                  </div>
                ) : feed.loading && feed.items.length === 0 ? (
                  <p className="text-xs text-slate-500">Laden…</p>
                ) : feed.items.length === 0 ? (
                  <p className="text-xs text-slate-500">Geen recente berichten gevonden.</p>
                ) : (
                  <div className="space-y-2.5">
                    {feed.items.map((item) => (
                      <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="block group">
                        <p className="text-sm text-slate-200 group-hover:text-white leading-snug">{item.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.subreddit} · {relTime(item.created)}</p>
                      </a>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   OCHTENDOVERZICHT (modal)
============================================================ */

function MorningSummary({ tasks, events, onClose, onGoToTasks }) {
  const today = todayStr();
  const todayEvents = events.filter((e) => e.date === today).sort((a, b) => a.start.localeCompare(b.start));
  const openTasks = tasks.filter((t) => !t.done);
  const dueTasks = openTasks.filter((t) => t.date && t.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const otherTasks = openTasks.filter((t) => !t.date || t.date > today);
  const now = new Date();

  return (
    <Modal title="" onClose={onClose} wide>
      <div className="-mt-2">
        <div className="accent-bg-soft w-11 h-11 rounded-2xl flex items-center justify-center mb-3"><Sun size={20} className="text-amber-300" /></div>
        <h2 className="text-lg font-bold text-white mb-0.5">Goedemorgen</h2>
        <p className="text-sm text-slate-400 mb-5">{DUTCH_DAYS_FULL[(now.getDay() + 6) % 7]} {now.getDate()} {DUTCH_MONTHS[now.getMonth()]}</p>

        <div className="mb-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-bold mb-2">Vandaag op de agenda</p>
          {todayEvents.length === 0 ? <p className="text-sm text-slate-500">Geen afspraken gepland.</p> : (
            <div className="space-y-1.5">
              {todayEvents.map((ev) => (
                <div key={ev.id} className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                  <span className="tabular-num text-slate-400">{ev.start}</span>
                  <span className="text-slate-100">{ev.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {dueTasks.length > 0 && (
          <div className="mb-4">
            <p className="accent-text-strong text-xs uppercase tracking-wide font-bold mb-2">Taken voor vandaag ({dueTasks.length})</p>
            <div className="space-y-1.5">
              {dueTasks.map((t) => {
                const isLate = t.date < today;
                return (
                  <div key={t.id} className="flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: isLate ? "#FF3355" : "#FF7E93" }} />
                    <span className="text-slate-100 flex-1">{t.text}</span>
                    {isLate && <span className="accent-text-strong text-[10px] font-bold uppercase">Te laat</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-5">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-bold mb-2">Overige openstaande taken ({otherTasks.length})</p>
          {otherTasks.length === 0 ? <p className="text-sm text-slate-500">Niets meer openstaand. Fijne dag!</p> : (
            <div className="space-y-1">
              {otherTasks.slice(0, 5).map((t) => <p key={t.id} className="text-sm text-slate-200">· {t.text}</p>)}
              {otherTasks.length > 5 && <p className="text-xs text-slate-500">+ {otherTasks.length - 5} overige openstaande taken</p>}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <PrimaryBtn onClick={onGoToTasks} className="flex-1">Naar takenlijst</PrimaryBtn>
          <GhostBtn onClick={onClose}>Sluiten</GhostBtn>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   APP SHELL
============================================================ */

export default function App() {
  const [tab, setTab] = useState("home");
  const [loaded, setLoaded] = useState(false);

  const [events, setEvents] = useState([]);
  const [gymActive, setGymActive] = useState(null);
  const [gymHistory, setGymHistory] = useState([]);
  const [gymLibrary, setGymLibrary] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [lastSummary, setLastSummary] = useState("");
  const [showSummary, setShowSummary] = useState(false);

  const [workConfig, setWorkConfig] = useState(DEFAULT_WORK_CONFIG);
  const [workHistory, setWorkHistory] = useState([]);
  const [workDaily, setWorkDaily] = useState({});
  const [liveStatus, setLiveStatus] = useState({ watching: false, geoError: false, distance: null, insideZone: false });
  const [notifPermission, setNotifPermission] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");

  const [googleClientId, setGoogleClientId] = useState("");
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleLastSync, setGoogleLastSync] = useState(null);

  const [games, setGames] = useState(DEFAULT_GAMES);
  const [gameFeeds, setGameFeeds] = useState({});

  // --- Laden: gegarandeerd geen oneindige laadstatus, ook als opslag/DOM faalt ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ev, active, hist, lib, tk, ls, wc, wh, wd, gc, ge, gls, gm] = await Promise.all([
          storeGet("agenda:events", []),
          storeGet("gym:active", null),
          storeGet("gym:history", []),
          storeGet("gym:library", []),
          storeGet("tasks:list", []),
          storeGet("meta:lastSummary", ""),
          storeGet("work:config", DEFAULT_WORK_CONFIG),
          storeGet("work:history", []),
          storeGet("work:daily", {}),
          storeGet("google:clientId", ""),
          storeGet("google:email", ""),
          storeGet("google:lastSync", null),
          storeGet("games:list", null),
        ]);
        if (cancelled) return;
        setEvents(ev); setGymActive(active); setGymHistory(hist);
        setGymLibrary(lib); setTasks(tk); setLastSummary(ls);
        setWorkConfig({ ...DEFAULT_WORK_CONFIG, ...wc }); setWorkHistory(wh); setWorkDaily(wd);
        setGoogleClientId(gc); setGoogleEmail(ge); setGoogleLastSync(gls);
        setGames(gm === null ? DEFAULT_GAMES : gm);

        const now = new Date();
        if (now.getHours() >= 8 && ls !== todayStr()) setShowSummary(true);
      } catch (e) {
        console.error("Laden van opgeslagen data mislukt, ga verder met standaardwaarden.", e);
      } finally {
        if (!cancelled) setLoaded(true);
      }

      // Lettertype laden — mag nooit de rest blokkeren, dus in eigen try/catch
      try {
        if (!document.getElementById("dagapp-font")) {
          const link = document.createElement("link");
          link.id = "dagapp-font";
          link.rel = "stylesheet";
          link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
          document.head.appendChild(link);
        }
      } catch (e) {
        console.error("Lettertype laden mislukt (niet kritiek).", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { if (loaded) storeSet("agenda:events", events); }, [events, loaded]);
  useEffect(() => { if (loaded) storeSet("gym:active", gymActive); }, [gymActive, loaded]);
  useEffect(() => { if (loaded) storeSet("gym:history", gymHistory); }, [gymHistory, loaded]);
  useEffect(() => { if (loaded) storeSet("gym:library", gymLibrary); }, [gymLibrary, loaded]);
  useEffect(() => { if (loaded) storeSet("tasks:list", tasks); }, [tasks, loaded]);
  useEffect(() => { if (loaded) storeSet("work:config", workConfig); }, [workConfig, loaded]);
  useEffect(() => { if (loaded) storeSet("work:history", workHistory); }, [workHistory, loaded]);
  useEffect(() => { if (loaded) storeSet("work:daily", workDaily); }, [workDaily, loaded]);
  useEffect(() => { if (loaded) storeSet("google:clientId", googleClientId); }, [googleClientId, loaded]);
  useEffect(() => { if (loaded) storeSet("google:email", googleEmail); }, [googleEmail, loaded]);
  useEffect(() => { if (loaded) storeSet("google:lastSync", googleLastSync); }, [googleLastSync, loaded]);
  useEffect(() => { if (loaded) storeSet("games:list", games); }, [games, loaded]);

  const dismissSummary = () => {
    setShowSummary(false);
    const ts = todayStr();
    setLastSummary(ts);
    storeSet("meta:lastSummary", ts);
  };

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Goedemorgen" : now.getHours() < 18 ? "Goedemiddag" : "Goedenavond";

  const [workToast, setWorkToast] = useState(null);
  useEffect(() => {
    if (!workToast) return;
    const t = setTimeout(() => setWorkToast(null), 8000);
    return () => clearTimeout(t);
  }, [workToast]);

  const notifyWork = (message) => {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("Dagritme", { body: message });
    } catch (e) { /* systeemmelding is optioneel, negeren bij falen */ }
    setWorkToast(message);
  };

  const requestNotifPermission = () => {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then((p) => setNotifPermission(p));
  };

  // --- Geofencing: alleen actief zolang deze pagina open staat ---
  const zoneRef = useRef({ inside: false, sinceTs: null });
  useEffect(() => {
    if (!loaded || !workConfig.enabled || workConfig.lat == null || typeof navigator === "undefined" || !navigator.geolocation) {
      setLiveStatus((p) => ({ ...p, watching: false }));
      return;
    }
    const todayIdx = (new Date().getDay() + 6) % 7;
    if (!workConfig.workdays.includes(todayIdx)) {
      setLiveStatus((p) => ({ ...p, watching: false }));
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const dist = distanceMeters(pos.coords.latitude, pos.coords.longitude, workConfig.lat, workConfig.lng);
        const isInside = dist <= workConfig.radius;
        const ts = Date.now();
        const zone = zoneRef.current;
        if (isInside !== zone.inside) zoneRef.current = { inside: isInside, sinceTs: ts };
        setLiveStatus({ watching: true, geoError: false, distance: dist, insideZone: isInside });

        const dwellMs = ts - (zoneRef.current.sinceTs || ts);
        const today = todayStr();
        const daily = workDaily[today] || { arrival: false, departure: false };

        if (isInside && dwellMs >= 3 * 60 * 1000 && !daily.arrival) {
          setWorkHistory((p) => [...p, { id: uid(), type: "arrival", timestamp: ts }]);
          setWorkDaily((p) => ({ ...p, [today]: { ...(p[today] || {}), arrival: true } }));
          notifyWork("Je bent aangekomen bij werk. Vergeet niet in te klokken in Dyflexis.");
        }
        if (!isInside && dwellMs >= 5 * 60 * 1000 && daily.arrival && !daily.departure) {
          setWorkHistory((p) => [...p, { id: uid(), type: "departure", timestamp: ts }]);
          setWorkDaily((p) => ({ ...p, [today]: { ...(p[today] || {}), departure: true } }));
          notifyWork("Je hebt werk verlaten. Vergeet niet uit te klokken in Dyflexis.");
        }
      },
      () => setLiveStatus((p) => ({ ...p, watching: false, geoError: true })),
      { enableHighAccuracy: false, maximumAge: 20000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [loaded, workConfig.enabled, workConfig.lat, workConfig.lng, workConfig.radius, workConfig.workdays, workDaily]);

  // --- Game-nieuws: live ophalen per gevolgde game ---
  const fetchGameNews = async (game) => {
    setGameFeeds((p) => ({ ...p, [game.id]: { ...(p[game.id] || {}), loading: true, error: "" } }));
    try {
      const res = await fetch(`https://www.reddit.com/search.json?q=${encodeURIComponent(game.name)}&sort=new&limit=6&t=week`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const items = (data?.data?.children || [])
        .filter((c) => c?.data?.title)
        .map((c) => ({ id: c.data.id, title: c.data.title, subreddit: c.data.subreddit_name_prefixed, url: `https://www.reddit.com${c.data.permalink}`, created: c.data.created_utc * 1000 }));
      setGameFeeds((p) => ({ ...p, [game.id]: { loading: false, error: "", items } }));
    } catch (e) {
      setGameFeeds((p) => ({ ...p, [game.id]: { loading: false, error: "Kon nieuws niet laden", items: p[game.id]?.items || [] } }));
    }
  };

  useEffect(() => {
    if (!loaded) return;
    games.forEach((g) => { if (!gameFeeds[g.id]) fetchGameNews(g); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, games]);

  const toggleTask = (id) => setTasks((p) => p.map((t) => (t.id === id ? { ...t, done: !t.done, archivedAt: !t.done ? Date.now() : null } : t)));

  return (
    <div className="app-bg min-h-screen text-slate-100" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <GlobalStyles />

      <div className="flex">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-white/[0.06] px-4 py-6 h-screen sticky top-0">
          <div className="mb-8 px-2">
            <p className="text-xl font-bold text-white tracking-tight">Dag<span className="accent-text-strong">ritme</span></p>
            <p className="text-xs text-slate-500 mt-1">{DUTCH_DAYS_FULL[(now.getDay() + 6) % 7]} {now.getDate()} {DUTCH_MONTHS[now.getMonth()]}</p>
          </div>
          <nav className="space-y-1">
            {NAV.map((n) => {
              const Icon = n.icon;
              const isActive = tab === n.id;
              const count = n.id === "tasks" ? tasks.filter((t) => !t.done).length : 0;
              return (
                <button key={n.id} onClick={() => setTab(n.id)} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold transition-colors ${isActive ? "nav-item-active" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
                  <Icon size={17} /> {n.label}
                  {count > 0 && <span className="tabular-num accent-fill ml-auto text-[10px] text-white rounded-full px-1.5 py-0.5">{count}</span>}
                </button>
              );
            })}
          </nav>
          <button onClick={() => setShowSummary(true)} className="mt-auto flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"><Sun size={16} /> Dagstart</button>
        </aside>

        <main className="flex-1 min-w-0 px-4 sm:px-6 py-5 md:py-8 max-w-4xl mx-auto w-full">
          {tab !== "home" && (
            <div className="md:hidden flex items-center justify-between mb-5">
              <div>
                <p className="text-lg font-bold text-white">{greeting}</p>
                <p className="text-xs text-slate-500">{DUTCH_DAYS_FULL[(now.getDay() + 6) % 7]} {now.getDate()} {DUTCH_MONTHS[now.getMonth()]}</p>
              </div>
              <IconBtn onClick={() => setShowSummary(true)} label="Dagstart"><Sun size={18} /></IconBtn>
            </div>
          )}
          {tab !== "home" && (
            <h1 className="hidden md:flex items-center gap-2.5 text-xl font-bold text-white mb-6">
              <span className="accent-fill w-1 h-6 inline-block rounded-full" />
              {NAV.find((n) => n.id === tab).label}
            </h1>
          )}

          {!loaded ? (
            <div className="flex items-center justify-center py-24 text-slate-500 text-sm">Laden…</div>
          ) : (
            <>
              {tab === "home" && (
                <DashboardModule greeting={greeting} now={now} events={events} tasks={tasks} toggleTask={toggleTask} games={games} feeds={gameFeeds} />
              )}
              {tab === "agenda" && (
                <AgendaModule
                  events={events} setEvents={setEvents}
                  onAdd={(ev) => setEvents((p) => [...p, ev])}
                  onUpdate={(ev) => setEvents((p) => p.map((e) => (e.id === ev.id ? ev : e)))}
                  onDelete={(id) => setEvents((p) => p.filter((e) => e.id !== id))}
                  googleClientId={googleClientId} setGoogleClientId={setGoogleClientId}
                  googleEmail={googleEmail} setGoogleEmail={setGoogleEmail}
                  googleLastSync={googleLastSync} setGoogleLastSync={setGoogleLastSync}
                />
              )}
              {tab === "gym" && (
                <GymModule active={gymActive} setActive={setGymActive} history={gymHistory} addHistory={(w) => setGymHistory((p) => [...p, w])} library={gymLibrary} addToLibrary={(n) => setGymLibrary((p) => (p.includes(n) ? p : [...p, n]))} />
              )}
              {tab === "tasks" && (
                <TasksModule
                  tasks={tasks}
                  addTask={(text, date) => setTasks((p) => [...p, { id: uid(), text, date: date || null, done: false, createdAt: Date.now(), archivedAt: null }])}
                  toggleTask={toggleTask}
                  deleteTask={(id) => setTasks((p) => p.filter((t) => t.id !== id))}
                />
              )}
              {tab === "work" && (
                <WorkModule config={workConfig} setConfig={setWorkConfig} history={workHistory} clearHistory={() => setWorkHistory([])} liveStatus={liveStatus} notifPermission={notifPermission} onRequestNotif={requestNotifPermission} />
              )}
              {tab === "games" && <GamesModule games={games} setGames={setGames} feeds={gameFeeds} fetchNews={fetchGameNews} />}
            </>
          )}
        </main>
      </div>

      <nav className="mobile-nav-bg md:hidden fixed bottom-0 inset-x-0 border-t border-white/[0.06] flex overflow-x-auto z-40" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {NAV.map((n) => {
          const Icon = n.icon;
          const isActive = tab === n.id;
          const count = n.id === "tasks" ? tasks.filter((t) => !t.done).length : 0;
          return (
            <button key={n.id} onClick={() => setTab(n.id)} className="flex-1 min-w-[58px] flex flex-col items-center gap-0.5 py-2.5 relative">
              {isActive && <span className="accent-fill absolute top-0 inset-x-3 h-[2px]" />}
              <Icon size={19} className={isActive ? "accent-text" : "text-slate-500"} />
              <span className={`text-[9px] font-bold uppercase tracking-tight ${isActive ? "accent-text" : "text-slate-500"}`}>{n.label}</span>
              {count > 0 && <span className="tabular-num accent-fill absolute top-1 right-2 w-4 h-4 rounded-full text-white text-[9px] flex items-center justify-center">{count}</span>}
            </button>
          );
        })}
      </nav>

      {workToast && (
        <div className="modal-bg fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[calc(100%-2rem)] rounded-2xl px-4 py-3 shadow-2xl flex items-start gap-3" style={{ border: "1px solid rgba(228,0,43,0.4)" }}>
          <span className="accent-bg-soft w-8 h-8 rounded-xl flex items-center justify-center shrink-0"><Briefcase size={15} className="accent-text" /></span>
          <p className="text-sm text-white leading-snug flex-1">{workToast}</p>
          <button onClick={() => setWorkToast(null)} className="text-slate-500 hover:text-white shrink-0"><X size={16} /></button>
        </div>
      )}

      {showSummary && loaded && (
        <MorningSummary tasks={tasks} events={events} onClose={dismissSummary} onGoToTasks={() => { dismissSummary(); setTab("tasks"); }} />
      )}
    </div>
  );
}
