/* ============================================================
   1. CONFIGURACIÓN INICIAL Y ESTADO GLOBAL
   ============================================================ */
let mediaRecorder;
let chunks = [];
let startTime;
let timerInterval;
let extension = "mp4"; 
let mimeType = "audio/mp4";
let currentMemoryId = null;

// Gestión de Identidad del Usuario
let userId = localStorage.getItem("briefly_userId");
if (!userId) {
    userId = "brief_user_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("briefly_userId", userId);
}

const LAMBDA_URL = "https://av7j43vj2aj7azcj57dpinyx3i0nccew.lambda-url.eu-west-3.on.aws/";

const preguntas = [
    "¿Cuáles son los objetivos principales de este proyecto?",
    "Resume los acuerdos alcanzados en la reunión con el cliente.",
    "Describe las tareas pendientes y quién es el responsable de cada una.",
    "¿Qué obstáculos se han identificado en el desarrollo actual?",
    "Estructura el roadmap para el siguiente sprint."
];

/* ============================================================
   2. NAVEGACIÓN Y CONTROL DE OVERLAYS (MODALES)
   ============================================================ */

function abrirInicio() {
    const overlay = document.getElementById("startOverlay");
    if (overlay) {
        overlay.classList.remove("hidden-by-default");
        overlay.style.setProperty("display", "flex", "important");
        document.body.style.overflow = "hidden";
    }
}

function cerrarInicio() {
    const overlay = document.getElementById("startOverlay");
    if (overlay) {
        overlay.style.display = "none";
        document.body.style.overflow = "auto";
    }
}

function abrirPregunta() {
    // 1. Ocultamos el selector de contexto
    const startOverlay = document.getElementById("startOverlay");
    if (startOverlay) startOverlay.style.display = "none";

    // 2. Mostramos el overlay de la pregunta/guía
    const questionOverlay = document.getElementById("questionOverlay");
    if (questionOverlay) {
        // Elegimos contexto aleatorio de la lista
        const textoPregunta = document.getElementById("pregunta-texto");
        textoPregunta.innerText = preguntas[Math.floor(Math.random() * preguntas.length)];
        
        // Forzamos visibilidad
        questionOverlay.classList.remove("hidden-by-default");
        questionOverlay.style.setProperty("display", "flex", "important");
    }
}
function cerrarPregunta() {
    document.getElementById("questionOverlay").style.display = "none";
    document.body.style.overflow = "auto";
}

function cambiarPregunta() {
    const textoPregunta = document.getElementById("pregunta-texto");
    textoPregunta.innerText = preguntas[Math.floor(Math.random() * preguntas.length)];
}

/* ============================================================
   3. FLUJO DE GRABACIÓN DE AUDIO (MediaRecorder)
   ============================================================ */

async function iniciarProcesoGrabacion() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = "audio/webm";
            extension = "webm";
        }

        mediaRecorder = new MediaRecorder(stream, { mimeType });
        chunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            procesarAudioSubida();
            stream.getTracks().forEach(track => track.stop());
        };

        // --- FORZAR INTERFAZ DE GRABACIÓN ---
        const recordOverlay = document.getElementById("recordOverlay");
        if (recordOverlay) {
            recordOverlay.classList.remove("hidden-by-default");
            recordOverlay.style.setProperty("display", "flex", "important");
            
            // Asegurar que el estado visual sea el de "grabando"
            document.getElementById("estado-texto").innerText = "Capturando audio de la reunión...";
            document.querySelector(".record-actions-grabando").style.display = "block";
            document.querySelector(".record-actions-final").classList.add("hidden-by-default");
        }
        
        resetCronometro();
        startCronometro();
        mediaRecorder.start();
        mostrarMensaje("Grabación iniciada...");

    } catch (err) {
        console.error("Error al acceder al micro:", err);
        alert("Verifica los permisos del micrófono.");
    }
}
function iniciarHablarLibre() {
    cerrarInicio();
    iniciarProcesoGrabacion();
}

function empezarGrabacionDesdePregunta() {
    // Cerramos el modal de pregunta antes de iniciar el micro
    const questionOverlay = document.getElementById("questionOverlay");
    if (questionOverlay) questionOverlay.style.display = "none";
    
    // Llamamos al proceso de hardware
    iniciarProcesoGrabacion();
}

