import os
from pathlib import Path

_repo_root = Path(__file__).resolve().parents[2]
_default_data_dir = _repo_root / "assignmentInput"

# Database
DATABASE_URL: str = os.environ.get(
    "DATABASE_URL",
    "postgresql://impact:impact@localhost:5432/impact",
)

# Seed data directory (parent folder that contains all CSV files)
SEED_DATA_DIR: Path = Path(os.environ.get("SEED_DATA_DIR", str(_default_data_dir)))

# Individual seed CSV filenames (override if your files have different names)
SEED_FILE_FINANCIAL: str = os.environ.get("SEED_FILE_FINANCIAL", "financial_data.csv")
SEED_FILE_HOLDINGS: str = os.environ.get("SEED_FILE_HOLDINGS", "port_holdings_combined.csv")
SEED_FILE_SOCIAL: str = os.environ.get("SEED_FILE_SOCIAL", "social_impact_model_output.csv")
SEED_FILE_BIODIVERSITY: str = os.environ.get("SEED_FILE_BIODIVERSITY", "biodiversity_model_output.csv")
