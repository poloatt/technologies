import { Users } from '../models/index.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import { initializeSampleData } from '../config/initData.js';
import {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
} from '../utils/authCookies.js';

const generateTokens = (user) => {
  const now = Math.floor(Date.now() / 1000);
  
  // Asegurarnos de que tenemos todos los campos necesarios del usuario
  const userInfo = {
    id: user._id.toString(),
    email: user.email,
    nombre: user.nombre,
    role: user.role,
    googleId: user.googleId,
    activo: user.activo
  };

  const payload = {
    user: userInfo,  // Incluir toda la información del usuario
    exp: now + (24 * 60 * 60), // 24 horas
    iat: now,
    type: 'access'
  };

  // Solo loggear en desarrollo
  if (process.env.NODE_ENV === 'development') {
    console.log('Generando token con payload:', {
      userId: userInfo.id,
      email: userInfo.email,
      jwtSecret: config.jwtSecret ? 'configurado' : 'no configurado'
    });
  }

  const refreshPayload = {
    user: { id: userInfo.id },  // Solo incluir el ID para el refresh token
    exp: now + (7 * 24 * 60 * 60), // 7 días
    iat: now,
    type: 'refresh'
  };

  const token = jwt.sign(payload, config.jwtSecret);
  const refreshToken = jwt.sign(refreshPayload, config.refreshTokenSecret);

  // Solo loggear en desarrollo
  if (process.env.NODE_ENV === 'development') {
    console.log('Tokens generados exitosamente');
  }
  
  return { token, refreshToken };
};

