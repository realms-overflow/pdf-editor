'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source — use locally served file
if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface PDFViewerProps {
    file: File | null;
    currentPage: number;
    zoom: number;
    onPageCountChange: (count: number) => void;
    onPageChange: (page: number) => void;
}

export default function PDFViewer({
    file,
    currentPage,
    zoom,
    onPageCountChange,
    onPageChange,
}: PDFViewerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
    const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

    const renderPage = useCallback(
        async (pageNum: number) => {
            const pdfDoc = pdfDocRef.current;
            if (!pdfDoc) return;

            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }

            const page = await pdfDoc.getPage(pageNum);
            const scale = zoom;
            const viewport = page.getViewport({ scale });

            const canvas = canvasRef.current;
            if (!canvas) return;
            const context = canvas.getContext('2d');
            if (!context) return;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport,
                canvas: canvas,
            };

            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                renderTaskRef.current = page.render(renderContext as any);
                await renderTaskRef.current.promise;
                setDimensions({ width: viewport.width, height: viewport.height });
            } catch (err: unknown) {
                if (err instanceof Error && err.message !== 'Rendering cancelled') {
                    console.error('Render error:', err);
                }
            }
        },
        [zoom]
    );

    useEffect(() => {
        if (!file) return;
        let cancelled = false;
        const loadPDF = async () => {
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdfDoc = await loadingTask.promise;
            if (cancelled) return;
            pdfDocRef.current = pdfDoc;
            onPageCountChange(pdfDoc.numPages);
            if (currentPage > pdfDoc.numPages) {
                onPageChange(1);
            }
            renderPage(currentPage);
        };
        loadPDF();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file]);

    useEffect(() => {
        renderPage(currentPage);
    }, [currentPage, zoom, renderPage]);

    if (!file) return null;

    return (
        <div
            className="pdf-page-container"
            style={{
                position: 'relative',
                width: dimensions ? dimensions.width + 'px' : 'auto',
                height: dimensions ? dimensions.height + 'px' : 'auto',
            }}
        >
            <canvas ref={canvasRef} style={{ display: 'block' }} />
            {/* Annotation overlay — Fabric.js will be mounted here by page.tsx */}
            <div
                id="annotation-container"
                data-width={dimensions?.width || 0}
                data-height={dimensions?.height || 0}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: dimensions ? dimensions.width + 'px' : '100%',
                    height: dimensions ? dimensions.height + 'px' : '100%',
                    zIndex: 10,
                    pointerEvents: 'auto',
                }}
            />
        </div>
    );
}
