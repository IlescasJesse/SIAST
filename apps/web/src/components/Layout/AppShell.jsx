import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import {
  Box, AppBar, Toolbar, Typography, IconButton,
  Avatar, Menu, MenuItem, Divider, useMediaQuery, useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuthStore } from "../../store/auth.js";
import { useNotifStore } from "../../store/notificaciones.js";
import { Sidebar } from "./Sidebar.jsx";
import { NotificationCenter } from "../Notifications/NotificationCenter.jsx";
import backgroundImg from "../../img/background-img.jpg";

const DRAWER_W = 220;

export const AppShell = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { conectar, desconectar } = useNotifStore();
  const theme = useTheme();

  useEffect(() => {
    if (user) conectar(user);
  }, [user?.id]);
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleLogout = () => {
    desconectar();
    logout();
    navigate("/login");
  };

  return (
    <Box
      sx={{
        display: "flex",
        height: "100vh",
        backgroundImage: `url(${backgroundImg})`,
        backgroundSize: "auto",
        backgroundRepeat: "repeat",
      }}
    >
      {/* Sidebar */}
      {isMobile ? (
        <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} variant="temporary" />
      ) : (
        <Sidebar desktopOpen={sidebarOpen} />
      )}

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* AppBar */}
        <AppBar position="static" elevation={0} sx={{ bgcolor: "#6C6E6D", flexShrink: 0, boxShadow: "none" }}>
          <Toolbar variant="dense" sx={{ minHeight: 52, px: 2 }}>
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => isMobile ? setMobileOpen(true) : setSidebarOpen(v => !v)}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ flex: 1 }} />
            <NotificationCenter />
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small" sx={{ ml: 1 }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: "#9D2449", color: "#ffffff", fontSize: 14 }}>
                {(user?.nombre?.[0] ?? "U").toUpperCase()}
              </Avatar>
            </IconButton>

            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
              <MenuItem disabled>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{user?.nombre ?? user?.nombreCompleto}</Typography>
                  <Typography variant="caption" color="text.secondary">{user?.rol}</Typography>
                </Box>
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => { setAnchorEl(null); navigate("/perfil"); }}>Perfil</MenuItem>
              <MenuItem onClick={handleLogout}>
                <LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Cerrar sesión
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* Contenido — fondo semi-transparente para legibilidad */}
        <Box sx={{ flex: 1, overflow: "auto", p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};
