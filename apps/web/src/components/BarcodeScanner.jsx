import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import { BrowserMultiFormatReader } from "@zxing/browser";

export function BarcodeScanner({ open, onClose, onScanned, title = "Escanear código" }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  // Enumerar cámaras al abrir el dialog
  useEffect(() => {
    if (!open) return;
    setError("");
    BrowserMultiFormatReader.listVideoInputDevices()
      .then((devs) => {
        setDevices(devs);
        if (devs.length > 0) setSelectedDevice(devs[devs.length - 1].deviceId);
      })
      .catch(() => setError("No se pudo acceder a la cámara. Verifica los permisos."));
    return () => stopScanner();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Iniciar escáner cuando hay dispositivo seleccionado y el dialog está abierto
  useEffect(() => {
    if (open && selectedDevice) startScanner();
    return () => stopScanner();
  }, [selectedDevice, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const startScanner = async () => {
    if (!videoRef.current || !selectedDevice) return;
    setScanning(true);
    setError("");
    try {
      readerRef.current = new BrowserMultiFormatReader();
      await readerRef.current.decodeFromVideoDevice(
        selectedDevice,
        videoRef.current,
        (result, err) => {
          if (result) {
            stopScanner();
            onScanned(result.getText());
            onClose();
          }
        },
      );
    } catch (e) {
      setError("Error al iniciar el escáner: " + e.message);
      setScanning(false);
    }
  };

  const stopScanner = () => {
    if (readerRef.current) {
      try {
        BrowserMultiFormatReader.releaseAllStreams();
      } catch {
        // ignorar errores al liberar streams
      }
      readerRef.current = null;
    }
    setScanning(false);
  };

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <QrCodeScannerIcon color="primary" />
        {title}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {devices.length > 1 && (
            <FormControl size="small" fullWidth>
              <InputLabel>Cámara</InputLabel>
              <Select
                value={selectedDevice}
                label="Cámara"
                onChange={(e) => {
                  stopScanner();
                  setSelectedDevice(e.target.value);
                }}
              >
                {devices.map((d) => (
                  <MenuItem key={d.deviceId} value={d.deviceId}>
                    {d.label || d.deviceId}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Box
            sx={{
              position: "relative",
              bgcolor: "black",
              borderRadius: 2,
              overflow: "hidden",
              aspectRatio: "4/3",
            }}
          >
            <video
              ref={videoRef}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              muted
            />
            {!scanning && !error && (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CircularProgress color="inherit" sx={{ color: "white" }} />
              </Box>
            )}
            {/* Guía visual de escaneo */}
            {scanning && (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <Box
                  sx={{
                    width: "60%",
                    height: "30%",
                    border: "2px solid rgba(255,255,255,0.8)",
                    borderRadius: 1,
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)",
                  }}
                />
              </Box>
            )}
          </Box>

          <Typography variant="caption" color="text.secondary" textAlign="center">
            Apunta la cámara al código de barras o QR del equipo
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
