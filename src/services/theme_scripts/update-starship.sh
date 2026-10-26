#!/usr/bin/env bash
set -euo pipefail

AGS_DIR="${AGS_DIR:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)}"
THEME_FILE="${THEME_FILE:-$AGS_DIR/src/themes/theme.json}"
STARSHIP_CONFIG="${STARSHIP_CONFIG:-$HOME/.config/starship.toml}"

if [[ ! -r "$THEME_FILE" ]]; then
    echo "No se puede leer el tema activo: $THEME_FILE" >&2
    exit 1
fi

if [[ ! -e "$STARSHIP_CONFIG" ]]; then
    echo "No existe la configuración de Starship: $STARSHIP_CONFIG" >&2
    exit 1
fi

# Resolve symlinks (for example ~/.config/starship.toml -> ~/Dotfiles/...) so
# the atomic replacement updates the target instead of replacing the symlink.
STARSHIP_CONFIG="$(readlink -f -- "$STARSHIP_CONFIG")"
if [[ ! -f "$STARSHIP_CONFIG" || ! -w "$STARSHIP_CONFIG" ]]; then
    echo "No se puede escribir la configuración de Starship: $STARSHIP_CONFIG" >&2
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

# Map the semantic names already used by styles in starship.toml to the
# corresponding theme colors. Keep these palette keys stable for the prompt.
purple="$(color accent)"
pink="$(color magenta_s)"
orange="$(color yellow_s)"
cyan="$(color cyan_s)"
green="$(color green)"
red="$(color red)"
yellow="$(color yellow_s)"
blue="$(color blue)"
magenta="$(color magenta)"
white="$(color fg)"
black="$(color bg)"

temporary_file="$(mktemp "${STARSHIP_CONFIG}.XXXXXX")"
trap 'rm -f "$temporary_file"' EXIT

# The custom palette currently lives at EOF. Replace just that table and keep
# all prompt formatting, modules, comments, and preceding configuration intact.
awk -v purple="$purple" -v pink="$pink" -v orange="$orange" \
    -v cyan="$cyan" -v green="$green" -v red="$red" \
    -v yellow="$yellow" -v blue="$blue" -v magenta="$magenta" \
    -v white="$white" -v black="$black" '
    /^\[palettes\.custom_dotfiles\][[:space:]]*$/ { found=1; exit }
    { print }
    END {
        if (!found) {
            print "" > "/dev/stderr"
            print "No se encontró [palettes.custom_dotfiles] en la configuración de Starship" > "/dev/stderr"
            exit 1
        }
        print "[palettes.custom_dotfiles]"
        print "purple = \"" purple "\""
        print "pink = \"" pink "\""
        print "orange = \"" orange "\""
        print "cyan = \"" cyan "\""
        print "green = \"" green "\""
        print "red = \"" red "\""
        print "yellow = \"" yellow "\""
        print "blue = \"" blue "\""
        print "magenta = \"" magenta "\""
        print "white = \"" white "\""
        print "black = \"" black "\""
    }
' "$STARSHIP_CONFIG" > "$temporary_file"

chmod --reference="$STARSHIP_CONFIG" "$temporary_file"
mv -f -- "$temporary_file" "$STARSHIP_CONFIG"
trap - EXIT
