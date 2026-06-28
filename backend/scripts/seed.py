import os
import sys
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import Base, SessionLocal, engine
from app.models import BiodiversityImpact, Company, Holding, Portfolio, SocialImpact

DATA_DIR = Path(__file__).resolve().parents[2] / "assignmentInput"


def _read_csv(filename: str) -> pd.DataFrame:
    path = DATA_DIR / filename
    df = pd.read_csv(path)
    before = len(df)
    df = df.dropna(how="all")
    skipped = before - len(df)
    if skipped:
        print(f"{filename}: skipped {skipped} fully-empty rows")
    return df


def seed_companies(db: Session) -> None:
    fin = _read_csv("financial_data.csv")
    bad_rows = 0
    for _, row in fin.iterrows():
        if pd.isna(row.get("ticker")) or pd.isna(row.get("isin")):
            bad_rows += 1
            continue
        db.merge(
            Company(
                ticker=str(row["ticker"]),
                company_name=row.get("company_name", ""),
                isin=row["isin"],
                market_cap_usd_m=row.get("market_cap_usd_m"),
                sales_usd_m=row.get("sales_usd_m"),
            )
        )
    db.commit()
    print(f"companies: seeded {len(fin) - bad_rows}, skipped {bad_rows}")


def seed_portfolios_and_holdings(db: Session) -> None:
    holdings = _read_csv("port_holdings_combined_assumed.csv")
    portfolio_names = holdings["portfolio"].dropna().unique().tolist()
    name_to_id = {}
    for name in portfolio_names:
        portfolio = db.merge(Portfolio(name=name))
        db.flush()
        name_to_id[name] = portfolio.id
    db.commit()

    bad_rows = 0
    for _, row in holdings.iterrows():
        if pd.isna(row.get("ticker")) or pd.isna(row.get("portfolio")):
            bad_rows += 1
            continue
        db.add(
            Holding(
                portfolio_id=name_to_id[row["portfolio"]],
                ticker=str(row["ticker"]),
                cusip=row.get("cusip"),
                sedol=row.get("sedol"),
                pct_of_fund=row["pct_of_fund"],
                shares=row.get("shares"),
                market_value=row.get("market_value"),
            )
        )
    db.commit()
    print(f"holdings: seeded {len(holdings) - bad_rows}, skipped {bad_rows}")


def seed_social_impact(db: Session) -> None:
    social = _read_csv("social_impact_model_output_assumed.csv")
    bad_rows = 0
    for _, row in social.iterrows():
        if pd.isna(row.get("ticker")):
            bad_rows += 1
            continue
        db.add(
            SocialImpact(
                ticker=str(row["ticker"]),
                scope=row["scope"],
                category=row["category"],
                stakeholder=row["stakeholder"],
                wellby_per_dollar=row["wellby_per_dollar"],
                wellby_abs=row["wellby_abs"],
            )
        )
    db.commit()
    print(f"social_impact: seeded {len(social) - bad_rows}, skipped {bad_rows}")


def seed_biodiversity_impact(db: Session) -> None:
    bio = _read_csv("biodiversity_model_output.csv")
    bad_rows = 0
    for _, row in bio.iterrows():
        if pd.isna(row.get("ticker")):
            bad_rows += 1
            continue
        db.add(
            BiodiversityImpact(
                ticker=str(row["ticker"]),
                scope=row["scope"],
                category=row["category"],
                value=row["value"],
            )
        )
    db.commit()
    print(f"biodiversity_impact: seeded {len(bio) - bad_rows}, skipped {bad_rows}")


def main() -> None:
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        for table in [BiodiversityImpact, SocialImpact, Holding, Portfolio, Company]:
            db.query(table).delete()
        db.commit()

        seed_companies(db)
        seed_portfolios_and_holdings(db)
        seed_social_impact(db)
        seed_biodiversity_impact(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
