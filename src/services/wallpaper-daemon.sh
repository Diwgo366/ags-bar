#!/bin/bash
# Wallpaper daemon - managed by AGS
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
AGS_SCRIPT="${AGS_SCRIPT:-${AGS_DIR:-$SCRIPT_DIR}/src/app.ts}"

THEME_FILE="${THEME_FILE:-${AGS_DIR:-$SCRIPT_DIR}/src/themes/theme.json}"
THEME_DIR="$(dirname "$THEME_FILE")"
THEME_NAME="$(basename "$THEME_FILE")"
RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
LOG_FILE="${LOG_FILE:-$RUNTIME_DIR/wallpaper-daemon.log}"
FIFO="${FIFO:-$RUNTIME_DIR/wallpaper-daemon.fifo}"
PIDFILE="${PIDFILE:-$RUNTIME_DIR/hypr-mpvpaper.pid}"
MONITOR_PIDFILE="${MONITOR_PIDFILE:-$RUNTIME_DIR/hypr-mpvpaper-monitor.pid}"
HYPERPAPER_PIDFILE="${HYPERPAPER_PIDFILE:-$RUNTIME_DIR/ags-hyprpaper.pid}"
MODEFILE="${MODEFILE:-$RUNTIME_DIR/hypr-monitor-mode}"
LOCKFILE="${LOCKFILE:-$RUNTIME_DIR/ags-wallpaper-daemon.lock}"
CACHE_DIR="${XDG_CACHE_HOME:-${HOME:-/tmp}/.cache}/ags/wallpapers"
MANAGER_PID="${MANAGER_PID:-/run/user/$(id -u)/ags-wallpaper-manager.pid}"

mkdir -p "$RUNTIME_DIR"
touch "$LOG_FILE"
exec 9>"$LOCKFILE"
flock -n 9 || exit 0

# Write our PID for the manager to track
echo $$ > "$MANAGER_PID"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"; }

