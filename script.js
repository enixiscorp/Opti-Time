// script.js - Fonctions utilitaires partagées pour File System Access API

/**
 * Vérifie si le navigateur supporte File System Access API
 */
function checkFileSystemSupport() {
    if (!('showOpenFilePicker' in window) && !('showSaveFilePicker' in window)) {
        alert('Votre navigateur ne supporte pas File System Access API.\n\nVeuillez utiliser Chrome ou Edge (version récente).');
        return false;
    }
    return true;
}

/**
 * Lit un fichier CSV et retourne son contenu
 */
async function readCSVFile(fileHandle) {
    try {
        const file = await fileHandle.getFile();
        const text = await file.text();
        return text;
    } catch (error) {
        console.error('Erreur lors de la lecture du fichier:', error);
        throw error;
    }
}

/**
 * Écrit du contenu dans un fichier CSV
 */
async function writeCSVFile(fileHandle, content) {
    try {
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
    } catch (error) {
        console.error('Erreur lors de l\'écriture du fichier:', error);
        throw error;
    }
}

/**
 * Parse un CSV simple (format: colonne1,colonne2\n...)
 */
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',');
        const entry = {};
        headers.forEach((header, index) => {
            entry[header] = values[index] ? values[index].trim() : '';
        });
        data.push(entry);
    }
    
    return data;
}

/**
 * Convertit un tableau d'objets en CSV
 */
function arrayToCSV(data, headers) {
    let csv = headers.join(',') + '\n';
    data.forEach(row => {
        const values = headers.map(header => row[header] || '');
        csv += values.join(',') + '\n';
    });
    return csv;
}

/**
 * Formate une date au format YYYY-MM-DD
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Formate un horodatage au format YYYY-MM-DD HH:MM:SS
 */
function formatTimestamp(date) {
    const dateStr = formatDate(date);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${dateStr} ${hours}:${minutes}:${seconds}`;
}

// Vérifier le support au chargement
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        checkFileSystemSupport();
    });
}

