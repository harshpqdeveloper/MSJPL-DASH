import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Metric logic (validated against Book5.xlsx):
//   Casting pcs (col AN) = sum of stages AE:AM  (SO..PTRI)
//   Casting wt  (col AO) = UnitWeight (col Z) x Casting pcs
//   Metal  = derived ONLY from Karat (col S):
//            contains G/g -> Gold, else P/p -> Platinum, else S/s -> Silver
//   Month  = production delivery date (Prd Delv Dt, col L)
//   Phase  = the macro production stage holding the most balance pieces
// Header row is auto-detected. Dates are converted via UTC to avoid the
// SheetJS/timezone bug that reads Excel dates one day early.
// ---------------------------------------------------------------------------

const CAST_STAGES = ["SO","PMDR","PWAX-A","PWAX-B","PWAX","PWXST","PWBGD","PWBGD-LGD","PTRI"];

// FG is reported as a direct sum of its own columns (like Casting Pcs), not via the
// "peak stage wins" logic the rest of the funnel uses — see the `fg` field below and
// how it's combined into the funnel in Dashboard.jsx's `phase` useMemo.
const FG_STAGES = ["FG","SHP1","SHP2","RGTS"];

// Custom production-funnel grouping (per-column mapping supplied manually).
// Columns not yet assigned to a group (casting Pcs/Casting wts pre-computed columns,
// PREJ, Sale, Closed) are intentionally left out for now — rows whose peak stage
// falls in one of those columns fall back to "Not on floor".
const MACRO = {
  "New Order": ["SO"],
  "Model Pending": ["PMDR"],
  "Wax": ["PWAX-A","PWAX-B","PWAX","PWXST"],
  "PWBGD": ["PWBGD","PWBGD-LGD"],
  "JTRI": ["JTRI"],
  "PTRI": ["PTRI"],
  "Filing": ["PCAST","JCAST","JSPGR","JTMLG","PTMLG","PSPGR","PGPG","PFIL-B","PFIL-D","JFIL","P1SFIL"],
  "Finding Balance": ["P1FNDBL"],
  "Single Pre Polish": ["PPRPOL"],
  "Setting": ["PSET","JSET","JSHDSET","PMSET-C","PMSET","PMSET-A","PMSET-B"],
  "MSHDS": ["MSHDSET"],
  "Polish": ["PPOLCL-1","PPOLCL-2","PPOLCL-3","PPOLCL-4","PPOL","JPRPOL","JPOL","PPOLCL-5"],
  "Rodium": ["JRHD","PRHD","PRHD-A"],
  "PQC": ["PQC"],
  "Third Party QC": ["PTPQC","PTPQC-A","JTPQC","SHP4"],
  "Sampling": ["S1FIL","S1MSET","S1POL","S2FIL","S2SET","S2POL","S2FQC"],
  "Job Work": ["PJBW","PJBW-A","PPLT","GSI-REJ"],
  "GSI": ["PCELL","SHP3"],
  "Adi Nath": ["ADI-SCSD","ADI-RDSET","ADI-PTPFIL","ADI-PFIL","ADI-PPRPOL","ADI-PTPSET","ADI-SET","ADI-PPOL","ADI-PTPPOL","ADI-HOLD","ADI-JBOUT"],
  "Others": ["Others"],
};

const CATNAME = { RNG:"Rings", EAR:"Earrings", BRC:"Bracelets", PND:"Pendants", NCK:"Necklaces", BNG:"Bangles" };
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const norm = (v) => String(v == null ? "" : v).trim();
const lc = (v) => norm(v).toLowerCase();

function toNum(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/,/g, "").trim());
  return isFinite(n) ? n : 0;
}

// Excel serial / date / string -> clean local-midnight Date (matches Excel display)
function toDate(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && isFinite(v)) {
    const ms = Math.round((v - 25569) * 86400000); // 25569 = Excel serial for 1970-01-01
    const u = new Date(ms);
    return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
  }
  if (v instanceof Date) {
    if (isNaN(v)) return null;
    const t = new Date(v.getTime() + 60 * 1000); // nudge past 23:59:xx rounding
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const d = new Date(s);
  return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Metal strictly from Karat (col S): G->Gold, P->Platinum, S->Silver (case-insensitive)
function metalFromKarat(k) {
  const s = norm(k);
  if (/g/i.test(s)) return "Gold";
  if (/p/i.test(s)) return "Platinum";
  if (/s/i.test(s)) return "Silver";
  return "Other";
}

function monthBucket(d) {
  if (!d) return { mb: "No date", ms: Number.POSITIVE_INFINITY };
  const y = d.getFullYear(), m = d.getMonth() + 1;
  return { mb: `${MONTH_SHORT[m - 1]} ${y}`, ms: y * 100 + m };
}

function findHeaderRow(aoa) {
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    if ((aoa[i] || []).map(lc).includes("order srno")) return i;
  }
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const cells = (aoa[i] || []).map(lc);
    if (cells.includes("karat") && cells.includes("bal qty")) return i;
  }
  return 0;
}

