import { create } from "zustand";

// Sistema unificado de diálogos de SIAST — reemplaza window.confirm/window.alert
// y los <Alert> sueltos por una API imperativa coherente con la UI (MUI v6).
//
// Uso desde cualquier lado (dentro o fuera de React):
//   import { confirmar, avisar } from "../store/dialogs.js";
//
//   if (await confirmar({ titulo: "¿Eliminar usuario?", severidad: "error" })) { ... }
//
//   avisar("Guardado correctamente");                    // toast info
//   avisar({ mensaje: "Error al eliminar", severidad: "error" });
//
//   // Confirmación por texto (borrados peligrosos):
//   const ok = await confirmar({
//     titulo: `Desactivar área "${nombre}"`,
//     mensaje: "Esta acción afecta los tickets asociados.",
//     severidad: "warning",
//     textoConfirmacion: nombre, // el usuario debe escribir esto para habilitar
//   });

export const useDialogStore = create((set, get) => ({
  // Diálogo modal bloqueante (confirmar/cancelar). null = cerrado.
  dialogo: null,
  // Snackbar no bloqueante (avisos/errores). null = oculto.
  snack: null,

  // Abre un diálogo de confirmación. Retorna Promise<boolean>.
  confirmar: (opts = {}) =>
    new Promise((resolve) => {
      set({
        dialogo: {
          titulo: opts.titulo ?? "¿Confirmar?",
          mensaje: opts.mensaje ?? "",
          textoAceptar: opts.textoAceptar ?? "Aceptar",
          textoCancelar: opts.textoCancelar ?? "Cancelar",
          // error | warning | info | success — colorea el botón de aceptar
          severidad: opts.severidad ?? "info",
          // Si se define, el usuario debe escribirlo exacto para habilitar Aceptar.
          textoConfirmacion: opts.textoConfirmacion ?? null,
          _resolve: resolve,
        },
      });
    }),

  // Resuelve el diálogo abierto y lo cierra.
  _resolver: (valor) => {
    const d = get().dialogo;
    d?._resolve?.(valor);
    set({ dialogo: null });
  },

  // Muestra un aviso no bloqueante. Acepta string o { mensaje, severidad, duracion }.
  avisar: (opts) => {
    const cfg = typeof opts === "string" ? { mensaje: opts } : (opts ?? {});
    set({
      snack: {
        mensaje: cfg.mensaje ?? "",
        severidad: cfg.severidad ?? "info",
        duracion: cfg.duracion ?? 4000,
      },
    });
  },

  cerrarSnack: () => set({ snack: null }),
}));

// Atajos invocables fuera de componentes React (handlers, catch, etc.).
export const confirmar = (opts) => useDialogStore.getState().confirmar(opts);
export const avisar = (opts) => useDialogStore.getState().avisar(opts);
