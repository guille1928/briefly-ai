  /* ===============================
    CAMBIOS DE CONTEXTO EN EL JS
  ================================ */


  let userId = localStorage.getItem("briefly_userId");
  if (!userId) {
      userId = "brief_user_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("briefly_userId", userId);
  }

  const LAMBDA_URL = "https://av7j43vj2aj7azcj57dpinyx3i0nccew.lambda-url.eu-west-3.on.aws/";
  const API_URL = LAMBDA_URL;


  // Sustituimos las preguntas de infancia por contextos de reunión
  const preguntas = [
    "¿Cuáles son los objetivos principales de este proyecto?",
    "Resume los acuerdos alcanzados en la reunión con el cliente.",
    "Describe las tareas pendientes y quién es el responsable de cada una.",
    "¿Qué obstáculos se han identificado en el desarrollo actual?",
    "Estructura el roadmap para el siguiente sprint."
  ];

/* ===============================
   GESTIÓN DE SESIONES BRIEFLY AI
================================ */

// Función para abrir el selector de tipo de sesión
function abrirInicio() {
    const overlay = document.getElementById("startOverlay");
    if (overlay) {
        // Aseguramos que el overlay sea visible y esté por encima de todo
        overlay.style.display = "flex";
        
        // Evitamos que el body se mueva o haga scroll mientras el modal está abierto
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";

        // Resetear la posición del scroll dentro del modal si fuera necesario
        overlay.scrollTop = 0;
    } else {
        console.error("Error: No se encontró el elemento con ID 'startOverlay'");
    }
}

// Función para abrir el historial de briefings
function abrirRecuerdos() {
    const overlay = document.getElementById('memoriesOverlay');
    if (overlay) {
        // Cambiamos el título del modal dinámicamente si es necesario
        const tituloModal = overlay.querySelector('h2');
        if (tituloModal) tituloModal.innerText = "Historial de Briefings";
        
        overlay.style.display = 'flex';
        document.body.style.overflow = "hidden";
        
        cargarHistorialReuniones();
    }
}




/* === ACTUALIZACIÓN EN PROCESAR AUDIO === */
async function procesarAudioSubida() {
    const blob = new Blob(chunks, { type: mimeType });
    const nombre = `briefing_${Date.now()}.${extension}`;
    
    mostrarMensaje("Preparando subida segura...");

    try {
        // A. Pedir URL presignada
        const response = await fetch(`${LAMBDA_URL}?accion=subir&nombre=${nombre}&usuario=${userId}`);
        const data = await response.json();
        
        // B. Subida a S3
        const form = new FormData();
        Object.entries(data.datos_subida.fields).forEach(([k, v]) => form.append(k, v));
        form.append("file", blob);
        await fetch(data.datos_subida.url, { method: "POST", body: form });

        // C. Registrar en DynamoDB
        const r2 = await fetch(`${LAMBDA_URL}?accion=registrar_audio&nombre=${nombre}&usuario=${userId}`);
        const d2 = await r2.json();

        // IMPORTANTE: Cambiamos d2.id_recuerdo por d2.id_reunion para que coincida con el Lambda
        currentMemoryId = d2.id_reunion || d2.id_recuerdo; 
        currentFileName = nombre;

        mostrarUIFinalizado();
        mostrarMensaje("Reunión registrada");

        // D. Iniciar Transcripción automáticamente
        await fetch(`${LAMBDA_URL}?accion=transcribir&id=${currentMemoryId}&nombre=${nombre}&usuario=${userId}&formato=${extension}`);

    } catch (error) {
        console.error("Error:", error);
        mostrarMensaje("Error en la subida");
    }
}


