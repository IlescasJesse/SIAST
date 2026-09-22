import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { useAuthStore } from "../../store/auth.js";

const VIEWER_URL = (() => {
  const envUrl = import.meta.env.VITE_VIEWER_URL;
  // Acepta URL absoluta (http://...) o ruta relativa same-origin (/visor3d/)
  if (envUrl && typeof envUrl === "string" && envUrl.length > 0) return envUrl;
  return `http://${window.location.hostname}:5174`;
})();

/**
 * Wrapper del iframe 3D con helpers postMessage.
 * Props:
 *   onRoomClick?: (payload) => void
 *   autoHighlight?: { floor, roomId } — resalta y va al piso (sin zoom al área)
 *   focusAreaId?: string — hace zoom automático al área (FLY_TO_AREA). Tiene
 *     prioridad sobre autoHighlight cuando ambos están presentes.
 *   loginMode?: boolean
 *
 * Timing: el visor tarda un instante en poblar su mapa de áreas (llega vía
 * fetch async a /api/catalogos/areas — ver VIEWER_READY en modelado-3d/main.js).
 * Los comandos de zoom (HIGHLIGHT_ROOM/FLY_TO_AREA) mandados antes de que el
 * visor avise VIEWER_READY se encolan y se disparan en cuanto llega esa señal,
 * para no perder silenciosamente el zoom si el área todavía no existía en el
 * mapa interno del visor.
 */
export const BuildingViewer = ({
  onRoomClick,
  autoHighlight,
  focusAreaId,
  loginMode = false,
  sx = {},
}) => {
  const ref = useRef(null);
  const token = useAuthStore((s) => s.token);
  const viewerReadyRef = useRef(false);
  const pendingZoomRef = useRef(null);

  const send = (type, payload) => {
    try {
      // Origin destino: si VIEWER_URL es absoluto usa su origin; si es relativo
      // (/visor3d/) el visor corre en el mismo origen que esta página.
      const origin = VIEWER_URL.startsWith("http")
        ? new URL(VIEWER_URL).origin
        : window.location.origin;
      ref.current?.contentWindow?.postMessage({ type, payload }, origin);
    } catch {
      // viewer no disponible
    }
  };

  // Comandos de zoom (HIGHLIGHT_ROOM / FLY_TO_AREA): si el visor todavía no
  // mandó VIEWER_READY se encola solo el último (no tiene sentido acumular
  // varios) y se dispara en cuanto llegue la señal.
  const sendZoom = (type, payload) => {
    if (viewerReadyRef.current) {
      send(type, payload);
    } else {
      pendingZoomRef.current = { type, payload };
    }
  };

  // Escuchar mensajes desde el viewer
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "ROOM_CLICKED" && onRoomClick) {
        onRoomClick(e.data.payload);
      }
      if (e.data?.type === "VIEWER_READY") {
        viewerReadyRef.current = true;
        if (pendingZoomRef.current) {
          send(pendingZoomRef.current.type, pendingZoomRef.current.payload);
          pendingZoomRef.current = null;
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onRoomClick]);

  // Activar login mode y pasar token cuando el iframe cargue
  const onLoad = () => {
    // El iframe se recargó (o cargó por primera vez): el visor arranca su
    // propio ciclo de VIEWER_READY otra vez.
    viewerReadyRef.current = false;
    pendingZoomRef.current = null;
    if (token) send("SET_TOKEN", { token });
    if (loginMode) send("SET_LOGIN_MODE", { enabled: true });
    if (focusAreaId) sendZoom("FLY_TO_AREA", { areaId: focusAreaId });
    else if (autoHighlight) sendZoom("HIGHLIGHT_ROOM", autoHighlight);
  };

  // Actualizar token en el iframe si cambia (re-login, refresh)
  useEffect(() => {
    if (token) send("SET_TOKEN", { token });
  }, [token]);

  // Reaccionar a cambios externos: zoom al área (prioridad sobre highlight simple)
  useEffect(() => {
    if (focusAreaId) sendZoom("FLY_TO_AREA", { areaId: focusAreaId });
  }, [focusAreaId]);

  useEffect(() => {
    if (!focusAreaId && autoHighlight) sendZoom("HIGHLIGHT_ROOM", autoHighlight);
  }, [autoHighlight?.roomId, autoHighlight?.floor, focusAreaId]);

  return (
    <Box sx={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: 2, ...sx }}>
      <iframe
        ref={ref}
        src={VIEWER_URL}
        title="Edificio Saúl Martínez"
        onLoad={onLoad}
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        allow="accelerometer"
      />
    </Box>
  );
};
