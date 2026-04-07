import { useState } from "react";
import {
  Badge, IconButton, Drawer, Box, Typography, List, ListItem,
  ListItemText, Chip, Button, Divider, Tooltip,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
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
  const { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas } = useNotifStore();

  return (
    <>
      <Tooltip title="Notificaciones">
        <IconButton color="inherit" onClick={() => setOpen(true)}>
          <Badge badgeContent={noLeidas} color="error" max={99}>
            <NotificationsIcon />
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

          {notificaciones.length === 0 ? (
            <Typography color="text.secondary" sx={{ mt: 4, textAlign: "center" }}>
              Sin notificaciones
            </Typography>
          ) : (
            <List dense sx={{ overflow: "auto", flex: 1 }}>
              {notificaciones.map((n) => (
                <ListItem
                  key={n.id}
                  onClick={() => marcarLeida(n.id)}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    bgcolor: n.leida ? "transparent" : "rgba(157,36,73,0.07)",
                    cursor: "pointer",
                    "&:hover": { bgcolor: "rgba(157,36,73,0.04)" },
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <span>{TIPO_ICON[n.tipo] ?? "📌"}</span>
                        <Typography variant="body2" fontWeight={n.leida ? 400 : 600}>
                          {n.titulo}
                        </Typography>
                        {!n.leida && <Chip label="Nuevo" size="small" color="primary" sx={{ height: 16, fontSize: 10 }} />}
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
