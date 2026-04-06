import { createTheme } from "@mui/material";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#1565C0", light: "#1976D2", dark: "#0D47A1" },
    secondary: { main: "#00897B" },
    background: { default: "#0A0E1A", paper: "#111827" },
    error: { main: "#ef5350" },
    warning: { main: "#FF9800" },
    success: { main: "#4CAF50" },
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
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.08)",
          backgroundImage: "none",
        },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: "none" } },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600 } },
    },
  },
});

export const TICKET_ESTADO_COLOR = {
  ABIERTO: "#2196F3",
  ASIGNADO: "#FF9800",
  EN_PROGRESO: "#9C27B0",
  RESUELTO: "#4CAF50",
  CANCELADO: "#757575",
};

export const TICKET_PRIORIDAD_COLOR = {
  BAJA: "#78909C",
  MEDIA: "#29B6F6",
  ALTA: "#FF9800",
  URGENTE: "#F44336",
};