async function ejecutarTranscripcionReal() {
    cerrarPremiumOverlay();
    const btn = document.getElementById("btnTranscribe");
    
    btn.disabled = true;
    btn.innerHTML = `<span class="magic-title"> Analizando...</span>`;

    try {
        const response = await fetch(`${LAMBDA_URL}?accion=mejorar&usuario=${userId}&id=${currentMemoryId}`);
        const data = await response.json();

        if (response.ok) {
            mostrarMensaje("Análisis finalizado");
            // El backend ya actualizó DynamoDB, ahora el Polling detectará el estado COMPLETADO
            pollResultado(currentMemoryId); 
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        alert("Error IA: " + error.message);
        btn.disabled = false;
        btn.innerHTML = `<span class="magic-title">Reintentar Acta</span>`;
    }
}


//historial de reuniones y listas
async function cargarHistorialReuniones() {
    const contenedor = document.getElementById("memoriesList");
    if (!contenedor) return;

    contenedor.innerHTML = "<p style='text-align:center; padding:20px;'>Consultando briefings...</p>";

    try {
        const response = await fetch(`${LAMBDA_URL}?accion=listar&usuario=${userId}`);
        const data = await response.json();
        const reuniones = data.recuerdos || [];

        if (reuniones.length === 0) {
            contenedor.innerHTML = "<p style='text-align:center; padding:20px;'>No hay reuniones registradas.</p>";
            return;
        }

        renderizarListaBriefings(reuniones);
        
    } catch (error) {
        console.error("Error cargando historial:", error);
        contenedor.innerHTML = "<p style='text-align:center; color:red;'>Error de conexión con el servidor.</p>";
    }
}

function renderizarListaBriefings(lista) {
    const contenedor = document.getElementById("memoriesList");
    contenedor.innerHTML = "";

    lista.forEach(item => {
        const fecha = new Date(item.fecha).toLocaleDateString("es-ES", {
            day: '2-digit', month: 'short', year: 'numeric'
        });
        
        const card = document.createElement("div");
        card.className = "memory-card"; // Mantenemos la clase CSS para no romper estilos
        card.innerHTML = `
            <div class="memory-header">
                <span class="memory-date">${fecha}</span>
                <span class="card-title">${item.titulo || 'Sesión de Briefing'}</span>
            </div>
            <div class="memory-actions">
                <button class="btn-action" onclick="verDetalleBriefing('${item.id_real}')">Ver Acta</button>
            </div>
        `;
        contenedor.appendChild(card);
    });
}

//ver detalle briefing
async function verDetalleBriefing(id) {
    currentMemoryId = id;
    const detailOverlay = document.getElementById('memoryDetailOverlay');
    const textDiv = document.getElementById('memoryDetailText');
    const titleEl = document.getElementById('memoryDetailTitle');

    if (detailOverlay) detailOverlay.style.display = 'flex';
    if (textDiv) textDiv.innerHTML = "Cargando acta detallada...";

    try {
        const response = await fetch(`${LAMBDA_URL}?accion=leer&id=${id}&usuario=${userId}`);
        const info = await response.json();

        if (titleEl) titleEl.innerText = info.titulo || "Detalle del Briefing";
        
        // Si el estado es COMPLETADO, mostramos el texto mejorado
        if (info.estado === "COMPLETADO") {
            textDiv.innerHTML = info.texto; // Renderiza el Markdown de la IA
        } else {
            textDiv.innerHTML = `<p>El análisis aún está en proceso.</p>`;
            pollResultado(id); // Iniciamos polling si no ha terminado
        }
    } catch (e) {
        if (textDiv) textDiv.innerHTML = "Error al recuperar los datos del briefing.";
    }
}


  function mostrarUIFinalizado() {
    const textoEstado = document.getElementById("estado-texto");
    textoEstado.innerText = "¡Audio procesado correctamente!";
    textoEstado.style.color = "#0062ff"; 

    document.querySelector(".record-actions-final .btn.primary").innerText = "Generar otro Acta";
    document.querySelector(".record-actions-final .btn.secondary").innerText = "Ir al Historial";
  }


  /* === MEJORA EN EL POLLING === */
function pollResultado(id) {
    const int = setInterval(async () => {
        try {
            const r = await fetch(`${LAMBDA_URL}?accion=leer&id=${id}&usuario=${userId}`);
            const info = await r.json();

            // Referencia al contenedor de texto en tu HTML/CSS
            const textEl = document.getElementById("memoryDetailText");

            if (info.estado === "PROCESANDO") {
                textEl.innerHTML = `<span style="color:#0062ff; font-weight:600;">⌛ Transcribiendo...</span><br>Convirtiendo voz a texto de forma segura.`;
            } 
            else if (info.estado === "TRANSCRITO") {
                textEl.innerHTML = `<span style="color:#6366f1; font-weight:600;"> Estructurando acta...</span><br>Extrayendo puntos clave con IA.`;
            }
            else if (info.estado === "COMPLETADO") {
                clearInterval(int);
                textEl.innerHTML = info.texto; // Aquí verás el Markdown generado o el modo Dossier
                document.getElementById("memoryDetailTitle").innerText = info.titulo;
            }
        } catch (e) {
            console.error("Error en polling:", e);
        }
    }, 3000); // Consultamos cada 3 segundos
}





  //abrir y cerrar pregunta
function abrirPregunta() {
    cerrarInicio();
    const questionOverlay = document.getElementById("questionOverlay");
    const textoPregunta = document.getElementById("pregunta-texto");
    
    if (questionOverlay && textoPregunta) {
        // Elegimos un contexto de reunión aleatorio
        const contextoAleatorio = preguntas[Math.floor(Math.random() * preguntas.length)];
        textoPregunta.innerText = contextoAleatorio;
        questionOverlay.style.display = "flex";
    }
}

function cerrarPregunta() {
    document.getElementById("questionOverlay").style.display = "none";
}



  // En la función pollResultado, cambiamos los estados visuales:
  // Donde decía "Creando historia..." ahora dice "Generando Action Items..."
  // Donde decía "Escuchando tu audio..." ahora dice "Transcribiendo reunión..."
