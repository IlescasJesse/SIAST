import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Table, TableBody, TableCell, TableHead, TableRow, Paper,
  Chip, Alert, CircularProgress, TextField, Select, MenuItem, FormControl,
  InputLabel, Button, IconButton, Tooltip, Divider, Tab, Tabs,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import LogoutIcon from "@mui/icons-material/Logout";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import { getLogsAcceso, getSesiones, cerrarSesionAdmin } from "../api/admin.js";
import { LABEL_ROL } from "@stf/shared";

const COLOR_RESULTADO = {
  OK: "success",
  FAIL_PASSWORD: "error",
  FAIL_NOT_FOUND: "warning",
  FAIL_INACTIVE: "default",
};

const LABEL_RESULTADO = {
  OK: "Acceso exitoso",
  FAIL_PASSWORD: "Contraseña incorrecta",
  FAIL_NOT_FOUND: "Usuario no encontrado",
  FAIL_INACTIVE: "Usuario inactivo",
};

const fmtDate = (d) => new Date(d).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "medium" });

// ── Tab Logs ──────────────────────────────────────────────────────────────────
const TabLogs = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroResultado, setFiltroResultado] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");

  // Filtros aplicados solo al presionar Buscar (no en cada keystroke)
  const [filtrosAplicados, setFiltrosAplicados] = useState({ resultado: "", tipo: "", desde: "" });

  const cargar = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const params = { limit: 200 };
      if (filtrosAplicados.resultado) params.resultado = filtrosAplicados.resultado;
      if (filtrosAplicados.tipo) params.tipo = filtrosAplicados.tipo;
      if (filtrosAplicados.desde && filtrosAplicados.desde.length === 10) {
        params.desde = new Date(filtrosAplicados.desde + "T00:00:00").toISOString();
      }
      const data = await getLogsAcceso(params);
      setLogs(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch { setError("Error al cargar logs"); }
    finally { setLoading(false); }
  }, [filtrosAplicados]);

  useEffect(() => { cargar(); }, [cargar]);

  const aplicarFiltros = () => setFiltrosAplicados({ resultado: filtroResultado, tipo: filtroTipo, desde: filtroDesde });
  const limpiarFiltros = () => { setFiltroResultado(""); setFiltroTipo(""); setFiltroDesde(""); setFiltrosAplicados({ resultado: "", tipo: "", desde: "" }); };

  const fallidos = logs.filter((l) => l.resultado !== "OK").length;
  const exitosos = logs.filter((l) => l.resultado === "OK").length;

  return (
    <Box>
      {/* Resumen rápido */}
      <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
        <Paper variant="outlined" sx={{ p: 2, flex: 1, textAlign: "center" }}>
          <CheckCircleIcon color="success" />
          <Typography variant="h5" fontWeight={700} color="success.main">{exitosos}</Typography>
          <Typography variant="caption" color="text.secondary">Accesos exitosos</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: 1, textAlign: "center" }}>
          <ErrorIcon color="error" />
          <Typography variant="h5" fontWeight={700} color="error.main">{fallidos}</Typography>
          <Typography variant="caption" color="text.secondary">Intentos fallidos</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: 1, textAlign: "center" }}>
          <Typography variant="h5" fontWeight={700}>{total}</Typography>
          <Typography variant="caption" color="text.secondary">Total registros</Typography>
        </Paper>
      </Box>

      {/* Filtros */}
      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Resultado</InputLabel>
          <Select value={filtroResultado} label="Resultado" onChange={(e) => setFiltroResultado(e.target.value)}>
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="OK">Exitosos</MenuItem>
            <MenuItem value="FAIL_PASSWORD">Contraseña incorrecta</MenuItem>
            <MenuItem value="FAIL_NOT_FOUND">No encontrado</MenuItem>
            <MenuItem value="FAIL_INACTIVE">Usuario inactivo</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Tipo</InputLabel>
          <Select value={filtroTipo} label="Tipo" onChange={(e) => setFiltroTipo(e.target.value)}>
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="STAFF">Staff</MenuItem>
            <MenuItem value="EMPLEADO">Empleado</MenuItem>
          </Select>
        </FormControl>
        <TextField size="small" label="Desde" type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} InputLabelProps={{ shrink: true }} />
        <Button variant="contained" size="small" onClick={aplicarFiltros}>Buscar</Button>
        <Button variant="outlined" size="small" onClick={limpiarFiltros}>Limpiar</Button>
        <Tooltip title="Actualizar">
          <IconButton onClick={cargar} size="small"><RefreshIcon /></IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "grey.50" }}>
                <TableCell><b>Fecha y hora</b></TableCell>
                <TableCell><b>Tipo</b></TableCell>
                <TableCell><b>Identificador</b></TableCell>
                <TableCell><b>Resultado</b></TableCell>
                <TableCell><b>IP</b></TableCell>
                <TableCell><b>Navegador / Equipo</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Sin registros</Typography>
                  </TableCell>
                </TableRow>
              )}
              {logs.map((log) => (
                <TableRow
                  key={log.id}
                  sx={{ bgcolor: log.resultado !== "OK" ? "error.50" : "inherit" }}
                >
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" fontSize={12}>
                      {fmtDate(log.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={log.tipo} size="small" color={log.tipo === "STAFF" ? "primary" : "secondary"} variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{log.identifier}</Typography>
                    {log.usuario && (
                      <Typography variant="caption" color="text.secondary">
                        {log.usuario.nombre} {log.usuario.apellidos} — {LABEL_ROL[log.usuario.rol] ?? log.usuario.rol}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={LABEL_RESULTADO[log.resultado] ?? log.resultado}
                      size="small"
                      color={COLOR_RESULTADO[log.resultado] ?? "default"}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" fontSize={12}>
                      {log.ipAddress ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 250, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.userAgent ?? "—"}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
};

// ── Tab Sesiones activas ───────────────────────────────────────────────────────
const TabSesiones = () => {
  const [sesiones, setSesiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      setSesiones(await getSesiones() ?? []);
    } catch { setError("Error al cargar sesiones"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const forzarCierre = async (sesion) => {
    const quien = sesion.usuario
      ? `${sesion.usuario.nombre} ${sesion.usuario.apellidos}`
      : sesion.empleado?.nombreCompleto ?? "este usuario";
    if (!window.confirm(`¿Cerrar la sesión de ${quien}?`)) return;
    try {
      await cerrarSesionAdmin(sesion.id);
      cargar();
    } catch { setError("Error al cerrar sesión"); }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Sesiones actualmente abiertas — máximo 2 por usuario. Al cerrar una, el usuario deberá volver a iniciar sesión.
        </Typography>
        <Tooltip title="Actualizar">
          <IconButton onClick={cargar} size="small"><RefreshIcon /></IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "grey.50" }}>
                <TableCell><b>Usuario</b></TableCell>
                <TableCell><b>Tipo</b></TableCell>
                <TableCell><b>IP</b></TableCell>
                <TableCell><b>Iniciada</b></TableCell>
                <TableCell><b>Expira</b></TableCell>
                <TableCell align="right"><b>Acciones</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sesiones.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Sin sesiones activas</Typography>
                  </TableCell>
                </TableRow>
              )}
              {sesiones.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    {s.usuario ? (
                      <>
                        <Typography variant="body2" fontWeight={500}>{s.usuario.nombre} {s.usuario.apellidos}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.usuario.usuario} — {LABEL_ROL[s.usuario.rol] ?? s.usuario.rol}</Typography>
                      </>
                    ) : (
                      <>
                        <Typography variant="body2" fontWeight={500}>{s.empleado?.nombreCompleto ?? s.empleadoRfc}</Typography>
                        <Typography variant="caption" color="text.secondary">RFC: {s.empleadoRfc}</Typography>
                      </>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={s.usuario ? "Staff" : "Empleado"} size="small" color={s.usuario ? "primary" : "secondary"} variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" fontSize={12}>{s.ipAddress ?? "—"}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontSize={12}>{fmtDate(s.createdAt)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontSize={12}>{fmtDate(s.expiresAt)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Forzar cierre de sesión">
                      <IconButton size="small" color="error" onClick={() => forzarCierre(s)}>
                        <LogoutIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
};

// ── Página principal ──────────────────────────────────────────────────────────
export const AdminSeguridadPage = () => {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tab label="Registro de accesos" />
        <Tab label="Sesiones activas" />
      </Tabs>
      {tab === 0 && <TabLogs />}
      {tab === 1 && <TabSesiones />}
    </Box>
  );
};
