'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, Scissors, X, Plus, Loader2 } from 'lucide-react';
import { splitPDF, downloadBlob, formatFileSize, PageRange } from '@/lib/pdfUtils';

interface SplitPanelProps {
    onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function SplitPanel({ onToast }: SplitPanelProps) {
    const [file, setFile] = useState<File | null>(null);
    const [ranges, setRanges] = useState<PageRange[]>([{ start: 1, end: 1 }]);
    const [splitting, setSplitting] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const f = files[0];
        if (f.type !== 'application/pdf') {
            onToast('Please select a PDF file', 'error');
            return;
        }
        setFile(f);
    };

    const addRange = () => {
        setRanges((prev) => [...prev, { start: 1, end: 1 }]);
    };

    const updateRange = (index: number, field: 'start' | 'end', value: string) => {
        const num = parseInt(value) || 1;
        setRanges((prev) =>
            prev.map((r, i) => (i === index ? { ...r, [field]: Math.max(1, num) } : r))
        );
    };

    const removeRange = (index: number) => {
        if (ranges.length <= 1) return;
        setRanges((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSplit = async () => {
        if (!file) {
            onToast('Please select a PDF file first', 'error');
            return;
        }
        setSplitting(true);
        try {
            const results = await splitPDF(file, ranges);
            for (const result of results) {
                downloadBlob(result.bytes, result.label);
            }
            onToast(`Split into ${results.length} file${results.length > 1 ? 's' : ''}!`, 'success');
        } catch {
            onToast('Failed to split PDF', 'error');
        } finally {
            setSplitting(false);
        }
    };

    return (
        <div className="panel-container">
            <div className="panel">
                <h2>
                    <Scissors size={24} style={{ display: 'inline', verticalAlign: '-4px', marginRight: '8px' }} />
                    Split PDF
                </h2>
                <p className="panel-description">
                    Extract specific page ranges from a PDF into separate files.
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
                                onClick={() => { setFile(null); setRanges([{ start: 1, end: 1 }]); }}
                            >
                                <X size={14} />
                            </button>
                        </div>

                        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
                            Page Ranges
                        </h3>

                        <div className="split-controls">
                            {ranges.map((range, idx) => (
                                <div key={idx} className="range-input-group" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                                    <label>From</label>
                                    <input
                                        type="number"
                                        className="range-input"
                                        min={1}
                                        value={range.start}
                                        onChange={(e) => updateRange(idx, 'start', e.target.value)}
                                    />
                                    <label>To</label>
                                    <input
                                        type="number"
                                        className="range-input"
                                        min={1}
                                        value={range.end}
                                        onChange={(e) => updateRange(idx, 'end', e.target.value)}
                                    />
                                    {ranges.length > 1 && (
                                        <button
                                            className="btn btn-ghost btn-icon btn-sm btn-danger"
                                            onClick={() => removeRange(idx)}
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <button className="btn btn-sm" onClick={addRange} style={{ marginBottom: '20px' }}>
                            <Plus size={14} />
                            Add Range
                        </button>

                        <div className="range-chips">
                            {ranges.map((range, idx) => (
                                <div key={idx} className="range-chip">
                                    Pages {range.start}–{range.end}
                                    <button onClick={() => removeRange(idx)} disabled={ranges.length <= 1}>
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                <div className="panel-actions">
                    <button
                        className="btn btn-primary"
                        onClick={handleSplit}
                        disabled={splitting || !file}
                        style={{ opacity: !file ? 0.5 : 1 }}
                    >
                        {splitting ? (
                            <>
                                <Loader2 size={16} style={{ animation: 'spin 0.6s linear infinite' }} />
                                Splitting...
                            </>
                        ) : (
                            <>
                                <Scissors size={16} />
                                Split PDF
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
