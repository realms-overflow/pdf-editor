'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Trash2, X, Loader2, Download } from 'lucide-react';
import { removePagesFromPDF, downloadBlob, formatFileSize } from '@/lib/pdfUtils';

interface RemovePagesPanelProps {
    onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function RemovePagesPanel({ onToast }: RemovePagesPanelProps) {
    const [file, setFile] = useState<File | null>(null);
    const [thumbnails, setThumbnails] = useState<string[]>([]);
    const [removedPages, setRemovedPages] = useState<Set<number>>(new Set());
    const [processing, setProcessing] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const f = files[0];
        if (f.type !== 'application/pdf') {
            onToast('Please select a PDF file', 'error');
            return;
        }
        setFile(f);
        setRemovedPages(new Set());
    };

    // Generate thumbnails when file changes
    useEffect(() => {
        if (!file) {
            setThumbnails([]);
            return;
        }

        let cancelled = false;
        setLoading(true);

        const generate = async () => {
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const thumbs: string[] = [];

            for (let i = 1; i <= pdfDoc.numPages; i++) {
                if (cancelled) return;
                const page = await pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale: 0.5 });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d')!;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
                thumbs.push(canvas.toDataURL());
            }

            if (!cancelled) {
                setThumbnails(thumbs);
                setLoading(false);
            }
        };

        generate();
        return () => { cancelled = true; };
    }, [file]);

    const toggleRemove = (index: number) => {
        setRemovedPages((prev) => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                if (next.size >= thumbnails.length - 1) {
                    onToast('You must keep at least one page', 'error');
                    return prev;
                }
                next.add(index);
            }
            return next;
        });
    };

    const handleRemovePages = async () => {
        if (!file || removedPages.size === 0) {
            onToast('Please mark pages to remove first', 'error');
            return;
        }
        setProcessing(true);
        try {
            const result = await removePagesFromPDF(file, Array.from(removedPages));
            const baseName = file.name.replace(/\.pdf$/i, '');
            downloadBlob(result, `${baseName}_edited.pdf`);
            onToast(`Removed ${removedPages.size} page${removedPages.size > 1 ? 's' : ''}!`, 'success');
        } catch (err) {
            onToast(err instanceof Error ? err.message : 'Failed to remove pages', 'error');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="panel-container">
            <div className="panel" style={{ maxWidth: file ? '900px' : '700px' }}>
                <h2>
                    <Trash2 size={24} style={{ display: 'inline', verticalAlign: '-4px', marginRight: '8px' }} />
                    Remove Pages
                </h2>
                <p className="panel-description">
                    Click on pages to mark them for removal, then download the result.
                </p>

                {!file ? (
                    <div
                        className={`panel-dropzone ${dragOver ? 'dragging' : ''}`}
                        onClick={() => inputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files); }}
                    >
                        <Upload size={28} />
                        <p>Drop a PDF file here or click to browse</p>
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".pdf"
                            hidden
                            onChange={(e) => handleFile(e.target.files)}
                        />
                    </div>
                ) : (
                    <>
                        <div className="file-item" style={{ marginBottom: '20px' }}>
                            <FileText size={20} className="file-item-icon" />
                            <div className="file-item-info">
                                <div className="file-item-name">{file.name}</div>
                                <div className="file-item-size">{formatFileSize(file.size)}</div>
                            </div>
                            <button
                                className="btn btn-ghost btn-icon btn-sm btn-danger"
                                onClick={() => { setFile(null); setRemovedPages(new Set()); setThumbnails([]); }}
                            >
                                <X size={14} />
                            </button>
                        </div>

                        {loading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                                <Loader2 size={32} style={{ animation: 'spin 0.6s linear infinite', color: 'var(--accent)' }} />
                            </div>
                        ) : (
                            <div className="remove-pages-grid">
                                {thumbnails.map((thumb, idx) => (
                                    <div
                                        key={idx}
                                        className={`remove-page-card ${removedPages.has(idx) ? 'marked' : ''}`}
                                        onClick={() => toggleRemove(idx)}
                                    >
                                        <div className="remove-page-thumb">
                                            <img src={thumb} alt={`Page ${idx + 1}`} />
                                            {removedPages.has(idx) && (
                                                <div className="remove-page-overlay">
                                                    <X size={48} strokeWidth={3} />
                                                </div>
                                            )}
                                        </div>
                                        <span className="remove-page-label">Page {idx + 1}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {removedPages.size > 0 && (
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '12px', textAlign: 'center' }}>
                                {removedPages.size} page{removedPages.size > 1 ? 's' : ''} marked for removal
                            </p>
                        )}
                    </>
                )}

                <div className="panel-actions">
                    <button
                        className="btn btn-primary"
                        onClick={handleRemovePages}
                        disabled={processing || !file || removedPages.size === 0}
                        style={{ opacity: !file || removedPages.size === 0 ? 0.5 : 1 }}
                    >
                        {processing ? (
                            <>
                                <Loader2 size={16} style={{ animation: 'spin 0.6s linear infinite' }} />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Download size={16} />
                                Download without removed pages
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
