'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, Loader2, FileOutput, Download } from 'lucide-react';
import { formatFileSize } from '@/lib/pdfUtils';

interface PdfToWordPanelProps {
    onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function PdfToWordPanel({ onToast }: PdfToWordPanelProps) {
    const [file, setFile] = useState<File | null>(null);
    const [converting, setConverting] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const f = files[0];
        if (!f.name.toLowerCase().endsWith('.pdf')) {
            onToast('Please select a PDF file (.pdf)', 'error');
            return;
        }
        setFile(f);
    };

    const convertClientSide = async (f: File): Promise<Blob> => {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const arrayBuffer = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        const { Document, Packer, Paragraph, TextRun, PageBreak } = await import('docx');

        const children: InstanceType<typeof Paragraph>[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Group text items by Y position (lines)
            const lines: { y: number; items: { str: string; fontName: string; fontSize: number; bold: boolean }[] }[] = [];

            for (const item of textContent.items) {
                if (!('str' in item) || !item.str.trim()) continue;
                const y = Math.round(item.transform[5]);
                const fontSize = Math.round(item.transform[0]) || 12;
                const fontName = ('fontName' in item ? item.fontName : '') as string;
                const bold = fontName.toLowerCase().includes('bold');

                let line = lines.find(l => Math.abs(l.y - y) < 3);
                if (!line) {
                    line = { y, items: [] };
                    lines.push(line);
                }
                line.items.push({ str: item.str, fontName, fontSize, bold });
            }

            // Sort lines top to bottom (higher Y = higher on page in PDF coords)
            lines.sort((a, b) => b.y - a.y);

            for (const line of lines) {
                const runs = line.items.map(item => new TextRun({
                    text: item.str,
                    bold: item.bold,
                    size: item.fontSize * 2, // docx uses half-points
                }));
                children.push(new Paragraph({ children: runs }));
            }

            // Add page break between pages (except last)
            if (i < pdf.numPages) {
                children.push(new Paragraph({ children: [new PageBreak()] }));
            }
        }

        const doc = new Document({
            sections: [{ children }],
        });

        return await Packer.toBlob(doc);
    };

    const handleConvert = async () => {
        if (!file) return;
        setConverting(true);
        try {
            // Try server-side (LibreOffice) first
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/convert-pdf-to-word', { method: 'POST', body: formData });

            let blob: Blob;
            if (res.ok) {
                blob = await res.blob();
            } else {
                // Fallback to client-side
                blob = await convertClientSide(file);
            }

            const docxName = file.name.replace(/\.pdf$/i, '') + '.docx';
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = docxName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            onToast('Word document created successfully!', 'success');
        } catch (err) {
            console.error(err);
            onToast(err instanceof Error ? err.message : 'Failed to convert to Word', 'error');
        } finally {
            setConverting(false);
        }
    };

    return (
        <div className="panel-container">
            <div className="panel">
                <h2>
                    <FileOutput size={24} style={{ display: 'inline', verticalAlign: '-4px', marginRight: '8px' }} />
                    PDF to Word
                </h2>
                <p className="panel-description">
                    Convert PDF documents to Word format (.docx).
                </p>
                <div
                    className={`panel-dropzone ${dragOver ? 'dragging' : ''}`}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files); }}
                >
                    <Upload size={28} />
                    <p>Drop a PDF file here or click to browse</p>
                    <input ref={inputRef} type="file" accept=".pdf" hidden onChange={(e) => handleFile(e.target.files)} />
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
                            <><Download size={16} /> Convert to Word</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
