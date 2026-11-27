import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Cuentas, Monedas, Transacciones, COLORES_MONEDA } from '../../models/index.js';
import { transaccionesController } from '../../controllers/transaccionesController.js';
import { ensureEfectivoAccount } from '../efectivoAccountService.js';
import {
  esTransaccionManual,
  normalizarEstadoManual,
  parseFechaManual,
  parseMontoManual,
} from '../../utils/transaccionManual.js';

function createMockRes() {
  return {
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
}

async function call(handler, req) {
  const res = createMockRes();
  await handler(req, res);
  return res;
}

let mongoServer;
let ars;
let usd;
let owner;
let intruso;
let bancoArs;
let bancoUsd;
let mercadoPago;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  owner = String(new mongoose.Types.ObjectId());
  intruso = String(new mongoose.Types.ObjectId());
  ars = await Monedas.create({
    codigo: 'ARS', nombre: 'Peso Argentino', simbolo: '$',
    color: COLORES_MONEDA.CELESTE_ARGENTINA, activa: true, orden: 0,
  });
  usd = await Monedas.create({
    codigo: 'USD', nombre: 'Dólar', simbolo: 'US$',
    color: COLORES_MONEDA.DARK_GREEN, activa: true, orden: 1,
  });
  bancoArs = await Cuentas.create({ nombre: 'Banco ARS', tipo: 'BANCO', usuario: owner, moneda: ars._id });
  bancoUsd = await Cuentas.create({ nombre: 'Banco USD', tipo: 'BANCO', usuario: owner, moneda: usd._id });
  mercadoPago = await Cuentas.create({ nombre: 'MP', tipo: 'MERCADO_PAGO', usuario: owner, moneda: ars._id });
});

afterEach(async () => {
  await Promise.all([
    Cuentas.deleteMany({}),
    Monedas.deleteMany({}),
    Transacciones.deleteMany({}),
  ]);
});

const alta = (overrides = {}) => ({
  descripcion: 'Cobro',
  monto: 1000,
  fecha: '2026-11-27',
  categoria: 'Ventas',
  estado: 'PAGADO',
  tipo: 'INGRESO',
  cuenta: String(bancoArs._id),
  ...overrides,
});

const crear = async (body, user = owner) => call(transaccionesController.create, { user: { id: user }, body });

describe('helpers de registros manuales', () => {
  test('parseMontoManual exige un número positivo', () => {
    expect(parseMontoManual('0').error).toBeTruthy();
    expect(parseMontoManual('.').error).toBeTruthy();
    expect(parseMontoManual(-5).error).toBeTruthy();
    expect(parseMontoManual('abc').error).toBeTruthy();
    expect(parseMontoManual(1e15).error).toBeTruthy();
    expect(parseMontoManual('12.345').value).toBe(12.35);
  });

  test('parseFechaManual guarda YYYY-MM-DD al mediodía de Argentina', () => {
    expect(parseFechaManual('2026-11-27').value.toISOString()).toBe('2026-11-27T15:00:00.000Z');
    expect(parseFechaManual('').error).toBeTruthy();
    expect(parseFechaManual('no-fecha').error).toBeTruthy();
  });

  test('normalizarEstadoManual unifica PAGADO en COMPLETADA', () => {
    expect(normalizarEstadoManual('PAGADO')).toBe('COMPLETADA');
    expect(normalizarEstadoManual('PENDIENTE')).toBe('PENDIENTE');
    expect(normalizarEstadoManual('cancelado')).toBe('CANCELADA');
    expect(normalizarEstadoManual('xx')).toBeNull();
    expect(normalizarEstadoManual(undefined, 'PENDIENTE')).toBe('PENDIENTE');
  });

  test('esTransaccionManual trata registros sin origen como manuales', () => {
    expect(esTransaccionManual({})).toBe(true);
    expect(esTransaccionManual({ origen: { tipo: 'MANUAL' } })).toBe(true);
    expect(esTransaccionManual({ origen: { tipo: 'MERCADOPAGO_PAGO' } })).toBe(false);
  });
});

