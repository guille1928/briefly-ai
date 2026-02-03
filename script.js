/* ===============================
   CAMBIOS DE CONTEXTO EN EL JS
================================ */

// Sustituimos las preguntas de infancia por contextos de reunión
const preguntas = [
  "¿Cuáles son los objetivos principales de este proyecto?",
  "Resume los acuerdos alcanzados en la reunión con el cliente.",
  "Describe las tareas pendientes y quién es el responsable de cada una.",
  "¿Qué obstáculos se han identificado en el desarrollo actual?",
  "Estructura el roadmap para el siguiente sprint."
];

// Cambiamos los mensajes de feedback
function procesarAudioSubida() {
    // ... tu lógica anterior ...
    mostrarMensaje("Audio enviado al motor de análisis...");
}

function mostrarUIFinalizado() {
  const textoEstado = document.getElementById("estado-texto");
  textoEstado.innerText = "¡Audio procesado correctamente!";
  textoEstado.style.color = "#0062ff"; 

  document.querySelector(".record-actions-final .btn.primary").innerText = "Generar otro Acta";
  document.querySelector(".record-actions-final .btn.secondary").innerText = "Ir al Historial";
}

// En la función pollResultado, cambiamos los estados visuales:
// Donde decía "Creando historia..." ahora dice "Generando Action Items..."
// Donde decía "Escuchando tu audio..." ahora dice "Transcribiendo reunión..."

function pollResultado(id) {
    // ...
    if (info.estado === "TRANSCRITO") {
        textEl.innerHTML = `<span style="color:var(--primary); font-weight:600;">🤖 IA Analizando...</span><br><br>Extrayendo decisiones y puntos clave de la reunión.`;
    }
    // ...
}