import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { useAuthStore } from "../../store/auth.js";

const VIEWER_URL =
  import.meta.env.VITE_VIEWER_URL ?? `http://${window.location.hostname}:5174`;

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
    ref.current?.contentWindow?.postMessage({ type, payload }, "*");
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
