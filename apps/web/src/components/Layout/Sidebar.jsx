import { useNavigate, useLocation } from "react-router-dom";
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Box, Typography, Divider, Tooltip,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import PeopleIcon from "@mui/icons-material/People";
import PersonIcon from "@mui/icons-material/Person";
import { useAuthStore } from "../../store/auth.js";

const DRAWER_W = 220;

const menuItems = (rol) => {
  const items = [
    { label: "Dashboard", icon: <DashboardIcon />, to: "/dashboard", roles: ["ADMIN", "TECNICO_INFORMATICO", "TECNICO_SERVICIOS", "MESA_AYUDA"] },
    { label: "Tickets", icon: <ConfirmationNumberIcon />, to: "/tickets", roles: ["ADMIN", "TECNICO_INFORMATICO", "TECNICO_SERVICIOS", "MESA_AYUDA"] },
    { label: "Nuevo Ticket", icon: <AddCircleOutlineIcon />, to: "/tickets/nuevo", roles: ["ADMIN", "MESA_AYUDA", "EMPLEADO"] },
    { label: "Usuarios", icon: <PeopleIcon />, to: "/usuarios", roles: ["ADMIN"] },
    { label: "Perfil", icon: <PersonIcon />, to: "/perfil", roles: ["ADMIN", "TECNICO_INFORMATICO", "TECNICO_SERVICIOS", "MESA_AYUDA", "EMPLEADO"] },
  ];
  return items.filter((i) => i.roles.includes(rol));
};

export const Sidebar = ({ open, onClose, variant = "permanent" }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuthStore();

  const content = (
    <Box sx={{ width: DRAWER_W, height: "100%", display: "flex", flexDirection: "column", pt: 1 }}>
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="caption" color="primary.main" fontWeight={700} letterSpacing={2} sx={{ textTransform: "uppercase" }}>
          SIAST
        </Typography>
        <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: 10 }}>
          Secretaría de Finanzas
        </Typography>
      </Box>
      <Divider sx={{ mb: 1 }} />
      <List dense sx={{ flex: 1 }}>
        {menuItems(user?.rol ?? "").map((item) => (
          <ListItemButton
            key={item.to}
            selected={pathname.startsWith(item.to) && item.to !== "/"}
            onClick={() => { navigate(item.to); onClose?.(); }}
            sx={{ borderRadius: 2, mx: 1, mb: 0.5 }}
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
    <Drawer variant="permanent" sx={{ width: DRAWER_W, flexShrink: 0, "& .MuiDrawer-paper": { width: DRAWER_W, boxSizing: "border-box" } }}>
      {content}
    </Drawer>
  );
};
