// Leer URLs desde el archivo CSV
async function readCSVFile(filePath) {
    return new Promise((resolve, reject) => {
        const urls = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                // Verificar que el campo "url" no esté vacío o undefined
                if (row.url && typeof row.url === 'string' && row.url.trim() !== '') {
                    urls.push(row.url.trim()); // Elimina espacios en blanco
                }
            })
            .on('end', () => {
                resolve(urls);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}
