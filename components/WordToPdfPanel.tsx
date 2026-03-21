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

    const handleConvert = async () => {
        if (!file) return;
        setConverting(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/convert-word', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Conversion failed' }));
                throw new Error(err.error || 'Conversion failed');
            }

            const pdfBytes = new Uint8Array(await res.arrayBuffer());
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
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".docx"
                        hidden
                        onChange={(e) => handleFile(e.target.files)}
                    />
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
                    {file && (
                        <button className="btn" onClick={() => setFile(null)}>
                            Clear
                        </button>
                    )}
                    <button
                        className="btn btn-primary"
                        onClick={handleConvert}
                        disabled={converting || !file}
                        style={{ opacity: !file ? 0.5 : 1 }}
                    >
                        {converting ? (
                            <>
                                <Loader2 size={16} className="spin" style={{ animation: 'spin 0.6s linear infinite' }} />
                                Converting...
                            </>
                        ) : (
                            <>
                                <Download size={16} />
                                Convert to PDF
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
