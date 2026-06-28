from app.scoring import percentile_scores


def test_percentile_scores_orders_low_to_high():
    raw = {"A": 10.0, "B": 30.0, "C": 20.0}
    scores = percentile_scores(raw)

    assert scores["A"] < scores["C"] < scores["B"]
    assert all(0.0 <= v <= 100.0 for v in scores.values())


def test_percentile_scores_handles_ties():
    raw = {"A": 5.0, "B": 5.0, "C": 10.0}
    scores = percentile_scores(raw)

    assert scores["A"] == scores["B"]
    assert scores["C"] > scores["A"]


def test_percentile_scores_single_entity_returns_100():
    raw = {"A": 42.0}
    scores = percentile_scores(raw)

    assert scores["A"] == 100.0
