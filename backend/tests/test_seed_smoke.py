import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy.orm import sessionmaker

from app.models import BiodiversityImpact, Company, Holding, SocialImpact

BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.mark.skipif(
    "DATABASE_URL" not in os.environ,
    reason="requires a live Postgres instance via DATABASE_URL (integration smoke test)",
)
def test_seed_script_loads_expected_row_counts():
    subprocess.run([sys.executable, str(BACKEND_DIR / "scripts" / "seed.py")], check=True)

    from app.database import engine as live_engine

    Session = sessionmaker(bind=live_engine)
    db = Session()
    try:
        assert db.query(Company).count() == 288
        assert db.query(Holding).count() == 311
        assert 3000 <= db.query(SocialImpact).count() <= 3300
        assert db.query(BiodiversityImpact).count() == 4320
    finally:
        db.close()
