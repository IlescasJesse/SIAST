import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box, Tabs, Tab, TextField, Button, Typography,
  Alert, InputAdornment, IconButton, CircularProgress, Chip,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import BadgeIcon from "@mui/icons-material/Badge";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import LockIcon from "@mui/icons-material/Lock";
import { useAuthStore } from "../store/auth.js";
import { useNotifStore } from "../store/notificaciones.js";
import { BuildingViewer } from "../components/Building3D/BuildingViewer.jsx";

const RFC_REGEX = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/i;

// Pasos del flujo OTP para empleados
const PASO_RFC = "rfc";
const PASO_TELEFONO = "telefono"; // primer acceso: registrar número
const PASO_OTP = "otp";          // ingresar código recibido

export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? null;
  const { solicitarOtp, verificarOtp, loginStaff } = useAuthStore();
  const { conectar } = useNotifStore();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Estado flujo empleado
  const [paso, setPaso] = useState(PASO_RFC);
  const [rfc, setRfc] = useState("");
  const [telefono, setTelefono] = useState("");
  const [codigo, setCodigo] = useState("");
  const [hint, setHint] = useState(""); // ej: "******5678"
  const [devCodigo, setDevCodigo] = useState(""); // solo en dev

  // Estado flujo staff
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");

  const resetEmpleado = () => {
    setPaso(PASO_RFC);
    setRfc("");
    setTelefono("");
    setCodigo("");
    setHint("");
    setDevCodigo("");
    setError("");
  };

  // Paso 1: solicitar OTP (o detectar que falta teléfono)
  const handleSolicitarOtp = async (e) => {
    e.preventDefault();
    setError("");
    if (!RFC_REGEX.test(rfc)) { setError("Formato de RFC inválido"); return; }
    setLoading(true);
    try {
      const res = await solicitarOtp(rfc.toUpperCase());
      if (res.necesitaTelefono) {
        setPaso(PASO_TELEFONO);
      } else {
        setHint(res.hint);
        if (res.devCodigo) setDevCodigo(res.devCodigo);
        setPaso(PASO_OTP);
      }
    } catch (err) {
      setError(err.response?.data?.error ?? "RFC no encontrado en el sistema");
    } finally {
      setLoading(false);
    }
  };

  // Paso 1.5: registrar teléfono en primer acceso + solicitar OTP
  const handleRegistrarTelefono = async (e) => {
    e.preventDefault();
    setError("");
    const limpio = telefono.replace(/\D/g, "");
    if (limpio.length !== 10) { setError("Ingresa un número de 10 dígitos"); return; }
    setLoading(true);
    try {
      const res = await solicitarOtp(rfc.toUpperCase(), limpio);
      setHint(res.hint);
      if (res.devCodigo) setDevCodigo(res.devCodigo);
      setPaso(PASO_OTP);
    } catch (err) {
      setError(err.response?.data?.error ?? "No se pudo registrar el teléfono");
    } finally {
      setLoading(false);
    }
  };

  // Paso 2: verificar código y entrar
  const handleVerificarOtp = async (e) => {
    e.preventDefault();
    setError("");
    if (codigo.length !== 6) { setError("El código debe tener 6 dígitos"); return; }
    setLoading(true);
    try {
      const data = await verificarOtp(rfc.toUpperCase(), codigo);
      conectar(data.user);
      navigate(redirectTo ?? "/tickets/nuevo");
    } catch (err) {
      setError(err.response?.data?.error ?? "Código incorrecto o expirado");
    } finally {
      setLoading(false);
    }
  };

  // Reenviar OTP
  const handleReenviar = async () => {
    setError("");
    setCodigo("");
    setDevCodigo("");
    setLoading(true);
    try {
      const res = await solicitarOtp(rfc.toUpperCase());
      if (res.devCodigo) setDevCodigo(res.devCodigo);
    } catch (err) {
      setError(err.response?.data?.error ?? "Error al reenviar el código");
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
      navigate(redirectTo ?? "/dashboard");
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
            <>
              {/* ── Paso 1: RFC ── */}
              {paso === PASO_RFC && (
                <Box component="form" onSubmit={handleSolicitarOtp} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <TextField
                    label="RFC"
                    value={rfc}
                    onChange={(e) => setRfc(e.target.value.toUpperCase())}
                    fullWidth
                    autoFocus
                    inputProps={{ maxLength: 13, style: { letterSpacing: 3 } }}
                    helperText="Ej: PELJ850312HDF"
                    InputProps={{ startAdornment: <InputAdornment position="start"><BadgeIcon fontSize="small" /></InputAdornment> }}
                  />
                  <Button type="submit" variant="contained" fullWidth size="large" disabled={loading || rfc.length < 12}>
                    {loading ? <CircularProgress size={22} color="inherit" /> : "Continuar"}
                  </Button>
                  <Typography variant="caption" color="text.secondary" textAlign="center">
                    Te enviaremos un código de verificación por WhatsApp
                  </Typography>
                </Box>
              )}

              {/* ── Paso 1.5: Registrar teléfono (primer acceso) ── */}
              {paso === PASO_TELEFONO && (
                <Box component="form" onSubmit={handleRegistrarTelefono} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Alert severity="info" icon={<PhoneAndroidIcon />}>
                    Es tu primer acceso. Registra tu número de celular para recibir códigos de verificación.
                  </Alert>
                  <TextField
                    label="Número de celular"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    fullWidth
                    autoFocus
                    inputProps={{ maxLength: 10, inputMode: "numeric" }}
                    helperText="10 dígitos sin código de país — Ej: 9512345678"
                    InputProps={{ startAdornment: <InputAdornment position="start"><PhoneAndroidIcon fontSize="small" /></InputAdornment> }}
                  />
                  <Button type="submit" variant="contained" fullWidth size="large" disabled={loading || telefono.replace(/\D/g, "").length !== 10}>
                    {loading ? <CircularProgress size={22} color="inherit" /> : "Registrar y enviar código"}
                  </Button>
                  <Button variant="text" size="small" onClick={resetEmpleado} disabled={loading}>
                    ← Volver
                  </Button>
                </Box>
              )}

              {/* ── Paso 2: Código OTP ── */}
              {paso === PASO_OTP && (
                <Box component="form" onSubmit={handleVerificarOtp} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Alert severity="success" icon={<PhoneAndroidIcon />}>
                    Código enviado a <strong>{hint}</strong>. Revisa WhatsApp.
                  </Alert>
                  {devCodigo && (
                    <Chip
                      icon={<LockIcon />}
                      label={`DEV — código: ${devCodigo}`}
                      color="warning"
                      variant="outlined"
                      size="small"
                      sx={{ fontFamily: "monospace", letterSpacing: 2 }}
                    />
                  )}
                  <TextField
                    label="Código de 6 dígitos"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    fullWidth
                    autoFocus
                    inputProps={{ maxLength: 6, inputMode: "numeric", style: { letterSpacing: 6, fontSize: 22, textAlign: "center" } }}
                  />
                  <Button type="submit" variant="contained" fullWidth size="large" disabled={loading || codigo.length !== 6}>
                    {loading ? <CircularProgress size={22} color="inherit" /> : "Verificar y entrar"}
                  </Button>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Button variant="text" size="small" onClick={resetEmpleado} disabled={loading}>
                      ← Volver
                    </Button>
                    <Button variant="text" size="small" onClick={handleReenviar} disabled={loading}>
                      Reenviar código
                    </Button>
                  </Box>
                </Box>
              )}
            </>
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
