import { Box } from "@mui/material";
import { useAuthStore } from "../store/auth.js";
import { MetricasOperacionalesSection } from "../components/metricas/MetricasOperacionalesSection.jsx";

export const MetricasPage = () => {
  const { user } = useAuthStore();

  return (
    <Box>
      <MetricasOperacionalesSection
        rol={user?.rol ?? ""}
        areaSoporteId={user?.areaSoporteId}
        userId={user?.id}
      />
    </Box>
  );
};
