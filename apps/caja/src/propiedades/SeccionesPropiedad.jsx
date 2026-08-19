import React, { useState } from 'react';
import { Box, Typography, IconButton, Tooltip, Collapse } from '@mui/material';
import { Link } from 'react-router-dom';
import { 
  PeopleOutlined as PeopleIcon, 
  Inventory2Outlined as InventoryIcon, 
  MonetizationOnOutlined as MoneyIcon, 
  OpenInNew as OpenInNewIcon, 
  Visibility as VisibilityIcon,
  EditOutlined as EditIcon,
  DeleteOutlined as DeleteIcon,
  Folder as FolderIcon,
  Description as DescriptionIcon,
  DriveFolderUpload as DriveFolderUploadIcon, // Importar el icono de drive
  Home as HomeIcon,
  Apartment as ApartmentIcon,
  StoreOutlined,
} from '@mui/icons-material';
import HabitacionesCarouselSection from './HabitacionesCarouselSection';
import { getInquilinosByPropiedad } from '@shared/utils/inquilinosUtils';
import { icons } from '@shared/navigation/menuIcons';
import { InquilinoDetail } from '.';
import ContratoDetail from './contratos/ContratoDetail';
import { getStatusIconComponent, getEstadoColor } from '@shared/components/common/StatusSystem';
import { getEstadoContrato, formatMesAnio } from '@shared/utils/contratoUtils';
import { useResponsive } from '@shared/hooks';
import {
  propiedadDetailRowIconSx,
  propiedadDetailPrimaryTextSx,
  propiedadDetailSecondaryTextSx,
  propiedadDetailEmptyTextSx,
  propiedadDetailListRowSx,
  propiedadDetailLinkTextSx,
} from './propiedadDetailStyles';

// Componente centralizado para el icono de contratos en documentos
export const IconoContratoDocumentos = ({ sinDocumentos = false, onClick, url, ...props }) => (
  <span onClick={onClick} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
    {sinDocumentos
      ? <DriveFolderUploadIcon sx={{ fontSize: '1rem' }} {...props} />
      : <FolderIcon sx={{ fontSize: '1rem' }} {...props} />}
  </span>
);

