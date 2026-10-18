"""Three-step HS classifier (chapter -> heading -> HS6) with a scripted fake model."""

import json
import re
from types import SimpleNamespace

import pytest

from tbml.classify import HierarchicalProposer, ProposerError, classify_description, enrich
from tbml.classify.nomenclature import load_nomenclature
from tbml.classify.proposers import KeywordProposer, default_proposer
from tbml.schemas import Invoice

NOMENCLATURE = """code,description
84,"Nuclear reactors, boilers, machinery and mechanical appliances"
85,Electrical machinery and equipment
73,Articles of iron or steel
8471,Automatic data processing machines
8473,Parts for office machines
847130,"Portable automatic data processing machines, weighing not more than 10 kg"
847141,"Other, comprising a CPU and an input and output unit"
847330,Parts and accessories of machines of heading 8471
8523,Discs and solid-state storage devices
852351,Solid-state non-volatile storage devices
7318,"Screws, bolts, nuts and similar articles, of iron or steel"
731815,"Other screws and bolts, whether or not with their nuts or washers"
731816,Nuts
"""


@pytest.fixture
def nom(tmp_path):
    path = tmp_path / "hs.csv"
    path.write_text(NOMENCLATURE)
    return load_nomenclature(path)


class FakeClient:
    """Answers by level: `answers` maps the number of option-code digits (2/4/6) to a reply
    dict, or to a list of replies used in order (for retry tests)."""

    def __init__(self, answers):
        self.answers = {k: list(v) if isinstance(v, list) else [v] for k, v in answers.items()}
        self.calls = []
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kwargs):
        content = kwargs["messages"][0]["content"]
        self.calls.append(content)
        if content.startswith("Invoice line:"):  # step 0, interpretation
            reply = self.answers.get("interpret", [{"goods": "", "vague": False}])[0]
            text = reply if isinstance(reply, str) else json.dumps(reply)
            return SimpleNamespace(content=[SimpleNamespace(text=text)])
        digits = int(re.search(r"\((\d) digits\)", content).group(1))
        queue = self.answers[digits]
        reply = queue.pop(0) if len(queue) > 1 else queue[0]
        text = reply if isinstance(reply, str) else json.dumps(reply)
        return SimpleNamespace(content=[SimpleNamespace(text=text)])


MACBOOK = {
    2: {
        "choices": [{"code": "84", "score": 0.97}, {"code": "85", "score": 0.03}],
        "reason": "a laptop is a data processing machine",
    },
    4: {"choices": [{"code": "8471", "score": 0.95}], "reason": "computers"},
    6: {
        "choices": [{"code": "847130", "score": 0.92}, {"code": "847141", "score": 0.05}],
        "reason": "portable, under 10 kg",
    },
}


def _proposer(answers, nom, tmp_path, **kw):
    kw.setdefault("interpret", False)  # step-0 interpretation has its own tests below
    return HierarchicalProposer(
        model="fake", client=FakeClient(answers), nomenclature=nom, cache_dir=tmp_path / "c", **kw
    )


def test_loader_handles_dots_leading_zeros_long_codes_and_derives_parents(tmp_path):
    path = tmp_path / "hs.csv"
    path.write_text(
        "HS Code,Description\n"
        "9,Coffee tea mate and spices\n"  # chapter 09 with its leading zero dropped
        "0901.11,Coffee not roasted not decaffeinated\n"
        "8471.30.00.10,Laptops national line\n"  # 10-digit line folds into 847130
    )
    nom = load_nomenclature(path)
    assert nom.describe("09") == "Coffee tea mate and spices"
    assert "090111" in nom.hs6_codes() and "847130" in nom.hs6_codes()
    assert nom.describe("0901") == "Heading 0901"  # derived
    assert nom.describe("84") == "Chapter 84"  # derived
    assert [c for c, _ in nom.children(None)] == ["09", "84"]
    assert [c for c, _ in nom.children("84")] == ["8471"]


def test_loader_rejects_files_without_the_right_columns(tmp_path):
    path = tmp_path / "bad.csv"
    path.write_text("foo,bar\n1,2\n")
    with pytest.raises(ValueError, match="code column"):
        load_nomenclature(path)


