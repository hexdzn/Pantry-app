"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Search, Plus, Minus, Star, Check, Copy, X, Trash2,
  ShoppingBasket, Carrot, ChevronRight, Sparkles, ClipboardCheck,
  Send, Phone, UserPlus, Home, LogOut, Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

/* ------------------------------------------------------------------ *
 *  PANTRY — a calm kitchen ledger for an Indian family
 *  Two modes: Groceries (stock-up checklist) + Vegetables (WhatsApp order)
 * ------------------------------------------------------------------ */

const C = {
  paper: "#F7F6F2",
  surface: "#FFFFFF",
  ink: "#1A1B16",
  sub: "#7A786E",
  faint: "#AEACA2",
  line: "#EAE8E1",
  lineSoft: "#F0EEE8",
  green: "#3A6B4E",
  greenDeep: "#2C5340",
  greenTint: "#EAF1EA",
  greenTint2: "#E0EBD7",
  bubble: "#E5F1D4",
  bubbleLine: "#D2E5BC",
  star: "#C2902B",
  danger: "#B14E3A",
};

const SERIF = 'ui-serif, Georgia, "Times New Roman", serif';
const SKEY = "pantry:state:v2";

/* ---------- unit logic ---------- */
const UNITS = {
  KG: ["kg", "g"], G: ["g", "kg"], L: ["L", "ml"], ML: ["ml", "L"],
  PCS: ["pcs", "dozen"], DOZEN: ["dozen", "pcs"], GADDI: ["gaddi", "pcs"],
  PACKET: ["packet", "pcs"], BOTTLE: ["bottle", "ml"], GKG: ["g", "kg"],
  BG: ["bottle", "g"], PG: ["packet", "g"], NIMBU: ["pcs", "g"],
};
const START = { kg: 1, g: 250, L: 1, ml: 200, pcs: 1, dozen: 1, gaddi: 1, packet: 1, bottle: 1 };
const STEP = { kg: 0.5, g: 50, L: 0.5, ml: 50, pcs: 1, dozen: 1, gaddi: 1, packet: 1, bottle: 1 };
const fmt = (n) => (Math.round(n * 100) / 100).toString();
const qtyLabel = (qty, unit) => `${fmt(qty)} ${unit}`;

/* ---------- cadence (groceries only) ---------- */
const CADENCE = ["W", "2W", "M"];
const CADENCE_LABEL = { W: "Weekly", "2W": "Bi-weekly", M: "Monthly" };
const INTERVAL = { W: 7, "2W": 14, M: 30 }; // days between restocks
const CAT_CADENCE = {
  dairy: "W", bakery: "W", snacks: "2W",
  grains: "M", dals: "M", masala: "M", oils: "M", dryfruits: "M",
  beverages: "M", condiments: "M", baking: "M", cleaning: "M", personal: "M",
};

/* ---------- data builders ---------- */
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
function buildCat(id, label, icon, rows) {
  return {
    id, label, icon,
    items: rows.map(([name, sub, uk]) => ({
      id: `${id}__${slug(name)}`,
      name, sub: sub || "",
      units: UNITS[uk] || UNITS.PCS,
      defCad: CAT_CADENCE[id] || "M",
    })),
  };
}

/* ---------- VEGETABLES (Hinglish primary) ---------- */
const VEG = [
  ["Aloo", "Potato", "KG"], ["Pyaaz", "Onion", "KG"], ["Tamatar", "Tomato", "KG"],
  ["Adrak", "Ginger", "G"], ["Lehsun", "Garlic", "G"], ["Hari Mirch", "Green chilli", "G"],
  ["Dhaniya", "Coriander", "GADDI"], ["Pudina", "Mint", "GADDI"], ["Palak", "Spinach", "GADDI"],
  ["Methi", "Fenugreek", "GADDI"], ["Bathua", "Chenopod greens", "GADDI"], ["Sarson", "Mustard greens", "GADDI"],
  ["Bhindi", "Okra", "KG"], ["Baingan", "Brinjal", "KG"], ["Gobi", "Cauliflower", "PCS"],
  ["Patta Gobi", "Cabbage", "PCS"], ["Shimla Mirch", "Capsicum", "G"], ["Lauki", "Bottle gourd", "PCS"],
  ["Tori", "Ridge gourd", "KG"], ["Karela", "Bitter gourd", "G"], ["Parwal", "Pointed gourd", "G"],
  ["Tinda", "Apple gourd", "G"], ["Kaddu", "Pumpkin", "KG"], ["Gajar", "Carrot", "KG"],
  ["Mooli", "Radish", "KG"], ["Chukandar", "Beetroot", "G"], ["Matar", "Green peas", "KG"],
  ["Beans", "French beans", "G"], ["Kheera", "Cucumber", "KG"], ["Nimbu", "Lemon", "NIMBU"],
  ["Arbi", "Colocasia", "G"], ["Sem", "Flat beans", "G"], ["Mushroom", "Mushroom", "PACKET"],
  ["Ganth Gobi", "Kohlrabi", "PCS"], ["Shakarkand", "Sweet potato", "KG"], ["Kaccha Kela", "Raw banana", "PCS"],
  ["Hara Pyaaz", "Spring onion", "GADDI"], ["Hara Lehsun", "Green garlic", "GADDI"], ["Kadi Patta", "Curry leaves", "GADDI"],
  ["Sahjan", "Drumstick", "PCS"], ["Gawar", "Cluster beans", "G"], ["Kundru", "Ivy gourd", "G"],
  ["Jimikand", "Yam / Suran", "KG"], ["Petha", "Ash gourd", "KG"], ["Bhutta", "Corn", "PCS"],
  ["Broccoli", "Broccoli", "PCS"], ["Zucchini", "Zucchini", "KG"], ["Baby Corn", "Baby corn", "PACKET"],
  ["Lettuce", "Lettuce", "PCS"], ["Chholiya", "Green chickpeas", "G"], ["Kamal Kakdi", "Lotus stem", "G"],
  ["Singhada", "Water chestnut", "G"], ["Kaccha Papita", "Raw papaya", "PCS"],
].map(([name, sub, uk]) => ({ id: `veg__${slug(name)}`, name, sub, units: UNITS[uk] }));

/* ---------- FRUITS (Hinglish primary) ---------- */
const FRUITS = [
  ["Kela", "Banana", "DOZEN"], ["Seb", "Apple", "KG"], ["Santra", "Orange", "KG"],
  ["Mosambi", "Sweet lime", "KG"], ["Kinnow", "Kinnow", "KG"], ["Angoor", "Grapes", "G"],
  ["Aam", "Mango", "KG"], ["Papita", "Papaya", "PCS"], ["Anar", "Pomegranate", "KG"],
  ["Tarbooz", "Watermelon", "PCS"], ["Kharbooja", "Muskmelon", "PCS"], ["Ananas", "Pineapple", "PCS"],
  ["Amrood", "Guava", "KG"], ["Chiku", "Sapota", "G"], ["Litchi", "Lychee", "G"],
  ["Strawberry", "Strawberry", "PACKET"], ["Kiwi", "Kiwi", "PCS"], ["Nashpati", "Pear", "KG"],
  ["Aloo Bukhara", "Plum", "G"], ["Khubani", "Apricot", "G"], ["Jamun", "Java plum", "G"],
  ["Sitaphal", "Custard apple", "G"], ["Nariyal", "Coconut", "PCS"], ["Dragon Fruit", "Dragon fruit", "PCS"],
  ["Avocado", "Avocado", "PCS"], ["Ber", "Jujube", "G"], ["Cherry", "Cherry", "G"],
].map(([name, sub, uk]) => ({ id: `fruit__${slug(name)}`, name, sub, units: UNITS[uk] }));

