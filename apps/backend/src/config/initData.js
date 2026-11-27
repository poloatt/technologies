import { 
  Monedas, 
  COLORES_MONEDA,
  Propiedades, 
  Habitaciones, 
  Inquilinos, 
  Contratos, 
  Cuentas, 
  Transacciones, 
  Tareas, 
  Objetivos, 
  Inventarios,
  Users 
} from '../models/index.js';
import { ensureEfectivoAccount } from '../services/efectivoAccountService.js';

export const initializeMonedas = async () => {
  try {
    const monedasPredeterminadas = [
      {
        codigo: 'USD',
        nombre: 'Dólar Estadounidense',
        simbolo: '$',
        color: COLORES_MONEDA.VERDE_DOLAR,
        tasaCambio: 1,
        activa: true,
        esGlobal: true
      },
      {
        codigo: 'EUR',
        nombre: 'Euro',
        simbolo: '€',
        tasaCambio: 0.85,
        activa: true,
        esGlobal: true
      }
    ];

    for (const moneda of monedasPredeterminadas) {
      const existeMoneda = await Monedas.findOne({ codigo: moneda.codigo });
      if (!existeMoneda) {
        await Monedas.create(moneda);
        console.log(`Moneda ${moneda.codigo} creada exitosamente`);
      }
    }

    console.log('Inicialización de monedas completada');
  } catch (error) {
    console.error('Error al inicializar monedas:', error);
  }
};

