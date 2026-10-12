import hashlib

AVATAR_COLORS = [
    "#4F46E5",
    "#7C3AED",
    "#0369A1",
    "#047857",
    "#B45309",
    "#BE123C",
    "#0F766E",
    "#BE185D",
]


def avatar_color_for(seed: str) -> str:
    digest = hashlib.sha256(seed.lower().encode()).digest()
    return AVATAR_COLORS[digest[0] % len(AVATAR_COLORS)]
