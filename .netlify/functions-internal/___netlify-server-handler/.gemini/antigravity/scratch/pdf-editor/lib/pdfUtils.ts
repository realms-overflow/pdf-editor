import { PDFDocument } from 'pdf-lib';

export interface PageRange {
    start: number;
    end: number;
}

export async function mergePDFs(files: File[]): Promise<Uint8Array> {
    const mergedPdf = await PDFDocument.create();

    for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    return mergedPdf.save();
}

export async function splitPDF(
    file: File,
    ranges: PageRange[]
): Promise<{ bytes: Uint8Array; label: string }[]> {
    const arrayBuffer = await file.arrayBuffer();
    const srcPdf = await PDFDocument.load(arrayBuffer);
    const results: { bytes: Uint8Array; label: string }[] = [];

    for (const range of ranges) {
        const newPdf = await PDFDocument.create();
        const startIdx = range.start - 1;
        const endIdx = Math.min(range.end - 1, srcPdf.getPageCount() - 1);
        const indices = [];
        for (let i = startIdx; i <= endIdx; i++) {
            indices.push(i);
        }
        const copiedPages = await newPdf.copyPages(srcPdf, indices);
        copiedPages.forEach((page) => newPdf.addPage(page));
        const bytes = await newPdf.save();
        results.push({
            bytes,
            label: `pages_${range.start}-${range.end}.pdf`,
        });
    }

    return results;
}

export async function removePagesFromPDF(
    file: File,
    pageIndicesToRemove: number[]
): Promise<Uint8Array> {
    const arrayBuffer = await file.arrayBuffer();
    const srcPdf = await PDFDocument.load(arrayBuffer);
    const totalPages = srcPdf.getPageCount();
    const removeSet = new Set(pageIndicesToRemove);

    const newPdf = await PDFDocument.create();
    const keepIndices = [];
    for (let i = 0; i < totalPages; i++) {
        if (!removeSet.has(i)) {
            keepIndices.push(i);
        }
    }

    if (keepIndices.length === 0) {
        throw new Error('Cannot remove all pages');
    }

    const copiedPages = await newPdf.copyPages(srcPdf, keepIndices);
    copiedPages.forEach((page) => newPdf.addPage(page));
    return newPdf.save();
}

export async function downloadBlob(data: Uint8Array, filename: string) {
    // Basic validation: Check for PDF header (%PDF)
    if (data.length > 4) {
        const header = new TextDecoder().decode(data.slice(0, 4));
        if (header !== '%PDF') {
            console.warn('Warning: PDF header not found. File might be corrupted.', header);
        }
    }

    // Sanitize filename: remove special chars, keep alphanumeric, dots, dashes, underscores
    const sanitizedBase = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Ensure .pdf extension
    const finalFilename = sanitizedBase.toLowerCase().endsWith('.pdf')
        ? sanitizedBase
        : `${sanitizedBase}.pdf`;

    try {
        console.log('PDF Export V3: Starting Two-Step Download (Same Tab)');

        // Show a toast or loading indicator if possible, but the UI should handle "Exporting..." state
        // We will just proceed with the upload. A global spinner would be fail-safe but let's trust the button state.

        // Convert Uint8Array to Base64 using FileReader
        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1]);
            };
            reader.readAsDataURL(new Blob([data as unknown as BlobPart]));
        });

        // Step 1: Upload the file to the server temp storage
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filename: finalFilename,
                fileData: base64
            })
        });

        if (!response.ok) {
            throw new Error(`Upload failed with status ${response.status}`);
        }

        const result = await response.json();

        if (result.success && result.downloadUrl) {
            // Step 2: Trigger standard browser download via GET
            // Using assign() on the current window is 100% reliable for "attachment" downloads
            // It will NOT navigate away from the page if the server returns Content-Disposition: attachment
            window.location.assign(`${result.downloadUrl}&t=${Date.now()}`);
        } else {
            throw new Error(result.error || 'Unknown error during upload');
        }

    } catch (e) {
        console.error('Server download failed:', e);
        alert('Download failed. Please try again. Error: ' + (e instanceof Error ? e.message : String(e)));
    }
}

export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