// Función para inicializar datos de ejemplo
export const initializeSampleData = async (userId) => {
  try {
    console.log('Iniciando creación de datos de ejemplo...');

    // Garantizar siempre la cuenta Efectivo por defecto para el usuario
    await ensureEfectivoAccount(userId);
    
    // Verificar si ya existen datos
    const existingProperties = await Propiedades.countDocuments({ usuario: userId });
    if (existingProperties > 0) {
      console.log('Ya existen datos de ejemplo, saltando inicialización');
      return;
    }

    // Obtener monedas
    const usdMoneda = await Monedas.findOne({ codigo: 'USD' });
    const eurMoneda = await Monedas.findOne({ codigo: 'EUR' });

    // 1. Crear Propiedades
    const propiedades = await Propiedades.create([
      {
        nombre: 'Departamento Centro',
        direccion: 'Av. Principal 123',
        tipo: 'departamento',
        usuario: userId,
        activa: true,
        descripcion: 'Departamento de 2 dormitorios en el centro de la ciudad'
      },
      {
        nombre: 'Casa Residencial',
        direccion: 'Calle Secundaria 456',
        tipo: 'casa',
        usuario: userId,
        activa: true,
        descripcion: 'Casa familiar con jardín'
      }
    ]);

    // 2. Crear Habitaciones
    const habitaciones = await Habitaciones.create([
      {
        nombre: 'Habitación Principal',
        propiedad: propiedades[0]._id,
        usuario: userId,
        tipo: 'DORMITORIO_DOBLE',
        nombrePersonalizado: 'Habitación Principal'
      },
      {
        nombre: 'Habitación Secundaria',
        propiedad: propiedades[0]._id,
        usuario: userId,
        tipo: 'DORMITORIO_SIMPLE',
        nombrePersonalizado: 'Habitación Secundaria'
      },
      {
        nombre: 'Habitación Master',
        propiedad: propiedades[1]._id,
        usuario: userId,
        tipo: 'DORMITORIO_DOBLE',
        nombrePersonalizado: 'Habitación Master'
      }
    ]);

    // 3. Crear Inquilinos
    const inquilinos = await Inquilinos.create([
      {
        nombre: 'Juan Pérez',
        email: 'juan.perez@email.com',
        telefono: '+1234567890',
        documento: '12345678',
        usuario: userId,
        activo: true
      },
      {
        nombre: 'María García',
        email: 'maria.garcia@email.com',
        telefono: '+1234567891',
        documento: '87654321',
        usuario: userId,
        activo: true
      }
    ]);

    // 4. Crear Contratos
    const contratos = await Contratos.create([
      {
        inquilino: [inquilinos[0]._id],
        propiedad: propiedades[1]._id,
        habitacion: habitaciones[2]._id,
        usuario: userId,
        fechaInicio: new Date('2024-01-01'),
        fechaFin: new Date('2024-12-31'),
        precioTotal: 1200,
        moneda: usdMoneda._id,
        estado: 'activo',
        diaVencimiento: 5
      }
    ]);

    // 5. Crear Cuentas
    const cuentas = await Cuentas.create([
      {
        nombre: 'Cuenta Principal USD',
        usuario: userId,
        moneda: usdMoneda._id,
        saldo: 5000,
        activo: true,
        tipo: 'BANCO'
      },
      {
        nombre: 'Cuenta Ahorros EUR',
        usuario: userId,
        moneda: eurMoneda._id,
        saldo: 3000,
        activo: true,
        tipo: 'BANCO'
      }
    ]);

    // 6. Crear Transacciones
    const transacciones = await Transacciones.create([
      {
        descripcion: 'Pago de alquiler - Juan Pérez',
        monto: 1200,
        tipo: 'INGRESO',
        categoria: 'Contabilidad y Facturas',
        fecha: new Date(),
        usuario: userId,
        cuenta: cuentas[0]._id,
        estado: 'COMPLETADA'
      },
      {
        descripcion: 'Mantenimiento propiedad',
        monto: 300,
        tipo: 'EGRESO',
        categoria: 'Contabilidad y Facturas',
        fecha: new Date(),
        usuario: userId,
        cuenta: cuentas[0]._id,
        estado: 'COMPLETADA'
      }
    ]);

    // 7. Crear Objetivos
    const objetivos = await Objetivos.create([
      {
        nombre: 'Renovación Departamento Centro',
        descripcion: 'Renovación completa del departamento',
        usuario: userId,
        estado: 'en_progreso',
        fechaInicio: new Date('2024-06-01'),
        fechaFin: new Date('2024-08-31'),
        presupuesto: 5000,
        moneda: usdMoneda._id
      },
      {
        nombre: 'Mantenimiento Casa Residencial',
        descripcion: 'Mantenimiento general de la casa',
        usuario: userId,
        estado: 'planificado',
        fechaInicio: new Date('2024-09-01'),
        presupuesto: 2000,
        moneda: usdMoneda._id
      }
    ]);

    // 8. Crear Tareas
    const tareas = await Tareas.create([
      {
        titulo: 'Pintar habitación principal',
        descripcion: 'Pintar las paredes de la habitación principal',
        usuario: userId,
        objetivo: objetivos[0]._id,
        estado: 'pendiente',
        prioridad: 'alta',
        fechaVencimiento: new Date('2024-07-15')
      },
      {
        titulo: 'Reparar grifo cocina',
        descripcion: 'Reparar el grifo que gotea en la cocina',
        usuario: userId,
        objetivo: objetivos[1]._id,
        estado: 'en_progreso',
        prioridad: 'media',
        fechaVencimiento: new Date('2024-07-10')
      },
      {
        titulo: 'Revisar instalación eléctrica',
        descripcion: 'Revisión general de la instalación eléctrica',
        usuario: userId,
        estado: 'pendiente',
        prioridad: 'alta',
        fechaVencimiento: new Date('2024-07-20')
      }
    ]);

    // 9. Crear Inventarios
    const inventarios = await Inventarios.create([
      {
        nombre: 'Refrigerador Samsung',
        descripcion: 'Refrigerador de 2 puertas',
        categoria: 'electrodomestico',
        usuario: userId,
        propiedad: propiedades[0]._id,
        estado: 'bueno',
        fechaCompra: new Date('2023-01-15'),
        valor: 800,
        moneda: usdMoneda._id
      },
      {
        nombre: 'Lavadora LG',
        descripcion: 'Lavadora automática 15kg',
        categoria: 'electrodomestico',
        usuario: userId,
        propiedad: propiedades[1]._id,
        estado: 'excelente',
        fechaCompra: new Date('2023-06-10'),
        valor: 600,
        moneda: usdMoneda._id
      },
      {
        nombre: 'Juego de Comedor',
        descripcion: 'Mesa y 6 sillas de madera',
        categoria: 'mobiliario',
        usuario: userId,
        propiedad: propiedades[0]._id,
        estado: 'bueno',
        fechaCompra: new Date('2023-03-20'),
        valor: 1200,
        moneda: usdMoneda._id
      }
    ]);

    console.log('✅ Datos de ejemplo creados exitosamente:');
    console.log(`- ${propiedades.length} propiedades`);
    console.log(`- ${habitaciones.length} habitaciones`);
    console.log(`- ${inquilinos.length} inquilinos`);
    console.log(`- ${contratos.length} contratos`);
    console.log(`- ${cuentas.length} cuentas`);
    console.log(`- ${transacciones.length} transacciones`);
    console.log(`- ${objetivos.length} objetivos`);
    console.log(`- ${tareas.length} tareas`);
    console.log(`- ${inventarios.length} items de inventario`);

  } catch (error) {
    console.error('Error al crear datos de ejemplo:', error);
  }
}; 