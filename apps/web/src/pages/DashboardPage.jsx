import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Grid, Card, CardContent, Typography, Box, Chip, CircularProgress,
  LinearProgress, Divider, Avatar, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton, Tooltip,
} from "@mui/material";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import LinkIcon from "@mui/icons-material/Link";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import TodayIcon from "@mui/icons-material/Today";
import BarChartIcon from "@mui/icons-material/BarChart";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useAuthStore } from "../store/auth.js";
import { useNotifStore } from "../store/notificaciones.js";
import { getSolicitudes, getMisPasos } from "../api/solicitudes.js";
import { getCatalogos, getAsignaciones } from "../api/recursos.js";
import { TICKET_ESTADO_COLOR, TICKET_PRIORIDAD_COLOR } from "../theme/index.js";
import { LABEL_SUBCATEGORIA } from "@stf/shared";
import { isToday, format } from "date-fns";
import { es } from "date-fns/locale";

// ── Constantes visuales ───────────────────────────────────────────────────────
const ESTADO_COLOR = TICKET_ESTADO_COLOR;
const ESTADO_LABEL = {
  ABIERTO:     "Abierto",
  ASIGNADO:    "Asignado",
  EN_PROGRESO: "En Progreso",
  RESUELTO:    "Resuelto",
  CANCELADO:   "Cancelado",
};
const PRIORIDAD_COLOR = TICKET_PRIORIDAD_COLOR;
const ROL_LABEL = {
  ADMIN: "Administrador",
  TECNICO_TI: "Técnico TI",
  TECNICO_SERVICIOS: "Técnico en Servicios Generales",
  MESA_AYUDA: "Mesa de Ayuda",
  GESTOR_RECURSOS_MATERIALES: "Gestor de Recursos Materiales",
  EMPLEADO: "Empleado",
};

// ── Sub-componentes ────────────────────────────────────────────────────────────

const StatCard = ({ icon, label, value, color, subtitle }) => (
  <Card sx={{ height: "100%" }}>
    <CardContent sx={{ display: "flex", alignItems: "flex-start", gap: 2, py: "16px !important" }}>
      <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: `${color}18`, color, mt: 0.3, flexShrink: 0 }}>
        {icon}
      </Box>
      <Box>
        <Typography variant="h4" fontWeight={700} lineHeight={1}>{value}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>{label}</Typography>
        {subtitle && (
          <Typography variant="caption" color="text.disabled">{subtitle}</Typography>
        )}
      </Box>
    </CardContent>
  </Card>
);

const MetricBar = ({ label, value, total, color }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.4 }}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Typography variant="body2" fontWeight={700}>{value}</Typography>
          <Typography variant="caption" color="text.disabled">{pct}%</Typography>
        </Box>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 7,
          borderRadius: 4,
          bgcolor: "grey.100",
          "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 4 },
        }}
      />
    </Box>
  );
};

const SectionCard = ({ title, icon, children }) => (
  <Card sx={{ height: "100%" }}>
    <CardContent>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Box sx={{ color: "primary.main" }}>{icon}</Box>
        <Typography variant="subtitle2" fontWeight={700} letterSpacing={0.4} color="primary.main">
          {title.toUpperCase()}
        </Typography>
      </Box>
      {children}
    </CardContent>
  </Card>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function countBy(arr, key) {
  return arr.reduce((acc, item) => {
    const val = item[key] ?? "—";
    acc[val] = (acc[val] ?? 0) + 1;
    return acc;
  }, {});
}

function topN(obj, n = 5) {
  return Object.entries(obj)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n);
}

// ── Secciones por rol ─────────────────────────────────────────────────────────

