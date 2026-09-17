import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  Stack,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import { getOrganigrama } from "../api/usuarios.js";
import { LABEL_ROL } from "@stf/shared";

// Organigrama (feedback staff P4-11) — jerarquía fija de niveles pedida por
// Jesse (Administradores > Mesa de Ayuda > Responsables de área > Técnicos >
// Gestores y otros); cada nivel se puebla con usuarios reales de la DB
// (GET /api/usuarios/organigrama), no con datos de ejemplo. Dentro del nivel
// "Responsables de área" y "Técnicos" se agrupan visualmente por área de
// soporte (areaSoporte.nombre) para que se note a qué área pertenece cada
// quien, ya que un mismo nivel mezcla TI, Redes, Mantenimiento, etc.

const COLOR_NIVEL = {
  1: "#9D2449", // guinda SIAST — Administradores
  2: "#1976d2", // Mesa de Ayuda
  3: "#2e7d32", // Responsables
  4: "#ed6c02", // Técnicos
  5: "#616161", // Gestores y otros
};

const SIN_AREA = "Sin área asignada";

const agruparPorArea = (usuarios) => {
  const grupos = new Map();
  for (const u of usuarios) {
    const area = u.areaSoporte?.nombre ?? SIN_AREA;
    if (!grupos.has(area)) grupos.set(area, []);
    grupos.get(area).push(u);
  }
  // Sin área al final, el resto alfabético
  return Array.from(grupos.entries()).sort(([a], [b]) => {
    if (a === SIN_AREA) return 1;
    if (b === SIN_AREA) return -1;
    return a.localeCompare(b);
  });
};

const NivelCard = ({ nivel, nombre, usuarios }) => {
  const color = COLOR_NIVEL[nivel] ?? "#616161";
  const agruparEsteNivel = nivel === 3 || nivel === 4; // Responsables y Técnicos: por área
  const grupos = agruparEsteNivel ? agruparPorArea(usuarios) : [[null, usuarios]];

  return (
    <Paper
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderTop: `4px solid ${color}`,
        borderRadius: 2,
        p: 2.5,
        mb: 2.5,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Chip
          label={nivel}
          size="small"
          sx={{ bgcolor: color, color: "#fff", fontWeight: 700, minWidth: 28 }}
        />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {nombre}
        </Typography>
        <Chip label={usuarios.length} size="small" variant="outlined" />
      </Stack>

      {usuarios.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
          Sin personal activo en este nivel.
        </Typography>
      )}

      {grupos.map(([areaNombre, personas]) => (
        <Box key={areaNombre ?? "todos"} sx={{ mb: agruparEsteNivel ? 2 : 0 }}>
          {agruparEsteNivel && (
            <Typography
              variant="caption"
              sx={{
                display: "block",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                fontWeight: 700,
                color: "text.secondary",
                mb: 1,
              }}
            >
              {areaNombre}
            </Typography>
          )}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            {personas.map((u) => (
              <Paper
                key={u.id}
                variant="outlined"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  minWidth: 220,
                }}
              >
                <Avatar sx={{ bgcolor: color, width: 32, height: 32 }}>
                  <PersonIcon fontSize="small" />
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
                    {u.nombre} {u.apellidos}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {LABEL_ROL[u.rol] ?? u.rol}
                  </Typography>
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      ))}
    </Paper>
  );
};

export const OrganigramaPage = () => {
  const [niveles, setNiveles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getOrganigrama()
      .then((res) => setNiveles(res.data ?? []))
      .catch(() => setError("No se pudo cargar el organigrama."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: "auto" }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Organigrama
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Personal activo agrupado por jerarquía de rol.
      </Typography>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading &&
        !error &&
        niveles.map((n) => (
          <NivelCard key={n.nivel} nivel={n.nivel} nombre={n.nombre} usuarios={n.usuarios} />
        ))}
    </Box>
  );
};
