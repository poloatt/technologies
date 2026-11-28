import { BaseController } from './BaseController.js';
import { BankConnection } from '../models/BankConnection.js';
import { BankSyncService } from '../services/bankSyncService.js';
import crypto from 'crypto';
import { getAuthUrl, exchangeCodeForToken } from '../oauth/mercadoPagoOAuth.js';
import { BankIntegrationService } from '../services/bankIntegrationService.js';
import fetch from 'node-fetch';
import logger from '../utils/logger.js';
import { Monedas, ISO_4217 } from '../models/Monedas.js';
import { Cuentas } from '../models/Cuentas.js';
import config from '../config/config.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

class BankConnectionController extends BaseController {
  constructor() {
    super(BankConnection, {
      searchFields: ['nombre', 'banco']
    });

    this.bankSyncService = new BankSyncService();
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
    
    // Bind de los métodos al contexto de la instancia
    this.verificarConexion = this.verificarConexion.bind(this);
    this.sincronizarConexion = this.sincronizarConexion.bind(this);
    this.sincronizarTodas = this.sincronizarTodas.bind(this);
  }

  // Encriptar credenciales sensibles (Node.js moderno - usa createCipheriv)
  encrypt(text) {
    try {
      // Generar IV aleatorio de 16 bytes
      const iv = crypto.randomBytes(16);
      
      // Crear hash de la encryption key para asegurar 32 bytes
      const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
      
      // Crear cipher con IV
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      // Encriptar
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Retornar IV + encrypted (IV en los primeros 32 caracteres hex)
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Error encriptando:', error);
      throw new Error('Error al encriptar credenciales');
    }
  }

  // Desencriptar credenciales (Node.js moderno - usa createDecipheriv)
  decrypt(encryptedText) {
    try {
      // Verificar si tiene el formato nuevo (con IV)
      if (encryptedText.includes(':')) {
        // Método nuevo: separar IV y texto encriptado
        const parts = encryptedText.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        
        // Crear hash de la encryption key para asegurar 32 bytes
        const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
        
        // Crear decipher con IV
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        
        // Desencriptar
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
      } else {
        // Formato antiguo (sin IV) - solo para retrocompatibilidad
        // Este código nunca debería ejecutarse en producción nueva
        console.warn('⚠️ Detectado formato de encriptación antiguo, considera re-encriptar');
        throw new Error('Formato de encriptación antiguo no soportado. Por favor, reconecta la cuenta.');
      }
    } catch (error) {
      console.error('Error desencriptando:', error);
      throw new Error('Error al desencriptar credenciales');
    }
  }

  // Sobrescribir getAll para filtrar por usuario
  async getAll(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        sort = '-createdAt',
        search,
        filter
      } = req.query;

      const query = {
        usuario: req.user.id
      };

      if (search) {
        query.$or = this.options.searchFields.map(field => ({
          [field]: { $regex: search, $options: 'i' }
        }));
      }

      if (filter) {
        Object.assign(query, JSON.parse(filter));
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
        populate: 'cuenta'
      };

