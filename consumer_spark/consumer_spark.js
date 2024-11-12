const { Kafka } = require ('kafkajs');

//////////////////////////////////
// Kafka
//////////////////////////////////

// Configurar Kafka
const Kafka = new Kafka({
    clientId: 'consumer_spark',
    brokers: ['localhost:9092']
});

const consumer = kafka.consumer({groupId: 'spark'});

const startConsumerKafka = async () => {
    // Conectar al consumidor de Kafka
    await consumer.connect();
    console.log('Conectado al broker de Kafka como consumidor');

    // Suscribirse a los tópicos de alertDetails (Alertas) y jamDetails (Detalle atascos)
    await consumer.subscribe({topic: ['alertDetails', 'jamDetails'], fromBeginning: true});

    // Leer/Escuchar mensajes de Kafka y procesarlos
    await consumer.run({
        eachMessage: async ({topic, partition, message}) => {
            const data = JSON.parse(message.value.toString());
            console.log(`Mensaje recibido de Kafka en tópico ${topic}: ${data}`);

            // Aquí llamar a Spark para procesar los datos
        },
    });
};

async function main () {
    await startConsumerKafka();

    // Comenzar con las operaciones de Spark
}

main().catch(console.error);