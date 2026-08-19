import React, { useMemo } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  EditOutlined as EditIcon,
  DeleteOutlined as DeleteIcon,
  HomeOutlined as HomeIcon,
  DescriptionOutlined as ContratosIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useResponsive } from '@shared/hooks';
import { TareaFormHeader, tareaFormDialogPaperSx } from '@shared/components/forms/tareaFormUi';
import PropiedadDetailSections from '../PropiedadDetailSections';
import InquilinoEstadoChip from './InquilinoEstadoChip';
import InquilinoContactRows from './InquilinoContactRows';
import InquilinoPropiedadSection from './InquilinoPropiedadSection';
import InquilinoContratosSection from './InquilinoContratosSection';
import {
  getContratoActual,
  getDocumentId,
  getInquilinoFullName,
} from './inquilinoDetailUtils';
import {
  propiedadDetailFooterSx,
  propiedadDetailFooterActionSx,
  propiedadDetailCloseButtonSx,
} from '../propiedadDetailStyles';

const InquilinoDetail = ({
  open,
  onClose,
  inquilino,
  onEdit,
  onDelete,
  onCreateContract,
}) => {
  const { isMobile } = useResponsive();
  const navigate = useNavigate();

  const contratoActual = useMemo(
    () => (inquilino ? getContratoActual(inquilino) : null),
    [inquilino],
  );

  if (!inquilino) return null;

  const { estado = 'PENDIENTE' } = inquilino;
  const fullName = getInquilinoFullName(inquilino);
  const contratosCount = inquilino.contratos?.length || 0;

  const handleEdit = () => {
    if (typeof onEdit === 'function') {
      onEdit(inquilino);
    } else {
      const inquilinoId = getDocumentId(inquilino);
      if (inquilinoId) {
        navigate('/propiedades/inquilinos', { state: { editInquilino: true, inquilinoId } });
      }
    }
    onClose?.();
  };

  const handleDelete = () => {
    if (typeof onDelete === 'function') {
      onDelete(getDocumentId(inquilino));
    }
    onClose?.();
  };

  const detailSections = [
    ...(contratoActual
      ? [
          {
            key: 'propiedad',
            title: 'Propiedad',
            icon: HomeIcon,
            defaultExpanded: true,
            summary:
              contratoActual.propiedad?.alias ||
              contratoActual.propiedad?.titulo ||
              contratoActual.propiedad?.nombre ||
              'Propiedad',
            children: <InquilinoPropiedadSection contrato={contratoActual} />,
          },
        ]
      : []),
    {
      key: 'contratos',
      title: 'Contratos',
      icon: ContratosIcon,
      defaultExpanded: !contratoActual,
      summary:
        contratosCount > 0
          ? `${contratosCount} contrato${contratosCount === 1 ? '' : 's'}`
          : 'Sin contratos',
      children: (
        <InquilinoContratosSection inquilino={inquilino} onCreateContract={onCreateContract} />
      ),
    },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          ...tareaFormDialogPaperSx(isMobile),
          display: 'flex',
          flexDirection: 'column',
        },
      }}
      sx={{
        zIndex: 1300,
        '& .MuiBackdrop-root': {
          bottom: isMobile ? '56px' : 0,
        },
      }}
    >
      <DialogContent
        sx={{
          bgcolor: 'background.paper',
          flex: 1,
          overflowY: 'auto',
          py: 0,
          px: 0,
        }}
      >
        <TareaFormHeader onClose={onClose}>
          <Typography
            sx={{
              fontSize: '1.375rem',
              fontWeight: 400,
              lineHeight: 1.35,
              color: 'text.primary',
              pr: 3,
            }}
          >
            {fullName}
          </Typography>

          <Box sx={{ mt: 1 }}>
            <InquilinoEstadoChip estado={estado} />
          </Box>
        </TareaFormHeader>

        <Box sx={{ px: 2, pb: 2 }}>
          <InquilinoContactRows inquilino={inquilino} />

          <PropiedadDetailSections
            key={getDocumentId(inquilino) || fullName}
            sections={detailSections}
          />
        </Box>
      </DialogContent>

      <Box sx={propiedadDetailFooterSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <Tooltip title="Editar">
            <IconButton
              size="small"
              onClick={handleEdit}
              aria-label="Editar inquilino"
              sx={propiedadDetailFooterActionSx}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton
              size="small"
              onClick={handleDelete}
              aria-label="Eliminar inquilino"
              sx={{
                ...propiedadDetailFooterActionSx,
                '&:hover': { bgcolor: 'action.hover', color: 'error.main' },
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Button onClick={onClose} sx={propiedadDetailCloseButtonSx}>
          Cerrar
        </Button>
      </Box>
    </Dialog>
  );
};

export default InquilinoDetail;
