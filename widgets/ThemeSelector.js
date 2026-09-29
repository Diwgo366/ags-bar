console.log("ThemeSelector.js: module loaded")

import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState, createComputed } from "ags"
import { execAsync } from "ags/process"

const THEMES_DIR = "/home/diego/Dotfiles/scripts/colors"
const AGS_PROJECT = "/home/diego/Proyectos/ags"

const themes = [
    { id: "custom_dotfiles", name: "Custom Dotfiles", desc: "Tema personalizado principal", color: "#9B6BDF" },
    { id: "dracula", name: "Dracula", desc: "Tema oscuro popular", color: "#BD93F9" },
    { id: "nord", name: "Nord", desc: "Tema ártico frío", color: "#88C0D0" },
    { id: "gruvbox", name: "Gruvbox", desc: "Tema retro cálido", color: "#FE8019" },
    { id: "catppuccin", name: "Catppuccin Mocha", desc: "Tema pastel cálido", color: "#F5C2E7" },
    { id: "tokyonight", name: "Tokyo Night", desc: "Tema noche neón", color: "#7AA2F7" },
    { id: "rosepine", name: "Rosé Pine", desc: "Tema rosa suave", color: "#EB6F92" },
    { id: "kanagawa", name: "Kanagawa", desc: "Tema onda japonesa", color: "#7E9CD8" },
]

function ThemeCard({ theme, onSelect, selectedTheme }) {
    const [sel] = selectedTheme
    const isSelected = createComputed(() => sel() === theme.id)
    
    return (
        <button
            class={isSelected.as(s => s ? "theme-card selected" : "theme-card")}
            onClicked={() => onSelect(theme)}
        >
            <box class="card-content" orientation={Gtk.Orientation.VERTICAL}>
                <box class={`color-indicator ${theme.id}`} />
                <label class="theme-name" label={theme.name} />
                <label class="theme-desc" label={theme.desc} />
            </box>
            <label 
                class="check-mark" 
                label={isSelected.as(s => s ? "✓" : "")} 
                visible={isSelected.as(v => v)}
            />
        </button>
    )
}

function LoadingOverlay({ visible, message }) {
    // visible is a tuple [accessor, setter] from createState
    const [vis] = visible
    const [msg] = message
    return (
        <window
            name="theme-loading"
            visible={vis.as(v => v)}
            anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.BOTTOM | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT}
            layer={Astal.Layer.OVERLAY}
            exclusivity={Astal.Exclusivity.EXCLUSIVE}
            application={app}
        >
            <box class="loading-overlay" orientation={Gtk.Orientation.VERTICAL}>
                <box class="spinner-container" orientation={Gtk.Orientation.VERTICAL}>
                    <label class="spinner" label="⟳" />
                    <label class="loading-message" label={msg.as(v => v)} />
                </box>
            </box>
        </window>
    )
}

function ThemeSelectorWindow({ visible, onClose }) {
    const selectedTheme = createState(null)
    const loading = createState(false)
    const loadingMessage = createState("")
    
    const steps = [
        { msg: "Generando configuración Hyprland...", cmd: `cd ${THEMES_DIR} && ./colors.sh --hyprland` },
        { msg: "Aplicando tema GTK...", cmd: `cd ${THEMES_DIR} && ./colors.sh --gtk` },
        { msg: "Generando tema AGS...", cmd: `python3 ${THEMES_DIR}/generate-ags-theme.py ${THEMES_DIR}/colors-universal.json ${AGS_PROJECT}/themes/base.js` },
        { msg: "Reiniciando AGS bar...", cmd: `pkill -f "ags run" && sleep 1 && ags run ${AGS_PROJECT}/proyecto.js &` },
        { msg: "Aplicando temas de apps...", cmd: `cd ${THEMES_DIR} && ./colors.sh --all` },
    ]
    
    const applyTheme = async (themeId) => {
        loading.set(true)
        selectedTheme.set(themeId)
        
        for (let i = 0; i < steps.length; i++) {
            loadingMessage.set(steps[i].msg)
            try {
                await execAsync(["bash", "-c", steps[i].cmd])
            } catch (e) {
                console.error(`Error en paso ${i + 1}:`, e)
            }
            await new Promise(r => setTimeout(r, 300))
        }
        
        loading.set(false)
        loadingMessage.set("")
        
        setTimeout(() => onClose(), 500)
    }
    
    const handleThemeSelect = (theme) => {
        applyTheme(theme.id)
    }
    
    return (
        <window
            name="theme-selector"
            visible={visible}
            anchor={Astal.WindowAnchor.CENTER}
            layer={Astal.Layer.OVERLAY}
            application={app}
            keymode={Astal.Keymode.ON_DEMAND}
            onKeyPressEvent={(_, event) => {
                if (event.keyval === Gdk.KEY_Escape) onClose()
            }}
        >
            <box class="main-container" orientation={Gtk.Orientation.VERTICAL}>
                <LoadingOverlay visible={loading} message={loadingMessage} />
                
                <box class="header" orientation={Gtk.Orientation.VERTICAL}>
                    <label class="title" label="Selector de Temas" />
                    <label class="subtitle" label="Presiona ESC para cancelar" />
                </box>
                
                <box class="themes-grid" orientation={Gtk.Orientation.VERTICAL} spacing={16}>
                    {themes.map((theme, i) => (
                        <box orientation={Gtk.Orientation.HORIZONTAL} spacing={16}>
                            <ThemeCard 
                                theme={theme} 
                                onSelect={handleThemeSelect}
                                selectedTheme={selectedTheme}
                            />
                        </box>
                    ))}
                </box>
                
                <box class="footer">
                    <label class="hint" label="← → navegar  |  ENTER seleccionar  |  ESC cancelar" />
                </box>
            </box>
        </window>
    )
}

