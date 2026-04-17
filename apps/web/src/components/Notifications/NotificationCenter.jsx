import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PRIMARY_ALPHA } from "../../theme/index.js";
import {
  Badge, IconButton, Drawer, Box, Typography, List, ListItem,
  ListItemText, Chip, Button, Divider, Tooltip, Alert,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useNotifStore } from "../../store/notificaciones.js";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const TIPO_ICON = {
  TICKET_CREADO: "🎫",
  TICKET_ASIGNADO: "👤",
  TICKET_ACTUALIZADO: "🔄",
  TICKET_RESUELTO: "✅",
  TICKET_CANCELADO: "❌",
  TICKET_URGENTE: "🚨",
};

export const NotificationCenter = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas, pedirPermiso, permisoNotif } =
    useNotifStore();

  const handleClick = (n) => {
    marcarLeida(n.id);
    const ticketId = n.data?.ticketId ?? n.data?.id;
    if (ticketId) {
      setOpen(false);
      navigate(`/tickets/${ticketId}`);
    }
  };

  const permisoDenegado = permisoNotif === "denied";
  const permisoPendiente = permisoNotif === "default";

  return (
    <>
      <Tooltip title={permisoDenegado ? "Notificaciones bloqueadas" : "Notificaciones"}>
        <IconButton color="inherit" onClick={() => setOpen(true)}>
          <Badge badgeContent={noLeidas} color="error" max={99}>
            {permisoDenegado ? <NotificationsOffIcon /> : <NotificationsIcon />}
          </Badge>
        </IconButton>
      </Tooltip>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 340, p: 2, height: "100%", display: "flex", flexDirection: "column" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              Notificaciones
            </Typography>
            {noLeidas > 0 && (
              <Button size="small" onClick={marcarTodasLeidas}>
                Marcar todas
              </Button>
            )}
          </Box>
          <Divider sx={{ mb: 1 }} />

          {/* Banner de permiso pendiente */}
          {permisoPendiente && (
            <Alert
              severity="info"
              sx={{ mb: 1, fontSize: 12 }}
              action={
                <Button size="small" color="inherit" onClick={pedirPermiso}>
                  Permitir
                </Button>
              }
            >
              Activa las notificaciones de escritorio
            </Alert>
          )}

          {/* Banner permiso denegado */}
          {permisoDenegado && (
            <Alert severity="warning" sx={{ mb: 1, fontSize: 12 }}>
              Notificaciones bloqueadas en el navegador. Habilítalas desde la configuración del
              sitio en Chrome.
            </Alert>
          )}

          {notificaciones.length === 0 ? (
            <Typography color="text.secondary" sx={{ mt: 4, textAlign: "center" }}>
              Sin notificaciones
            </Typography>
          ) : (
            <List dense sx={{ overflow: "auto", flex: 1 }}>
              {notificaciones.map((n) => (
                <ListItem
                  key={n.id}
                  onClick={() => handleClick(n)}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    bgcolor: n.leida ? "transparent" : PRIMARY_ALPHA(0.07),
                    cursor: (n.data?.ticketId ?? n.data?.id) ? "pointer" : "default",
                    "&:hover": { bgcolor: PRIMARY_ALPHA(0.04) },
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <span>{TIPO_ICON[n.tipo] ?? "📌"}</span>
                        <Typography variant="body2" fontWeight={n.leida ? 400 : 600} sx={{ flex: 1 }}>
                          {n.titulo}
                        </Typography>
                        {!n.leida && (
                          <Chip
                            label="Nuevo"
                            size="small"
                            color="primary"
                            sx={{ height: 16, fontSize: 10 }}
                          />
                        )}
                        {(n.data?.ticketId ?? n.data?.id) && (
                          <OpenInNewIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {n.mensaje && `${n.mensaje} · `}
                        {formatDistanceToNow(new Date(n.id), { addSuffix: true, locale: es })}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Drawer>
    </>
  );
};
