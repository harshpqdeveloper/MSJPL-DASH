# Production &amp; Casting Dashboard — KPI Documentation
**M Suresh Jewellery** · prepared for customer demo
Source file: `Book5.xlsx` · Sheet1 · header on row 2 · **1,841 order lines**
**Snapshot ("as of") date: 07-Jul-2026** — see note at the end.

---

## 0. How the dashboard reads the data

Every row that has an **Order SrNo (Column C)** is treated as one *order line*. All KPIs are
sums or counts across those lines, and every KPI recalculates automatically when the
**Party**, **Metal** or **Category** filter is changed.

**Key source columns**

| Excel column | Header | Used for |
|---|---|---|
| C | Order SrNo | Identifies a valid order line |
| A | Party | Customer / party filter |
| L | Prd Delv Dt | Production delivery date → Month buckets, Due Date |
| M | BalDelvDays | Days remaining/overdue vs snapshot date |
| S | Karat | **Metal** (G→Gold, P→Platinum, S→Silver) |
| T | Category | Product type (Rings, Earrings…) |
| Y | Order Qty | Original ordered quantity |
| Z | Unit Metal PureWt | Unit weight (per piece, pure metal) |
| AB | **Exp Bal Qty** | **Export Quantity** |
| AC | Bal Qty | Balance quantity still to complete |
| AD | Floor Qty | Pieces physically on the shop floor |
| AE : AM | SO, PMDR, PWAX-A/B, PWAX, PWXST, PWBGD, PWBGD-LGD, PTRI | Early stages → Casting pcs |
| AN | (computed) | **Casting pcs** = SUM(AE:AM) |
| AO | (computed) | **Casting weight** = Z × AN |

**Metal rule (Column S only):** if the Karat value contains **G/g** → Gold; else **P/p** →
Platinum; else **S/s** → Silver. Column T (Karat_Type) is no longer used.
Result: Gold 1,589 lines · Platinum 153 · Silver 99.

---

## 1. KPI reference table

| KPI Block Name | Meaning | Business Significance | Calculation Formula (based on the Excel data) |
|---|---|---|---|
| **Export Quantity** | Total quantity earmarked for export/delivery against open orders. | Headline order book — tells management the size of the commitment still to be met. | `SUM(Column AB "Exp Bal Qty")` over all filtered lines. **= 59,185 pcs** |
| *(sub-line)* Lines | Number of open order lines in the current view. | Shows how fragmented the workload is — many small lines cost more to manage than few large ones. | `COUNT(rows with Column C "Order SrNo")` **= 1,841 lines** |
| *(sub-line)* On floor | Pieces physically present on the production floor. | Distinguishes work actually in the factory from work not yet released. | `SUM(Column AD "Floor Qty")` **= 55,062 pcs** |
| **Casting pcs** | Pieces sitting in the front end of production: order booked → wax → tree, i.e. waiting to be cast. | Drives the casting schedule — this is what the foundry must plan for. Also an early-warning of load building up before casting. | `SUM(Column AN)` where `AN = SUM(AE:AM)` = SO + PMDR + PWAX-A + PWAX-B + PWAX + PWXST + PWBGD + PWBGD-LGD + PTRI. **= 32,837 pcs** |
| **Overdue %** | Share of dated order lines that are already past their delivery date. | The single most important delivery-performance measure. Directly affects customer trust and penalties. | `COUNT(lines where Column M "BalDelvDays" < 0) ÷ COUNT(lines where Column M is not blank) × 100`. = 1,066 ÷ 1,795 **= 59%** |
| *(sub-line)* Pcs late | Quantity of pieces that are overdue. | Converts late *jobs* into late *pieces* — shows the true volume at risk. | `SUM(Column AC "Bal Qty") WHERE Column M < 0` **= 18,287 pcs** |
| **Casting Weight — Gold** | Pure gold weight that must be cast for pieces in the wax/tree stages. | Tells the metal department exactly how much gold to issue; controls metal procurement and working capital. | `SUM(Column AO) WHERE metal = Gold`, where `AO = Column Z × Column AN`. **= 35,897.35 g (35.90 kg)** |
| **Casting Weight — Silver** | Pure silver weight to be cast. | Same as above, for silver — separates cheap-metal volume from precious-metal value. | `SUM(Column AO) WHERE metal = Silver` **= 33,216.64 g (33.22 kg)** |
| **Casting Weight — Platinum** | Pure platinum weight to be cast. | Platinum is the highest-value metal; even small weights carry large cost. | `SUM(Column AO) WHERE metal = Platinum` **= 686.27 g (0.69 kg)** |
| **Casting Plan — Month × Metal** | For each delivery month, the Balance qty, Casting pcs and Casting weight, split by Gold/Silver/Platinum, with month totals and a grand total. | The core planning table — tells management *what must be cast, in which metal, in which month*. Mirrors the customer's own Excel report. | Group filtered lines by **month of Column L** and **metal from Column S**, then `SUM(AC)`, `SUM(AN)`, `SUM(AO)` in each group. July is split at the 15th. |
| **Production Funnel** | Balance pieces sitting at each stage of production, shown in real process sequence, with the largest active stage flagged as **BOTTLENECK**. | Instantly shows where work is piling up, so supervisors know which department to reinforce today. | Each line is assigned to the macro-stage holding most of its pieces (Order booked → Design/Wax → Tree/Casting → Filing → Setting → Polishing → Rhodium → QC → Rework/Hold → Reject). Then `SUM(Column AC)` per stage. Bottleneck = largest stage excluding "Order booked". |
| **Delivery Aging** | Balance pieces grouped into four delivery-status buckets: Late >7d, Late 1-7d, Due 0-7d, Due >7d. | Separates "already failed" from "about to fail" — lets management fire-fight the next 7 days instead of reacting after the fact. | Bucket by **Column M (BalDelvDays)**: `< -7` → Late >7d; `-7 to -1` → Late 1-7d; `0 to 7` → Due 0-7d; `> 7` → Due >7d. Bar height = `SUM(Column AC "Bal Qty")` in each bucket. |
| **Balance by Party** | Top 10 parties by balance quantity, each split into on-track vs overdue pieces. | Shows customer concentration and which specific customer is most exposed to late delivery. | Group by **Column A (Party)**; `On track = SUM(AC) WHERE M ≥ 0`, `Overdue = SUM(AC) WHERE M < 0`. Sorted by total, top 10. |
| **Product Mix** | Balance quantity split by product category (Rings, Earrings, Pendants, Bracelets, Bangles, Necklaces). | Shows what the factory is mainly making, which drives labour and machine planning. | Group by **Column T (Category)**; `SUM(Column AC "Bal Qty")`. |
| **Most Overdue Orders** | The 12 worst-delayed order lines, with Order no., Party, Category, Metal, Style, **Due date**, Balance qty, **Days late** and current stage. | The action list — management can chase these specific jobs immediately. | Filter `Column M < 0`, sort ascending (most negative first), take 12. **Due date = Column L (Prd Delv Dt)**; **Days late = ABS(Column M)**. |

