# Innovatech Chile — Orquestación y CI/CD en AWS ECS

**ISY1101 - Introducción a Herramientas DevOps | DuocUC 2025**
**Evaluación Parcial N°3 — Orquestación de contenedores y automatización con GitHub Actions**

Autoras: Johanna Gajardo y Jacqueline Guzmán

---

## 1. Descripción general

Este proyecto despliega la aplicación de Innovatech Chile (Frontend + 2 microservicios
Backend + Base de datos) sobre un clúster **Amazon ECS (EC2 launch type)**, con un
pipeline de **CI/CD automatizado mediante GitHub Actions** que construye, publica en
**Amazon ECR** y actualiza los servicios en ECS en cada cambio de código.

La solución corresponde a la **Fase 2** del proyecto de migración de Innovatech: tras
el levantamiento de infraestructura base en AWS (EP1) y la contenedorización de los
servicios (EP2), esta etapa introduce **orquestación, autoescalado y despliegue
continuo**, dejando la arquitectura lista para operar en un entorno productivo.

---

## 2. Arquitectura general

```
                         Internet
                            │
                            ▼
                ┌───────────────────────┐
                │   EC2 (innovatech-     │
                │   server) registrada   │
                │   en el clúster ECS    │
                │                        │
                │  ┌──────────────────┐  │
                │  │ ECS Agent        │  │
                │  └──────────────────┘  │
                │                        │
                │  Tareas ECS (Docker):  │
                │  ┌──────────────────┐  │
   :32768 ──────┼─▶│ frontend  (:80)  │  │
                │  └──────────────────┘  │
                │  ┌──────────────────┐  │
   :32769 ──────┼─▶│ ventas    (:8080)│──┼──┐
                │  └──────────────────┘  │  │
                │  ┌──────────────────┐  │  │
   :32770 ──────┼─▶│ despachos (:8081)│──┼──┤
                │  └──────────────────┘  │  │
                │                        │  ▼
                │  ┌──────────────────┐  │ ┌────────────┐
                │  │ MySQL  (:3306)   │◀─┼─┤  innovatech│
                │  └──────────────────┘  │ │  database  │
                └───────────────────────┘ └────────────┘

       ECR (Elastic Container Registry)
   ┌─────────────────────────────────────┐
   │ innovatech-frontend:latest           │
   │ innovatech-ventas:latest             │
   │ innovatech-despachos:latest          │
   └─────────────────────────────────────┘
                ▲
                │ docker push
   ┌─────────────────────────────────────┐
   │ GitHub Actions (CI/CD)               │
   │ checkout → build → push ECR         │
   └─────────────────────────────────────┘
                ▲
                │ git push
   ┌─────────────────────────────────────┐
   │ Repositorio GitHub innovatech-devops │
   └─────────────────────────────────────┘
```

### Componentes principales

| Componente | Descripción |
|---|---|
| **VPC / Subred pública** | Red heredada de la fase EP1 (Lift & Shift), con Internet Gateway y NAT Gateway. |
| **Clúster ECS** (`innovatech-cluster`) | Tipo de lanzamiento **EC2**. Agrupa la(s) instancia(s) que ejecutan el ECS Agent. |
| **Instancia EC2** (`innovatech-server`) | Amazon Linux 2023, con Docker, AWS CLI y el agente ECS registrados al clúster. Usa el rol `LabRole` (IAM) para autenticarse contra ECR y ECS. |
| **Task Definitions** | `innovatech-frontend-td` (puerto dinámico `hostPort: 0`), `innovatech-ventas-td` y `innovatech-despachos-td` (puertos **fijos** `hostPort: 8080`/`8081`). Modo de red `bridge`. |
| **Networking interno (Nginx reverse proxy)** | El contenedor `frontend` sirve la SPA y reenvía `/api/v1/ventas` y `/api/v1/despachos` vía `proxy_pass` a `172.17.0.1:8080`/`:8081` — la IP de gateway de Docker, que siempre resuelve al host sin importar la IP pública de la EC2. El código React usa rutas **relativas** (`/api/v1/...`), no URLs absolutas. |
| **Servicios ECS** | `innovatech-frontend-service`, `innovatech-ventas-service`, `innovatech-despachos-service`. Cada uno mantiene 1 tarea (réplica) corriendo y la reemplaza automáticamente si falla. |
| **Amazon ECR** | Repositorios privados `innovatech-frontend`, `innovatech-ventas`, `innovatech-despachos`. |
| **MySQL** | Contenedor persistente con volumen de datos, usado por ambos backends. |
| **GitHub Actions** | 3 workflows independientes (uno por servicio), activados por cambios en su respectiva carpeta. |