export const authController = {
  register: async (req, res) => {
    try {
      const { nombre, email, password, pais } = req.body;

      // Validación de campos
      if (!nombre || !email || !password) {
        return res.status(400).json({ 
          error: 'Todos los campos son requeridos',
          details: {
            nombre: !nombre ? 'El nombre es requerido' : null,
            email: !email ? 'El email es requerido' : null,
            password: !password ? 'La contraseña es requerida' : null
          }
        });
      }

      // Verificar si el usuario ya existe
      let user = await Users.findOne({ email });
      if (user) {
        return res.status(400).json({ error: 'El usuario ya existe' });
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Formato de email inválido' });
      }

      // Validar contraseña
      if (password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
      }

      // Encriptar contraseña
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Crear usuario
      user = await Users.create({
        nombre,
        email,
        password: hashedPassword,
        role: 'USER',
        pais: pais || 'AR'
      });

      // Inicializar datos de ejemplo para el nuevo usuario de forma asíncrona
      if (process.env.NODE_ENV === 'development') {
        console.log('Inicializando datos de ejemplo para nuevo usuario:', user._id);
      }
      // Ejecutar en background para no bloquear la respuesta
      setImmediate(async () => {
        try {
          await initializeSampleData(user._id);
        } catch (error) {
          console.error('Error al inicializar datos de ejemplo:', error);
        }
      });

      // Generar tokens
      const { token, refreshToken } = generateTokens(user);

      setRefreshTokenCookie(res, refreshToken);

      res.json({ token, refreshToken });
    } catch (error) {
      console.error('Error en registro:', error);
      res.status(500).json({ error: 'Error en el registro' });
    }
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      // Validación de campos
      if (!email || !password) {
        return res.status(400).json({ 
          error: 'Todos los campos son requeridos',
          details: {
            email: !email ? 'El email es requerido' : null,
            password: !password ? 'La contraseña es requerida' : null
          }
        });
      }

      // Verificar si el usuario existe
      const user = await Users.findOne({ email });
      if (!user) {
        return res.status(400).json({ error: 'Credenciales inválidas' });
      }

      // Verificar contraseña
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Credenciales inválidas' });
      }

      // Generar tokens
      const { token, refreshToken } = generateTokens(user);

      // Preparar datos del usuario para enviar al frontend
      const userData = {
        id: user._id.toString(),
        email: user.email,
        nombre: user.nombre,
        role: user.role,
        googleId: user.googleId,
        activo: user.activo
      };

      // Solo loggear en desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.log('🔐 BACKEND LOGIN RESPONSE:', {
          token: token ? 'presente' : 'ausente',
          refreshToken: refreshToken ? 'presente' : 'ausente',
          userId: userData.id
        });
      }

      setRefreshTokenCookie(res, refreshToken);

      res.json({ 
        token, 
        refreshToken, 
        user: userData 
      });
    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({ error: 'Error en el login' });
    }
  },

  refreshToken: async (req, res) => {
    try {
      const oldRefreshToken = getRefreshTokenFromRequest(req);

      if (!oldRefreshToken) {
        return res.status(401).json({ error: 'Refresh token no proporcionado' });
      }

      // Verificar refresh token
      const decoded = jwt.verify(oldRefreshToken, config.refreshTokenSecret);
      const user = await Users.findById(decoded.user.id);

      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      if (!user.activo) {
        return res.status(401).json({ error: 'Usuario inactivo' });
      }

      // Generar nuevos tokens
      const { token, refreshToken: newRefreshToken } = generateTokens(user);
      
      // Preparar datos del usuario para enviar al frontend
      const userData = {
        id: user._id.toString(),
        email: user.email,
        nombre: user.nombre,
        role: user.role,
        googleId: user.googleId,
        activo: user.activo
      };

      setRefreshTokenCookie(res, newRefreshToken);

      res.json({ 
        token, 
        refreshToken: newRefreshToken, 
        user: userData 
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Refresh token expirado' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Refresh token inválido' });
      }
      console.error('Error en refresh token:', error);
      res.status(500).json({ error: 'Error al refrescar el token' });
    }
  },

  logout: async (req, res) => {
    try {
      clearRefreshTokenCookie(res);
      res.json({ message: 'Sesión cerrada correctamente' });
    } catch (error) {
      console.error('Error en logout:', error);
      res.status(500).json({ error: 'Error al cerrar sesión' });
    }
  },

  check: async (req, res) => {
    try {
      // Solo loggear en desarrollo
      const shouldLog = process.env.NODE_ENV === 'development';
      
      if (shouldLog) {
        console.log('Check de autenticación:', {
          user: req.user ? {
            id: req.user._id || req.user.id,
            email: req.user.email
          } : null
        });
      }

      if (!req.user) {
        if (shouldLog) {
          console.log('No hay usuario en la request - token inválido o expirado');
        }
        return res.json({ 
          authenticated: false,
          error: 'No hay usuario autenticado'
        });
      }

      // Obtener el ID del usuario del token
      const userId = req.user.id || req.user._id;
      
      // Optimizar consulta - solo obtener campos necesarios
      const user = await Users.findById(userId)
        .select('nombre email role googleId activo preferences lastLogin createdAt updatedAt telefono')
        .lean();

      if (!user) {
        if (shouldLog) {
          console.log('Usuario no encontrado en la base de datos');
        }
        return res.json({ 
          authenticated: false,
          error: 'Usuario no encontrado en la base de datos'
        });
      }

      if (!user.activo) {
        if (shouldLog) {
          console.log('Usuario inactivo:', user.email);
        }
        return res.json({ 
          authenticated: false,
          error: 'Usuario inactivo'
        });
      }

      if (shouldLog) {
        console.log('Usuario autenticado exitosamente:', user._id);
      }

      // Respuesta optimizada
      res.json({
        authenticated: true,
        user: {
          id: user._id.toString(),
          nombre: user.nombre,
          email: user.email,
          role: user.role,
          googleId: user.googleId,
          preferences: user.preferences || {},
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          telefono: user.telefono,
          activo: user.activo
        }
      });
    } catch (error) {
      console.error('Error en check:', error.message);
      res.status(500).json({ 
        authenticated: false,
        error: 'Error al verificar la autenticación'
      });
    }
  },

  googleCallback: async (req, res) => {
    // Helper para obtener callback origin de forma segura en caso de error
    // Definido fuera del try-catch para que esté disponible en ambos bloques
    const getSafeCallbackOrigin = () => {
      try {
        if (req.session?.googleCallbackOrigin) {
          return req.session.googleCallbackOrigin;
        }
      } catch (e) {
        // Ignorar errores de sesión
      }
      
      // Intentar desde state
      if (req.query?.state) {
        try {
          const decoded = JSON.parse(Buffer.from(req.query.state, 'base64').toString('utf8'));
          if (decoded?.origin) {
            return decoded.origin;
          }
        } catch (e) {
          // Ignorar errores de parsing
        }
      }
      
      return config.frontendUrl;
    };

    try {
      console.log('Iniciando callback de Google con datos:', {
        user: req.user ? {
          id: req.user._id,
          email: req.user.email,
          nombre: req.user.nombre
        } : null
      });

      if (!req.user) {
        console.error('No se recibió información del usuario');
        return res.redirect(`${config.frontendUrl}/auth/callback?error=no_user_info`);
      }

      // Obtener país del perfil de Google, sesión o body (si está disponible)
      // Proteger acceso a sesión para evitar crashes en PWA
      let pais = req.body?.pais || req.user.pais || 'AR';
      try {
        if (req.session?.pais) {
          pais = req.session.pais;
        }
      } catch (sessionError) {
        // Ignorar errores de sesión - usar valor por defecto
        if (config.env === 'development') {
          console.warn('⚠️ Error al leer país de sesión:', sessionError.message);
        }
      }
      // Si el usuario ya existe, actualizar el país si es necesario
      if (req.user && req.user._id) {
        const userDoc = await Users.findById(req.user._id);
        if (userDoc && userDoc.pais !== pais) {
          userDoc.pais = pais;
          await userDoc.save();
        }
      }

      // Generar tokens
      const { token, refreshToken } = generateTokens(req.user);

      // Detección automática del origen - prioridad: state > sesión > referer > configuración
      let callbackOrigin = null;

      // 0. Prioridad máxima: parámetro state (contiene origin codificado)
      // Este es el más confiable porque funciona incluso si las sesiones fallan
      if (req.query?.state) {
        try {
          const decoded = JSON.parse(Buffer.from(req.query.state, 'base64').toString('utf8'));
          if (decoded?.origin) {
            callbackOrigin = decoded.origin;
            console.log(`🔍 Usando origen desde state: ${callbackOrigin}`);
          }
        } catch (e) {
          console.warn('State inválido en callback de Google:', e.message);
        }
      }
      
      // 1. Prioridad: origen guardado en sesión (solo si no tenemos state)
      // Manejo robusto para evitar crashes si la sesión no está disponible
      if (!callbackOrigin) {
        try {
          if (req.session?.googleCallbackOrigin) {
            callbackOrigin = req.session.googleCallbackOrigin;
            console.log(`🔍 Usando origen de sesión: ${callbackOrigin}`);
          }
        } catch (sessionError) {
          // Si hay error al acceder a sesión, continuar con otros métodos
          console.warn('⚠️ Error al leer sesión (continuando con otros métodos):', sessionError.message);
        }
      }
      // 2. Detectar desde el referer (cuando Google redirige)
      else if (req.headers.referer) {
        try {
          const refererUrl = new URL(req.headers.referer);
          const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
          
          // Verificar si el origen está en los CORS permitidos
          if (config.corsOrigins && config.corsOrigins.includes(refererOrigin)) {
            callbackOrigin = refererOrigin;
            console.log(`🔍 Detectado origen desde referer: ${callbackOrigin}`);
          }
        } catch (error) {
          console.log('Error al parsear referer:', error.message);
        }
      }
      
      // 3. Fallback: usar configuración de múltiples apps
      if (!callbackOrigin && config.frontendUrls) {
        // En desarrollo: detectar por puerto desde la URL de callback
        if (config.env === 'development') {
          // Intentar detectar desde el host de la petición
          const host = req.headers.host;
          if (host) {
            // Si el host incluye un puerto, usarlo para detectar la app
            const port = host.split(':')[1];
            if (port === '5173' && config.frontendUrls.foco) {
              callbackOrigin = config.frontendUrls.foco;
            } else if (port === '5174' && config.frontendUrls.caja) {
              callbackOrigin = config.frontendUrls.caja;
            } else if (port === '5175' && config.frontendUrls.pulso) {
              callbackOrigin = config.frontendUrls.pulso;
            }
          }
        }
        // En producción: detectar por subdominio
        else if (config.env === 'production') {
          const host = req.headers.host;
          if (host) {
            if (host.includes('foco.attadia.com') && config.frontendUrls.foco) {
              callbackOrigin = config.frontendUrls.foco;
            } else if (
              (host.includes('caja.attadia.com') || host.includes('atta.attadia.com'))
              && config.frontendUrls.caja
            ) {
              callbackOrigin = config.frontendUrls.caja;
            } else if (host.includes('pulso.attadia.com') && config.frontendUrls.pulso) {
              callbackOrigin = config.frontendUrls.pulso;
            }
          }
        }
        
        if (callbackOrigin) {
          console.log(`🔍 Detectado origen por configuración de apps: ${callbackOrigin}`);
        }
      }
      
      // 4. Último fallback: usar frontendUrl configurado
      if (!callbackOrigin) {
        callbackOrigin = config.frontendUrl;
        console.log(`🔍 Usando frontendUrl como fallback: ${callbackOrigin}`);
      }
      
      // Helper para obtener callback origin de forma segura en caso de error
      const getSafeCallbackOrigin = () => {
        try {
          if (req.session?.googleCallbackOrigin) {
            return req.session.googleCallbackOrigin;
          }
        } catch (e) {
          // Ignorar errores de sesión
        }
        
        // Intentar desde state
        if (req.query?.state) {
          try {
            const decoded = JSON.parse(Buffer.from(req.query.state, 'base64').toString('utf8'));
            if (decoded?.origin) {
              return decoded.origin;
            }
          } catch (e) {
            // Ignorar errores de parsing
          }
        }
        
        return config.frontendUrl;
      };

      console.log(`🔗 Redirigiendo a origen: ${callbackOrigin} (desde sesión: ${!!(req.session && req.session.googleCallbackOrigin)})`);

      // Redirigir al frontend con los tokens (usando query params para BrowserRouter)
      const redirectUrl = new URL('/auth/callback', callbackOrigin);
      redirectUrl.searchParams.append('token', token);
      redirectUrl.searchParams.append('refreshToken', refreshToken);

      console.log('Redirigiendo al frontend:', {
        url: redirectUrl.toString().replace(/token=[^&]+/, 'token=REDACTED')
      });

      setRefreshTokenCookie(res, refreshToken);

      res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error('Error en callback de Google:', error);
      console.error('Stack trace:', error.stack);
      
      // Obtener callback origin de forma segura usando el helper
      const callbackOrigin = getSafeCallbackOrigin();
      res.redirect(`${callbackOrigin}/auth/callback?error=server_error`);
    }
  }
};