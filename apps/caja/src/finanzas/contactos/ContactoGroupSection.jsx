import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Box, ButtonBase, Collapse, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ExpandMoreRounded } from '@mui/icons-material';
import { hubSectionBg } from '@shared/styles/hubSectionStyles';
import { collapsePanelProps } from '@shared/styles/collapseSectionStyles';
import { FONT_SIZE, FONT_WEIGHT, hubEyebrowSx, hubNumericSx } from '@shared/tipografia';

const INITIAL_BATCH_SIZE = 25;
const BATCH_STEP = 25;

/**
 * Grupo colapsable de contactos con estética Hub / AccountListGroup
 * (borderRadius 0, borde 1px divider, cabecera tintada, contador tabular
 * y renderizado progresivo por lotes con IntersectionObserver).
 */
const ContactoGroupSection = memo(function ContactoGroupSection({
  title,
  count,
  icon = null,
  accentColor = null,
  defaultExpanded = true,
  children,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH_SIZE);
  const sentinelRef = useRef(null);

  const childArray = useMemo(() => React.Children.toArray(children), [children]);
  const totalChildren = childArray.length;
  const hasMore = visibleCount < totalChildren;

  // Si la lista se achica (por filtro/búsqueda), normalizar el lote visible
  useEffect(() => {
    if (totalChildren <= INITIAL_BATCH_SIZE && visibleCount !== INITIAL_BATCH_SIZE) {
      setVisibleCount(INITIAL_BATCH_SIZE);
    }
  }, [totalChildren, visibleCount]);

  // Cargar el siguiente lote automáticamente al acercarse al final del grupo
  useEffect(() => {
    if (!expanded || !hasMore) return undefined;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((prev) => Math.min(prev + BATCH_STEP, totalChildren));
        }
      },
      { rootMargin: '200px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [expanded, hasMore, totalChildren]);

  const renderedIcon = useMemo(() => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    const IconComp = icon;
    return <IconComp sx={{ fontSize: 14, color: accentColor || 'text.secondary' }} />;
  }, [icon, accentColor]);

  const visibleChildren = hasMore ? childArray.slice(0, visibleCount) : childArray;
  const remaining = totalChildren - visibleChildren.length;

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 0,
        bgcolor: hubSectionBg,
        overflow: 'hidden',
      }}
    >
      <ButtonBase
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1.5,
          py: 0.625,
          minHeight: 30,
          borderRadius: 0,
          borderBottom: expanded ? '1px solid' : 'none',
          borderColor: 'divider',
          bgcolor: (theme) =>
            alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.04 : 0.03),
          '&:hover': {
            bgcolor: (theme) =>
              alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.065 : 0.05),
          },
          textAlign: 'left',
          transition: 'background-color 0.14s ease',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
          {renderedIcon && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                color: accentColor || 'text.secondary',
                flexShrink: 0,
              }}
            >
              {renderedIcon}
            </Box>
          )}
          <Typography
            component="span"
            noWrap
            sx={{
              ...hubEyebrowSx,
              fontWeight: FONT_WEIGHT.semibold,
              color: accentColor || 'text.secondary',
            }}
          >
            {title}
          </Typography>
        </Box>

        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <Typography
            component="span"
            sx={{
              ...hubNumericSx,
              fontSize: FONT_SIZE.xs,
              fontWeight: FONT_WEIGHT.semibold,
              color: accentColor || 'text.secondary',
            }}
          >
            {count}
          </Typography>
          <ExpandMoreRounded
            sx={{
              fontSize: 16,
              color: expanded ? 'text.primary' : 'text.secondary',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 160ms ease, color 160ms ease',
            }}
          />
        </Box>
      </ButtonBase>

      <Collapse in={expanded} {...collapsePanelProps}>
        <Box>
          {visibleChildren}
          {hasMore && (
            <Box
              ref={sentinelRef}
              sx={{
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              <ButtonBase
                type="button"
                onClick={() =>
                  setVisibleCount((prev) => Math.min(prev + BATCH_STEP, totalChildren))
                }
                sx={{
                  width: '100%',
                  py: 0.75,
                  px: 1.5,
                  borderRadius: 0,
                  justifyContent: 'center',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Typography
                  sx={{
                    ...hubEyebrowSx,
                    fontSize: FONT_SIZE['2xs'],
                    color: 'text.secondary',
                  }}
                >
                  Mostrar más ({remaining} restantes)
                </Typography>
              </ButtonBase>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
});

export default ContactoGroupSection;
