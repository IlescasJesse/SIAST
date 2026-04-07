import { createTheme } from "@mui/material";

// Paleta institucional Secretaría de Finanzas Oaxaca
// Primario: #9d2449 (guinda/granate)
// Secundario: #6c6e6d (gris institucional)

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#9d2449",
      light: "#c44e71",
      dark: "#6e1832",
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
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, textTransform: "none", fontWeight: 600 },
        containedPrimary: {
          backgroundColor: "#9d2449",
          "&:hover": { backgroundColor: "#6e1832" },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
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
          backgroundColor: "#9d2449",
          color: "#ffffff",
          borderBottom: "none",
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-head": {
            backgroundColor: "#9d2449",
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
            backgroundColor: "rgba(157,36,73,0.04)",
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          "&.Mui-focused": { color: "#9d2449" },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#9d2449",
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          "&.Mui-selected": {
            backgroundColor: "rgba(157,36,73,0.08)",
            color: "#9d2449",
            "& .MuiListItemIcon-root": { color: "#9d2449" },
            "&:hover": { backgroundColor: "rgba(157,36,73,0.12)" },
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
  ABIERTO: "#1565c0",
  ASIGNADO: "#e65100",
  EN_PROGRESO: "#6a1b9a",
  RESUELTO: "#2e7d32",
  CANCELADO: "#616161",
};

export const TICKET_PRIORIDAD_COLOR = {
  BAJA: "#546e7a",
  MEDIA: "#0277bd",
  ALTA: "#e65100",
  URGENTE: "#c62828",
};
