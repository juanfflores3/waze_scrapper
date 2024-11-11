const puppeteer = require('puppeteer');
const { Kafka } = require('kafkajs');


//////////////////////////////////
// Kafka
//////////////////////////////////

// Configurar Kafka
const kafka = new Kafka({
    clientId: 'waze_scrapper',
    brokers: ['localhost:9092']
})

// Crear un productor de Kafka
const producer = kafka.producer();

// Iniciar el productor de Kafka
async function startProducerKafka(){
    await producer.connect();
    console.log('Conectado a los brokers de Kafka como productor');
}

const sendJamDetails = async (jamDetails) => {
    try {
        await producer.send({
            topic: 'jamDetails',
            messages: [{ value: JSON.stringify(jamDetails)}]
        });
        console.log('Detalles de los atascos enviados a Kafka al tópico jamDetails');
    } catch (error) {
        console.error(`Error al enviar los detalles a Kafka: ${error}`);
    }
};

const sendAlertDetails = async(alertDetails) => {
    try {
        await producer.send({
            topic: 'alertDetails',
            messages: [{ value: JSON.stringify(alertDetails)}]
        });
        console.log('Detalles de las alertas enviados a Kafka al tópico alertDetails');
    } catch (error) {
        console.error(`Error al enviar los detalles a Kafka: ${error}`);
    }
};

//////////////////////////////////
// Puppeeter
//////////////////////////////////

// Iniciar el navegador
async function initBrowser() {
    return await puppeteer.launch({headless: false});
}

// Abrir una nueva página
async function openPage(browser, url) {
    const page = await browser.newPage();
    await page.goto(url, {waitUntil: 'load', timeout: 0});
    return page;
}

// Interceptar las respuestas de Waze
async function interceptResponses(page) {
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/georss')) {
            try {
                const data = await response.json();
                processTrafficData(data);
            } catch (error) {
                console.error(`Error al procesar la respuesta de ${url}:`, error);
            }
        }
    });
}

// Procesar los datos de tráfico y alertas
function processTrafficData(data) {
    if (Array.isArray(data.jams) || Array.isArray(data.alerts)) {
        data.jams.forEach (jam => {
            // const commune = jam.city;
            // const streetName = jam.street;
            // const streetEnd = jam.endNode;
            // const speedKmh = jam.speedKMH;
            // console.log(`Velocidad: ${speedKmh} km/h desde la calle ${streetName} hasta ${streetEnd} en la comuna de ${commune}`);
            
            const jamDetails = {
                commune: jam.city,
                streetName: jam.street,
                streetEnd: jam.endNode,
                speedKmh: jam.speedKMH
            }
            sendJamDetails(jamDetails);
        });

        data.alerts.forEach (alert => {
            // const commune = alert.city;
            // const typeAlert = alert.type;
            // const streetName = alert.street;
            // console.log(`Alerta: ${typeAlert} en la calle ${streetName} en la comuna de ${commune}`);
            
            const alertDetails = {
                commune: alert.city,
                typeAlert: alert.type,
                streetName: alert.street
            }
            sendAlertDetails(alertDetails);
        });
    } else console.log('No hay datos de tráfico');
}

// Interactuar con la página
async function interactWithPage(page) {
    await page.waitForSelector('.waze-tour-tooltip__acknowledge', {visible: true});
    await page.click('.waze-tour-tooltip__acknowledge');

    await new Promise(r => setTimeout(r, 2000));

    await page.waitForSelector('.leaflet-control-zoom-out');
    for (let i = 0; i < 3; i++) {
        await page.click('.leaflet-control-zoom-out');
        await new Promise(r => setTimeout(r, 1000));
    }
}

// Main
async function main() {
    await startProducerKafka();
    
    const URLStgo = 'https://ul.waze.com/ul?ll=-33.44900672%2C-70.66931963&navigate=yes&zoom=17&utm_campaign=default&utm_source=waze_website&utm_medium=lm_share_location';

    const browser = await initBrowser();
    const page = await openPage(browser, URLStgo);

    await interceptResponses(page);
    await interactWithPage(page);
}

main().catch(console.error);

// waze-tour-tooltip__acknowledge
// XHR = xmlhttprequest

    // page.on('request', (req) => {
    //     if (req.resourceType() === 'xhr' && req.method() === 'GET') {
    //         console.log(`Request made to ${req.url()}`);
    //     } else req.continue();
    // });

    // await page.setRequestInterception(true);

    // page.on('request', (req) => {
    //     if (req.url().includes('/api/georss')) {
    //         console.log(`Request made to ${req.url()}`);
    //         req.continue();
    //     }
    // });