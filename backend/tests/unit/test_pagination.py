from app.utils.pagination import PageParams


def test_skip_and_limit_follow_page() -> None:
    params = PageParams(page=3, page_size=25)

    assert params.skip == 50
    assert params.limit == 25


def test_first_page_has_no_skip() -> None:
    assert PageParams().skip == 0