> **Decisión de diseño — comunicación Front → Back:** inicialmente el frontend
> apuntaba a la IP pública y puerto dinámico de cada backend, lo que rompía cada
> vez que cambiaba la sesión de AWS Academy. Se migró a **rutas relativas +
> reverse proxy de Nginx**, fijando además los puertos de host de ventas (8080)
> y despachos (8081) en sus Task Definitions. Así, el frontend funciona sin
> reconstrucción sin importar qué IP pública tenga la EC2 ese día — el mismo
> patrón que cumpliría un Application Load Balancer en un entorno productivo.

---

## 3. Justificación: Lift & Shift vs. otras estrategias de migración

| Estrategia | Descripción | ¿Por qué no se eligió para Innovatech? |
|---|---|---|
| **Rehost (Lift & Shift)** ✅ | Migrar la infraestructura "tal cual" a la nube, con cambios mínimos. | **Elegida.** Permite a Innovatech mover rápidamente su entorno on-premise a AWS, reduciendo tiempo y riesgo de migración, mientras se evalúa la modernización en fases posteriores. |
| **Replatform** | Migrar haciendo pequeñas optimizaciones (ej. cambiar la base de datos a un servicio administrado como RDS). | Habría aumentado el alcance del proyecto en una etapa donde el objetivo era validar la arquitectura base (POC), no optimizar servicios gestionados todavía. |
| **Refactor / Re-architect** | Rediseñar la aplicación para aprovechar capacidades nativas de la nube (microservicios, serverless, etc.). | Implica mayor tiempo, costo y riesgo. No es razonable como primer paso para una empresa que recién está migrando desde on-premise. |

**Conclusión:** Lift & Shift es la estrategia más adecuada para la **fase inicial** de
Innovatech porque minimiza el riesgo de la migración y permite mantener el negocio
operativo mientras se valida el entorno en AWS. Las fases posteriores (EP2 y EP3) ya
incorporan elementos de **Replatform** —contenedorización, orquestación con ECS y
CI/CD— preparando el camino hacia una arquitectura más moderna sin necesidad de un
Refactor completo.

---

## 4. Principios DevOps aplicados

| Principio | Cómo se aplica en este proyecto |
|---|---|
| **Automatización** | Pipelines de GitHub Actions construyen y publican las imágenes Docker automáticamente en cada push a `main`. |
| **Infraestructura como código (IaC)** | Las Task Definitions de ECS están versionadas como JSON y pueden recrearse de forma reproducible. |
| **CI/CD** | Flujo `commit → build → push a ECR → actualización del servicio ECS`. |
| **Contenedores (Docker)** | Los 3 servicios (frontend, ventas, despachos) corren en contenedores Docker, gestionados por ECS. |
| **Orquestación** | ECS mantiene el número deseado de tareas, las reinicia si fallan y permite autoescalado. |
| **Autoescalado** | Política de *Target Tracking* basada en uso de CPU (ver sección 6). |
| **Monitoreo** | CloudWatch recibe métricas de CPU/memoria de las tareas ECS, usadas por la política de autoescalado. |
| **Gestión segura de acceso** | Administración de la instancia vía SSH y rol IAM (`LabRole`) con permisos acotados a ECS/ECR. |

---

## 5. Pipeline CI/CD

Cada microservicio tiene su propio workflow en `.github/workflows/`:

- `cicd-frontend.yml` → se activa con cambios en `front_despacho/**`
- `cicd-ventas.yml` → se activa con cambios en `back-Ventas_SpringBoot/**`
- `cicd-despachos.yml` → se activa con cambios en `back-Despachos_SpringBoot/**`

### Flujo de cada pipeline

