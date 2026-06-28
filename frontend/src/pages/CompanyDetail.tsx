import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { ImpactGrid } from "../components/ImpactGrid";
import { ScoreToggle } from "../components/ScoreToggle";
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

  if (error) return <div>{error}</div>;
  if (!company) return <div>Loading...</div>;

  const ownScore = scores.filter((s) => s.entity_id === ticker);

  return (
    <div>
      <h1>{company.company_name}</h1>
      <p>ISIN: {company.isin}</p>
      <p>Market cap: ${company.market_cap_usd_m?.toLocaleString() ?? "-"}M</p>
      <p>Revenue: ${company.sales_usd_m?.toLocaleString() ?? "-"}M</p>

      <h2>Social impact (scope x category)</h2>
      <ImpactGrid cells={company.social_grid} rowKeyField="scope" colKeyField="category" />

      <h2>Biodiversity impact (scope x category)</h2>
      <ImpactGrid cells={company.biodiversity_grid} rowKeyField="scope" colKeyField="category" />

      <h2>Composite score</h2>
      <ScoreToggle scores={ownScore.length > 0 ? scores : []} />
    </div>
  );
}
