def percentile_scores(raw_values: dict[str, float]) -> dict[str, float]:
    """Map raw values to a 0-100 percentile rank within the given set.

    Ties receive the same score (average-rank percentile). A single-entity
    input returns 100.0 since there is nothing to rank it against.
    """
    if not raw_values:
        return {}

    keys = list(raw_values.keys())
    values = [raw_values[k] for k in keys]
    n = len(values)

    if n == 1:
        return {keys[0]: 100.0}

    sorted_values = sorted(values)

    def percentile_of(value: float) -> float:
        less = sum(1 for v in sorted_values if v < value)
        equal = sum(1 for v in sorted_values if v == value)
        rank = less + (equal - 1) / 2
        return round(rank / (n - 1) * 100, 4)

    return {k: percentile_of(raw_values[k]) for k in keys}
