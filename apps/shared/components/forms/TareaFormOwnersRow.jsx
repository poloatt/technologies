import React from 'react';
import { Box, Chip, IconButton, Stack, Typography } from '@mui/material';
import { PersonAddOutlined as PersonAddIcon } from '@mui/icons-material';
import { TareaFormRow } from './tareaFormLayout';
import { TareaFormIcons } from './tareaFormIcons';
import { tareaFormRowContentGutterSx } from './tareaFormTokens';

function ownerId(entry) {
  if (entry == null) return '';
  if (typeof entry === 'object') return String(entry._id || entry.id || '');
  return String(entry);
}

function ownerLabel(entry, currentUserId) {
  const id = ownerId(entry);
  if (currentUserId && id === String(currentUserId)) return 'Yo';
  if (typeof entry === 'object') {
    return entry.nombre || entry.email || 'Usuario';
  }
  return 'Usuario';
}

/**
 * Owners de la tarea: siempre visible (creador = Yo); agregar co-owner vía onAddOwner.
 */
export default function TareaFormOwnersRow({
  owners = [],
  creatorId = null,
  currentUserId = null,
  onAddOwner,
  readOnly = false,
}) {
  const creator = creatorId || currentUserId;
  const normalized = Array.isArray(owners) && owners.length > 0
    ? owners
    : (creator ? [creator] : []);

  const seen = new Set();
  const chips = [];
  for (const entry of normalized) {
    const id = ownerId(entry);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    chips.push({ id, entry });
  }
  if (creator && !seen.has(String(creator))) {
    chips.unshift({ id: String(creator), entry: creator });
  }

  return (
    <TareaFormRow icon={TareaFormIcons.owners} showDivider={false} align="center">
      <Stack
        direction="row"
        alignItems="center"
        gap={0.75}
        flexWrap="wrap"
        useFlexGap
        sx={{ ...tareaFormRowContentGutterSx, width: '100%', minWidth: 0 }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.25 }}>
          Owners
        </Typography>
        {chips.map(({ id, entry }) => (
          <Chip
            key={id}
            size="small"
            label={ownerLabel(entry, currentUserId)}
            sx={{ height: 24, fontSize: '0.75rem' }}
          />
        ))}
        {!readOnly && typeof onAddOwner === 'function' ? (
          <IconButton
            size="small"
            aria-label="Delegar / agregar owner"
            onClick={onAddOwner}
            sx={{ p: 0.35 }}
          >
            <PersonAddIcon fontSize="small" />
          </IconButton>
        ) : null}
        {chips.length === 0 ? (
          <Box component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            Sin owners
          </Box>
        ) : null}
      </Stack>
    </TareaFormRow>
  );
}
