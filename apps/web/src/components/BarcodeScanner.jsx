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
  const videoRef    = useRef(null);
  const readerRef   = useRef(null);
  const controlsRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  const stopScanner = () => {
    try { controlsRef.current?.stop(); } catch {}
    controlsRef.current = null;
    readerRef.current = null;
    try {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
    } catch {}
    setScanning(false);
  };

  useEffect(() => {
    if (!open) return;
    setError("");
    BrowserMultiFormatReader.listVideoInputDevices()
      .then((devs) => {
        setDevices(devs);
        // preferir cámara trasera si existe
        const back = devs.find((d) => /back|rear|environment/i.test(d.label));
        setSelectedDevice((back ?? devs[devs.length - 1])?.deviceId ?? "");
      })
      .catch(() => setError("No se pudo acceder a la cámara. Verifica los permisos del navegador."));
    return () => stopScanner();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && selectedDevice) startScanner();
    return () => stopScanner();
  }, [selectedDevice, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const startScanner = async () => {
    if (!videoRef.current || !selectedDevice) return;
    stopScanner();
    setScanning(false);
    setError("");
    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      const controls = await reader.decodeFromVideoDevice(
        selectedDevice,
        videoRef.current,
        (result, err) => {
          if (result) {
            const text = result.getText();
            stopScanner();
            onScanned(text);
            onClose();
          }
          // err cuando no hay código en el frame es normal — ignorar
        },
      );
      controlsRef.current = controls;
      setScanning(true);
    } catch (e) {
      setError("Error al iniciar el escáner: " + (e?.message ?? String(e)));
      setScanning(false);
    }
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
              playsInline
            />

            {!scanning && !error && (
              <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CircularProgress color="inherit" sx={{ color: "white" }} />
              </Box>
            )}

            {/* Guía visual de escaneo */}
            {scanning && (
              <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                {/* Esquinas del recuadro */}
                <Box sx={{ position: "relative", width: "65%", height: "40%" }}>
                  {["tl", "tr", "bl", "br"].map((corner) => (
                    <Box
                      key={corner}
                      sx={{
                        position: "absolute",
                        width: 20, height: 20,
                        borderColor: "rgba(255,255,255,0.95)",
                        borderStyle: "solid",
                        borderWidth: 0,
                        ...(corner === "tl" && { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 3 }),
                        ...(corner === "tr" && { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 3 }),
                        ...(corner === "bl" && { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 3 }),
                        ...(corner === "br" && { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 3 }),
                      }}
                    />
                  ))}
                  {/* Línea de escaneo animada */}
                  <Box
                    sx={{
                      position: "absolute",
                      left: 0, right: 0,
                      height: 2,
                      bgcolor: "rgba(66, 165, 245, 0.9)",
                      boxShadow: "0 0 6px rgba(66,165,245,0.8)",
                      animation: "scan-line 1.8s ease-in-out infinite",
                      "@keyframes scan-line": {
                        "0%":   { top: "5%" },
                        "50%":  { top: "90%" },
                        "100%": { top: "5%" },
                      },
                    }}
                  />
                </Box>
              </Box>
            )}
          </Box>

          <Typography variant="caption" color="text.secondary" textAlign="center">
            Soporta QR, Code128, Code39, EAN-13, EAN-8, UPC, Data Matrix y más
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
