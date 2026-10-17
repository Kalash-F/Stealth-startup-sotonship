"""Detect generic invoice descriptions ("Product ABC", "Goods as per contract").

Such lines must never reach the LLM: it would happily invent an HS6 code for them (plan 3.8).
A description is a placeholder when every word in it is generic filler, so "Bolts as per contract"
is not one but "Goods as per contract" is.
"""

from __future__ import annotations

import re

PLACEHOLDER_REASON = "description is a generic placeholder, so no commodity can be inferred"

_FILLER = frozenset(
    """
    product products item items good goods article articles material materials merchandise
    various misc miscellaneous assorted sundry general other others cargo commodity commodities
    stuff things sample samples as per contract proforma pro forma invoice order po pi agreement
    attached see the of to and for a an no number nos ref reference details description specified
    specification listed list na tbd tbc xyz abc xxx aaa
    """.split()
)
_TOKEN = re.compile(r"[a-z0-9]+")


def is_placeholder(description: str) -> bool:
    tokens = _TOKEN.findall(description.lower())
    if not tokens:
        return True
    for tok in tokens:
        if tok in _FILLER or tok.isdigit() or len(tok) == 1:
            continue
        return False
    return True
