import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Box } from "@mui/material";
import PropTypes from "prop-types";

const TICK_STYLE = { fontFamily: "'Inter', 'Roboto', sans-serif", fontSize: 12 };

/**
 * Wrapper reutilizable para gráficas de barras Recharts.
 * @param {{ data: object[], xKey: string, bars: Array<{key:string, label:string, color:string}> }} props
 */
export function RechartsBarChart({ data, xKey, bars }) {
  return (
    <Box sx={{ width: "100%", height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barSize={28} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
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
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

RechartsBarChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  xKey: PropTypes.string.isRequired,
  bars: PropTypes.arrayOf(
    PropTypes.shape({ key: PropTypes.string, label: PropTypes.string, color: PropTypes.string }),
  ).isRequired,
};