1. **Checkout** del código del repositorio.
2. **Configurar credenciales AWS** (`aws-actions/configure-aws-credentials`).
3. **Login en Amazon ECR** (`aws-actions/amazon-ecr-login`).
4. **Build de la imagen Docker** del servicio correspondiente.
5. **Push de la imagen** a su repositorio en ECR con tag `latest`.

### Despliegue en ECS

Tras una ejecución exitosa del pipeline, el despliegue en ECS se realiza:

```bash
# 1. Descargar la nueva imagen en la instancia del clúster
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin 863069581230.dkr.ecr.us-east-1.amazonaws.com

docker pull 863069581230.dkr.ecr.us-east-1.amazonaws.com/innovatech-frontend:latest

# 2. Forzar una nueva implementación del servicio ECS
# (Servicios → innovatech-frontend-service → Actualizar servicio → Forzar nueva implementación)
```

ECS sustituye la tarea en ejecución por una nueva con la imagen actualizada,
manteniendo el servicio disponible durante la actualización (rolling update).

### Secrets configurados en GitHub

| Secret | Descripción |
|---|---|
| `AWS_ACCESS_KEY_ID` | Access key de las credenciales temporales de AWS Academy. |
| `AWS_SECRET_ACCESS_KEY` | Secret key asociada. |
| `AWS_SESSION_TOKEN` | Token de sesión temporal (STS), requerido por AWS Academy. |

> ⚠️ Las credenciales de AWS Academy expiran cada pocas horas. Si el pipeline falla
> con `"security token included in the request is expired"`, deben actualizarse los
> 3 secrets con los valores vigentes de **AWS Details → AWS CLI**.

---

## 6. Autoescalado (Auto Scaling)

Se configuró **Service Auto Scaling** en `innovatech-frontend-service` mediante una
política de **Target Tracking**:

| Parámetro | Valor | Justificación |
|---|---|---|
| Métrica | `ECSServiceAverageCPUUtilization` | Refleja directamente la carga de procesamiento del contenedor frontend. |
| Valor objetivo | **50%** | Deja margen suficiente para absorber picos de tráfico antes de saturar la tarea, sin sobre-provisionar recursos en períodos de baja demanda. |
| Tareas mínimas | 1 | Garantiza disponibilidad mínima del servicio. |
| Tareas máximas | 3 | Permite triplicar la capacidad ante aumentos de demanda, manteniendo costos acotados dentro del entorno de laboratorio. |
| Cooldown (escalado/desescalado) | 300 segundos | Evita oscilaciones rápidas (scaling flapping) ante variaciones momentáneas de CPU. |

Cuando el uso promedio de CPU del servicio supera el 50%, ECS lanza
automáticamente tareas adicionales (hasta el máximo configurado). Cuando la
demanda disminuye y el uso de CPU cae por debajo del umbral durante el período de
recuperación, ECS reduce el número de tareas hasta el mínimo definido.

---

## 7. Estructura del repositorio

```
innovatech-devops/
├── .github/workflows/
│   ├── cicd-frontend.yml
│   ├── cicd-ventas.yml
│   └── cicd-despachos.yml
├── back-Ventas_SpringBoot/
│   └── Springboot-API-REST/        → API REST Ventas (puerto 8080)
├── back-Despachos_SpringBoot/
│   └── Springboot-API-REST-DESPACHO/ → API REST Despachos (puerto 8081)
├── front_despacho/                  → Frontend React + Vite + Tailwind
├── docker-compose.yml               → Stack completo para ejecución local
└── README.md
```

---

## 8. Ejecución local (desarrollo)

Para levantar el stack completo en un entorno local con Docker Compose:

```bash
docker-compose up --build

# Frontend:       http://localhost
# API Ventas:     http://localhost:8080/api/v1/ventas
# API Despachos:  http://localhost:8081/api/v1/despachos
# MySQL:          localhost:3306
```

---

## 9. Acceso al entorno desplegado en AWS

> Las URLs e IPs públicas de AWS Academy cambian cada vez que se inicia una nueva
> sesión de laboratorio. Los valores siguientes corresponden a la sesión activa al
> momento de la presentación y se actualizan según corresponda.

| Servicio | URL | Endpoint de prueba |
|---|---|---|
| Frontend | `http://54.197.116.241:32768` | — |
| API Ventas | `http://54.197.116.241:32769` | `/api/v1/ventas` |
| API Despachos | `http://54.197.116.241:32770` | `/api/v1/despachos` |

