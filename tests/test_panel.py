"""Phase 7 panel registration + serving tests (PLAN-topology-phase7.md §6).

Covers the small Python surface Phase 7 adds: the `/topology_static`
`StaticPathConfig`, the `panel_custom` registration (admin-gated, correct
webcomponent + cache-busted `module_url`), removal on unload, and the committed
build artifacts. The panel is a pure consumer of the frozen WS contract, so
these tests assert only the registration/serving wiring — no new command.
"""

from __future__ import annotations

from http import HTTPStatus
import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

from custom_components import topology
from custom_components.topology.const import (
    DOMAIN,
    PANEL_BUILD_MANIFEST,
    PANEL_MODULE,
    PANEL_STATIC_URL,
    PANEL_URL_PATH,
    PANEL_WEBCOMPONENT,
)
from homeassistant.components import frontend

if TYPE_CHECKING:
    from pytest_homeassistant_custom_component.common import MockConfigEntry
    from pytest_homeassistant_custom_component.typing import ClientSessionGenerator

    from homeassistant.core import HomeAssistant

_PANEL_DIR = Path(topology.__file__).parent / "panel"


def _panel(hass: HomeAssistant) -> frontend.Panel | None:
    """Return the registered topology panel object, or None."""
    return hass.data.get(frontend.DATA_PANELS, {}).get(PANEL_URL_PATH)


def _build_manifest() -> dict[str, str]:
    return json.loads((_PANEL_DIR / PANEL_BUILD_MANIFEST).read_text(encoding="utf-8"))


def test_read_build_manifest_fallback(tmp_path: Path, monkeypatch: Any) -> None:
    """A missing/corrupt build.json degrades to the fixed module + empty hash (§2.1)."""
    monkeypatch.setattr(topology, "_panel_dir", lambda: tmp_path)
    manifest = topology._read_build_manifest()  # noqa: SLF001 — testing the private fallback
    assert manifest == {"module": PANEL_MODULE, "hash": ""}


async def test_panel_build_json_present() -> None:
    """The committed build.json + bundle exist and name the shipped module (§4.3)."""
    manifest = _build_manifest()
    assert manifest["module"] == PANEL_MODULE
    assert (_PANEL_DIR / manifest["module"]).is_file()
    assert isinstance(manifest["hash"], str)


async def test_panel_registered_on_setup(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
) -> None:
    """After setup a `topology` custom panel exists with the right webcomponent."""
    panel = _panel(hass)
    assert panel is not None
    # panel_custom registers component_name="custom"; the webcomponent + module
    # live under config["_panel_custom"].
    assert panel.component_name == "custom"
    assert panel.config is not None
    assert panel.config["_panel_custom"]["name"] == PANEL_WEBCOMPONENT
    assert panel.config_panel_domain == DOMAIN


async def test_panel_requires_admin(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
) -> None:
    """The registered panel is admin-only (D8)."""
    panel = _panel(hass)
    assert panel is not None
    assert panel.require_admin is True


async def test_module_url_cache_busting(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
) -> None:
    """`module_url` carries the `?<hash>` from build.json (§4.3/D5)."""
    panel = _panel(hass)
    assert panel is not None
    assert panel.config is not None
    module_url = panel.config["_panel_custom"]["module_url"]
    manifest = _build_manifest()
    assert module_url.startswith(f"{PANEL_STATIC_URL}/{manifest['module']}")
    if manifest["hash"]:
        assert module_url.endswith(f"?{manifest['hash']}")


async def test_panel_removed_on_unload(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
) -> None:
    """Unloading the entry removes the sidebar panel (`async_remove_panel`)."""
    assert _panel(hass) is not None
    assert await hass.config_entries.async_unload(setup_integration.entry_id)
    await hass.async_block_till_done()
    assert _panel(hass) is None


async def test_static_path_serves_bundle(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    hass_client: ClientSessionGenerator,
) -> None:
    """The `/topology_static` path serves the built bundle (§4.4)."""
    client = await hass_client()
    manifest = _build_manifest()
    response = await client.get(f"{PANEL_STATIC_URL}/{manifest['module']}")
    assert response.status == HTTPStatus.OK
    body = await response.text()
    # The served file is the committed bundle.
    assert body == (_PANEL_DIR / manifest["module"]).read_text(encoding="utf-8")
