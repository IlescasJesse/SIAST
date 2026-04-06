import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Paper, Tabs, Tab, TextField, Button, Typography,
  Alert, InputAdornment, IconButton, CircularProgress, Divider,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import BadgeIcon from "@mui/icons-material/Badge";
import { useAuthStore } from "../store/auth.js";
import { useNotifStore } from "../store/notificaciones.js";
import { BuildingViewer } from "../components/Building3D/BuildingViewer.jsx";

const RFC_REGEX = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/i;

export const LoginPage = () => {
  const navigate = useNavigate();
  const { loginRFC, loginStaff } = useAuthStore();
  const { conectar } = useNotifStore();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [rfc, setRfc] = useState("");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");

  const handleLoginRFC = async (e) => {
    e.preventDefault();
    setError("");
    if (!RFC_REGEX.test(rfc)) { setError("Formato de RFC inválido"); return; }
    setLoading(true);
    try {
      const data = await loginRFC(rfc.toUpperCase());
      conectar(data.user);
      navigate("/tickets/nuevo");
    } catch (err) {
      setError(err.response?.data?.error ?? "RFC no encontrado en el sistema");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginStaff = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await loginStaff(usuario, password);
      conectar(data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error ?? "Credenciales incorrectas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: "flex", height: "100vh", bgcolor: "background.default" }}>
      {/* Panel izquierdo — 3D viewer */}
      <Box sx={{ flex: "0 0 60%", display: { xs: "none", md: "block" }, position: "relative" }}>
        <BuildingViewer loginMode={true} sx={{ height: "100%", borderRadius: 0 }} />
        <Box sx={{
          position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center",
          pointerEvents: "none",
        }}>
          <Typography variant="caption" color="rgba(255,255,255,0.3)" letterSpacing={3} sx={{ textTransform: "uppercase" }}>
            Edificio Saúl Martínez · Secretaría de Finanzas
          </Typography>
        </Box>
      </Box>

      {/* Panel derecho — formulario */}
      <Box sx={{
        flex: { xs: "0 0 100%", md: "0 0 40%" },
        display: "flex", alignItems: "center", justifyContent: "center",
        p: 4, bgcolor: "background.paper",
      }}>
        <Box sx={{ width: "100%", maxWidth: 380 }}>
          {/* Logo / Header */}
          <Box sx={{ mb: 4, textAlign: "center" }}>
            <Box sx={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 56, height: 56, borderRadius: "50%",
              bgcolor: "primary.dark", mb: 2,
            }}>
              <BadgeIcon sx={{ fontSize: 28, color: "primary.light" }} />
            </Box>
            <Typography variant="h5" fontWeight={700} gutterBottom>SIAST</Typography>
            <Typography variant="body2" color="text.secondary">
              Sistema Integral de Atención y Soporte Técnico
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Secretaría de Finanzas — Oaxaca
            </Typography>
          </Box>

          <Tabs value={tab} onChange={(_, v) => { setTab(v); setError(""); }} variant="fullWidth" sx={{ mb: 3 }}>
            <Tab label="Acceso con RFC" sx={{ fontSize: 13 }} />
            <Tab label="Acceso Staff" sx={{ fontSize: 13 }} />
          </Tabs>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {tab === 0 && (
            <Box component="form" onSubmit={handleLoginRFC} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="RFC"
                value={rfc}
                onChange={(e) => setRfc(e.target.value.toUpperCase())}
                fullWidth
                autoFocus
                inputProps={{ maxLength: 13, style: { letterSpacing: 3 } }}
                helperText="Ej: PELJ850312HDF"
              />
              <Button type="submit" variant="contained" fullWidth size="large" disabled={loading || rfc.length < 12}>
                {loading ? <CircularProgress size={22} color="inherit" /> : "Ingresar"}
              </Button>
              <Typography variant="caption" color="text.secondary" textAlign="center">
                El RFC debe estar registrado en el sistema SIRH
              </Typography>
            </Box>
          )}

          {tab === 1 && (
            <Box component="form" onSubmit={handleLoginStaff} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="Usuario"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                fullWidth
                autoFocus
                autoComplete="username"
              />
              <TextField
                label="Contraseña"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                autoComplete="current-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPass(!showPass)} edge="end">
                        {showPass ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Button type="submit" variant="contained" fullWidth size="large" disabled={loading || !usuario || !password}>
                {loading ? <CircularProgress size={22} color="inherit" /> : "Iniciar Sesión"}
              </Button>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};