function pararGrabacion() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
        resetCronometro();
        document.getElementById("estado-texto").innerText = "Procesando audio en AWS...";
    }
}

/* ============================================================
   4. CRONÓMETRO Y UTILIDADES DE RELOJ
   ============================================================ */

function startCronometro() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const seconds = Math.floor((Date.now() - startTime) / 1000);
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        document.getElementById("cronometro").innerText = `${mins}:${secs}`;
    }, 1000);
}

function resetCronometro() {
    clearInterval(timerInterval);
    document.getElementById("cronometro").innerText = "00:00";
}

/* ============================================================
   5. COMUNICACIÓN CON BACKEND (S3, DynamoDB, Lambda)
   ============================================================ */

async function procesarAudioSubida() {
    const blob = new Blob(chunks, { type: mimeType });
    const nombre = `briefing_${Date.now()}.${extension}`;
    mostrarMensaje("Subiendo audio a S3...");

    try {
        const response = await fetch(`${LAMBDA_URL}?accion=subir&nombre=${nombre}&usuario=${userId}`);
        const data = await response.json();
        
        const form = new FormData();
        Object.entries(data.datos_subida.fields).forEach(([k, v]) => form.append(k, v));
        form.append("file", blob);
        
        // Esperamos a que la subida a S3 termine antes de registrar
        await fetch(data.datos_subida.url, { method: "POST", body: form });

        const r2 = await fetch(`${LAMBDA_URL}?accion=registrar_audio&nombre=${nombre}&usuario=${userId}`);
        const d2 = await r2.json();

        // Unificamos la referencia al ID
        currentMemoryId = d2.id_reunion || d2.id_recuerdo; 
        
        mostrarUIFinalizado();
        mostrarMensaje("Reunión registrada");

        // Disparar transcripción sin bloquear la UI
        fetch(`${LAMBDA_URL}?accion=transcribir&id=${currentMemoryId}&nombre=${nombre}&usuario=${userId}&formato=${extension}`);

    } catch (error) {
        console.error("Error en el flujo de subida:", error);
        mostrarMensaje("Error en la subida");
        // Restaurar UI en caso de error
        document.getElementById("recordOverlay").style.display = "none";
    }
}
function mostrarUIFinalizado() {
    document.getElementById("estado-texto").innerText = "¡Listo! Briefing guardado.";
    document.querySelector(".record-actions-grabando").classList.add("hidden-by-default");
    document.querySelector(".record-actions-final").classList.remove("hidden-by-default");
}

/* ============================================================
   6. HISTORIAL DE REUNIONES Y LISTADO
   ============================================================ */

function abrirRecuerdos() {
    const overlay = document.getElementById('memoriesOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        document.body.style.overflow = "hidden";
        cargarHistorialReuniones();
    }
}

function cerrarRecuerdos() {
    document.getElementById("memoriesOverlay").style.display = "none";
    document.body.style.overflow = "auto";
}

async function cargarHistorialReuniones() {
    const contenedor = document.getElementById("memoriesList");
    contenedor.innerHTML = "<p>Consultando base de datos...</p>";

    try {
        const response = await fetch(`${LAMBDA_URL}?accion=listar&usuario=${userId}`);
        console.log("RESPONSE:", response);

        if (!response.ok) throw new Error("Error en servidor");

        const data = await response.json();
        console.log("DATA LISTAR:", data);

        renderizarListaBriefings(data.recuerdos || []);
    } catch (error) {
        console.error("Error cargando historial:", error);
        contenedor.innerHTML = `<p style="color:red;">Fallo al cargar: ${error.message}</p>`;
    }
}


