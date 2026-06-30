import { useRef, useState } from "react";
import { api } from "../api/client";
import { formatNum } from "../format";
import type { CustomHoldingIn, CustomPortfolioResult } from "../types";

interface ParsedCsv {
  holdings: CustomHoldingIn[];
  parseErrors: string[];
}

/** Parses "isin,weight" rows, tolerating an optional header row and blank lines. */
function parseCsv(text: string): ParsedCsv {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const holdings: CustomHoldingIn[] = [];
  const parseErrors: string[] = [];

  lines.forEach((line, index) => {
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length < 2) {
      parseErrors.push(`Line ${index + 1}: expected "isin,weight", got "${line}"`);
      return;
    }
    const [isin, weightRaw] = parts;
    const weight = Number(weightRaw);
    if (index === 0 && (Number.isNaN(weight) || isin.toLowerCase() === "isin")) {
      return; // header row
    }
    if (!isin) {
      parseErrors.push(`Line ${index + 1}: missing ISIN`);
      return;
    }
    if (Number.isNaN(weight)) {
      parseErrors.push(`Line ${index + 1}: "${weightRaw}" is not a valid weight`);
      return;
    }
    holdings.push({ isin, weight });
  });

  return { holdings, parseErrors };
}

const SAMPLE_CSV = `isin,weight
US14448C1045,10
JP3102000001,15
SG1U68934629,8
JP3142500002,12
DE0006602006,9
US21874C1027,11
US11135F1012,13
AU000000WES1,7
AU000000BHP4,8
DK0010219153,7`.trim();

export function BuildPortfolio() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState(SAMPLE_CSV);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [result, setResult] = useState<CustomPortfolioResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
  };

  const handleSubmit = async () => {
    setError(null);
    setResult(null);

    const { holdings, parseErrors: errs } = parseCsv(csvText);
    setParseErrors(errs);
    if (holdings.length === 0) {
      setError("No valid isin,weight rows found.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.buildCustomPortfolio(holdings);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to build portfolio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content--narrow">
      <h1 className="page-title">Custom portfolio</h1>
      <p className="page-sub">
        Upload a CSV of <code>isin,weight</code> rows (an optional header row is fine) to compute
        that portfolio&apos;s score and raw impact. ISINs not in our universe are reported, not
        silently dropped &mdash; weights are renormalized across the ISINs that do match.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <button className="toggle-btn" onClick={() => fileInputRef.current?.click()}>
            Choose CSV file
          </button>
          {fileName && <span className="muted" style={{ fontSize: 12 }}>{fileName}</span>}
        </div>

        <p className="muted" style={{ fontSize: 11, marginBottom: 6 }}>
          Or paste CSV rows directly (pre-filled with a sample of 10 real holdings):
        </p>
        <textarea
          className="autocomplete__input"
          style={{ width: "100%", minHeight: 140, fontFamily: "var(--font-mono)", fontSize: 12.5 }}
          placeholder={"isin,weight\nUS0000000000,60\nUS0000000001,40"}
          value={csvText}
          onChange={(e) => {
            setCsvText(e.target.value);
            setFileName(null);
          }}
        />

        <button
          className="toggle-btn is-active"
          style={{ marginTop: 12 }}
          onClick={handleSubmit}
          disabled={loading || csvText.trim() === ""}
        >
          {loading ? "Computing..." : "Compute score & impact"}
        </button>
      </div>

      {parseErrors.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--bio)" }}>
          <div className="tone-bio" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            {parseErrors.length} row(s) could not be parsed and were skipped
          </div>
          <ul style={{ fontSize: 11.5, margin: 0, paddingLeft: 18 }}>
            {parseErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <div className="error-text" style={{ marginBottom: 16 }}>{error}</div>}

      {result && (
        <>
          {result.missing_isins.length > 0 && (
            <div className="card" style={{ marginBottom: 16, borderColor: "var(--bio)" }}>
              <div className="tone-bio" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                {result.missing_isins.length} ISIN(s) not found and excluded
              </div>
              <p className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>
                Remaining weights were renormalized across the {result.n_companies} matched
                holding(s) ({formatNum(result.matched_weight)} of {formatNum(result.total_weight_input)}{" "}
                input weight matched).
              </p>
              <div className="mono" style={{ fontSize: 11.5, wordBreak: "break-word" }}>
                {result.missing_isins.join(", ")}
              </div>
            </div>
          )}

          <div className="split-ledger" style={{ marginBottom: 24 }}>
            <div className="split-ledger__panel">
              <div className="split-ledger__label tone-social">Social score</div>
              <div className="split-ledger__value tone-social">{formatNum(result.social_score)}</div>
              <div className="tone-social" style={{ fontSize: 11, fontFamily: "var(--font-mono)", opacity: 0.75, marginTop: 4 }}>
                Social impact {result.impact.social_total_wellby.toExponential(2)} WELLBY
              </div>
            </div>
            <div className="split-ledger__panel">
              <div className="split-ledger__label tone-bio">Biodiversity score</div>
              <div className="split-ledger__value tone-bio">{formatNum(result.biodiversity_score)}</div>
              <div className="tone-bio" style={{ fontSize: 11, fontFamily: "var(--font-mono)", opacity: 0.75, marginTop: 4 }}>
                Biodiversity impact {result.impact.biodiversity_total_pdf_yr.toExponential(2)} PDF&middot;yr
              </div>
            </div>
          </div>

          <section>
            <h2>Matched holdings ({result.n_companies})</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ISIN</th>
                    <th>Company</th>
                    <th>Weight % (renormalized)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.holdings.map((h) => (
                    <tr key={h.isin}>
                      <td className="mono">{h.isin}</td>
                      <td>{h.company_name}</td>
                      <td className="num">{formatNum(h.pct_of_fund)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