// Sección: Inquilinos
export const SeccionInquilinos = ({
  propiedad,
  inquilinos = [],
  inquilinosActivos = [],
  inquilinosFinalizados = [],
  variant,
}) => {
  const isDetail = variant === 'detail';
  const [selectedInquilino, setSelectedInquilino] = useState(null);
  const [inquilinoDetailOpen, setInquilinoDetailOpen] = useState(false);

  // Si se pasa la propiedad, obtener los inquilinos desde el helper
  const inqs = propiedad ? getInquilinosByPropiedad(propiedad) : inquilinos;
  
  // Separar activos y finalizados - Usando estados correctos del sistema
  const activos = inqs.filter(i => 
    i.estado === 'ACTIVO' || 
    i.estado === 'RESERVADO' || 
    i.estado === 'PENDIENTE'
  );
  const finalizados = inqs.filter(i => 
    i.estado === 'INACTIVO' || 
    i.estado === 'SIN_CONTRATO'
  );

  // Debug: Verificar qué inquilinos se están obteniendo (deshabilitado)
  // console.log('SeccionInquilinos - Debug:', {
  //   totalInquilinos: inqs.length,
  //   activos: activos.length,
  //   finalizados: finalizados.length,
  //   estados: inqs.map(i => ({ nombre: `${i.nombre} ${i.apellido}`, estado: i.estado }))
  // });

  const handleOpenInquilino = (inquilino) => {
    setSelectedInquilino(inquilino);
    setInquilinoDetailOpen(true);
  };

  const handleCloseInquilino = () => {
    setInquilinoDetailOpen(false);
    setSelectedInquilino(null);
  };

  return (
    <Box sx={{ mb: isDetail ? 0 : 2 }}>
      {!isDetail && (
        <Typography variant="subtitle2" sx={{ fontSize: '0.95rem', fontWeight: 600 }}>
          <PeopleIcon sx={{ fontSize: '1.1rem', mr: 1 }} />
          Inquilinos Activos ({activos.length})
        </Typography>
      )}

      {activos.length === 0 && (
        <Typography sx={isDetail ? propiedadDetailEmptyTextSx : { fontSize: '0.875rem', color: 'text.secondary' }}>
          Ninguno
        </Typography>
      )}

      {activos.map((i) => (
        <Box key={i._id} sx={isDetail ? propiedadDetailListRowSx : { display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
          {isDetail ? <PeopleIcon sx={propiedadDetailRowIconSx} /> : null}
          <Typography sx={{ ...(isDetail ? propiedadDetailPrimaryTextSx : { fontSize: '0.85rem' }), flex: 1 }}>
            {i.nombre} {i.apellido}
          </Typography>
          <Tooltip title="Ver detalle inquilino">
            <IconButton
              size="small"
              onClick={() => handleOpenInquilino(i)}
              sx={{ p: 0.5, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              <VisibilityIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Tooltip>
        </Box>
      ))}

      {finalizados.length > 0 && (
        <>
          <Typography
            sx={
              isDetail
                ? { ...propiedadDetailSecondaryTextSx, mt: 1.25, mb: 0.25, display: 'block', fontWeight: 500 }
                : { mt: 2, fontSize: '0.85rem', fontWeight: 500 }
            }
          >
            Finalizados ({finalizados.length})
          </Typography>
          {finalizados.map((i) => (
            <Box
              key={i._id}
              sx={isDetail ? propiedadDetailListRowSx : { display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}
            >
              {isDetail ? <PeopleIcon sx={{ ...propiedadDetailRowIconSx, opacity: 0.6 }} /> : null}
              <Typography
                sx={{
                  ...(isDetail ? propiedadDetailPrimaryTextSx : { fontSize: '0.85rem' }),
                  flex: 1,
                  color: isDetail ? 'text.secondary' : 'text.secondary',
                }}
              >
                {i.nombre} {i.apellido}
                {!isDetail ? ` (${i.estado})` : null}
              </Typography>
              <Tooltip title="Ver detalle inquilino">
                <IconButton
                  size="small"
                  onClick={() => handleOpenInquilino(i)}
                  sx={{ p: 0.5, color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}
                >
                  <VisibilityIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </>
      )}

      {/* Modal de detalle de inquilino */}
      {selectedInquilino && (
        <InquilinoDetail
          open={inquilinoDetailOpen}
          onClose={handleCloseInquilino}
          inquilino={selectedInquilino}
        />
      )}
    </Box>
  );
};

// Sección: Ubicación
export const SeccionUbicacion = ({ propiedad, variant }) => {
  if (!propiedad) return null;

  const isDetail = variant === 'detail';

  const getIconoPropiedad = (tipo) => {
    const iconMap = {
      CASA: HomeIcon,
      DEPARTAMENTO: ApartmentIcon,
      APARTAMENTO: ApartmentIcon,
      LOCAL: StoreOutlined,
    };
    return iconMap[tipo?.toUpperCase()] || HomeIcon;
  };

  if (!propiedad.direccion && !propiedad.ciudad) {
    return isDetail ? (
      <Typography sx={propiedadDetailEmptyTextSx}>Sin dirección registrada</Typography>
    ) : null;
  }

  const IconComponent = getIconoPropiedad(propiedad.tipo);

  const content = (
    <>
      {IconComponent ? (
        React.createElement(IconComponent, { sx: propiedadDetailRowIconSx })
      ) : null}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {propiedad.direccion ? (
          <Typography sx={propiedadDetailPrimaryTextSx} noWrap>
            {propiedad.direccion}
          </Typography>
        ) : null}
        {propiedad.ciudad ? (
          <Typography sx={propiedadDetailSecondaryTextSx} noWrap>
            {propiedad.ciudad}
          </Typography>
        ) : null}
      </Box>
      {propiedad.metrosCuadrados ? (
        <Typography sx={{ ...propiedadDetailSecondaryTextSx, mt: 0, flexShrink: 0 }}>
          {propiedad.metrosCuadrados} m²
        </Typography>
      ) : null}
    </>
  );

  if (isDetail) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, width: '100%' }}>
        {content}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: '32px', px: 1, py: 0.2 }}>
      {IconComponent ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, height: '100%' }}>
          {React.createElement(IconComponent, { sx: { fontSize: '1.3rem', color: 'rgba(255,255,255,0.7)' } })}
        </Box>
      ) : null}
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {propiedad.direccion ? (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              fontSize: '0.7rem',
              lineHeight: 1,
              m: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: { xs: 120, sm: 200, md: 260 },
            }}
          >
            {propiedad.direccion}
          </Typography>
        ) : null}
        {propiedad.ciudad ? (
          <Typography
            variant="caption"
            sx={{
              fontWeight: 400,
              fontSize: '0.68rem',
              color: 'text.secondary',
              lineHeight: 1,
              m: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: { xs: 120, sm: 200, md: 260 },
            }}
          >
            {propiedad.ciudad}
          </Typography>
        ) : null}
      </Box>
      {propiedad.metrosCuadrados ? (
        <Typography
          variant="body2"
          sx={{ fontWeight: 500, fontSize: '0.7rem', color: 'text.secondary', textAlign: 'right', minWidth: 60 }}
        >
          {propiedad.metrosCuadrados}m²
        </Typography>
      ) : null}
    </Box>
  );
};

