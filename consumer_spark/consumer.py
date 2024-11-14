from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col
from pyspark.sql.types import StructType, StructField, StringType, IntegerType
from kafka import KafkaConsumer
import json

# Configuración del SparkSession
spark = SparkSession.builder \
    .appName("KafkaSparkConsumer") \
    .master("local[*]") \
    .config("spark.executor.memory", "2g") \
    .getOrCreate()

# Definir el esquema para los atascos
jam_schema = StructType([
    StructField("commune", StringType(), True),
    StructField("streetName", StringType(), True),
    StructField("streetEnd", StringType(), True),
    StructField("speedKmh", IntegerType(), True)
])

# Definir el esquema para las alertas
alert_schema = StructType([
    StructField("commune", StringType(), True),
    StructField("typeAlert", StringType(), True),
    StructField("streetName", StringType(), True)
])

# Procesar los datos del tópico jamDetails
def process_jam_stream():
    jam_df = spark \
        .readStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", "localhost:9092") \
        .option("subscribe", "jamDetails") \
        .option("startingOffsets", "latest") \
        .load()
    
    jam_df = jam_df.selectExpr("CAST(value AS STRING)")

    # Convertir los datos de JSON a columnas
    jam_json_df = jam_df.select(from_json(col("value"), jam_schema).alias("data")).select("data.*")

    # Mostrar los resultados en consola
    query = jam_json_df \
        .writeStream \
        .outputMode("append") \
        .format("console") \
        .start()
    
    query.awaitTermination()

# Procesar los datos del tópico alertDetails
def process_alert_stream():
    alert_df = spark \
        .readStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", "localhost:9092") \
        .option("subscribe", "alertDetails") \
        .option("startingOffsets", "latest") \
        .load()
    
    alert_df = alert_df.selectExpr("CAST(value AS STRING)")

    # Convertir los datos de JSON a columnas
    alert_json_df = alert_df.select(from_json(col("value"), alert_schema).alias("data")).select("data.*")

    # Mostrar los resultados en consola
    query = alert_json_df \
        .writeStream \
        .outputMode("append") \
        .format("console") \
        .start()
    
    query.awaitTermination()

if __name__ == "__main__":
    # Procesar los datos de ambos tópicos en paralelo
    try:
        print("Consumiendo datos de Kafka...")
        # Procesar los tópicos en hilos separados
        import threading
        jam_thread = threading.Thread(target=process_jam_stream)
        alert_thread = threading.Thread(target=process_alert_stream)
        
        jam_thread.start()
        alert_thread.start()

        jam_thread.join()
        alert_thread.join()
    except KeyboardInterrupt:
        print("Proceso interrumpido.")
    finally:
        spark.stop()