function renderizarListaBriefings(lista) {
    const contenedor = document.getElementById("memoriesList");
    if (!contenedor) return;

    contenedor.innerHTML = ""; 

    if (!lista || lista.length === 0) {
        const mensaje = document.createElement("p");
        mensaje.className = "empty-list-message";
        mensaje.innerText = "No hay briefings registrados.";
        contenedor.appendChild(mensaje);
        return;
    }

    lista.forEach(item => {
        console.log("ITEM:", item); // 👈 para ver estructura real

        const card = document.createElement("div");
        card.className = "memory-card";

        // Campos tolerantes a distintos nombres
        const fechaRaw = item.fecha || item.created_at || item.timestamp || Date.now();
        const fechaFormateada = new Date(fechaRaw).toLocaleDateString();

        const titulo = item.titulo || item.title || "Sesión sin título";
        const estado = item.estado || item.status || "PENDIENTE";
        const id = item.id_real || item.id || item.id_recuerdo || item.id_reunion;

        card.innerHTML = `
            <span class="memory-date">${fechaFormateada}</span>
            <strong class="card-title">${titulo}</strong>
            <div class="card-status-row">
                <span class="badge">${estado}</span>
            </div>
            <div class="card-actions">
                <button class="btn-action" onclick="verDetalleBriefing('${id}')">
                    Ver Acta
                </button>
            </div>
        `;

        contenedor.appendChild(card);
    });
}

/* ============================================================
   7. DETALLE DEL ACTA E INTELIGENCIA ARTIFICIAL
   ============================================================ */

async function verDetalleBriefing(id) {
    currentMemoryId = id;
    document.getElementById('memoryDetailOverlay').style.display = 'flex';
    document.getElementById('memoryDetailText').innerHTML = "Cargando...";
    cerrarRecuerdos();

    try {
        const response = await fetch(`${LAMBDA_URL}?accion=leer&id=${id}&usuario=${userId}`);
        const info = await response.json();
        document.getElementById('memoryDetailTitle').innerText = info.titulo || "Briefing";
        
        if (info.estado === "COMPLETADO") {
            document.getElementById('memoryDetailText').innerHTML = info.texto;
        } else {
            document.getElementById('memoryDetailText').innerHTML = `<p>Procesando... Pulsa el botón para analizar.</p>`;
            document.getElementById("premiumActions").classList.remove("hidden-by-default");
        }
    } catch (e) {
        document.getElementById('memoryDetailText').innerHTML = "Error al cargar.";
    }
}

async function ejecutarTranscripcionReal() {
    const btn = document.getElementById("btnTranscribe");
    btn.disabled = true;
    btn.innerHTML = "🤖 Analizando...";

    try {
        const response = await fetch(`${LAMBDA_URL}?accion=mejorar&usuario=${userId}&id=${currentMemoryId}`);
        if (response.ok) {
            mostrarMensaje("Análisis finalizado");
            pollResultado(currentMemoryId); 
        }
    } catch (error) {
        alert("Fallo IA: " + error.message);
        btn.disabled = false;
    }
}

function pollResultado(id) {
    const int = setInterval(async () => {
        try {
            const r = await fetch(`${LAMBDA_URL}?accion=leer&id=${id}&usuario=${userId}`);
            if (!r.ok) return; // Si hay error de red, esperamos al siguiente ciclo

            const info = await r.json();
            const textEl = document.getElementById("memoryDetailText");

            if (info.estado === "COMPLETADO") {
                clearInterval(int);
                textEl.innerHTML = info.texto;
                document.getElementById('memoryDetailTitle').innerText = info.titulo;
                document.getElementById("premiumActions").classList.add("hidden-by-default");
            } else {
                // Mensaje dinámico para que el usuario sepa que sigue procesando
                textEl.innerHTML = "Generando acta profesional... <span class='spinner'>⏳</span>";
            }
        } catch (error) {
            console.error("Error en polling:", error);
            // Opcional: podrías detener el polling tras X errores
        }
    }, 3000);
}

function cerrarRecuerdo() {
    document.getElementById("memoryDetailOverlay").style.display = "none";
    abrirRecuerdos();
}

/* ============================================================
   8. UTILIDADES COMPLEMENTARIAS
   ============================================================ */

function mostrarMensaje(msg) {
    const el = document.getElementById("appMessage");
    if (el) {
        el.innerText = msg;
        el.classList.add("visible");
        setTimeout(() => el.classList.remove("visible"), 3000);
    }
}

function grabarOtroRecuerdo() {
    document.getElementById("recordOverlay").style.display = "none";
    abrirInicio();
}

function irAListaRecuerdos() {
    document.getElementById("recordOverlay").style.display = "none";
    abrirRecuerdos();
}