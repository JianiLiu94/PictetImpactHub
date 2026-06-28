from app.models import BiodiversityImpact, Company, Holding, Portfolio, SocialImpact


def test_models_create_tables(db_session):
    company = Company(ticker="ABC", company_name="ABC Corp", isin="US0000000000")
    db_session.add(company)
    db_session.commit()

    fetched = db_session.query(Company).filter_by(ticker="ABC").one()
    assert fetched.company_name == "ABC Corp"
