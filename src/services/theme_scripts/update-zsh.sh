#!/usr/bin/env bash
set -euo pipefail

AGS_DIR="${AGS_DIR:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)}"
THEME_FILE="${THEME_FILE:-$AGS_DIR/src/themes/theme.json}"
ZSH_COLORS_FILE="${ZSH_COLORS_FILE:-$HOME/.zsh.d/colors.zsh}"

if [[ ! -r "$THEME_FILE" ]]; then
    echo "No se puede leer el tema activo: $THEME_FILE" >&2
    exit 1
fi
if [[ ! -e "$ZSH_COLORS_FILE" ]]; then
    echo "No existe el archivo de colores de Zsh: $ZSH_COLORS_FILE" >&2
    exit 1
fi

# Resolve a possible symlink so the replacement updates its target.
ZSH_COLORS_FILE="$(readlink -f -- "$ZSH_COLORS_FILE")"
if [[ ! -f "$ZSH_COLORS_FILE" || ! -w "$ZSH_COLORS_FILE" ]]; then
    echo "No se puede escribir el archivo de colores de Zsh: $ZSH_COLORS_FILE" >&2
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

ansi() {
    local hex="$1"
    printf '\033[38;2;%d;%d;%dm' \
        "$((16#${hex:1:2}))" "$((16#${hex:3:2}))" "$((16#${hex:5:2}))"
}

bg="$(color bg)"
fg="$(color fg)"
fg_alt="$(color fgAlt)"
bd="$(color bd)"
accent="$(color accent)"
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

temporary_file="$(mktemp "${ZSH_COLORS_FILE}.XXXXXX")"
trap 'rm -f "$temporary_file"' EXIT

{
    cat <<'HEADER'
# ==============================================================
# Colores generados automaticamente desde el tema activo de AGS
# ==============================================================

HEADER
    printf 'export CL_FOREGROUND=$\047%s\047  # %s\n\n' "$(ansi "$fg")" "$fg"
    printf 'export CL_BACKGROUND=$\047%s\047  # %s\n\n' "$(ansi "$bg")" "$bg"
    printf 'export CL_CURRENT_LINE=$\047%s\047  # %s\n' "$(ansi "$bd")" "$bd"
    printf 'export CL_COMMENT=$\047%s\047  # %s\n\n' "$(ansi "$fg_alt")" "$fg_alt"
    printf '# Colores principales\n'
    printf 'export CL_ROJO=$\047%s\047  # %s\n' "$(ansi "$red")" "$red"
    printf 'export CL_VERDE=$\047%s\047  # %s\n' "$(ansi "$green")" "$green"
    printf 'export CL_AMARILLO=$\047%s\047  # %s\n' "$(ansi "$yellow")" "$yellow"
    printf 'export CL_MORADO=$\047%s\047  # %s\n' "$(ansi "$accent")" "$accent"
    printf 'export CL_ROSA=$\047%s\047  # %s\n' "$(ansi "$magenta")" "$magenta"
    printf 'export CL_CYAN=$\047%s\047  # %s\n' "$(ansi "$cyan")" "$cyan"
    printf 'export CL_NARANJA=$\047%s\047  # %s\n\n' "$(ansi "$yellow_bright")" "$yellow_bright"
    printf '# Colores brillantes\n'
    printf 'export CL_GRIS=$\047%s\047  # %s\n' "$(ansi "$bd")" "$bd"
    printf 'export CL_ROJO_BRIGHT=$\047%s\047  # %s\n' "$(ansi "$red_bright")" "$red_bright"
    printf 'export CL_VERDE_BRIGHT=$\047%s\047  # %s\n' "$(ansi "$green_bright")" "$green_bright"
    printf 'export CL_AMARILLO_BRIGHT=$\047%s\047  # %s\n' "$(ansi "$yellow_bright")" "$yellow_bright"
    printf 'export CL_MORADO_BRIGHT=$\047%s\047  # %s\n' "$(ansi "$blue_bright")" "$blue_bright"
    printf 'export CL_ROSA_BRIGHT=$\047%s\047  # %s\n' "$(ansi "$magenta_bright")" "$magenta_bright"
    printf 'export CL_CYAN_BRIGHT=$\047%s\047  # %s\n' "$(ansi "$cyan_bright")" "$cyan_bright"
    printf 'export CL_NARANJA_BRIGHT=$\047%s\047  # %s\n\n' "$(ansi "$yellow_bright")" "$yellow_bright"
    printf '# Reset\nexport CL_RESET=$\047\033[0m\047\n'
} > "$temporary_file"

chmod --reference="$ZSH_COLORS_FILE" "$temporary_file"
mv -f -- "$temporary_file" "$ZSH_COLORS_FILE"
trap - EXIT
