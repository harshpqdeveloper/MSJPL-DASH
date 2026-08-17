# M Suresh Jewellery — Production &amp; Casting Dashboard

A browser-based dashboard for jewellery WIP (work-in-progress) data. Drop the production
**XLSX** export into the project's `excel/` folder — any user on the company network who
opens the web page instantly sees:

- KPI cards: ordered, balance, **casting pcs**, **casting weight**, metal-at-risk, overdue %
- **Casting plan — month × metal** (Balance Qty · Casting pcs · Casting weight), like the customer's sheet
- **By metal** breakdown, with a toggle between **Column T (Karat_Type, as entered)** and **Karat code (complete)**
- Production **funnel** with automatic bottleneck detection
- **Delivery aging**, **balance by party**, **product mix**, and a **most-overdue orders** table
- Live **Party / Metal / Category** filters

**No upload step.** The dashboard automatically reads the most-recently-modified `.xlsx`/`.xls`
file inside `excel/` and reloads on its own (checks every few seconds) whenever that file is
replaced or a newer one is added — just overwrite the file to update the numbers.

**Privacy:** the Excel file is read on the same machine serving the dashboard, and parsed
inside the requesting browser. Nothing is uploaded to the internet. This matters for
sensitive jewellery/gold data.

---

## How the numbers are calculated (for reference)

- **Casting pcs** = sum of stage columns **AE:AM** (SO, PMDR, PWAX-A/B, PWAX, PWXST, PWBGD, PWBGD-LGD, PTRI) — this is column **AN**.
- **Casting weight** = **UnitWeight (col Z)** × **Casting pcs (AN)** — this is column **AO**.
- **Metal** — two modes: **Column T** (`Karat_Type`, exactly as typed; blank → "Unspecified"), or **Karat code** (G→Gold, P→Platinum, SL925→Silver; classifies every row).
- **Month** = production delivery date (`Prd Delv Dt`); July is split at the 15th.
- The header row is auto-detected (works whether headers are on row 1 or row 2).

---

## Prerequisites (install once on the server PC)

1. **Node.js LTS (v18 or newer)** — download from https://nodejs.org (Windows/Mac/Linux).
   Verify in a terminal / Command Prompt:
   ```
   node -v
   npm -v
   ```

---

## Option A — Quick start (recommended for a shop-floor server)

This builds an optimized production bundle and serves it (along with the small API that
reads `excel/`) so every user on the LAN can open it.

> Note: the dashboard needs its own tiny local API to find the latest Excel file, so it
> must be served with `npm run preview` (below) — a generic static-file server such as
> `npx serve` will **not** work, since it can't answer the `/api/excel/*` requests.

1. Unzip this project somewhere permanent, e.g. `C:\jewellery-dashboard`.
2. Open **Command Prompt / Terminal** in that folder.
3. Install and build:
   ```
   npm install
   npm run build
   ```
   This creates a `dist/` folder (a fast, minified static site).