function MetricasAdmin({ tickets }) {
  const total = tickets.length;
  const activos = tickets.filter((t) => t.estado !== "RESUELTO" && t.estado !== "CANCELADO");
  const abiertos = tickets.filter((t) => t.estado === "ABIERTO").length;
  const enAtencion = tickets.filter((t) => ["ASIGNADO", "EN_PROGRESO"].includes(t.estado)).length;
  const resueltos = tickets.filter((t) => t.estado === "RESUELTO").length;
  const urgentes = activos.filter((t) => t.prioridad === "URGENTE").length;
  const sinAsignar = tickets.filter((t) => t.estado === "ABIERTO" && !t.tecnicoId).length;

  const porEstado = countBy(tickets, "estado");
  const porCategoria = countBy(tickets, "categoria");
  const porPrioridad = countBy(tickets, "prioridad");

  // Técnicos con más tickets asignados
  const tecnicoMap = {};
  tickets.forEach((t) => {
    if (t.tecnico) {
      const nombre = `${t.tecnico.nombre ?? ""} ${t.tecnico.apellidos ?? ""}`.trim();
      tecnicoMap[nombre] = (tecnicoMap[nombre] ?? 0) + 1;
    }
  });
  const topTecnicos = topN(tecnicoMap);

  // Áreas con más tickets
  const areaMap = {};
  tickets.forEach((t) => {
    if (t.area?.label) {
      areaMap[t.area.label] = (areaMap[t.area.label] ?? 0) + 1;
    }
  });
  const topAreas = topN(areaMap);

  return (
    <>
      {/* Tarjetas principales */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { icon: <ConfirmationNumberIcon />, label: "Total solicitudes", value: total, color: "#5c6bc0" },
          { icon: <HourglassEmptyIcon />, label: "Sin asignar", value: sinAsignar, color: "#e65100", subtitle: "requieren atención" },
          { icon: <PendingActionsIcon />, label: "En atención", value: enAtencion, color: "#6a1b9a" },
          { icon: <CheckCircleIcon />, label: "Resueltos", value: resueltos, color: "#2e7d32" },
          { icon: <ReportProblemIcon />, label: "Urgentes activos", value: urgentes, color: "#c62828" },
        ].map((s) => (
          <Grid item xs={6} sm={4} md key={s.label}>
            <StatCard {...s} />
          </Grid>
        ))}
      </Grid>

      {/* Distribuciones */}
      <Grid container spacing={2}>
        {/* Por estado */}
        <Grid item xs={12} md={4}>
          <SectionCard title="Por estado" icon={<BarChartIcon />}>
            {Object.entries(ESTADO_LABEL).map(([key, lbl]) => (
              <MetricBar key={key} label={lbl} value={porEstado[key] ?? 0} total={total} color={ESTADO_COLOR[key]} />
            ))}
          </SectionCard>
        </Grid>

        {/* Por prioridad */}
        <Grid item xs={12} md={4}>
          <SectionCard title="Por prioridad" icon={<ReportProblemIcon />}>
            {["URGENTE", "ALTA", "MEDIA", "BAJA"].map((p) => (
              <MetricBar key={p} label={p.charAt(0) + p.slice(1).toLowerCase()} value={porPrioridad[p] ?? 0} total={total} color={PRIORIDAD_COLOR[p]} />
            ))}
            <Divider sx={{ my: 1.5 }} />
            {topN(porCategoria).map(([cat, cnt]) => (
              <MetricBar key={cat} label={cat.replace(/_/g, " ")} value={cnt} total={total} color="#9D2449" />
            ))}
          </SectionCard>
        </Grid>

        {/* Técnicos y áreas */}
        <Grid item xs={12} md={4}>
          <SectionCard title="Técnicos con más solicitudes" icon={<AssignmentIndIcon />}>
            {topTecnicos.length === 0 ? (
              <Typography variant="body2" color="text.disabled">Sin asignaciones</Typography>
            ) : topTecnicos.map(([nombre, cnt]) => (
              <Box key={nombre} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: "#9D2449" }}>
                  {nombre.charAt(0)}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" noWrap>{nombre}</Typography>
                  <LinearProgress variant="determinate"
                    value={total > 0 ? (cnt / total) * 100 : 0}
                    sx={{ height: 4, borderRadius: 2, bgcolor: "grey.100", "& .MuiLinearProgress-bar": { bgcolor: "#9D2449" } }}
                  />
                </Box>
                <Chip label={cnt} size="small" sx={{ fontWeight: 700, fontSize: 11 }} />
              </Box>
            ))}
            {topAreas.length > 0 && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="caption" fontWeight={700} color="text.secondary" letterSpacing={0.5}>
                  ÁREAS CON MÁS INCIDENCIAS
                </Typography>
                {topAreas.map(([area, cnt]) => (
                  <MetricBar key={area} label={area} value={cnt} total={total} color="#6c6e6d" />
                ))}
              </>
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </>
  );
}

