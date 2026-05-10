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
    onPageLoaded?: (dimensions: { width: number; height: number; unscaledWidth: number; unscaledHeight: number }) => void;
    isHandTool?: boolean;
    isTextSelectMode?: boolean;
}

export default function PDFViewer({
    file,
    currentPage,
    zoom,
    onPageCountChange,
    onPageChange,
    onPageLoaded,
    isHandTool,
    isTextSelectMode,
}: PDFViewerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
    const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
    const [dimensions, setDimensions] = useState<{ width: number; height: number; unscaledWidth: number; unscaledHeight: number } | null>(null);

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
            const unscaledViewport = page.getViewport({ scale: 1 });

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
                
                // Render text layer overlay for text selection
                const textContent = await page.getTextContent();
                const textLayerDiv = textLayerRef.current;
                
                if (textLayerDiv && typeof window !== 'undefined') {
                    // Empty the previous text layer content
                    textLayerDiv.innerHTML = '';
                    
                    try {
                        // Dynamically import the viewer module for text layer rendering
                        const pdfjsViewer = await import('pdfjs-dist/web/pdf_viewer.mjs');
                        
                        const textLayer = new pdfjsViewer.TextLayerBuilder({
                            pdfPage: page,
                            highlighter: undefined,
                            accessibilityManager: undefined,
                        });
                        
                        textLayerDiv.appendChild(textLayer.div);
                        await textLayer.render({ viewport });
                    } catch (e) {
                         console.error('Error rendering text layer:', e);
                    }
                }

                setDimensions({ 
                    width: viewport.width, 
                    height: viewport.height,
                    unscaledWidth: unscaledViewport.width,
                    unscaledHeight: unscaledViewport.height
                });
                if (onPageLoaded) {
                    onPageLoaded({
                        width: viewport.width,
                        height: viewport.height,
                        unscaledWidth: unscaledViewport.width,
                        unscaledHeight: unscaledViewport.height
                    });
                }
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
            className={`pdf-page-container${isTextSelectMode ? ' text-select-mode' : ''}`}
            style={{
                position: 'relative',
                width: dimensions ? dimensions.width + 'px' : 'auto',
                height: dimensions ? dimensions.height + 'px' : 'auto',
            }}
        >
            <canvas ref={canvasRef} style={{ display: 'block' }} />
            
            {/* Text Layer for Selection */}
            <div
                ref={textLayerRef}
                className="textLayer"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    overflow: 'hidden',
                    lineHeight: 1.0,
                    /* We inherit purely the scale from the container, letting PDF.js style individual spans */
                }}
            />

            {/* Annotation overlay — Fabric.js will be mounted here by page.tsx */}
            <div
                id="annotation-container"
                data-width={dimensions?.unscaledWidth || 0}
                data-height={dimensions?.unscaledHeight || 0}
                data-zoom={zoom}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: dimensions ? dimensions.unscaledWidth + 'px' : '100%',
                    height: dimensions ? dimensions.unscaledHeight + 'px' : '100%',
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                    zIndex: 10,
                    pointerEvents: (isHandTool || isTextSelectMode) ? 'none' : 'auto',
                    touchAction: 'none',
                }}
            />
        </div>
    );
}
