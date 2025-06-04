// lib/status.js
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

/**
 * Enumeración de todos los códigos de estado HTTP,
 * incluyendo el 419 "Page Expired" usado por Laravel.
 */
export const HTTP_STATUS_CODE = {
  // 1xx Informativos
  CONTINUE: 100,
  SWITCHING_PROTOCOLS: 101,
  PROCESSING: 102,
  EARLY_HINTS: 103,

  // 2xx Éxito
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NON_AUTHORITATIVE_INFORMATION: 203,
  NO_CONTENT: 204,
  RESET_CONTENT: 205,
  PARTIAL_CONTENT: 206,
  MULTI_STATUS: 207,
  ALREADY_REPORTED: 208,
  IM_USED: 226,

  // 3xx Redirección
  MULTIPLE_CHOICES: 300,
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  SEE_OTHER: 303,
  NOT_MODIFIED: 304,
  USE_PROXY: 305,
  TEMPORARY_REDIRECT: 307,
  PERMANENT_REDIRECT: 308,

  // 4xx Errores de cliente
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  PROXY_AUTHENTICATION_REQUIRED: 407,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  LENGTH_REQUIRED: 411,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  URI_TOO_LONG: 414,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RANGE_NOT_SATISFIABLE: 416,
  EXPECTATION_FAILED: 417,
  IM_A_TEAPOT: 418,
  PAGE_EXPIRED: 419,
  UNPROCESSABLE_ENTITY: 422,
  TOO_EARLY: 425,
  UPGRADE_REQUIRED: 426,
  PRECONDITION_REQUIRED: 428,
  TOO_MANY_REQUESTS: 429,
  REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
  UNAVAILABLE_FOR_LEGAL_REASONS: 451,

  // 5xx Errores de servidor
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  HTTP_VERSION_NOT_SUPPORTED: 505,
  VARIANT_ALSO_NEGOTIATES: 506,
  INSUFFICIENT_STORAGE: 507,
  LOOP_DETECTED: 508,
  NOT_EXTENDED: 510,
  NETWORK_AUTHENTICATION_REQUIRED: 511,
};

/**
 * Textos asociados a cada código HTTP.
 */
export const HTTP_STATUS_TEXT = {
  100: 'Continue',
  101: 'Switching Protocols',
  102: 'Processing',
  103: 'Early Hints',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content',
  207: 'Multi-Status',
  208: 'Already Reported',
  226: 'IM Used',
  300: 'Multiple Choices',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  305: 'Use Proxy',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Payload Too Large',
  414: 'URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Range Not Satisfiable',
  417: 'Expectation Failed',
  418: "I'm a Teapot",
  419: 'Page Expired',
  422: 'Unprocessable Entity',
  425: 'Too Early',
  426: 'Upgrade Required',
  428: 'Precondition Required',
  429: 'Too Many Requests',
  431: 'Request Header Fields Too Large',
  451: 'Unavailable For Legal Reasons',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported',
  506: 'Variant Also Negotiates',
  507: 'Insufficient Storage',
  508: 'Loop Detected',
  510: 'Not Extended',
  511: 'Network Authentication Required',
};

/**
 * Clase base para generar respuestas HTTP con estructura uniforme.
 */
export class HttpResponse {
  /**
   * @param {object} options
   * @param {number} [options.code=0] — código de aplicación (opcional)
   * @param {string} options.message — mensaje
   * @param {any} [options.data=null] — payload
   * @param {object|null} [options.errors=null] — errores de validación u otros
   * @param {number} options.httpStatusCode — código HTTP de la respuesta
   */
  constructor({ code = 0, message, data = null, errors = null, httpStatusCode }) {
    this.code = code;
    this.message = message;
    this.data = data;
    if (errors) this.errors = errors;
    this.httpStatusCode = httpStatusCode;
    this.statusCodeName = HTTP_STATUS_TEXT[httpStatusCode] || 'Unknown Status';
  }

