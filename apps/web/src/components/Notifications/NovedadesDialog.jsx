import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useNotifStore } from "../../store/notificaciones.js";

// Ventana "¿Qué hay de nuevo?" — se abre sola la primera vez que el usuario ve
// una novedad de versión, y otra vez si la abre desde el centro de notificaciones.
export const NovedadesDialog = () => {
  const novedad = useNotifStore((s) => s.novedadAbierta);
  const cerrar = useNotifStore((s) => s.cerrarNovedad);

  return (
    <Dialog open={Boolean(novedad)} onClose={cerrar} maxWidth="sm" fullWidth>
      {novedad && (
        <>
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1 }}>
            <AutoAwesomeIcon sx={{ color: "#9D2449" }} />
            <Box sx={{ flex: 1 }}>{novedad.titulo}</Box>
            {novedad.version && (
              <Chip label={`v${novedad.version}`} size="small" color="primary" />
            )}
          </DialogTitle>
          <DialogContent>
            <Typography variant="caption" color="text.secondary">
              {format(new Date(novedad.createdAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
            </Typography>
            {novedad.mensaje && (
              <Typography sx={{ mt: 1, whiteSpace: "pre-line" }}>{novedad.mensaje}</Typography>
            )}
            <List dense sx={{ mt: 1 }}>
              {(novedad.puntos ?? []).map((p, i) => (
                <ListItem key={i} disableGutters alignItems="flex-start">
                  <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                    <CheckCircleIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText primary={p} />
                </ListItem>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button variant="contained" onClick={cerrar}>
              Entendido
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};
