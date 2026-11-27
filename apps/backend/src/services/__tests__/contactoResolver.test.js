import {
  aplicarCategoriaDeContactoATransacciones,
  backfillContactosDesdeMp,
  createContactoSyncCache,
  esNombreSintetico,
  extraerSenalesContraparteMp,
  normalizarClaveContacto,
  resolverCategoriaDeContacto,
  resolverOCrearContactoMp,
} from '../contactoResolverService.js';

function createFakeContactoModel(initialDocs = []) {
  const store = [];
  let seq = 1;

  class FakeContacto {
    constructor(data) {
      Object.assign(this, {
        _id: data._id || `c_${seq++}`,
        identificadores: { mpIds: [], emails: [], cuentasBancarias: [], aliases: [] },
        datosContacto: { telefono: '', email: '', notas: '' },
        ...data,
      });
      this.id = this._id;
    }

    async save() {
      const idx = store.findIndex((d) => d._id === this._id);
      if (idx === -1) store.push(this);
      else store[idx] = this;
      return this;
    }

    static async findOne(query) {
      return (
        store.find((doc) => {
          if (query.usuario && doc.usuario !== query.usuario) return false;
          if (query['identificadores.mpIds']) {
            return doc.identificadores.mpIds.includes(query['identificadores.mpIds']);
          }
          if (query['identificadores.emails']) {
            return doc.identificadores.emails.includes(query['identificadores.emails']);
          }
          if (query['identificadores.cuentasBancarias']) {
            return doc.identificadores.cuentasBancarias.includes(
              query['identificadores.cuentasBancarias']
            );
          }
          if (query['identificadores.aliases']?.$in) {
            return query['identificadores.aliases'].$in.some((a) =>
              doc.identificadores.aliases.includes(a)
            );
          }
          return true;
        }) || null
      );
    }

    static async find(query) {
      return store.filter((doc) => !query.usuario || doc.usuario === query.usuario);
    }
  }

  for (const d of initialDocs) {
    store.push(new FakeContacto(d));
  }
  FakeContacto._store = store;
  return FakeContacto;
}