  /**
   * Empaqueta el payload y retorna un NextResponse.json
   */
  toNextResponse() {
    const { code, message, data, errors, httpStatusCode } = this;
    const payload = {
      success: httpStatusCode >= 200 && httpStatusCode < 300,
      code,
      message,
      data,
      ...(errors && { errors }),
    };
    return NextResponse.json(payload, { status: httpStatusCode });
  }
}

/**
 * Helper con métodos estáticos para cada tipo de respuesta común.
 */
export const Status = {
  // 2xx Éxitos
  ok:        (data, message = 'Operación exitosa', code = 0) =>
                new HttpResponse({ code, message, data, httpStatusCode: HTTP_STATUS_CODE.OK }),
  created:   (data, message = 'Recurso creado', code = 0) =>
                new HttpResponse({ code, message, data, httpStatusCode: HTTP_STATUS_CODE.CREATED }),
  accepted:  (data, message = 'Solicitud aceptada', code = 0) =>
                new HttpResponse({ code, message, data, httpStatusCode: HTTP_STATUS_CODE.ACCEPTED }),
  noContent: (code = 0, message = 'Sin contenido') =>
                new HttpResponse({ code, message, data: null, httpStatusCode: HTTP_STATUS_CODE.NO_CONTENT }),

  // 4xx Errores de cliente
  badRequest:          (message = 'Solicitud inválida', errors = null, code = 0) =>
                new HttpResponse({ code, message, data: null, errors, httpStatusCode: HTTP_STATUS_CODE.BAD_REQUEST }),
  unauthorized:        (message = 'No autorizado', errors = null, code = 0) =>
                new HttpResponse({ code, message, data: null, errors, httpStatusCode: HTTP_STATUS_CODE.UNAUTHORIZED }),
  forbidden:           (message = 'Acceso denegado', errors = null, code = 0) =>
                new HttpResponse({ code, message, data: null, errors, httpStatusCode: HTTP_STATUS_CODE.FORBIDDEN }),
  notFound:            (message = 'No encontrado', errors = null, code = 0) =>
                new HttpResponse({ code, message, data: null, errors, httpStatusCode: HTTP_STATUS_CODE.NOT_FOUND }),
  methodNotAllowed:    (message = 'Método no permitido', errors = null, code = 0) =>
                new HttpResponse({ code, message, data: null, errors, httpStatusCode: HTTP_STATUS_CODE.METHOD_NOT_ALLOWED }),
  conflict:            (message = 'Conflicto', errors = null, code = 0) =>
                new HttpResponse({ code, message, data: null, errors, httpStatusCode: HTTP_STATUS_CODE.CONFLICT }),
  unprocessableEntity: (message = 'Entidad no procesable', errors = null, code = 0) =>
                new HttpResponse({ code, message, data: null, errors, httpStatusCode: HTTP_STATUS_CODE.UNPROCESSABLE_ENTITY }),
  pageExpired:         (message = 'Página expirada', errors = null, code = 0) =>
                new HttpResponse({ code, message, data: null, errors, httpStatusCode: HTTP_STATUS_CODE.PAGE_EXPIRED }),

  // 5xx Errores de servidor
  internalError:       (message = 'Error interno del servidor', errors = null, code = 0) =>
                new HttpResponse({ code, message, data: null, errors, httpStatusCode: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR }),
  notImplemented:      (message = 'No implementado', errors = null, code = 0) =>
                new HttpResponse({ code, message, data: null, errors, httpStatusCode: HTTP_STATUS_CODE.NOT_IMPLEMENTED }),
  badGateway:          (message = 'Puerta de enlace incorrecta', errors = null, code = 0) =>
                new HttpResponse({ code, message, data: null, errors, httpStatusCode: HTTP_STATUS_CODE.BAD_GATEWAY }),
  serviceUnavailable:  (message = 'Servicio no disponible', errors = null, code = 0) =>
                new HttpResponse({ code, message, data: null, errors, httpStatusCode: HTTP_STATUS_CODE.SERVICE_UNAVAILABLE }),
  gatewayTimeout:      (message = 'Tiempo de espera agotado', errors = null, code = 0) =>
                new HttpResponse({ code, message, data: null, errors, httpStatusCode: HTTP_STATUS_CODE.GATEWAY_TIMEOUT }),
};