export function parseWorkbook(arrayBuffer) {
  // No cellDates -> dates arrive as serial numbers, converted via UTC in toDate().
  const wb = XLSX.read(arrayBuffer, { type: "array" });

  let sheetName = wb.SheetNames[0];
  for (const nm of wb.SheetNames) {
    const flat = XLSX.utils.sheet_to_json(wb.Sheets[nm], { header: 1, raw: true, defval: null })
      .slice(0, 15).flat().map(lc);
    if (flat.includes("order srno")) { sheetName = nm; break; }
  }

  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  if (!aoa.length) throw new Error("The selected sheet is empty.");

  const hIdx = findHeaderRow(aoa);
  const header = (aoa[hIdx] || []).map(norm);

  const nameToIdx = {};
  header.forEach((h, i) => { const key = h.toLowerCase(); if (key && !(key in nameToIdx)) nameToIdx[key] = i; });
  const idxOf = (...names) => { for (const n of names) { const k = n.toLowerCase(); if (k in nameToIdx) return nameToIdx[k]; } return -1; };

  const col = {
    party: idxOf("Party"),
    customer: idxOf("Customer"),
    srno: idxOf("Order SrNo"),
    otype: idxOf("Order Type"),
    delv: idxOf("Prd Delv Dt"),
    balDays: idxOf("BalDelvDays"),
    category: idxOf("Category"),
    style: idxOf("Style"),
    karat: idxOf("Karat"),
    orderQty: idxOf("Order Qty"),
    expQty: idxOf("Exp Bal Qty", "Export Qty", "Exp Bal Qty."),
    unitWt: idxOf("Unit Metal PureWt", "UnitWeight", "Unit Weight", "Unit Metal Pure Wt"),
    balQty: idxOf("Bal Qty"),
    floorQty: idxOf("Floor Qty"),
  };

  const stageIdx = {};
  header.forEach((h, i) => { if (h) stageIdx[h] = i; });
  const stageColsPresent = (list) => list.map((n) => stageIdx[n]).filter((i) => i != null && i >= 0);
  const castIdx = stageColsPresent(CAST_STAGES);
  const fgIdx = stageColsPresent(FG_STAGES);
  const macroIdx = {};
  for (const [k, list] of Object.entries(MACRO)) macroIdx[k] = stageColsPresent(list);

  const missing = [];
  if (col.srno < 0) missing.push("Order SrNo");
  if (col.balQty < 0) missing.push("Bal Qty");
  if (col.karat < 0) missing.push("Karat");
  if (col.delv < 0) missing.push("Prd Delv Dt");
  if (col.unitWt < 0) missing.push("Unit Metal PureWt / UnitWeight");
  if (castIdx.length === 0) missing.push("Casting stages (SO..PTRI)");

  const rows = [];
  for (let r = hIdx + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const sr = norm(col.srno >= 0 ? row[col.srno] : "");
    if (!sr) continue;

    const karat = col.karat >= 0 ? norm(row[col.karat]) : "";
    const unitWt = col.unitWt >= 0 ? toNum(row[col.unitWt]) : 0;
    const bq = col.balQty >= 0 ? toNum(row[col.balQty]) : 0;

    let cp = 0;
    for (const ci of castIdx) cp += toNum(row[ci]);
    const cw = Math.round(unitWt * cp * 100) / 100;

    let fg = 0;
    for (const ci of fgIdx) fg += toNum(row[ci]);

    let phase = "Not on floor", best = 0;
    for (const [name, idxs] of Object.entries(macroIdx)) {
      let s = 0; for (const ci of idxs) s += toNum(row[ci]);
      if (s > best) { best = s; phase = name; }
    }

    const dDate = col.delv >= 0 ? toDate(row[col.delv]) : null;
    const { mb, ms } = monthBucket(dDate);
    const catRaw = col.category >= 0 ? norm(row[col.category]) : "";

    rows.push({
      p: col.party >= 0 ? norm(row[col.party]) || "—" : "—",
      c: col.customer >= 0 ? norm(row[col.customer]) || "—" : "—",
      cat: CATNAME[catRaw] || catRaw || "—",
      k: karat,
      mt: metalFromKarat(karat),
      bq: Math.round(bq),
      oq: col.orderQty >= 0 ? Math.round(toNum(row[col.orderQty])) : 0,
      eq: col.expQty >= 0 ? Math.round(toNum(row[col.expQty])) : 0,
      fq: col.floorQty >= 0 ? Math.round(toNum(row[col.floorQty])) : 0,
      cp: Math.round(cp),
      cw,
      fg: Math.round(fg),
      d: col.balDays >= 0 && row[col.balDays] != null && row[col.balDays] !== "" ? Math.round(toNum(row[col.balDays])) : null,
      ph: phase,
      mw: Math.round(bq * unitWt * 10) / 10,
      mb, ms,
      ot: col.otype >= 0 ? norm(row[col.otype]) : "",
      sr,
      st: col.style >= 0 ? norm(row[col.style]) : "",
      due: dDate ? ymd(dDate) : "",
    });
  }

  if (!rows.length) throw new Error("No order lines found (no rows with an Order SrNo below the header).");

  // Snapshot ("as of") date: BalDelvDays is measured from the date the report was pulled,
  // so  asOf = Prd Delv Dt - BalDelvDays.  Take the most common value across all lines.
  const tally = {};
  for (let r = hIdx + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    if (!norm(col.srno >= 0 ? row[col.srno] : "")) continue;
    const dd = col.delv >= 0 ? toDate(row[col.delv]) : null;
    const bdv = col.balDays >= 0 ? row[col.balDays] : null;
    if (!dd || bdv == null || bdv === "") continue;
    const ref = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate() - Math.round(toNum(bdv)));
    const key = ymd(ref);
    tally[key] = (tally[key] || 0) + 1;
  }
  let asOf = null, bestN = 0;
  for (const [k2, n2] of Object.entries(tally)) if (n2 > bestN) { bestN = n2; asOf = k2; }

  const meta = { sheetName, headerRow: hIdx + 1, totalLines: rows.length,
    castingStagesFound: castIdx.length, asOf, asOfLines: bestN, missing };
  return { rows, meta };
}
