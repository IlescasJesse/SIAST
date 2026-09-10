import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  TextField,
  Snackbar,
  Alert,
} from "@mui/material";
import { useDialogStore } from "../../store/dialogs.js";

// Punto único de render de los diálogos de SIAST. Se monta UNA vez (en App)
// y escucha el store imperativo `useDialogStore`. Ver store/dialogs.js.
export const DialogHost = () => {
  const dialogo = useDialogStore((s) => s.dialogo);
  const snack = useDialogStore((s) => s.snack);
  const resolver = useDialogStore((s) => s._resolver);
  const cerrarSnack = useDialogStore((s) => s.cerrarSnack);

  const [texto, setTexto] = useState("");

  // Limpia el input de confirmación por texto cada vez que se abre un diálogo.
  useEffect(() => {
    setTexto("");
  }, [dialogo]);

  const requiereTexto = Boolean(dialogo?.textoConfirmacion);
  const textoOk = !requiereTexto || texto.trim() === dialogo.textoConfirmacion.trim();

  return (
    <>
      <Dialog
        open={Boolean(dialogo)}
        onClose={() => resolver(false)}
        maxWidth="xs"
        fullWidth
        aria-labelledby="dialog-host-titulo"
      >
        {dialogo && (
          <>
            <DialogTitle id="dialog-host-titulo">{dialogo.titulo}</DialogTitle>
            <DialogContent>
              {dialogo.mensaje && (
                <DialogContentText sx={{ whiteSpace: "pre-line" }}>
                  {dialogo.mensaje}
                </DialogContentText>
              )}
              {requiereTexto && (
                <TextField
                  autoFocus
                  fullWidth
                  size="small"
                  margin="dense"
                  label={`Escribe "${dialogo.textoConfirmacion}" para confirmar`}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && textoOk) resolver(true);
                  }}
                />
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => resolver(false)} color="inherit">
                {dialogo.textoCancelar}
              </Button>
              <Button
                onClick={() => resolver(true)}
                variant="contained"
                disabled={!textoOk}
                color={dialogo.severidad === "error" ? "error" : "primary"}
                autoFocus={!requiereTexto}
              >
                {dialogo.textoAceptar}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar
        open={Boolean(snack)}
        autoHideDuration={snack?.duracion ?? 4000}
        onClose={cerrarSnack}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {snack ? (
          <Alert
            onClose={cerrarSnack}
            severity={snack.severidad}
            variant="filled"
            sx={{ width: "100%" }}
          >
            {snack.mensaje}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
};
