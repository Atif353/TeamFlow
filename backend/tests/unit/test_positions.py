from app.utils.positions import (
    MIN_POSITION_GAP,
    POSITION_STEP,
    needs_rebalance,
    position_between,
)


def test_empty_column_gets_first_step() -> None:
    assert position_between(None, None) == POSITION_STEP


def test_append_and_prepend_use_step() -> None:
    assert position_between(2048.0, None) == 2048.0 + POSITION_STEP
    assert position_between(None, 1024.0) == 1024.0 - POSITION_STEP


def test_between_is_midpoint() -> None:
    assert position_between(1024.0, 2048.0) == 1536.0


def test_rebalance_needed_only_when_gap_collapses() -> None:
    assert needs_rebalance(1.0, 1.0 + MIN_POSITION_GAP / 2)
    assert not needs_rebalance(1.0, 2.0)
    assert not needs_rebalance(None, 2.0)
    assert not needs_rebalance(1.0, None)