describe('contactoResolverService', () => {
  describe('normalizarClaveContacto y esNombreSintetico', () => {
    it('normaliza mayúsculas, tildes, prefijos de MP y espacios', () => {
      expect(normalizarClaveContacto('  MercadoPago - Transferencia a   Juan Pérez  ')).toBe(
        'juan perez'
      );
      expect(normalizarClaveContacto('Pago con QR en Café Martínez · desde Reserva')).toBe(
        'cafe martinez'
      );
      expect(normalizarClaveContacto('CARREFOUR EXPRESS - CVU 0000123')).toBe('carrefour express');
    });

    it('detecta nombres sintéticos', () => {
      expect(esNombreSintetico('Comercio #987654')).toBe(true);
      expect(esNombreSintetico('Cuenta 00000031000123')).toBe(true);
      expect(esNombreSintetico('Carrefour')).toBe(false);
    });
  });

  describe('extraerSenalesContraparteMp', () => {
    it('extrae señales completas de un pago comercial', () => {
      const senales = extraerSenalesContraparteMp({
        metadata: {
          counterpartyName: 'Carrefour Express',
          counterpartyId: '123456789',
          businessName: 'Carrefour',
          movementKind: 'PAYMENT',
        },
        descripcion: 'Pago en Carrefour Express',
      });

      expect(senales).toMatchObject({
        nombre: 'Carrefour Express',
        tipo: 'COMERCIO',
        mpId: '123456789',
      });
      expect(senales.aliases).toContain('carrefour express');
      expect(senales.aliases).toContain('carrefour');
    });

    it('permite compras con tarjeta (CARD_PURCHASE) aunque tengan statsExclude: true', () => {
      const senales = extraerSenalesContraparteMp({
        metadata: {
          statementDescriptor: 'NETFLIX.COM',
          movementKind: 'CARD_PURCHASE',
          statsExclude: true,
        },
        economic: { movementKind: 'CARD_PURCHASE', statsExclude: true, isInternal: false },
      });

      expect(senales).toMatchObject({
        nombre: 'NETFLIX.COM',
        tipo: 'COMERCIO',
      });
      expect(senales.aliases).toContain('netflix.com');
    });

    it('ignora movimientos internos, reservas, inversiones, rendimientos y cambio de dólares', () => {
      expect(
        extraerSenalesContraparteMp({
          metadata: { counterpartyName: 'Reserva', movementKind: 'RESERVE_LOCK' },
          economic: { movementKind: 'RESERVE_LOCK', statsExclude: true, isInternal: false },
        })
      ).toBeNull();

      expect(
        extraerSenalesContraparteMp({
          metadata: { counterpartyName: 'Mercado Fondo', movementKind: 'INVESTMENT_YIELD' },
          economic: { movementKind: 'INVESTMENT_YIELD', statsExclude: true, isInternal: false },
        })
      ).toBeNull();

      expect(
        extraerSenalesContraparteMp({
          metadata: { counterpartyName: 'Dólar MEP', movementKind: 'FX_BUY' },
          economic: { movementKind: 'FX_BUY', statsExclude: true, isInternal: false },
        })
      ).toBeNull();

      expect(
        extraerSenalesContraparteMp({
          metadata: { counterpartyName: 'wallet', isInternal: true },
          economic: { movementKind: 'INTERNAL', isInternal: true, statsExclude: true },
        })
      ).toBeNull();
    });

    it('ignora contrapartes puramente genéricas sin identificadores', () => {
      expect(
        extraerSenalesContraparteMp({
          metadata: { counterpartyName: 'MercadoPago', businessName: 'wallet' },
          descripcion: 'Dinero en cuenta',
        })
      ).toBeNull();
    });

    it('no usa el itemTitle genérico de MP ("default item") como nombre ni alias', () => {
      const senales = extraerSenalesContraparteMp({
        metadata: { itemTitle: 'default item', movementKind: 'PAYMENT', isTransfer: false },
        descripcion: 'MercadoPago - Producto de Puma Energy',
      });

      expect(senales.nombre).toBe('Producto de Puma Energy');
      expect(senales.aliases).toContain('producto de puma energy');
      expect(senales.aliases).not.toContain('default item');
    });

    it('un pago sin descripción real no se engancha a un contacto por el alias "default item"', async () => {
      const FakeContacto = createFakeContactoModel();
      const cache = createContactoSyncCache();

      const sTresMonos = extraerSenalesContraparteMp({
        metadata: { itemTitle: 'default item', movementKind: 'PAYMENT' },
        descripcion: 'MercadoPago - Producto de TRES MONOS BAR',
      });
      await resolverOCrearContactoMp({ usuarioId: 'u1', senales: sTresMonos, cache, Model: FakeContacto });

      const sPuma = extraerSenalesContraparteMp({
        metadata: { itemTitle: 'default item', movementKind: 'PAYMENT' },
        descripcion: 'MercadoPago - Producto de Puma Energy',
      });
      const r = await resolverOCrearContactoMp({ usuarioId: 'u1', senales: sPuma, cache, Model: FakeContacto });

      expect(r.creado).toBe(true);
      expect(r.contacto.nombre).toBe('Producto de Puma Energy');
      expect(FakeContacto._store).toHaveLength(2);
    });
  });

  describe('resolverOCrearContactoMp', () => {
    it('auto-crea un contacto en el primer movimiento y luego matchea sin duplicar por alias, email o mpId', async () => {
      const FakeContacto = createFakeContactoModel();
      const cache = createContactoSyncCache();

      // 1) Primer movimiento llega solo con nombre sintético y mpId
      const s1 = extraerSenalesContraparteMp({
        metadata: { counterpartyName: 'Comercio #555001', counterpartyId: '555001', movementKind: 'PAYMENT' },
      });
      const r1 = await resolverOCrearContactoMp({
        usuarioId: 'u1',
        senales: s1,
        cache,
        Model: FakeContacto,
      });
      expect(r1.creado).toBe(true);
      expect(r1.contacto.nombre).toBe('Comercio #555001');
      expect(r1.contacto.origen).toBe('MERCADOPAGO');
      expect(r1.contacto.categoriaDefault).toBeNull();

      // 2) Segundo movimiento trae mismo mpId + nombre real y email -> enriquece sin duplicar
      const s2 = extraerSenalesContraparteMp({
        metadata: {
          counterpartyName: 'Café Martínez',
          counterpartyId: '555001',
          counterpartyEmail: 'facturacion@cafemartinez.com',
          movementKind: 'PAYMENT',
        },
      });
      const r2 = await resolverOCrearContactoMp({
        usuarioId: 'u1',
        senales: s2,
        cache,
        Model: FakeContacto,
      });
      expect(r2.creado).toBe(false);
      expect(r2.contacto._id).toBe(r1.contacto._id);
      expect(r2.contacto.nombre).toBe('Café Martínez');
      expect(r2.contacto.identificadores.emails).toContain('facturacion@cafemartinez.com');
      expect(r2.contacto.identificadores.aliases).toContain('cafe martinez');
      expect(FakeContacto._store).toHaveLength(1);

      // 3) Tercer movimiento (CSV sin mpId ni email, solo alias en mayúsculas sin tilde) -> matchea por alias
      const s3 = extraerSenalesContraparteMp({
        metadata: { counterpartyName: 'CAFE MARTINEZ', movementKind: 'PAYMENT' },
      });
      const r3 = await resolverOCrearContactoMp({
        usuarioId: 'u1',
        senales: s3,
        cache: createContactoSyncCache(), // caché fría para probar consulta a DB
        Model: FakeContacto,
      });
      expect(r3.creado).toBe(false);
      expect(r3.contacto._id).toBe(r1.contacto._id);
      expect(FakeContacto._store).toHaveLength(1);
    });
  });

  describe('resolverCategoriaDeContacto', () => {
    it('prioriza override por tipo y usa categoriaDefault como fallback', () => {
      const contacto = {
        categoriaDefault: 'Contabilidad y Facturas',
        categoriaIngreso: 'Alquiler',
        categoriaEgreso: null,
      };
      expect(resolverCategoriaDeContacto(contacto, 'INGRESO')).toBe('Alquiler');
      expect(resolverCategoriaDeContacto(contacto, 'EGRESO')).toBe('Contabilidad y Facturas');
      expect(resolverCategoriaDeContacto({ categoriaDefault: null }, 'EGRESO')).toBeNull();
    });
  });

  describe('aplicarCategoriaDeContactoATransacciones', () => {
    it('respeta categoriaManual por defecto y permite sobrescribir si se solicita', async () => {
      const calls = [];
      const fakeTxModel = {
        async updateMany(filter, update) {
          calls.push({ filter, update });
          return { modifiedCount: 3 };
        },
      };

      const contacto = {
        _id: 'c1',
        usuario: 'u1',
        categoriaDefault: 'Comida y Mercado',
        categoriaIngreso: null,
        categoriaEgreso: null,
      };

      const count1 = await aplicarCategoriaDeContactoATransacciones(contacto, {
        usuarioId: 'u1',
        sobrescribirManuales: false,
        TxModel: fakeTxModel,
      });
      expect(count1).toBe(3);
      expect(calls[0].filter).toMatchObject({
        usuario: 'u1',
        contacto: 'c1',
        categoriaManual: { $ne: true },
        categoria: { $ne: 'Comida y Mercado' },
      });

      const count2 = await aplicarCategoriaDeContactoATransacciones(contacto, {
        usuarioId: 'u1',
        sobrescribirManuales: true,
        TxModel: fakeTxModel,
      });
      expect(count2).toBe(3);
      expect(calls[1].filter.categoriaManual).toBeUndefined();
    });
  });

  describe('backfillContactosDesdeMp', () => {
    it('vincula movimientos previos, categoriza los en Otro si el contacto tiene categoría y respeta categoriaManual', async () => {
      const FakeContacto = createFakeContactoModel([
        {
          _id: 'c_pre',
          usuario: 'u1',
          nombre: 'PedidosYa',
          tipo: 'COMERCIO',
          categoriaDefault: 'Comida y Mercado',
          identificadores: { mpIds: [], emails: [], cuentasBancarias: [], aliases: ['pedidosya'] },
        },
      ]);

      const txs = [
        {
          _id: 't1',
          usuario: 'u1',
          tipo: 'EGRESO',
          categoria: 'Otro',
          categoriaManual: false,
          contacto: null,
          descripcion: 'Pago en PedidosYa',
          origen: { tipo: 'MERCADOPAGO_PAGO', metadata: { counterpartyName: 'PedidosYa', movementKind: 'PAYMENT' } },
        },
        {
          _id: 't2',
          usuario: 'u1',
          tipo: 'EGRESO',
          categoria: 'Otro',
          categoriaManual: true, // manual: se vincula contacto pero NO cambia categoría
          contacto: null,
          descripcion: 'Pago en PedidosYa',
          origen: { tipo: 'MERCADOPAGO_PAGO', metadata: { counterpartyName: 'PedidosYa', movementKind: 'PAYMENT' } },
        },
        {
          _id: 't3',
          usuario: 'u1',
          tipo: 'EGRESO',
          categoria: 'Otro',
          categoriaManual: false,
          contacto: null,
          descripcion: 'Transferencia a Juan Perez',
          origen: { tipo: 'MERCADOPAGO_MOVIMIENTO', metadata: { counterpartyName: 'Juan Perez', movementKind: 'P2P_TRANSFER' } },
        },
        {
          _id: 't4',
          usuario: 'u1',
          tipo: 'EGRESO',
          categoria: 'Otro',
          categoriaManual: false,
          contacto: null,
          descripcion: 'MercadoPago - Reserva',
          origen: { tipo: 'MERCADOPAGO_MOVIMIENTO', metadata: { movementKind: 'RESERVE_LOCK', statsExclude: true } },
        },
      ];

      const updates = new Map();
      const fakeTxModel = {
        find() {
          return {
            select: async () => txs,
          };
        },
        async updateOne(filter, update) {
          updates.set(filter._id, update.$set);
          return { modifiedCount: 1 };
        },
      };

      const res = await backfillContactosDesdeMp('u1', {
        TxModel: fakeTxModel,
        ContactoModel: FakeContacto,
      });

      expect(res).toEqual({
        procesadas: 4,
        contactosCreados: 1,
        vinculadas: 3,
        categorizadas: 1,
      });
      expect(updates.get('t1')).toEqual({ contacto: 'c_pre', categoria: 'Comida y Mercado' });
      expect(updates.get('t2')).toEqual({ contacto: 'c_pre' });
      expect(updates.get('t3')).toMatchObject({ contacto: expect.any(String) });
      expect(updates.has('t4')).toBe(false);
    });
  });
});