function MetricasTecnico({ tickets, user, misPasos = [], navigate }) {
  const misTickets = tickets;
  const asignados = misTickets.filter((t) => t.estado === "ASIGNADO").length;
  const enProgreso = misTickets.filter((t) => t.estado === "EN_PROGRESO").length;
  const resueltos = misTickets.filter((t) => t.estado === "RESUELTO").length;
  const urgentes = misTickets.filter((t) => t.prioridad === "URGENTE" && !["RESUELTO", "CANCELADO"].includes(t.estado));
  const total = misTickets.length;

  const porPrioridad = countBy(misTickets.filter((t) => !["RESUELTO", "CANCELADO"].includes(t.estado)), "prioridad");
  const porCategoria = countBy(misTickets, "categoria");

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { icon: <ConfirmationNumberIcon />, label: "Solicitudes asignadas a mí", value: asignados, color: "#e65100" },
          { icon: <PendingActionsIcon />, label: "En progreso", value: enProgreso, color: "#6a1b9a" },
          { icon: <CheckCircleIcon />, label: "Resueltos", value: resueltos, color: "#2e7d32" },
          { icon: <ReportProblemIcon />, label: "Urgentes activos", value: urgentes.length, color: "#c62828" },
        ].map((s) => (
          <Grid item xs={6} sm={3} key={s.label}><StatCard {...s} /></Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <SectionCard title="Mis solicitudes por prioridad" icon={<ReportProblemIcon />}>
            {["URGENTE", "ALTA", "MEDIA", "BAJA"].map((p) => (
              <MetricBar key={p} label={p.charAt(0) + p.slice(1).toLowerCase()}
                value={porPrioridad[p] ?? 0}
                total={Object.values(porPrioridad).reduce((a, b) => a + b, 0) || 1}
                color={PRIORIDAD_COLOR[p]} />
            ))}
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <SectionCard title="Mis solicitudes por categoría" icon={<BarChartIcon />}>
            {topN(porCategoria).map(([cat, cnt]) => (
              <MetricBar key={cat} label={cat.replace(/_/g, " ")} value={cnt} total={total || 1} color="#9D2449" />
            ))}
            {Object.keys(porCategoria).length === 0 && (
              <Typography variant="body2" color="text.disabled">Sin solicitudes registradas</Typography>
            )}
          </SectionCard>
        </Grid>
        {urgentes.length > 0 && (
          <Grid item xs={12}>
            <SectionCard title="Solicitudes urgentes asignadas" icon={<ReportProblemIcon />}>
              <Grid container spacing={1}>
                {urgentes.map((t) => (
                  <Grid item xs={12} sm={6} md={4} key={t.id}>
                    <Box sx={{ border: "1px solid #ffd0d0", borderRadius: 1, p: 1, bgcolor: "#fff5f5" }}>
                      <Typography variant="body2" fontWeight={700} noWrap>{t.folio ?? `#${t.id}`} — {t.asunto}</Typography>
                      <Typography variant="caption" color="text.secondary">{t.area?.label}</Typography>
                      <Box sx={{ mt: 0.5 }}>
                        <Chip label={ESTADO_LABEL[t.estado] ?? t.estado} size="small" sx={{ bgcolor: ESTADO_COLOR[t.estado], color: "#fff", fontSize: 10, height: 18 }} />
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </SectionCard>
          </Grid>
        )}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                <PendingActionsIcon color="warning" />
                <Typography variant="subtitle1" fontWeight={700}>
                  Mis pasos en progreso
                </Typography>
                {misPasos.length > 0 && (
                  <Chip label={misPasos.length} size="small" color="warning" sx={{ ml: "auto" }} />
                )}
              </Box>
              {misPasos.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Sin pasos activos asignados</Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {misPasos.map((p) => (
                    <Box
                      key={p.id}
                      onClick={() => navigate(`/solicitudes/${p.ticketId}`)}
                      sx={{ p: 1.5, borderRadius: 1, border: "1px solid", borderColor: "divider", cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography variant="caption" color="primary" fontWeight={700} sx={{ fontFamily: "monospace" }}>
                          {p.ticket?.folio ?? `#${p.ticketId}`}
                        </Typography>
                        <Chip label={`Paso ${p.orden}`} size="small" color="info" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                      </Box>
                      <Typography variant="body2" fontWeight={500} noWrap>{p.nombre ?? p.ticket?.asunto}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {p.ticket?.empleado?.nombreCompleto} · {p.ticket?.area?.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}

function MetricasMesaAyuda({ tickets }) {
  const total = tickets.length;
  const sinAsignar = tickets.filter((t) => t.estado === "ABIERTO" && !t.tecnicoId).length;
  const hoy = tickets.filter((t) => { try { return isToday(new Date(t.createdAt)); } catch { return false; } }).length;
  const activos = tickets.filter((t) => !["RESUELTO", "CANCELADO"].includes(t.estado)).length;
  const resueltos = tickets.filter((t) => t.estado === "RESUELTO").length;
  const porEstado = countBy(tickets, "estado");
  const porCategoria = countBy(tickets, "categoria");

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { icon: <TodayIcon />, label: "Registrados hoy", value: hoy, color: "#0288d1" },
          { icon: <HourglassEmptyIcon />, label: "Sin asignar", value: sinAsignar, color: "#e65100", subtitle: "requieren técnico" },
          { icon: <PendingActionsIcon />, label: "Solicitudes activas", value: activos, color: "#6a1b9a" },
          { icon: <CheckCircleIcon />, label: "Resueltos", value: resueltos, color: "#2e7d32" },
        ].map((s) => (
          <Grid item xs={6} sm={3} key={s.label}><StatCard {...s} /></Grid>
        ))}
      </Grid>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <SectionCard title="Por estado" icon={<BarChartIcon />}>
            {Object.entries(ESTADO_LABEL).map(([key, lbl]) => (
              <MetricBar key={key} label={lbl} value={porEstado[key] ?? 0} total={total} color={ESTADO_COLOR[key]} />
            ))}
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <SectionCard title="Por categoría" icon={<BarChartIcon />}>
            {topN(porCategoria).map(([cat, cnt]) => (
              <MetricBar key={cat} label={cat.replace(/_/g, " ")} value={cnt} total={total || 1} color="#9D2449" />
            ))}
          </SectionCard>
        </Grid>
      </Grid>
    </>
  );
}

function MetricasGestor({ recursos, asignaciones }) {
  const totalCatalogos = recursos.length;
  const totalUnidades = recursos.reduce((s, r) => s + (r._count?.unidades ?? r.unidades?.length ?? 0), 0);
  const asignacionesActivas = asignaciones.filter((a) => a.estado === "ACTIVA" || !a.fechaDevolucion).length;

  const porTipo = {};
  recursos.forEach((r) => {
    const tipo = r.tipo ?? "Otro";
    porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;
  });

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { icon: <Inventory2Icon />, label: "Catálogos de recursos", value: totalCatalogos, color: "#5c6bc0" },
          { icon: <ConfirmationNumberIcon />, label: "Unidades en inventario", value: totalUnidades, color: "#0277bd" },
          { icon: <LinkIcon />, label: "Asignaciones activas", value: asignacionesActivas, color: "#e65100" },
        ].map((s) => (
          <Grid item xs={12} sm={4} key={s.label}><StatCard {...s} /></Grid>
        ))}
      </Grid>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <SectionCard title="Recursos por tipo" icon={<Inventory2Icon />}>
            {topN(porTipo).map(([tipo, cnt]) => (
              <MetricBar key={tipo} label={tipo} value={cnt} total={totalCatalogos || 1} color="#9D2449" />
            ))}
            {Object.keys(porTipo).length === 0 && (
              <Typography variant="body2" color="text.disabled">Sin catálogos registrados</Typography>
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </>
  );
}

function MetricasEmpleado({ tickets, navigate }) {
  const activos = tickets.filter((t) => !["RESUELTO", "CANCELADO"].includes(t.estado));
  const resueltos = tickets.filter((t) => t.estado === "RESUELTO").length;

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { icon: <PendingActionsIcon />, label: "Solicitudes activas", value: activos.length, color: TICKET_ESTADO_COLOR.ASIGNADO },
          { icon: <CheckCircleIcon />,    label: "Solicitudes resueltas", value: resueltos,        color: TICKET_ESTADO_COLOR.RESUELTO },
          { icon: <ConfirmationNumberIcon />, label: "Total registradas", value: tickets.length,  color: "#5c6bc0" },
        ].map((s) => (
          <Grid item xs={12} sm={4} key={s.label}><StatCard {...s} /></Grid>
        ))}
      </Grid>

      <SectionCard title="Mis solicitudes" icon={<PendingActionsIcon />}>
        {tickets.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
            No tienes solicitudes registradas.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Folio</TableCell>
                  <TableCell>Asunto</TableCell>
                  <TableCell>Categoría</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {tickets.map((t) => (
                  <TableRow
                    key={t.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => navigate(`/solicitudes/${t.id}`)}
                  >
                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: 12 }}>
                      {t.folio ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>{t.asunto}</Typography>
                      <Typography variant="caption" color="text.secondary">{t.area?.label}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{LABEL_SUBCATEGORIA[t.subcategoria] ?? t.subcategoria}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={ESTADO_LABEL[t.estado] ?? t.estado}
                        size="small"
                        sx={{ bgcolor: `${ESTADO_COLOR[t.estado]}22`, color: ESTADO_COLOR[t.estado], border: `1px solid ${ESTADO_COLOR[t.estado]}55`, fontWeight: 600, fontSize: 11 }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: 12, whiteSpace: "nowrap" }}>
                      {format(new Date(t.createdAt), "dd MMM HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Ver detalle">
                        <IconButton size="small" onClick={() => navigate(`/solicitudes/${t.id}`)}>
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>
    </>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const ticketsVersion = useNotifStore((s) => s.ticketsVersion);
  const rol = user?.rol ?? "";

  const [tickets, setTickets] = useState([]);
  const [recursos, setRecursos] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [misPasos, setMisPasos] = useState([]);
  const [loading, setLoading] = useState(true);

  const isGestor = rol === "GESTOR_RECURSOS_MATERIALES";
  const esTecnico = ["TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS"].includes(rol);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [ticketsRes] = await Promise.all([
          getSolicitudes({ limit: 200 }),
        ]);
        setTickets(ticketsRes?.tickets ?? []);

        if (isGestor) {
          const [rec, asig] = await Promise.all([
            getCatalogos().catch(() => ({ catalogos: [] })),
            getAsignaciones().catch(() => ({ asignaciones: [] })),
          ]);
          setRecursos(rec?.catalogos ?? rec ?? []);
          setAsignaciones(asig?.asignaciones ?? asig ?? []);
        }

        if (esTecnico) {
          getMisPasos().then(setMisPasos).catch(() => {});
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [ticketsVersion, isGestor, esTecnico]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <BarChartIcon sx={{ color: "primary.main", fontSize: 28 }} />
        <Box>
          <Typography variant="h5" fontWeight={700} lineHeight={1}>
            Estadísticas
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {ROL_LABEL[rol] ?? rol}
          </Typography>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {rol === "ADMIN" && <MetricasAdmin tickets={tickets} />}
          {esTecnico && (
            <MetricasTecnico tickets={tickets} user={user} misPasos={misPasos} navigate={navigate} />
          )}
          {rol === "MESA_AYUDA" && <MetricasMesaAyuda tickets={tickets} />}
          {rol === "GESTOR_RECURSOS_MATERIALES" && (
            <MetricasGestor recursos={recursos} asignaciones={asignaciones} />
          )}
          {rol === "EMPLEADO" && <MetricasEmpleado tickets={tickets} navigate={navigate} />}
        </>
      )}
    </Box>
  );
};
