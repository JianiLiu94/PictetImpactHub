import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ImpactGrid } from "../components/ImpactGrid";
import { ScoreToggle } from "../components/ScoreToggle";
import { Avatar } from "../components/Avatar";
import { ArrowLeftIcon } from "../components/Icon";
import { formatAmount, humanizeLabel } from "../format";
import type { CompanyDetail as CompanyDetailType, ScoreOut } from "../types";

export function CompanyDetail() {
  const { ticker } = useParams<{ ticker: string }>();

  const [company, setCompany] = useState<CompanyDetailType | null>(null);
  const [scores, setScores] = useState<ScoreOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) return;
    api.getCompany(ticker).then(setCompany).catch(() => setError("Company not found"));
    api.getScores("company").then((page) => setScores(page.items)).catch(() => setError("Failed to load scores"));
  }, [ticker]);

  if (error) return <div className="error-text">{error}</div>;
  if (!company) return <div className="muted">Loading...</div>;

  const ownScore = scores.filter((s) => s.entity_id === ticker);

  const stakeholders = Array.from(
    new Set(company.social_grid.map((c) => c.stakeholder).filter((s): s is string => s !== null))
  );

  return (
    <div className="content--narrow">
      <Link to="/companies" className="breadcrumb">
        <ArrowLeftIcon /> Companies
      </Link>

      <div className="entity-header">
        <Avatar name={company.company_name} size="lg" />
        <div>
          <div className="entity-header__title">
            <h1 className="page-title" style={{ marginBottom: 0 }}>
              {company.company_name}
            </h1>
            <span className="mono muted" style={{ fontSize: 12 }}>
              {company.ticker} &middot; {company.isin}
            </span>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>
            Market cap {company.market_cap_usd_m !== null ? `$${formatAmount(company.market_cap_usd_m)}M` : "-"}
            {" "}&middot; Revenue {company.sales_usd_m !== null ? `$${formatAmount(company.sales_usd_m)}M` : "-"}
          </p>
        </div>
      </div>

      <section style={{ marginTop: 18 }}>
        <h2 className="tone-social">Social &middot; WELLBY by stakeholder</h2>
        <div className="card-grid" style={{ gridTemplateColumns: "1fr" }}>
          {stakeholders.map((s) => (
            <div key={s} className="card">
              <div className="split-ledger__label tone-social" style={{ marginBottom: 10 }}>
                {humanizeLabel(s)}
              </div>
              <ImpactGrid
                cells={company.social_grid.filter((c) => c.stakeholder === s)}
                rowKeyField="scope"
                colKeyField="category"
                tone="social"
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="tone-bio">Biodiversity &middot; PDF&middot;yr</h2>
        <div className="card">
          <ImpactGrid cells={company.biodiversity_grid} rowKeyField="scope" colKeyField="category" tone="bio" />
        </div>
      </section>

      <section>
        <h2>Composite score</h2>
        <ScoreToggle scores={ownScore} />
      </section>
    </div>
  );
}