/* ---------- GROCERIES ---------- */
const GROCERIES = [
  buildCat("dairy", "Dairy & Eggs", "🥛", [
    ["Milk", "Doodh", "L"], ["Curd", "Dahi", "G"], ["Paneer", "", "G"], ["Butter", "Makkhan", "G"],
    ["Ghee", "", "G"], ["Cheese", "", "PACKET"], ["Eggs", "Ande", "DOZEN"], ["Buttermilk", "Chaas", "PACKET"],
    ["Fresh Cream", "", "PACKET"], ["Khoya", "Mawa", "G"],
  ]),
  buildCat("grains", "Atta, Rice & Grains", "🌾", [
    ["Wheat Atta", "", "KG"], ["Basmati Rice", "", "KG"], ["Sona Masoori Rice", "", "KG"], ["Maida", "", "KG"],
    ["Besan", "", "GKG"], ["Sooji / Rava", "", "PG"], ["Poha", "", "PACKET"], ["Daliya", "", "PACKET"],
    ["Sabudana", "", "PACKET"], ["Cornflour", "", "PACKET"], ["Ragi Atta", "", "KG"], ["Bajra", "", "KG"],
  ]),
  buildCat("dals", "Dals & Pulses", "🫘", [
    ["Toor / Arhar Dal", "", "KG"], ["Moong Dal", "", "KG"], ["Masoor Dal", "", "KG"], ["Chana Dal", "", "KG"],
    ["Urad Dal", "", "KG"], ["Rajma", "", "KG"], ["Kabuli Chana", "Chole", "KG"], ["Kala Chana", "", "KG"],
    ["Moth", "", "GKG"], ["Lobia", "", "GKG"], ["Green Moong", "Sabut", "KG"], ["Soya Chunks", "", "PACKET"],
  ]),
  buildCat("masala", "Masala & Spices", "🌶️", [
    ["Haldi", "Turmeric", "G"], ["Red Chilli Powder", "", "G"], ["Dhaniya Powder", "", "G"], ["Garam Masala", "", "G"],
    ["Jeera", "Cumin", "G"], ["Rai", "Mustard seeds", "G"], ["Hing", "Asafoetida", "PACKET"], ["Kali Mirch", "", "G"],
    ["Elaichi", "Cardamom", "G"], ["Laung", "Cloves", "G"], ["Dalchini", "Cinnamon", "G"], ["Tej Patta", "", "PACKET"],
    ["Kasuri Methi", "", "PACKET"], ["Amchur", "", "G"], ["Chaat Masala", "", "PACKET"], ["Salt", "Namak", "KG"],
    ["Black Salt", "Kala namak", "PACKET"], ["Ajwain", "", "G"], ["Saunf", "Fennel", "G"], ["Methi Dana", "", "G"],
  ]),
  buildCat("oils", "Oils & Ghee", "🫒", [
    ["Mustard Oil", "Sarson", "L"], ["Refined Oil", "", "L"], ["Olive Oil", "", "BOTTLE"], ["Coconut Oil", "", "BOTTLE"], ["Desi Ghee", "", "G"],
  ]),
  buildCat("dryfruits", "Dry Fruits & Nuts", "🥜", [
    ["Badam", "Almonds", "G"], ["Kaju", "Cashew", "G"], ["Kishmish", "Raisins", "G"], ["Akhrot", "Walnuts", "G"],
    ["Pista", "", "G"], ["Khajoor", "Dates", "G"], ["Anjeer", "Figs", "G"], ["Makhana", "Foxnuts", "PACKET"],
  ]),
  buildCat("snacks", "Snacks & Namkeen", "🍪", [
    ["Biscuits", "", "PACKET"], ["Namkeen / Mixture", "", "PACKET"], ["Bhujia", "", "PACKET"], ["Chips", "", "PACKET"],
    ["Mathri", "", "PACKET"], ["Khakhra", "", "PACKET"], ["Maggi", "", "PACKET"], ["Pasta", "", "PACKET"],
    ["Popcorn", "", "PACKET"], ["Rusk", "", "PACKET"],
  ]),
  buildCat("beverages", "Beverages", "☕", [
    ["Tea", "Chai patti", "PG"], ["Coffee", "", "PACKET"], ["Green Tea", "", "PACKET"], ["Bournvita / Horlicks", "", "PACKET"],
    ["Juice", "", "BOTTLE"], ["Soft Drinks", "", "BOTTLE"], ["Coconut Water", "", "BOTTLE"],
  ]),
  buildCat("bakery", "Bakery & Bread", "🍞", [
    ["Bread", "", "PACKET"], ["Brown Bread", "", "PACKET"], ["Pav", "", "PACKET"], ["Bun", "", "PACKET"],
    ["Khari", "", "PACKET"], ["Cake / Muffins", "", "PCS"],
  ]),
  buildCat("condiments", "Condiments & Sauces", "🍯", [
    ["Tomato Ketchup", "", "BG"], ["Soy Sauce", "", "BOTTLE"], ["Vinegar", "", "BOTTLE"], ["Chilli Sauce", "", "BOTTLE"],
    ["Mayonnaise", "", "BG"], ["Pickle", "Achar", "BG"], ["Jam", "", "BG"], ["Honey", "Shahad", "BOTTLE"],
    ["Mustard Sauce", "", "BOTTLE"], ["Imli", "Tamarind", "PACKET"],
  ]),
  buildCat("baking", "Sweeteners & Baking", "🧁", [
    ["Sugar", "Cheeni", "KG"], ["Jaggery", "Gud", "GKG"], ["Baking Soda", "", "PACKET"], ["Baking Powder", "", "PACKET"],
    ["Vanilla Essence", "", "BOTTLE"], ["Cocoa Powder", "", "PACKET"], ["Yeast", "", "PACKET"],
  ]),
  buildCat("cleaning", "Cleaning & Household", "🧼", [
    ["Dishwash", "Vim", "BOTTLE"], ["Detergent", "", "KG"], ["Floor Cleaner", "", "BOTTLE"], ["Toilet Cleaner", "Harpic", "BOTTLE"],
    ["Garbage Bags", "", "PACKET"], ["Tissue Rolls", "", "PACKET"], ["Aluminium Foil", "", "PACKET"], ["Room Freshener", "", "BOTTLE"],
    ["Phenyl", "", "BOTTLE"], ["Scrub Pad", "", "PCS"],
  ]),
  buildCat("personal", "Personal Care", "🧴", [
    ["Soap", "", "PCS"], ["Shampoo", "", "BOTTLE"], ["Toothpaste", "", "PCS"], ["Handwash", "", "BOTTLE"],
    ["Sanitary Pads", "", "PACKET"], ["Shaving Cream", "", "PCS"], ["Face Wash", "", "BOTTLE"], ["Body Lotion", "", "BOTTLE"],
  ]),
];

/* flat index for lookups */
const ALL_ITEMS = {};
GROCERIES.forEach((c) => c.items.forEach((it) => (ALL_ITEMS[it.id] = { ...it, cat: c.id, catLabel: c.label, mode: "g" })));
VEG.forEach((it) => (ALL_ITEMS[it.id] = { ...it, cat: "veg", catLabel: "Vegetables", mode: "v" }));
FRUITS.forEach((it) => (ALL_ITEMS[it.id] = { ...it, cat: "fruit", catLabel: "Fruits", mode: "v" }));

/* ---------- clipboard / share helpers ---------- */
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.top = "0"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand("copy"); document.body.removeChild(ta); return ok;
  } catch (e) { return false; }
}

/* ---------- family members ---------- */
const MEMBER_COLORS = [
  { bg: "#E3EDE4", fg: "#2C5340" }, // green
  { bg: "#F1E6DE", fg: "#9C5B43" }, // terracotta
  { bg: "#E4EAF1", fg: "#3F5A78" }, // blue-grey
  { bg: "#EEE6EE", fg: "#6E4A6B" }, // plum
  { bg: "#F1ECDB", fg: "#876A2C" }, // mustard
  { bg: "#E1EDEB", fg: "#356B66" }, // teal
];
const SUGGESTED_INITIALS = { piyush: "P", sanya: "SD", shivya: "SC", sanjay: "SG", dhruv: "D", rachna: "R" };
function suggestInitials(name) {
  const k = (name || "").trim().toLowerCase().split(/\s+/)[0];
  if (SUGGESTED_INITIALS[k]) return SUGGESTED_INITIALS[k];
  const n = (name || "").trim();
  return n ? n[0].toUpperCase() : "?";
}
function Avatar({ member, size = 24, ring }: any) {
  const col = MEMBER_COLORS[(member?.ci ?? 0) % MEMBER_COLORS.length];
  return (
    <span style={{
      width: size, height: size, borderRadius: size, background: col.bg, color: col.fg,
      fontSize: Math.round(size * 0.4), fontWeight: 700, display: "inline-grid", placeItems: "center",
      letterSpacing: "0.01em", flexShrink: 0, boxSizing: "border-box",
      border: ring ? `2px solid ${col.fg}` : "none",
    }}>{member?.initials || "?"}</span>
  );
}

