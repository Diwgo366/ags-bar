#!/usr/bin/env bash
set -euo pipefail

AGS_DIR="${AGS_DIR:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)}"
THEME_FILE="${THEME_FILE:-$AGS_DIR/src/themes/theme.json}"
HYPR_THEME_FILE="${HYPR_THEME_FILE:-$HOME/.config/hypr/config/theme.lua}"

if [[ ! -r "$THEME_FILE" ]]; then
    echo "No se puede leer el tema activo: $THEME_FILE" >&2
    exit 1
fi
if [[ ! -r "$HYPR_THEME_FILE" ]]; then
    echo "No se puede leer la configuración de tema de Hyprland: $HYPR_THEME_FILE" >&2
    exit 1
fi

active_hex="$(jq -er '.colors.bdAlt | strings | select(test("^#[[:xdigit:]]{6}$"))' "$THEME_FILE")"
inactive_hex="$(jq -er '.colors.bd | strings | select(test("^#[[:xdigit:]]{6}$"))' "$THEME_FILE")"
active="rgba(${active_hex:1}ff)"
inactive="rgba(${inactive_hex:1}ff)"

temporary_file="$(mktemp "${HYPR_THEME_FILE}.XXXXXX")"
trap 'rm -f "$temporary_file"' EXIT

awk -v active="$active" -v inactive="$inactive" '
    /^[[:space:]]*active_border[[:space:]]*=/ {
        sub(/"[^"]*"/, "\"" active "\""); active_count++; print; next
    }
    /^[[:space:]]*inactive_border[[:space:]]*=/ {
        sub(/"[^"]*"/, "\"" inactive "\""); inactive_count++; print; next
    }
    { print }
    END { if (active_count != 1 || inactive_count != 1) exit 1 }
' "$HYPR_THEME_FILE" > "$temporary_file"

chmod --reference="$HYPR_THEME_FILE" "$temporary_file"
cat "$temporary_file" > "$HYPR_THEME_FILE"
rm -f "$temporary_file"
trap - EXIT

hyprctl reload