### Administración de la instancia

```bash
ssh -i keypair-innovatech-2.pem ec2-user@54.197.116.241
```

- Verificar contenedores activos: `docker ps`
- Ver el agente ECS: `docker logs ecs-agent`

---

## 10. Seguridad

- **Acceso administrativo** mediante SSH con par de llaves (`keypair-innovatech-2.pem`).
- **Rol IAM `LabRole`** asignado a la instancia EC2 y a las Task Definitions,
  otorgando únicamente los permisos necesarios para interactuar con ECR y ECS
  (principio de mínimo privilegio dentro de las restricciones de AWS Academy).
- **Security Groups** configurados para exponer solo los puertos necesarios
  (SSH 22, HTTP 80, rango de puertos dinámicos de ECS 32768-65535, y los puertos
  internos de las APIs y MySQL).
- **Variables de entorno** (credenciales de base de datos) definidas a nivel de
  Task Definition, evitando hardcodearlas en las imágenes Docker.
- **Secrets de GitHub** para credenciales de AWS, nunca expuestas en el código
  fuente del repositorio.

---

## 11. Problemas encontrados y soluciones

| Problema | Causa | Solución |
|---|---|---|
| `iam:CreateRole` denegado al crear Task Definitions con Fargate | AWS Academy no permite crear roles IAM nuevos. | Se cambió el tipo de lanzamiento a **EC2** y se reutilizó el rol existente `LabRole`. |
| `was unable to place a task ... missing an attribute` | El modo de red `awsvpc` y el campo `runtimePlatform` generado automáticamente requerían atributos no soportados por el agente ECS de la instancia. | Se redefinió la Task Definition vía JSON con `networkMode: bridge` y sin `runtimePlatform`. |
| `ECS Deployment Circuit Breaker was triggered` | Conflictos de puertos y configuración incompatible en revisiones anteriores de la Task Definition. | Se ajustaron los mapeos de puertos (`hostPort: 0`, puertos dinámicos) y se forzó una nueva implementación tras corregir el JSON. |
| `Error: The security token included in the request is expired` en GitHub Actions | Las credenciales temporales de AWS Academy expiran cada pocas horas. | Se actualizaron los secrets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` y `AWS_SESSION_TOKEN` en GitHub con las credenciales vigentes. |
| `npm install` falla con `SIGBUS` en `@swc/core` | Error intermitente de recursos en el runner de GitHub Actions durante la compilación del frontend. | Se reintentó la ejecución del pipeline, completándose exitosamente. |
| Frontend no se conectaba a los backends tras el despliegue en ECS | El código del frontend apuntaba a `localhost:8080` / `localhost:8081`. | Se actualizaron las URLs de las APIs en el código del frontend a la IP pública y puertos dinámicos asignados por ECS, y se reconstruyó la imagen vía pipeline. |
| Servicios ECS con `desiredCount: 1` pero `runningCount: 0` tras reiniciar la sesión de AWS Academy | Cada reinicio de sesión recrea la instancia EC2 con una IP nueva, pero el clúster ECS conserva el registro de la *Container Instance* anterior. Con hasta 5 registros acumulados (`AgentConnected: false`), ECS intentaba ubicar las tareas en instancias ya inexistentes y fallaba silenciosamente. | Se identificaron las instancias con `aws ecs describe-container-instances` (campo `agentConnected: false`) y se eliminaron con `aws ecs deregister-container-instance --force`, dejando solo la instancia activa real. Tras esto, `aws ecs update-service --force-new-deployment` desplegó las 3 tareas correctamente. |
| El frontend mostraba tablas vacías aunque la API tenía datos | El código usaba URLs absolutas con la IP pública del día (`http://X.X.X.X:8080`), que dejaban de existir en cada reinicio de sesión de AWS Academy. | Se migró el frontend a **rutas relativas** (`/api/v1/...`) y se configuró **Nginx como reverse proxy** hacia `172.17.0.1:8080`/`:8081` (gateway de Docker), fijando además los puertos de host de los backends en sus Task Definitions. Verificado insertando un registro de prueba en MySQL y confirmando que aparece en la interfaz. |

