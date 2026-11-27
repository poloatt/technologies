import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Cuentas, Monedas, Transacciones, COLORES_MONEDA } from '../../models/index.js';
import { transaccionesController } from '../../controllers/transaccionesController.js';
import {
  attachMonedasToCuentaJson,
  ensureEfectivoAccount,
  getEnabledMonedasForUser,
} from '../efectivoAccountService.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  await Promise.all([
    Cuentas.deleteMany({}),
    Monedas.deleteMany({}),
    Transacciones.deleteMany({}),
  ]);
});

describe('efectivoAccountService', () => {
  test('crea la cuenta Efectivo por defecto con las monedas habilitadas y es idempotente', async () => {
    const userId = new mongoose.Types.ObjectId();

    const ars = await Monedas.create({
      codigo: 'ARS',
      nombre: 'Peso Argentino',
      simbolo: '$',
      color: COLORES_MONEDA.CELESTE_ARGENTINA,
      activa: true,
      orden: 0,
    });
    const usd = await Monedas.create({
      codigo: 'USD',
      nombre: 'Dólar Estadounidense',
      simbolo: 'US$',
      color: COLORES_MONEDA.DARK_GREEN,
      activa: true,
      orden: 1,
    });
    await Monedas.create({
      codigo: 'EUR',
      nombre: 'Euro',
      simbolo: '€',
      color: COLORES_MONEDA.AZUL_NAVY,
      activa: false,
      orden: 2,
    });

    const cuenta1 = await ensureEfectivoAccount(userId);
    const cuenta2 = await ensureEfectivoAccount(userId);

    expect(cuenta1).toBeTruthy();
    expect(String(cuenta1._id)).toBe(String(cuenta2._id));
    expect(cuenta1.nombre).toBe('Efectivo');
    expect(cuenta1.tipo).toBe('EFECTIVO');
    expect(cuenta1.esDefault).toBe(true);
    expect(cuenta1.multimoneda).toBe(true);
    expect(await Cuentas.countDocuments({ usuario: userId })).toBe(1);

    const monedasHabilitadas = await getEnabledMonedasForUser(userId);
    const json = attachMonedasToCuentaJson(cuenta1, monedasHabilitadas);

    expect(json.monedas).toHaveLength(2);
    expect(json.monedas.map((m) => m.codigo)).toEqual(['ARS', 'USD']);
    expect(json.monedas[0]).toMatchObject({
      id: String(ars._id),
      simbolo: '$',
      color: COLORES_MONEDA.CELESTE_ARGENTINA,
    });
    expect(json.monedas[1]).toMatchObject({
      id: String(usd._id),
      simbolo: 'US$',
      color: COLORES_MONEDA.DARK_GREEN,
    });
  });

  test('promueve una cuenta Efectivo existente sin duplicarla', async () => {
    const userId = new mongoose.Types.ObjectId();
    const ars = await Monedas.create({
      codigo: 'ARS',
      nombre: 'Peso Argentino',
      simbolo: '$',
      color: COLORES_MONEDA.CELESTE_ARGENTINA,
      activa: true,
      orden: 0,
    });

    const existente = await Cuentas.create({
      nombre: 'Efectivo',
      tipo: 'EFECTIVO',
      usuario: userId,
      moneda: ars._id,
      activo: true,
    });

    const ensured = await ensureEfectivoAccount(userId);
    expect(String(ensured._id)).toBe(String(existente._id));
    expect(ensured.esDefault).toBe(true);
    expect(ensured.multimoneda).toBe(true);
    expect(await Cuentas.countDocuments({ usuario: userId })).toBe(1);
  });

  test('permite transacciones en distintas monedas dentro de Efectivo y calcula balance por moneda', async () => {
    const userId = new mongoose.Types.ObjectId();
    const ars = await Monedas.create({
      codigo: 'ARS',
      nombre: 'Peso Argentino',
      simbolo: '$',
      color: COLORES_MONEDA.CELESTE_ARGENTINA,
      activa: true,
      orden: 0,
    });
    const usd = await Monedas.create({
      codigo: 'USD',
      nombre: 'Dólar Estadounidense',
      simbolo: 'US$',
      color: COLORES_MONEDA.DARK_GREEN,
      activa: true,
      orden: 1,
    });

    const efectivo = await ensureEfectivoAccount(userId);

    await Transacciones.create([
      {
        descripcion: 'Cobro en pesos',
        monto: 10000,
        tipo: 'INGRESO',
        categoria: 'Otro',
        estado: 'PAGADO',
        usuario: userId,
        cuenta: efectivo._id,
        moneda: ars._id,
      },
      {
        descripcion: 'Gasto en pesos',
        monto: 2500,
        tipo: 'EGRESO',
        categoria: 'Comida y Mercado',
        estado: 'PAGADO',
        usuario: userId,
        cuenta: efectivo._id,
        moneda: ars._id,
      },
      {
        descripcion: 'Ahorro en dólares',
        monto: 200,
        tipo: 'INGRESO',
        categoria: 'Otro',
        estado: 'PAGADO',
        usuario: userId,
        cuenta: efectivo._id,
        moneda: usd._id,
      },
    ]);

    const balance = await Transacciones.getBalance(efectivo._id, { estado: 'PAGADO' });
    const byId = Object.fromEntries(balance.porMoneda.map((m) => [m.monedaId, m]));

    expect(byId[String(ars._id)]).toMatchObject({
      ingresos: 10000,
      egresos: 2500,
      balance: 7500,
    });
    expect(byId[String(usd._id)]).toMatchObject({
      ingresos: 200,
      egresos: 0,
      balance: 200,
    });
  });

  test('ingresar transacciones desde el form (create) actualiza by-cuenta, stats del período y balance por moneda', async () => {
    const userId = new mongoose.Types.ObjectId();
    const ars = await Monedas.create({
      codigo: 'ARS',
      nombre: 'Peso Argentino',
      simbolo: '$',
      color: COLORES_MONEDA.CELESTE_ARGENTINA,
      activa: true,
      orden: 0,
    });
    const usd = await Monedas.create({
      codigo: 'USD',
      nombre: 'Dólar Estadounidense',
      simbolo: 'US$',
      color: COLORES_MONEDA.DARK_GREEN,
      activa: true,
      orden: 1,
    });

    const efectivo = await ensureEfectivoAccount(userId);
    const fechaHoy = '2026-11-27';

    // 1. Crear ingreso ARS, egreso ARS e ingreso USD vía transaccionesController.create (como el form)
    const payloads = [
      {
        descripcion: 'Venta contado',
        monto: 15000,
        fecha: fechaHoy,
        categoria: 'Otro',
        estado: 'PAGADO',
        tipo: 'INGRESO',
        cuenta: String(efectivo._id),
        moneda: String(ars._id),
      },
      {
        descripcion: 'Supermercado',
        monto: 4200,
        fecha: fechaHoy,
        categoria: 'Comida y Mercado',
        estado: 'PAGADO',
        tipo: 'EGRESO',
        cuenta: String(efectivo._id),
        moneda: String(ars._id),
      },
      {
        descripcion: 'Cobro USD efectivo',
        monto: 150,
        fecha: fechaHoy,
        categoria: 'Otro',
        estado: 'PAGADO',
        tipo: 'INGRESO',
        cuenta: String(efectivo._id),
        moneda: String(usd._id),
      },
    ];

    for (const body of payloads) {
      const res = createMockRes();
      await transaccionesController.create(
        { user: { id: String(userId) }, body },
        res,
      );
      expect(res.statusCode).toBe(201);
      expect(String(res.body.cuenta.id || res.body.cuenta._id)).toBe(String(efectivo._id));
      expect(String(res.body.moneda.id || res.body.moneda._id)).toBe(body.moneda);
    }

    // 2. Verificar getByCuenta
    const listRes = createMockRes();
    await transaccionesController.getByCuenta(
      {
        user: { id: String(userId) },
        params: { cuentaId: String(efectivo._id) },
        query: { limit: 50, estado: 'PAGADO' },
      },
      listRes,
    );
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.docs).toHaveLength(3);

    // 3. Verificar getStats del período
    const statsRes = createMockRes();
    await transaccionesController.getStats(
      {
        user: { id: String(userId) },
        query: {
          fechaInicio: '2026-11-01',
          fechaFin: '2026-11-30',
          estado: 'PAGADO',
          cuenta: String(efectivo._id),
        },
      },
      statsRes,
    );
    expect(statsRes.statusCode).toBe(200);
    const statsByCode = Object.fromEntries(
      (statsRes.body.porMoneda || []).map((m) => [m.codigo, m]),
    );
    expect(statsByCode.ARS).toMatchObject({
      ingresos: 15000,
      egresos: 4200,
      balance: 10800,
      simbolo: '$',
      color: COLORES_MONEDA.CELESTE_ARGENTINA,
    });
    expect(statsByCode.USD).toMatchObject({
      ingresos: 150,
      egresos: 0,
      balance: 150,
      simbolo: 'US$',
      color: COLORES_MONEDA.DARK_GREEN,
    });

    // 4. Verificar getBalance acumulado por moneda al cierre del período
    const balanceRes = createMockRes();
    await transaccionesController.getBalance(
      {
        user: { id: String(userId) },
        params: { cuentaId: String(efectivo._id) },
        query: { fechaFin: fechaHoy, estado: 'PAGADO' },
      },
      balanceRes,
    );
    expect(balanceRes.statusCode).toBe(200);
    const balById = Object.fromEntries(
      (balanceRes.body.porMoneda || []).map((m) => [m.monedaId, m]),
    );
    expect(balById[String(ars._id)]).toMatchObject({
      ingresos: 15000,
      egresos: 4200,
      balance: 10800,
    });
    expect(balById[String(usd._id)]).toMatchObject({
      ingresos: 150,
      egresos: 0,
      balance: 150,
    });
  });
});
