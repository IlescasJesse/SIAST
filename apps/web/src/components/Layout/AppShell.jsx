import { useState } from "react";
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

const DRAWER_W = 220;

export const AppShell = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { desconectar } = useNotifStore();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleLogout = () => {
    desconectar();
    logout();
    navigate("/login");
  };

  return (
    <Box sx={{ display: "flex", height: "100vh", bgcolor: "background.default" }}>
      {/* Sidebar */}
      {isMobile ? (
        <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} variant="temporary" />
      ) : (
        <Sidebar />
      )}

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* AppBar */}
        <AppBar position="static" elevation={1}>
          <Toolbar variant="dense">
            {isMobile && (
              <IconButton edge="start" color="inherit" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
                <MenuIcon />
              </IconButton>
            )}
            <Typography variant="subtitle1" fontWeight={700} color="inherit" sx={{ flex: 1 }}>
              {user?.rol === "EMPLEADO" ? "Mesa de Ayuda — SIAST" : "SIAST Admin"}
            </Typography>

            <NotificationCenter />

            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small" sx={{ ml: 1 }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.dark", color: "#ffffff", fontSize: 14 }}>
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

        {/* Contenido */}
        <Box sx={{ flex: 1, overflow: "auto", p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};
