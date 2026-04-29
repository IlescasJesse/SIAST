import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box, Typography, Button, Chip, Alert, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, TablePagination,
  TextField, InputAdornment, Stack, Divider, Tooltip, IconButton,
  Card, CardContent, Grid,
} from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import PeopleIcon from "@mui/icons-material/People";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import UpdateIcon from "@mui/icons-material/Update";
import WarningIcon from "@mui/icons-material/Warning";
import RefreshIcon from "@mui/icons-material/Refresh";
import { getSirhStatus, triggerSirhSync, getSirhEmpleados } from "../api/admin.js";
import { useNotifStore } from "../store/notificaciones.js";

const PISOS = { PB: "PB", NIVEL_1: "N1", NIVEL_2: "N2", NIVEL_3: "N3" };

function StatCard({ icon, label, value, color = "text.primary" }) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 140 }}>
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
          {icon}
          <Typography variant="caption" color="text.secondary">{label}</Typography>
        </Stack>
        <Typography variant="h5" fontWeight={700} color={color}>{value ?? "—"}</Typography>
      </CardContent>
    </Card>
  );
}

export function AdminSirhPage() {
  const socket = useNotifStore((s) => s.socket);
  const [status, setStatus]     = useState(null);
  const [syncing, setSyncing]   = useState(false);
  const [rows, setRows]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(0);
  const [rowsPerPage]           = useState(50);
  const [search, setSearch]     = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [syncMsg, setSyncMsg]   = useState("");
  const searchTimer             = useRef(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await getSirhStatus();
      setStatus(data);
      setSyncing(data.enProgreso);
    } catch {
      /* silencioso */
    }
  }, []);

  const loadEmpleados = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getSirhEmpleados({ page: page + 1, limit: rowsPerPage, search, activo: "true" });
      setRows(res.data);
      setTotal(res.meta.total);
    } catch (e) {
      setError(e?.response?.data?.error ?? "Error al cargar empleados");
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search]);

  // Carga inicial
  useEffect(() => { loadStatus(); loadEmpleados(); }, [loadStatus, loadEmpleados]);

  // Polling de estado mientras hay sync en progreso
  useEffect(() => {
    if (!syncing) return;
    const t = setInterval(loadStatus, 3000);
    return () => clearInterval(t);
  }, [syncing, loadStatus]);

  // Socket: eventos de sync en tiempo real
  useEffect(() => {
    const onIniciada = () => {
      setSyncing(true);
      setSyncMsg("Sincronización en progreso...");
    };
    const onCompletada = (data) => {
      setSyncing(false);
      setSyncMsg(
        `Sync completada — ${data.creados} nuevos, ${data.actualizados} actualizados, ${data.errores} errores`
      );
      loadStatus();
      loadEmpleados();
    };
    const onError = ({ error: msg }) => {
      setSyncing(false);
      setSyncMsg(`Error en sync: ${msg}`);
    };

    socket.on("sirh:sync_iniciada",   onIniciada);
    socket.on("sirh:sync_completada", onCompletada);
    socket.on("sirh:sync_error",      onError);
    return () => {
      socket.off("sirh:sync_iniciada",   onIniciada);
      socket.off("sirh:sync_completada", onCompletada);
      socket.off("sirh:sync_error",      onError);
    };
  }, [loadStatus, loadEmpleados]);

  const handleSync = async () => {
    if (syncing) return;
    try {
      await triggerSirhSync();
      setSyncing(true);
      setSyncMsg("Sincronización iniciada...");
    } catch (e) {
      setSyncMsg(e?.response?.data?.error ?? "Error al iniciar sync");
    }
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(val);
      setPage(0);
    }, 400);
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "Nunca";

  return (
    <Box>
      {/* ── Encabezado ─────────────────────────────────────────────────────── */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Sincronización con SIRH</Typography>
          <Typography variant="body2" color="text.secondary">
            La sincronización es bidireccional: los cambios en SIRH (estatus, datos) se reflejan
            aquí automáticamente cada 12 h. Los cambios de teléfono del empleado se envían de vuelta
            a SIRH en tiempo real.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
          onClick={handleSync}
          disabled={syncing || status?.habilitado === false}
        >
          {syncing ? "Sincronizando..." : "Sincronizar ahora"}
        </Button>
      </Stack>

      {status?.habilitado === false && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          SIRH_ENABLED no está activo en el servidor. La sincronización automática está deshabilitada.
        </Alert>
      )}

      {syncMsg && (
        <Alert
          severity={syncMsg.includes("Error") ? "error" : syncing ? "info" : "success"}
          onClose={() => setSyncMsg("")}
          sx={{ mb: 2 }}
        >
          {syncMsg}
        </Alert>
      )}

      {/* ── Tarjetas de estadísticas ────────────────────────────────────────── */}
      {status && (
        <Stack direction="row" flexWrap="wrap" gap={1.5} mb={3}>
          <StatCard
            icon={<PeopleIcon color="primary" fontSize="small" />}
            label="Empleados en DB"
            value={status.totalEmpleadosDB}
            color="primary.main"
          />
          <StatCard
            icon={<CheckCircleIcon color="success" fontSize="small" />}
            label="Sincronizados SIRH"
            value={status.sincronizadosSIRH}
            color="success.main"
          />
          <StatCard
            icon={<PersonAddIcon color="info" fontSize="small" />}
            label="Creados (último sync)"
            value={status.creados}
          />
          <StatCard
            icon={<UpdateIcon color="action" fontSize="small" />}
            label="Actualizados"
            value={status.actualizados}
          />
          {status.errores > 0 && (
            <StatCard
              icon={<WarningIcon color="warning" fontSize="small" />}
              label="Errores"
              value={status.errores}
              color="warning.main"
            />
          )}
          <Card variant="outlined" sx={{ flex: 1, minWidth: 160 }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">Última sincronización</Typography>
              <Typography variant="body2" fontWeight={600} mt={0.5}>{fmtDate(status.ultimaSync)}</Typography>
              <Typography variant="caption" color="text.secondary">Próxima automática: cada 12 h</Typography>
            </CardContent>
          </Card>
        </Stack>
      )}

      <Divider sx={{ mb: 2 }} />

      {/* ── Tabla de empleados ──────────────────────────────────────────────── */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5} flexWrap="wrap" gap={1}>
        <Typography variant="subtitle1" fontWeight={600}>
          Empleados activos sincronizados
          {total > 0 && (
            <Chip label={total} size="small" sx={{ ml: 1 }} color="primary" />
          )}
        </Typography>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            placeholder="Buscar RFC, nombre, área..."
            value={searchInput}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
            }}
            sx={{ width: 280 }}
          />
          <Tooltip title="Recargar lista">
            <IconButton size="small" onClick={loadEmpleados}><RefreshIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>RFC</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Nombre completo</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Departamento</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Puesto</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Piso</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Teléfono</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Actualizado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  {search ? "Sin resultados para la búsqueda" : "No hay empleados sincronizados aún"}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((emp) => (
                <TableRow key={emp.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{emp.rfc}</TableCell>
                  <TableCell>{emp.nombreCompleto}</TableCell>
                  <TableCell sx={{ maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <Tooltip title={emp.departamento ?? ""}>
                      <span>{emp.departamento ?? "—"}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <Tooltip title={emp.puesto ?? ""}>
                      <span>{emp.puesto ?? "—"}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip label={PISOS[emp.piso] ?? emp.piso} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{emp.telefono ?? "—"}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{emp.email ?? "—"}</TableCell>
                  <TableCell sx={{ fontSize: 11, color: "text.secondary", whiteSpace: "nowrap" }}>
                    {fmtDate(emp.updatedAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Box>

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[50]}
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        labelRowsPerPage="Filas"
      />
    </Box>
  );
}