/* ================================================================== */
export default function PantryApp() {
  const [mode, setMode] = useState("g"); // 'g' groceries | 'v' veg
  const [sel, setSel] = useState<any>({});
  const [favs, setFavs] = useState<any>({});
  const [last, setLast] = useState<any>({});
  const [cad, setCad] = useState<any>({});
  const [ordered, setOrdered] = useState<any>({});
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactId, setContactId] = useState<any>(null);
  const [familyMenu, setFamilyMenu] = useState(false);
  // auth + family (Supabase)
  const [session, setSession] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [household, setHousehold] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [familyReady, setFamilyReady] = useState(false);
  const me = profile ? { id: profile.id, name: profile.display_name, initials: profile.initials, ci: profile.ci } : null;
  const familyName = household?.name || "Our Home";
  const familyCode = household?.join_code || "";
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState("all"); // 'all' | 'fav' | catId
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<any>(null);
  const saveTimer = useRef<any>(null);
  const snapRef = useRef<any>({});

  const rowKey = (r) => JSON.stringify([
    !!r.selected, Number(r.qty), r.unit, !!r.is_favorite, r.cadence || null,
    r.last_ordered ? new Date(r.last_ordered).getTime() : null,
    r.added_by || null, r.added_by_initials || null, (r.added_by_ci ?? null),
  ]);

  const loadMembers = async (hid) => {
    const { data: rows } = await supabase.from("household_members").select("user_id").eq("household_id", hid);
    const ids = (rows || []).map((r) => r.user_id);
    if (!ids.length) { setMembers([]); return; }
    const { data: profs } = await supabase.from("profiles").select("*").in("id", ids);
    setMembers((profs || []).map((p) => ({ id: p.id, name: p.display_name, initials: p.initials, ci: p.ci })));
  };

  /* ---- contacts (personal, on-device) ---- */
  useEffect(() => {
    try { const r = localStorage.getItem("pantry:contacts"); if (r) { const d = JSON.parse(r); setContacts(d.contacts || []); setContactId(d.contactId || null); } } catch (e) {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("pantry:contacts", JSON.stringify({ contacts, contactId })); } catch (e) {}
  }, [contacts, contactId]);

  /* ---- auth ---- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => { setSession(sess); setAuthReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  /* ---- profile ---- */
  useEffect(() => {
    if (!session) { setProfile(null); setProfileReady(true); return; }
    setProfileReady(false);
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      setProfile(data || null); setProfileReady(true);
    })();
  }, [session?.user?.id]);

  /* ---- family / household ---- */
  useEffect(() => {
    if (!session || !profile) { setHousehold(null); setMembers([]); setFamilyReady(!!session ? true : false); return; }
    setFamilyReady(false);
    (async () => {
      const { data: mem } = await supabase.from("household_members").select("household_id").eq("user_id", session.user.id).limit(1);
      const hid = mem?.[0]?.household_id;
      if (!hid) { setHousehold(null); setMembers([]); setFamilyReady(true); return; }
      const { data: hh } = await supabase.from("households").select("*").eq("id", hid).maybeSingle();
      await loadMembers(hid);
      setHousehold(hh || null); setFamilyReady(true);
    })();
  }, [session?.user?.id, profile?.id]);

  /* ---- pantry hydrate + realtime ---- */
  useEffect(() => {
    if (!household?.id) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from("pantry_items").select("*").eq("household_id", household.id);
      if (!active || !data) return;
      const s = {}, f = {}, c = {}, o = {}, l = {}, snap = {};
      for (const r of data) {
        snap[r.item_id] = rowKey(r);
        l[r.item_id] = { qty: Number(r.qty), unit: r.unit };
        if (r.selected) s[r.item_id] = { qty: Number(r.qty), unit: r.unit, by: r.added_by, initials: r.added_by_initials, ci: r.added_by_ci };
        if (r.is_favorite) f[r.item_id] = true;
        if (r.cadence) c[r.item_id] = r.cadence;
        if (r.last_ordered) o[r.item_id] = new Date(r.last_ordered).getTime();
      }
      snapRef.current = snap;
      setSel(s); setFavs(f); setCad(c); setOrdered(o); setLast(l);
    })();
    const ch = supabase
      .channel(`pi:${household.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pantry_items", filter: `household_id=eq.${household.id}` }, (pl) => {
        const r = pl.eventType === "DELETE" ? pl.old : pl.new;
        const id = r.item_id;
        if (pl.eventType === "DELETE") {
          setSel((m) => { const n = { ...m }; delete n[id]; return n; });
          setFavs((m) => { const n = { ...m }; delete n[id]; return n; });
          setCad((m) => { const n = { ...m }; delete n[id]; return n; });
          setOrdered((m) => { const n = { ...m }; delete n[id]; return n; });
          setLast((m) => { const n = { ...m }; delete n[id]; return n; });
          delete snapRef.current[id];
          return;
        }
        setLast((m) => ({ ...m, [id]: { qty: Number(r.qty), unit: r.unit } }));
        setSel((m) => { const n = { ...m }; if (r.selected) n[id] = { qty: Number(r.qty), unit: r.unit, by: r.added_by, initials: r.added_by_initials, ci: r.added_by_ci }; else delete n[id]; return n; });
        setFavs((m) => { const n = { ...m }; if (r.is_favorite) n[id] = true; else delete n[id]; return n; });
        setCad((m) => { const n = { ...m }; if (r.cadence) n[id] = r.cadence; else delete n[id]; return n; });
        setOrdered((m) => { const n = { ...m }; if (r.last_ordered) n[id] = new Date(r.last_ordered).getTime(); else delete n[id]; return n; });
        snapRef.current[id] = rowKey(r);
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [household?.id]);

  /* ---- diff-sync writer (debounced) ---- */
  useEffect(() => {
    if (!household?.id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const ids = new Set([
        ...Object.keys(sel), ...Object.keys(favs), ...Object.keys(cad),
        ...Object.keys(ordered), ...Object.keys(last), ...Object.keys(snapRef.current),
      ]);
      const upserts = [], deletes = [];
      const nextSnap = { ...snapRef.current };
      ids.forEach((id) => {
        const it = ALL_ITEMS[id]; if (!it) return;
        const seld = sel[id]; const fav = !!favs[id]; const cd = cad[id] || null; const ord = ordered[id] || null; const lm = last[id];
        const hasState = !!seld || fav || !!cd || !!ord;
        if (!hasState) { if (snapRef.current[id] !== undefined) { deletes.push(id); delete nextSnap[id]; } return; }
        const qty = seld?.qty ?? lm?.qty ?? 1;
        const unit = seld?.unit ?? lm?.unit ?? it.units[0];
        const row = {
          household_id: household.id, item_id: id, mode: it.mode, name: it.name, category: it.cat,
          selected: !!seld, qty, unit, is_favorite: fav, cadence: cd,
          last_ordered: ord ? new Date(ord).toISOString() : null,
          added_by: seld?.by ?? null, added_by_initials: seld?.initials ?? null, added_by_ci: seld?.ci ?? null,
          updated_at: new Date().toISOString(), updated_by: profile?.id || null,
        };
        const key = rowKey(row);
        if (snapRef.current[id] !== key) { upserts.push(row); nextSnap[id] = key; }
      });
      try {
        if (upserts.length) await supabase.from("pantry_items").upsert(upserts);
        if (deletes.length) await supabase.from("pantry_items").delete().eq("household_id", household.id).in("item_id", deletes);
        snapRef.current = nextSnap;
      } catch (e) {}
    }, 500);
  }, [sel, favs, cad, ordered, last, household?.id]);

  const ping = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 1900);
  }, []);

  /* ---- selection ops ---- */
  const toggle = (it) => {
    setSel((s) => {
      const n = { ...s };
      if (n[it.id]) { delete n[it.id]; }
      else {
        const mem = last[it.id];
        const unit = mem?.unit && it.units.includes(mem.unit) ? mem.unit : it.units[0];
        const qty = mem?.qty ?? START[unit] ?? 1;
        n[it.id] = { qty, unit, by: profile?.id || null, initials: profile?.initials || "?", ci: profile?.ci ?? 0 };
      }
      return n;
    });
  };
  const setQty = (id, qty) => {
    const q = Math.max(0, Math.round(qty * 100) / 100);
    setSel((s) => (s[id] ? { ...s, [id]: { ...s[id], qty: q } } : s));
    setLast((l) => ({ ...l, [id]: { ...(l[id] || {}), qty: q } }));
  };
  const cycleUnit = (id) => {
    const it = ALL_ITEMS[id];
    setSel((s) => {
      if (!s[id]) return s;
      const i = it.units.indexOf(s[id].unit);
      const unit = it.units[(i + 1) % it.units.length];
      const qty = START[unit] ?? s[id].qty;
      setLast((l) => ({ ...l, [id]: { qty, unit } }));
      return { ...s, [id]: { qty, unit } };
    });
  };
  const remove = (id) => setSel((s) => { const n = { ...s }; delete n[id]; return n; });
  const toggleFav = (id) => setFavs((f) => { const n = { ...f }; n[id] ? delete n[id] : (n[id] = true); return n; });
  const clearMode = () => {
    setSel((s) => Object.fromEntries(Object.entries(s).filter(([id]) => ALL_ITEMS[id]?.mode !== mode)));
    ping(mode === "v" ? "Vegetable list cleared" : "Grocery list cleared");
  };

  /* ---- contacts + WhatsApp ---- */
  const normNum = (n) => {
    const d = (n || "").replace(/\D/g, "");
    if (d.length === 10) return "91" + d;
    return d.length >= 11 ? d : "";
  };
  const addContact = (label, number) => {
    const num = normNum(number);
    if (!num) { ping("Enter a valid number with country code"); return; }
    const c = { id: "c" + Date.now(), label: (label || "").trim() || "Contact", number: num };
    setContacts((cs) => [...cs, c]); setContactId(c.id);
    ping(`Saved ${c.label}`);
  };
  const removeContact = (id) => {
    setContacts((cs) => cs.filter((c) => c.id !== id));
    setContactId((cur) => (cur === id ? null : cur));
  };
  const sendWhatsApp = (text) => {
    const c = contacts.find((x) => x.id === contactId);
    const url = (c ? `https://wa.me/${c.number}` : "https://wa.me/") + `?text=${encodeURIComponent(text)}`;
    let win = null;
    try { win = window.open(url, "_blank", "noopener"); } catch (e) {}
    if (!win) { copyText(text); ping(c ? "Couldn’t open WhatsApp — message copied" : "Message copied — open WhatsApp to paste"); }
    else ping(c ? `Opening WhatsApp · ${c.label}` : "Opening WhatsApp — pick a chat");
  };

  /* ---- account + family (Supabase) ---- */
  const signInGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };
  const saveProfile = async (name, initials, ci) => {
    if (!session) return;
    const row = { id: session.user.id, display_name: (name || "").trim() || "Member", initials: (initials || "?").toUpperCase().slice(0, 3), ci: ci ?? 0 };
    const { data } = await supabase.from("profiles").upsert(row).select().maybeSingle();
    setProfile(data || row); setProfileReady(true);
  };
  const createFamily = async (name) => {
    const { data, error } = await supabase.rpc("create_household", { p_name: name || "Our Home" });
    if (error) { ping("Couldn't create home"); return; }
    setHousehold(data); await loadMembers(data.id); setFamilyReady(true);
  };
  const joinFamily = async (code) => {
    const { data, error } = await supabase.rpc("join_household", { code: (code || "").toUpperCase() });
    if (error) { ping("Invalid family code"); return; }
    const { data: hh } = await supabase.from("households").select("*").eq("id", data).maybeSingle();
    setHousehold(hh); await loadMembers(data); setFamilyReady(true);
  };
  const signOut = async () => {
    setFamilyMenu(false);
    await supabase.auth.signOut();
    setProfile(null); setHousehold(null); setMembers([]);
    setSel({}); setFavs({}); setCad({}); setOrdered({}); setLast({}); snapRef.current = {};
  };
  const copyInvite = async () => {
    const ok = await copyText(`Join our ${familyName} grocery list 🛒 — open Pantry and enter family code: ${familyCode}`);
    ping(ok ? "Invite copied" : `Family code: ${familyCode}`);
  };

  /* ---- derived lists ---- */
  const source = mode === "g" ? GROCERIES : [
    { id: "veg", label: "Vegetables", icon: "🥬", items: VEG },
    { id: "fruit", label: "Fruits", icon: "🍎", items: FRUITS },
  ];
  const q = query.trim().toLowerCase();
  const cadOf = (it) => cad[it.id] || it.defCad || "M";

  /* ---- due-this-week engine (groceries) ---- */
  const nowMs = Date.now();
  const dueIds = useMemo(() =>
    GROCERIES.flatMap((c) => c.items).filter((it) => {
      if (sel[it.id]) return false;                 // already on the list
      const t = ordered[it.id];
      if (!t) return false;                          // only items you've actually bought before
      return (nowMs - t) / 86400000 >= (INTERVAL[cad[it.id] || it.defCad || "M"] || 30);
    }).map((it) => it.id),
  [ordered, sel, cad]); // eslint-disable-line react-hooks/exhaustive-deps
  const dueSet = useMemo(() => new Set(dueIds), [dueIds]);
  const dueCount = dueIds.length;
  const isDue = chip === "due";

  const markOrdered = () => {
    const ids = Object.entries(sel).filter(([id]) => ALL_ITEMS[id]?.mode === mode).map(([id]) => id);
    if (!ids.length) return;
    const now = Date.now();
    setOrdered((o) => { const n = { ...o }; ids.forEach((id) => (n[id] = now)); return n; });
    setSel((s) => Object.fromEntries(Object.entries(s).filter(([id]) => ALL_ITEMS[id]?.mode !== mode)));
    ping(`${ids.length} item${ids.length === 1 ? "" : "s"} marked ordered`);
  };
  const addAllDue = () => {
    setSel((s) => {
      const n = { ...s };
      dueIds.forEach((id) => {
        if (!n[id]) {
          const it = ALL_ITEMS[id]; const mem = last[id];
          const unit = mem?.unit && it.units.includes(mem.unit) ? mem.unit : it.units[0];
          n[id] = { qty: mem?.qty ?? START[unit] ?? 1, unit, by: profile?.id || null, initials: profile?.initials || "?", ci: profile?.ci ?? 0 };
        }
      });
      return n;
    });
    ping(`Added ${dueIds.length} due item${dueIds.length === 1 ? "" : "s"}`);
  };

  const isCad = chip.startsWith("cad");
  const cadVal = isCad ? chip.slice(3) : null;
  const visibleCats = useMemo(() => {
    return source
      .filter((c) => chip === "all" || chip === "fav" || isCad || isDue || chip === c.id)
      .map((c) => ({
        ...c,
        items: c.items.filter((it) => {
          if (chip === "fav" && !favs[it.id]) return false;
          if (isDue && !dueSet.has(it.id)) return false;
          if (isCad && cadOf(it) !== cadVal) return false;
          if (!q) return true;
          return it.name.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q);
        }),
      }))
      .filter((c) => c.items.length);
  }, [source, chip, q, favs, mode, cad, isCad, cadVal, isDue, dueSet]);

  const selThisMode: [string, any][] = Object.entries(sel).filter(([id]) => ALL_ITEMS[id]?.mode === mode) as [string, any][];
  const count = selThisMode.length;
  const favCount = (mode === "g" ? GROCERIES.flatMap((c) => c.items) : [...VEG, ...FRUITS]).filter((it) => favs[it.id]).length;

  const addAllFavs = () => {
    const items = (mode === "g" ? GROCERIES.flatMap((c) => c.items) : [...VEG, ...FRUITS]).filter((it) => favs[it.id]);
    setSel((s) => {
      const n = { ...s };
      items.forEach((it) => {
        if (!n[it.id]) {
          const mem = last[it.id];
          const unit = mem?.unit && it.units.includes(mem.unit) ? mem.unit : it.units[0];
          n[it.id] = { qty: mem?.qty ?? START[unit] ?? 1, unit, by: profile?.id || null, initials: profile?.initials || "?", ci: profile?.ci ?? 0 };
        }
      });
      return n;
    });
    ping(`Added ${items.length} frequent item${items.length === 1 ? "" : "s"}`);
  };

  /* ---- export text ---- */
  const vegMessage = () => {
    const order: Record<string, number> = { veg: 0, fruit: 1 };
    const sorted: [string, any][] = [...selThisMode].sort((a: any, b: any) => (order[ALL_ITEMS[a[0]].cat] ?? 0) - (order[ALL_ITEMS[b[0]].cat] ?? 0));
    const lines = sorted.map(([id, v]: [string, any]) => `• ${ALL_ITEMS[id].name} — ${qtyLabel((v as any).qty, (v as any).unit)}`);
    const hasFruit = selThisMode.some(([id]) => ALL_ITEMS[id].cat === "fruit");
    const hasVeg = selThisMode.some(([id]) => ALL_ITEMS[id].cat === "veg");
    const head = hasFruit && !hasVeg ? "Aaj ke fruits:" : hasFruit && hasVeg ? "Aaj ki sabzi & fruits:" : "Aaj ki sabzi:";
    return `Namaste 🙏 ${head}\n\n${lines.join("\n")}\n\nDhanyavaad!`;
  };
  const groceryText = () => {
    const byCat: Record<string, string[]> = {};
    selThisMode.forEach(([id, v]: [string, any]) => {
      const it = ALL_ITEMS[id];
      (byCat[it.catLabel] = byCat[it.catLabel] || []).push(`• ${it.name} — ${qtyLabel((v as any).qty, (v as any).unit)}`);
    });
    const blocks = Object.entries(byCat).map(([cat, rows]) => `${cat}\n${rows.join("\n")}`);
    return `Grocery list · ${count} item${count === 1 ? "" : "s"}\n\n${blocks.join("\n\n")}`;
  };

  const accent = C.green;

  if (!authReady) return <Splash />;
  if (!session) return <AuthGate stage="signin" onGoogle={signInGoogle} />;
  if (!profileReady) return <Splash />;
  if (!profile) return <AuthGate stage="profile" defaultName={session.user.user_metadata?.full_name || session.user.user_metadata?.name || (session.user.email || "").split("@")[0]} onSaveProfile={saveProfile} />;
  if (!familyReady) return <Splash />;
  if (!household) return <AuthGate stage="family" onCreate={createFamily} onJoin={joinFamily} />;

  return (
    <div style={{ minHeight: "100dvh", background: C.paper, color: C.ink, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <StyleTag />
      <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 150 }}>

        {/* Account strip */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 0" }}>
          <button onClick={() => setFamilyMenu(true)} style={{ display: "flex", alignItems: "center", gap: 7, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 11, padding: "7px 11px", fontSize: 12.5, fontWeight: 600, color: C.sub }}>
            <Home size={13} color={C.green} /> {familyName} <span style={{ color: C.faint }}>·</span> <span style={{ letterSpacing: "0.08em", color: C.ink }}>{familyCode}</span>
          </button>
          <button onClick={() => setFamilyMenu(true)} aria-label="Family & members" style={{ background: "none", border: "none", padding: 0 }}>
            <Avatar member={me} size={32} />
          </button>
        </div>

        {/* Header */}
        <header style={{ padding: "26px 20px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: C.faint, fontWeight: 600 }}>
                {mode === "v" ? "Fresh order" : "Weekly stock-up"}
              </div>
              <h1 style={{ fontFamily: SERIF, fontSize: 34, lineHeight: 1.05, margin: "4px 0 0", fontWeight: 500 }}>
                {mode === "v" ? "Sabzi & fruits" : "The Pantry"}
              </h1>
            </div>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: C.greenTint, display: "grid", placeItems: "center", border: `1px solid ${C.line}` }}>
              {mode === "v" ? <Carrot size={22} color={accent} /> : <ShoppingBasket size={22} color={accent} />}
            </div>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 13.5, color: C.sub, lineHeight: 1.5, maxWidth: 320 }}>
            {mode === "v"
              ? "Pick today’s vegetables and fruits, then copy a ready Hinglish message for the vendor or help."
              : "Tick what’s running low and batch it — fewer daily orders, one calm weekly run."}
          </p>
        </header>

        {/* Search */}
        <div style={{ padding: "8px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: "11px 14px" }}>
            <Search size={17} color={C.faint} />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={mode === "v" ? "Search veg & fruit…" : "Search groceries…"}
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 15, width: "100%", color: C.ink }}
            />
            {query && <button aria-label="Clear" onClick={() => setQuery("")} style={iconBtn}><X size={16} color={C.faint} /></button>}
          </div>
        </div>

        {/* Chips */}
        <div className="noscroll" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "14px 20px 6px" }}>
          <Chip active={chip === "all"} onClick={() => setChip("all")}>All</Chip>
          {mode === "g" && (
            <Chip active={chip === "due"} onClick={() => setChip("due")} accent>
              {dueCount > 0 && chip !== "due" && <span style={{ width: 6, height: 6, borderRadius: 3, background: C.green }} />}
              Due{dueCount ? ` ${dueCount}` : ""}
            </Chip>
          )}
          <Chip active={chip === "fav"} onClick={() => setChip("fav")} accent>
            <Star size={12} fill={chip === "fav" ? "#fff" : "none"} /> Frequent{favCount ? ` ${favCount}` : ""}
          </Chip>
          {mode === "g" && (
            <>
              <span style={{ width: 1, alignSelf: "center", height: 18, background: C.line, margin: "0 2px" }} />
              <Chip active={chip === "cadW"} onClick={() => setChip("cadW")}>Weekly</Chip>
              <Chip active={chip === "cad2W"} onClick={() => setChip("cad2W")}>Bi-weekly</Chip>
              <Chip active={chip === "cadM"} onClick={() => setChip("cadM")}>Monthly</Chip>
            </>
          )}
          {source.map((c) => (
            <Chip key={c.id} active={chip === c.id} onClick={() => setChip(c.id)}>
              <span style={{ marginRight: 5 }}>{c.icon}</span>{c.label.replace(/ &.*/, "")}
            </Chip>
          ))}
        </div>

        {/* Add all frequents */}
        {chip === "fav" && favCount > 0 && (
          <div style={{ padding: "6px 20px 0" }}>
            <button onClick={addAllFavs} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: C.greenTint, color: C.greenDeep, border: `1px solid ${C.bubbleLine}`, borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 600 }}>
              <Sparkles size={16} /> Add all {favCount} frequent items
            </button>
          </div>
        )}

        {/* Add all due */}
        {chip === "due" && dueCount > 0 && (
          <div style={{ padding: "6px 20px 0" }}>
            <button onClick={addAllDue} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: C.green, color: "#fff", border: "none", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 600 }}>
              <Sparkles size={16} /> Add all {dueCount} due item{dueCount === 1 ? "" : "s"}
            </button>
          </div>
        )}

        {/* List */}
        <main style={{ padding: "10px 20px 0" }}>
          {visibleCats.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: C.faint }}>
              <div style={{ fontFamily: SERIF, fontSize: 19, color: C.sub }}>Nothing here yet</div>
              <div style={{ fontSize: 13.5, marginTop: 6 }}>
                {chip === "due"
                  ? "Nothing due yet. Mark a list as ordered and it’ll resurface on schedule."
                  : chip === "fav"
                  ? "Tap the ☆ on items to mark your regulars."
                  : "Try a different search."}
              </div>
            </div>
          )}
          {visibleCats.map((c) => (
            <section key={c.id} style={{ marginTop: 18 }}>
              {chip === "all" && !q && source.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px 10px" }}>
                  <span style={{ fontSize: 15 }}>{c.icon}</span>
                  <h2 style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.sub, fontWeight: 700, margin: 0 }}>{c.label}</h2>
                  <div style={{ flex: 1, height: 1, background: C.line }} />
                </div>
              )}
              <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 18, overflow: "hidden" }}>
                {c.items.map((it, i) => (
                  <Row
                    key={it.id} it={it} state={sel[it.id]} fav={!!favs[it.id]} first={i === 0}
                    onToggle={() => toggle(it)} onFav={() => toggleFav(it.id)}
                    onStep={(d) => setQty(it.id, (sel[it.id].qty) + d * (STEP[sel[it.id].unit] || 1))}
                    onSetQty={(v) => setQty(it.id, v)} onUnit={() => cycleUnit(it.id)}
                    cadence={mode === "g" ? cadOf(it) : null}
                    due={mode === "g" && dueSet.has(it.id)}
                    onCad={() => setCad((m) => ({ ...m, [it.id]: CADENCE[(CADENCE.indexOf(cadOf(it)) + 1) % 3] }))}
                  />
                ))}
              </div>
            </section>
          ))}
        </main>
      </div>

      {/* Bottom dock */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        <div style={{ width: "100%", maxWidth: 480, padding: "0 14px 14px", pointerEvents: "auto" }}>
          {count > 0 && (
            <button onClick={() => setSheet(true)} style={{ width: "100%", marginBottom: 10, background: C.ink, color: "#fff", border: "none", borderRadius: 16, padding: "15px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 10px 30px rgba(26,27,22,0.18)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 600 }}>
                <span style={{ background: "rgba(255,255,255,0.16)", borderRadius: 9, padding: "3px 9px", fontVariantNumeric: "tabular-nums" }}>{count}</span>
                {mode === "v" ? "Review & copy message" : "Review list"}
              </span>
              <ChevronRight size={20} />
            </button>
          )}
          <div style={{ display: "flex", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 5, boxShadow: "0 6px 20px rgba(26,27,22,0.07)" }}>
            <Tab active={mode === "g"} onClick={() => { setMode("g"); setChip("all"); }} icon={<ShoppingBasket size={18} />} label="Groceries" />
            <Tab active={mode === "v"} onClick={() => { setMode("v"); setChip("all"); }} icon={<Carrot size={18} />} label="Veg & Fruit" />
          </div>
        </div>
      </div>

      {/* Review sheet */}
      {sheet && (
        <Sheet
          mode={mode} items={selThisMode} accent={accent}
          onClose={() => setSheet(false)} onRemove={remove}
          onStep={(id, d) => setQty(id, sel[id].qty + d * (STEP[sel[id].unit] || 1))}
          onUnit={cycleUnit} onClear={() => { clearMode(); setSheet(false); }}
          onMarkOrdered={() => { markOrdered(); setSheet(false); }}
          text={mode === "v" ? vegMessage() : groceryText()}
          onCopy={async () => ping((await copyText(mode === "v" ? vegMessage() : groceryText())) ? "Copied to clipboard" : "Long-press the text to copy")}
          onWhatsApp={() => sendWhatsApp(mode === "v" ? vegMessage() : groceryText())}
          contacts={contacts} contactId={contactId} onSelectContact={setContactId}
          onAddContact={addContact} onRemoveContact={removeContact}
          members={members}
        />
      )}

      {/* Family & members */}
      {familyMenu && (
        <FamilyMenu
          familyName={familyName} familyCode={familyCode} members={members} meId={profile?.id}
          onClose={() => setFamilyMenu(false)}
          onInvite={copyInvite} onSignOut={signOut}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 110, display: "flex", justifyContent: "center", zIndex: 60, pointerEvents: "none" }}>
          <div className="toast" style={{ background: C.ink, color: "#fff", padding: "10px 16px", borderRadius: 12, fontSize: 13.5, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
            <Check size={15} color={C.bubble} /> {toast}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Row ---------- */
function Row({ it, state, fav, first, onToggle, onFav, onStep, onSetQty, onUnit, cadence, due, onCad }: any) {
  const on = !!state;
  return (
    <div style={{ borderTop: first ? "none" : `1px solid ${C.lineSoft}`, background: on ? C.greenTint : "transparent", transition: "background .18s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px" }}>
        <button onClick={onToggle} aria-label={on ? "Remove" : "Add"} style={{
          width: 24, height: 24, borderRadius: 8, flexShrink: 0, border: on ? "none" : `1.6px solid ${C.line}`,
          background: on ? C.green : C.surface, display: "grid", placeItems: "center", transition: "all .15s ease",
        }}>
          {on ? <Check size={15} color="#fff" /> : <Plus size={14} color={C.faint} />}
        </button>

        <button onClick={onToggle} style={{ flex: 1, textAlign: "left", background: "none", border: "none", padding: 0, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 15.5, fontWeight: 500, color: C.ink, lineHeight: 1.2 }}>{it.name}</span>
            {cadence && (
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.03em", color: due ? C.greenDeep : C.faint, background: due ? C.greenTint2 : C.lineSoft, borderRadius: 6, padding: "2px 6px" }}>
                {due ? "DUE" : cadence}
              </span>
            )}
          </div>
          {it.sub && <div style={{ fontSize: 12, color: C.faint, marginTop: 1 }}>{it.sub}</div>}
        </button>

        <button onClick={onFav} aria-label="Mark frequent" style={iconBtn}>
          <Star size={17} color={fav ? C.star : C.faint} fill={fav ? C.star : "none"} />
        </button>
      </div>

      {on && (
        <div className="reveal" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px 13px 50px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", background: C.surface, border: `1px solid ${C.bubbleLine}`, borderRadius: 11, overflow: "hidden" }}>
            <button onClick={() => onStep(-1)} aria-label="Less" style={stepBtn}><Minus size={15} color={C.greenDeep} /></button>
            <input
              value={state.qty} inputMode="decimal"
              onChange={(e) => { const v = parseFloat(e.target.value); onSetQty(isNaN(v) ? 0 : v); }}
              style={{ width: 46, textAlign: "center", border: "none", outline: "none", fontSize: 15, fontWeight: 600, background: "transparent", color: C.ink, fontVariantNumeric: "tabular-nums" }}
            />
            <button onClick={() => onStep(1)} aria-label="More" style={stepBtn}><Plus size={15} color={C.greenDeep} /></button>
          </div>
          <button onClick={onUnit} style={{ fontSize: 13, fontWeight: 600, color: C.greenDeep, background: C.greenTint2, border: `1px solid ${C.bubbleLine}`, borderRadius: 10, padding: "7px 12px", minWidth: 58 }}>
            {state.unit}
          </button>
          {cadence && (
            <button onClick={onCad} aria-label="Change cadence" style={{ fontSize: 12.5, fontWeight: 600, color: C.sub, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: "7px 12px" }}>
              {CADENCE_LABEL[cadence]}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Review Sheet ---------- */
function Sheet({ mode, items, accent, onClose, onRemove, onStep, onUnit, onClear, onMarkOrdered, text, onCopy, onWhatsApp, contacts, contactId, onSelectContact, onAddContact, onRemoveContact, members }: any) {
  const isVeg = mode === "v";
  const [showAdd, setShowAdd] = useState(false);
  const [cLabel, setCLabel] = useState("");
  const [cNum, setCNum] = useState("");
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(26,27,22,0.42)", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "90dvh", background: C.paper, borderRadius: "26px 26px 0 0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "12px 0 6px", display: "grid", placeItems: "center" }}>
          <div style={{ width: 42, height: 5, borderRadius: 3, background: C.line }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 20px 12px" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: C.faint, fontWeight: 600 }}>{items.length} item{items.length === 1 ? "" : "s"}</div>
            <h2 style={{ fontFamily: SERIF, fontSize: 24, margin: "2px 0 0", fontWeight: 500 }}>{isVeg ? "Sabzi message" : "Grocery list"}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ ...iconBtn, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 11, padding: 9 }}><X size={18} color={C.sub} /></button>
        </div>

        <div style={{ overflowY: "auto", padding: "0 20px", flex: 1 }}>
          {/* Veg message preview — the signature */}
          {isVeg && (
            <div style={{ background: "#ECEAE3", borderRadius: 18, padding: 14, marginBottom: 16, border: `1px solid ${C.line}` }}>
              <div style={{ position: "relative", background: C.bubble, border: `1px solid ${C.bubbleLine}`, borderRadius: "16px 16px 16px 5px", padding: "12px 14px", maxWidth: "94%" }}>
                <pre style={{ margin: 0, fontFamily: "inherit", whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.55, color: "#26301C" }}>{text}</pre>
                <div style={{ textAlign: "right", fontSize: 10.5, color: "#6E7B5E", marginTop: 4 }}>WhatsApp preview ✓✓</div>
              </div>
            </div>
          )}

          {/* Editable items */}
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden", marginBottom: 14 }}>
            {items.map(([id, v]: [string, any], i) => {
              const it = ALL_ITEMS[id];
              const by = members?.find((m) => m.id === v.by);
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderTop: i === 0 ? "none" : `1px solid ${C.lineSoft}` }}>
                  {by ? <Avatar member={by} size={26} /> : <span style={{ width: 26, height: 26, borderRadius: 13, border: `1.5px dashed ${C.line}`, flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{it.name}</div>
                    <div style={{ fontSize: 11, color: C.faint }}>{by ? `Added by ${by.name}` : it.catLabel}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
                    <button onClick={() => onStep(id, -1)} style={stepBtnSm}><Minus size={13} color={C.greenDeep} /></button>
                    <span style={{ minWidth: 34, textAlign: "center", fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmt((v as any).qty)}</span>
                    <button onClick={() => onStep(id, 1)} style={stepBtnSm}><Plus size={13} color={C.greenDeep} /></button>
                  </div>
                  <button onClick={() => onUnit(id)} style={{ fontSize: 12.5, fontWeight: 600, color: C.greenDeep, background: C.greenTint2, borderRadius: 8, border: `1px solid ${C.bubbleLine}`, padding: "6px 9px", minWidth: 50 }}>{(v as any).unit}</button>
                  <button onClick={() => onRemove(id)} aria-label="Remove" style={iconBtn}><Trash2 size={16} color={C.faint} /></button>
                </div>
              );
            })}
          </div>

          {!isVeg && (
            <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: C.faint, fontWeight: 600, marginBottom: 8 }}>Copy as text (optional)</div>
              <pre style={{ margin: 0, fontFamily: "inherit", whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.5, color: C.sub }}>{text}</pre>
            </div>
          )}

          <div style={{ display: "flex", gap: 18, justifyContent: "center", alignItems: "center", margin: "0 auto 16px", flexWrap: "wrap" }}>
            {!isVeg && (
              <button onClick={onMarkOrdered} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", color: C.greenDeep, fontSize: 13.5, fontWeight: 600 }}>
                <Check size={15} /> Mark as ordered
              </button>
            )}
            <button onClick={onClear} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", color: C.danger, fontSize: 13.5, fontWeight: 500 }}>
              <Trash2 size={15} /> Clear list
            </button>
          </div>
        </div>

        {/* Footer: send-to + actions */}
        <div style={{ borderTop: `1px solid ${C.line}`, background: C.paper, padding: "12px 20px calc(16px + env(safe-area-inset-bottom))" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: C.faint, fontWeight: 600 }}>Send to</span>
            <button onClick={() => setShowAdd((v) => !v)} style={{ fontSize: 12.5, fontWeight: 600, color: C.greenDeep, background: "none", border: "none", display: "flex", alignItems: "center", gap: 5 }}>
              <UserPlus size={14} /> {contacts.length ? "Manage" : "Add number"}
            </button>
          </div>

          {contacts.length > 0 && (
            <div className="noscroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10 }}>
              {contacts.map((c) => {
                const on = c.id === contactId;
                return (
                  <button key={c.id} onClick={() => onSelectContact(on ? null : c.id)} style={{
                    whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600,
                    padding: "8px 13px", borderRadius: 11,
                    border: `1px solid ${on ? C.green : C.line}`, background: on ? C.greenTint : C.surface, color: on ? C.greenDeep : C.sub,
                  }}>
                    <Phone size={12} /> {c.label}
                  </button>
                );
              })}
            </div>
          )}

          {!contacts.length && !showAdd && (
            <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 10, lineHeight: 1.45 }}>
              No number saved — you’ll pick a chat in WhatsApp. Add one for one-tap send.
            </div>
          )}

          {showAdd && (
            <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 12, marginBottom: 10 }}>
              {contacts.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  {contacts.map((c) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
                      <div style={{ fontSize: 13.5, minWidth: 0 }}>
                        <span style={{ fontWeight: 600 }}>{c.label}</span>
                        <span style={{ color: C.faint, marginLeft: 8 }}>+{c.number}</span>
                      </div>
                      <button onClick={() => onRemoveContact(c.id)} aria-label="Remove number" style={iconBtn}><Trash2 size={15} color={C.faint} /></button>
                    </div>
                  ))}
                  <div style={{ height: 1, background: C.lineSoft, margin: "6px 0 2px" }} />
                </div>
              )}
              <input
                value={cLabel} onChange={(e) => setCLabel(e.target.value)} placeholder="Name (e.g. Veg bhaiya)"
                style={{ width: "100%", border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", background: C.paper, color: C.ink }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  value={cNum} onChange={(e) => setCNum(e.target.value)} inputMode="tel" placeholder="91 98765 43210"
                  style={{ flex: 1, minWidth: 0, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", background: C.paper, color: C.ink }}
                />
                <button
                  onClick={() => { if (cNum.trim()) { onAddContact(cLabel, cNum); setCLabel(""); setCNum(""); } }}
                  style={{ background: C.green, color: "#fff", border: "none", borderRadius: 10, padding: "0 18px", fontSize: 14, fontWeight: 600 }}
                >Save</button>
              </div>
              <div style={{ fontSize: 11.5, color: C.faint, marginTop: 8, lineHeight: 1.45 }}>Include country code (91 for India). 10-digit numbers get +91 added.</div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            {isVeg ? (
              <>
                <button onClick={onWhatsApp} style={primaryBtn}><Send size={18} /> Send on WhatsApp</button>
                <button onClick={onCopy} aria-label="Copy message" style={secondaryBtn}><Copy size={19} color={C.greenDeep} /></button>
              </>
            ) : (
              <>
                <button onClick={onCopy} style={primaryBtn}><ClipboardCheck size={18} /> Copy list</button>
                <button onClick={onWhatsApp} aria-label="Send on WhatsApp" style={secondaryBtn}><Send size={19} color={C.greenDeep} /></button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
/* ---------- Auth + family onboarding ---------- */
function Splash() {
  return (
    <div style={{ minHeight: "100dvh", background: C.paper, display: "grid", placeItems: "center" }}>
      <div style={{ color: C.faint, fontFamily: SERIF, fontSize: 22, letterSpacing: "0.04em" }}>Pantry</div>
    </div>
  );
}

/* ---------- Auth + family onboarding ---------- */
function AuthGate({ stage, onGoogle, defaultName, onSaveProfile, onCreate, onJoin }: any) {
  const [name, setName] = useState(defaultName || "");
  const [initials, setInitials] = useState(suggestInitials(defaultName || ""));
  const [ci, setCi] = useState(0);
  const [famMode, setFamMode] = useState<any>(null);
  const [homeName, setHomeName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const wrap = { minHeight: "100dvh", background: C.paper, color: C.ink, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 24px", maxWidth: 480, margin: "0 auto", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };
  const field = { width: "100%", border: `1px solid ${C.line}`, borderRadius: 12, padding: "13px 14px", fontSize: 15, outline: "none", background: C.surface, color: C.ink };
  const big = { width: "100%", border: "none", borderRadius: 14, padding: "15px", fontSize: 15.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 9 };

  return (
    <div style={wrap}>
      <StyleTag />
      <div style={{ marginBottom: 26 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: C.faint, fontWeight: 600 }}>Family kitchen</div>
        <h1 style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 1, margin: "6px 0 0", fontWeight: 500 }}>Pantry</h1>
      </div>

      {stage === "signin" && (
        <div className="reveal">
          <p style={{ color: C.sub, fontSize: 15, lineHeight: 1.55, margin: "0 0 22px", maxWidth: 320 }}>
            One shared list for the whole family — groceries, sabzi &amp; fruits, and who added what.
          </p>
          <button onClick={onGoogle} style={{ ...big, background: C.surface, color: C.ink, border: `1px solid ${C.line}` }}>
            <span style={{ width: 20, height: 20, borderRadius: 10, background: C.green, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12 }}>G</span>
            Continue with Google
          </button>
        </div>
      )}

      {stage === "profile" && (
        <div className="reveal">
          <p style={{ color: C.sub, fontSize: 15, lineHeight: 1.55, margin: "0 0 20px" }}>Set up your profile — this tags every item you add.</p>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>Your name</label>
          <input autoFocus value={name} onChange={(e) => { setName(e.target.value); setInitials(suggestInitials(e.target.value)); }} placeholder="Your name" style={{ ...field, margin: "8px 0 16px" }} />
          <label style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>Initials (shown on items)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 18px" }}>
            <Avatar member={{ initials: (initials || "?").toUpperCase().slice(0, 3), ci }} size={44} />
            <input value={initials} onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 3))} maxLength={3} placeholder="SD" style={{ ...field, letterSpacing: "0.18em", fontWeight: 700, textTransform: "uppercase" }} />
          </div>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>Colour</label>
          <div style={{ display: "flex", gap: 10, margin: "10px 0 22px" }}>
            {MEMBER_COLORS.map((col, i) => (
              <button key={i} onClick={() => setCi(i)} aria-label={`Colour ${i + 1}`} style={{ width: 36, height: 36, borderRadius: 18, background: col.bg, border: ci === i ? `2px solid ${col.fg}` : `1px solid ${C.line}`, cursor: "pointer" }} />
            ))}
          </div>
          <button disabled={busy} onClick={async () => { setBusy(true); await onSaveProfile(name, initials, ci); setBusy(false); }} style={{ ...big, background: C.green, color: "#fff", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Saving…" : "Continue"}
          </button>
        </div>
      )}

      {stage === "family" && (
        <div className="reveal">
          {!famMode && (
            <>
              <p style={{ color: C.sub, fontSize: 15, lineHeight: 1.55, margin: "0 0 22px" }}>Start your family's list, or join one with a code.</p>
              <button onClick={() => setFamMode("create")} style={{ ...big, background: C.green, color: "#fff", marginBottom: 12 }}><Home size={18} /> Create a family</button>
              <button onClick={() => setFamMode("join")} style={{ ...big, background: C.surface, color: C.ink, border: `1px solid ${C.line}` }}><Users size={18} /> Join with a code</button>
            </>
          )}
          {famMode === "create" && (
            <>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>Home name</label>
              <input autoFocus value={homeName} onChange={(e) => setHomeName(e.target.value)} placeholder="Grover Home" style={{ ...field, margin: "8px 0 16px" }} />
              <button disabled={busy} onClick={async () => { setBusy(true); await onCreate(homeName); setBusy(false); }} style={{ ...big, background: C.green, color: "#fff", opacity: busy ? 0.6 : 1 }}>{busy ? "Creating…" : "Create & get code"}</button>
              <button onClick={() => setFamMode(null)} style={{ ...big, background: "transparent", color: C.sub, marginTop: 6 }}>Back</button>
            </>
          )}
          {famMode === "join" && (
            <>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>Family code</label>
              <input autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={6} style={{ ...field, margin: "8px 0 16px", letterSpacing: "0.3em", fontWeight: 700, textTransform: "uppercase" }} />
              <button disabled={busy} onClick={async () => { setBusy(true); await onJoin(code); setBusy(false); }} style={{ ...big, background: C.green, color: "#fff", opacity: busy ? 0.6 : 1 }}>{busy ? "Joining…" : "Join family"}</button>
              <button onClick={() => setFamMode(null)} style={{ ...big, background: "transparent", color: C.sub, marginTop: 6 }}>Back</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Family & members menu ---------- */
function FamilyMenu({ familyName, familyCode, members, meId, onClose, onInvite, onSignOut }: any) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(26,27,22,0.42)", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "90dvh", background: C.paper, borderRadius: "26px 26px 0 0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "12px 0 6px", display: "grid", placeItems: "center" }}>
          <div style={{ width: 42, height: 5, borderRadius: 3, background: C.line }} />
        </div>
        <div style={{ overflowY: "auto", padding: "4px 20px 20px" }}>
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 18, padding: 18, marginBottom: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: C.faint, fontWeight: 600 }}>Family</div>
            <div style={{ fontFamily: SERIF, fontSize: 24, margin: "3px 0 14px", fontWeight: 500 }}>{familyName}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.greenTint, border: `1px solid ${C.bubbleLine}`, borderRadius: 12, padding: "12px 14px" }}>
              <div>
                <div style={{ fontSize: 11, color: C.greenDeep, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Share code</div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.22em", color: C.ink, fontVariantNumeric: "tabular-nums" }}>{familyCode}</div>
              </div>
              <button onClick={onInvite} style={{ display: "flex", alignItems: "center", gap: 7, background: C.green, color: "#fff", border: "none", borderRadius: 11, padding: "10px 14px", fontSize: 13.5, fontWeight: 600 }}>
                <Copy size={15} /> Invite
              </button>
            </div>
            <div style={{ fontSize: 12, color: C.faint, marginTop: 10, lineHeight: 1.45 }}>Anyone with this code can join and add items to the shared list.</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px 10px" }}>
            <h2 style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.sub, fontWeight: 700, margin: 0 }}>Members</h2>
            <span style={{ fontSize: 12, color: C.faint }}>{members.length}</span>
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
            {members.map((m, i) => {
              const you = m.id === meId;
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i === 0 ? "none" : `1px solid ${C.lineSoft}` }}>
                  <Avatar member={m} size={32} ring={you} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{m.name}{you && <span style={{ fontSize: 12, color: C.greenDeep, fontWeight: 600 }}> · you</span>}</div>
                  </div>
                </div>
              );
            })}
            {!members.length && <div style={{ padding: 16, fontSize: 13, color: C.faint }}>Just you so far — share the code to add family.</div>}
          </div>

          <button onClick={onSignOut} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: "none", border: `1px solid ${C.line}`, borderRadius: 13, padding: "13px", color: C.danger, fontSize: 14, fontWeight: 600 }}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- small UI bits ---------- */
function Chip({ children, active, onClick, accent }: any) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      whiteSpace: "nowrap", flexShrink: 0, fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 11,
      border: `1px solid ${active ? (accent ? C.green : C.ink) : C.line}`,
      background: active ? (accent ? C.green : C.ink) : C.surface,
      color: active ? "#fff" : C.sub, transition: "all .15s ease",
    }}>{children}</button>
  );
}
function Tab({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px",
      borderRadius: 12, border: "none", fontSize: 14.5, fontWeight: 600,
      background: active ? C.greenTint : "transparent", color: active ? C.greenDeep : C.faint, transition: "all .15s ease",
    }}>{icon} {label}</button>
  );
}

