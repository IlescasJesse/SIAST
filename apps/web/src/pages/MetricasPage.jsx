import { Box, Typography } from "@mui/material";
import BarChartIcon from "@mui/icons-material/BarChart";
import { useAuthStore } from "../store/auth.js";
import { MetricasOperacionalesSection } from "../components/metricas/MetricasOperacionalesSection.jsx";

export const MetricasPage = () => {
  const { user } = useAuthStore();

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <BarChartIcon sx={{ color: "primary.main", fontSize: 28 }} />
        <Box>
          <Typography variant="h5" fontWeight={700} lineHeight={1}>
            Métricas Operacionales
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Indicadores de desempeño y SLA
          </Typography>
        </Box>
      </Box>

      <MetricasOperacionalesSection
        rol={user?.rol ?? ""}
        areaSoporteId={user?.areaSoporteId}
        userId={user?.id}
      />
    </Box>
  );
};
