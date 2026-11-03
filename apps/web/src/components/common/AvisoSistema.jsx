import { useEffect, useState } from "react";
import { Alert, AlertTitle, Box, Button, Paper, Typography } from "@mui/material";
import EngineeringIcon from "@mui/icons-material/Engineering";
import { mantenimientoEnCurso, useAvisoSistemaStore } from "../../store/avisoSistema.js";

const SEVERIDAD = {
  MANTENIMIENTO: "warning",
  VERSION: "info",
  INFO: "info",
  URGENTE: "error",
};

const fmt = (iso) =>
  new Date(iso).toLocaleString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

// Se monta una sola vez en App. Muestra el aviso que lanza el monitor del servidor:
// - Mantenimiento en curso → pantalla completa que bloquea el uso.
// - Cualquier otro (mantenimiento programado, versión nueva, info, urgente) → tarjeta flotante.
export const AvisoSistema = () => {
  const aviso = useAvisoSistemaStore((s) => s.aviso);
  const cerrados = useAvisoSistemaStore((s) => s.cerrados);
  const iniciar = useAvisoSistemaStore((s) => s.iniciar);
  const cerrar = useAvisoSistemaStore((s) => s.cerrar);

  // Re-evaluar cada 30 s para que un mantenimiento programado pase a "en curso" solo.
  const [, setTick] = useState(0);
  useEffect(() => {
    iniciar();
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [iniciar]);

  if (!aviso) return null;

  if (mantenimientoEnCurso(aviso)) {
    return (
      <Box
        role="alertdialog"
        aria-live="assertive"
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: 20000,
          bgcolor: "rgba(30, 30, 30, 0.92)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Paper sx={{ maxWidth: 520, width: "100%", p: 4, textAlign: "center", borderRadius: 3 }}>
          <EngineeringIcon sx={{ fontSize: 64, color: "#9D2449", mb: 1 }} />
          <Typography variant="h5" fontWeight={700} gutterBottom>
            {aviso.titulo}
          </Typography>
          {aviso.mensaje && (
            <Typography color="text.secondary" sx={{ whiteSpace: "pre-line", mb: 2 }}>
              {aviso.mensaje}
            </Typography>
          )}
          {aviso.fin && (
            <Typography variant="body2" fontWeight={600}>
              Regreso estimado: {fmt(aviso.fin)}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
            Esta página se recargará sola cuando el servicio vuelva.
          </Typography>
        </Paper>
      </Box>
    );
  }

  if (!aviso.fijo && cerrados.includes(aviso.id)) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 15000,
        width: "calc(100% - 32px)",
        maxWidth: 560,
      }}
    >
      <Alert
        severity={SEVERIDAD[aviso.tipo] ?? "info"}
        variant="filled"
        elevation={6}
        onClose={aviso.fijo ? undefined : () => cerrar(aviso.id)}
        action={
          aviso.tipo === "VERSION" ? (
            <Button color="inherit" size="small" onClick={() => window.location.reload()}>
              Actualizar
            </Button>
          ) : undefined
        }
      >
        <AlertTitle sx={{ fontWeight: 700 }}>
          {aviso.titulo}
          {aviso.version ? ` (v${aviso.version})` : ""}
        </AlertTitle>
        {aviso.mensaje && <Box sx={{ whiteSpace: "pre-line" }}>{aviso.mensaje}</Box>}
        {aviso.tipo === "MANTENIMIENTO" && aviso.inicio && (
          <Box sx={{ mt: 0.5, fontWeight: 600 }}>
            Inicia: {fmt(aviso.inicio)}
            {aviso.fin ? ` · Termina aprox.: ${fmt(aviso.fin)}` : ""}
          </Box>
        )}
      </Alert>
    </Box>
  );
};
