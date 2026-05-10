'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, X, ArrowUpDown, Loader2, Merge } from 'lucide-react';
import { mergePDFs, downloadBlob, formatFileSize } from '@/lib/pdfUtils';

interface MergePanelProps {
    onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function MergePanel({ onToast }: MergePanelProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [merging, setMerging] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const addFiles = (newFiles: FileList | File[]) => {
        const pdfs = Array.from(newFiles).filter(
            (f) => f.type === 'application/pdf'
        );
        if (pdfs.length === 0) {
            onToast('Please select PDF files only', 'error');
            return;
        }
        setFiles((prev) => [...prev, ...pdfs]);
    };

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const moveFile = (index: number, direction: 'up' | 'down') => {
        const newFiles = [...files];
        const targetIdx = direction === 'up' ? index - 1 : index + 1;
        if (targetIdx < 0 || targetIdx >= files.length) return;
        [newFiles[index], newFiles[targetIdx]] = [newFiles[targetIdx], newFiles[index]];
        setFiles(newFiles);
    };

    const handleMerge = async () => {
        if (files.length < 2) {
            onToast('Please add at least 2 PDF files to merge', 'error');
            return;
        }
        setMerging(true);
        try {
            const result = await mergePDFs(files);
            downloadBlob(result, 'merged.pdf');
            onToast('PDFs merged successfully!', 'success');
        } catch {
            onToast('Failed to merge PDFs', 'error');
        } finally {
            setMerging(false);
        }
    };

    return (
        <div className="panel-container">
            <div className="panel">
                <h2>
                    <Merge size={24} style={{ display: 'inline', verticalAlign: '-4px', marginRight: '8px' }} />
                    Merge PDFs
                </h2>
                <p className="panel-description">
                    Combine multiple PDF files into a single document. Drag to reorder.
                </p>

                <div
                    className={`panel-dropzone ${dragOver ? 'dragging' : ''}`}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                >
                    <Upload size={28} />
                    <p>Drop PDF files here or click to browse</p>
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".pdf"
                        multiple
                        hidden
                        onChange={(e) => e.target.files && addFiles(e.target.files)}
                    />
                </div>

                <div className="file-list">
                    {files.length === 0 && (
                        <div className="empty-state" style={{ padding: '20px' }}>
                            <FileText size={32} style={{ opacity: 0.3 }} />
                            <p style={{ fontSize: '13px' }}>No files added yet</p>
                        </div>
                    )}
                    {files.map((file, idx) => (
                        <div key={idx} className="file-item">
                            <FileText size={20} className="file-item-icon" />
                            <div className="file-item-info">
                                <div className="file-item-name">{file.name}</div>
                                <div className="file-item-size">{formatFileSize(file.size)}</div>
                            </div>
                            <div className="file-item-actions">
                                <button
                                    className="btn btn-ghost btn-icon btn-sm"
                                    onClick={() => moveFile(idx, 'up')}
                                    disabled={idx === 0}
                                    style={{ opacity: idx === 0 ? 0.3 : 1 }}
                                    title="Move up"
                                >
                                    <ArrowUpDown size={14} />
                                </button>
                                <button
                                    className="btn btn-ghost btn-icon btn-sm btn-danger"
                                    onClick={() => removeFile(idx)}
                                    title="Remove"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="panel-actions">
                    {files.length > 0 && (
                        <button className="btn" onClick={() => setFiles([])}>
                            Clear All
                        </button>
                    )}
                    <button
                        className="btn btn-primary"
                        onClick={handleMerge}
                        disabled={merging || files.length < 2}
                        style={{ opacity: files.length < 2 ? 0.5 : 1 }}
                    >
                        {merging ? (
                            <>
                                <Loader2 size={16} className="spin" style={{ animation: 'spin 0.6s linear infinite' }} />
                                Merging...
                            </>
                        ) : (
                            <>
                                <Merge size={16} />
                                Merge {files.length > 0 ? `(${files.length} files)` : ''}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
