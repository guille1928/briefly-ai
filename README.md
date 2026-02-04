# ⚡ Briefly AI - Voice to Action

> **Serverless Voice-to-Action tool utilizing AWS Bedrock (Claude 3) & Transcribe to convert audio into structured executive summaries.**

![Project Status](https://img.shields.io/badge/Status-Completed-success)
![AWS](https://img.shields.io/badge/AWS-Serverless-orange)
![AI](https://img.shields.io/badge/AI-Bedrock%20Claude%203-blueviolet)

## 📖 Descripción

**Briefly AI** es una aplicación Fullstack Serverless diseñada para optimizar flujos de trabajo corporativos. Resuelve el problema de la toma de notas manual en reuniones, permitiendo a los Project Managers y Ejecutivos grabar notas de voz que son procesadas automáticamente por Inteligencia Artificial.

El sistema transforma audio desestructurado en **Resúmenes Ejecutivos** claros, detectando puntos clave y generando una lista de **Action Items** (Tareas) lista para ejecutar.

## 🚀 Key Features

* 🎙️ **Grabación Web Nativa:** Interfaz intuitiva para capturar audio directamente desde el navegador.
* 🧠 **Smart Transcription:** Uso de **Amazon Transcribe** para convertir voz a texto con alta precisión.
* 🤖 **AI Analysis:** Integración con **AWS Bedrock (Claude 3)** para entender el contexto, limpiar muletillas y estructurar la información.
* ☁️ **Cloud Storage:** Almacenamiento seguro y escalable de audios y reportes en **Amazon S3**.
* ⚡ **Serverless Architecture:** Coste cero en reposo gracias a AWS Lambda.

## 🛠️ Stack Tecnológico

El proyecto ha sido construido utilizando una arquitectura 100% Serverless:

### Frontend
* **Vanilla JS (ES6+):** Lógica de cliente ligera y rápida sin frameworks pesados.
* **CSS3 Moderno:** Diseño "Glassmorphism" limpio y profesional.
* **HTML5:** Semántico y accesible.

### Backend & Cloud (AWS)
* **Compute:** AWS Lambda (Python 3.9) para orquestar la lógica de negocio.
* **Database:** Amazon DynamoDB (NoSQL) para gestión de metadatos de audios.
* **Storage:** Amazon S3 (Buckets para audio raw y JSONs procesados).
* **AI/ML Services:**
    * *Amazon Transcribe:* Speech-to-Text.
    * *Amazon Bedrock:* Generative AI (Modelo: Anthropic Claude 3 Haiku).

## 🔄 Architecture Workflow

1.  **User** graba audio en el Frontend ➝ Sube a **S3**.
2.  Frontend invoca **API Gateway/Lambda**.
3.  **Lambda** activa **Amazon Transcribe**.
4.  Al finalizar, Lambda envía el texto a **Bedrock (Claude 3)** con un prompt de ingeniería específico para negocios.
5.  El resultado (JSON estructurado) se guarda en **DynamoDB**.
6.  Frontend hace polling inteligente y muestra el **Resumen Ejecutivo**.

## 📸 Screenshots



## 👨‍💻 Autor

Desarrollado por **GuillermoT**.

* 💼 [LinkedIn](https://www.linkedin.com/in/guillermo-fernández-tardón-329473298)
* 🐙 [GitHub Profile](https://github.com/guille1928)


---
*Este proyecto es parte de mi portfolio personal demostrando capacidades en Cloud Computing e Inteligencia Artificial Generativa.*
