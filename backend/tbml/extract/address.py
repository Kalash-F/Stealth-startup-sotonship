"""Address type heuristics (plan.md 2.3). Returns None when the keywords are not decisive so the
caller can fall back to the LLM's answer (or `unknown`)."""

import re

from tbml.schemas import AddressType

_PO_BOX = re.compile(r"\bp\.?\s?o\.?\s?box\b|\bpost office box\b", re.I)
_RESIDENTIAL = re.compile(
    r"(?<!\w)(flat|apt|apartment|villa|bungalow|cottage|residence|residential|maisonette|"
    r"house|townhouse)(?!\w)",
    re.I,
)
_COMMERCIAL_ADDRESS = re.compile(
    r"(?<!\w)(unit|industrial estate|trading estate|business park|business centre|business center|"
    r"industrial park|warehouse|plot|office|suite|free zone|fze|fzco|tower|port|logistics|"
    r"commercial|areal|areál)(?!\w)",
    re.I,
)
_COMPANY_SUFFIX = re.compile(
    r"(?<!\w)(ltd|limited|llc|l\.l\.c|inc|corp|corporation|co\.|company|gmbh|a\.s\.|s\.r\.o|"
    r"fze|fzco|fzc|plc|trading|general trading|enterprises|group|holdings|sourcing)(?!\w)",
    re.I,
)


def classify_address(name: str, address: str) -> AddressType | None:
    """Keyword verdict on a party. Order matters: P.O. box -> unknown, residential words ->
    residential, then commercial words in the address or a company suffix in the name ->
    commercial. None when nothing matches."""
    if _PO_BOX.search(address):
        return AddressType.unknown
    if _RESIDENTIAL.search(address):
        return AddressType.residential
    if _COMMERCIAL_ADDRESS.search(address) or _COMPANY_SUFFIX.search(name):
        return AddressType.commercial
    return None