def test_macbook_walks_three_levels_and_explains_the_path(nom, tmp_path):
    p = _proposer(MACBOOK, nom, tmp_path)
    cands = p.propose("MBP 14 M3 16/512 SG")
    assert [c.hs6 for c in cands] == ["847130", "847141"]
    assert cands[0].score == 0.92  # min(0.97, 0.95, 0.92)
    assert len(p.client.calls) == 3
    # each step only sees the codes under the previous choice
    assert "8471:" in p.client.calls[1] and "7318:" not in p.client.calls[1]
    assert "847130:" in p.client.calls[2] and "852351:" not in p.client.calls[2]
    path = p.explain("MBP 14 M3 16/512 SG")
    assert path.startswith("84 ") and "> 8471 " in path and "> 847130 " in path


def test_final_score_is_capped_by_weakest_step(nom, tmp_path):
    answers = dict(MACBOOK)
    answers[4] = {"choices": [{"code": "8471", "score": 0.6}], "reason": "probably a computer"}
    cands = _proposer(answers, nom, tmp_path).propose("compute unit")
    assert cands[0].score == 0.6


def test_low_confidence_step_stops_and_classifier_returns_not_sure(nom, tmp_path):
    answers = dict(MACBOOK)
    answers[4] = {
        "choices": [{"code": "8471", "score": 0.3}, {"code": "8473", "score": 0.3}],
        "reason": "could be a whole machine or a part",
    }
    p = _proposer(answers, nom, tmp_path)
    cls = classify_description("unit assy 14in", p, entries=_entries(nom))
    assert cls.hs6 is None
    assert "not sure at heading level" in cls.reason
    assert len(p.client.calls) == 2  # never asked for the subheading


def test_empty_choice_means_too_vague(nom, tmp_path):
    answers = {2: {"choices": [], "reason": "description does not identify any goods"}}
    p = _proposer(answers, nom, tmp_path)
    assert p.propose("assorted lot") == []
    assert "no chapter fits" in p.explain("assorted lot")


def test_invented_code_is_retried_then_accepted(nom, tmp_path):
    answers = dict(MACBOOK)
    answers[2] = [{"choices": [{"code": "99", "score": 0.9}], "reason": "x"}, MACBOOK[2]]
    p = _proposer(answers, nom, tmp_path)
    assert p.propose("laptop")[0].hs6 == "847130"
    assert "invalid" in p.client.calls[1]  # retry carried the error back


def test_two_bad_answers_raise_and_classifier_degrades(nom, tmp_path):
    answers = {2: "not json at all"}
    p = _proposer(answers, nom, tmp_path)
    with pytest.raises(ProposerError):
        p.propose("laptop")
    cls = classify_description("laptop", p, entries=_entries(nom))
    assert cls.hs6 is None and "classifier unavailable" in cls.reason


def test_cache_makes_reruns_free(nom, tmp_path):
    first = _proposer(MACBOOK, nom, tmp_path)
    first.propose("MacBook Air 13")
    second = _proposer({}, nom, tmp_path)  # no answers: any API call would fail
    assert second.propose("macbook   AIR 13")[0].hs6 == "847130"
    assert second.client.calls == []


def test_enrich_puts_the_path_in_the_note(nom, tmp_path, monkeypatch):
    import tbml.classify.classifier as clsmod

    monkeypatch.setattr(clsmod, "default_hs6", lambda: _entries(nom))
    line = enrich(_invoice("MBP 14 M3 16/512 SG"), _proposer(MACBOOK, nom, tmp_path))[0]
    assert line.hs6 == "847130"
    assert line.normalisation_note.startswith("HS path: 84 ")


def test_default_proposer_choice(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert isinstance(default_proposer(), KeywordProposer)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "x")
    monkeypatch.setenv("LLM_MODEL", "m")
    monkeypatch.setenv("CLASSIFIER", "keyword")
    assert isinstance(default_proposer(), KeywordProposer)


def _entries(nom):
    from tbml.classify.hs6 import HS6Entry

    return {c: HS6Entry(c, d, (), None) for c, d in nom.hs6_codes().items()}


def _invoice(description):
    from pathlib import Path

    from tbml.paths import SYNTHETIC_DIR

    inv = Invoice.model_validate_json(
        next(Path(SYNTHETIC_DIR / "truth").glob("*.json")).read_text()
    )
    item = inv.line_items[0].model_copy(update={"description": description})
    return inv.model_copy(update={"line_items": [item]})


