import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Metric logic (validated against Book5.xlsx):
//   Casting pcs (col AN) = sum of stages AE:AM  (SO..PTRI)
//   Casting wt  (col AO) = UnitWeight (col Z) x Casting pcs
//   Metal  = derived ONLY from Karat (col S):
//            contains G/g -> Gold, else P/p -> Platinum, else S/s -> Silver
//   Month  = production delivery date (Prd Delv Dt, col L)
//   Production Funnel = the sheet's OWN pre-computed column totals, one row above
//            the header row (see FUNNEL_MAPPING below), not summed from order lines.
// Header row is auto-detected. Dates are converted via UTC to avoid the
// SheetJS/timezone bug that reads Excel dates one day early.
// ---------------------------------------------------------------------------

// Dashboard shows only order lines whose Prd Delv Dt falls in this year — the same
// column already driving month buckets, due dates and the casting plan grouping
// (see KPI_DOCUMENTATION.md). Change this single constant to show a different year.
const TARGET_YEAR = 2026;

const CAST_STAGES = ["SO","PMDR","PWAX-A","PWAX-B","PWAX","PWXST","PWBGD","PWBGD-LGD","PTRI"];

// Production Funnel mapping (per-column, supplied manually). Each header's value is
// read from the source workbook's own totals row (the row directly above the stage
// codes), matched by code name — not summed from individual order lines. See
// buildFunnel() below for the matching logic.
// NOTE: "Rhodium" is matched against "JRHD" (the sheet's actual column name) — the
// originally supplied code list said "JRH", which doesn't exist as a column.
const FUNNEL_MAPPING = [
  { name: "New Order", codes: ["SO"] },
  { name: "Model Pending", codes: ["PMDR"] },
  { name: "Wax", codes: ["PWAX-A","PWAX-B","PWAX"] },
  { name: "PWXST", codes: ["PWXST"] },
  { name: "PWBGD", codes: ["PWBGD","PWBGD-LGD"] },
  { name: "PTRI", codes: ["JTRI","PTRI"] },
  { name: "Filing", codes: ["PCAST","JCAST","JSPGR","JTMLG","PTMLG","PSPGR","PGPG","PFIL-B","PFIL-D","JFIL","P1SFIL"] },
  { name: "Finding Balance", codes: ["P1FNDBL"] },
  { name: "Pre Polish", codes: ["PPRPOL"] },
  { name: "Setting", codes: ["PSET","JSET","JSHDSET","PMSET-C","PMSET","PMSET-A","PMSET-B"] },
  { name: "MSHDSET", codes: ["MSHDSET"] },
  { name: "Polish", codes: ["PPOLCL-1","PPOLCL-2","PPOLCL-3","PPOLCL-4","PPOL","JPRPOL","JPOL","PPOLCL-5"] },
  { name: "Rhodium", codes: ["JRHD","PRHD","PRHD-A"] },
  { name: "Final QC", codes: ["PQC"] },
  { name: "Third Party QC", codes: ["PTPQC","PTPQC-A","JTPQC","SHP1"] },
  { name: "Sampling", codes: ["S1FIL","S1MSET","S1POL","S2FIL","S2SET","S2POL","S2FQC","SHP2"] },
  { name: "Rejection", codes: ["PREJ"] },
  { name: "Adi Nath", codes: ["ADI-SCSD","ADI-RDSET","ADI-PTPFIL","ADI-PFIL","ADI-PPRPOL","ADI-PTPSET","ADI-SET","ADI-PPOL","ADI-PTPPOL","ADI-HOLD","ADI-JBOUT"] },
  { name: "Others", codes: ["Others"] },
  { name: "Job Work", codes: ["PJBW","PJBW-A"] },
  { name: "Ready for GSI", codes: ["PPLT","SHP4"] },
  { name: "GSI Rejection", codes: ["GSI-REJ"] },
  { name: "IN GSI", codes: ["PCELL","SHP3"] },
  { name: "Finish Goods", codes: ["FG"] },
  { name: "RGTS", codes: ["RGTS"] },
];

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
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); // 2026-08-18[T10:30:25]
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  // Day-first "DD/MM/YYYY" or "DD-MM-YYYY", optionally followed by a time (e.g. 18/08/2026 10:30:25).
  // JS's generic Date parser treats slash dates as MM/DD/YYYY (US order), which silently misreads
  // day-first exports, so this is matched explicitly before falling back to new Date(s).
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[\sT]|$)/);
  if (dmy) {
    let [, dd, mm, yy] = dmy;
    dd = +dd; mm = +mm; yy = +yy;
    if (yy < 100) yy += yy < 70 ? 2000 : 1900;
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) return new Date(yy, mm - 1, dd);
  }
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

