export const PULSO_TOOLS = [
  {
    name: 'leer_salud',
    description: 'Lee controles, estudios y archivos de salud ya cargados del usuario.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'registrar_salud',
    description: 'Crea un registro de salud en una zona del cuerpo y, si hay archivos de este mensaje, los cataloga ahí. Guardá solo datos que estén en el archivo o que el usuario haya dicho.',
    input_schema: {
      type: 'object',
      properties: {
        zona: {
          type: 'string',
          description: 'Id de zona: ojos, piel, sangre, cabeza, pecho, abdomen, brazos, piernas.',
        },
        parte: {
          type: 'string',
          description: 'Id de órgano, músculo o subgrupo óseo del catálogo. Vacío si solo aplica la zona.',
        },
        tipo: {
          type: 'string',
          enum: ['TURNO', 'ESTUDIO', 'REVISION', 'COPAGO'],
        },
        titulo: { type: 'string' },
        fecha: { type: 'string', description: 'Fecha ISO (YYYY-MM-DD) del estudio o turno.' },
        estado: { type: 'string', enum: ['PENDIENTE', 'HECHO', 'CANCELADO'] },
        notas: { type: 'string' },
        archivos: {
          type: 'array',
          items: { type: 'integer' },
          description: 'Índices de los archivos adjuntos en este mensaje, desde 0.',
        },
      },
      required: ['zona', 'tipo', 'titulo', 'fecha'],
    },
  },
  {
    name: 'leer_dieta',
    description: 'Lee el plan de dieta y las comidas del usuario, con ingredientes, frecuencia y macros.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'guardar_comida',
    description: 'Crea o actualiza una comida. Si pasás id, actualiza esa. Si no, busca por nombre.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        nombre: { type: 'string' },
        slot: {
          type: 'string',
          enum: ['DESAYUNO', 'ALMUERZO', 'MERIENDA', 'CENA', 'SNACK', 'COMIDA'],
        },
        frecuencia: { type: 'string', enum: ['DIARIA', 'SEMANAL'] },
        dias: {
          type: 'array',
          items: { type: 'integer' },
          description: 'Días 0 domingo a 6 sábado. Solo si la frecuencia es SEMANAL.',
        },
        franjas: {
          type: 'array',
          items: { type: 'string', enum: ['MAÑANA', 'TARDE', 'NOCHE'] },
        },
        porciones: { type: 'number' },
        ingredientes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              nombre: { type: 'string' },
              canal: {
                type: 'string',
                enum: ['super', 'verduleria', 'rotiseria', 'farmacia', 'cocina'],
              },
              cantidad: { type: 'number' },
              unidad: { type: 'string', enum: ['g', 'kg', 'ml', 'l', 'u'] },
            },
            required: ['nombre'],
          },
        },
        calorias: { type: 'number' },
        proteinas: { type: 'number' },
        carbohidratos: { type: 'number' },
        grasas: { type: 'number' },
        preparacion: { type: 'string' },
      },
      required: ['nombre'],
    },
  },
  {
    name: 'actualizar_plan',
    description: 'Actualiza los objetivos del plan de dieta: calorías y macros por día.',
    input_schema: {
      type: 'object',
      properties: {
        calorias: { type: 'number' },
        proteinas: { type: 'number' },
        carbohidratos: { type: 'number' },
        grasas: { type: 'number' },
      },
    },
  },
];
