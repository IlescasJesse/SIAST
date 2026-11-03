/**
 * Adjuntos de solicitudes y comentarios (capturas y documentos).
 *
 *   useAdjuntos()        — estado de los archivos por enviar + validación + pegado (Ctrl+V)
 *   <AdjuntosSelector/>  — botón "Adjuntar" y vista previa de lo que se va a enviar
 *   <AdjuntosLista/>     — adjuntos ya guardados (miniatura si es imagen; clic abre/descarga)
 *
 * La API valida de nuevo (tipo, firma y tamaño); aquí la validación es solo para UX.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Chip, IconButton, Tooltip, Typography } from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import { ADJUNTOS_MAX_ARCHIVOS, ADJUNTOS_MAX_BYTES, ADJUNTOS_TIPOS } from "@stf/shared";
import { descargarAdjunto } from "../../api/solicitudes.js";
import { avisar } from "../../store/dialogs.js";

const ACCEPT = Object.keys(ADJUNTOS_TIPOS)
  .map((ext) => `.${ext}`)
  .join(",");
const MAX_MB = ADJUNTOS_MAX_BYTES / (1024 * 1024);

const extensionDe = (nombre) => (nombre.includes(".") ? nombre.split(".").pop().toLowerCase() : "");

const formatoTamano = (bytes) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** Las capturas pegadas llegan todas como "image.png": se les da un nombre con fecha y hora. */
const renombrarCaptura = (file, indice) => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const sello = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const ext = extensionDe(file.name) || "png";
  return new File([file], `captura-${sello}${indice ? `-${indice + 1}` : ""}.${ext}`, {
    type: file.type,
  });
};

export const useAdjuntos = () => {
  const [archivos, setArchivos] = useState([]);
  const [error, setError] = useState("");
  // Espejo para validar el cupo sin depender del closure del último render
  const archivosRef = useRef([]);

  const actualizar = (lista) => {
    archivosRef.current = lista;
    setArchivos(lista);
  };

  const agregar = useCallback((nuevos, { pegados = false } = {}) => {
    const aceptados = [];
    let aviso = "";
    for (const [i, original] of [...nuevos].entries()) {
      const file =
        pegados && original.type.startsWith("image/") ? renombrarCaptura(original, i) : original;
      if (!ADJUNTOS_TIPOS[extensionDe(file.name)]) {
        aviso = `"${file.name}" no es un tipo de archivo permitido`;
      } else if (file.size > ADJUNTOS_MAX_BYTES) {
        aviso = `"${file.name}" pesa más de ${MAX_MB} MB`;
      } else if (file.size === 0) {
        aviso = `"${file.name}" está vacío`;
      } else if (archivosRef.current.length + aceptados.length >= ADJUNTOS_MAX_ARCHIVOS) {
        aviso = `Máximo ${ADJUNTOS_MAX_ARCHIVOS} archivos por envío`;
        break;
      } else {
        aceptados.push(file);
      }
    }
    setError(aviso);
    if (aceptados.length > 0) actualizar([...archivosRef.current, ...aceptados]);
  }, []);

  const quitar = useCallback((indice) => {
    setError("");
    actualizar(archivosRef.current.filter((_, i) => i !== indice));
  }, []);

  const limpiar = useCallback(() => {
    setError("");
    actualizar([]);
  }, []);

  /**
   * onPaste para el formulario: adjunta la captura (o archivo) del portapapeles.
   * Si el portapapeles trae texto se deja el pegado normal — Word/Excel copian
   * texto + una imagen del mismo contenido, y ahí lo que se quiere es el texto.
   */
  const onPaste = useCallback(
    (e) => {
      const datos = e.clipboardData;
      const files = [...(datos?.files ?? [])];
      if (files.length === 0 || datos.types?.includes("text/plain")) return;
      e.preventDefault();
      agregar(files, { pegados: true });
    },
    [agregar],
  );

  return { archivos, error, agregar, quitar, limpiar, onPaste };
};

/** Miniatura de un archivo local (aún sin subir). */
function MiniaturaLocal({ file }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url ? <Box component="img" src={url} alt={file.name} sx={miniaturaSx} /> : null;
}

const miniaturaSx = {
  width: 56,
  height: 56,
  objectFit: "cover",
  borderRadius: 1,
  border: "1px solid",
  borderColor: "divider",
  display: "block",
};

/**
 * Botón "Adjuntar" + vista previa de los archivos por enviar.
 * @param {ReturnType<typeof useAdjuntos>} adjuntos
 * @param {boolean} [compacto] — solo ícono (para la caja de comentarios)
 * @param {boolean} [soloBoton] / [soloPreview] — para colocar cada parte por separado
 */
