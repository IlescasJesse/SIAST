import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, Box, Tooltip,
} from "@mui/material";
import { SlaIndicator } from "./SlaIndicator.jsx";
import PropTypes from "prop-types";

/**
 * Tabla de eficiencia de responsables para Tab Global (ADMIN).
 * Filas clickeables → drill-down al tab Por Responsable del área.
 * @param {{ rows: import('@stf/shared').EficienciaResponsable[], onRowClick: Function }} props
 */
export function EficienciaTable({ rows, onRowClick }) {
  if (!rows || rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
        Sin datos para el período seleccionado
      </Typography>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: "primary.main" }}>
            {["Responsable", "Resueltos", "Tiempo promedio", "SLA %"].map((h) => (
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
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {row.nombre} {row.apellidos}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.areaNombre}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>{row.ticketsResueltos}</TableCell>
                <TableCell>
                  {row.tiempoPromedioHoras != null
                    ? `${row.tiempoPromedioHoras}h`
                    : "—"}
                </TableCell>
                <TableCell>
                  <SlaIndicator pct={row.slaGlobal} />
                </TableCell>
              </TableRow>
            </Tooltip>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

EficienciaTable.propTypes = {
  rows: PropTypes.array.isRequired,
  onRowClick: PropTypes.func.isRequired,
};
