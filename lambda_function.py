import json
import boto3
import uuid
import time
import os
from botocore.config import Config
from boto3.dynamodb.conditions import Key

# --- CONFIGURACIÓN DINÁMICA ---
MODO_DOSSIER = os.environ.get('MODO_DOSSIER', 'true').lower() == 'true'

REGION = "eu-west-3"           # PARÍS
REGION_BEDROCK = "us-east-1"   # VIRGINIA
BUCKET_NAME = "briefly-s3" 
TABLE_NAME = "Briefly_Meeting"
MODEL_ID_BEDROCK = "anthropic.claude-3-haiku-20240307-v1:0"

# --- CLIENTES AWS ---
try:
    config_s3 = Config(region_name=REGION, signature_version="s3v4")
    s3 = boto3.client("s3", config=config_s3)
    transcribe = boto3.client("transcribe", region_name=REGION)
    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    table = dynamodb.Table(TABLE_NAME)
except Exception as e:
    print(f"Error inicializando clientes: {str(e)}")

# --- FUNCIONES AUXILIARES (SIN CORS REDUNDANTE) ---
def success(body):
    return {
        "statusCode": 200,
        "body": json.dumps(body)
    }

def error(code, msg): 
    return {
        "statusCode": code,
        "body": json.dumps({"error": msg})
    }

def generar_url_audio(usuario, archivo):
    if not archivo: return ""
    try:
        return s3.generate_presigned_url(
            "get_object", 
            Params={"Bucket": BUCKET_NAME, "Key": f"usuarios/{usuario}/audios/{archivo}"}, 
            ExpiresIn=3600
        )
    except Exception:
        return ""

