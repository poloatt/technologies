import React, { useState } from 'react';
import { Box, Collapse, Typography } from '@mui/material';
import { KeyboardArrowDown as ChevronDownIcon } from '@mui/icons-material';
import {
  TareaFormSecondaryLine,
  tareaFormRowIconSx,
} from '@shared/components/forms/tareaFormUi';

/**
 * Filas expandibles estilo Google Calendar (sin contenedor tipo acordeón).
 */
export default function PropiedadDetailSections({ sections = [] }) {
  const [expandedKey, setExpandedKey] = useState(
    () => sections.find((section) => section.defaultExpanded)?.key ?? null,
  );

  const handleToggle = (key) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  if (!sections.length) return null;

  return (
    <Box>
      {sections.map((section) => {
        const key = section.key;
        const expanded = expandedKey === key;
        const Icon = section.icon;

        return (
          <Box key={key}>
            <Box
              component="button"
              type="button"
              onClick={() => handleToggle(key)}
              aria-expanded={expanded}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 2,
                width: '100%',
                minHeight: 44,
                py: 1.25,
                px: 0,
                border: 'none',
                bgcolor: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                font: 'inherit',
                color: 'text.primary',
                borderBottom: 1,
                borderColor: 'divider',
                '&:hover': { opacity: 0.92 },
              }}
            >
              {Icon ? <Icon sx={tareaFormRowIconSx} /> : <Box sx={{ width: 20, flexShrink: 0 }} />}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  component="span"
                  sx={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.45 }}
                >
                  {section.title}
                </Typography>
                {!expanded && section.summary ? (
                  <TareaFormSecondaryLine>{section.summary}</TareaFormSecondaryLine>
                ) : null}
              </Box>
              <ChevronDownIcon
                sx={{
                  fontSize: 20,
                  color: 'text.secondary',
                  flexShrink: 0,
                  mt: 0.25,
                  transition: 'transform 0.2s ease',
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </Box>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box
                sx={{
                  pl: 4.5,
                  pr: 0,
                  pt: 0.5,
                  pb: 1.25,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                {section.children}
              </Box>
            </Collapse>
          </Box>
        );
      })}
    </Box>
  );
}
