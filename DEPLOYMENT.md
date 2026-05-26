# Deployment en Hostinger con Docker

## Prerequisitos
- Git instalado
- Docker y Docker Compose en el servidor de Hostinger

## Pasos para desplegar

### 1. Clonar el repositorio
```bash
git clone https://github.com/Siesua-Sistemas/control_inventarios.git
cd control_inventarios
```

### 2. Configurar variables de entorno
Copia `.env.example` a `.env` y edita los valores:
```bash
cp .env.example .env
```

**Variables críticas a configurar:**
```
DATABASE_URL=postgresql+psycopg2://postgres:PASSWORD@postgres:5432/inventory
SECRET_KEY=cambiar-esto-a-algo-seguro
REFRESH_SECRET_KEY=cambiar-esto-a-algo-seguro
POSTGRES_DB=inventory
POSTGRES_USER=postgres
POSTGRES_PASSWORD=cambiar-esto-a-una-contraseña-fuerte
SEED_ADMIN_PASSWORD=contraseña-inicial-admin
NEXT_PUBLIC_API_URL=https://tu-dominio.com/api
CORS_ORIGINS=https://tu-dominio.com
```

### 3. Construir y levantar los contenedores
```bash
docker-compose up -d
```

Esto levantará:
- Backend (FastAPI) en puerto 8000
- Frontend (Next.js) en puerto 3000
- PostgreSQL en puerto 5432
- Redis en puerto 6379

### 4. Verificar estado
```bash
docker-compose ps
docker-compose logs -f
```

### 5. Configurar reverse proxy (Nginx/Apache)
Si usas Nginx, configura:
```nginx
upstream backend {
    server localhost:8000;
}

upstream frontend {
    server localhost:3000;
}

server {
    listen 80;
    server_name tu-dominio.com;

    location /api/ {
        proxy_pass http://backend/;
    }

    location / {
        proxy_pass http://frontend;
    }
}
```

## Solución de problemas

### Error: "No such image: control_inventarios/backend"
- Asegúrate de que Docker esté corriendo
- Ejecuta `docker-compose build` para compilar las imágenes localmente

### Error: Variables de entorno no configuradas
- Verifica que `.env` exista en la raíz del proyecto
- Confirma que contenga todos los valores requeridos

### PostgreSQL no inicia
- Verifica permisos de volumen: `docker-compose exec postgres ls -la /var/lib/postgresql/data`
- Revisa logs: `docker-compose logs postgres`

## Actualizar a nueva versión
```bash
git pull origin main
docker-compose up -d --build
```

## Detener los servicios
```bash
docker-compose down
```
