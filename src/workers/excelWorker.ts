import * as XLSX from 'xlsx';

// Definición de tipos para la comunicación con el worker
interface ExcelData {
    filas: any[];
    header: string[];
    columnWidths: any[];
    fileName: string;
}

self.onmessage = (e: MessageEvent<ExcelData>) => {
    const { filas, header, columnWidths, fileName } = e.data;

    try {
        // Crear libro y hoja
        const libro = XLSX.utils.book_new();
        const hoja = XLSX.utils.json_to_sheet(filas, { header });

        // Aplicar anchos de columna
        hoja['!cols'] = columnWidths;

        // Añadir la hoja al libro
        XLSX.utils.book_append_sheet(libro, hoja, 'Solicitudes');

        // Generar el archivo como un array de bytes (Uint8Array)
        const excelBuffer = XLSX.write(libro, { bookType: 'xlsx', type: 'array' });

        // Enviar el buffer de vuelta al hilo principal
        self.postMessage({ 
            success: true, 
            buffer: excelBuffer, 
            fileName 
        });
    } catch (error) {
        self.postMessage({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Error desconocido en el worker' 
        });
    }
};
