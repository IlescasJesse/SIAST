import { createTheme } from "@mui/material";

// ── Color primario institucional ──────────────────────────────────────────────
// Cambiar SOLO este valor para actualizar toda la paleta derivada del sistema.
// hsl(342, 62%, 38%) ≈ #9d2449 — guinda/granate Secretaría de Finanzas Oaxaca
export const PRIMARY_H = 342;   // Hue
export const PRIMARY_S = 62;    // Saturation %
export const PRIMARY_L = 38;    // Lightness %

/** Genera una cadena hsl() variando los tres parámetros del primario */
export function primaryVariant(dH = 0, dS = 0, dL = 0, alpha = 1) {
  const h = ((PRIMARY_H + dH) % 360 + 360) % 360;
  const s = Math.max(0, Math.min(100, PRIMARY_S + dS));
  const l = Math.max(0, Math.min(100, PRIMARY_L + dL));
  return alpha < 1
    ? `hsla(${h}, ${s}%, ${l}%, ${alpha})`
    : `hsl(${h}, ${s}%, ${l}%)`;
}

// Color primario main — coincide con #9d2449
export const PRIMARY_MAIN = primaryVariant();
// Derivados para uso directo en componentes que no tienen acceso al tema MUI
export const PRIMARY_LIGHT = primaryVariant(0, -10, +26);   // ≈ #c44e71
export const PRIMARY_DARK  = primaryVariant(0,  +4, -10);   // ≈ #6e1832
export const PRIMARY_ALPHA = (a) => primaryVariant(0, 0, 0, a);

// ── Paleta de áreas — 12 variantes derivadas del primario ────────────────────
// Todas son variaciones de tono/saturación/luminosidad alrededor del guinda.
// Cambiando PRIMARY_H/S/L arriba cambian todos los colores de áreas.
export const AREA_PALETTE_DERIVED = [
  primaryVariant(  0,   0,   0),    // guinda base
  primaryVariant(-20, -15, +18),    // rosa tenue
  primaryVariant(+20, +10, -10),    // ciruela oscura
  primaryVariant(-40, -20, +28),    // rosado claro
  primaryVariant(+15,  -5, +12),    // magenta medio
  primaryVariant(-60,  -8, +20),    // lavanda rosada
  primaryVariant(+30, +15,  -8),    // morado violáceo
  primaryVariant(  0, +18, +22),    // coral rosado
  primaryVariant(-80, -15, +30),    // malva pálido
  primaryVariant(+40,  -5,  -5),    // vino rojizo
  primaryVariant(-10,  -8, +38),    // rosa muy claro
  primaryVariant(+25, +20,  +8),    // magenta vivo
];

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: PRIMARY_MAIN,
      light: PRIMARY_LIGHT,
      dark: PRIMARY_DARK,
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#6c6e6d",
      light: "#9a9c9b",
      dark: "#414342",
      contrastText: "#ffffff",
    },
    background: {
      default: "#f5f5f7",
      paper: "#ffffff",
    },
    error: { main: "#d32f2f" },
    warning: { main: "#ed6c02" },
    success: { main: "#2e7d32" },
    info: { main: "#0288d1" },
    text: {
      primary: "#1a1a1a",
      secondary: "#5a5a5a",
    },
    divider: "rgba(0,0,0,0.12)",
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 4 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 4, textTransform: "none", fontWeight: 600 },
        containedPrimary: {
          backgroundColor: PRIMARY_MAIN,
          "&:hover": { backgroundColor: PRIMARY_DARK },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          border: "1px solid rgba(0,0,0,0.08)",
          backgroundImage: "none",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
        elevation1: { boxShadow: "0 1px 4px rgba(0,0,0,0.08)" },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600 } },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: PRIMARY_MAIN,
          color: "#ffffff",
          borderBottom: "none",
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-head": {
            backgroundColor: PRIMARY_MAIN,
            color: "#ffffff",
            fontWeight: 700,
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": {
            backgroundColor: PRIMARY_ALPHA(0.04),
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          "&.Mui-focused": { color: PRIMARY_MAIN },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: PRIMARY_MAIN,
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          "&.Mui-selected": {
            backgroundColor: PRIMARY_ALPHA(0.08),
            color: PRIMARY_MAIN,
            "& .MuiListItemIcon-root": { color: PRIMARY_MAIN },
            "&:hover": { backgroundColor: PRIMARY_ALPHA(0.12) },
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: "#ffffff",
          borderRight: "1px solid rgba(0,0,0,0.10)",
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: "rgba(0,0,0,0.10)" },
      },
    },
  },
});

export const TICKET_ESTADO_COLOR = {
  ABIERTO:     "#16a34a",  // verde   — nueva, esperando
  ASIGNADO:    "#ca8a04",  // amarillo — asignada, pendiente inicio
  EN_PROGRESO: "#ea580c",  // naranja  — en atención activa
  RESUELTO:    "#9e9e9e",  // gris     — cerrada satisfactoriamente
  CANCELADO:   "#bdbdbd",  // gris claro — descartada
};

export const TICKET_PRIORIDAD_COLOR = {
  BAJA:    "#16a34a",  // verde   — sin urgencia
  MEDIA:   "#ca8a04",  // amarillo — atención pronto
  ALTA:    "#ea580c",  // naranja  — requiere atención hoy
  URGENTE: "#dc2626",  // rojo     — atención inmediata
};

export const CATEGORIA_AREA_COLOR = {
  TECNOLOGIAS:        "#1565c0",
  SERVICIOS:          "#2e7d32",
  RECURSOS_MATERIALES:"#e65100",
};

// ── Helpers para consumir el primario fuera de MUI ──────────────────────────
// Importar PRIMARY_MAIN / PRIMARY_DARK / PRIMARY_LIGHT / PRIMARY_ALPHA / primaryVariant
// desde "@/theme" (o ruta relativa) en cualquier componente que necesite el color
// sin acceso al tema MUI (SVGs, canvas, iframes, estilos inline, etc.).