describe('alta manual (create)', () => {
  test('guarda COMPLETADA, fecha al mediodía AR, moneda de la cuenta y origen MANUAL', async () => {
    const res = await crear(alta());
    expect(res.statusCode).toBe(201);
    expect(res.body.estado).toBe('COMPLETADA');
    expect(res.body.origen.tipo).toBe('MANUAL');
    expect(new Date(res.body.fecha).toISOString()).toBe('2026-11-27T15:00:00.000Z');
    expect(String(res.body.moneda.id || res.body.moneda._id)).toBe(String(ars._id));
  });

  test('ignora campos que el cliente no puede fijar (usuario, origen, comisiones)', async () => {
    const res = await crear(alta({
      usuario: intruso,
      origen: { tipo: 'MERCADOPAGO' },
      montoNeto: 5,
      comisiones: { total: 99 },
    }));
    expect(res.statusCode).toBe(201);
    const guardada = await Transacciones.findById(res.body.id).lean();
    expect(String(guardada.usuario)).toBe(owner);
    expect(guardada.origen.tipo).toBe('MANUAL');
    expect(guardada.montoNeto).toBeUndefined();
    expect(guardada.comisiones.total).toBe(0);
  });

  test('rechaza montos inválidos, tipo inválido y fechas inválidas', async () => {
    expect((await crear(alta({ monto: 0 }))).statusCode).toBe(400);
    expect((await crear(alta({ monto: '.' }))).statusCode).toBe(400);
    expect((await crear(alta({ monto: -3 }))).statusCode).toBe(400);
    expect((await crear(alta({ tipo: 'OTRO' }))).statusCode).toBe(400);
    expect((await crear(alta({ fecha: 'ayer' }))).statusCode).toBe(400);
    expect((await crear(alta({ descripcion: '   ' }))).statusCode).toBe(400);
    expect((await crear(alta({ estado: 'RARO' }))).statusCode).toBe(400);
  });

  test('bloquea la carga manual en cuentas de Mercado Pago', async () => {
    const res = await crear(alta({ cuenta: String(mercadoPago._id) }));
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Mercado Pago/);
    expect(await Transacciones.countDocuments({})).toBe(0);
  });

  test('no permite usar cuentas de otro usuario', async () => {
    const res = await crear(alta(), intruso);
    expect(res.statusCode).toBe(404);
  });

  test('en cuentas multimoneda solo acepta monedas habilitadas', async () => {
    const efectivo = await ensureEfectivoAccount(owner);
    const inactiva = await Monedas.create({
      codigo: 'EUR', nombre: 'Euro', simbolo: '€',
      color: COLORES_MONEDA.AZUL_NAVY, activa: false, orden: 3,
    });

    const ok = await crear(alta({ cuenta: String(efectivo._id), moneda: String(usd._id) }));
    expect(ok.statusCode).toBe(201);
    expect(String(ok.body.moneda.id || ok.body.moneda._id)).toBe(String(usd._id));

    const mal = await crear(alta({ cuenta: String(efectivo._id), moneda: String(inactiva._id) }));
    expect(mal.statusCode).toBe(400);
  });
});

