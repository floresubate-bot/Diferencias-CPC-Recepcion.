# Diferencias CPC vs Recepción 🌸

Aplicación Web Progresiva (PWA) de escritorio y móvil diseñada para analizar las diferencias entre la planificación de Pilotos (CPC) y la Recepción Real de flores semana a semana. Funciona completamente **sin conexión a internet (100% offline)**.

---

## 🚀 Cómo instalar y ejecutar en una computadora nueva (Súper Fácil)

Para que tú o cualquier otra persona instale y ejecute esta aplicación en su computadora, solo deben seguir estos **3 pasos sencillos**:

### Paso 1: Instalar Python
Si la computadora nueva no tiene Python instalado:
1. Descarga el instalador de Python para Windows desde aquí: [Python Downloads](https://www.python.org/downloads/).
2. Abre el instalador y **¡MUY IMPORTANTE!** marca la casilla al final que dice:
   **`[X] Add Python to PATH`** (Agregar Python al PATH).
3. Haz clic en **Install Now** y espera a que termine.

### Paso 2: Descargar este Proyecto de GitHub
1. Ve al repositorio en GitHub.
2. Haz clic en el botón verde **Code** (Código) y selecciona **Download ZIP** (Descargar ZIP).
3. Extrae el archivo ZIP descargado en cualquier carpeta de tu computadora (por ejemplo, en tus Documentos).

### Paso 3: Ejecutar la Aplicación
1. Abre la carpeta del proyecto que extrajiste.
2. Busca el archivo llamado **`iniciar.bat`** y hazle **doble clic**.
3. Se abrirá una pantalla negra que instalará automáticamente lo que haga falta, abrirá tu navegador de internet en la dirección de la app, e iniciará el servidor.
4. **¡Listo!** Ya puedes usar la aplicación. Para cerrarla, solo cierra la pantalla negra del terminal.

---

## 🛠️ ¿Qué archivos subir a tu repositorio de GitHub?

Para que la instalación funcione correctamente y otras personas puedan descargarla directamente, debes subir los siguientes archivos y carpetas a tu repositorio de GitHub:

1. **`app.py`** (El servidor de la aplicación)
2. **`requirements.txt`** (Las dependencias de librerías Python)
3. **`iniciar.bat`** (El script para abrir la app con doble clic)
4. **`README.md`** (Estas instrucciones)
5. **`templates/`** (La carpeta que contiene el archivo `index.html`)
6. **`static/`** (La carpeta con todos los estilos, scripts locales, manifest, service worker y el banner floral)
7. **`history.db`** (La base de datos SQLite. **Subir este archivo es altamente recomendado** porque contiene todo el histórico acumulado de las semanas que ya procesaste. Si no se sube, la app se iniciará limpia y vacía).

### 📝 Archivos que NO es necesario subir:
* Archivos `.xlsx` individuales (los Excel que procesas se guardan en la base de datos `history.db`, no hace falta subirlos todos a GitHub).

---

## 📱 Cómo instalar en móviles (Android / iOS)
Como es una Progressive Web App (PWA), puedes instalarla en tu celular cuando estás conectado a la misma red local (Wi-Fi) de tu computadora:

1. Abre el navegador de tu celular e ingresa la dirección IP de tu computadora (por ejemplo, `http://192.168.1.100:5001`).
2. **En iPhone (Safari)**: Pulsa el botón **Compartir** (cuadro con flecha arriba) y selecciona **Agregar a Inicio** (Add to Home Screen).
3. **En Android (Chrome)**: Pulsa los tres puntos de la esquina superior derecha y selecciona **Instalar aplicación** o **Agregar a la pantalla de inicio**.
4. Se creará un icono directo de flor en tu pantalla para abrirla como una app nativa, funcionando perfectamente offline.
