import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, TextField, IconButton, Button, Popover, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { StaticDatePicker } from '@mui/x-date-pickers/StaticDatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { es } from 'date-fns/locale';
import { startOfDay, parseISO, format, setMonth, setYear, lastDayOfMonth, addMonths } from 'date-fns';
import TodayIcon from '@mui/icons-material/Today';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { getNormalizedToday } from '@shared/utils/dateUtils';

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: 0,
    backgroundColor: 'transparent',
    '& fieldset': {
      borderColor: theme.palette.divider
    },
    '&:hover fieldset': {
      borderColor: theme.palette.primary.main,
      borderWidth: '1px'
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.primary.main
    },
    '&.Mui-error fieldset': {
      borderColor: theme.palette.error.main
    }
  }
}));

const EntityDateSelect = ({
  label,
  value,
  onChange,
  error,
  helperText,
  startIcon,
  fullWidth = true,
  disabled = false,
  minDate,
  maxDate,
  autoOpen = false,
  embedded = false,
  ...props
}) => {
  // Obtener la fecha actual al inicio del día
  const today = useMemo(() => startOfDay(getNormalizedToday()), []);

  // Función para formatear fecha a YYYY-MM-DD
  const formatToAPI = useCallback((date) => {
    return format(date, 'yyyy-MM-dd');
  }, []);

  const handleToday = useCallback(() => {
    onChange(today);
  }, [onChange, today]);

  const handleDateChange = useCallback((newDate) => {
    if (!newDate || isNaN(newDate.getTime())) return;
    // Normalizar la fecha al inicio del día
    const normalizedDate = startOfDay(newDate);
    onChange(normalizedDate);
  }, [onChange]);

  const inputRef = useRef();

  // Parsear el valor inicial
  const parsedValue = useMemo(() => {
    if (!value) return today;
    if (value instanceof Date && !isNaN(value)) return value;
    try {
      const date = parseISO(value);
      return isNaN(date.getTime()) ? today : startOfDay(date);
    } catch {
      return today;
    }
  }, [value, today]);

  const parsedMinDate = useMemo(() => {
    if (!minDate) return undefined;
    try {
      const d = parseISO(minDate);
      return isNaN(d.getTime()) ? undefined : startOfDay(d);
    } catch {
      return undefined;
    }
  }, [minDate]);

  const parsedMaxDate = useMemo(() => {
    if (!maxDate) return undefined;
    try {
      const d = parseISO(maxDate);
      return isNaN(d.getTime()) ? undefined : startOfDay(d);
    } catch {
      return undefined;
    }
  }, [maxDate]);

  const displayedMonth = parsedValue.getMonth();
  const displayedYear = parsedValue.getFullYear();
  const monthLabels = useMemo(() => {
    // Nombres de mes en español (enero, febrero, ...)
    return Array.from({ length: 12 }, (_, m) => format(new Date(2020, m, 1), 'LLLL', { locale: es }));
  }, []);

  const isMonthSelectable = useCallback((year, month) => {
    const start = startOfDay(new Date(year, month, 1));
    const end = lastDayOfMonth(start);
    if (parsedMinDate && end < parsedMinDate) return false;
    if (parsedMaxDate && start > parsedMaxDate) return false;
    return true;
  }, [parsedMinDate, parsedMaxDate]);

  const isYearSelectable = useCallback((year) => {
    const start = startOfDay(new Date(year, 0, 1));
    const end = startOfDay(new Date(year, 11, 31));
    if (parsedMinDate && end < parsedMinDate) return false;
    if (parsedMaxDate && start > parsedMaxDate) return false;
    return true;
  }, [parsedMinDate, parsedMaxDate]);

  const clampToMinMax = useCallback((date) => {
    let d = startOfDay(date);
    if (parsedMinDate && d < parsedMinDate) d = parsedMinDate;
    if (parsedMaxDate && d > parsedMaxDate) d = parsedMaxDate;
    return d;
  }, [parsedMinDate, parsedMaxDate]);

  const updateMonthYear = useCallback((nextMonth, nextYear) => {
    // Mantener el día si es posible; si no, clamp al último día del mes destino.
    const base = startOfDay(parsedValue);
    const withMonth = setMonth(base, nextMonth);
    const withYear = setYear(withMonth, nextYear);
    const endDay = lastDayOfMonth(withYear).getDate();
    const desiredDay = base.getDate();
    const safe = new Date(withYear);
    safe.setDate(Math.min(desiredDay, endDay));
    handleDateChange(clampToMinMax(safe));
  }, [parsedValue, handleDateChange, clampToMinMax]);

  const shiftMonth = useCallback((delta) => {
    const next = addMonths(startOfDay(parsedValue), delta);
    handleDateChange(clampToMinMax(next));
  }, [parsedValue, handleDateChange, clampToMinMax]);

  const canShiftMonth = useCallback((delta) => {
    if (!parsedMinDate && !parsedMaxDate) return true;
    const next = addMonths(startOfDay(parsedValue), delta);
    const start = startOfDay(new Date(next.getFullYear(), next.getMonth(), 1));
    const end = lastDayOfMonth(start);
    if (parsedMinDate && end < parsedMinDate) return false;
    if (parsedMaxDate && start > parsedMaxDate) return false;
    return true;
  }, [parsedValue, parsedMinDate, parsedMaxDate]);

  // Popovers (grid) para Mes/Año: más visual y menos confuso que "Mes Año" como bloque único
  const [monthAnchorEl, setMonthAnchorEl] = useState(null);
  const [yearAnchorEl, setYearAnchorEl] = useState(null);
  const monthOpen = Boolean(monthAnchorEl);
  const yearOpen = Boolean(yearAnchorEl);

  const yearsPerPage = 12;
  const [yearPageStart, setYearPageStart] = useState(displayedYear - (displayedYear % yearsPerPage));

  useEffect(() => {
    if (yearOpen) {
      setYearPageStart(displayedYear - (displayedYear % yearsPerPage));
    }
  }, [yearOpen, displayedYear]);

  const [open, setOpen] = useState(false);

  // Permite abrir el calendario automáticamente (ej: al abrir un diálogo/formulario)
  useEffect(() => {
    if (!embedded && autoOpen && !disabled) {
      // microtask para evitar conflictos con mounts en Dialog/Popper
      Promise.resolve().then(() => setOpen(true));
    }
  }, [autoOpen, disabled, embedded]);

  return (
    <LocalizationProvider 
      dateAdapter={AdapterDateFns} 
      adapterLocale={es}
    >
      {embedded ? (
        <Box
          sx={{
            width: '100%',
            // Hacer que el calendario use solo el ancho disponible del contenedor "main"
            '& .MuiPickersLayout-root': { width: '100%' },
            '& .MuiPickersLayout-contentWrapper': { width: '100%' },
            // Ocultamos el header interno para evitar confusión "mes+año" como un solo bloque clicable.
            // Lo reemplazamos con controles separados (Mes / Año) arriba del calendario.
            '& .MuiPickersCalendarHeader-root': { display: 'none' },
            '& .MuiDayCalendar-weekContainer': { mx: 0 },
            '& .MuiPickersDay-root': { m: 0.2 },
            // Reducir padding interno para que no “infle” el dialog
            '& .MuiPickersLayout-actionBar': { display: 'none' }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <IconButton
              size="small"
              onClick={() => shiftMonth(-1)}
              disabled={disabled || !canShiftMonth(-1)}
              aria-label="Mes anterior"
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>

            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Button
                variant="text"
                size="small"
                onClick={(e) => setMonthAnchorEl(e.currentTarget)}
                disabled={disabled}
                sx={{ textTransform: 'none', px: 1, minWidth: 0 }}
              >
                {monthLabels[displayedMonth]}
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={(e) => setYearAnchorEl(e.currentTarget)}
                disabled={disabled}
                sx={{ textTransform: 'none', px: 1, minWidth: 0 }}
              >
                {displayedYear}
              </Button>
            </Box>

            <IconButton
              size="small"
              onClick={() => shiftMonth(1)}
              disabled={disabled || !canShiftMonth(1)}
              aria-label="Mes siguiente"
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Box>

          <Popover
            open={monthOpen}
            anchorEl={monthAnchorEl}
            onClose={() => setMonthAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            transformOrigin={{ vertical: 'top', horizontal: 'center' }}
            PaperProps={{ sx: { p: 1 } }}
          >
            <Typography variant="caption" sx={{ px: 0.5, color: 'text.secondary' }}>
              Selecciona mes
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(90px, 1fr))',
                gap: 0.5,
                mt: 0.5
              }}
            >
              {monthLabels.map((label, m) => {
                const selectable = isMonthSelectable(displayedYear, m);
                const selected = m === displayedMonth;
                return (
                  <Button
                    key={label}
                    variant={selected ? 'contained' : 'text'}
                    size="small"
                    disabled={disabled || !selectable}
                    onClick={() => {
                      updateMonthYear(m, displayedYear);
                      setMonthAnchorEl(null);
                    }}
                    sx={{ textTransform: 'none', justifyContent: 'center' }}
                  >
                    {label}
                  </Button>
                );
              })}
            </Box>
          </Popover>

          <Popover
            open={yearOpen}
            anchorEl={yearAnchorEl}
            onClose={() => setYearAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            transformOrigin={{ vertical: 'top', horizontal: 'center' }}
            PaperProps={{ sx: { p: 1, width: 360, maxWidth: '90vw' } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <IconButton
                size="small"
                onClick={() => setYearPageStart((y) => y - yearsPerPage)}
                disabled={disabled}
                aria-label="Años anteriores"
              >
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Selecciona año
              </Typography>
              <IconButton
                size="small"
                onClick={() => setYearPageStart((y) => y + yearsPerPage)}
                disabled={disabled}
                aria-label="Años siguientes"
              >
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(70px, 1fr))',
                gap: 0.5
              }}
            >
              {Array.from({ length: yearsPerPage }, (_, i) => yearPageStart + i).map((y) => {
                const selectable = isYearSelectable(y);
                const selected = y === displayedYear;
                return (
                  <Button
                    key={y}
                    variant={selected ? 'contained' : 'text'}
                    size="small"
                    disabled={disabled || !selectable}
                    onClick={() => {
                      updateMonthYear(displayedMonth, y);
                      setYearAnchorEl(null);
                    }}
                  >
                    {y}
                  </Button>
                );
              })}
            </Box>
          </Popover>

          <StaticDatePicker
            displayStaticWrapperAs="mobile"
            value={parsedValue}
            onChange={handleDateChange}
            disabled={disabled}
            minDate={parsedMinDate}
            maxDate={parsedMaxDate}
            // Permite saltar a selección directa de mes/año (menos clicks que avanzar con flechas)
            views={['year', 'month', 'day']}
            openTo="day"
            showToolbar={false}
            componentsProps={{ actionBar: { actions: [] } }}
            renderInput={(params) => (
              <StyledTextField
                {...params}
                fullWidth={fullWidth}
                error={error}
                helperText={helperText}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: null,
                  endAdornment: null,
                  sx: { borderRadius: 0 }
                }}
              />
            )}
            {...props}
          />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DatePicker
            label={label}
            value={parsedValue}
            onChange={handleDateChange}
            disabled={disabled}
            minDate={parsedMinDate}
            maxDate={parsedMaxDate}
            // Permite saltar a selección directa de mes/año (menos clicks que avanzar con flechas)
            views={['year', 'month', 'day']}
            openTo="day"
            inputFormat="dd/MM/yyyy"
            mask="__/__/____"
            open={open}
            onOpen={() => setOpen(true)}
            onClose={() => setOpen(false)}
            PopperProps={{
              anchorEl: inputRef.current || undefined,
              sx: { zIndex: 1500 }
            }}
            renderInput={(params) => (
              <StyledTextField
                {...params}
                inputRef={inputRef}
                fullWidth={fullWidth}
                error={error}
                helperText={helperText}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: null,
                  endAdornment: null,
                  sx: { borderRadius: 0 }
                }}
              />
            )}
            {...props}
          />
          <IconButton
            onClick={() => setOpen(true)}
            disabled={disabled}
            sx={{
              color: '#fff', // Blanco
              backgroundColor: 'transparent',
              p: 0.5,
              '&:hover': {
                backgroundColor: 'action.hover',
                color: 'primary.main',
              },
              '&:disabled': {
                opacity: 0.5,
                cursor: 'not-allowed'
              }
            }}
          >
            <TodayIcon sx={{ fontSize: 24 }} />
          </IconButton>
        </Box>
      )}
    </LocalizationProvider>
  );
};

export const CommonDate = EntityDateSelect;
export default React.memo(EntityDateSelect); 