// CSS
const css = `
.main-container {
    background: alpha(#1e1e2e, 0.95);
    border-radius: 16px;
    margin: 40px;
    padding: 24px;
    border: 2px solid alpha(#f8f8f2, 0.3);
}

.header {
    margin-bottom: 24px;
}

.title {
    font-family: "CaskaydiaMono Nerd Font", monospace;
    font-size: 28px;
    font-weight: bold;
    color: #f8f8f2;
}

.subtitle {
    font-family: "CaskaydiaMono Nerd Font", monospace;
    font-size: 12px;
    color: #6272a4;
}

.themes-grid {
    min-height: 300px;
}

.grid-inner {
    spacing: 16px;
}

.theme-card {
    background: alpha(#282a36, 0.9);
    border: 2px solid alpha(#44475a, 0.5);
    border-radius: 12px;
    padding: 16px;
    min-width: 200px;
    transition: all 200ms ease;
}

.theme-card:hover {
    border-color: #f8f8f2;
    background: alpha(#333544, 0.95);
}

.theme-card:focus {
    border-color: #9B6BDF;
    outline: none;
}

.theme-card.selected {
    border-color: #9B6BDF;
    box-shadow: 0 0 12px alpha(#9B6BDF, 0.3);
}

.theme-card.selected .color-indicator {
    box-shadow: 0 0 8px currentColor;
}

.card-content {
    spacing: 8px;
}

.color-indicator {
    min-height: 4px;
    border-radius: 4px;
    margin-bottom: 8px;
    transition: all 200ms ease;
}

.theme-name {
    font-family: "CaskaydiaMono Nerd Font", monospace;
    font-size: 16px;
    font-weight: bold;
    color: #f8f8f2;
}

.theme-desc {
    font-family: "CaskaydiaMono Nerd Font", monospace;
    font-size: 11px;
    color: #a0a0b0;
}

.check-mark {
    font-size: 24px;
    color: #50FA7B;
    font-weight: bold;
    margin-top: 8px;
}

.footer {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid alpha(#44475a, 0.5);
}

.hint {
    font-family: "CaskaydiaMono Nerd Font", monospace;
    font-size: 11px;
    color: #6272a4;
}

.loading-overlay {
    background: alpha(#1e1e2e, 0.98);
    border-radius: 16px;
    padding: 24px;
}

.spinner-container {
    spacing: 16px;
}

.spinner {
    font-size: 48px;
    color: #9B6BDF;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.loading-message {
    font-family: "CaskaydiaMono Nerd Font", monospace;
    font-size: 14px;
    color: #f8f8f2;
}

/* Theme color indicators */
.color-indicator.custom_dotfiles { background: #9B6BDF; }
.color-indicator.dracula { background: #BD93F9; }
.color-indicator.nord { background: #88C0D0; }
.color-indicator.gruvbox { background: #FE8019; }
.color-indicator.catppuccin { background: #F5C2E7; }
.color-indicator.tokyonight { background: #7AA2F7; }
.color-indicator.rosepine { background: #EB6F92; }
.color-indicator.kanagawa { background: #7E9CD8; }
`

export function getThemeSelector() {
    const [visible, setVisible] = createState(true)
    console.log("ThemeSelector: getThemeSelector called, visible =", visible.as(v => v))
    
    const window = (
        <ThemeSelectorWindow 
            visible={visible.as(v => v)}
            onClose={() => setVisible(false)}
        />
    )
    
    console.log("ThemeSelector: window created, returning", { window })
    
    return {
        window,
        toggle: () => setVisible(v => !v),
        show: () => setVisible(true),
        hide: () => setVisible(false),
    }
}