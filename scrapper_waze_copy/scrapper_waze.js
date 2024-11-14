const puppeteer = require('puppeteer');
const { Kafka } = require('kafkajs');
const { Client } = require('@elastic/elasticsearch');
const fs = require('fs');
const csv = require('csv-parser');

//////////////////////////////////
// ElasticSearch
//////////////////////////////////

// Configurar ElasticSearch
const esClient = new Client({ node: 'http://localhost:9200' });

// Función para enviar datos a ElasticSearch
const sendAlertElastic = async (alert) => {
    try {
        const body = {
            alert,
            timestamp: new Date().toDateString()
        };

        await esClient.index({
            index: 'alerts_details',
            id: alert.idAlert,
            body: body
        });

        console.log('Alerta enviada a ElasticSearch');
    } catch (error) {
        console.error(`Error al enviar alerta a ElasticSearch: ${error}`);
    }
};

const sendJamDetailsElastic = async (jamDetails) => {
    try {
        const body = {
            jamDetails,
            timestamp: new Date().toDateString()
        }

        await esClient.index({
            index: 'jams_details',
            id: jamDetails.idJam,
            body: body
        });

        console.log('Detalles del atasco enviado a ElasticSearch')
    } catch (error) {
        console.error(`Error al enviar detalles del atasco a ElasticSearch: ${error}`)
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
    // Constante para que intercepte solo la última respuesta de tipo /api/georss
    let lastResponse = null; 

    /* Esto se hace para que no exista una redundancia de datos al extraer
    demasiados /api/georss */

    // Interceptar las respuestas
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/georss')) {
            try {
                lastResponse = (response);
            } catch (error) {
                console.error(`Error al procesar la respuesta de ${url}:`, error);
            }
        }
    });

    await new Promise(r => setTimeout(r, 10000));

    if (lastResponse) {
        try {
            const data = await lastResponse.json();
            processTrafficData(data);
        } catch (error) {
            console.log(`Error al procesar la ultima respuesta: ${error}`);
        }
    } else {
        console.log('No se interceptaron las respuestas relevantes');
    }
}

// Procesar los datos de tráfico y alertas
function processTrafficData(data) {

    if (Array.isArray(data.jams)) {
        data.jams.forEach(jam => {
            // const commune = jam.city;
            // const streetName = jam.street;
            // const streetEnd = jam.endNode;
            // const speedKmh = jam.speedKMH;
            // console.log(`Velocidad: ${speedKmh} km/h desde la calle ${streetName} hasta ${streetEnd} en la comuna de ${commune}`);

            const jamDetails = {
                idJam: jam.id,
                commune: jam.city,
                streetName: jam.street,
                streetEnd: jam.endNode,
                speedKmh: jam.speedKMH,
                length: jam.length
            }
            sendJamDetailsElastic(jamDetails);
        });
    }
    
    if (Array.isArray(data.alerts)) {
        data.alerts.forEach(alert => {
            // const commune = alert.city;
            // const typeAlert = alert.type;
            // const streetName = alert.street;
            // console.log(`Alerta: ${typeAlert} en la calle ${streetName} en la comuna de ${commune}`);
            const alertDetails = {
                idAlert: alert.id,
                commune: alert.city,
                typeAlert: alert.type,
                streetName: alert.street
            }
            sendAlertElastic(alertDetails);
        }); 
    } else console.log('No hay datos de tráfico');
}

// Interactuar con la página
async function interactWithPage(page) {
    try {
        const button = await page.waitForSelector('.waze-tour-tooltip__acknowledge', { visible: true, timeout: 5000 }).catch(() => {
            console.log('Botón no encontrado en esta página.');});

        if (button) {
            await button.click();
            
            await new Promise(r => setTimeout(r, 2000));
        }

        await page.waitForSelector('.leaflet-control-zoom-out', { visible: true });
        for (let i = 0; i < 3; i++) {
            await page.click('.leaflet-control-zoom-out');
            await new Promise(r => setTimeout(r, 1000));
        }
    } catch (error) {
        console.error('Error al interactuar con la página:', error);
    }
}


//////////////////////////////////
// CSV
//////////////////////////////////

// Leer URLs desde el archivo CSV
async function readCSVFile(filePath) {
    return new Promise((resolve, reject) => {
        const urls = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                urls.push(row.url);
            })
            .on('end', () => {
                resolve(urls);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

//////////////////////////////////
// Main
//////////////////////////////////

async function main() {
    
    const urls = await readCSVFile('./cities.csv');

    const browser = await initBrowser();
    
    for (let url of urls) {
        const page = await openPage(browser, url);

        await interactWithPage(page);

        await interceptResponses(page);
    }
    await browser.close();
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