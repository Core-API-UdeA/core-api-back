// scripts/seed-planes.js
// Ejecutar con: node scripts/seed-planes.js <apiId>

const apiId = process.argv[2];

if (!apiId) {
  console.error('Uso: node scripts/seed-planes.js <apiId>');
  process.exit(1);
}

const planes = [
  {
    name: 'Free',
    description: 'Plan gratuito para comenzar',
    price: 0,
    billing_cycle: 'monthly',
    max_requests_per_month: 1000,
    max_requests_per_day: 50,
    max_requests_per_minute: 5,
    features: [
      'Acceso a endpoints básicos',
      'Soporte por email',
      'Documentación completa'
    ],
    is_active: true,
    is_popular: false
  },
  {
    name: 'Basic',
    description: 'Ideal para proyectos pequeños',
    price: 9.99,
    billing_cycle: 'monthly',
    max_requests_per_month: 10000,
    max_requests_per_day: 500,
    max_requests_per_minute: 20,
    features: [
      'Todo lo del plan Free',
      '10,000 requests/mes',
      'Soporte prioritario',
      'Sin marca de agua'
    ],
    is_active: true,
    is_popular: false
  },
  {
    name: 'Pro',
    description: 'Para aplicaciones en crecimiento',
    price: 29.99,
    billing_cycle: 'monthly',
    max_requests_per_month: 100000,
    max_requests_per_day: 5000,
    max_requests_per_minute: 100,
    features: [
      'Todo lo del plan Basic',
      '100,000 requests/mes',
      'Webhooks incluidos',
      'Análisis avanzados',
      'Soporte 24/7'
    ],
    is_active: true,
    is_popular: true
  },
  {
    name: 'Enterprise',
    description: 'Solución completa para empresas',
    price: 99.99,
    billing_cycle: 'monthly',
    max_requests_per_month: null, // Ilimitado
    max_requests_per_day: null,
    max_requests_per_minute: null,
    features: [
      'Todo lo del plan Pro',
      'Requests ilimitados',
      'SLA garantizado',
      'Cuenta dedicada',
      'Integración personalizada',
      'Soporte premium'
    ],
    is_active: true,
    is_popular: false
  }
];

console.log(`Creando ${planes.length} planes para la API ${apiId}...`);
console.log('Copia este JSON y envíalo al endpoint POST /api/catalogo/planes');
console.log(JSON.stringify({ apiId, planes }, null, 2));