describe('propiedad de los registros (ownership)', () => {
  test('otro usuario no puede leer, editar, cambiar estado ni borrar', async () => {
    const creada = await crear(alta());
    const id = creada.body.id;
    const req = { user: { id: intruso }, params: { id }, body: { descripcion: 'hack', monto: 1 } };

    expect((await call(transaccionesController.getById, req)).statusCode).toBe(404);
    expect((await call(transaccionesController.update, req)).statusCode).toBe(404);
    expect((await call(transaccionesController.updateEstado, { ...req, body: { estado: 'PENDIENTE' } })).statusCode).toBe(404);
    expect((await call(transaccionesController.delete, req)).statusCode).toBe(404);

    const intacta = await Transacciones.findById(id).lean();
    expect(intacta.descripcion).toBe('Cobro');
    expect(intacta.monto).toBe(1000);
  });

  test('balance y listado por cuenta ajena devuelven 404', async () => {
    await crear(alta());
    const params = { cuentaId: String(bancoArs._id) };
    expect((await call(transaccionesController.getBalance, { user: { id: intruso }, params, query: {} })).statusCode).toBe(404);
    expect((await call(transaccionesController.getByCuenta, { user: { id: intruso }, params, query: {} })).statusCode).toBe(404);
    const propio = await call(transaccionesController.getBalance, { user: { id: owner }, params, query: { estado: 'PAGADO' } });
    expect(propio.statusCode).toBe(200);
    expect(propio.body.balance).toBe(1000);
  });

  test('limita el tamaño de página', async () => {
    const res = await call(transaccionesController.getAll, {
      user: { id: owner },
      query: { limit: '100000' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.limit).toBe(200);
  });
});

describe('edición (update)', () => {
  test('normaliza la fecha al mediodía AR y mantiene el día', async () => {
    const creada = await crear(alta());
    const res = await call(transaccionesController.update, {
      user: { id: owner },
      params: { id: creada.body.id },
      body: { ...alta(), fecha: '2026-12-01', monto: '2500.5' },
    });
    expect(res.statusCode).toBe(200);
    expect(new Date(res.body.fecha).toISOString()).toBe('2026-12-01T15:00:00.000Z');
    expect(res.body.monto).toBe(2500.5);
  });

  test('al cambiar de cuenta recalcula la moneda y no acepta la que manda el cliente', async () => {
    const creada = await crear(alta());
    const res = await call(transaccionesController.update, {
      user: { id: owner },
      params: { id: creada.body.id },
      body: { cuenta: String(bancoUsd._id), moneda: String(ars._id) },
    });
    expect(res.statusCode).toBe(200);
    expect(String(res.body.moneda.id || res.body.moneda._id)).toBe(String(usd._id));
    expect(String(res.body.cuenta.id || res.body.cuenta._id)).toBe(String(bancoUsd._id));
  });

  test('no permite mover un registro a Mercado Pago ni a una cuenta ajena', async () => {
    const creada = await crear(alta());
    const aMp = await call(transaccionesController.update, {
      user: { id: owner },
      params: { id: creada.body.id },
      body: { cuenta: String(mercadoPago._id) },
    });
    expect(aMp.statusCode).toBe(400);

    const ajena = await Cuentas.create({ nombre: 'Ajena', tipo: 'BANCO', usuario: intruso, moneda: ars._id });
    const aAjena = await call(transaccionesController.update, {
      user: { id: owner },
      params: { id: creada.body.id },
      body: { cuenta: String(ajena._id) },
    });
    expect(aAjena.statusCode).toBe(404);
  });

  test('ignora usuario y origen enviados en el body', async () => {
    const creada = await crear(alta());
    await call(transaccionesController.update, {
      user: { id: owner },
      params: { id: creada.body.id },
      body: { usuario: intruso, origen: { tipo: 'MERCADOPAGO' }, descripcion: 'Editada' },
    });
    const guardada = await Transacciones.findById(creada.body.id).lean();
    expect(String(guardada.usuario)).toBe(owner);
    expect(guardada.origen.tipo).toBe('MANUAL');
    expect(guardada.descripcion).toBe('Editada');
  });

  test('los movimientos sincronizados solo permiten cambiar la categoría y no se borran', async () => {
    const sync = await Transacciones.create({
      descripcion: 'Pago MP',
      monto: 500,
      tipo: 'EGRESO',
      categoria: 'Otro',
      estado: 'COMPLETADA',
      usuario: owner,
      cuenta: mercadoPago._id,
      moneda: ars._id,
      origen: { tipo: 'MERCADOPAGO_PAGO', transaccionId: '12345678901' },
    });
    const id = String(sync._id);

    const monto = await call(transaccionesController.update, {
      user: { id: owner }, params: { id }, body: { monto: 1 },
    });
    expect(monto.statusCode).toBe(403);

    const categoria = await call(transaccionesController.update, {
      user: { id: owner }, params: { id }, body: { categoria: 'Transporte' },
    });
    expect(categoria.statusCode).toBe(200);
    expect(categoria.body.categoria).toBe('Transporte');
    expect(categoria.body.monto).toBe(500);

    const borrar = await call(transaccionesController.delete, { user: { id: owner }, params: { id } });
    expect(borrar.statusCode).toBe(403);
    expect(await Transacciones.countDocuments({ _id: sync._id })).toBe(1);

    const estado = await call(transaccionesController.updateEstado, {
      user: { id: owner }, params: { id }, body: { estado: 'PENDIENTE' },
    });
    expect(estado.statusCode).toBe(403);
  });
});

describe('estados y resumen', () => {
  test('pendiente no suma al balance hasta marcarse como pagado', async () => {
    const creada = await crear(alta({ estado: 'PENDIENTE' }));
    expect(creada.body.estado).toBe('PENDIENTE');
    const params = { cuentaId: String(bancoArs._id) };
    const query = { estado: 'PAGADO' };

    const antes = await call(transaccionesController.getBalance, { user: { id: owner }, params, query });
    expect(antes.body.balance).toBe(0);

    const patch = await call(transaccionesController.updateEstado, {
      user: { id: owner }, params: { id: creada.body.id }, body: { estado: 'PAGADO' },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.body.estado).toBe('COMPLETADA');

    const despues = await call(transaccionesController.getBalance, { user: { id: owner }, params, query });
    expect(despues.body.balance).toBe(1000);
  });

  test('updateEstado rechaza valores desconocidos', async () => {
    const creada = await crear(alta());
    const res = await call(transaccionesController.updateEstado, {
      user: { id: owner }, params: { id: creada.body.id }, body: { estado: 'XX' },
    });
    expect(res.statusCode).toBe(400);
  });

  test('getResumen incluye los registros manuales cargados como PAGADO', async () => {
    await crear(alta({ monto: 300 }));
    await crear(alta({ monto: 120, tipo: 'EGRESO', categoria: 'Transporte' }));
    await crear(alta({ monto: 999, estado: 'PENDIENTE' }));
    await crear(alta({ monto: 50 }), intruso).catch(() => null);

    const res = await call(transaccionesController.getResumen, {
      user: { id: owner },
      query: { fechaInicio: '2026-11-01', fechaFin: '2026-11-30' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    const totales = Object.fromEntries(res.body[0].categorias.map((c) => [c.tipo, c.total]));
    expect(totales.INGRESO).toBe(300);
    expect(totales.EGRESO).toBe(120);
  });
});