/**
 * Traduce errores de Prisma a respuestas HTTP apropiadas.
 * @param {unknown} error — error lanzado por Prisma
 * @returns {HttpResponse|null} — HttpResponse correspondiente, o null si no es un error de Prisma
 */
export function handlePrismaError(error) {
  // Errores conocidos de Prisma
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      // P2000: Valor demasiado largo para el campo
      case 'P2000':
        return Status.badRequest(
          'El valor ingresado es demasiado largo para este campo',
          { 
            field: error.meta?.column_name || 'campo desconocido',
            maxLength: error.meta?.constraint || 'no especificado'
          }
        );

      // P2001: Registro no encontrado en WHERE
      case 'P2001':
        return Status.notFound(
          'No se encontró el registro solicitado',
          { model: error.meta?.model_name || 'modelo desconocido' }
        );

      // P2002: Violación de constraint único
      case 'P2002':
        const target = error.meta?.target;
        const modelName = error.meta?.modelName;
        
        let message = 'Este registro ya existe en el sistema';
        let field = 'campo desconocido';
        
        if (target) {
          if (Array.isArray(target)) {
            // Constraint compuesto
            field = target.join(', ');
            message = `Ya existe un ${modelName?.toLowerCase() || 'registro'} con esa combinación de ${field}`;
          } else {
            // Constraint simple
            field = target.replace(/_key$/, '').replace(/^.*_/, '');
            if (target.includes('nombre')) {
              message = `Ya existe un ${modelName?.toLowerCase() || 'registro'} con este nombre`;
            }
          }
        }
        
        return Status.conflict(message, { 
          // constraint: target,
          // model: modelName,
          // duplicatedField: field,
          message: message,
        });

      // P2003: Violación de foreign key constraint
      case 'P2003':
        return Status.badRequest(
          'No se puede completar la operación: el registro al que hace referencia no existe',
          { 
            field: error.meta?.field_name || 'campo desconocido',
            constraint: error.meta?.constraint || 'referencia desconocida'
          }
        );

      // P2004: Violación de constraint
      case 'P2004':
        return Status.badRequest(
          'Los datos ingresados no cumplen con las restricciones del sistema',
          { constraint: error.meta?.constraint || 'restricción desconocida' }
        );

      // P2005: Valor inválido para el tipo de campo
      case 'P2005':
        return Status.badRequest(
          'El tipo de dato ingresado no es válido para este campo',
          { 
            field: error.meta?.field_name || 'campo desconocido',
            expectedType: error.meta?.expected_type || 'tipo desconocido'
          }
        );

      // P2006: Valor inválido para el campo
      case 'P2006':
        return Status.badRequest(
          'El valor ingresado no es válido para este campo',
          { field: error.meta?.field_name || 'campo desconocido' }
        );

      // P2007: Error de validación de datos
      case 'P2007':
        return Status.badRequest(
          'Los datos ingresados no son válidos',
          { details: error.meta?.details || 'sin detalles específicos' }
        );

      // P2008: Error al parsear la consulta
      case 'P2008':
        return Status.badRequest('Error al procesar la consulta a la base de datos');

      // P2009: Error al validar la consulta
      case 'P2009':
        return Status.badRequest('Error de validación en la consulta realizada');

      // P2010: Query raw falló
      case 'P2010':
        return Status.internalError('Error al ejecutar la consulta personalizada');

      // P2011: Violación de constraint null
      case 'P2011':
        return Status.badRequest(
          'Este campo es obligatorio y no puede estar vacío',
          { field: error.meta?.constraint || 'campo desconocido' }
        );

      // P2012: Valor faltante requerido
      case 'P2012':
        return Status.badRequest(
          'Falta información requerida para completar la operación',
          { field: error.meta?.path || 'campo desconocido' }
        );

      // P2013: Argumento faltante requerido
      case 'P2013':
        return Status.badRequest(
          'Falta un parámetro requerido para procesar la solicitud',
          { field: error.meta?.argument_name || 'parámetro desconocido' }
        );

      // P2014: Relación requerida viola constraint
      case 'P2014':
        return Status.badRequest(
          'La relación especificada no cumple con las restricciones del sistema',
          { relation: error.meta?.relation_name || 'relación desconocida' }
        );

      // P2015: Registro relacionado no encontrado
      case 'P2015':
        return Status.notFound(
          'No se encontró el registro relacionado necesario',
          { relation: error.meta?.details || 'relación desconocida' }
        );

      // P2016: Error de interpretación de consulta
      case 'P2016':
        return Status.badRequest('Error al interpretar los parámetros de la consulta');

      // P2017: Relación desconectada
      case 'P2017':
        return Status.badRequest(
          'Las relaciones especificadas no están correctamente conectadas',
          { relation: error.meta?.relation_name || 'relación desconocida' }
        );

      // P2018: Registros conectados requeridos no encontrados
      case 'P2018':
        return Status.notFound(
          'No se encontraron los registros relacionados requeridos',
          { details: error.meta?.details || 'sin detalles específicos' }
        );

      // P2019: Error de entrada
      case 'P2019':
        return Status.badRequest(
          'Error en la información proporcionada',
          { details: error.meta?.details || 'sin detalles específicos' }
        );

      // P2020: Valor fuera de rango
      case 'P2020':
        return Status.badRequest(
          'El valor ingresado está fuera del rango permitido',
          { field: error.meta?.details || 'campo desconocido' }
        );

      // P2021: Tabla no existe
      case 'P2021':
        return Status.internalError('Error de configuración en la base de datos');

      // P2022: Columna no existe
      case 'P2022':
        return Status.internalError('Error de estructura en la base de datos');

      // P2023: Datos inconsistentes
      case 'P2023':
        return Status.internalError('Se detectaron datos inconsistentes en el sistema');

      // P2024: Timeout de conexión a BD
      case 'P2024':
        return Status.serviceUnavailable('Tiempo de espera agotado al conectar con la base de datos');

      // P2025: Operación falló porque dependía de uno o más registros que no existen
      case 'P2025':
        return Status.notFound(
          'No se pudo completar la operación: el registro no existe o ya fue eliminado',
          { details: error.meta?.cause || 'registro no encontrado' }
        );

      // P2026: Error de provider de BD
      case 'P2026':
        return Status.internalError('Error del sistema de base de datos');

      // P2027: Múltiples errores durante ejecución
      case 'P2027':
        return Status.internalError('Se produjeron múltiples errores durante la operación');

      // P2028: Error de transacción
      case 'P2028':
        return Status.internalError('Error al procesar la transacción en la base de datos');

      // P2030: No se puede encontrar un fulltext index
      case 'P2030':
        return Status.internalError('Error de configuración en el sistema de búsqueda');

      // P2033: Número usado en JSON no es válido
      case 'P2033':
        return Status.badRequest('Número inválido en los datos proporcionados');

      // P2034: Transacción falló debido a write conflict
      case 'P2034':
        return Status.conflict('Conflicto al escribir datos: otro usuario modificó la información simultáneamente');

      default:
        return Status.internalError(
          'Error inesperado en la base de datos',
          { code: error.code }
        );
    }
  }

  // Errores de validación de Prisma
  if (error instanceof Prisma.PrismaClientValidationError) {
    return Status.badRequest('Los datos proporcionados no son válidos');
  }

  // Errores de inicialización de Prisma
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return Status.serviceUnavailable('No se pudo establecer conexión con la base de datos');
  }

  // Errores de conexión perdida
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return Status.internalError('Error crítico en el sistema de base de datos');
  }

  // Error genérico de Prisma
  if (error?.name && error.name.includes('Prisma')) {
    return Status.internalError('Error del sistema de base de datos');
  }

  return null;
}