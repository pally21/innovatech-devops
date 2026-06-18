# Checklist EP3 - Verificacion Innovatech

## 1. Antes de validar

Actualizar credenciales temporales de AWS Academy:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`

Actualizarlas en:

- Terminal local, si se validara con AWS CLI.
- GitHub Repository Secrets, si se ejecutaran workflows.

Comando base:

```bash
aws sts get-caller-identity
```

Debe responder con `Account`, `Arn` y `UserId`. Si aparece `ExpiredToken`, renovar credenciales desde AWS Academy.

## 2. Evidencia del cluster ECS

```bash
aws ecs list-clusters --region us-east-1
aws ecs describe-clusters --clusters innovatech-cluster --region us-east-1
```

Capturar:

- Cluster `innovatech-cluster` activo.
- Servicios asociados.
- Instancia/Capacity Provider/EC2 registrada, segun la arquitectura usada.

## 3. Evidencia de servicios ECS

```bash
aws ecs describe-services \
  --cluster innovatech-cluster \
  --services innovatech-frontend-service innovatech-ventas-service innovatech-despachos-service \
  --region us-east-1
```

Validar:

- `status: ACTIVE`
- `desiredCount >= 1`
- `runningCount >= 1`
- despliegue estable despues de `force-new-deployment`

## 4. Evidencia de imagenes ECR

```bash
aws ecr describe-repositories --region us-east-1

aws ecr describe-images \
  --repository-name innovatech-frontend \
  --region us-east-1

aws ecr describe-images \
  --repository-name innovatech-ventas \
  --region us-east-1

aws ecr describe-images \
  --repository-name innovatech-despachos \
  --region us-east-1
```

Capturar:

- Repositorios `innovatech-frontend`, `innovatech-ventas`, `innovatech-despachos`.
- Imagen `latest` publicada.
- Fecha/hora de push reciente.

## 5. Evidencia de funcionamiento

Reemplazar IP/puerto por los valores actuales de AWS Academy:

```bash
curl -I http://IP_PUBLICA:PUERTO_FRONTEND
curl http://IP_PUBLICA:PUERTO_VENTAS/api/v1/ventas
curl http://IP_PUBLICA:PUERTO_DESPACHOS/api/v1/despachos
```

Validar:

- Frontend responde HTTP 200.
- API Ventas responde JSON o arreglo.
- API Despachos responde JSON o arreglo.
- Desde el frontend se pueden listar ventas y crear/cerrar despachos.

## 6. Evidencia CI/CD GitHub Actions

Hacer un commit explicativo y push:

```bash
git add .
git commit -m "fix: automatiza deploy ECS y estabiliza verificacion local"
git push origin main
```

Capturar en GitHub Actions:

- Workflow ejecutado por push.
- Pasos `Build and push image to ECR`.
- Paso `Deploy to ECS`.
- Duracion total del pipeline.

## 7. Evidencia de logs y metricas

En AWS:

- ECS Service events: mostrar redeploy y tareas reemplazadas.
- CloudWatch Metrics: CPU/memoria del servicio.
- CloudWatch Logs o logs del contenedor: solicitudes/respuestas del backend.
- Auto Scaling: politica Target Tracking, minimo, maximo y objetivo CPU.

## 8. Frase para defensa

La arquitectura usa Amazon ECS con imagenes privadas en ECR. GitHub Actions automatiza el flujo `checkout -> build -> push -> update-service`, y ECS aplica rolling deployment reemplazando tareas sin detener el servicio. El frontend consume rutas relativas `/api/v1/...`, y Nginx enruta esas llamadas hacia los backends, permitiendo demostrar comunicacion Front -> Back, despliegue automatizado, recuperacion ante redeploy y monitoreo mediante metricas/logs de AWS.
