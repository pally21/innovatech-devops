# NexLogix — Plataforma de Gestión Logística eCommerce

Arquitectura de microservicios para el curso DSY1106 — Desarrollo Fullstack III.

## Servicios

| Servicio               | Puerto | Descripción                              |
|------------------------|--------|------------------------------------------|
| api-gateway            | 3000   | Entrada única: JWT, rate limiting, proxy |
| inventario-service     | 3001   | Stock en tiempo real (Redis + PostgreSQL)|
| pagos-service          | 3002   | Transacciones seguras + Circuit Breaker  |
| recomendaciones-service| 3003   | Sugerencias con privacidad IEEE EAD      |

## Infraestructura

| Componente              | Uso                                      |
|-------------------------|------------------------------------------|
| PostgreSQL (x3)         | Una DB por microservicio (Database-per-Service) |
| Redis                   | Caché de stock en Inventario             |
| RabbitMQ                | Message Broker para eventos asíncronos   |

## Levantar el proyecto

```bash
# Clonar e iniciar todos los servicios
docker-compose up --build

# Verificar que todos los servicios están corriendo
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
```

## Ejemplos de uso

### Consultar stock de un producto
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/v1/inventario/<id>/stock
```

### Procesar un pago (con idempotencia)
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "X-Idempotency-Key: pedido-uuid-001" \
  -H "Content-Type: application/json" \
  -d '{"pedidoId":"uuid","monto":99.99,"tarjeta":{"numero":"4111111111111111","marca":"Visa"}}' \
  http://localhost:3000/api/v1/pagos
```

### Registrar consentimiento de recomendaciones
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"userId":"uuid","acepta":true}' \
  http://localhost:3000/api/v1/recomendaciones/consentimiento
```

## Ejecutar pruebas

```bash
# Inventario
cd inventario-service && npm test

# Pagos (incluye Circuit Breaker)
cd pagos-service && npm test

# Recomendaciones
cd recomendaciones-service && npm test
```

## Patrones implementados

- **Repository Pattern** — `ProductoRepository`, `TransaccionRepository`, `PerfilRepository`
- **Circuit Breaker** — `pagos-service/src/config/circuitBreaker.js`
- **Database-per-Service** — 3 instancias PostgreSQL independientes
- **Event-Driven Architecture** — RabbitMQ con eventos tipados
- **API Gateway** — autenticación centralizada + rate limiting

## Cumplimiento IEEE EAD

- Datos de tarjeta: solo últimos 4 dígitos almacenados (PCI-DSS)
- Recomendaciones: consentimiento explícito requerido
- Pseudonimización: SHA-256 del userId (nunca datos directos)
- Derecho al olvido: `DELETE /api/v1/recomendaciones/datos`
- TTL de 12 meses en perfiles de usuario