// Sección: Ambientes (carrusel horizontal, misma UX que Monedas)
export const SeccionHabitaciones = ({
  habitaciones = [],
  inventarios = [],
  onEdit,
  onDelete,
  emptyMessage,
}) => {
  if (!habitaciones.length && !onEdit && !onDelete) return null;

  return (
    <HabitacionesCarouselSection
      habitaciones={habitaciones}
      inventarios={inventarios}
      onEdit={onEdit}
      onDelete={onDelete}
      emptyMessage={emptyMessage}
      carouselSx={{ px: 0.125, py: 0.25 }}
    />
  );
};

// Sección: Inventario
export const SeccionInventario = ({ inventario = [] }) => {
  if (!inventario.length) return null;
  const agrupado = inventario.reduce((acc, item) => {
    const categoria = item.categoria || 'Sin categoría';
    if (!acc[categoria]) acc[categoria] = [];
    acc[categoria].push(item);
    return acc;
  }, {});
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}><InventoryIcon sx={{ fontSize: '1.1rem', mr: 1 }} />Inventario</Typography>
      {Object.entries(agrupado).map(([categoria, items]) => (
        <Box key={categoria}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>{categoria} ({items.length})</Typography>
          {items.map(item => (
            <Typography key={item._id} variant="body2" color="text.secondary" sx={{ pl: 1 }}>
              {item.nombre} - Cantidad: {item.cantidad || 1}
            </Typography>
          ))}
        </Box>
      ))}
    </Box>
  );
};

