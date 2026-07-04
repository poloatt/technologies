/**
 * Errores típicos cuando el backend aún no escucha (Vite proxy → 500) o hay fallo de red.
 */
export function isBackendUnavailableError(error) {
  if (!error?.response) {
    const msg = String(error?.message || '');
    return (
      msg.includes('Network')
      || msg.includes('ERR_')
      || msg.includes('Timeout')
      || msg.includes('ECONNREFUSED')
      || msg.includes('no responde')
    );
  }
  const status = error.response.status;
  return status >= 500 && status <= 504;
}

/** Reintenta mientras el backend termina de arrancar (nodemon + Mongo + googleapis). */
export async function retryWhileBackendWakes(requestFn, { maxAttempts = 8, baseDelayMs = 1500 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      if (!isBackendUnavailableError(error) || attempt === maxAttempts - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastError;
}
