import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Company


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    seed_db = TestSession()
    seed_db.add(Company(ticker="ABC", company_name="ABC Corp", isin="US0000000000",
                         market_cap_usd_m=100.0, sales_usd_m=50.0))
    seed_db.commit()
    seed_db.close()

    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_list_companies(client):
    response = client.get("/companies")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["ticker"] == "ABC"


def test_get_company_full_grid(client):
    response = client.get("/companies/ABC")
    assert response.status_code == 200
    body = response.json()
    assert len(body["social_grid"]) == 3 * 12 * 5
    assert len(body["biodiversity_grid"]) == 3 * 5
    assert all(cell["value"] is None for cell in body["social_grid"])


def test_get_company_404(client):
    response = client.get("/companies/NOPE")
    assert response.status_code == 404