      const result = await this.Model.paginate(query, options);
      res.json(result);
    } catch (error) {
      console.error('Error en getAll:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/bankconnections/verify
  async verificarConexion(req, res) {
    try {
      const { tipo, credenciales } = req.body;

      if (!tipo || !credenciales) {
        return res.status(400).json({ 
          message: 'Tipo de conexión y credenciales son requeridos' 
        });
      }

      let resultado = { exito: false, mensaje: '' };

      switch (tipo) {
        case 'MERCADOPAGO':
          resultado = await this.verificarMercadoPago(credenciales);
          break;
        case 'PLAID':
          resultado = await this.verificarPlaid(credenciales);
          break;
        case 'OPEN_BANKING':
          resultado = await this.verificarOpenBanking(credenciales);
          break;
        case 'API_DIRECTA':
          resultado = await this.verificarAPIDirecta(credenciales);
          break;
        default:
          return res.status(400).json({ 
            message: 'Tipo de conexión no soportado' 
          });
      }

      if (resultado.exito) {
        res.json({ 
          message: 'Conexión verificada exitosamente',
          datos: resultado.datos 
        });
      } else {
        res.status(400).json({ 
          message: resultado.mensaje 
        });
      }

    } catch (error) {
      console.error('Error verificando conexión:', error);
      res.status(500).json({ 
        message: 'Error interno del servidor' 
      });
    }
  }

  // Verificar conexión con MercadoPago
  async verificarMercadoPago(credenciales) {
    try {
      // Verificar que tenemos el access token
      if (!credenciales.accessToken) {
        return {
          exito: false,
          mensaje: 'Access token de MercadoPago requerido'
        };
      }

      // Obtener información del usuario usando la API REST directamente
      const userRes = await fetch('https://api.mercadopago.com/users/me', {
        headers: { 
          'Authorization': `Bearer ${credenciales.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!userRes.ok) {
        throw new Error(`Error obteniendo información del usuario: ${userRes.status}`);
      }

      const userInfo = await userRes.json();

            // Importar el adaptador de MercadoPago
      const { MercadoPagoAdapter } = await import('../services/adapters/mercadoPagoAdapter.js');
      
      // Crear instancia del adaptador
      const mpAdapter = new MercadoPagoAdapter({
        accessToken: credenciales.accessToken,
        refreshToken: null,
        userId: null
      });

      // Obtener algunos pagos recientes para verificar el token
      const fechaDesde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const paymentsData = await mpAdapter.getMovimientos({
        since: fechaDesde.toISOString(),
        limit: 10
      });

      return {
        exito: true,
        mensaje: 'Conexión con MercadoPago verificada exitosamente',
        datos: {
          usuario: userInfo,
          pagosRecientes: paymentsData.length || 0
        }
      };
    } catch (error) {
      console.error('Error verificando MercadoPago:', error);
      return {
        exito: false,
        mensaje: 'Error verificando conexión con MercadoPago: ' + error.message
      };
    }
  }

  // Verificar conexión con Plaid (simulado)
  async verificarPlaid(credenciales) {
    // Simulación de verificación de Plaid
    return {
      exito: true,
      mensaje: 'Conexión con Plaid verificada exitosamente',
      datos: {
        institution: 'Banco Simulado',
        accounts: 1
      }
    };
  }

  // Verificar conexión con Open Banking (simulado)
  async verificarOpenBanking(credenciales) {
    // Simulación de verificación de Open Banking
    return {
      exito: true,
      mensaje: 'Conexión con Open Banking verificada exitosamente',
      datos: {
        bank: 'Banco Open Banking',
        accounts: 1
      }
    };
  }

  // Verificar conexión con API Directa (simulado)
  async verificarAPIDirecta(credenciales) {
    // Simulación de verificación de API Directa
    return {
      exito: true,
      mensaje: 'Conexión con API Directa verificada exitosamente',
      datos: {
        bank: 'Banco API Directa',
        accounts: 1
      }
    };
  }

  // POST /api/bankconnections/:id/sync
  async sincronizarConexion(req, res) {
    try {
      const { id } = req.params;
      
      const conexion = await this.Model.findOne({
        _id: id,
        usuario: req.user.id
      });

      if (!conexion) {
        return res.status(404).json({ 
          message: 'Conexión bancaria no encontrada' 
        });
      }

      const historialPedido = req.body?.mode === 'historial';
      const options = historialPedido
        ? { mode: 'historial', since: req.body?.since }
        : { mode: 'rapido' };
      const resultado = await this.bankSyncService.sincronizarConexion(conexion, options);

      if (resultado?.exito === false && resultado?.error) {
        return res.status(400).json({
          message: resultado.error,
          resultado
        });
      }

      const syncParcial = resultado?.syncParcial || resultado?.detalles?.errores?.some(
        (e) => e.tipo === 'settlement_report'
      );
      const historial = resultado?.historial;

      let message = syncParcial
        ? 'Sincronización parcial: pagos OK, movimientos incompletos. Importá CSV manual si hace falta.'
        : 'Sincronización completada';
      if (historial) {
        const objetivoTxt = historial.objetivo
          ? new Date(historial.objetivo).toLocaleDateString('es-AR', {
              timeZone: 'America/Argentina/Buenos_Aires',
            })
          : 'la fecha pedida';
        if (historial.revision?.beginDate) {
          const retirosDiag = resultado?.detalles?.retiros;
          message = historial.revision.pendiente
            ? `La validación de salidas a CBU de ${historial.revision.mesLabel} quedó pendiente (reporte en generación o cupo). Reintentá más tarde.`
            : retirosDiag?.validado
              ? `Salidas a CBU de ${historial.revision.mesLabel} validadas (${retirosDiag.conciliados}/${retirosDiag.esperados} retiros conciliados).`
              : `Se revisó ${historial.revision.mesLabel} pero sus salidas a CBU siguen sin validar${retirosDiag?.motivo ? `: ${retirosDiag.motivo}` : ''}.`;
        } else if (resultado.historialCompleto || historial.completo) {
          message = `El historial ya llega hasta el ${objetivoTxt}.`;
        } else if (historial.cuotaAgotada) {
          message = `Cupo de Mercado Pago agotado en ${historial.mesLabel}. Ese mes queda pendiente y no se crearon más reportes.`;
        } else if (historial.pendiente) {
          message = `El mes ${historial.mesLabel} quedó pendiente. Reintentá ese tramo antes de seguir hacia atrás.`;
        } else if (historial.quedaHistorial) {
          message = `Se importó ${historial.mesLabel}. Queda historial hasta el ${objetivoTxt}.`;
        } else {
          message = `Se importó ${historial.mesLabel}. El historial pedido ya está cubierto.`;
        }
      }

      res.json({
        message,
        resultado
      });

    } catch (error) {
      console.error('Error sincronizando conexión:', error);
      res.status(500).json({ 
        message: 'Error interno del servidor' 
      });
    }
  }

  // POST /api/bankconnections/sync-all (solo conexiones del usuario autenticado)
  async sincronizarTodas(req, res) {
    try {
      const resultado = await this.bankSyncService.sincronizarTodasLasConexiones(req.user.id);

      res.json({
        message: 'Sincronización de tus conexiones completada',
        resultado
      });

    } catch (error) {
      console.error('Error sincronizando todas las conexiones:', error);
      res.status(500).json({ 
        message: 'Error interno del servidor' 
      });
    }
  }

  // POST /api/bankconnections/:id/verify
  async verificarConexionPorId(req, res) {
    try {
      const { id } = req.params;

      // Verificar que la conexión existe, pertenece al usuario y es de tipo MP
      const conexion = await BankConnection.findOne({
        _id: id,
        usuario: req.user.id,
        tipo: 'MERCADOPAGO'
      });

      if (!conexion) {
        return res.status(404).json({ message: 'Conexión no encontrada' });
      }

      // Desencriptar credenciales
      const accessToken = this.decrypt(conexion.credenciales.accessToken);

      // Reutilizar verificación existente
      const resultado = await this.verificarMercadoPago({ accessToken });

      if (resultado.exito) {
        return res.json({
          message: 'Conexión verificada exitosamente',
          datos: resultado.datos
        });
      }

      return res.status(400).json({ message: resultado.mensaje });
    } catch (error) {
      console.error('Error verificando conexión por ID:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  // Sobrescribir el método create para encriptar credenciales
  async create(req, res) {
    try {
      const datosConexion = { ...req.body, usuario: req.user.id };

      // Validaciones específicas por tipo
      if (datosConexion.tipo === 'MERCADOPAGO') {
        if (!datosConexion.credenciales?.userId) {
          return res.status(400).json({ message: 'User ID de MercadoPago requerido.' });
        }
        if (!datosConexion.nombre || datosConexion.nombre.trim() === '') {
          return res.status(400).json({ message: 'El nombre de la conexión MercadoPago no puede estar vacío.' });
        }
      } else if (datosConexion.tipo !== 'MANUAL') {
        if (!datosConexion.banco) {
          return res.status(400).json({ message: 'Banco requerido.' });
        }
        if (!datosConexion.cuenta) {
          return res.status(400).json({ message: 'Cuenta requerida.' });
        }
      }

      // Encriptar credenciales sensibles
      if (datosConexion.credenciales) {
        const credencialesEncriptadas = {};
        for (const [key, value] of Object.entries(datosConexion.credenciales)) {
          if (value) {
            credencialesEncriptadas[key] = this.bankSyncService.encrypt(value);
          }
        }
        datosConexion.credenciales = credencialesEncriptadas;
      }

      const conexion = new this.Model(datosConexion);
      await conexion.save();

      // Si es MercadoPago, sincronizar inmediatamente
      if (conexion.tipo === 'MERCADOPAGO') {
        try {
          await this.bankSyncService.sincronizarConexion(conexion);
          // Recargar la conexión para devolver el estado actualizado
          await conexion.reload();
        } catch (syncError) {
          console.error('Error sincronizando MercadoPago al crear:', syncError);
        }
      }

      res.status(201).json(conexion);
    } catch (error) {
      console.error('Error creando conexión bancaria:', error);
      res.status(500).json({ 
        message: error.message 
      });
    }
  }

  // Sobrescribir el método update para encriptar credenciales
  async update(req, res) {
    try {
      const { id } = req.params;
      const datosActualizacion = { ...req.body };

      // Encriptar credenciales sensibles si se están actualizando
      if (datosActualizacion.credenciales) {
        const credencialesEncriptadas = {};
        
        for (const [key, value] of Object.entries(datosActualizacion.credenciales)) {
          if (value) {
            credencialesEncriptadas[key] = this.bankSyncService.encrypt(value);
          }
        }
        
        datosActualizacion.credenciales = credencialesEncriptadas;
      }

      const conexion = await this.Model.findOneAndUpdate(
        { _id: id, usuario: req.user.id },
        datosActualizacion,
        { new: true, runValidators: true }
      );

      if (!conexion) {
        return res.status(404).json({ 
          message: 'Conexión bancaria no encontrada' 
        });
      }

      res.json(conexion);
    } catch (error) {
      console.error('Error actualizando conexión bancaria:', error);
      res.status(500).json({ 
        message: error.message 
      });
    }
  }

  // GET /api/bankconnections/mercadopago/auth-url
  async getMercadoPagoAuthUrl(req, res) {
    try {
      const redirectUri = req.query.redirect_uri;
      if (!redirectUri) {
        return res.status(400).json({ message: 'redirect_uri es requerido' });
      }

      if (!req.session) {
        return res.status(500).json({
          message: 'Sesión no disponible; no se puede iniciar OAuth de forma segura'
        });
      }

      const { authUrl, state, codeVerifier } = getAuthUrl(redirectUri);
      const syncMode = req.query.sync_mode === 'historial' ? 'historial' : 'rapido';

      // state + redirect + PKCE verifier (servidor; no exponer al cliente)
      // El modo viaja en la sesión: al volver de Mercado Pago el navegador ya no lo tiene.
      req.session.mercadopagoState = state;
      req.session.mercadopagoRedirectUri = redirectUri;
      req.session.mercadopagoCodeVerifier = codeVerifier;
      req.session.mercadopagoSyncMode = syncMode;
      req.session.mercadopagoSyncSince = typeof req.query.sync_since === 'string' && req.query.sync_since
        ? req.query.sync_since
        : '2010-01-01';

      await new Promise((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
      });

      res.json({ authUrl, state });
    } catch (error) {
      console.error('Error generando URL de autorización MercadoPago:', error);
      res.status(500).json({ 
        message: 'Error generando URL de autorización',
        error: error.message 
      });
    }
  }

  // POST /api/bankconnections/mercadopago/callback
  async mercadoPagoCallback(req, res) {
    try {
      console.log('=== [MercadoPago] Procesando callback de OAuth ===');
      const { code, state } = req.body;
      
      console.log('📥 Code recibido:', code ? `${code.substring(0, 20)}...` : 'NO RECIBIDO');
      console.log('📥 State recibido:', state ? `${state.substring(0, 20)}...` : 'NO RECIBIDO');
      console.log('📥 Session state guardado:', req.session?.mercadopagoState ? `${req.session.mercadopagoState.substring(0, 20)}...` : 'NO HAY');
      console.log('📥 Session redirect_uri guardado:', req.session?.mercadopagoRedirectUri || 'NO HAY');
      console.log('📥 Usuario ID:', req.user?.id);
      
      if (!code) {
        console.error('❌ ERROR: Código de autorización no proporcionado');
        return res.status(400).json({ message: 'Código de autorización requerido' });
      }

      // Validar state CSRF: obligatorio (sin state en sesión = rechazar)
      const expectedState = req.session?.mercadopagoState;
      if (!expectedState || !state || state !== expectedState) {
        console.error('❌ ERROR: Validación de state falló o ausente');
        logger.error('State validation failed', null, {
          hasReceivedState: !!state,
          hasExpectedState: !!expectedState,
          userId: req.user?.id
        });
        return res.status(400).json({ message: 'Parámetro state inválido o ausente' });
      }
      
      console.log('✅ State validado correctamente');

      // redirect_uri + PKCE verifier de la sesión (mismos del auth-url)
      const redirectUri = req.session?.mercadopagoRedirectUri;
      const codeVerifier = req.session?.mercadopagoCodeVerifier;
      if (!redirectUri) {
        return res.status(400).json({
          message: 'Sesión OAuth incompleta: falta redirect_uri. Reiniciá la conexión.'
        });
      }
      if (!codeVerifier) {
        return res.status(400).json({
          message: 'Sesión OAuth incompleta: falta PKCE code_verifier. Reiniciá la conexión.'
        });
      }
      console.log('🔄 Intercambiando código por token (PKCE)...');
      console.log('🔄 Redirect URI usado:', redirectUri);
      console.log('🔄 Frontend URL config:', config.frontendUrl);

      const tokenData = await exchangeCodeForToken({ code, redirectUri, codeVerifier });
      const { access_token: accessToken, refresh_token: refreshToken, user_id: userId } = tokenData;
      
      console.log('✅ Tokens obtenidos exitosamente');
      console.log('✅ User ID de MercadoPago:', userId);
      console.log('✅ Access Token:', accessToken ? accessToken.substring(0, 20) + '...' : 'NO RECIBIDO');

      // Intentar obtener información del usuario de MercadoPago
      let userInfo = null;
      let pais = 'AR'; // Por defecto Argentina
      let nombreCuenta = `MercadoPago - Usuario ${userId}`;
      
      try {
        userInfo = await this.obtenerInformacionUsuarioMercadoPago(accessToken);
        pais = userInfo.country_id || 'AR';
        nombreCuenta = `MercadoPago - ${userInfo.nickname || userInfo.email || `Usuario ${userId}`}`;
        console.log('✅ Información del usuario obtenida exitosamente');
      } catch (error) {
        // Si falla /users/me (403), continuar con valores por defecto
        console.warn('⚠️ No se pudo obtener info del usuario, usando valores por defecto:', error.message);
        console.log('✅ Continuando con userId:', userId, 'y país por defecto:', pais);
      }
      
      // Obtener moneda asociada al país
      const moneda = await this.obtenerMonedaPorPais(pais);

      // Verificar si ya existe una cuenta de MercadoPago para este usuario con el mismo userId
      let cuenta = await Cuentas.findOne({
        usuario: req.user.id,
        tipo: 'MERCADO_PAGO',
        'mercadopago.userId': userId.toString()
      });

      if (cuenta) {
        console.log(`📌 Cuenta MercadoPago ya existe: ${cuenta._id}, actualizando información...`);
        // Actualizar información de la cuenta existente
        cuenta.nombre = nombreCuenta;
        cuenta.mercadopago = {
          userId: userId,
          email: userInfo?.email || cuenta.mercadopago?.email,
          nickname: userInfo?.nickname || cuenta.mercadopago?.nickname,
          countryId: userInfo?.country_id || pais,
          siteId: userInfo?.site_id || cuenta.mercadopago?.siteId,
          verificado: userInfo?.status?.verified || cuenta.mercadopago?.verificado || false
        };
        await cuenta.save();
      } else {
        // Crear nueva cuenta para MercadoPago con información completa
        cuenta = new Cuentas({
          nombre: nombreCuenta,
          tipo: 'MERCADO_PAGO',
          moneda: moneda._id,
          usuario: req.user.id,
          saldo: 0,
          activo: true,
          mercadopago: {
            userId: userId,
            email: userInfo?.email || null,
            nickname: userInfo?.nickname || null,
            countryId: userInfo?.country_id || pais,
            siteId: userInfo?.site_id || null,
            verificado: userInfo?.status?.verified || false
          }
        });
        await cuenta.save();
        console.log(`✅ Cuenta creada exitosamente: ${cuenta._id}`);
      }

      // Verificar si ya existe una conexión para esta cuenta
      let conexion = await BankConnection.findOne({
        usuario: req.user.id,
        tipo: 'MERCADOPAGO',
        cuenta: cuenta._id
      });

      if (conexion) {
        console.log(`📌 Conexión MercadoPago ya existe: ${conexion._id}, actualizando credenciales...`);
        // Actualizar credenciales
        conexion.credenciales = {
          accessToken: this.encrypt(accessToken),
          refreshToken: this.encrypt(refreshToken),
          userId: this.encrypt(userId.toString())
        };
        conexion.estado = 'ACTIVA';
        await conexion.save();
      } else {
        // Crear nueva conexión bancaria
        conexion = new BankConnection({
          nombre: nombreCuenta,
          tipo: 'MERCADOPAGO',
          usuario: req.user.id,
          cuenta: cuenta._id,
          credenciales: {
            accessToken: this.encrypt(accessToken),
            refreshToken: this.encrypt(refreshToken),
            userId: this.encrypt(userId.toString())
          },
          configuracion: {
            categorizacionAutomatica: true,
            sincronizacionAutomatica: true,
            sincronizacionIntervalo: 3600 // 1 hora
          },
          estado: 'ACTIVA',
          ultimaSincronizacion: new Date(),
          proximaSincronizacion: new Date(Date.now() + 3600 * 1000)
        });
        await conexion.save();
      }

      logger.info('Conexión MercadoPago creada exitosamente', {
        event: 'CONNECTION_CREATED',
        userId: req.user.id,
        mercadopagoUserId: userId,
        cuentaId: cuenta._id,
        conexionId: conexion._id
      });

      // El modo queda en la sesión desde el auth-url. Hay que leerlo antes de limpiarla.
      const historialPedido = req.session?.mercadopagoSyncMode === 'historial'
        || req.body?.mode === 'historial';
      const since = req.session?.mercadopagoSyncSince || req.body?.since || '2010-01-01';

      // Limpiar OAuth/PKCE antes de responder (el sync no debe bloquear el callback)
      if (req.session) {
        delete req.session.mercadopagoState;
        delete req.session.mercadopagoRedirectUri;
        delete req.session.mercadopagoCodeVerifier;
        delete req.session.mercadopagoSyncMode;
        delete req.session.mercadopagoSyncSince;
        await new Promise((resolve) => {
          req.session.save(() => resolve());
        });
      }

      // Sync en background: settlement puede tardar >2 min y hacía fallar el OAuth en el browser.
      const conexionId = conexion._id;
      setImmediate(async () => {
        try {
          if (!historialPedido) {
            const syncResult = await this.bankSyncService.sincronizarConexion(conexion, { mode: 'rapido' });
            console.log('✅ Sync post-OAuth completada:', {
              conexionId: String(conexionId),
              mode: 'rapido',
              nuevas: syncResult?.transaccionesNuevas || 0,
              actualizadas: syncResult?.transaccionesActualizadas || 0,
              syncParcial: syncResult?.syncParcial
            });
            return;
          }

          let current = conexion;
          const REVISIONES_POR_CORRIDA = 3;
          let revisiones = 0;
          for (let step = 0; step < 240; step += 1) {
            const before = current.mercadopago?.historial?.cubiertoHasta
              ? new Date(current.mercadopago.historial.cubiertoHasta).getTime()
              : null;
            const syncResult = await this.bankSyncService.sincronizarConexion(current, {
              mode: 'historial',
              since,
            });
            const historial = syncResult?.historial;
            const after = historial?.cubiertoHasta
              ? new Date(historial.cubiertoHasta).getTime()
              : NaN;
            console.log('✅ Sync histórica post-OAuth:', {
              conexionId: String(conexionId),
              step,
              mes: historial?.mesLabel || null,
              completo: Boolean(syncResult?.historialCompleto || historial?.completo),
              cuotaAgotada: Boolean(historial?.cuotaAgotada),
              pendiente: Boolean(historial?.pendiente),
            });
            if (!syncResult || syncResult.exito === false || syncResult.historialCompleto) break;
            if (!historial || historial.cuotaAgotada || historial.pendiente) break;
            // Una revisión de tramo sin retiros no mueve el cursor: seguir con el recorrido.
            // Cada revisión gasta un reporte MP; el resto queda para la próxima corrida.
            const revision = Boolean(historial.revision?.beginDate);
            if (revision) revisiones += 1;
            if (revisiones >= REVISIONES_POR_CORRIDA) break;
            if (!revision && historial.completo) break;
            if (!revision && (!Number.isFinite(after) || (before != null && after >= before))) break;
            current = await BankConnection.findById(conexionId);
            if (!current) break;
          }
        } catch (syncError) {
          console.error('⚠️ Sync post-OAuth falló (conexión ya guardada):', {
            conexionId: String(conexionId),
            error: syncError.message
          });
        }
      });

      res.json({
        message: 'Conexión con MercadoPago establecida exitosamente',
        conexion: {
          id: conexion._id,
          nombre: conexion.nombre,
          tipo: conexion.tipo,
          estado: conexion.estado,
          mercadopago: conexion.mercadopago
        },
        sync: {
          started: true,
          syncParcial: null,
          message: 'Sincronización iniciada en segundo plano'
        },
        cuenta: {
          id: cuenta._id,
          nombre: cuenta.nombre,
          moneda: {
            codigo: moneda.codigo,
            simbolo: moneda.simbolo
          }
        }
      });
    } catch (error) {
      console.error('Error en callback MercadoPago:', error);
      res.status(500).json({ 
        message: 'Error procesando autorización de MercadoPago',
        error: error.message 
      });
    }
  }

  // GET /api/bankconnections/mercadopago/datos-completos/:conexionId
  async obtenerDatosCompletosMercadoPago(req, res) {
    try {
      const { conexionId } = req.params;
      const { fechaDesde, limit = 100, incluirReporte = 'true' } = req.query;

      // Verificar que la conexión existe y pertenece al usuario
      const conexion = await BankConnection.findOne({
        _id: conexionId,
        usuario: req.user.id,
        tipo: 'MERCADOPAGO'
      });

      if (!conexion) {
        return res.status(404).json({ message: 'Conexión no encontrada' });
      }

      // Importar el servicio de datos completos
      const { MercadoPagoDataService } = await import('../services/mercadoPagoDataService.js');

      // Desencriptar credenciales
      const accessToken = this.decrypt(conexion.credenciales.accessToken);
      const refreshToken = this.decrypt(conexion.credenciales.refreshToken);
      const userId = this.decrypt(conexion.credenciales.userId);

      // Crear instancia del servicio
      const mpDataService = new MercadoPagoDataService({
        accessToken,
        refreshToken,
        userId,
        usuarioId: req.user.id
      });

      // Obtener datos completos
      const datosCompletos = await mpDataService.obtenerDatosCompletos({
        fechaDesde: fechaDesde || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        limit: parseInt(limit),
        incluirReporte: incluirReporte !== 'false'
      });

      res.json({
        message: 'Datos de diagnóstico obtenidos exitosamente',
        ...datosCompletos,
        resumen: {
          totalPagos: datosCompletos.pagos.length,
          totalMovimientos: datosCompletos.movimientosCuenta.length,
          totalOrdenes: 0,
          errores: datosCompletos.errores.length,
          reportePendiente: datosCompletos.reportePendiente
        },
        conexion: {
          id: conexion._id,
          syncParcial: conexion.mercadopago?.syncParcial || false,
          ultimoErrorSettlement: conexion.mercadopago?.ultimoErrorSettlement,
          reportePendiente: conexion.mercadopago?.reportePendiente
        }
      });

    } catch (error) {
      console.error('Error obteniendo datos completos de MercadoPago:', error);
      res.status(500).json({ 
        message: 'Error obteniendo datos completos',
        error: error.message 
      });
    }
  }

  // POST /api/bankconnections/mercadopago/procesar-datos/:conexionId
  // PUT /api/bankconnections/mercadopago/ancla/:conexionId
  // Carga el saldo real de un día (dinero en cuenta, reservado, invertido) como punto fijo para
  // detectar movimientos faltantes en el ledger. Devuelve la brecha contra el ledger a esa fecha.
  async setAnclaSaldoMercadoPago(req, res) {
    try {
      const { conexionId } = req.params;
      const conexion = await BankConnection.findOne({
        _id: conexionId,
        usuario: req.user.id,
        tipo: 'MERCADOPAGO'
      });
      if (!conexion) {
        return res.status(404).json({ message: 'Conexión no encontrada' });
      }

      const { normalizarAncla, calcularAnclaGap } = await import('../services/mercadoPagoAnclaService.js');
      const { ancla, error } = normalizarAncla(req.body || {});
      if (error) {
        return res.status(400).json({ message: error });
      }

      const anclaGap = await calcularAnclaGap({
        usuarioId: req.user.id,
        cuentaId: conexion.cuenta,
        ancla
      });

      const actual = conexion.mercadopago?.toObject?.() || conexion.mercadopago || {};
      conexion.mercadopago = {
        ...actual,
        anclaSaldo: ancla,
        diagnostico: {
          ...(actual.diagnostico || {}),
          ...(anclaGap ? { anclaGap } : {})
        }
      };
      await conexion.save();

      res.json({
        message: anclaGap
          ? anclaGap.ok
            ? 'Ancla guardada: el ledger coincide con el saldo real.'
            : `Ancla guardada: el ledger difiere ${anclaGap.gap} del saldo real. Probablemente falten movimientos.`
          : 'Ancla guardada; no se pudo calcular la brecha todavía.',
        anclaSaldo: ancla,
        anclaGap
      });
    } catch (error) {
      console.error('Error guardando ancla de saldo MP:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  async procesarDatosMercadoPago(req, res) {
    try {
      const { conexionId } = req.params;
      const { procesarPagos = true, procesarMovimientos = true } = req.body;

      // Verificar que la conexión existe y pertenece al usuario
      const conexion = await BankConnection.findOne({
        _id: conexionId,
        usuario: req.user.id,
        tipo: 'MERCADOPAGO'
      });

      if (!conexion) {
        return res.status(404).json({ message: 'Conexión no encontrada' });
      }

      // Importar el servicio de datos completos
      const { MercadoPagoDataService } = await import('../services/mercadoPagoDataService.js');

      // Desencriptar credenciales
      const accessToken = this.decrypt(conexion.credenciales.accessToken);
      const refreshToken = this.decrypt(conexion.credenciales.refreshToken);
      const userId = this.decrypt(conexion.credenciales.userId);

      // Crear instancia del servicio
      const mpDataService = new MercadoPagoDataService({
        accessToken,
        refreshToken,
        userId,
        usuarioId: req.user.id
      });

      // Obtener datos completos (últimos 30 días)
      const fechaDesde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const datosCompletos = await mpDataService.obtenerDatosCompletos({
        fechaDesde: fechaDesde.toISOString(),
        limit: 100,
        incluirReporte: true
      });

      const resultados = {
        pagos: { nuevas: 0, actualizadas: 0 },
        movimientos: { nuevas: 0, actualizadas: 0 },
        errores: datosCompletos.errores
      };

      // Procesar pagos si se solicita
      if (procesarPagos) {
        const resultadoPagos = await mpDataService.procesarPagos(
          datosCompletos.pagos, 
          conexion.cuenta
        );
        resultados.pagos = resultadoPagos;
      }

      // Procesar movimientos del reporte settlement (wallet AR)
      if (procesarMovimientos) {
        const cuenta = await Cuentas.findById(conexion.cuenta);
        if (datosCompletos.movimientosReporte?.length && cuenta) {
          const movResult = await this.bankSyncService.procesarMovimientosReporte(
            datosCompletos.movimientosReporte,
            conexion,
            cuenta
          );
          resultados.movimientos = {
            nuevas: movResult.nuevas,
            actualizadas: movResult.actualizadas
          };
        } else {
          const resultadoMovimientos = await mpDataService.procesarMovimientosCuenta(
            datosCompletos.movimientosCuenta, 
            conexion.cuenta
          );
          resultados.movimientos = resultadoMovimientos;
        }
      }

      // Actualizar estado de la conexión
      const totalNuevas = resultados.pagos.nuevas + resultados.movimientos.nuevas;
      const totalActualizadas = resultados.pagos.actualizadas + resultados.movimientos.actualizadas;

      await conexion.actualizarSincronizacion(
        'EXITOSA',
        totalNuevas,
        totalActualizadas
      );

      res.json({
        message: 'Datos procesados exitosamente',
        resultados,
        resumen: {
          totalNuevas,
          totalActualizadas,
          totalErrores: datosCompletos.errores.length
        }
      });

    } catch (error) {
      console.error('Error procesando datos de MercadoPago:', error);
      res.status(500).json({ 
        message: 'Error procesando datos',
        error: error.message 
      });
    }
  }

  // GET /api/bankconnections/mercadopago/sfa-status
  async getMercadoPagoSfaStatus(req, res) {
    try {
      const { getSfaMonitorStatus } = await import('../services/sfaMonitorService.js');
      const status = await getSfaMonitorStatus();
      res.json({
        message: 'Estado Open Finance Argentina (SFA)',
        ...status
      });
    } catch (error) {
      console.error('Error obteniendo estado SFA:', error);
      res.status(500).json({
        message: 'Error obteniendo estado SFA',
        error: error.message
      });
    }
  }

  // POST /api/bankconnections/mercadopago/importar-csv/:conexionId
  async importarCsvMercadoPago(req, res) {
    try {
      const { conexionId } = req.params;
      const { csvContent } = req.body;

      if (!csvContent || typeof csvContent !== 'string') {
        return res.status(400).json({ message: 'csvContent es requerido (texto del reporte CSV)' });
      }

      const conexion = await BankConnection.findOne({
        _id: conexionId,
        usuario: req.user.id,
        tipo: 'MERCADOPAGO'
      });

      if (!conexion) {
        return res.status(404).json({ message: 'Conexión MercadoPago no encontrada' });
      }

      const resultado = await this.bankSyncService.importarCsvMercadoPago(conexion, csvContent);

      res.json({
        success: true,
        message: 'CSV importado exitosamente',
        ...resultado
      });
    } catch (error) {
      console.error('Error importando CSV MercadoPago:', error);
      res.status(500).json({
        message: 'Error importando CSV',
        error: error.message
      });
    }
  }

  /**
   * Crea una preferencia de pago de prueba usando la API REST de MercadoPago
   */
  async pagoPrueba(req, res) {
    try {
      const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || config.mercadopago.accessToken;
      
      if (!accessToken) {
        throw new Error('MERCADOPAGO_ACCESS_TOKEN no está configurado');
      }

      const preferenceData = {
        items: [
          {
            title: 'Pago de prueba - Validación app MercadoPago',
            quantity: 1,
            unit_price: 10.00
          }
        ],
        back_urls: {
          success: `${config.frontendUrl}/pago-exitoso`,
          failure: `${config.frontendUrl}/pago-fallido`,
          pending: `${config.frontendUrl}/pago-pendiente`
        },
        auto_return: 'approved'
      };

      console.log('Creando preferencia de pago:', preferenceData);

      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferenceData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`Error de MercadoPago: ${result.message || 'Error desconocido'}`);
      }

      console.log('Preferencia de pago creada:', result.id);

      res.json({
        success: true,
        init_point: result.init_point,
        sandbox_init_point: result.sandbox_init_point,
        preference_id: result.id,
        message: 'Preferencia creada exitosamente'
      });
    } catch (error) {
      console.error('Error creando preferencia de pago:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Error al crear preferencia de pago',
        details: {
          accessTokenConfigured: !!process.env.MERCADOPAGO_ACCESS_TOKEN,
          configAccessToken: !!config.mercadopago.accessToken
        }
      });
    }
  }

  /**
   * Endpoint de prueba simple para diagnosticar problemas
   */
  async pagoPruebaSimple(req, res) {
    try {
      console.log('=== DIAGNÓSTICO MERCADOPAGO ===');
      
      // Verificar variables de entorno
      const envVars = {
        MERCADOPAGO_ACCESS_TOKEN: !!process.env.MERCADOPAGO_ACCESS_TOKEN,
        MERCADOPAGO_PUBLIC_KEY: !!process.env.MERCADOPAGO_PUBLIC_KEY,
        MERCADOPAGO_CLIENT_ID: !!process.env.MERCADOPAGO_CLIENT_ID,
        MERCADOPAGO_CLIENT_SECRET: !!process.env.MERCADOPAGO_CLIENT_SECRET,
        NODE_ENV: process.env.NODE_ENV,
        configAccessToken: !!config.mercadopago.accessToken,
        configClientId: !!config.mercadopago.clientId
      };
      
      console.log('Variables de entorno:', envVars);
      
      // Verificar configuración
      console.log('Configuración MercadoPago:', {
        clientId: config.mercadopago.clientId,
        accessToken: config.mercadopago.accessToken ? 'CONFIGURADO' : 'NO CONFIGURADO',
        publicKey: config.mercadopago.publicKey
      });
      
      // Usar API REST directa
      try {
        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || config.mercadopago.accessToken;
        
        if (!accessToken) {
          throw new Error('No se encontró MERCADOPAGO_ACCESS_TOKEN');
        }
        
        console.log('Access token encontrado:', accessToken.substring(0, 20) + '...');
        
        const preferenceData = {
          items: [
            {
              title: 'Pago de prueba - Validación app MercadoPago',
              quantity: 1,
              unit_price: 10.00
            }
          ]
        };
        
        console.log('Enviando datos a API REST:', JSON.stringify(preferenceData, null, 2));
        
        const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(preferenceData)
        });

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(`Error de MercadoPago: ${result.message || 'Error desconocido'}`);
        }
        
        console.log('Preferencia creada exitosamente:', result.id);
        
        res.json({
          success: true,
          init_point: result.init_point,
          sandbox_init_point: result.sandbox_init_point,
          preference_id: result.id,
          message: 'Preferencia creada exitosamente',
          envVars
        });
        
      } catch (apiError) {
        console.error('Error con API REST de MercadoPago:', apiError);
        res.status(500).json({
          success: false,
          error: apiError.message,
          message: 'Error con MercadoPago',
          envVars,
          stack: config.isDev ? apiError.stack : undefined
        });
      }
      
    } catch (error) {
      console.error('Error en pagoPruebaSimple:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Error interno del servidor',
        stack: config.isDev ? error.stack : undefined
      });
    }
  }

  /**
   * Endpoint para probar permisos de un token de usuario
   */
  async probarTokenUsuario(req, res) {
    try {
      const { accessToken } = req.body;
      
      if (!accessToken) {
        return res.status(400).json({ 
          error: 'Access token requerido' 
        });
      }

      console.log('=== PRUEBA DE PERMISOS DE TOKEN ===');
      console.log('Token recibido:', accessToken.substring(0, 20) + '...');

      const resultados = {};

      // 1. Probar /users/me
      try {
        const userRes = await fetch('https://api.mercadopago.com/users/me', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'PresentApp/1.0'
          }
        });

        if (userRes.ok) {
          const userInfo = await userRes.json();
          resultados.users_me = {
            success: true,
            data: {
              id: userInfo.id,
              nickname: userInfo.nickname,
              email: userInfo.email,
              country_id: userInfo.country_id
            }
          };
        } else {
          const errorText = await userRes.text();
          resultados.users_me = {
            success: false,
            status: userRes.status,
            error: errorText
          };
        }
      } catch (error) {
        resultados.users_me = {
          success: false,
          error: error.message
        };
      }

      // 2. Probar /v1/payments/search (collector + payer)
      try {
        const userId = resultados.users_me?.data?.id;
        const headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Attadia/1.0'
        };

        const collectorRes = await fetch(
          `https://api.mercadopago.com/v1/payments/search?limit=1&collector.id=${userId}`,
          { headers }
        );
        const payerRes = await fetch(
          `https://api.mercadopago.com/v1/payments/search?limit=1&payer.id=${userId}`,
          { headers }
        );

        resultados.payments_search_collector = {
          success: collectorRes.ok,
          status: collectorRes.status,
          total: collectorRes.ok ? (await collectorRes.json()).paging?.total : null
        };
        resultados.payments_search_payer = {
          success: payerRes.ok,
          status: payerRes.status,
          total: payerRes.ok ? (await payerRes.json()).paging?.total : null
        };
      } catch (error) {
        resultados.payments_search = {
          success: false,
          error: error.message
        };
      }

      // 3. Probar settlement_report/list
      try {
        const settlementRes = await fetch('https://api.mercadopago.com/v1/account/settlement_report/list', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Attadia/1.0'
          }
        });

        if (settlementRes.ok) {
          const settlementData = await settlementRes.json();
          const reports = Array.isArray(settlementData) ? settlementData : (settlementData.results || []);
          resultados.settlement_report = {
            success: true,
            total: reports.length,
            latest: reports[0]?.file_name
          };
        } else {
          const errorText = await settlementRes.text();
          resultados.settlement_report = {
            success: false,
            status: settlementRes.status,
            error: errorText
          };
        }
      } catch (error) {
        resultados.settlement_report = {
          success: false,
          error: error.message
        };
      }

      // 4. Probar balance (puede fallar 403 en cuentas personales)
      try {
        const userId = resultados.users_me?.data?.id;
        const balanceRes = await fetch(
          `https://api.mercadopago.com/users/${userId}/mercadopago_account/balance`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'User-Agent': 'Attadia/1.0'
            }
          }
        );

        if (balanceRes.ok) {
          resultados.balance = { success: true, data: await balanceRes.json() };
        } else {
          resultados.balance = {
            success: false,
            status: balanceRes.status,
            error: await balanceRes.text()
          };
        }
      } catch (error) {
        resultados.balance = { success: false, error: error.message };
      }

      // Legacy: checkout preferences (requiere scope write, omitido en wallet mode)
      resultados.preferences = { skipped: true, reason: 'Wallet mode: scope write removido' };

      console.log('Resultados de prueba de permisos:', resultados);

      res.json({
        success: true,
        resultados,
        resumen: {
          users_me: resultados.users_me?.success ? 'OK' : 'ERROR',
          payments_collector: resultados.payments_search_collector?.success ? 'OK' : 'ERROR',
          payments_payer: resultados.payments_search_payer?.success ? 'OK' : 'ERROR',
          settlement_report: resultados.settlement_report?.success ? 'OK' : 'ERROR',
          balance: resultados.balance?.success ? 'OK' : 'ERROR'
        }
      });

    } catch (error) {
      console.error('Error en probarTokenUsuario:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Método para obtener información del usuario de MercadoPago
  async obtenerInformacionUsuarioMercadoPago(accessToken) {
    try {
      console.log('Obteniendo información del usuario MercadoPago...');
      
      const response = await fetch('https://api.mercadopago.com/users/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'PresentApp/1.0'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response from MercadoPago /users/me:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText,
          accessToken: accessToken ? accessToken.substring(0, 20) + '...' : 'no token'
        });
        
        // Manejar errores específicos
        if (response.status === 401) {
          throw new Error('Token de acceso expirado o inválido');
        } else if (response.status === 403) {
          throw new Error('Acceso denegado - el token no tiene permisos para acceder a /users/me. Verificar scopes en OAuth');
        } else if (response.status === 429) {
          throw new Error('Rate limit excedido - intentar más tarde');
        }
        
        throw new Error(`Error obteniendo información del usuario de MercadoPago: ${response.status} - ${errorText}`);
      }
      
      const userInfo = await response.json();
      console.log('Información del usuario obtenida:', {
        id: userInfo.id,
        nickname: userInfo.nickname,
        email: userInfo.email,
        country_id: userInfo.country_id
      });
      
      return userInfo;
    } catch (error) {
      console.error('Error en obtenerInformacionUsuarioMercadoPago:', error);
      throw error;
    }
  }

  // Método para obtener moneda por país
  async obtenerMonedaPorPais(pais) {
    try {
      // Mapeo de países a códigos de moneda ISO 4217
      const mapeoPaisMoneda = {
        'AR': 'ARS', // Argentina - Peso Argentino
        'BR': 'BRL', // Brasil - Real Brasileño
        'CL': 'CLP', // Chile - Peso Chileno
        'CO': 'COP', // Colombia - Peso Colombiano
        'MX': 'MXN', // México - Peso Mexicano
        'PE': 'PEN', // Perú - Sol Peruano
        'UY': 'UYU', // Uruguay - Peso Uruguayo
        'PY': 'PYG', // Paraguay - Guaraní
        'BO': 'BOB', // Bolivia - Boliviano
        'EC': 'USD', // Ecuador - Dólar Estadounidense
        'VE': 'VES', // Venezuela - Bolívar Soberano
        'GT': 'GTQ', // Guatemala - Quetzal
        'SV': 'USD', // El Salvador - Dólar Estadounidense
        'HN': 'HNL', // Honduras - Lempira
        'NI': 'NIO', // Nicaragua - Córdoba
        'CR': 'CRC', // Costa Rica - Colón Costarricense
        'PA': 'PAB', // Panamá - Balboa
        'DO': 'DOP', // República Dominicana - Peso Dominicano
        'CU': 'CUP', // Cuba - Peso Cubano
        'JM': 'JMD', // Jamaica - Dólar Jamaiquino
        'TT': 'TTD', // Trinidad y Tobago - Dólar de Trinidad y Tobago
        'BB': 'BBD', // Barbados - Dólar de Barbados
        'GD': 'XCD', // Granada - Dólar del Caribe Oriental
        'LC': 'XCD', // Santa Lucía - Dólar del Caribe Oriental
        'VC': 'XCD', // San Vicente y las Granadinas - Dólar del Caribe Oriental
        'AG': 'XCD', // Antigua y Barbuda - Dólar del Caribe Oriental
        'KN': 'XCD', // San Cristóbal y Nieves - Dólar del Caribe Oriental
        'DM': 'XCD', // Dominica - Dólar del Caribe Oriental
        'US': 'USD', // Estados Unidos - Dólar Estadounidense
        'CA': 'CAD', // Canadá - Dólar Canadiense
        'ES': 'EUR', // España - Euro
        'FR': 'EUR', // Francia - Euro
        'DE': 'EUR', // Alemania - Euro
        'IT': 'EUR', // Italia - Euro
        'PT': 'EUR', // Portugal - Euro
        'GB': 'GBP', // Reino Unido - Libra Esterlina
        'JP': 'JPY', // Japón - Yen Japonés
        'CN': 'CNY', // China - Yuan Chino
        'IN': 'INR', // India - Rupia India
        'AU': 'AUD', // Australia - Dólar Australiano
        'NZ': 'NZD', // Nueva Zelanda - Dólar Neozelandés
        'ZA': 'ZAR', // Sudáfrica - Rand Sudafricano
        'RU': 'RUB', // Rusia - Rublo Ruso
        'KR': 'KRW', // Corea del Sur - Won Surcoreano
        'SG': 'SGD', // Singapur - Dólar de Singapur
        'HK': 'HKD', // Hong Kong - Dólar de Hong Kong
        'TW': 'TWD', // Taiwán - Dólar de Taiwán
        'TH': 'THB', // Tailandia - Baht Tailandés
        'MY': 'MYR', // Malasia - Ringgit Malayo
        'ID': 'IDR', // Indonesia - Rupia Indonesia
        'PH': 'PHP', // Filipinas - Peso Filipino
        'VN': 'VND', // Vietnam - Dong Vietnamita
        'AE': 'AED', // Emiratos Árabes Unidos - Dírham
        'SA': 'SAR', // Arabia Saudita - Riyal Saudí
        'IL': 'ILS', // Israel - Nuevo Séquel
        'TR': 'TRY', // Turquía - Lira Turca
        'EG': 'EGP', // Egipto - Libra Egipcia
        'NG': 'NGN', // Nigeria - Naira Nigeriana
        'KE': 'KES', // Kenia - Chelín Keniano
        'GH': 'GHS', // Ghana - Cedi Ghanés
        'MA': 'MAD', // Marruecos - Dírham Marroquí
        'TN': 'TND', // Túnez - Dinar Tunecino
        'DZ': 'DZD', // Argelia - Dinar Argelino
        'LY': 'LYD', // Libia - Dinar Libio
        'SD': 'SDG', // Sudán - Libra Sudanesa
        'ET': 'ETB', // Etiopía - Birr Etíope
        'UG': 'UGX', // Uganda - Chelín Ugandés
        'TZ': 'TZS', // Tanzania - Chelín Tanzano
        'ZM': 'ZMW', // Zambia - Kwacha Zambiano
        'ZW': 'ZWL', // Zimbabue - Dólar de Zimbabue
        'BW': 'BWP', // Botsuana - Pula
        'NA': 'NAD', // Namibia - Dólar Namibio
        'SZ': 'SZL', // Suazilandia - Lilangeni
        'LS': 'LSL', // Lesoto - Loti
        'MG': 'MGA', // Madagascar - Ariary
        'MU': 'MUR', // Mauricio - Rupia Mauriciana
        'SC': 'SCR', // Seychelles - Rupia de Seychelles
        'KM': 'KMF', // Comoras - Franco Comorense
        'DJ': 'DJF', // Yibuti - Franco de Yibuti
        'SO': 'SOS', // Somalia - Chelín Somalí
        'ER': 'ERN', // Eritrea - Nakfa
        'SS': 'SSP', // Sudán del Sur - Libra Sursudanesa
        'CF': 'XAF', // República Centroafricana - Franco CFA
        'TD': 'XAF', // Chad - Franco CFA
        'CM': 'XAF', // Camerún - Franco CFA
        'CG': 'XAF', // República del Congo - Franco CFA
        'GA': 'XAF', // Gabón - Franco CFA
        'GQ': 'XAF', // Guinea Ecuatorial - Franco CFA
        'NE': 'XAF', // Níger - Franco CFA
        'BF': 'XAF', // Burkina Faso - Franco CFA
        'ML': 'XAF', // Malí - Franco CFA
        'SN': 'XAF', // Senegal - Franco CFA
        'GN': 'GNF', // Guinea - Franco Guineano
        'SL': 'SLL', // Sierra Leona - Leona
        'LR': 'LRD', // Liberia - Dólar Liberiano
        'CI': 'XOF', // Costa de Marfil - Franco CFA
        'BJ': 'XOF', // Benín - Franco CFA
        'TG': 'XOF', // Togo - Franco CFA
        'GW': 'XOF', // Guinea-Bisáu - Franco CFA
        'MR': 'MRO', // Mauritania - Ouguiya
        'CV': 'CVE', // Cabo Verde - Escudo Caboverdiano
        'GM': 'GMD', // Gambia - Dalasi
        'ST': 'STD', // Santo Tomé y Príncipe - Dobra
        'AO': 'AOA', // Angola - Kwanza
        'MZ': 'MZN', // Mozambique - Metical
        'MW': 'MWK', // Malawi - Kwacha Malauí
        'RW': 'RWF', // Ruanda - Franco Ruandés
        'BI': 'BIF', // Burundi - Franco Burundés
        'CD': 'CDF', // República Democrática del Congo - Franco Congoleño
      };

      const codigoMoneda = mapeoPaisMoneda[pais] || 'USD'; // Por defecto USD

      // Buscar la moneda en la base de datos
      let moneda = await Monedas.findOne({ codigo: codigoMoneda });
      
      if (!moneda) {
        // Si no existe, crear la moneda por defecto
        moneda = new Monedas({
          codigo: codigoMoneda,
          nombre: this.obtenerNombreMoneda(codigoMoneda),
          simbolo: this.obtenerSimboloMoneda(codigoMoneda),
          pais: pais,
          activa: true
        });
        await moneda.save();
      }

      return moneda;
    } catch (error) {
      console.error('Error obteniendo moneda por país:', error);
      // En caso de error, devolver moneda por defecto (USD)
      let monedaDefault = await Monedas.findOne({ codigo: 'USD' });
      if (!monedaDefault) {
        monedaDefault = new Monedas({
          codigo: 'USD',
          nombre: 'Dólar Estadounidense',
          simbolo: '$',
          pais: 'US',
          activa: true
        });
        await monedaDefault.save();
      }
      return monedaDefault;
    }
  }

  // Método helper para obtener nombre de moneda
  obtenerNombreMoneda(codigo) {
    const nombres = {
      'ARS': 'Peso Argentino',
      'BRL': 'Real Brasileño',
      'CLP': 'Peso Chileno',
      'COP': 'Peso Colombiano',
      'MXN': 'Peso Mexicano',
      'PEN': 'Sol Peruano',
      'UYU': 'Peso Uruguayo',
      'PYG': 'Guaraní',
      'BOB': 'Boliviano',
      'USD': 'Dólar Estadounidense',
      'VES': 'Bolívar Soberano',
      'GTQ': 'Quetzal',
      'HNL': 'Lempira',
      'NIO': 'Córdoba',
      'CRC': 'Colón Costarricense',
      'PAB': 'Balboa',
      'DOP': 'Peso Dominicano',
      'CUP': 'Peso Cubano',
      'JMD': 'Dólar Jamaiquino',
      'TTD': 'Dólar de Trinidad y Tobago',
      'BBD': 'Dólar de Barbados',
      'XCD': 'Dólar del Caribe Oriental',
      'CAD': 'Dólar Canadiense',
      'EUR': 'Euro',
      'GBP': 'Libra Esterlina',
      'JPY': 'Yen Japonés',
      'CNY': 'Yuan Chino',
      'INR': 'Rupia India',
      'AUD': 'Dólar Australiano',
      'NZD': 'Dólar Neozelandés',
      'ZAR': 'Rand Sudafricano',
      'RUB': 'Rublo Ruso',
      'KRW': 'Won Surcoreano',
      'SGD': 'Dólar de Singapur',
      'HKD': 'Dólar de Hong Kong',
      'TWD': 'Dólar de Taiwán',
      'THB': 'Baht Tailandés',
      'MYR': 'Ringgit Malayo',
      'IDR': 'Rupia Indonesia',
      'PHP': 'Peso Filipino',
      'VND': 'Dong Vietnamita',
      'AED': 'Dírham',
      'SAR': 'Riyal Saudí',
      'ILS': 'Nuevo Séquel',
      'TRY': 'Lira Turca',
      'EGP': 'Libra Egipcia',
      'NGN': 'Naira Nigeriana',
      'KES': 'Chelín Keniano',
      'GHS': 'Cedi Ghanés',
      'MAD': 'Dírham Marroquí',
      'TND': 'Dinar Tunecino',
      'DZD': 'Dinar Argelino',
      'LYD': 'Dinar Libio',
      'SDG': 'Libra Sudanesa',
      'ETB': 'Birr Etíope',
      'UGX': 'Chelín Ugandés',
      'TZS': 'Chelín Tanzano',
      'ZMW': 'Kwacha Zambiano',
      'ZWL': 'Dólar de Zimbabue',
      'BWP': 'Pula',
      'NAD': 'Dólar Namibio',
      'SZL': 'Lilangeni',
      'LSL': 'Loti',
      'MGA': 'Ariary',
      'MUR': 'Rupia Mauriciana',
      'SCR': 'Rupia de Seychelles',
      'KMF': 'Franco Comorense',
      'DJF': 'Franco de Yibuti',
      'SOS': 'Chelín Somalí',
      'ERN': 'Nakfa',
      'SSP': 'Libra Sursudanesa',
      'XAF': 'Franco CFA',
      'GNF': 'Franco Guineano',
      'SLL': 'Leona',
      'LRD': 'Dólar Liberiano',
      'XOF': 'Franco CFA',
      'MRO': 'Ouguiya',
      'CVE': 'Escudo Caboverdiano',
      'GMD': 'Dalasi',
      'STD': 'Dobra',
      'AOA': 'Kwanza',
      'MZN': 'Metical',
      'MWK': 'Kwacha Malauí',
      'RWF': 'Franco Ruandés',
      'BIF': 'Franco Burundés',
      'CDF': 'Franco Congoleño'
    };
    return nombres[codigo] || 'Moneda Desconocida';
  }

  // Método helper para obtener símbolo de moneda
  obtenerSimboloMoneda(codigo) {
    const simbolos = {
      'ARS': '$',
      'BRL': 'R$',
      'CLP': '$',
      'COP': '$',
      'MXN': '$',
      'PEN': 'S/',
      'UYU': '$',
      'PYG': '₲',
      'BOB': 'Bs',
      'USD': '$',
      'VES': 'Bs',
      'GTQ': 'Q',
      'HNL': 'L',
      'NIO': 'C$',
      'CRC': '₡',
      'PAB': 'B/.',
      'DOP': 'RD$',
      'CUP': '$',
      'JMD': 'J$',
      'TTD': 'TT$',
      'BBD': 'Bds$',
      'XCD': 'EC$',
      'CAD': 'C$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CNY': '¥',
      'INR': '₹',
      'AUD': 'A$',
      'NZD': 'NZ$',
      'ZAR': 'R',
      'RUB': '₽',
      'KRW': '₩',
      'SGD': 'S$',
      'HKD': 'HK$',
      'TWD': 'NT$',
      'THB': '฿',
      'MYR': 'RM',
      'IDR': 'Rp',
      'PHP': '₱',
      'VND': '₫',
      'AED': 'د.إ',
      'SAR': 'ر.س',
      'ILS': '₪',
      'TRY': '₺',
      'EGP': 'E£',
      'NGN': '₦',
      'KES': 'KSh',
      'GHS': 'GH₵',
      'MAD': 'د.م.',
      'TND': 'د.ت',
      'DZD': 'د.ج',
      'LYD': 'ل.د',
      'SDG': 'ج.س.',
      'ETB': 'Br',
      'UGX': 'USh',
      'TZS': 'TSh',
      'ZMW': 'ZK',
      'ZWL': 'Z$',
      'BWP': 'P',
      'NAD': 'N$',
      'SZL': 'E',
      'LSL': 'L',
      'MGA': 'Ar',
      'MUR': '₨',
      'SCR': '₨',
      'KMF': 'CF',
      'DJF': 'Fdj',
      'SOS': 'S',
      'ERN': 'Nfk',
      'SSP': 'SSP',
      'XAF': 'FCFA',
      'GNF': 'FG',
      'SLL': 'Le',
      'LRD': 'L$',
      'XOF': 'CFA',
      'MRO': 'UM',
      'CVE': 'Esc',
      'GMD': 'D',
      'STD': 'Db',
      'AOA': 'Kz',
      'MZN': 'MT',
      'MWK': 'MK',
      'RWF': 'FRw',
      'BIF': 'FBu',
      'CDF': 'FC'
    };
    return simbolos[codigo] || '$';
  }
}

export default BankConnectionController; 