import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Box, Typography } from "@mui/material";
import PropTypes from "prop-types";

const TICK_STYLE = { fontFamily: "'Inter', 'Roboto', sans-serif", fontSize: 12 };

/**
 * Wrapper reutilizable para gráficas de líneas Recharts.
 * @param {{ data: object[], xKey: string, lines: Array<{key:string, label:string, color:string}> }} props
 */
export function RechartsLineChart({ data, xKey, lines }) {
  if (!data || data.length === 0) {
    return (
      <Box sx={{ width: "100%", height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography variant="body2" color="text.secondary">Sin datos para este período</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
          <XAxis dataKey={xKey} tick={TICK_STYLE} />
          <YAxis tick={TICK_STYLE} />
          {/* Tooltip ANTES de Legend — z-order Recharts 3.x */}
          <Tooltip
            contentStyle={{
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 4,
              fontFamily: "'Inter', 'Roboto', sans-serif",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={TICK_STYLE} />
          {lines.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}

RechartsLineChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  xKey: PropTypes.string.isRequired,
  lines: PropTypes.arrayOf(
    PropTypes.shape({ key: PropTypes.string, label: PropTypes.string, color: PropTypes.string }),
  ).isRequired,
};
