import { Box } from "@mui/material";

// Franja fija para distinguir el ambiente de pruebas (siast-test.local) de producción.
const ES_PRUEBAS = typeof window !== "undefined" && window.location.hostname.includes("siast-test");

export const FranjaPruebas = () => {
  if (!ES_PRUEBAS) return null;
  if (!document.title.startsWith("[PRUEBAS]")) document.title = `[PRUEBAS] ${document.title}`;
  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 18,
        zIndex: 30000,
        pointerEvents: "none",
        bgcolor: "#e65100",
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 2,
        textAlign: "center",
        lineHeight: "18px",
      }}
    >
      AMBIENTE DE PRUEBAS — LOS CAMBIOS AQUÍ NO AFECTAN PRODUCCIÓN
    </Box>
  );
};
