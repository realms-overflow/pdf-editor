'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, Loader2, FileType, Download } from 'lucide-react';
import { formatFileSize, downloadBlob } from '@/lib/pdfUtils';

interface WordToPdfPanelProps {
    onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function WordToPdfPanel({ onToast }: WordToPdfPanelProps) {
    const [file, setFile] = useState<File | null>(null);
    const [converting, setConverting] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const f = files[0];
        if (!f.name.toLowerCase().endsWith('.docx')) {
            onToast('Please select a Word file (.docx)', 'error');
            return;
        }
        setFile(f);
    };

    const convertClientSide = async (f: File): Promise<Uint8Array> => {
        const { renderAsync } = await import('docx-preview');
        const { jsPDF } = await import('jspdf');
        const html2canvas = (await import('html2canvas')).default;

        const A4_W = 794;
        const A4_H = 1123;

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99998;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-family:sans-serif;';
        overlay.textContent = 'Converting to PDF…';
        document.body.appendChild(overlay);

        const renderBox = document.createElement('div');
        renderBox.style.cssText = `position:fixed;left:0;top:0;width:${A4_W}px;height:100vh;overflow:auto;background:#fff;z-index:99997;`;
        document.body.appendChild(renderBox);

        const styleEl = document.createElement('style');
        styleEl.textContent = `
            .docx-wrapper { padding:0!important; margin:0!important; background:white!important; }
            .docx-wrapper > section { width:${A4_W}px!important; min-height:${A4_H}px!important; margin:0!important; box-shadow:none!important; box-sizing:border-box!important; }
        `;
        renderBox.appendChild(styleEl);

        const arrayBuffer = await f.arrayBuffer();
        await renderAsync(arrayBuffer, renderBox, undefined, {
            inWrapper: true, ignoreWidth: false, ignoreHeight: false,
            ignoreFonts: false, breakPages: true, ignoreLastRenderedPageBreak: false,
        });

        await new Promise(r => setTimeout(r, 800));

        const sections = renderBox.querySelectorAll('.docx-wrapper > section');
        const elements = sections.length > 0 ? Array.from(sections) as HTMLElement[] : [renderBox];
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfW = pdf.internal.pageSize.getWidth();
        const pdfH = pdf.internal.pageSize.getHeight();
        const SCALE = 2;

        let firstPage = true;
        for (const el of elements) {
            const canvas = await html2canvas(el, {
                scale: SCALE, useCORS: true, backgroundColor: '#ffffff',
                logging: false, width: A4_W, windowWidth: A4_W,
            });
            const scaledPageH = A4_H * SCALE;
            const totalPages = Math.max(1, Math.ceil(canvas.height / scaledPageH));
            for (let p = 0; p < totalPages; p++) {
                if (!firstPage) pdf.addPage();
                firstPage = false;
                const sliceH = Math.min(scaledPageH, canvas.height - p * scaledPageH);
                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = A4_W * SCALE;
                pageCanvas.height = scaledPageH;
                const ctx = pageCanvas.getContext('2d')!;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
                ctx.drawImage(canvas, 0, p * scaledPageH, A4_W * SCALE, sliceH, 0, 0, A4_W * SCALE, sliceH);
                pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfW, pdfH);
            }
        }

        document.body.removeChild(renderBox);
        document.body.removeChild(overlay);
        return new Uint8Array(pdf.output('arraybuffer'));
    };

    const handleConvert = async () => {
        if (!file) return;
        setConverting(true);
        try {
            // Try server-side (LibreOffice) first
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/convert-word', { method: 'POST', body: formData });

            if (res.ok) {
                const pdfBytes = new Uint8Array(await res.arrayBuffer());
                const pdfName = file.name.replace(/\.docx$/i, '') + '.pdf';
                await downloadBlob(pdfBytes, pdfName);
                onToast('PDF created successfully!', 'success');
                return;
            }

            // Fallback to client-side conversion
            const pdfBytes = await convertClientSide(file);
            const pdfName = file.name.replace(/\.docx$/i, '') + '.pdf';
            await downloadBlob(pdfBytes, pdfName);
            onToast('PDF created successfully!', 'success');
        } catch (err) {
            console.error(err);
            onToast(err instanceof Error ? err.message : 'Failed to convert to PDF', 'error');
        } finally {
            setConverting(false);
        }
    };

    return (
        <div className="panel-container">
            <div className="panel">
                <h2>
                    <FileType size={24} style={{ display: 'inline', verticalAlign: '-4px', marginRight: '8px' }} />
                    Word to PDF
                </h2>
                <p className="panel-description">
                    Convert Word documents (.docx) to PDF format.
                </p>
                <div
                    className={`panel-dropzone ${dragOver ? 'dragging' : ''}`}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files); }}
                >
                    <Upload size={28} />
                    <p>Drop a Word file here or click to browse</p>
                    <input ref={inputRef} type="file" accept=".docx" hidden onChange={(e) => handleFile(e.target.files)} />
                </div>
                {file && (
                    <div className="file-list">
                        <div className="file-item">
                            <FileText size={20} className="file-item-icon" />
                            <div className="file-item-info">
                                <div className="file-item-name">{file.name}</div>
                                <div className="file-item-size">{formatFileSize(file.size)}</div>
                            </div>
                        </div>
                    </div>
                )}
                <div className="panel-actions">
                    {file && (<button className="btn" onClick={() => setFile(null)}>Clear</button>)}
                    <button className="btn btn-primary" onClick={handleConvert} disabled={converting || !file} style={{ opacity: !file ? 0.5 : 1 }}>
                        {converting ? (
                            <><Loader2 size={16} className="spin" style={{ animation: 'spin 0.6s linear infinite' }} /> Converting...</>
                        ) : (
                            <><Download size={16} /> Convert to PDF</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
