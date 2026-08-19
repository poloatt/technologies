import React from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography, 
  List, 
  ListItem, 
  ListItemText, 
  Box,
  Chip,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import { Inventory2Outlined as InventoryIcon } from '@mui/icons-material';
import { useResponsive } from '@shared/hooks';


const InventarioDetail = ({ 
  open, 
  onClose, 
  inventario, 
  propiedad, 
  inventarios = [],
  isModal = false 
}) => {
  const { theme } = useResponsive();
  // Si es modal, usar la lógica original
  if (isModal) {
    if (!inventario) return null;
    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 0,
            bgcolor: theme.palette.background.default
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.1rem', color: 'text.primary' }}>
          Inventario del contrato
        </DialogTitle>
        <DialogContent>
          {inventario.items && inventario.items.length > 0 ? (
            <List>
              {inventario.items.map((item, idx) => (
                <ListItem key={idx} sx={{ px: 0, py: 0.5 }}>
                  <ListItemText
                    primary={<Typography sx={{ fontSize: '0.95rem', color: 'text.primary' }}>{item.nombre}</Typography>}
                    secondary={item.descripcion ? <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{item.descripcion}</Typography> : null}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No hay items en el inventario.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} sx={{ borderRadius: 0 }}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // Si no es modal, mostrar como componente inline para el detalle de propiedad
  const inventariosFiltrados = inventarios.filter(inv => 
    !inv.habitacion || inv.habitacion === propiedad?._id
  );

  // Agrupar por categoría
  const inventariosPorCategoria = inventariosFiltrados.reduce((acc, item) => {
    const categoria = item.categoria || 'Sin categoría';
    if (!acc[categoria]) {
      acc[categoria] = [];
    }
    acc[categoria].push(item);
    return acc;
  }, {});

  if (inventariosFiltrados.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <InventoryIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          No hay inventario registrado para esta propiedad.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <InventoryIcon sx={{ fontSize: 18 }} />
        Inventario ({inventariosFiltrados.length} items)
      </Typography>
      
      {Object.entries(inventariosPorCategoria).map(([categoria, items]) => (
        <Card key={categoria} sx={{ mb: 2, borderRadius: 0, bgcolor: (theme) => theme.palette.collapse.background, border: (theme) => `1px solid ${theme.palette.divider}` }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              {categoria} ({items.length})
            </Typography>
            <Grid container spacing={1}>
              {items.map((item, idx) => (
                <Grid item xs={12} sm={6} key={idx}>
                  <Box sx={{ 
                    p: 1, 
                    border: (theme) => `1px solid ${theme.palette.divider}`, 
                    borderRadius: 0,
                    bgcolor: (theme) => theme.palette.collapse.background
                  }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {item.nombre}
                    </Typography>
                    {item.descripcion && (
                      <Typography variant="caption" color="text.secondary">
                        {item.descripcion}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <Chip 
                        label={`Cantidad: ${item.cantidad || 1}`} 
                        size="small" 
                        sx={{ borderRadius: 0, fontSize: '0.7rem' }}
                      />
                      {item.estado && (
                        <Chip 
                          label={item.estado} 
                          size="small" 
                          color={item.estado === 'BUENO' ? 'success' : item.estado === 'REGULAR' ? 'warning' : 'error'}
                          sx={{ borderRadius: 0, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

export default InventarioDetail; 
