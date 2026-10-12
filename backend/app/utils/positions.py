POSITION_STEP = 1024.0
MIN_POSITION_GAP = 1e-6


def position_between(previous: float | None, following: float | None) -> float:
    if previous is None and following is None:
        return POSITION_STEP
    if previous is None:
        assert following is not None
        return following - POSITION_STEP
    if following is None:
        return previous + POSITION_STEP
    return (previous + following) / 2


def needs_rebalance(previous: float | None, following: float | None) -> bool:
    if previous is None or following is None:
        return False
    return following - previous < MIN_POSITION_GAP
