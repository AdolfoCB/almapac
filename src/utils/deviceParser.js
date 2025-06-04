// utils/deviceParser.js
import { UAParser } from 'ua-parser-js';

export function parseDeviceInfoWithUAParser(userAgent) {
  if (!userAgent) {
    return {
      deviceOS: null,
      browser: null,
      deviceModel: null,
      deviceType: 'desktop'
    };
  }

  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  // 🖥️ SISTEMA OPERATIVO
  let deviceOS = null;
  if (result.os.name) {
    deviceOS = result.os.version ? 
      `${result.os.name} ${result.os.version}` : 
      result.os.name;
  }

  // 🌐 NAVEGADOR
  let browser = null;
  if (result.browser.name) {
    browser = result.browser.version ? 
      `${result.browser.name} ${result.browser.version}` : 
      result.browser.name;
  }

  // 📱 MODELO DE DISPOSITIVO
  let deviceModel = null;
  if (result.device.model) {
    deviceModel = result.device.vendor ? 
      `${result.device.vendor} ${result.device.model}` : 
      result.device.model;
  } else if (result.device.vendor) {
    deviceModel = result.device.vendor;
  }

  // 💻 TIPO DE DISPOSITIVO
  let deviceType = 'desktop'; // default
  if (result.device.type) {
    deviceType = result.device.type; // mobile, tablet, console, smarttv, wearable, embedded
  } else {
    // Si no detecta tipo pero hay info de mobile
    if (result.os.name && ['Android', 'iOS'].includes(result.os.name)) {
      deviceType = 'mobile';
    }
  }

  console.log('🔍 [UA PARSER] Resultado:', {
    original: userAgent.substring(0, 80) + '...',
    parsed: {
      deviceOS,
      browser,
      deviceModel,
      deviceType
    },
    raw: {
      os: result.os,
      browser: result.browser,
      device: result.device
    }
  });

  return {
    deviceOS,
    browser,
    deviceModel,
    deviceType
  };
}