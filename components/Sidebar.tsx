'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source
if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface SidebarProps {
    file: File | null;
    pageCount: number;
    currentPage: number;
    onPageChange: (page: number) => void;
}

export default function Sidebar({ file, pageCount, currentPage, onPageChange }: SidebarProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [thumbnails, setThumbnails] = useState<string[]>([]);

    useEffect(() => {
        if (!file || pageCount === 0) {
            setThumbnails([]);
            return;
        }

        let cancelled = false;

        const generateThumbnails = async () => {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const thumbs: string[] = [];

            for (let i = 1; i <= pdfDoc.numPages; i++) {
                if (cancelled) return;
                const page = await pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale: 0.3 });

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
            }
        };

        generateThumbnails();
        return () => { cancelled = true; };
    }, [file, pageCount]);

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <h3>Pages</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{pageCount}</span>
            </div>
            <div className="sidebar-pages" ref={containerRef}>
                {thumbnails.map((thumb, idx) => (
                    <div
                        key={idx}
                        className={`page-thumb ${currentPage === idx + 1 ? 'active' : ''}`}
                        onClick={() => onPageChange(idx + 1)}
                    >
                        <img
                            src={thumb}
                            alt={`Page ${idx + 1}`}
                            style={{ width: '100%', display: 'block', borderRadius: '4px' }}
                        />
                        <span className="page-thumb-label">{idx + 1}</span>
                    </div>
                ))}
                {thumbnails.length === 0 && pageCount > 0 && (
                    <div className="empty-state" style={{ padding: '20px 10px' }}>
                        <div className="spinner" />
                    </div>
                )}
            </div>
        </div>
    );
}
