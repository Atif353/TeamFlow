from app.utils.mentions import extract_mentioned_ids

MEMBERS = [(1, "Ann"), (2, "Ann Lee"), (3, "Bob"), (4, "Zoë Q")]


def test_extracts_each_mentioned_member_once() -> None:
    assert sorted(extract_mentioned_ids("@Bob and @bob again", MEMBERS)) == [3]


def test_longest_name_wins_over_prefix_name() -> None:
    assert extract_mentioned_ids("ping @Ann Lee now", MEMBERS) == [2]


def test_prefix_name_still_matches_when_alone() -> None:
    assert extract_mentioned_ids("hello @Ann.", MEMBERS) == [1]


def test_requires_at_sign_and_word_boundary() -> None:
    assert extract_mentioned_ids("Bob said hi, email a@Bobby.com", MEMBERS) == []
    assert extract_mentioned_ids("@Bobby", MEMBERS) == []


def test_handles_regex_characters_and_unicode() -> None:
    assert extract_mentioned_ids("cc @Zoë Q please", MEMBERS) == [4]
    assert extract_mentioned_ids("@.*", MEMBERS) == []


def test_no_members_returns_empty() -> None:
    assert extract_mentioned_ids("@Bob", []) == []
