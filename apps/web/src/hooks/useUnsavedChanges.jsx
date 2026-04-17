/**
 * useUnsavedChanges
 *
 * Hook que protege contra pérdida accidental de cambios no guardados:
 *  1. Intercepta cierre/recarga de pestaña (beforeunload)
 *  2. Bloquea navegación interna con React Router (useBlocker)
 *  3. Muestra un Dialog de confirmación de MUI
 *
 * Uso:
 *   const isDirty = form._dirty ?? false;
 *   const { ConfirmDialog } = useUnsavedChanges(isDirty);
 *   // Renderizar al final del return:
 *   <ConfirmDialog />
 */

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

/**
 * useUnsavedChanges
 *
 * Protege contra pérdida accidental de cambios no guardados:
 *  1. Intercepta cierre/recarga de pestaña (beforeunload)
 *  2. Parchea navigate() para confirmar antes de salir
 *
 * Nota: useBlocker requiere data router (createBrowserRouter) que este
 * proyecto no usa. Se usa window.confirm como alternativa compatible.
 */
export function useUnsavedChanges(isDirty) {
  const navigate = useNavigate();
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Bloquea el cierre/recarga de la pestaña del navegador
  useEffect(() => {
    const handler = (e) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // navigate seguro: pide confirmación si hay cambios sin guardar
  const safeNavigate = (to, options) => {
    if (
      isDirtyRef.current &&
      !window.confirm("Tienes cambios sin guardar. ¿Deseas salir de todas formas?")
    ) {
      return;
    }
    navigate(to, options);
  };

  // ConfirmDialog es un no-op (compatibilidad con el JSX que lo renderiza)
  const ConfirmDialog = () => null;

  return { ConfirmDialog, safeNavigate };
}