# --- HANDLER PRINCIPAL ---
def handler(event, context):
    try:
        # Gestión de OPTIONS simplificada (CORS se maneja en la consola de AWS)
        method = event.get("requestContext", {}).get("http", {}).get("method", "")
        if method == "OPTIONS": 
            return {"statusCode": 200, "body": ""}

        params = event.get("queryStringParameters") or {}
        accion = params.get("accion", "").lower()
        usuario_actual = params.get("usuario", "dev_portfolio")

        # 1. ACCIÓN: SUBIR
        if accion == "subir":
            nombre_archivo = params.get("nombre")
            if not nombre_archivo: return error(400, "Falta nombre")
            key_s3 = f"usuarios/{usuario_actual}/audios/{nombre_archivo}"
            
            response = s3.generate_presigned_post(
                Bucket=BUCKET_NAME, Key=key_s3,
                Conditions=[["content-length-range", 1, 50_000_000]], 
                ExpiresIn=3600
            )
            return success({"datos_subida": response, "key": key_s3})

        # 2. ACCIÓN: REGISTRAR AUDIO
        elif accion == "registrar_audio":
            nombre_archivo = params.get("nombre")
            meeting_id = f"meeting-{uuid.uuid4()}"
            timestamp_now = str(int(time.time()))
            
            table.put_item(Item={
                'usuario_id': usuario_actual,
                'id_reunion': meeting_id, # Nombre de Sort Key corregido
                'fecha_creacion': timestamp_now,
                'nombre_archivo': nombre_archivo,
                'estado': 'SOLO_AUDIO',
                'titulo': 'Nueva Reunión'
            })
            return success({"id_recuerdo": meeting_id, "mensaje": "Registrado"})

        # 3. ACCIÓN: TRANSCRIBIR
        elif accion == "transcribir":
            meeting_id = params.get("id")
            nombre_archivo = params.get("nombre")
            formato = params.get("formato", "mp4")
            
            transcribe.start_transcription_job(
                TranscriptionJobName=meeting_id,
                Media={"MediaFileUri": f"s3://{BUCKET_NAME}/usuarios/{usuario_actual}/audios/{nombre_archivo}"},
                MediaFormat=formato,
                LanguageCode="es-ES",
                OutputBucketName=BUCKET_NAME,
                OutputKey=f"usuarios/{usuario_actual}/transcripciones/{meeting_id}.json"
            )
            
            table.update_item(
                Key={'usuario_id': usuario_actual, 'id_reunion': meeting_id},
                UpdateExpression="set estado=:s",
                ExpressionAttributeValues={':s': 'PROCESANDO'}
            )
            return success({"job_id": meeting_id, "status": "STARTED"})

        # 4. ACCIÓN: MEJORAR
        elif accion == "mejorar":
            meeting_id = params.get("id")
            
            if MODO_DOSSIER:
                demo_titulo = "Briefing: Revisión de Arquitectura"
                demo_texto = "## Resumen Ejecutivo\nSe analizó la infraestructura serverless.\n\n## Action Items\n| Tarea | Responsable |\n| :--- | :--- |\n| Actualizar S3 | @Fullstack |"
                
                table.update_item(
                    Key={'usuario_id': usuario_actual, 'id_reunion': meeting_id},
                    UpdateExpression="set texto_mejorado=:m, titulo=:t, estado=:e", 
                    ExpressionAttributeValues={':m': demo_texto, ':t': demo_titulo, ':e': 'COMPLETADO'}
                )
                return success({"texto": demo_texto, "titulo": demo_titulo, "nota": "Modo Dossier Activo"})

            # Lógica Real con Bedrock
            item = table.get_item(Key={'usuario_id': usuario_actual, 'id_reunion': meeting_id}).get("Item")
            texto_original = item.get('texto_original', '')

            if not texto_original:
                obj = s3.get_object(Bucket=BUCKET_NAME, Key=f"usuarios/{usuario_actual}/transcripciones/{meeting_id}.json")
                data = json.loads(obj["Body"].read().decode("utf-8"))
                texto_original = data["results"]["transcripts"][0]["transcript"]

            prompt = f"""
            Eres un asistente ejecutivo. Transforma la transcripción en un acta profesional estructurada.
            Salida exclusiva en JSON:
            {{
              "titulo": "Título de la reunión",
              "texto": "Markdown aquí..."
            }}
            Texto: {texto_original}
            """

            bedrock_client = boto3.client(service_name='bedrock-runtime', region_name=REGION_BEDROCK)
            body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31", 
                "max_tokens": 2000,
                "messages": [{"role": "user", "content": prompt}]
            })
            
            response = bedrock_client.invoke_model(modelId=MODEL_ID_BEDROCK, body=body)
            res_body = json.loads(response.get('body').read())
            raw_text = res_body['content'][0]['text']
            
            try:
                start = raw_text.find('{')
                end = raw_text.rfind('}') + 1
                datos_ia = json.loads(raw_text[start:end])
                nuevo_titulo = datos_ia.get("titulo", "Reunión Procesada")
                nuevo_texto = datos_ia.get("texto", raw_text)
            except:
                nuevo_titulo = "Reunión Analizada"
                nuevo_texto = raw_text

            table.update_item(
                Key={'usuario_id': usuario_actual, 'id_reunion': meeting_id},
                UpdateExpression="set texto_mejorado=:m, titulo=:t, estado=:e", 
                ExpressionAttributeValues={':m': nuevo_texto, ':t': nuevo_titulo, ':e': 'COMPLETADO'}
            )
            return success({"texto": nuevo_texto, "titulo": nuevo_titulo})

     # 5. ACCIÓN: LISTAR
        elif accion == "listar":
            try:
                print(f"Intentando listar para usuario: {usuario_actual}") # Log para CloudWatch
                
                # Usamos scan si query da problemas inicialmente para probar conexión
                resp = table.query(
                    KeyConditionExpression=boto3.dynamodb.conditions.Key('usuario_id').eq(usuario_actual)
                )
                
                items = resp.get('Items', [])
                reuniones = []
                
                for i in items:
                    reuniones.append({
                        "id_real": str(i.get('id_reunion', 'sin-id')),
                        "fecha": float(i.get('fecha_creacion', time.time())) * 1000,
                        "titulo": i.get('titulo', 'Sesión de Briefing'),
                        "estado": i.get('estado', 'SOLO_AUDIO'),
                        "nombre_archivo": i.get('nombre_archivo', '') 
                    })
                
                print(f"Éxito: Se encontraron {len(reuniones)} items")
                return success({"recuerdos": reuniones})

            except Exception as e:
                # Esto enviará el error real al log de CloudWatch
                print(f"FALLO CRÍTICO EN LISTAR: {str(e)}")
                return error(500, f"Error interno: {str(e)}")

        # 6. ACCIÓN: LEER
        elif accion == "leer":
            job_id = params.get("id")
            item = table.get_item(Key={'usuario_id': usuario_actual, 'id_reunion': job_id}).get("Item")
            if not item: return error(404, "No encontrado")
            
            if item.get("estado") == "PROCESANDO":
                try:
                    job = transcribe.get_transcription_job(TranscriptionJobName=job_id)
                    if job['TranscriptionJob']['TranscriptionJobStatus'] == 'COMPLETED':
                        # El estado se actualizará en la próxima llamada o mediante mejora
                        pass
                except: pass

            return success({
                "statusCode": 200,
                "body": json.dumps(body)
            })

        return error(400, "Acción no válida")

    except Exception as e:
        return error(500, str(e))