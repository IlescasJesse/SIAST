import { Chip } from "@mui/material";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import RemoveIcon from "@mui/icons-material/Remove";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import { TICKET_PRIORIDAD_COLOR } from "../../theme/index.js";

const LABELS = { BAJA: "Baja", MEDIA: "Media", ALTA: "Alta", URGENTE: "Urgente" };
const ICONS = {
  BAJA:    <ArrowDownwardIcon sx={{ fontSize: 14 }} />,
  MEDIA:   <RemoveIcon sx={{ fontSize: 14 }} />,
  ALTA:    <KeyboardArrowUpIcon sx={{ fontSize: 14 }} />,
  URGENTE: <PriorityHighIcon sx={{ fontSize: 14 }} />,
};

export const PriorityChip = ({ prioridad, size = "small" }) => (
  <Chip
    icon={ICONS[prioridad]}
    label={LABELS[prioridad] ?? prioridad}
    size={size}
    sx={{
      bgcolor: `${TICKET_PRIORIDAD_COLOR[prioridad] ?? "#888"}22`,
      color: TICKET_PRIORIDAD_COLOR[prioridad] ?? "#888",
      border: `1px solid ${TICKET_PRIORIDAD_COLOR[prioridad] ?? "#888"}55`,
      fontWeight: 600,
      "& .MuiChip-icon": { color: "inherit" },
    }}
  />
);
