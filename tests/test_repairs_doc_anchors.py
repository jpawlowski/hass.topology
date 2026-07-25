"""Per-issue documentation anchors for the repair cards (Phase 8 §4.2, V3).

A repair card has one link *field*, and it is spent on remediation for the eight
issues the panel can fix. The documentation link therefore lives inside the
card's description, which the repairs dialog renders through ``<ha-markdown>``.
That arrangement has three ways to rot silently — an issue id with no anchor, an
anchor pointing at a heading nobody wrote, and a description that forgot the
link — so all three are asserted here.
"""

from __future__ import annotations

import json
from pathlib import Path
import re
from typing import TYPE_CHECKING, Any

import pytest

from custom_components.topology import const
from custom_components.topology.const import (
    DOMAIN,
    ISSUE_DEEP_LINKS,
    ISSUE_DOC_ANCHORS,
    ISSUE_STORE_FUTURE_VERSION,
    ISSUE_UNKNOWN_ENUM,
    LEARN_MORE_URL,
)
from homeassistant.helpers import issue_registry as ir

if TYPE_CHECKING:
    from collections.abc import Callable

    from pytest_homeassistant_custom_component.common import MockConfigEntry

    from homeassistant.core import HomeAssistant

_REPO = Path(__file__).parent.parent
_CONFIGURATION = _REPO / "docs" / "user" / "CONFIGURATION.md"
_TRANSLATIONS = _REPO / "custom_components" / "topology" / "translations" / "en.json"

# Every ``ISSUE_*`` constant is an issue id by construction, so the catalog is
# read off the module rather than restated — a new issue id joins these tests
# the moment it is declared.
_ISSUE_IDS = {value for name, value in vars(const).items() if name.startswith("ISSUE_") and isinstance(value, str)}

# The two the panel cannot fix: setup aborted, or the remedy is prose.
_NON_REMEDIABLE = {ISSUE_STORE_FUTURE_VERSION, ISSUE_UNKNOWN_ENUM}


def _github_slug(heading: str) -> str:
    """Return the fragment GitHub generates for a heading.

    Lowercased, non-alphanumerics dropped except spaces and hyphens, spaces to
    hyphens. Good enough for the plain headings this file uses; the point is to
    catch a rename, not to reimplement GitHub.
    """
    slug = heading.strip().lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    return re.sub(r"\s+", "-", slug)


def _headings() -> set[str]:
    return {
        _github_slug(line.lstrip("#").strip())
        for line in _CONFIGURATION.read_text(encoding="utf-8").splitlines()
        if line.startswith("#")
    }


def _issue_translations() -> dict[str, Any]:
    return json.loads(_TRANSLATIONS.read_text(encoding="utf-8"))["issues"]


def test_every_issue_has_a_doc_anchor() -> None:
    """No issue id may be missing from the anchor map."""
    assert set(ISSUE_DOC_ANCHORS) == _ISSUE_IDS


def test_every_anchor_resolves_to_a_real_heading() -> None:
    """A heading rename must break CI, not ship a dead link."""
    headings = _headings()
    for issue_id, url in ISSUE_DOC_ANCHORS.items():
        assert "#" in url, issue_id
        base, fragment = url.split("#", 1)
        # Absolute, because a repair card renders in the frontend and has no
        # notion of this repository's layout.
        assert base.startswith("https://"), issue_id
        assert base.endswith("docs/user/CONFIGURATION.md"), issue_id
        assert fragment in headings, f"{issue_id} -> #{fragment}"


def test_every_description_links_to_its_anchor() -> None:
    """Every card's text ends with a markdown link to ``{docs}``."""
    issues = _issue_translations()
    assert set(issues) == _ISSUE_IDS
    for issue_id, block in issues.items():
        description = (
            block["description"]
            if "description" in block
            # The fixable card's body is its fix-flow confirm step, and the flow
            # forwards the issue's own placeholders, so {docs} resolves there.
            else block["fix_flow"]["step"]["confirm"]["description"]
        )
        assert "]({docs})" in description, issue_id


def test_remediable_cards_keep_their_deep_link() -> None:
    """The eight panel-fixable cards still point their button at the panel."""
    assert set(ISSUE_DEEP_LINKS) == _ISSUE_IDS - _NON_REMEDIABLE
    for url in ISSUE_DEEP_LINKS.values():
        assert url.startswith("homeassistant://topology?focus=")


def test_learn_more_url_is_no_card_target() -> None:
    """The bare repo URL survives only as ``_toggle``'s fallback default."""
    assert LEARN_MORE_URL not in ISSUE_DEEP_LINKS.values()
    assert LEARN_MORE_URL not in ISSUE_DOC_ANCHORS.values()


@pytest.mark.usefixtures("area_registry")
async def test_raised_issues_carry_both_links(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """A live card gets its deep link *and* a resolvable ``docs`` placeholder."""
    # An isolated area is the cheapest way to raise a reactive card.
    payload = json.loads(json.dumps(store_payload_full))
    payload["edges"] = {}
    load_payload(setup_integration, payload)
    await hass.async_block_till_done()

    registry = ir.async_get(hass)
    issue = registry.async_get_issue(DOMAIN, "isolated_areas")
    assert issue is not None
    assert issue.learn_more_url == ISSUE_DEEP_LINKS["isolated_areas"]
    assert issue.translation_placeholders is not None
    assert issue.translation_placeholders["docs"] == ISSUE_DOC_ANCHORS["isolated_areas"]
    # The count placeholder the card already carried is untouched.
    assert issue.translation_placeholders["count"] == "3"


@pytest.mark.usefixtures("area_registry")
async def test_non_remediable_card_points_its_button_at_the_docs(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """``unknown_enum_after_downgrade`` moved off the bare repo URL."""
    payload = json.loads(json.dumps(store_payload_full))
    payload["areas"]["flur"]["trust"] = "confidential"
    load_payload(setup_integration, payload)
    await hass.async_block_till_done()

    issue = ir.async_get(hass).async_get_issue(DOMAIN, ISSUE_UNKNOWN_ENUM)
    assert issue is not None
    assert issue.learn_more_url == ISSUE_DOC_ANCHORS[ISSUE_UNKNOWN_ENUM]
    assert issue.learn_more_url != LEARN_MORE_URL
