import React, { Suspense } from 'react';
import { Box, Chip, IconButton } from '@mui/material';
import { HabitsManagerHost } from '../../habits';
import { FONT_SIZE } from '@shared/tipografia';

const TareaForm = React.lazy(() => import('../form/TareaForm'));
const GoogleTasksConfig = React.lazy(() => import('../google/GoogleTasksConfig'));

export default function TareasPageOverlays({
  isMobile,
  isFormOpen,
  setIsFormOpen,
  editingTarea,
  objetivos,
  refetchObjetivos,
  handleFormSubmit,
  createWithHistory,
  updateWithHistory,
  deleteWithHistory,
  isGoogleTasksConfigOpen,
  setIsGoogleTasksConfigOpen,
  selectedTareas,
  onDeactivateMultiSelect,
}) {
  return (
    <>
      {isFormOpen ? (
        <Suspense fallback={null}>
          <TareaForm
            open={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            onSubmit={handleFormSubmit}
            isEditing={!!editingTarea}
            initialData={editingTarea}
            objetivos={objetivos}
            onObjetivosUpdate={refetchObjetivos}
            createWithHistory={createWithHistory}
            updateWithHistory={updateWithHistory}
            deleteWithHistory={deleteWithHistory}
          />
        </Suspense>
      ) : null}

      <HabitsManagerHost />
      {isGoogleTasksConfigOpen ? (
        <Suspense fallback={null}>
          <GoogleTasksConfig
            open={isGoogleTasksConfigOpen}
            onClose={() => setIsGoogleTasksConfigOpen(false)}
          />
        </Suspense>
      ) : null}

      {selectedTareas.length > 0 ? (
        <Box
          sx={{
            position: 'fixed',
            bottom: isMobile ? 100 : 20,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: isMobile ? 3 : 2,
            px: isMobile ? 3 : 2,
            py: isMobile ? 1.5 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 2 : 1,
            boxShadow: 3,
            zIndex: 1000,
            minWidth: isMobile ? 250 : 200,
            justifyContent: 'center',
            ...(isMobile && {
              '& *': {
                fontSize: '1rem !important',
              },
            }),
          }}
        >
          <Chip
            label={`${selectedTareas.length} seleccionadas`}
            size={isMobile ? 'medium' : 'small'}
            color="primary"
            variant="outlined"
            sx={{
              fontSize: isMobile ? FONT_SIZE.base : FONT_SIZE.sm,
              height: isMobile ? 32 : 24,
            }}
          />
          <IconButton
            size={isMobile ? 'medium' : 'small'}
            onClick={onDeactivateMultiSelect}
            sx={{
              color: 'text.secondary',
              fontSize: isMobile ? '1.2rem' : '1rem',
              padding: isMobile ? 1 : 0.5,
              '&:hover': { backgroundColor: 'action.hover' },
            }}
          >
            ✕
          </IconButton>
        </Box>
      ) : null}
    </>
  );
}