# Find the AGS instance running this project. The shell that starts AGS with
# `ags run` may remain alive after AGS exits, so PPID alone is not reliable.
find_ags_pid() {
    local cmdline pid arg
    local -a args
    for cmdline in /proc/[0-9]*/cmdline; do
        [[ -r "$cmdline" ]] || continue
        pid="${cmdline#/proc/}"
        pid="${pid%/cmdline}"
        args=()
        while IFS= read -r -d '' arg; do args+=("$arg"); done < "$cmdline" 2>/dev/null
        if ((${#args[@]} >= 3)) &&
            [[ "${args[0]##*/}" == "ags" && "${args[1]}" == "run" && "${args[2]}" == "$AGS_SCRIPT" ]]; then
            printf '%s\n' "$pid"
            return 0
        fi
    done
    return 1
}

terminate_pid() {
    local pid="$1"
    if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
        kill -TERM "$pid" 2>/dev/null || true
        for _ in {1..10}; do
            kill -0 "$pid" 2>/dev/null || return 0
            sleep 0.1
        done
        kill -KILL "$pid" 2>/dev/null || true
    fi
}

stop_wallpapers() {
    local wallpaper_pid process_name
    if [[ -s "$MONITOR_PIDFILE" ]]; then
        while read -r monitor_pid; do
            if [[ "$(ps -p "$monitor_pid" -o args= 2>/dev/null)" == *mpvpaper-monitor.sh* ]]; then
                terminate_pid "$monitor_pid"
            fi
        done < "$MONITOR_PIDFILE"
    fi
    : > "$MONITOR_PIDFILE"

    if [[ -s "$PIDFILE" ]]; then
        while read -r wallpaper_pid; do
            process_name="$(ps -p "$wallpaper_pid" -o comm= 2>/dev/null || true)"
            if [[ "$process_name" == "mpvpaper" || "$process_name" == "mpvpaper-holder" ]]; then
                log "Stopping wallpaper process $wallpaper_pid ($process_name)"
                terminate_pid "$wallpaper_pid"
                # mpvpaper is launched as our direct child (without -f), so
                # reap it and don't mistake a zombie for a still-running PID.
                wait "$wallpaper_pid" 2>/dev/null || true
            fi
        done < "$PIDFILE"
    fi
    : > "$PIDFILE"
}

stop_video_monitor() {
    local monitor_pid
    local video_monitor_pidfile="${VIDEO_MONITOR_PIDFILE:-$RUNTIME_DIR/ags-wallpaper-window-monitor.pid}"
    if [[ -s "$video_monitor_pidfile" ]]; then
        monitor_pid="$(<"$video_monitor_pidfile")"
        if [[ "$(ps -p "$monitor_pid" -o args= 2>/dev/null)" == *"$SCRIPT_DIR/src/services/wallpaper-daemon.sh"* ]]; then
            terminate_pid "$monitor_pid"
        fi
        rm -f "$video_monitor_pidfile"
    fi
}

stop_managed_hyprpaper() {
    if [[ -s "$HYPERPAPER_PIDFILE" ]]; then
        local hyprpaper_pid
        hyprpaper_pid="$(<"$HYPERPAPER_PIDFILE")"
        if [[ "$(ps -p "$hyprpaper_pid" -o comm= 2>/dev/null)" == "hyprpaper" ]]; then
            terminate_pid "$hyprpaper_pid"
            log "Stopped managed hyprpaper pid $hyprpaper_pid"
        fi
        rm -f "$HYPERPAPER_PIDFILE"
    fi
}

ensure_hyprpaper() {
    if ! command -v hyprpaper >/dev/null 2>&1; then
        log "hyprpaper is unavailable"
        return 1
    fi

    if hyprctl hyprpaper listactive >/dev/null 2>&1; then
        return 0
    fi

    log "Starting hyprpaper for static wallpaper images"
    hyprpaper >> "$LOG_FILE" 2>&1 &
    local hyprpaper_pid=$!
    echo "$hyprpaper_pid" > "$HYPERPAPER_PIDFILE"

    for _ in {1..40}; do
        if ! kill -0 "$hyprpaper_pid" 2>/dev/null; then
            log "hyprpaper exited during startup"
            rm -f "$HYPERPAPER_PIDFILE"
            return 1
        fi
        if hyprctl hyprpaper listactive >/dev/null 2>&1; then
            log "hyprpaper is ready (PID $hyprpaper_pid)"
            return 0
        fi
        sleep 0.1
    done

    log "hyprpaper IPC did not become ready"
    stop_managed_hyprpaper
    return 1
}

cleanup() {
    if [[ -n "${INOTIFY_PID:-}" ]]; then
        kill "$INOTIFY_PID" 2>/dev/null || true
        wait "$INOTIFY_PID" 2>/dev/null || true
    fi
    stop_video_monitor
    stop_wallpapers
    stop_managed_hyprpaper
    rm -f "$FIFO"
    # Remove manager PID file on cleanup
    rm -f "$MANAGER_PID"
}
trap cleanup EXIT
trap 'exit 0' INT TERM

apply_wallpaper() {
    local wallpaper mode is_image monitor
    local -a monitors

    wallpaper=$(jq -r '.wallpaper // empty' "$THEME_FILE" 2>/dev/null || true)
    if [[ -z "$wallpaper" ]]; then
        log "No wallpaper configured; clearing the current desktop background"
        stop_video_monitor
        stop_wallpapers
        if command -v hyprctl >/dev/null 2>&1; then
            hyprctl hyprpaper unload all >> "$LOG_FILE" 2>&1 || true
        fi
        stop_managed_hyprpaper
        return
    fi

    if [[ ! -f "$wallpaper" ]]; then
        log "Wallpaper not found: '$wallpaper'"
        stop_wallpapers
        stop_managed_hyprpaper
        return
    fi

    stop_video_monitor
    stop_wallpapers
    mode=$(cat "$MODEFILE" 2>/dev/null || printf 'extend')
    monitors=()
    for _ in {1..10}; do
        mapfile -t monitors < <(hyprctl monitors -j 2>/dev/null | jq -r --arg mode "$mode" \
            '[.[] | select($mode != "mirror" or .name == "eDP-1") | .name] | .[]')
        ((${#monitors[@]} > 0)) && break
        sleep 0.1
    done

    if ((${#monitors[@]} == 0)); then
        log "No active monitors available for wallpaper"
        return
    fi

    is_image=false
    [[ "$wallpaper" =~ \.(jpg|jpeg|png|webp|bmp|gif)$ ]] && is_image=true
    log "Applying wallpaper on ${#monitors[@]} monitor(s): $wallpaper"

    if [[ "$is_image" != true ]]; then
        stop_managed_hyprpaper
    elif ! ensure_hyprpaper; then
        log "Could not use hyprpaper; static image will fall back to mpvpaper"
    fi

    for monitor in "${monitors[@]}"; do
        if [[ "$is_image" == true ]]; then
            local resolution width height signature cache_key optimized tmp
            resolution=$(hyprctl monitors -j 2>/dev/null | jq -r --arg monitor "$monitor" \
                '.[] | select(.name == $monitor) | "\(.width)x\(.height)"' | head -n1)
            optimized="$wallpaper"

            if [[ "$resolution" =~ ^([0-9]+)x([0-9]+)$ ]] && command -v magick >/dev/null 2>&1; then
                width="${BASH_REMATCH[1]}"
                height="${BASH_REMATCH[2]}"
                mkdir -p "$CACHE_DIR"
                signature="$(stat -c '%s:%Y' -- "$wallpaper" 2>/dev/null || printf 'unknown')"
                cache_key=$(printf '%s\n%s\n%s' "$wallpaper" "$signature" "$resolution" | sha256sum | cut -d' ' -f1)
                optimized="$CACHE_DIR/$cache_key.jpg"

                if [[ ! -s "$optimized" ]]; then
                    tmp="$CACHE_DIR/.$cache_key.$$.jpg"
                    if magick "${wallpaper}[0]" -auto-orient \
                        -resize "${width}x${height}^" -gravity center \
                        -extent "${width}x${height}" -background black \
                        -alpha remove -alpha off -strip -quality 88 "$tmp" \
                        && mv -f -- "$tmp" "$optimized"; then
                        log "Prepared wallpaper thumbnail for $monitor ($resolution): $optimized"
                    else
                        rm -f -- "$tmp"
                        log "Could not optimize wallpaper for $monitor; using original image"
                        optimized="$wallpaper"
                    fi
                fi
            else
                log "Monitor resolution or ImageMagick unavailable for $monitor; using original image"
            fi

            if hyprctl hyprpaper wallpaper "$monitor,$optimized,cover" >> "$LOG_FILE" 2>&1; then
                log "Set static wallpaper with hyprpaper on $monitor: $optimized"
                continue
            fi

            log "hyprpaper failed for $monitor; falling back to mpvpaper"
            mpvpaper -o "loop=yes --panscan=1.0" "$monitor" "$optimized" >> "$LOG_FILE" 2>&1 &
        else
            # Let mpvpaper stop decoding entirely while a fullscreen app is
            # visible; its built-in holder resumes playback when the desktop returns.
            mpvpaper --auto-stop --auto-mode FULL \
                -o "loop-file=inf no-audio hwdec=auto --panscan=1.0" \
                "$monitor" "$wallpaper" >> "$LOG_FILE" 2>&1 &
        fi
        printf '%s\n' "$!" >> "$PIDFILE"
    done
}

rm -f "$FIFO"
if ! mkfifo "$FIFO"; then
    log "Fallo al crear FIFO: $FIFO"
    exit 1
fi

# Monitorizar el directorio del tema y no solo el archivo. Esto captura
# reemplazos atómicos del JSON (temp + mv), que son comunes cuando se escribe
# el archivo desde una app GTK/GLIB.
inotifywait -m --format '%e %f' \
    -e attrib,modify,close_write,move_self,moved_to,create,delete \
    "$THEME_DIR" 2>>"$LOG_FILE" > "$FIFO" &
INOTIFY_PID=$!

log "Wallpaper daemon started (PID $$; manager PID file: $MANAGER_PID)"
log "Waiting for AGS running $AGS_SCRIPT"
AGS_PID=""
for _ in {1..120}; do
    AGS_PID="$(find_ags_pid || true)"
    [[ -n "$AGS_PID" ]] && break
    sleep 0.25
done
if [[ -z "$AGS_PID" ]]; then
    log "AGS process not found; stopping daemon"
    exit 1
fi
log "Watching AGS pid $AGS_PID"
apply_wallpaper

last_apply=0
while true; do
    if ! kill -0 "$AGS_PID" 2>/dev/null || [[ "$(find_ags_pid || true)" != "$AGS_PID" ]]; then
        log "AGS pid $AGS_PID exited; stopping daemon"
        break
    fi

    if read -r -t 1 event file; then
        now=$(date +%s%3N)

        # Ignorar cambios de otros archivos del directorio y actuar solo sobre theme.json
        if [[ -z "$file" || "$file" != "$THEME_NAME" ]]; then
            continue
        fi

        if (( now - last_apply > 200 )); then
            last_apply=$now
            log "Theme file changed ($event), reapplying wallpaper"
            apply_wallpaper
        fi
    fi
done < "$FIFO"