> **Nota operativa:** cada vez que se reinicia el Lab de AWS Academy (nueva IP pública,
> nuevas credenciales), conviene verificar el número de *Container Instances*
> registradas en el clúster antes de forzar un nuevo despliegue:
> `aws ecs list-container-instances --cluster innovatech-cluster --region us-east-1`.
> Si hay más de una con `agentConnected: false`, deben eliminarse para que ECS
> pueda ubicar las tareas en la instancia vigente.

---

## 12. Evaluación del pipeline y oportunidades de mejora

Como parte del proceso de mejora continua, se analizó el desempeño histórico de las
ejecuciones de los 3 pipelines (ver pestaña *Actions* del repositorio).

### Tiempos de ejecución observados

| Pipeline | Tiempo típico (ejecución exitosa) | Observación |
|---|---|---|
| CI/CD Backend Ventas | ~1m 24s | Incluye build de imagen Maven/Spring Boot (la más pesada de las tres). |
| CI/CD Backend Despachos | ~1m 10s | Similar al anterior, build de imagen Java. |
| CI/CD Frontend | 30s – 43s en ejecuciones exitosas | Build de imagen Node/Vite, más liviana. |

### Pasos redundantes identificados

- **Sin caché de dependencias:** cada ejecución vuelve a descargar las dependencias
  de Maven (`.m2`) y de npm (`node_modules`) desde cero, lo que aumenta
  innecesariamente el tiempo de build.
- **Despliegue manual a EC2:** actualmente, tras el `docker push` a ECR, la
  actualización del servicio ECS (`pull` + `forzar nueva implementación`) se realiza
  manualmente. Esto rompe el flujo *build → push → deploy* totalmente automatizado.
- **Credenciales de corta duración:** al usar credenciales temporales de AWS Academy
  (`AWS_SESSION_TOKEN`), los secrets deben actualizarse manualmente cada pocas horas,
  generando fallos evitables en el pipeline (`security token included in the request
  is expired`).

### Errores de ejecución detectados durante el desarrollo

| Error | Frecuencia | Tipo |
|---|---|---|
| `security token included in the request is expired` | 3 ejecuciones | Configuración / credenciales (externo al código) |
| `npm install` falla con `SIGBUS` en `@swc/core` | 1 ejecución | Intermitente del runner, se resolvió con reintento |
| `ssh: handshake failed` (paso de deploy por SSH) | 2 ejecuciones | Enfoque de despliegue descartado y simplificado |

### Oportunidades de optimización propuestas

1. **Agregar caché de dependencias** con `actions/cache` para Maven (`~/.m2`) y npm
   (`node_modules`), reduciendo el tiempo de build de los backends.
2. **Automatizar el paso de despliegue** agregando al workflow un paso final que
   ejecute `aws ecs update-service --force-new-deployment` directamente desde
   GitHub Actions (usando el rol IAM), eliminando el paso manual por SSH.
3. **Unificar los 3 workflows** en uno solo con *matrix strategy*, reduciendo
   duplicación de configuración entre frontend, ventas y despachos.
4. **Migrar a OIDC (OpenID Connect)** entre GitHub Actions y AWS para evitar el uso
   de `AWS_SESSION_TOKEN` de corta duración, una vez se cuente con una cuenta AWS
   fuera del entorno Academy.
5. **Agregar un paso de verificación post-despliegue** (health check vía `curl` al
   endpoint del servicio) para confirmar automáticamente que el nuevo contenedor
   responde antes de marcar el despliegue como exitoso.

---

## 13. Conclusiones

La migración de Innovatech Chile evolucionó desde una infraestructura básica en EC2
(EP1) hacia un entorno **contenerizado y orquestado** mediante Amazon ECS, con
**despliegue continuo automatizado** desde GitHub Actions y **autoescalado basado en
CPU**. Esta arquitectura permite que la aplicación escale de forma automática ante
aumentos de demanda, se recupere ante fallos sin intervención manual, y que cada
cambio de código se refleje en el entorno productivo de forma rápida y consistente,
sentando las bases para una futura adopción de prácticas de monitoreo y
observabilidad más avanzadas (CloudWatch Logs, alarmas, dashboards).