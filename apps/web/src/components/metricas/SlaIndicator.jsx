import { Chip } from "@mui/material";
import PropTypes from "prop-types";

/**
 * Chip indicador de SLA con colores semánticos.
 * pct == null → Sin datos (default)
 * pct >= 90  → success (SLA OK)
 * pct 70-89  → warning (En riesgo)
 * pct < 70   → error (Incumplido)
 */
export function SlaIndicator({ pct }) {
  if (pct == null) {
    return <Chip label="Sin datos" color="default" size="small" variant="outlined" />;
  }
  const config =
    pct >= 90
      ? { label: `SLA OK ${pct}%`, color: "success" }
      : pct >= 70
      ? { label: `En riesgo ${pct}%`, color: "warning" }
      : { label: `Incumplido ${pct}%`, color: "error" };

  return <Chip label={config.label} color={config.color} size="small" variant="filled" />;
}

SlaIndicator.propTypes = { pct: PropTypes.number.isRequired };