const iconBtn = { background: "none", border: "none", padding: 6, cursor: "pointer", display: "grid", placeItems: "center" };
const stepBtn = { padding: "9px 11px", background: "none", border: "none", display: "grid", placeItems: "center" };
const stepBtnSm = { padding: "8px 9px", background: "none", border: "none", display: "grid", placeItems: "center" };
const primaryBtn = { flex: 1, background: C.green, color: "#fff", border: "none", borderRadius: 15, padding: "15px", fontSize: 15.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 9 };
const secondaryBtn = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 15, padding: "0 18px", display: "grid", placeItems: "center" };

function StyleTag() {
  return (
    <style>{`
      * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
      button { cursor: pointer; }
      .noscroll::-webkit-scrollbar { display: none; }
      .noscroll { scrollbar-width: none; }
      :focus-visible { outline: 2px solid ${C.green}; outline-offset: 2px; border-radius: 8px; }
      @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes revealIn { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 80px; } }
      .sheet { animation: sheetUp .32s cubic-bezier(.22,.9,.3,1); }
      .toast { animation: fadeUp .22s ease; }
      .reveal { animation: revealIn .22s ease; }
      @media (prefers-reduced-motion: reduce) {
        .sheet, .toast, .reveal { animation: none !important; }
        * { transition: none !important; }
      }
    `}</style>
  );
}