// Builds the Production Funnel values from the workbook's own totals row: `header`
// (Row 2 — the stage codes) is matched case-insensitively, whole-string only, against
// each mapping's code list; the matching value is read from `totalsRow` (Row 1, the
// row immediately above) at that same column. Column position is never assumed —
// only the header text. Multiple codes per bucket, and multiple columns sharing the
// same code, are summed. A code with no matching column contributes 0, never throws.
function buildFunnel(header, totalsRow) {
  const codeToCols = {};
  header.forEach((h, i) => {
    const key = lc(h);
    if (!key) return;
    (codeToCols[key] = codeToCols[key] || []).push(i);
  });

  return FUNNEL_MAPPING.map(({ name, codes }) => {
    let qty = 0;
    for (const code of codes) {
      const cols = codeToCols[lc(code)] || [];
      for (const ci of cols) qty += toNum(totalsRow[ci]);
    }
    return { name, qty: Math.round(qty) };
  });
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
  // Row 1 (directly above the header row) holds the sheet's own pre-computed column
  // totals — this is what the Production Funnel is built from, not the order lines.
  const totalsRow = aoa[hIdx - 1] || [];
  const funnel = buildFunnel(header, totalsRow);

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

  if (col.delv < 0) throw new Error("Prd Delv Dt column could not be found in the Jemmy Excel file.");

  const missing = [];
  if (col.srno < 0) missing.push("Order SrNo");
  if (col.balQty < 0) missing.push("Bal Qty");
  if (col.karat < 0) missing.push("Karat");
  if (col.unitWt < 0) missing.push("Unit Metal PureWt / UnitWeight");
  if (castIdx.length === 0) missing.push("Casting stages (SO..PTRI)");

  const rows = [];
  let linesAnyYear = 0;
  for (let r = hIdx + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const sr = norm(col.srno >= 0 ? row[col.srno] : "");
    if (!sr) continue;
    linesAnyYear++;

    const dDate = col.delv >= 0 ? toDate(row[col.delv]) : null;
    if (!dDate || dDate.getFullYear() !== TARGET_YEAR) continue; // outside the target year

    const karat = col.karat >= 0 ? norm(row[col.karat]) : "";
    const unitWt = col.unitWt >= 0 ? toNum(row[col.unitWt]) : 0;
    const bq = col.balQty >= 0 ? toNum(row[col.balQty]) : 0;

    let cp = 0;
    for (const ci of castIdx) cp += toNum(row[ci]);
    const cw = Math.round(unitWt * cp * 100) / 100;

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
      d: col.balDays >= 0 && row[col.balDays] != null && row[col.balDays] !== "" ? Math.round(toNum(row[col.balDays])) : null,
      mw: Math.round(bq * unitWt * 10) / 10,
      mb, ms,
      ot: col.otype >= 0 ? norm(row[col.otype]) : "",
      sr,
      st: col.style >= 0 ? norm(row[col.style]) : "",
      due: dDate ? ymd(dDate) : "",
    });
  }

  if (!rows.length) {
    if (linesAnyYear > 0) {
      throw new Error(`No order lines found for ${TARGET_YEAR} (the file has ${linesAnyYear} lines, but none with a Prd Delv Dt in ${TARGET_YEAR}).`);
    }
    throw new Error("No order lines found (no rows with an Order SrNo below the header).");
  }

  // Snapshot ("as of") date: BalDelvDays is measured from the date the report was pulled,
  // so  asOf = Prd Delv Dt - BalDelvDays.  Take the most common value across all lines
  // within the target year (matches the rows actually shown on the dashboard).
  const tally = {};
  for (let r = hIdx + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    if (!norm(col.srno >= 0 ? row[col.srno] : "")) continue;
    const dd = col.delv >= 0 ? toDate(row[col.delv]) : null;
    if (!dd || dd.getFullYear() !== TARGET_YEAR) continue;
    const bdv = col.balDays >= 0 ? row[col.balDays] : null;
    if (!dd || bdv == null || bdv === "") continue;
    const ref = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate() - Math.round(toNum(bdv)));
    const key = ymd(ref);
    tally[key] = (tally[key] || 0) + 1;
  }
  let asOf = null, bestN = 0;
  for (const [k2, n2] of Object.entries(tally)) if (n2 > bestN) { bestN = n2; asOf = k2; }

  const meta = { sheetName, headerRow: hIdx + 1, totalLines: rows.length,
    castingStagesFound: castIdx.length, asOf, asOfLines: bestN, missing,
    dateColumn: "Prd Delv Dt", targetYear: TARGET_YEAR,
    linesAnyYear, linesIgnored: linesAnyYear - rows.length };
  return { rows, meta, funnel };
}
