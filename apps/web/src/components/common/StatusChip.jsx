import { Chip } from "@mui/material";
import { TICKET_ESTADO_COLOR } from "../../theme/index.js";

const LABELS = {
  ABIERTO: "Abierto",
  ASIGNADO: "Asignado",
  EN_PROGRESO: "En Progreso",
  RESUELTO: "Resuelto",
  CANCELADO: "Cancelado",
};

export const StatusChip = ({ estado, size = "small" }) => (
  <Chip
    label={LABELS[estado] ?? estado}
    size={size}
    sx={{
      bgcolor: `${TICKET_ESTADO_COLOR[estado] ?? "#666"}22`,
      color: TICKET_ESTADO_COLOR[estado] ?? "#666",
      border: `1px solid ${TICKET_ESTADO_COLOR[estado] ?? "#666"}55`,
      fontWeight: 600,
    }}
  />
);
