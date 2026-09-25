import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack
} from '@mui/material';

export const DataCorporalForm = ({ 
  open, 
  onClose, 
  onSubmit, 
  initialData 
}) => {
  const [formData, setFormData] = React.useState({
    fecha: new Date().toISOString().split('T')[0],
    weight: '',
    muscle: '',
    fatPercent: '',
    stress: '',
    sleep: '',
    ...initialData
  });

  React.useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        fecha: new Date(initialData.fecha).toISOString().split('T')[0]
      });
    } else {
      setFormData({
        fecha: new Date().toISOString().split('T')[0],
        weight: '',
        muscle: '',
        fatPercent: '',
        stress: '',
        sleep: ''
      });
    }
  }, [initialData, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = () => {
    const dataToSubmit = {
      fecha: new Date(formData.fecha),
      weight: formData.weight,
      muscle: formData.muscle,
      fatPercent: formData.fatPercent,
      stress: formData.stress,
      sleep: formData.sleep,
    };

    if (initialData?._id) {
      dataToSubmit._id = initialData._id;
    }

    onSubmit(dataToSubmit);
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 0
        }
      }}
    >
      <DialogTitle>
        {initialData?._id ? 'Editar Registro' : 'Nuevo Registro'}
      </DialogTitle>
      
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField
            label="Fecha"
            type="date"
            name="fecha"
            value={formData.fecha}
            onChange={handleChange}
            fullWidth
            required
          />
          
          <TextField
            label="Peso (kg)"
            type="number"
            name="weight"
            value={formData.weight}
            onChange={handleChange}
            fullWidth
            required
            inputProps={{ step: "0.1" }}
          />
          
          <TextField
            label="Masa Muscular (%)"
            type="number"
            name="muscle"
            value={formData.muscle}
            onChange={handleChange}
            fullWidth
            required
            inputProps={{ step: "0.1" }}
          />
          
          <TextField
            label="Porcentaje de Grasa (%)"
            type="number"
            name="fatPercent"
            value={formData.fatPercent}
            onChange={handleChange}
            fullWidth
            required
            inputProps={{ step: "0.1" }}
          />
          
          <TextField
            label="Nivel de Estrés (1-10)"
            type="number"
            name="stress"
            value={formData.stress}
            onChange={handleChange}
            fullWidth
            required
            inputProps={{ min: "1", max: "10", step: "1" }}
          />
          
          <TextField
            label="Horas de Sueño"
            type="number"
            name="sleep"
            value={formData.sleep}
            onChange={handleChange}
            fullWidth
            required
            inputProps={{ step: "0.5" }}
          />
          {initialData?._id && (
            <TextField
              label="Origen"
              value={formData.origen === 'samsung' ? 'Reloj' : 'Manual'}
              fullWidth
              InputProps={{ readOnly: true }}
            />
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained"
          sx={{ borderRadius: 0 }}
        >
          {initialData?._id ? 'Actualizar' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}; 
