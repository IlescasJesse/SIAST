import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, Tooltip,
} from "@mui/material";
import { formatLabel } from "./utils.js";
import PropTypes from "prop-types";

/**
 * Tabla de rendimiento de técnicos para Tab Por Responsable.
 * Filas clickeables → drill-down al tab Por Técnico.
 * @param {{ rows: import('@stf/shared').RendimientoTecnico[], onRowClick: Function }} props
 */
export function RendimientoTecnicoTable({ rows, onRowClick }) {
  if (!rows || rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
        No hay técnicos registrados en esta área
      </Typography>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: "primary.main" }}>
            {["Técnico", "Completados", "Tiempo promedio", "Resuelto / Cancelado"].map((h) => (
              <TableCell key={h} sx={{ color: "common.white", fontWeight: 700, fontSize: 12 }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <Tooltip key={row.id} title={`Ver detalle de ${row.nombre} ${row.apellidos}`} placement="left">
              <TableRow
                onClick={() => onRowClick(row)}
                sx={{
                  cursor: "pointer",
                  "&:hover": { bgcolor: "primary.main", opacity: 0.04 },
                  "& td": { fontSize: 13 },
                }}
              >
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>
                    {row.nombre} {row.apellidos}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatLabel(row.rol)}
                  </Typography>
                </TableCell>
                <TableCell>{row.ticketsCompletados}</TableCell>
                <TableCell>
                  {row.tiempoPromedioHoras != null
                    ? `${row.tiempoPromedioHoras}h`
                    : "—"}
                </TableCell>
                <TableCell>
                  {row.ratioResueltosCancelados != null
                    ? `${Math.round(row.ratioResueltosCancelados * 100)}%`
                    : "—"}
                </TableCell>
              </TableRow>
            </Tooltip>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

RendimientoTecnicoTable.propTypes = {
  rows: PropTypes.array.isRequired,
  onRowClick: PropTypes.func.isRequired,
};