4. Put the production WIP export into the `excel/` folder (create it if it isn't there),
   e.g. `excel/wip_export.xlsx`.
5. Serve the built app on the network (port 8080):
   ```
   npm run preview
   ```
   Leave this window open (or run it as a service — see below).

6. Find the server PC's LAN IP:
   - Windows: run `ipconfig` → look for **IPv4 Address** (e.g. `192.168.1.50`)
   - Mac/Linux: run `ifconfig` or `ip addr`

7. From **any PC/tablet on the same network**, open a browser to:
   ```
   http://192.168.1.50:8080
   ```
   (replace with your server's IP). The dashboard loads automatically — nothing to click.

---

## Option B — Run from source (easiest for testing / editing)

```
npm install
npm run dev
```
Vite prints a **Network** URL like `http://192.168.1.50:5173`. Share that with users on
the LAN. (Dev mode is fine for a few users; for many users prefer Option A.)

---

## Open the firewall (Windows server)

If other PCs can't reach the page, allow the port through Windows Firewall (run once, as Admin):
```
netsh advfirewall firewall add rule name="Jewellery Dashboard 8080" dir=in action=allow protocol=TCP localport=8080
```
(Use `5173` instead of `8080` if you're using Option B.)

---

## Keep it always running (so it survives reboots)

**Using PM2 (cross-platform, recommended):**
```
npm install -g pm2
pm2 start npm --name jewellery-dashboard -- run preview
pm2 save
pm2 startup      # follow the printed instruction so it auto-starts on boot
```
Manage it with `pm2 status`, `pm2 restart jewellery-dashboard`, `pm2 logs`.

**On Windows without PM2:** put `npm run preview` in a `.bat` file (run from the project
folder) and add it to **Task Scheduler** → "Run at startup".

---

## Remote access (users outside the shop network)

The app is a static site, so any of these work. Pick one:

1. **Company VPN (most secure):** users connect to the office VPN, then use the LAN URL
   (`http://192.168.1.50:8080`). Nothing else to configure.

2. **Cloudflare Tunnel (secure public URL, no port-forwarding):**
   ```
   npm install -g cloudflared        # or download cloudflared for Windows
   cloudflared tunnel --url http://localhost:8080
   ```
   It prints a public `https://<random>.trycloudflare.com` URL. For a permanent named
   tunnel with login protection, create a Cloudflare account and set up a named tunnel +
   Cloudflare Access (recommended if it's exposed to the internet).

3. **ngrok (quick temporary sharing):**
   ```
   ngrok http 8080
   ```
   Gives a temporary public URL. Good for demos; add auth for anything longer-term.

4. **Router port-forwarding:** only if you understand the security implications. Prefer a
   tunnel or VPN instead, and always put a login in front of it.

> Security note: this dashboard has no login of its own. If you expose it to the internet,
> put access control in front of it (Cloudflare Access, a VPN, or a reverse proxy with
> basic auth). On a trusted LAN, that isn't necessary.

---

## Updating the data

Just overwrite or add a file in `excel/` — no rebuild, no restart, nothing to click. The
dashboard polls every few seconds and picks up whichever `.xlsx`/`.xls` file in that folder
has the newest modification time. You can keep old exports there; only the newest is used.

## Updating the dashboard's code

Edit files in `src/` (visuals in `Dashboard.jsx`, parsing/formulas in `parseWorkbook.js`),
then `npm run build` again and restart `npm run preview`.

## Project structure

```
jewellery-dashboard/
├─ excel/                  put the WIP .xlsx/.xls export(s) here — newest file wins
├─ index.html              app entry
├─ package.json            dependencies & scripts
├─ vite.config.js          dev/preview server config (LAN host enabled)
├─ vite-excel-plugin.js    tiny local API that finds the latest file in excel/
├─ src/
│  ├─ main.jsx             React bootstrap
│  ├─ App.jsx              auto-loads the latest Excel file / loading / empty / error states
│  ├─ parseWorkbook.js     reads the XLSX and computes all metrics (AN, AO, metal, month, phase)
│  └─ Dashboard.jsx        the full dashboard UI
└─ dist/                   built static site (created by `npm run build`)
```

## Troubleshooting

- **"No Excel file found"** → make sure a `.xlsx` or `.xls` file exists directly inside the
  `excel/` folder (not a subfolder).
- **"Couldn't read that file"** → make sure it's the WIP export. The app looks for an
  `Order SrNo` column to locate the header row.
- **Casting shows 0 / "Missing columns" note** → the file doesn't contain the SO…PTRI stage
  columns (the older export started at PCAST). Use the newer export that includes wax/tree stages.
- **Metal split doesn't match Excel** → switch the "Metal grouped by" toggle. **Column T**
  matches an Excel filter on Karat_Type exactly (and shows blanks as *Unspecified*);
  **Karat code** classifies every line.
- **Other PCs can't open the URL** → check the firewall rule and that you used the server's
  LAN IP (not `localhost`).
- **Dashboard doesn't notice a replaced file** → wait a few seconds (it polls every 5s), and
  make sure the Excel app fully saved (closing an open lock file like `~$export.xlsx` can help).
