#!/usr/bin/env bash
set -euo pipefail

AGS_DIR="${AGS_DIR:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)}"
THEME_FILE="${THEME_FILE:-$AGS_DIR/src/themes/theme.json}"
KITTY_DIR="${KITTY_DIR:-$HOME/.config/kitty}"
COLORS_FILE="${KITTY_COLORS_FILE:-$KITTY_DIR/colors.conf}"

if [[ ! -r "$THEME_FILE" ]]; then
    echo "No se puede leer el tema activo: $THEME_FILE" >&2
    exit 1
fi

if [[ ! -f "$COLORS_FILE" || ! -w "$COLORS_FILE" ]]; then
    echo "No se puede escribir la configuración de colores de Kitty: $COLORS_FILE" >&2
    exit 1
fi

color() {
    local key="$1" value
    value="$(jq -er --arg key "$key" '.colors[$key] | strings | select(test("^#[[:xdigit:]]{6}$"))' "$THEME_FILE")" || {
        echo "Falta un color hexadecimal válido en colors.$key ($THEME_FILE)" >&2
        return 1
    }
    printf '%s' "$value"
}

bg="$(color bg)"
fg="$(color fg)"
fg_alt="$(color fgAlt)"
accent="$(color accent)"
bd="$(color bd)"
bd_alt="$(color bdAlt)"
red="$(color red)"
green="$(color green)"
yellow="$(color yellow)"
blue="$(color blue)"
magenta="$(color magenta)"
cyan="$(color cyan)"
red_bright="$(color red_s)"
green_bright="$(color green_s)"
yellow_bright="$(color yellow_s)"
blue_bright="$(color blue_s)"
magenta_bright="$(color magenta_s)"
cyan_bright="$(color cyan_s)"

temporary_file="$(mktemp "${COLORS_FILE}.XXXXXX")"
trap 'rm -f "$temporary_file"' EXIT

# colors.conf is a generated file: replace its full contents so repeated
# theme changes cannot accumulate blank lines or stale settings.
awk -v bg="$bg" -v fg="$fg" -v fg_alt="$fg_alt" \
    -v accent="$accent" -v bd="$bd" -v bd_alt="$bd_alt" \
    -v red="$red" -v green="$green" -v yellow="$yellow" \
    -v blue="$blue" -v magenta="$magenta" -v cyan="$cyan" \
    -v red_bright="$red_bright" -v green_bright="$green_bright" \
    -v yellow_bright="$yellow_bright" -v blue_bright="$blue_bright" \
    -v magenta_bright="$magenta_bright" -v cyan_bright="$cyan_bright" '
    /^draw_minimal_borders[[:space:]]/ { next }
    /^background[[:space:]]/ { next }
    /^foreground[[:space:]]/ { next }
    /^selection_background[[:space:]]/ { next }
    /^selection_foreground[[:space:]]/ { next }
    /^url_color[[:space:]]/ { next }
    /^cursor[[:space:]]/ { next }
    /^cursor_text_color[[:space:]]/ { next }
    /^color([0-9]|1[0-5])[[:space:]]/ { next }
    /^active_border_color[[:space:]]/ { next }
    /^active_tab_foreground[[:space:]]/ { next }
    /^active_tab_background[[:space:]]/ { next }
    /^inactive_border_color[[:space:]]/ { next }
    /^inactive_tab_foreground[[:space:]]/ { next }
    /^inactive_tab_background[[:space:]]/ { next }
    { print }
    END {
        print "draw_minimal_borders no"
        print ""
        print "background " bg
        print "foreground " fg
        print "selection_background " bd
        print "selection_foreground " fg
        print "url_color " accent
        print "cursor " fg
        print "cursor_text_color " bg
        print ""
        print "color0 " bg
        print "color1 " red
        print "color2 " green
        print "color3 " yellow
        print "color4 " blue
        print "color5 " magenta
        print "color6 " cyan
        print "color7 " fg_alt
        print "color8 " bd
        print "color9 " red_bright
        print "color10 " green_bright
        print "color11 " yellow_bright
        print "color12 " blue_bright
        print "color13 " magenta_bright
        print "color14 " cyan_bright
        print "color15 " fg
        print ""
        print "active_border_color " accent
        print "active_tab_foreground " bg
        print "active_tab_background " accent
        print "inactive_border_color " bd
        print "inactive_tab_foreground " fg_alt
        print "inactive_tab_background " bd
    }
' /dev/null > "$temporary_file"

chmod --reference="$COLORS_FILE" "$temporary_file"
cat "$temporary_file" > "$COLORS_FILE"
rm -f "$temporary_file"
trap - EXIT

# Reload Kitty's configuration through its documented signal interface. This
# works even when AGS is not a child of Kitty and therefore has no KITTY_LISTEN_ON
# environment variable or access to a remote-control socket.
kitty_pids="$(pgrep -u "$(id -u)" -x kitty || true)"
if [[ -z "$kitty_pids" ]]; then
    echo "Kitty no está ejecutándose; los colores se cargarán al iniciar la terminal."
else
    reload_failed=0
    while IFS= read -r pid; do
        [[ -n "$pid" ]] || continue
        if ! kill -USR1 "$pid"; then
            echo "No se pudo recargar la configuración de Kitty (PID $pid)." >&2
            reload_failed=1
        fi
    done <<< "$kitty_pids"
    if (( reload_failed )); then
        exit 1
    fi
fi
