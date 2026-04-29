import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box, Tabs, Tab, TextField, Button, Typography,
  Alert, InputAdornment, IconButton, CircularProgress, Chip, Divider,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import BadgeIcon from "@mui/icons-material/Badge";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import LockIcon from "@mui/icons-material/Lock";
import { useAuthStore } from "../store/auth.js";
import { useNotifStore } from "../store/notificaciones.js";
import backgroundImg from "../img/background-img.jpg";
import logoOaxaca from "../img/logo-oaxaca.png";
import siastLogo from "../img/siast-logo.png";

const RFC_REGEX = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/i;

const PASO_RFC              = "rfc";
const PASO_CONFIRMAR_TEL    = "confirmar_tel";  // primer acceso: confirmar o cambiar teléfono
const PASO_TELEFONO         = "telefono";        // primer acceso: registrar teléfono nuevo
const PASO_OTP              = "otp";

// ── Componente OTP: 6 cajas individuales ─────────────────────────────────────
function OtpInput({ length = 6, value, onChange, onComplete, disabled }) {
  const digits = value.split("").concat(Array(length).fill("")).slice(0, length);
  const refs = useRef([]);

  // Guardamos onComplete en un ref para que el effect no dependa de él.
  // Así evitamos que un re-render del padre (p.ej. loading→true) recree la
  // función y dispare el effect de nuevo, enviando el OTP dos veces.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });

  // Guard para disparar onComplete una sola vez por código completo.
  const firedRef = useRef(false);

  const focusAt = (i) => {
    refs.current[i]?.focus();
    refs.current[i]?.select();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) {
        const next = digits.map((d, idx) => (idx === i ? "" : d)).join("");
        onChange(next);
      } else if (i > 0) {
        const next = digits.map((d, idx) => (idx === i - 1 ? "" : d)).join("");
        onChange(next);
        focusAt(i - 1);
      }
      return;
    }
    if (e.key === "ArrowLeft" && i > 0) { focusAt(i - 1); return; }
    if (e.key === "ArrowRight" && i < length - 1) { focusAt(i + 1); return; }
  };

  const handleChange = (i, e) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) return;
    const pasted = raw.slice(0, length - i).split("");
    const next = digits.map((d, idx) => {
      const offset = idx - i;
      if (offset >= 0 && offset < pasted.length) return pasted[offset];
      return d;
    });
    const joined = next.join("");
    onChange(joined);
    const nextFocus = Math.min(i + pasted.length, length - 1);
    setTimeout(() => focusAt(nextFocus), 0);
  };

  // Auto-submit — solo depende de value y length, nunca de onComplete.
  // firedRef evita doble envío si el effect corre más de una vez.
  useEffect(() => {
    const complete = value.length === length && /^\d+$/.test(value) && !disabled;
    if (complete && !firedRef.current) {
      firedRef.current = true;
      onCompleteRef.current?.(value);
    }
    if (!complete) {
      firedRef.current = false; // reiniciar si borra dígitos
    }
  }, [value, length, disabled]);

  return (
    <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
      {digits.map((digit, i) => (
        <Box
          key={i}
          component="input"
          ref={(el) => { refs.current[i] = el; }}
          value={digit}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onChange={(e) => handleChange(i, e)}
          onFocus={(e) => e.target.select()}
          onClick={() => focusAt(i)}
          sx={{
            width: 44,
            height: 52,
            textAlign: "center",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 0,
            borderRadius: 1.5,
            border: "1px solid",
            borderColor: digit ? "primary.main" : "divider",
            bgcolor: digit ? "primary.dark" : "background.paper",
            color: digit ? "primary.contrastText" : "text.primary",
            outline: "none",
            cursor: "text",
            transition: "border-color 0.15s, background-color 0.15s",
            "&:focus": {
              borderColor: "primary.light",
              boxShadow: "0 0 0 2px rgba(99,102,241,0.25)",
            },
            "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
          }}
        />
      ))}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const [telefonoCensurado, setTelefonoCensurado] = useState(""); // para confirmar
  const [codigo, setCodigo] = useState("");
  const [hint, setHint] = useState("");
  const [devCodigo, setDevCodigo] = useState("");

  // Estado flujo staff
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");

  const resetEmpleado = () => {
    setPaso(PASO_RFC);
    setRfc("");
    setTelefono("");
    setTelefonoCensurado("");
    setCodigo("");
    setHint("");
    setDevCodigo("");
    setError("");
  };

  const handleSolicitarOtp = async (e) => {
    e.preventDefault();
    setError("");
    if (!RFC_REGEX.test(rfc)) { setError("Formato de RFC inválido"); return; }
    setLoading(true);
    try {
      const res = await solicitarOtp(rfc.toUpperCase());
      if (res.necesitaConfirmarTelefono) {
        // Primer acceso con teléfono conocido → confirmar o cambiar
        setTelefonoCensurado(res.telefonoCensurado);
        setPaso(PASO_CONFIRMAR_TEL);
      } else if (res.necesitaTelefono) {
        // Primer acceso sin teléfono → registrar
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

  // Paso 1.5a: Confirmar teléfono existente (primer acceso con teléfono en DB)
  const handleConfirmarTelefono = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // El usuario confirma que sí es su número → enviar sin telefonoNuevo
      // El backend detecta primerAcceso=true y el tel ya guardado, lo confirma
      const res = await solicitarOtp(rfc.toUpperCase(), "__CONFIRMAR__");
      setHint(res.hint);
      if (res.devCodigo) setDevCodigo(res.devCodigo);
      setPaso(PASO_OTP);
    } catch (err) {
      setError(err.response?.data?.error ?? "Error al confirmar teléfono");
    } finally {
      setLoading(false);
    }
  };

  // Paso 1.5a alt: Cambiar teléfono (primer acceso, número diferente)
  const handleCambiarTelefono = async (e) => {
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
      setError(err.response?.data?.error ?? "Error al actualizar teléfono");
    } finally {
      setLoading(false);
    }
  };

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

  const doVerificar = async (cod) => {
    setError("");
    if ((cod ?? codigo).length !== 6) { setError("El código debe tener 6 dígitos"); return; }
    setLoading(true);
    try {
      const data = await verificarOtp(rfc.toUpperCase(), cod ?? codigo);
      conectar(data.user);
      navigate(redirectTo ?? "/solicitudes/nueva");
    } catch (err) {
      setError(err.response?.data?.error ?? "Código incorrecto o expirado");
      setCodigo("");
    } finally {
      setLoading(false);
    }
  };

  const handleVerificarOtp = (e) => { e.preventDefault(); doVerificar(codigo); };

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

  // ── Bloque de formulario (tabs + pasos) — reutilizado en ambos diseños ──────
  const FormularioLogin = (
    <Box sx={{ width: "100%", maxWidth: 400 }}>
      {/* Logo / Header */}
      <Box sx={{ mb: 4, width: "100%" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5, mb: 1 }}>
          <Box
            component="img"
            src={siastLogo}
            alt="SIAST"
            sx={{ height: 44, width: "auto", objectFit: "contain", flexShrink: 0 }}
          />
          <Typography
            sx={{
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 700,
              fontSize: "44px",
              color: "#9D2449",
              letterSpacing: 4,
              lineHeight: "44px",
            }}
          >
            SIAST
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400, mt: 0.5, textAlign: "center", textTransform: "uppercase", letterSpacing: 1, fontSize: 11 }}>
          Sistema de Atención y Soporte Técnico
        </Typography>
        <Divider sx={{ mt: 2, borderColor: "#9D244933" }} />
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v) => { setTab(v); setError(""); }}
        variant="fullWidth"
        sx={{ mb: 3 }}
      >
        <Tab label="ACCESO EMPLEADOS" sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }} />
        <Tab label="ACCESO STAFF" sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }} />
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ══════════════════════════════ EMPLEADOS ══════════════════════════════ */}
      {tab === 0 && (
        <>
          {/* Paso 1: RFC */}
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
                Te enviaremos un codigo de verificacion por WhatsApp
              </Typography>
            </Box>
          )}

          {/* Paso 1.5a: Confirmar teléfono (primer acceso con teléfono en DB) */}
          {paso === PASO_CONFIRMAR_TEL && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Alert severity="info" icon={<PhoneAndroidIcon />}>
                <strong>Primer acceso.</strong> Tenemos registrado el numero{" "}
                <strong>{telefonoCensurado}</strong>. ¿Es correcto?
              </Alert>

              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={handleConfirmarTelefono}
                disabled={loading}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : `Si, enviar codigo a ${telefonoCensurado}`}
              </Button>

              <Typography variant="caption" color="text.secondary" textAlign="center">
                ¿No es tu numero?
              </Typography>

              <Box component="form" onSubmit={handleCambiarTelefono} sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <TextField
                  label="Mi numero correcto"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  fullWidth
                  inputProps={{ maxLength: 10, inputMode: "numeric" }}
                  helperText="10 digitos — Ej: 9512345678"
                  InputProps={{ startAdornment: <InputAdornment position="start"><PhoneAndroidIcon fontSize="small" /></InputAdornment> }}
                />
                <Button
                  type="submit"
                  variant="outlined"
                  fullWidth
                  disabled={loading || telefono.replace(/\D/g, "").length !== 10}
                >
                  Usar este numero y enviar codigo
                </Button>
              </Box>

              <Button variant="text" size="small" onClick={resetEmpleado} disabled={loading}>
                Volver
              </Button>
            </Box>
          )}

          {/* Paso 1.5b: Registrar teléfono (primer acceso sin teléfono) */}
          {paso === PASO_TELEFONO && (
            <Box component="form" onSubmit={handleRegistrarTelefono} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Alert severity="info" icon={<PhoneAndroidIcon />}>
                Es tu primer acceso. Registra tu numero de celular para recibir codigos de verificacion.
              </Alert>
              <TextField
                label="Numero de celular"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value.replace(/\D/g, "").slice(0, 10))}
                fullWidth
                autoFocus
                inputProps={{ maxLength: 10, inputMode: "numeric" }}
                helperText="10 digitos sin codigo de pais — Ej: 9512345678"
                InputProps={{ startAdornment: <InputAdornment position="start"><PhoneAndroidIcon fontSize="small" /></InputAdornment> }}
              />
              <Button type="submit" variant="contained" fullWidth size="large" disabled={loading || telefono.replace(/\D/g, "").length !== 10}>
                {loading ? <CircularProgress size={22} color="inherit" /> : "Registrar y enviar codigo"}
              </Button>
              <Button variant="text" size="small" onClick={resetEmpleado} disabled={loading}>
                Volver
              </Button>
            </Box>
          )}

          {/* Paso 2: OTP con cajas individuales */}
          {paso === PASO_OTP && (
            <Box component="form" onSubmit={handleVerificarOtp} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              <Alert severity="success" icon={<PhoneAndroidIcon />}>
                Codigo enviado a <strong>{hint}</strong>. Revisa WhatsApp.
              </Alert>
              {devCodigo && (
                <Chip
                  icon={<LockIcon />}
                  label={`DEV — codigo: ${devCodigo}`}
                  color="warning"
                  variant="outlined"
                  size="small"
                  sx={{ fontFamily: "monospace", letterSpacing: 2 }}
                />
              )}

              <Box>
                <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mb={1}>
                  Ingresa el codigo de 6 digitos
                </Typography>
                <OtpInput
                  length={6}
                  value={codigo}
                  onChange={setCodigo}
                  onComplete={doVerificar}
                  disabled={loading}
                />
              </Box>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading || codigo.length !== 6}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : "Verificar y entrar"}
              </Button>

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Button variant="text" size="small" onClick={resetEmpleado} disabled={loading}>
                  Volver
                </Button>
                <Button variant="text" size="small" onClick={handleReenviar} disabled={loading}>
                  Reenviar codigo
                </Button>
              </Box>
            </Box>
          )}
        </>
      )}

      {/* ══════════════════════════════ STAFF ══════════════════════════════ */}
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
            label="Contrasena"
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
            {loading ? <CircularProgress size={22} color="inherit" /> : "Iniciar Sesion"}
          </Button>
        </Box>
      )}
    </Box>
  );

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: `url(${backgroundImg})`,
        backgroundSize: "auto",
        backgroundRepeat: "repeat",
        p: { xs: 2, sm: 3 },
      }}
    >
      {/* Card central */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          borderRadius: "6px",
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
          maxWidth: 920,
          width: "100%",
          minHeight: 540,
        }}
      >
        {/* ── Panel izquierdo — identidad institucional ── */}
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 42%",
            bgcolor: "#9D2449",
            px: 4,
            py: 5,
            gap: 4,
          }}
        >
          {/* Logo Oaxaca centrado */}
          <Box
            component="img"
            src={logoOaxaca}
            alt="Gobierno del Estado de Oaxaca"
            sx={{
              width: "80%",
              maxWidth: 200,
              height: "auto",
              objectFit: "contain",
              display: "block",
            }}
          />

          {/* Datos de la dependencia */}
          <Box sx={{ textAlign: "center" }}>
            <Typography
              sx={{
                color: "rgba(255,255,255,0.9)",
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 2.5,
                textTransform: "uppercase",
                display: "block",
                mb: 1.5,
              }}
            >
              Secretaría de Finanzas
            </Typography>
            <Typography
              sx={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 9,
                letterSpacing: 0.3,
                lineHeight: 1.8,
                display: "block",
              }}
            >
              Centro Administrativo del Poder<br />
              Ejecutivo y Judicial
            </Typography>
            <Typography
              sx={{
                color: "rgba(255,255,255,0.3)",
                fontSize: 8,
                letterSpacing: 0.2,
                lineHeight: 1.7,
                display: "block",
                mt: 1,
                fontStyle: "italic",
              }}
            >
              "General Porfirio Díaz. Soldado de la Patria"<br />
              Edificio "D" Saúl Martínez
            </Typography>
          </Box>
        </Box>

        {/* ── Panel derecho — formulario ── */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            px: { xs: 3, sm: 6 },
            py: 5,
            bgcolor: "#ffffff",
          }}
        >
          {FormularioLogin}
        </Box>
      </Box>
    </Box>
  );
};