export function AdjuntosSelector({ adjuntos, compacto = false, soloBoton, soloPreview, disabled }) {
  const inputRef = useRef(null);
  const { archivos, error, agregar, quitar } = adjuntos;
  const lleno = archivos.length >= ADJUNTOS_MAX_ARCHIVOS;
  const ayuda = `Imágenes, PDF, Word, Excel, PowerPoint o texto · máx. ${MAX_MB} MB · hasta ${ADJUNTOS_MAX_ARCHIVOS} archivos`;

  const boton = (
    <>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        accept={ACCEPT}
        onChange={(e) => {
          agregar(e.target.files ?? []);
          e.target.value = ""; // permite volver a elegir el mismo archivo
        }}
      />
      {compacto ? (
        <Tooltip title={`Adjuntar archivo — ${ayuda}. También puedes pegar una captura con Ctrl+V`}>
          <span>
            <IconButton
              aria-label="Adjuntar archivo"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || lleno}
            >
              <AttachFileIcon />
            </IconButton>
          </span>
        </Tooltip>
      ) : (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AttachFileIcon />}
            onClick={() => inputRef.current?.click()}
            disabled={disabled || lleno}
          >
            Adjuntar archivo
          </Button>
          <Typography variant="caption" color="text.secondary">
            o pega una captura con Ctrl+V · {ayuda}
          </Typography>
        </Box>
      )}
    </>
  );

  const preview = (archivos.length > 0 || error) && (
    <Box>
      {archivos.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {archivos.map((file, i) =>
            file.type.startsWith("image/") ? (
              <Box key={`${file.name}-${i}`} sx={{ position: "relative" }}>
                <Tooltip title={`${file.name} · ${formatoTamano(file.size)}`}>
                  <span>
                    <MiniaturaLocal file={file} />
                  </span>
                </Tooltip>
                <IconButton
                  size="small"
                  aria-label={`Quitar ${file.name}`}
                  onClick={() => quitar(i)}
                  sx={{
                    position: "absolute",
                    top: -8,
                    right: -8,
                    p: 0.25,
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    "&:hover": { bgcolor: "background.paper" },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            ) : (
              <Chip
                key={`${file.name}-${i}`}
                icon={<InsertDriveFileOutlinedIcon />}
                label={`${file.name} · ${formatoTamano(file.size)}`}
                onDelete={() => quitar(i)}
                variant="outlined"
                sx={{ maxWidth: 260 }}
              />
            ),
          )}
        </Box>
      )}
      {error && (
        <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
          {error}
        </Typography>
      )}
    </Box>
  );

  if (soloBoton) return boton;
  if (soloPreview) return preview || null;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {boton}
      {preview}
    </Box>
  );
}

/** Abre el blob en otra pestaña (imagen/PDF) o lo descarga con su nombre original. */
const abrirBlob = (blob, adjunto) => {
  const url = URL.createObjectURL(blob);
  const enLinea = adjunto.mimeType.startsWith("image/") || adjunto.mimeType === "application/pdf";
  if (enLinea) {
    window.open(url, "_blank", "noopener");
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = adjunto.nombreOriginal;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

/** Un adjunto guardado. La descarga va con el token (no es una URL pública). */
function AdjuntoGuardado({ adjunto }) {
  const esImagen = adjunto.mimeType.startsWith("image/");
  const [blob, setBlob] = useState(null);
  const [url, setUrl] = useState(null);

  // Las imágenes se cargan de una vez para mostrar la miniatura
  useEffect(() => {
    if (!esImagen) return undefined;
    let vigente = true;
    let objectUrl = null;
    descargarAdjunto(adjunto.id)
      .then((b) => {
        if (!vigente) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
      })
      .catch(() => {
        /* sin miniatura: queda el chip con el nombre */
      });
    return () => {
      vigente = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [adjunto.id, esImagen]);

  const abrir = async () => {
    try {
      abrirBlob(blob ?? (await descargarAdjunto(adjunto.id)), adjunto);
    } catch {
      avisar({ mensaje: "No se pudo abrir el archivo adjunto", severidad: "error" });
    }
  };

  const titulo = `${adjunto.nombreOriginal} · ${formatoTamano(adjunto.tamano)}`;

  if (esImagen && url) {
    return (
      <Tooltip title={titulo}>
        <Box
          component="img"
          src={url}
          alt={adjunto.nombreOriginal}
          onClick={abrir}
          sx={{ ...miniaturaSx, width: 72, height: 72, cursor: "pointer" }}
        />
      </Tooltip>
    );
  }
  return (
    <Chip
      icon={<InsertDriveFileOutlinedIcon />}
      label={titulo}
      onClick={abrir}
      variant="outlined"
      size="small"
      sx={{ maxWidth: 280 }}
    />
  );
}

export function AdjuntosLista({ adjuntos, sx }) {
  if (!adjuntos?.length) return null;
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", ...sx }}>
      {adjuntos.map((a) => (
        <AdjuntoGuardado key={a.id} adjunto={a} />
      ))}
    </Box>
  );
}
