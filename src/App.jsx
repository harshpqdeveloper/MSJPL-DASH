
import React, { useState, useEffect, useRef, useCallback } from "react";
import { parseWorkbook } from "./parseWorkbook.js";
import Dashboard from "./Dashboard.jsx";
import MSJPLIntro from "./MSJPLIntro.jsx";
import logo from "./assets/logo.png";
import { C, GLOBAL_CSS } from "./theme.js";
import { IconFileWarning, IconInbox } from "./icons.jsx";
import { trackVisit } from "./analytics/trackVisit.js";

// How often to re-check the excel/ folder for a new or updated file once the
// dashboard is up. Cheap: it's just a small JSON status fetch unless the file
// actually changed, in which case the full workbook is re-fetched and re-parsed.
const POLL_MS = 5000;

export default function App() {
  const [data, setData] = useState(null);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("loading"); // loading | ready | not-found | error
  const [error, setError] = useState("");
  const [introDone, setIntroDone] = useState(false);
  const signatureRef = useRef(""); // `${fileName}:${mtimeMs}` of the currently-loaded file

  const loadLatest = useCallback(async () => {
    let metaRes, metaJson;
    try {
      metaRes = await fetch("/api/excel/meta", { cache: "no-store" });
      metaJson = await metaRes.json();
    } catch (e) {
      console.error(e);
      setError("Could not reach the local server to check the excel folder.");
      setStatus("error");
      return;
    }

    if (!metaRes.ok || !metaJson.found) {
      signatureRef.current = "";
      setData(null); setFileName(""); setError("");
      setStatus("not-found");
      return;
    }

    const signature = `${metaJson.fileName}:${metaJson.mtimeMs}`;
    if (signature === signatureRef.current) return; // nothing changed since last load

    try {
      const fileRes = await fetch("/api/excel/file", { cache: "no-store" });
      if (!fileRes.ok) {
        const body = await fileRes.json().catch(() => ({}));
        throw new Error(body.error || "Could not load the Excel file from the server.");
      }
      const buf = await fileRes.arrayBuffer();
      const parsed = parseWorkbook(buf);

      // eslint-disable-next-line no-console -- intentional: console-only verification, not shown in the UI
      console.info(
        `[Jemmy] Detected Excel file: ${metaJson.fileName}\n` +
        `[Jemmy] Total rows (with Order SrNo): ${parsed.meta.linesAnyYear}\n` +
        `[Jemmy] Date column used for year filter: ${parsed.meta.dateColumn}\n` +
        `[Jemmy] ${parsed.meta.targetYear} rows: ${parsed.meta.totalLines}\n` +
        `[Jemmy] Ignored non-${parsed.meta.targetYear} rows: ${parsed.meta.linesIgnored}`
      );

      signatureRef.current = signature;
      setData(parsed); setFileName(metaJson.fileName); setError("");
      setStatus("ready");
    } catch (e) {
      console.error(e);
      setError(e.message || "Could not read this file. Make sure it is the production WIP export.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    loadLatest();
    const id = setInterval(loadLatest, POLL_MS);
    return () => clearInterval(id);
  }, [loadLatest]);

  // Fires once per tab session (see trackVisit's own de-dupe guard) — this component only
  // ever mounts for the main dashboard route, never for /analytics itself.
  useEffect(() => {
    trackVisit();
  }, []);

  const intro = !introDone && (
    <MSJPLIntro ready={status !== "loading"} onFinish={() => setIntroDone(true)} />
  );

  if (status === "ready" && data) {
    return (
      <>
        {intro}
        <Dashboard rows={data.rows} meta={data.meta} funnel={data.funnel} fileName={fileName} onRefresh={loadLatest} />
      </>
    );
  }

  return (
    <>
      {intro}
      <div style={{
      minHeight: "100%", position: "relative", overflow: "hidden",
      background: `radial-gradient(1100px 520px at 12% -10%, rgba(124,58,237,.16), transparent 60%),
                   radial-gradient(900px 480px at 105% 10%, rgba(37,99,235,.14), transparent 55%),
                   ${C.bg}`,
      color: C.text, fontFamily: "'Inter',system-ui,sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <style>{GLOBAL_CSS}</style>

      <div className="animate-in" style={{ width: "100%", maxWidth: 560 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <img src={logo} alt="m.suresh" style={{ width: 260, maxWidth: "70%", height: "auto" }} />
        </div>
        <h1 style={{ margin: "0 0 8px", fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 32, textAlign: "center", color: C.text, letterSpacing: "-.01em" }}>
          Production &amp; Casting Dashboard
        </h1>
        <p style={{ color: C.mut, fontSize: 14, textAlign: "center", marginBottom: 28, lineHeight: 1.65, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
          Live production KPIs, the monthly casting plan by quantity, and bottlenecks — loaded automatically from the latest Excel file in the project's <code>excel</code> folder.
        </p>

        <div className="card" style={{
          padding: "50px 24px", textAlign: "center",
          background: C.panel, borderRadius: 20,
        }}>
          <div style={{
            width: 58, height: 58, borderRadius: 17, margin: "0 auto 16px",
            background: status === "error" ? "rgba(239,68,68,.12)" : "rgba(124,58,237,.12)",
            color: status === "error" ? "var(--danger-dk)" : "var(--primary-2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {status === "not-found" && <IconInbox width={24} height={24} />}
            {status === "error" && <IconFileWarning width={24} height={24} />}
          </div>

          {status === "not-found" && (
            <>
              <div style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 6, color: C.text }}>No Excel file found</div>
              <div style={{ fontSize: 12.5, color: C.faint }}>
                Please place an Excel file inside the <code>excel</code> folder. The dashboard will pick it up automatically.
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 6, color: C.text }}>Couldn't read that file</div>
              <div style={{ fontSize: 12.5, color: C.faint }}>{error}</div>
            </>
          )}
        </div>

        <div style={{ marginTop: 22, fontSize: 11.5, color: C.faint, lineHeight: 1.7, textAlign: "center" }}>
          Expected columns include Order SrNo, Party, Category, Karat (metal is derived from this), Prd Delv Dt, Bal Qty,
          Unit Metal PureWt, and the stage columns (SO, PWAX…, PTRI, PCAST … FG, SHP…). The header row is auto-detected.
        </div>
      </div>
      </div>
    </>
  );
}
