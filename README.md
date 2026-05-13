# Innovatech Chile - Despliegue con Docker y CI/CD

**ISY1101 - Introducción a Herramientas DevOps | DuocUC 2025**

## Descripción
Aplicación de microservicios con pipeline CI/CD completo usando Docker, GitHub Actions y Docker Hub.

## Estructura
├── back-Ventas_SpringBoot/      → API REST Spring Boot (puerto 8080)
├── back-Despachos_SpringBoot/   → API REST Spring Boot (puerto 8081)
├── front_despacho/              → Frontend React + Vite + Tailwind
├── docker-compose.yml           → Stack completo local
└── .github/workflows/           → 3 pipelines CI/CD
## Ejecución local
```bash
docker-compose up --build
# Frontend: http://localhost
# API Ventas: http://localhost:8080
# API Despachos: http://localhost:8081
```

## Pipeline CI/CD
Se activa con push a la rama deploy → build → push Docker Hub

## Autores
- [Tu nombre] - [RUT]
- [Nombre compañero] - [RUT]
# deploy
