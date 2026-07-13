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
 *   autoHighlight?: { floor, roomId }
 *   loginMode?: boolean
 */
export const BuildingViewer = ({ onRoomClick, autoHighlight, loginMode = false, sx = {} }) => {
  const ref = useRef(null);
  const token = useAuthStore((s) => s.token);

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

  // Escuchar mensajes desde el viewer
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "ROOM_CLICKED" && onRoomClick) {
        onRoomClick(e.data.payload);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onRoomClick]);

  // Activar login mode y pasar token cuando el iframe cargue
  const onLoad = () => {
    if (token) send("SET_TOKEN", { token });
    if (loginMode) send("SET_LOGIN_MODE", { enabled: true });
    if (autoHighlight) send("HIGHLIGHT_ROOM", autoHighlight);
  };

  // Actualizar token en el iframe si cambia (re-login, refresh)
  useEffect(() => {
    if (token) send("SET_TOKEN", { token });
  }, [token]);

  // Reaccionar a cambios externos
  useEffect(() => {
    if (autoHighlight) send("HIGHLIGHT_ROOM", autoHighlight);
  }, [autoHighlight?.roomId, autoHighlight?.floor]);

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
