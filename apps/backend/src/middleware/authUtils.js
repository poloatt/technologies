// Constantes de roles
export const ROLES = {
  ADMIN: 'ADMIN',
  USER: 'USER'
};

// Mensajes de error estandarizados
export const AUTH_ERRORS = {
  NOT_AUTHENTICATED: 'Usuario no autenticado',
  INSUFFICIENT_PERMISSIONS: 'No tienes permisos para realizar esta acción',
  RESOURCE_NOT_FOUND: 'Recurso no encontrado',
  RESOURCE_ACCESS_DENIED: 'No tienes permisos para acceder a este recurso',
  RESOURCE_WITHOUT_USER: 'Recurso sin usuario asignado'
};

// Utilidad para verificar autenticación básica
export const requireAuth = (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: AUTH_ERRORS.NOT_AUTHENTICATED });
    return false;
  }
  return true;
};

// Utilidad para verificar si el usuario es admin
export const isAdmin = (user) => {
  return user && user.role === ROLES.ADMIN;
};

// Utilidad para verificar propiedad de recurso
export const isResourceOwner = (resource, userId) => {
  if (!resource || !resource.usuario || !userId) {
    return false;
  }
  
  const resourceUserId = resource.usuario.toString ? 
    resource.usuario.toString() : 
    resource.usuario;
    
  return resourceUserId === userId;
};

/** Co-owner vía `owners[]` (Delegar). */
export const isResourceCoOwner = (resource, userId) => {
  if (!resource || !userId || !Array.isArray(resource.owners)) {
    return false;
  }
  const uid = String(userId);
  return resource.owners.some((entry) => {
    const id = entry?._id ?? entry?.id ?? entry;
    return id != null && String(id) === uid;
  });
};

// Utilidad para verificar si el usuario puede acceder al recurso
export const canAccessResource = (resource, user) => {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return isResourceOwner(resource, user.id) || isResourceCoOwner(resource, user.id);
};
