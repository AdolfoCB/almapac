// lib/validator.js

/**
 * Validador para Next.js v15.
 * Soporta definiciones de reglas como:
 *   "required|string|min:3|max:255|email"
 * o un array:
 *   ["required", "string", "min:3", "email"]
 */

/**
 * Mapa de validadores: cada función recibe
 *   (value, params:Array<string>, allData:Object)
 * y retorna [boolean, string] → [pasa, mensajeError].
 */
export const VALIDATORS = {
  // Básicas
  required:        (v) => [v != null && v !== "", "requerido"],
  string:          (v) => [typeof v === "string", "debe ser texto"],
  json:            (v) => [typeof v === "object" && v !== null, "debe ser un objeto JSON válido"],
  integer:         (v) => [Number.isInteger(v), "debe ser un entero"],
  numeric:         (v) => [v != null && !isNaN(parseFloat(v)), "debe ser numérico"],
  boolean:         (v) => [typeof v === "boolean", "debe ser booleano"],
  array:           (v) => [Array.isArray(v), "debe ser un arreglo"],
  object:          (v) => [v != null && typeof v === "object" && !Array.isArray(v), "debe ser un objeto"],
  email:           (v) => [ /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "formato de email inválido" ],
  url:             (v) => {
    try { new URL(v); return [true, ""]; }
    catch { return [false, "URL inválida"]; }
  },
  uuid:            (v) => [ /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v), "UUID inválido" ],
  date:            (v) => [!isNaN(Date.parse(v)), "fecha inválida"],
  regex:           (v, [pattern]) => {
    try {
      const re = new RegExp(pattern);
      return [ re.test(v), `no coincide con ${pattern}` ];
    } catch {
      return [false, "patrón de regex inválido"];
    }
  },
  in:              (v, params) => [ params.includes(String(v)), `debe ser uno de [${params.join(",")}]` ],
  not_in:          (v, params) => [ !params.includes(String(v)), `no puede ser ninguno de [${params.join(",")}]` ],
  min:             (v, [limit]) => {
    const n = parseFloat(limit);
    if (typeof v === "string" || Array.isArray(v)) {
      return [ v.length >= n, `mínimo ${n}` ];
    }
    if (!isNaN(parseFloat(v))) {
      return [ parseFloat(v) >= n, `debe ser ≥ ${n}` ];
    }
    return [false, "mínimo no aplicable"];
  },
  max:             (v, [limit]) => {
    const n = parseFloat(limit);
    if (typeof v === "string" || Array.isArray(v)) {
      return [ v.length <= n, `máximo ${n}` ];
    }
    if (!isNaN(parseFloat(v))) {
      return [ parseFloat(v) <= n, `debe ser ≤ ${n}` ];
    }
    return [false, "máximo no aplicable"];
  },
  between:         (v, [min, max]) => {
    const a = parseFloat(min), b = parseFloat(max);
    if (typeof v === "string" || Array.isArray(v)) {
      return [ v.length >= a && v.length <= b, `entre ${a} y ${b}` ];
    }
    if (!isNaN(parseFloat(v))) {
      const x = parseFloat(v);
      return [ x >= a && x <= b, `entre ${a} y ${b}` ];
    }
    return [false, "between no aplicable"];
  },
  confirmed:       (v, _, all) => {
    const key = `${thisField}_confirmation`;
    return [ v === all[key], "no coincide con la confirmación" ];
  },
  same:            (v, [other], all) => [ v === all[other], `debe coincidir con ${other}` ],
  required_if:     (v, [field, val], all) => {
    if (String(all[field]) === val) {
      return [v != null && v !== "", `requerido cuando ${field} es ${val}`];
    }
    return [true, ""];
  },
  required_unless: (v, [field, val], all) => {
    if (String(all[field]) !== val) {
      return [v != null && v !== "", `requerido a menos que ${field} sea ${val}`];
    }
    return [true, ""];
  },
  // CORREGIDO: nullable siempre pasa, es solo un marcador
  nullable:        (v) => [true, ""],
  present:         (v, _, all) => [ Object.prototype.hasOwnProperty.call(all, thisField), "debe estar presente" ],
};

/**
 * Convierte una definición en lista de reglas:
 *   "required|string|min:3" → [{name:'required',params:[]}, …]
 * @param {string|string[]} rules
 */
function parseRules(rules) {
  const arr = Array.isArray(rules) ? rules : String(rules).split("|");
  return arr.map(r => {
    const [name, paramStr] = r.split(":");
    const params = paramStr ? paramStr.split(",") : [];
    return { name, params };
  });
}

/**
 * Valida un solo rule contra un valor.
 * @param {string} ruleName
 * @param {any} value
 * @param {string[]} params
 * @param {object} allData
 * @returns {{ valid:boolean, message:string }}
 */
export function validateRule(ruleName, value, params = [], allData = {}) {
  const fn = VALIDATORS[ruleName];
  if (!fn) {
    throw new Error(`Regla desconocida: ${ruleName}`);
  }
  // so that confirmed/sometimes/etc. conozcan el campo actual:
  const thisField = params._currentFieldName;
  const [ok, msg] = fn.call({ thisField }, value, params, allData);
  return { valid: ok, message: ok ? null : msg || `La regla ${ruleName} falló` };
}

/**
 * Valida un objeto completo según un esquema.
 * @param {{ [field:string]: string|string[] }} schema
 * @param {{ [field:string]: any }} data
 * @returns {{ valid:boolean, errors: Record<string,string> }}
 */
export function validateSchema(schema, data) {
  const errors = {};

  for (const [field, rulesDef] of Object.entries(schema)) {
    const value = data[field];
    const rules = parseRules(rulesDef).map(r => ({
      ...r,
      params: Object.assign(r.params, { _currentFieldName: field })
    }));

    // Si está 'sometimes' y no viene en data, saltear
    if (rules.some(r => r.name === "sometimes") && !(field in data)) {
      continue;
    }

    // Verificar si es nullable
    const isNullable = rules.some(r => r.name === "nullable");
    
    // Si es nullable y el valor es null/undefined, saltear todas las demás validaciones
    if (isNullable && (value == null || value === undefined)) {
      continue;
    }

    for (const { name, params } of rules) {
      // Saltear la regla nullable ya que la manejamos arriba
      if (name === "nullable") {
        continue;
      }
      
      const { valid, message } = validateRule(name, value, params, data);
      if (!valid) {
        errors[field] = message;
        break;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}