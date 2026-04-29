import { useNavigate, useLocation } from "react-router-dom";
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Box, Typography, Divider, Tooltip,
} from "@mui/material";
import siastLogo from "../../img/siast-logo.png";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import PersonIcon from "@mui/icons-material/Person";
import EditLocationAltIcon from "@mui/icons-material/EditLocationAlt";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { useAuthStore } from "../../store/auth.js";

const DRAWER_W = 220;

const menuItems = (rol) => {
  const items = [
    { label: "Estadísticas", icon: <DashboardIcon />, to: "/dashboard", roles: ["ADMIN", "TECNICO_TI", "TECNICO_SERVICIOS", "MESA_AYUDA", "GESTOR_RECURSOS_MATERIALES"] },
    { label: "Solicitudes", icon: <ConfirmationNumberIcon />, to: "/solicitudes", roles: ["ADMIN", "TECNICO_TI", "TECNICO_SERVICIOS", "MESA_AYUDA", "GESTOR_RECURSOS_MATERIALES"] },
    { label: "Nueva Solicitud", icon: <AddCircleOutlineIcon />, to: "/solicitudes/nueva", roles: ["ADMIN", "MESA_AYUDA", "EMPLEADO"] },
    { label: "Mapa de Áreas", icon: <EditLocationAltIcon />, to: "/admin/areas", roles: ["ADMIN"] },
    { label: "Recursos", icon: <Inventory2Icon />, to: "/recursos", roles: ["ADMIN", "GESTOR_RECURSOS_MATERIALES"] },
    { label: "Administración", icon: <AdminPanelSettingsIcon />, to: "/admin", roles: ["ADMIN"] },
    { label: "Perfil", icon: <PersonIcon />, to: "/perfil", roles: ["ADMIN", "TECNICO_TI", "TECNICO_SERVICIOS", "MESA_AYUDA", "GESTOR_RECURSOS_MATERIALES", "EMPLEADO"] },
  ];
  return items.filter((i) => i.roles.includes(rol));
};

export const Sidebar = ({ open, onClose, variant = "permanent", desktopOpen = true }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuthStore();

  const content = (
    <Box sx={{ width: DRAWER_W, height: "100%", display: "flex", flexDirection: "column" }}>

      {/* Cabecera — fondo guinda, clickeable al home */}
      <Box
        onClick={() => { navigate("/"); onClose?.(); }}
        sx={{
          bgcolor: "#9D2449",
          px: 2.5,
          minHeight: 52,
          display: "flex",
          alignItems: "center",
          gap: 1.2,
          cursor: "pointer",
          "&:hover": { bgcolor: "#891f3e" },
          transition: "background-color 0.15s",
        }}
      >
        <Box
          component="img"
          src={siastLogo}
          alt="SIAST"
          sx={{ height: 30, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)", flexShrink: 0 }}
        />
        <Box>
          <Typography sx={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: "1rem", color: "#fff", letterSpacing: 2, lineHeight: 1 }}>
            SIAST
          </Typography>
          <Typography sx={{ fontSize: 8.5, color: "rgba(255,255,255,0.7)", letterSpacing: 0.4, mt: 0.2 }}>
            Secretaría de Finanzas
          </Typography>
        </Box>
      </Box>

      <Divider />
      <List dense sx={{ flex: 1, pt: 1 }}>
        {menuItems(user?.rol ?? "").map((item) => (
          <ListItemButton
            key={item.to}
            selected={pathname.startsWith(item.to) && item.to !== "/"}
            onClick={() => { navigate(item.to); onClose?.(); }}
            sx={{ borderRadius: "4px", mx: 1, mb: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: "text.secondary" }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  if (variant === "temporary") {
    return (
      <Drawer open={open} onClose={onClose} variant="temporary" sx={{ "& .MuiDrawer-paper": { width: DRAWER_W } }}>
        {content}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: desktopOpen ? DRAWER_W : 0,
        flexShrink: 0,
        transition: "width 0.25s ease",
        "& .MuiDrawer-paper": {
          width: DRAWER_W,
          boxSizing: "border-box",
          border: "none",
          transform: desktopOpen ? "translateX(0)" : `translateX(-${DRAWER_W}px)`,
          transition: "transform 0.25s ease",
        },
      }}
    >
      {content}
    </Drawer>
  );
};