def test_loader_reads_the_hs_db_and_covers_our_goods():
    from tbml.classify.nomenclature import HS_DB, nomenclature_path

    if not HS_DB.exists():
        pytest.skip("hs.db not present")
    assert nomenclature_path() == HS_DB
    nom = load_nomenclature(HS_DB)
    assert len(nom.children(None)) >= 95  # chapters
    assert len(nom.hs6_codes()) > 5000
    for code in ["731815", "220210", "852351", "610910", "090111", "740311", "847130"]:
        assert code in nom.hs6_codes(), code
    assert nom.describe("84").startswith("Machinery")
    assert ("847130", nom.describe("847130")) in nom.children("8471")


def test_catch_all_and_reserved_chapters_are_not_options(tmp_path):
    path = tmp_path / "hs.csv"
    path.write_text("code,description\n99,Not specified\n999999,Not specified\n847130,Laptops\n")
    nom = load_nomenclature(path)
    assert "999999" not in nom.hs6_codes()
    assert [c for c, _ in nom.children(None)] == ["84"]


def test_unwritable_cache_does_not_break_classification(nom, tmp_path):
    blocker = tmp_path / "not-a-dir"
    blocker.write_text("x")  # mkdir under a file fails, like a read-only disk
    p = HierarchicalProposer(
        model="fake",
        client=FakeClient(MACBOOK),
        nomenclature=nom,
        cache_dir=blocker / "c",
        interpret=False,
    )
    assert p.propose("MacBook Pro 14")[0].hs6 == "847130"


def test_cache_follows_tbml_cache_dir(nom, tmp_path, monkeypatch):
    monkeypatch.setenv("TBML_CACHE_DIR", str(tmp_path / "tmpcache"))
    p = HierarchicalProposer(model="fake", client=FakeClient(MACBOOK), nomenclature=nom)
    assert p.cache_dir == tmp_path / "tmpcache" / "classify_hier"


def test_path_text_is_kept_short(nom, tmp_path):
    from tbml.classify.hierarchical import _short

    assert _short("x" * 200).endswith("…") and len(_short("x" * 200)) == 60
    assert _short("Nuts") == "Nuts"


def test_interpretation_feeds_the_plain_reading_into_every_step(nom, tmp_path):
    answers = dict(MACBOOK)
    answers["interpret"] = {"goods": "Apple MacBook Pro 14-inch laptop computer", "vague": False}
    p = _proposer(answers, nom, tmp_path, interpret=True)
    assert p.propose("MBP 14 M3 16/512 SG")[0].hs6 == "847130"
    assert len(p.client.calls) == 4  # interpret + chapter + heading + subheading
    assert all("What it is: Apple MacBook Pro" in c for c in p.client.calls[1:])
    assert p.explain("MBP 14 M3 16/512 SG").startswith('read as "Apple MacBook Pro')


def test_interpretation_can_call_a_line_too_vague(nom, tmp_path):
    answers = {"interpret": {"goods": "unspecified parts", "vague": True}}
    p = _proposer(answers, nom, tmp_path, interpret=True)
    assert p.propose("Spare parts") == []
    assert len(p.client.calls) == 1
    assert "too vague" in p.explain("Spare parts")


def test_codes_with_dots_or_dropped_zeros_are_accepted(nom, tmp_path):
    answers = dict(MACBOOK)
    answers[6] = {"choices": [{"code": "8471.30", "score": 0.9}], "reason": "portable"}
    assert _proposer(answers, nom, tmp_path).propose("laptop")[0].hs6 == "847130"


def test_committed_cache_is_read_when_the_cache_moves_to_tmp(nom, tmp_path, monkeypatch):
    import tbml.classify.hierarchical as hier

    bundled = tmp_path / "data"
    first = HierarchicalProposer(
        model="fake",
        client=FakeClient(MACBOOK),
        nomenclature=nom,
        cache_dir=bundled / "cache" / hier.CACHE_SUBDIR,
        interpret=False,
    )
    first.propose("MacBook Air 13")  # fills the "committed" cache
    monkeypatch.setattr(hier, "DATA_DIR", bundled)
    monkeypatch.setenv("TBML_CACHE_DIR", str(tmp_path / "tmp"))
    second = HierarchicalProposer(
        model="fake", client=FakeClient({}), nomenclature=nom, interpret=False
    )
    assert second.propose("MacBook Air 13")[0].hs6 == "847130"
    assert second.client.calls == []
