# Innovatech Chile — CI/CD completo en AWS ECS
**ISY1101 - Introducción a Herramientas DevOps | DuocUC 2025**  
**Evaluación Final Transversal — Orquestación, CI/CD y despliegue automatizado en AWS**  
**Autoras:** Johanna Gajardo · Jacqueline Guzmán

---

## Descripción general

Este proyecto implementa el ciclo completo de **Integración y Entrega Continua (CI/CD)** para la plataforma Innovatech Chile, compuesta por:

- **Frontend:** React + Vite + Tailwind, servido con Nginx (reverse proxy)
- **Backend Ventas:** Spring Boot REST API (puerto 8080)
- **Backend Despachos:** Spring Boot REST API (puerto 8081)
- **Base de datos:** MySQL 8.0 con volumen persistente

Todo orquestado en **Amazon ECS (EC2 launch type)** con imágenes almacenadas en **Amazon ECR** y despliegue automatizado mediante **GitHub Actions**.

---

## Arquitectura

```
VS Code → git push → GitHub Actions (test → build → push ECR → deploy ECS)
                                          ↓
                               Amazon ECR (3 repos privados)
                                          ↓ pull imagen
┌─────────────────────────────────────────────────────┐
│ AWS VPC 10.0.0.0/16 · us-east-1                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ EC2 innovatech-server · t2.micro                │ │
│ │ ┌─────────────────────────────────────────────┐ │ │
│ │ │ ECS Cluster: innovatech-cluster             │ │ │
│ │ │                                             │ │ │
│ │ │ [frontend :80→dinámico] ←→ Usuario internet │ │ │
│ │ │      ↓ Nginx proxy_pass 172.17.0.1          │ │ │
│ │ │ [ventas   :8080 fijo  ] ←→ MySQL :3306      │ │ │
│ │ │ [despachos :8081 fijo ] ←→ MySQL :3306      │ │ │
│ │ │ [mysql-db  :3306      ]                     │ │ │
│ │ │                                             │ │ │
│ │ │ Autoscaling: Target Tracking 50% CPU        │ │ │
│ │ └─────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Servicios ECS

| Servicio | Task Definition | Puerto | Imagen ECR |
|---|---|---|---|
| innovatech-frontend-service | innovatech-frontend-td:5 | :80 → dinámico | innovatech-frontend:latest |
| innovatech-ventas-service | innovatech-ventas-td:4 | :8080 fijo | innovatech-ventas:latest |
| innovatech-despachos-service | innovatech-despachos-td:3 | :8081 fijo | innovatech-despachos:latest |

---

## Pipeline CI/CD

Tres workflows independientes en `.github/workflows/`, uno por servicio:

| Workflow | Trigger | Etapas |
|---|---|---|
| `cicd-frontend.yml` | push en `front_despacho/**` | test → build → push ECR → deploy ECS |
| `cicd-ventas.yml` | push en `back-Ventas_SpringBoot/**` | test → build → push ECR → deploy ECS |
| `cicd-despachos.yml` | push en `back-Despachos_SpringBoot/**` | test → build → push ECR → deploy ECS |

### Etapas del pipeline

```
1. Checkout código
2. Setup runtime (Node 20 / Java 17)
3. Instalar dependencias
4. Ejecutar tests (npm test / mvn test)
5. Configurar credenciales AWS (GitHub Secrets)
6. Login Amazon ECR
7. docker build + push :latest + :SHA
8. aws ecs update-service --force-new-deployment
```

### Tags de imagen (trazabilidad)

Cada imagen publicada recibe dos tags:
- `:latest` — apunta siempre a la versión más reciente
- `:<github.sha>` — hash único del commit para trazabilidad exacta

### Secrets requeridos en GitHub

| Secret | Descripción |
|---|---|
| `AWS_ACCESS_KEY_ID` | Access key temporal de AWS Academy |
| `AWS_SECRET_ACCESS_KEY` | Secret key asociada |
| `AWS_SESSION_TOKEN` | Token de sesión temporal (renovar cada ~4 horas) |

> ⚠️ Las credenciales de AWS Academy expiran cada pocas horas. Si el pipeline falla con `security token expired`, actualizar los 3 secrets desde **AWS Details → AWS CLI**.

---

## Tests implementados

| Servicio | Framework | Tests |
|---|---|---|
| Frontend | Vitest | 2 tests básicos de carga del entorno React |
| Backend Ventas | JUnit 5 + Mockito | 2 tests unitarios de VentaServiceImpl (persistencia y asignación de ID) |
| Backend Despachos | JUnit 5 + Spring Boot Test | Test de carga de contexto con perfil H2 en memoria |

Los backends usan `application-test.properties` con H2 en memoria para aislar los tests de la base de datos real.

---

## Contenedores y Docker

### Dockerfiles (multistage build)

**Frontend** (`front_despacho/Dockerfile`):
```dockerfile
# Stage 1: compilar React con Vite
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: servir con Nginx
FROM nginx:alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Backends** (mismo patrón para ventas y despachos):
```dockerfile
# Stage 1: compilar con Maven
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: imagen final solo con JRE
FROM eclipse-temurin:17-jre-alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
USER appuser
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
```

**Buenas prácticas aplicadas:**
- Imágenes base minimalistas (alpine)
- Usuario no-root en los 3 servicios
- Multistage build (no incluye dependencias de desarrollo en producción)
- `.dockerignore` para excluir archivos innecesarios

### Ejecución local con Docker Compose

```bash
# Levantar todos los servicios
docker-compose up --build

# Verificar que están corriendo
docker ps

# Acceder a la aplicación
# Frontend:      http://localhost
# API Ventas:    http://localhost:8080/api/v1/ventas
# API Despachos: http://localhost:8081/api/v1/despachos
```

---

## Autoscaling

Configurado en `innovatech-frontend-service` con **Target Tracking**:

| Parámetro | Valor | Justificación |
|---|---|---|
| Métrica | ECSServiceAverageCPUUtilization | Refleja la carga real del frontend |
| Umbral | 50% CPU | Margen para absorber picos sin sobre-provisionar |
| Tareas mínimas | 1 | Disponibilidad mínima garantizada |
| Tareas máximas | 3 | Capacidad máxima en entorno de laboratorio |
| Cooldown | 300 segundos | Evita oscilaciones rápidas |

---

## Seguridad

| Práctica | Implementación |
|---|---|
| Imágenes minimalistas | node:20-alpine, nginx:alpine, eclipse-temurin:17-jre-alpine |
| Usuario no-root | adduser appuser en los 3 Dockerfiles |
| SSH restringido | Puerto 22 abierto solo a IP del administrador |
| Secretos en GitHub Secrets | Credenciales AWS nunca en el código fuente |
| Variables de entorno en Task Definition | Credenciales de BD inyectadas en runtime |
| Principio mínimo privilegio | LabRole con permisos acotados a ECR/ECS |

---

## Estructura del repositorio

```
innovatech-devops/
├── .github/
│   └── workflows/
│       ├── cicd-frontend.yml         # Pipeline frontend con test
│       ├── cicd-ventas.yml           # Pipeline ventas con test
│       └── cicd-despachos.yml        # Pipeline despachos con test
├── back-Ventas_SpringBoot/
│   └── Springboot-API-REST/          # API REST Ventas (Spring Boot)
│       └── src/test/                 # Tests unitarios con Mockito
├── back-Despachos_SpringBoot/
│   └── Springboot-API-REST-DESPACHO/ # API REST Despachos (Spring Boot)
│       └── src/test/                 # Tests con Spring Boot Test
├── front_despacho/                   # Frontend React + Vite + Tailwind
│   └── src/__tests__/                # Tests con Vitest
├── docker-compose.yml                # Stack local completo
└── README.md
```

---

## Acceso al entorno en AWS

> Las IPs públicas cambian con cada reinicio del lab de AWS Academy.

```bash
# Conectarse a la instancia EC2
ssh -i keypair-innovatech-2.pem ec2-user@<IP_ACTUAL>

# Verificar contenedores corriendo
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Ver logs de un servicio
docker logs $(docker ps --filter "name=ventas" --format "{{.Names}}") --tail 50

# Si los contenedores no están corriendo
docker start mysql-db
aws ecs update-service --cluster innovatech-cluster --service innovatech-frontend-service --force-new-deployment --region us-east-1
aws ecs update-service --cluster innovatech-cluster --service innovatech-ventas-service --force-new-deployment --region us-east-1
aws ecs update-service --cluster innovatech-cluster --service innovatech-despachos-service --force-new-deployment --region us-east-1
```

---

## Problemas encontrados y soluciones

| Problema | Causa | Solución |
|---|---|---|
| `iam:CreateRole` denegado | AWS Academy bloquea creación de roles IAM | Cambio a EC2 launch type + LabRole como execution role |
| "missing attribute" en tareas ECS | Consola añade runtimePlatform incompatible | Task Definition en JSON con networkMode:bridge |
| URLs hardcodeadas rompían al cambiar IP | IP pública EC2 cambia con cada reinicio | Rutas relativas en React + Nginx reverse proxy a 172.17.0.1 |
| Instancias fantasma (AgentConnected: false) | IP nueva no actualiza registro ECS | deregister-container-instance --force + force-new-deployment |
| CloudWatch Logs bloqueado | LabRole sin permisos logs:PutLogEvents | docker logs como alternativa |
| Token AWS expirado en GitHub Actions | Tokens Academy duran ~4 horas | Actualización manual de Secrets |

---

## Oportunidades de mejora

1. **OIDC entre GitHub y AWS** — eliminar tokens de corta duración
2. **Caché de dependencias** (`actions/cache`) — reducir tiempo de pipeline ~40s
3. **Application Load Balancer** — URL estable, HTTPS, balanceo entre réplicas
4. **RDS administrado** — MySQL fuera del Container Instance con backups automáticos
5. **Matrix strategy en workflows** — unificar 3 workflows en 1
6. **Health check post-deploy** — verificación automática tras deploy
7. **AWS Secrets Manager** — gestión centralizada de credenciales de BD
