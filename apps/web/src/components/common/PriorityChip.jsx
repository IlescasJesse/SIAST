import { Chip } from "@mui/material";
import { TICKET_PRIORIDAD_COLOR } from "../../theme/index.js";

const LABELS = { BAJA: "Baja", MEDIA: "Media", ALTA: "Alta", URGENTE: "🚨 Urgente" };

export const PriorityChip = ({ prioridad, size = "small" }) => (
  <Chip
    label={LABELS[prioridad] ?? prioridad}
    size={size}
    sx={{
      bgcolor: `${TICKET_PRIORIDAD_COLOR[prioridad] ?? "#888"}22`,
      color: TICKET_PRIORIDAD_COLOR[prioridad] ?? "#888",
      border: `1px solid ${TICKET_PRIORIDAD_COLOR[prioridad] ?? "#888"}55`,
      fontWeight: 600,
    }}
  />
);
