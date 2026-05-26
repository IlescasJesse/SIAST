import { useState } from "react";
import {
  IconButton, Popover, Box, Button, Typography, Badge, Tooltip,
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { es } from "date-fns/locale";
import { subDays, isEqual, startOfDay } from "date-fns";
import PropTypes from "prop-types";

const DEFAULT_START = () => subDays(new Date(), 30);
const DEFAULT_END = () => new Date();

/**
 * Filtro de rango de fechas como settings dropdown.
 * Muestra badge cuando el rango no es el default (últimos 30 días).
 * @param {{ value: {start: Date, end: Date}, onChange: Function }} props
 */
export function DateRangeFilter({ value, onChange }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [draft, setDraft] = useState(value);

  const isDefault =
    isEqual(startOfDay(value.start), startOfDay(DEFAULT_START())) &&
    isEqual(startOfDay(value.end), startOfDay(DEFAULT_END()));

  const handleApply = () => {
    onChange(draft);
    setAnchorEl(null);
  };

  const handleCancel = () => {
    setDraft(value);
    setAnchorEl(null);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <Tooltip title="Filtrar por periodo">
        <Badge color="primary" variant="dot" invisible={isDefault}>
          <IconButton
            size="small"
            onClick={(e) => { setDraft(value); setAnchorEl(e.currentTarget); }}
            aria-label="Filtrar por periodo"
          >
            <TuneIcon fontSize="small" />
          </IconButton>
        </Badge>
      </Tooltip>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleCancel}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ p: 2, minWidth: 280 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
            Filtrar por periodo
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <DatePicker
              label="Desde"
              value={draft.start}
              onChange={(v) => v && setDraft((d) => ({ ...d, start: v }))}
              maxDate={draft.end}
              slotProps={{ textField: { size: "small", fullWidth: true } }}
            />
            <DatePicker
              label="Hasta"
              value={draft.end}
              onChange={(v) => v && setDraft((d) => ({ ...d, end: v }))}
              minDate={draft.start}
              maxDate={new Date()}
              slotProps={{ textField: { size: "small", fullWidth: true } }}
            />
          </Box>
          <Box sx={{ display: "flex", gap: 1, mt: 2, justifyContent: "flex-end" }}>
            <Button size="small" onClick={handleCancel}>Cancelar</Button>
            <Button size="small" variant="contained" onClick={handleApply}>Aplicar</Button>
          </Box>
        </Box>
      </Popover>
    </LocalizationProvider>
  );
}

DateRangeFilter.propTypes = {
  value: PropTypes.shape({ start: PropTypes.instanceOf(Date), end: PropTypes.instanceOf(Date) }).isRequired,
  onChange: PropTypes.func.isRequired,
};
