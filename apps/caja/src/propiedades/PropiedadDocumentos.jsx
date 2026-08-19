import React, { useState } from 'react';
import { Box, Typography, List, ListItem, ListItemIcon, ListItemText, IconButton, Button, Paper, Tooltip, Divider, TextField, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddIcon from '@mui/icons-material/Add';
import SyncIcon from '@mui/icons-material/Sync';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TipoPropiedadIcon from './TipoPropiedadIcon';
// Si corresponde, importa { SeccionDocumentos } from './SeccionesPropiedad';

/**
 * Página de gestión de documentos agrupados por propiedad.
 * props:
 *   propiedades: Array de objetos { ...propiedad, documentos: [] }
 *   onAddDocumento: función(propiedadId) para agregar documento (opcional)
 */

// Utilidad para agrupar documentos por tipo/sección
function agruparDocumentos(documentos = []) {
  const grupos = {
    gastosFijos: [],
    gastosVariables: [],
    mantenimiento: [],
    alquileres: []
  };
  documentos.forEach(doc => {
    if (doc.categoria === 'GASTO_FIJO') grupos.gastosFijos.push(doc);
    else if (doc.categoria === 'GASTO_VARIABLE') grupos.gastosVariables.push(doc);
    else if (doc.categoria === 'MANTENIMIENTO') grupos.mantenimiento.push(doc);
    else if (doc.categoria === 'ALQUILER') grupos.alquileres.push(doc);
  });
  return grupos;
}

export default function PropiedadDocumentos({ propiedades = [], onAddDocumento, onSyncSeccion }) {
  const [filtro, setFiltro] = useState('');

  // Filtrar propiedades por título
  const propiedadesFiltradas = filtro
    ? propiedades.filter(p => (p.alias || '').toLowerCase().includes(filtro.toLowerCase()))
    : propiedades;

  return (
    <Box sx={{ p: { xs: 1, sm: 2 }, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Gestión de documentos por propiedad
      </Typography>
      <TextField
        label="Filtrar por propiedad"
        variant="outlined"
        size="small"
        value={filtro}
        onChange={e => setFiltro(e.target.value)}
        sx={{ mb: 3, width: 320 }}
      />
      {propiedadesFiltradas.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 2 }}>
          No hay propiedades que coincidan con el filtro.
        </Typography>
      ) : (
        propiedadesFiltradas.map((propiedad, idx) => {
          const grupos = agruparDocumentos(propiedad.documentos || []);
          return (
            <Paper key={propiedad._id || idx} sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: '#181818', boxShadow: 'none' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                  <TipoPropiedadIcon tipo={propiedad.tipo} sx={{ fontSize: 20 }} />
                  <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>
                    {propiedad.alias || propiedad.titulo || 'Sin nombre'}
                  </Typography>
                </Box>
                {onAddDocumento && (
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => onAddDocumento(propiedad._id)}
                    sx={{ borderRadius: 1, fontSize: '0.85rem', minWidth: 0, px: 1.5, ml: 2 }}
                  >
                    Agregar documento
                  </Button>
                )}
              </Box>
              <Divider sx={{ my: 1 }} />
              {/* Secciones de documentos */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Gastos</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Tooltip title="Sincronizar gastos con Google Drive">
                    <IconButton size="small" onClick={() => onSyncSeccion && onSyncSeccion(propiedad._id, 'GASTOS')}>
                      <SyncIcon />
                    </IconButton>
                  </Tooltip>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>Fijos</Typography>
                  <List dense>
                    {grupos.gastosFijos.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 1 }}>
                        Sin documentos de gastos fijos.
                      </Typography>
                    ) : grupos.gastosFijos.map((doc, dIdx) => (
                      <ListItem key={dIdx} sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 1 }}
                        secondaryAction={
                          <Tooltip title="Abrir en Google Drive">
                            <IconButton edge="end" href={doc.url} target="_blank" rel="noopener noreferrer">
                              <OpenInNewIcon />
                            </IconButton>
                          </Tooltip>
                        }
                      >
                        <ListItemIcon>
                          <InsertDriveFileIcon color="action" />
                        </ListItemIcon>
                        <ListItemText primary={doc.nombre || 'Documento'} />
                      </ListItem>
                    ))}
                  </List>
                  <Typography variant="body2" sx={{ fontWeight: 500, mt: 2, mb: 1 }}>Variables</Typography>
                  <List dense>
                    {grupos.gastosVariables.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 1 }}>
                        Sin documentos de gastos variables.
                      </Typography>
                    ) : grupos.gastosVariables.map((doc, dIdx) => (
                      <ListItem key={dIdx} sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 1 }}
                        secondaryAction={
                          <Tooltip title="Abrir en Google Drive">
                            <IconButton edge="end" href={doc.url} target="_blank" rel="noopener noreferrer">
                              <OpenInNewIcon />
                            </IconButton>
                          </Tooltip>
                        }
                      >
                        <ListItemIcon>
                          <InsertDriveFileIcon color="action" />
                        </ListItemIcon>
                        <ListItemText primary={doc.nombre || 'Documento'} />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Mantenimiento</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Tooltip title="Sincronizar mantenimiento con Google Drive">
                    <IconButton size="small" onClick={() => onSyncSeccion && onSyncSeccion(propiedad._id, 'MANTENIMIENTO')}>
                      <SyncIcon />
                    </IconButton>
                  </Tooltip>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {grupos.mantenimiento.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 1 }}>
                        Sin documentos de mantenimiento.
                      </Typography>
                    ) : grupos.mantenimiento.map((doc, dIdx) => (
                      <ListItem key={dIdx} sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 1 }}
                        secondaryAction={
                          <Tooltip title="Abrir en Google Drive">
                            <IconButton edge="end" href={doc.url} target="_blank" rel="noopener noreferrer">
                              <OpenInNewIcon />
                            </IconButton>
                          </Tooltip>
                        }
                      >
                        <ListItemIcon>
                          <InsertDriveFileIcon color="action" />
                        </ListItemIcon>
                        <ListItemText primary={doc.nombre || 'Documento'} />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Alquileres</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Tooltip title="Sincronizar alquileres con Google Drive">
                    <IconButton size="small" onClick={() => onSyncSeccion && onSyncSeccion(propiedad._id, 'ALQUILER')}>
                      <SyncIcon />
                    </IconButton>
                  </Tooltip>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {grupos.alquileres.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 1 }}>
                        Sin documentos de alquileres.
                      </Typography>
                    ) : grupos.alquileres.map((doc, dIdx) => (
                      <ListItem key={dIdx} sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 1 }}
                        secondaryAction={
                          <Tooltip title="Abrir en Google Drive">
                            <IconButton edge="end" href={doc.url} target="_blank" rel="noopener noreferrer">
                              <OpenInNewIcon />
                            </IconButton>
                          </Tooltip>
                        }
                      >
                        <ListItemIcon>
                          <InsertDriveFileIcon color="action" />
                        </ListItemIcon>
                        <ListItemText primary={doc.nombre || 'Documento'} />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            </Paper>
          );
        })
      )}
    </Box>
  );
} 
