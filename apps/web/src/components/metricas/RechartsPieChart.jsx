import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Box, Typography } from "@mui/material";
import PropTypes from "prop-types";

const TICK_STYLE = { fontFamily: "'Inter', 'Roboto', sans-serif", fontSize: 12 };

/**
 * Wrapper reutilizable para gráficas de pastel (donut) Recharts.
 * @param {{ data: Array<{name:string, value:number, color:string}> }} props
 */
export function RechartsPieChart({ data }) {
  const filtered = data.filter(d => d.value > 0);

  if (filtered.length === 0) {
    return (
      <Box sx={{ width: "100%", height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography variant="body2" color="text.secondary">Sin datos</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          {/* Tooltip ANTES de Legend — z-order Recharts 3.x */}
          <Tooltip
            contentStyle={{
              fontFamily: "'Inter', 'Roboto', sans-serif",
              fontSize: 12,
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 4,
            }}
          />
          <Legend wrapperStyle={TICK_STYLE} />
          <Pie
            data={filtered}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
          >
            {filtered.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
}

RechartsPieChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired,
      color: PropTypes.string.isRequired,
    }),
  ).isRequired,
};
