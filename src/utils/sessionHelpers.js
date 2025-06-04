// utils/sessionHelpers.js
import { parseDeviceInfoWithUAParser } from './deviceParser';

// Función para extraer la IP real del cliente
export function extractClientIP(request) {
  // Intentar obtener IP de diferentes headers (en orden de prioridad)
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const clientIP = request.headers.get('x-client-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
  const remoteAddr = request.headers.get('remote-addr');
  
  let clientIpAddress = null;
  
  if (forwardedFor) {
    // X-Forwarded-For puede contener múltiples IPs separadas por comas
    clientIpAddress = forwardedFor.split(',')[0].trim();
  } else if (cfConnectingIP) {
    // Cloudflare
    clientIpAddress = cfConnectingIP;
  } else if (realIP) {
    clientIpAddress = realIP;
  } else if (clientIP) {
    clientIpAddress = clientIP;
  } else if (remoteAddr) {
    clientIpAddress = remoteAddr;
  }
  
  // Limpiar la IP (remover puerto si existe)
  if (clientIpAddress) {
    clientIpAddress = clientIpAddress.replace(/:\d+$/, '');
  }
  
  console.log('🌐 [IP DETECTION] Headers disponibles:', {
    'x-forwarded-for': forwardedFor,
    'x-real-ip': realIP,
    'x-client-ip': clientIP,
    'cf-connecting-ip': cfConnectingIP,
    'remote-addr': remoteAddr,
    'detected': clientIpAddress
  });
  
  return clientIpAddress || 'unknown';
}

export function extractDeviceInfoFromRequest(request) {
  const userAgent = request.headers.get('user-agent') || '';
  const ipAddress = extractClientIP(request);
  
  const deviceInfo = parseDeviceInfoWithUAParser(userAgent);
  
  return {
    ...deviceInfo,
    ipAddress
  };
}