// Sección: Documentos y Contratos agrupados
export const SeccionDocumentos = ({ documentos = [], propiedad, variant }) => {
  const { theme } = useResponsive();
  const isDetail = variant === 'detail';
  const [inquilinoDetailOpen, setInquilinoDetailOpen] = useState(false);
  const [selectedInquilino, setSelectedInquilino] = useState(null);
  const [contratoDetailOpen, setContratoDetailOpen] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState(null);
  const [showAllContratos, setShowAllContratos] = useState(false);

  // Separar contratos de otros documentos
  const contratos = documentos.filter(doc => doc.categoria === 'CONTRATO' || doc.tipo === 'CONTRATO');
  const otrosDocumentos = documentos.filter(doc => doc.categoria !== 'CONTRATO' && doc.tipo !== 'CONTRATO');

  // Limitar contratos mostrados inicialmente
  const contratosAMostrar = showAllContratos ? contratos : contratos.slice(0, 2);
  const contratosOcultos = contratos.length - contratosAMostrar.length;

  const handleOpenInquilino = (inquilino) => {
    setSelectedInquilino(inquilino);
    setInquilinoDetailOpen(true);
  };
  const handleCloseInquilino = () => {
    setInquilinoDetailOpen(false);
    setSelectedInquilino(null);
  };
  const handleOpenContrato = (contrato) => {
    setSelectedContrato(contrato);
    setContratoDetailOpen(true);
  };
  const handleCloseContrato = () => {
    setContratoDetailOpen(false);
    setSelectedContrato(null);
  };

  return (
    <Box
      sx={
        isDetail
          ? { display: 'flex', flexDirection: 'column', gap: 0.25 }
          : {
              minHeight: '40px',
              px: 1,
              py: 0.2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              bgcolor: theme.palette.collapse.background,
            }
      }
    >
      {documentos.length === 0 ? (
        <Typography sx={isDetail ? propiedadDetailEmptyTextSx : { pl: 1 }} color={isDetail ? undefined : 'text.secondary'} variant={isDetail ? undefined : 'caption'}>
          No hay documentos
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: isDetail ? 0.25 : 0.2 }}>
          {otrosDocumentos.map((doc, idx) => (
            <Box key={doc._id || idx} sx={isDetail ? propiedadDetailListRowSx : { display: 'flex', alignItems: 'center', gap: 1, pl: 1 }}>
              <DescriptionIcon sx={isDetail ? propiedadDetailRowIconSx : { fontSize: '1.1rem', color: 'text.secondary', flexShrink: 0 }} />
              <Typography sx={{ ...(isDetail ? propiedadDetailPrimaryTextSx : { fontWeight: 500, color: 'text.primary', fontSize: '0.85rem' }), flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {doc.nombre}
              </Typography>
              {doc.url ? (
                <IconButton size="small" href={doc.url} target="_blank" rel="noopener noreferrer" sx={{ p: 0.2, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                  <VisibilityIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
              ) : null}
            </Box>
          ))}

          {contratosAMostrar.map((doc, idx) => {
            const apellido = doc.inquilino && Array.isArray(doc.inquilino) && doc.inquilino[0]?.apellido ? doc.inquilino[0].apellido : '';
            const rango = doc.fechaInicio && doc.fechaFin ? `${formatMesAnio(doc.fechaInicio)} - ${formatMesAnio(doc.fechaFin)}` : '';
            const label = apellido;
            const secondary = rango;
            const inquilino = doc.inquilino && Array.isArray(doc.inquilino) ? doc.inquilino[0] : doc.inquilino;
            const contrato = doc;
            const estadoContrato = getEstadoContrato(doc);
            const IconoDoc = getStatusIconComponent(estadoContrato, 'CONTRATO');
            const colorIcono = getEstadoColor(estadoContrato, 'CONTRATO');
            return (
              <Box key={doc._id || idx} sx={isDetail ? propiedadDetailListRowSx : { display: 'flex', alignItems: 'center', gap: 1, pl: 1 }}>
                {IconoDoc ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    {React.isValidElement(IconoDoc)
                      ? React.cloneElement(IconoDoc, { sx: { fontSize: isDetail ? 20 : '1.1rem', color: colorIcono } })
                      : React.createElement(IconoDoc, { sx: { fontSize: isDetail ? 20 : '1.1rem', color: colorIcono } })}
                  </Box>
                ) : null}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ ...(isDetail ? propiedadDetailPrimaryTextSx : { fontWeight: 500, color: 'text.primary', fontSize: '0.85rem' }), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {label}
                  </Typography>
                  {secondary ? (
                    <Typography sx={isDetail ? propiedadDetailSecondaryTextSx : { color: 'text.secondary', fontSize: '0.7rem', mt: 0.2, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {secondary}
                    </Typography>
                  ) : null}
                </Box>
                {inquilino ? (
                  <IconButton size="small" sx={{ p: 0.2, color: 'text.secondary', '&:hover': { color: 'primary.main' } }} onClick={() => handleOpenInquilino(inquilino)}>
                    <PeopleIcon sx={{ fontSize: '1rem' }} />
                  </IconButton>
                ) : null}
                <IconButton size="small" sx={{ p: 0.2, color: 'text.secondary', '&:hover': { color: 'primary.main' } }} onClick={() => handleOpenContrato(contrato)}>
                  <DescriptionIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
              </Box>
            );
          })}

          {contratosOcultos > 0 ? (
            <Typography component="span" sx={propiedadDetailLinkTextSx} onClick={() => setShowAllContratos(true)}>
              Ver {contratosOcultos} contrato{contratosOcultos > 1 ? 's' : ''} más
            </Typography>
          ) : null}

          {showAllContratos && contratos.length > 2 ? (
            <Typography component="span" sx={propiedadDetailLinkTextSx} onClick={() => setShowAllContratos(false)}>
              Mostrar menos
            </Typography>
          ) : null}
        </Box>
      )}
      {/* Popups de detalle */}
      {selectedInquilino && (
        <InquilinoDetail open={inquilinoDetailOpen} onClose={handleCloseInquilino} inquilino={selectedInquilino} />
      )}
      {selectedContrato && (
        <ContratoDetail open={contratoDetailOpen} onClose={handleCloseContrato} contrato={selectedContrato} onEdit={() => {}} onDelete={() => {}} />
      )}
    </Box>
  );
};

// Sección: Contratos (primaria, aparte)
export const SeccionContratos = ({ contratos = [], variant }) => {
  const { theme } = useResponsive();
  const isDetail = variant === 'detail';

  if (!contratos.length) {
    return isDetail ? (
      <Typography sx={propiedadDetailEmptyTextSx}>Sin contratos</Typography>
    ) : null;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: isDetail ? 0.5 : 1, mb: isDetail ? 0 : 2 }}>
      {contratos.map((contrato, idx) => {
        const apellido =
          contrato.inquilino && Array.isArray(contrato.inquilino) && contrato.inquilino[0]?.apellido
            ? contrato.inquilino[0].apellido
            : contrato.inquilino?.apellido || 'Contrato';
        const rango =
          contrato.fechaInicio && contrato.fechaFin
            ? `${new Date(contrato.fechaInicio).toLocaleDateString('es-ES')} – ${new Date(contrato.fechaFin).toLocaleDateString('es-ES')}`
            : '';

        if (isDetail) {
          return (
            <Box key={contrato._id || idx} sx={propiedadDetailListRowSx}>
              <DescriptionIcon sx={propiedadDetailRowIconSx} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={propiedadDetailPrimaryTextSx} noWrap>
                  {apellido}
                </Typography>
                {rango ? (
                  <Typography sx={propiedadDetailSecondaryTextSx} noWrap>
                    {rango}
                  </Typography>
                ) : null}
              </Box>
            </Box>
          );
        }

        return (
          <Box
            key={contrato._id || idx}
            sx={{ mb: 1.5, p: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 0, bgcolor: theme.palette.collapse.background }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', fontSize: '0.95rem' }}>
              {apellido}
            </Typography>
            {rango ? (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                {rango}
              </Typography>
            ) : null}
            <Box sx={{ mt: 1 }}>
              <IconButton size="small" sx={{ p: 0.2 }}>
                <DescriptionIcon sx={{ fontSize: '1rem', color: 'primary.main' }} />
              </IconButton>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

// Subcomponente para mostrar una categoría de documentos
export const DocumentosCategoria = ({ alias, icono, documentos }) => {
  const [expandido, setExpandido] = React.useState(false);
  const mostrarDocs = expandido ? documentos : documentos.slice(0, 2);
  return (
    <Box sx={{ mb: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 0.25 }}>
        {alias} {documentos.length > 2 && (
          <span style={{ color: '#aaa', fontWeight: 400, fontSize: '0.7rem', cursor: 'pointer' }} onClick={() => setExpandido(e => !e)}>
            {expandido ? 'ver menos...' : 'ver más...'}
          </span>
        )}
      </Typography>
      {mostrarDocs.map((doc, idx) => (
        <Box key={`doc-${doc._id || idx}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 1, py: 0.25 }}>
          {icono}
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {doc.nombre}
          </Typography>
          {doc.esLink ? (
            <IconButton size="small" component={Link} to={doc.url} sx={{ p: 0.25 }}>
              <OpenInNewIcon sx={{ fontSize: '0.7rem' }} />
            </IconButton>
          ) : (
            <IconButton size="small" href={doc.url} target="_blank" rel="noopener noreferrer" sx={{ p: 0.25 }}>
              <OpenInNewIcon sx={{ fontSize: '0.7rem' }} />
            </IconButton>
          )}
        </Box>
      ))}
    </Box>
  );
};

// Subcomponente reutilizable para secciones expandibles
export const SeccionExpandible = ({ icon, title, expanded, onToggle, children }) => (
  <Box sx={{ mt: 0.25 }}>
    <Box onClick={onToggle} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', '&:hover': { color: 'primary.main' } }}>
      {icon}
      <Typography variant="body2" sx={{ flex: 1, fontSize: '0.8rem' }}>{title}</Typography>
      <IconButton size="small" sx={{ p: 0.25, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
        <OpenInNewIcon sx={{ fontSize: '0.9rem' }} />
      </IconButton>
    </Box>
    <Collapse in={expanded}>
      <Box sx={{ pl: 2, pt: 0.5 }}>{children}</Box>
    </Collapse>
  </Box>
); 

// --- INICIO: Definición de crearSeccionesPropiedad ---
export const crearSeccionesPropiedad = (propiedad, precio, simboloMoneda, nombreCuenta, moneda, habitaciones, contratos, documentos = [], extendida = false) => {
  let secciones = [
    {
      type: 'primary',
      render: () => <SeccionUbicacion propiedad={propiedad} />
    }
  ];
  if (extendida) {
    if (habitaciones && habitaciones.length > 0) {
      secciones.push({
        type: 'primary',
        render: () => <SeccionHabitaciones habitaciones={habitaciones} />
      });
    }
  }
  const documentosCompletos = [
    ...(documentos || []),
    ...(contratos || []).map(contrato => ({
      ...contrato,
      categoria: 'CONTRATO',
      inquilino: contrato.inquilino || (Array.isArray(propiedad?.inquilinos) ? propiedad.inquilinos : []),
      url: contrato.documentoUrl || `/contratos/${contrato._id}`
    }))
  ];
  secciones.push({
    type: 'primary',
    render: () => <SeccionDocumentos documentos={documentosCompletos} propiedad={propiedad} />
  });
  return secciones;
};
// --- FIN: Definición de crearSeccionesPropiedad --- 
