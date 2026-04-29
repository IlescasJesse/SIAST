import { Component } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { ThemeProvider, CssBaseline, Box, Typography, Button } from "@mui/material";
import { theme } from "./theme/index.js";
import { useAuthStore } from "./store/auth.js";

// Captura crashes de componentes hijos y muestra el error en lugar de pantalla negra
class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h6" color="error" gutterBottom>
            Error al cargar la página
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontFamily: "monospace", whiteSpace: "pre-wrap", textAlign: "left", maxWidth: 600, mx: "auto" }}>
            {this.state.error?.message}
          </Typography>
          <Button variant="outlined" onClick={() => this.setState({ error: null })}>
            Reintentar
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
import { iniciarRenovacionProactiva } from "./api/client.js";
import { AppShell } from "./components/Layout/AppShell.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { SolicitudListPage } from "./pages/SolicitudListPage.jsx";
import { SolicitudNewPage } from "./pages/SolicitudNewPage.jsx";
import { SolicitudDetailPage } from "./pages/SolicitudDetailPage.jsx";
import { UsuariosPage } from "./pages/UsuariosPage.jsx";
import { PerfilPage } from "./pages/PerfilPage.jsx";
import { AreasPage } from "./pages/AreasPage.jsx";
import { RecursosPage } from "./pages/RecursosPage.jsx";
import { AdminPage } from "./pages/AdminPage.jsx";

// Ruta protegida: redirige a /login preservando la ruta actual como ?redirect=
const ProtectedRoute = ({ roles }) => {
  const { user, token } = useAuthStore();
  const location = useLocation();
  if (!token || !user) {
    const redirectParam = location.pathname !== "/" ? `?redirect=${encodeURIComponent(location.pathname)}` : "";
    return <Navigate to={`/login${redirectParam}`} replace />;
  }
  if (roles && !roles.includes(user.rol)) return <Navigate to="/solicitudes" replace />;
  return <Outlet />;
};

// Arrancar renovación proactiva de token (una sola vez al cargar la app)
iniciarRenovacionProactiva();

export const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          {/* Pública */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protegidas — con layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>

              {/* Redirect raíz según rol */}
              <Route path="/" element={<RootRedirect />} />

              {/* Recursos Materiales — Admin y Gestor */}
              <Route element={<ProtectedRoute roles={["ADMIN", "GESTOR_RECURSOS_MATERIALES"]} />}>
                <Route path="/recursos" element={<PageErrorBoundary><RecursosPage /></PageErrorBoundary>} />
              </Route>

              {/* Dashboard — solo admin y técnicos */}
              <Route element={<ProtectedRoute roles={["ADMIN", "TECNICO_TI", "TECNICO_SERVICIOS", "MESA_AYUDA", "GESTOR_RECURSOS_MATERIALES"]} />}>
                <Route path="/dashboard" element={<DashboardPage />} />
              </Route>

              {/* Solicitudes */}
              <Route path="/solicitudes" element={<SolicitudListPage />} />
              <Route path="/solicitudes/nueva" element={<SolicitudNewPage />} />
              <Route path="/solicitudes/:id" element={<SolicitudDetailPage />} />

              {/* Usuarios — mantener ruta legacy para compatibilidad */}
              <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
                <Route path="/usuarios" element={<UsuariosPage />} />
                <Route path="/admin/areas" element={<PageErrorBoundary><AreasPage /></PageErrorBoundary>} />
                {/* Módulo de Administración */}
                <Route path="/admin" element={<PageErrorBoundary><AdminPage /></PageErrorBoundary>} />
              </Route>

              {/* Perfil */}
              <Route path="/perfil" element={<PerfilPage />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};

// Redirige según el rol al entrar
const RootRedirect = () => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.rol === "EMPLEADO") return <Navigate to="/solicitudes/nueva" replace />;
  if (user.rol === "GESTOR_RECURSOS_MATERIALES") return <Navigate to="/recursos" replace />;
  return <Navigate to="/dashboard" replace />;
};
