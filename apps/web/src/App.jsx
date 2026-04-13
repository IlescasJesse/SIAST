import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { theme } from "./theme/index.js";
import { useAuthStore } from "./store/auth.js";
import { AppShell } from "./components/Layout/AppShell.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { TicketListPage } from "./pages/TicketListPage.jsx";
import { TicketNewPage } from "./pages/TicketNewPage.jsx";
import { TicketDetailPage } from "./pages/TicketDetailPage.jsx";
import { UsuariosPage } from "./pages/UsuariosPage.jsx";
import { PerfilPage } from "./pages/PerfilPage.jsx";

// Ruta protegida: redirige a /login preservando la ruta actual como ?redirect=
const ProtectedRoute = ({ roles }) => {
  const { user, token } = useAuthStore();
  const location = useLocation();
  if (!token || !user) {
    const redirectParam = location.pathname !== "/" ? `?redirect=${encodeURIComponent(location.pathname)}` : "";
    return <Navigate to={`/login${redirectParam}`} replace />;
  }
  if (roles && !roles.includes(user.rol)) return <Navigate to="/tickets" replace />;
  return <Outlet />;
};

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

              {/* Dashboard — solo admin y técnicos */}
              <Route element={<ProtectedRoute roles={["ADMIN", "TECNICO_INFORMATICO", "TECNICO_SERVICIOS", "MESA_AYUDA"]} />}>
                <Route path="/dashboard" element={<DashboardPage />} />
              </Route>

              {/* Tickets */}
              <Route path="/tickets" element={<TicketListPage />} />
              <Route path="/tickets/nuevo" element={<TicketNewPage />} />
              <Route path="/tickets/:id" element={<TicketDetailPage />} />

              {/* Usuarios — solo admin */}
              <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
                <Route path="/usuarios" element={<UsuariosPage />} />
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
  if (user.rol === "EMPLEADO") return <Navigate to="/tickets/nuevo" replace />;
  return <Navigate to="/dashboard" replace />;
};
