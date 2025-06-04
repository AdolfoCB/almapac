// prisma/swagger-gen.js
const fs   = require('fs');
const path = require('path');

const swagger = {
  openapi: '3.0.3',
  info: {
    title: 'Mi API v1',
    version: '1.0.0',
    description: 'Documentación generada automáticamente desde Prisma + Next.js App Router'
  },
  servers: [{ url: 'http://localhost:3000' }],
  paths: {},
  components: { schemas: {} }
};

// 1) Parsear modelos de Prisma
function parsePrismaModels(schemaPath) {
  const content = fs.readFileSync(schemaPath, 'utf-8');
  const modelRE = /model\s+(\w+)\s*{([^}]*)}/g;
  let m;
  while ((m = modelRE.exec(content))) {
    const [_, modelName, body] = m;
    const schema = { type: 'object', properties: {}, required: [] };
    body.split('\n').forEach(line => {
      const t = line.trim();
      if (!t || t.startsWith('//')) return;
      const [field, typeRaw] = t.split(/\s+/);
      if (!field || !typeRaw) return;
      let prop;
      if (typeRaw.startsWith('String'))        prop = { type: 'string' };
      else if (typeRaw.startsWith('Int'))      prop = { type: 'integer' };
      else if (typeRaw.startsWith('Boolean'))  prop = { type: 'boolean' };
      else if (typeRaw.startsWith('DateTime')) prop = { type: 'string', format: 'date-time' };
      else if (typeRaw.startsWith('Json'))     prop = { type: 'object' };
      else prop = {};
      schema.properties[field] = prop;
      if (!typeRaw.endsWith('?')) {
        schema.required.push(field);
      }
    });
    swagger.components.schemas[modelName] = schema;
  }
}

// 2) Escanear App Router debajo de src/app/api/v1
function scanRoutes(dir, prefix = '') {
  fs.readdirSync(dir).forEach(name => {
    const full = path.join(dir, name);
    const stats = fs.statSync(full);
    if (stats.isDirectory()) {
      scanRoutes(full, `${prefix}/${name}`);
    } else if (name === 'route.js') {
      const code = fs.readFileSync(full, 'utf-8');
      ['GET','POST','PUT','DELETE'].forEach(method => {
        if (new RegExp(`export async function ${method}\\(`).test(code)) {
          const routePath = prefix
            .replace(/\\/g, '/')                // Windows → Unix
            .replace(/\[([^\]]+)\]/g, '{$1}'); // dinámicos
          swagger.paths[routePath] = swagger.paths[routePath] || {};
          swagger.paths[routePath][method.toLowerCase()] = {
            summary: `${method} ${routePath}`,
            responses: { '200': { description: 'Success' } }
          };
        }
      });
    }
  });
}

// 3) Ejecutar
const prismaSchema = path.join(__dirname, '../prisma/schema.prisma');
parsePrismaModels(prismaSchema);

const routesDir = path.join(__dirname, '../src/app/api/v1');
scanRoutes(routesDir, '/api/v1');

fs.writeFileSync(
  path.join(__dirname, '../public/openapi.json'),
  JSON.stringify(swagger, null, 2)
);

console.log('✅ public/openapi.json generado');
