#!/bin/bash
# SessionStart hook for Claude Code on the web.
#
# Cloud sandboxes have none of .devcontainer/'s setup (Python 3.14 + Node via
# DevContainer features, the apt-packages feature list, script/setup/bootstrap).
# This hook brings a cloud sandbox as close to the DevContainer as practical by
# calling the exact same entry point the DevContainer's postCreateCommand uses
# (script/setup/setup), after installing the handful of things DevContainer
# features would otherwise have provided.
#
# Local development and the DevContainer itself are untouched — this only runs
# when Claude Code reports it's operating a remote/cloud sandbox.
#
# Safe to invoke directly too (e.g. `CLAUDE_CODE_REMOTE=true bash .claude/hooks/session-start.sh`
# as a cloud environment's Setup script), which lets that already-installed environment's
# filesystem cache and this hook's own fast-path marker (see below) agree with each other.

set -euo pipefail

if [[ ${CLAUDE_CODE_REMOTE:-} != "true" ]]; then
    exit 0
fi

# CLAUDE_PROJECT_DIR is set when Claude Code invokes this as a SessionStart hook.
# It's unset when a cloud environment's Setup script invokes this file directly
# (before Claude Code has launched) — fall back to the current directory, which
# is already the repo root in that context.
cd "${CLAUDE_PROJECT_DIR:-.}"

# Needed immediately in this shell (pipx-installed uv lands here) and for every
# later Bash tool call in this session.
export PATH="$HOME/.local/bin:$PATH"
if [[ -n ${CLAUDE_ENV_FILE:-} ]]; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >>"$CLAUDE_ENV_FILE"
fi

# Fast path: skip straight past apt/uv/bootstrap if nothing that would change their
# outcome has changed since the last successful run in this filesystem. Needed
# because SessionStart hooks re-run on every resume/clear/compact — not just fresh
# sessions — unlike a cloud environment's Setup script, which is cached. Without
# this, resuming a session redid the full multi-minute apt+uv+Python 3.14+Home
# Assistant install every single time even though nothing had changed.
MARKER=".local/.claude-cloud-setup.sha256"
FINGERPRINT_INPUTS=(
    pyproject.toml
    hacs.json
    .devcontainer/.env
    .devcontainer/.env.local
    requirements.txt
    requirements_dev.txt
    requirements_test.txt
    requirements.local.txt
    package.json
    package-lock.json
    .claude/hooks/session-start.sh
)
# Several of these are optional/gitignored (.env.local, requirements.local.txt,
# package-lock.json) — `cat` exits non-zero for the ones that don't exist even
# though it still prints the ones that do, and that non-zero exit would otherwise
# kill the script here under `set -e` + `pipefail`.
CURRENT_FINGERPRINT=$(cat "${FINGERPRINT_INPUTS[@]}" 2>/dev/null | sha256sum | cut -d' ' -f1) || true

if [[ -f $MARKER && -x .local/ha-venv/bin/python3 && $(cat "$MARKER") == "$CURRENT_FINGERPRINT" ]] &&
    .local/ha-venv/bin/python3 -c "import homeassistant" >/dev/null 2>&1; then
    echo "==> Cloud sandbox already set up and unchanged since last run — skipping"
    exit 0
fi

echo "==> Installing apt packages (parity with .devcontainer/devcontainer.json's apt-packages feature)"
# Keep this list in sync with the "apt-packages" feature in .devcontainer/devcontainer.json.
# Includes pipx, used below as the uv-install fallback.
#
# Installed one at a time and best-effort: the devcontainer image is Debian, cloud
# sandboxes may be a different distro/release (e.g. Ubuntu) with different package
# names for some of these (seen in practice: libturbojpeg0 doesn't exist on Ubuntu
# 24.04, it's just libturbojpeg there) — a single unresolvable name must not abort
# the rest of the list, the way one `apt-get install pkg1 pkg2 ...` call would.
APT_PACKAGES=(
    autoconf automake bat eza fd-find ffmpeg fzf git-delta httpie hyperfine
    ipython3 jo jq libpcap-dev libssl-dev libtool libturbojpeg0 miller
    moreutils pipx ripgrep shellcheck shfmt sqlite3 tree yamllint
)

apt_get() {
    if [[ $(id -u) -eq 0 ]]; then
        apt-get "$@"
    elif command -v sudo >/dev/null 2>&1; then
        sudo apt-get "$@"
    else
        echo "==> No root/sudo available — skipping apt package installation" >&2
        return 1
    fi
}

if command -v apt-get >/dev/null 2>&1; then
    apt_get update -qq || echo "==> apt-get update failed — continuing with existing package lists" >&2
    for pkg in "${APT_PACKAGES[@]}"; do
        apt_get install -y -qq "$pkg" >/dev/null 2>&1 || echo "==> apt package '$pkg' unavailable — skipping" >&2
    done
else
    echo "==> apt-get not found — skipping apt package installation" >&2
fi

echo "==> Installing latest uv"
# Force-(re)install rather than "only if missing": a stale pre-baked uv can carry a
# stale bundled index of downloadable Python builds. Seen in practice: an old uv only
# knew about a 3.14 pre-release build, which was too old to satisfy Home Assistant's
# own Python>=3.14.2 requirement — upgrading uv immediately exposed a proper 3.14.x
# stable release. This also matches the devcontainer's own unpinned "always latest".
if command -v pipx >/dev/null 2>&1; then
    pipx install uv --force
else
    echo "==> pipx unavailable — cannot install/upgrade uv, script/setup/setup will likely fail" >&2
fi

# uv manages its own Python interpreters, but only on request: a bare `uv venv`
# (what script/setup/bootstrap calls) does NOT auto-download a missing interpreter,
# it only picks one up if already installed/on PATH. The devcontainer/CI never hit
# this because they provision system Python 3.14 through other means first. Do that
# provisioning step here, reading the version straight from pyproject.toml so it
# can't drift out of sync.
if command -v uv >/dev/null 2>&1; then
    REQUIRED_PYTHON=$(grep -m1 '^requires-python' pyproject.toml | sed -E 's/.*[">=~^ ]([0-9]+\.[0-9]+).*/\1/')
    if [[ -n $REQUIRED_PYTHON ]]; then
        echo "==> Ensuring Python $REQUIRED_PYTHON is available to uv"
        uv python install "$REQUIRED_PYTHON" || echo "==> Failed to provision Python $REQUIRED_PYTHON — venv creation will likely fail" >&2
    fi
fi

echo "==> Running script/setup/setup (same entry point as the DevContainer's postCreateCommand)"
script/setup/setup

echo "$CURRENT_FINGERPRINT" >"$MARKER"