---

## 2. Delivery Aging — logic explained (Question 3)

The aging chart answers: *"of everything still to be delivered, how much is late and how much
is about to become late?"*

1. For every order line the dashboard reads **Column M (BalDelvDays)**. This value is supplied
   by your ERP and represents **delivery date minus the snapshot date**:
   - **Negative** = the delivery date has already passed (overdue).
   - **Zero or positive** = days still remaining until delivery.
2. Each line is placed into one of four buckets:

   | Bucket | Condition on BalDelvDays | Meaning | Balance qty |
   |---|---|---|---|
   | **Late >7d** | `< -7` | More than a week overdue — serious | **15,910** |
   | **Late 1-7d** | `-7` to `-1` | Recently overdue — recoverable | **2,377** |
   | **Due 0-7d** | `0` to `7` | Due within a week — act now | **2,823** |
   | **Due >7d** | `> 7` | Comfortable | **37,928** |
   | *(excluded)* | blank | No delivery date recorded — 46 lines | *177* |

3. The bar height is the **sum of Balance Qty (Column AC)** in that bucket — so it shows
   *pieces*, not number of orders.
4. Lines with no delivery date are excluded from the chart (they cannot be aged).

**Why pieces and not orders:** one order line can be 500 pieces or 1 piece. Management cares
about the volume at risk, so aging is measured in pieces.

---

## 3. Most Overdue Orders — which date (Question 4)

- The **Due date** column is taken directly from **Column L, `Prd Delv Dt`** (the production
  delivery date committed for that order line). Nothing is calculated — it is shown as-is.
- The **Days late** badge is `ABS(Column M "BalDelvDays")`, i.e. how many days past that
  delivery date the line already is.

**Important — the "as of" date.** BalDelvDays is *not* recalculated against today's date; it is
the value your ERP wrote when the file was exported. Working backwards
(`Prd Delv Dt − BalDelvDays`) gives a single consistent date across all 1,795 dated lines:

> **07-Jul-2026** — the snapshot date of this file.

So every "overdue" and "days late" figure means *as at 07-Jul-2026*. The dashboard now
displays **"Data as of 07-Jul-2026"** next to the file name, and on the Aging and Most
Overdue panels, so this is never ambiguous during the demo. When a fresher export is loaded,
the date updates automatically.

*Talking point for the customer:* if they want ageing measured against **today's real date**
instead of the export date, that is a small change — but then the numbers will drift each day
even for the same file, so most factories prefer the snapshot approach used here.

---

## 4. Notes & assumptions worth stating in the demo

- **Export Quantity uses Column AB (`Exp Bal Qty`) = 59,185 pcs.** The original ordered
  quantity (Column Y `Order Qty` = 60,919) is no longer displayed. Confirm the customer wants
  AB, since the two differ by 1,734 pcs.
- **Casting pcs / weight only cover the wax–tree stages (AE:AM).** Pieces already cast and
  moving through setting/polishing are *not* included — by design, since casting is already done
  for them.
- **Metal comes only from the Karat code (Column S).** Column T (Karat_Type) is ignored because
  it was blank on ~80% of rows in the source file.
- **Overdue % counts lines; "pcs late" counts pieces.** They are deliberately different
  measures and will not be the same percentage.
- **July is split at the 15th** in the casting plan, to match the customer's own report format.
