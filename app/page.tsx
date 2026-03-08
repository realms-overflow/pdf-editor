'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Canvas as FabricCanvas, TPointerEventInfo, FabricObject, Rect, Ellipse, Line, TDataUrlOptions } from 'fabric';
import {
  FileEdit,
  Upload,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Trash2,
  Merge,
  Pen,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { mergePDFs, removePagesFromPDF, formatFileSize, downloadBlob } from '@/lib/pdfUtils';
import Toolbar, { AnnotationTool } from '@/components/Toolbar';
import MergePanel from '@/components/MergePanel';
import RemovePagesPanel from '@/components/RemovePagesPanel';

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), { ssr: false });
const Sidebar = dynamic(() => import('@/components/Sidebar'), { ssr: false });

type TabType = 'editor' | 'merge' | 'remove';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AnnotationState {
  objects: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('editor');
  const [file, setFile] = useState<File | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1.0); // Will be updated to fit page
  const [initialFitDone, setInitialFitDone] = useState(false);

  const [activeTool, setActiveTool] = useState<AnnotationTool>('select');
  const [activeColor, setActiveColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);

  // Fabric.js refs
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const [fabricReady, setFabricReady] = useState(false);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const annotationHistoryRef = useRef<Map<number, AnnotationState>>(new Map());
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const isUndoRedoRef = useRef(false);
  const prevPageRef = useRef(1);

  // Hand tool panning state
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const scrollStartRef = useRef({ x: 0, y: 0 });

  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const handleFile = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const f = files[0];
      if (f.type !== 'application/pdf') {
        showToast('Please select a PDF file', 'error');
        return;
      }
      // Dispose old fabric canvas
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
        setFabricReady(false);
      }
      setFile(f);
      setCurrentPage(1);
      prevPageRef.current = 1;
      setActiveTab('editor');
      setInitialFitDone(false); // Reset auto-fit on new file
      annotationHistoryRef.current.clear();
      undoStackRef.current = [];
      redoStackRef.current = [];
      setCanUndo(false);
      setCanRedo(false);
    },
    [showToast]
  );

  // ── Undo/Redo helper
  const saveUndoState = useCallback(() => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    const json = JSON.stringify(fc.toJSON());
    undoStackRef.current.push(json);
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
    annotationHistoryRef.current.set(currentPage, { objects: json });
  }, [currentPage]);

  // ── Initialize Fabric.js canvas by observing the annotation container
  const initLockRef = useRef(false);

  useEffect(() => {
    if (!file) return;

    let cancelled = false;
    initLockRef.current = false;
    setFabricReady(false);

    const tryInit = async () => {
      if (cancelled || initLockRef.current) return;

      const container = document.getElementById('annotation-container');
      if (!container) {
        if (!cancelled) requestAnimationFrame(tryInit);
        return;
      }

      const w = parseInt(container.dataset.width || '0', 10);
      const h = parseInt(container.dataset.height || '0', 10);

      if (w === 0 || h === 0) {
        if (!cancelled) requestAnimationFrame(tryInit);
        return;
      }

      // Already initialized? Just handle resize
      if (initLockRef.current && fabricCanvasRef.current) {
        const fc = fabricCanvasRef.current;
        if (fc.width !== w || fc.height !== h) {
          fc.setDimensions({ width: w, height: h });
          fc.renderAll();
        }
        // Keep watching for dimension changes
        if (!cancelled) setTimeout(() => { if (!cancelled) requestAnimationFrame(tryInit); }, 500);
        return;
      }

      // Lock to prevent double init
      initLockRef.current = true;

      // Clear container and create a fresh canvas element
      container.innerHTML = '';
      const canvasEl = document.createElement('canvas');
      canvasEl.width = w;
      canvasEl.height = h;
      container.appendChild(canvasEl);

      // Dynamically import Fabric.js and create canvas
      const fabricModule = await import('fabric');
      if (cancelled) return;

      const fc = new fabricModule.Canvas(canvasEl, {
        isDrawingMode: false,
        selection: true,
        width: w,
        height: h,
      });

      fabricCanvasRef.current = fc;
      setFabricReady(true);

      // Track changes for undo — save state BEFORE change (snapshot approach)
      let lastSnapshot = JSON.stringify(fc.toJSON());

      const pushUndo = () => {
        if (isUndoRedoRef.current) return; // Don't record during undo/redo
        undoStackRef.current.push(lastSnapshot);
        redoStackRef.current = [];
        setCanUndo(true);
        setCanRedo(false);
        lastSnapshot = JSON.stringify(fc.toJSON());
      };

      fc.on('object:added', pushUndo);
      fc.on('object:modified', pushUndo);
      fc.on('object:removed', pushUndo);

      // Update snapshot when canvas changes (covers all cases)
      fc.on('after:render', () => {
        if (!isUndoRedoRef.current) {
          lastSnapshot = JSON.stringify(fc.toJSON());
        }
      });

      console.log('Fabric.js canvas initialized:', w, 'x', h);

      // Continue watching for dimension changes
      if (!cancelled) setTimeout(() => { if (!cancelled) requestAnimationFrame(tryInit); }, 500);
    };

    requestAnimationFrame(tryInit);

    return () => {
      cancelled = true;
    };
  }, [file]);

  // ── Save / restore annotations when switching pages
  useEffect(() => {
    const fc = fabricCanvasRef.current;
    if (!fc || !fabricReady || !file) return;

    // Save annotations from previous page
    if (prevPageRef.current !== currentPage) {
      const json = JSON.stringify(fc.toJSON());
      annotationHistoryRef.current.set(prevPageRef.current, { objects: json });
      prevPageRef.current = currentPage;
    }

    // Load annotations for new page
    const savedState = annotationHistoryRef.current.get(currentPage);
    fc.clear();
    if (savedState) {
      fc.loadFromJSON(savedState.objects, () => {
        fc.renderAll();
      });
    } else {
      fc.renderAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, file]);

  // ── Keyboard Delete Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const fc = fabricCanvasRef.current;
      if (!fc || activeTool !== 'select') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Prevent default backspace behavior if not editing text
        const activeObject = fc.getActiveObject();
        if (activeObject) {
          if (activeObject.type === 'i-text' && (activeObject as any).isEditing) {
            return; // Let native text editing handle backspace
          }

          e.preventDefault();
          const activeObjects = fc.getActiveObjects();
          if (activeObjects.length) {
            activeObjects.forEach(obj => {
              fc.remove(obj);
            });
            fc.discardActiveObject();
            fc.renderAll();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool]);

  // ── Update tool mode on Fabric canvas
  useEffect(() => {
    const fc = fabricCanvasRef.current;
    if (!fc || !fabricReady) return;

    // Reset handlers
    fc.isDrawingMode = false;
    fc.selection = true;
    fc.defaultCursor = 'default';
    fc.hoverCursor = 'move';
    fc.off('mouse:down');
    fc.off('mouse:move');
    fc.off('mouse:up');
    fc.off('mouse:over');

    if (activeTool === 'select') {
      fc.selection = true;
      fc.forEachObject((obj: FabricObject) => {
        obj.selectable = true;
        obj.evented = true;
      });
    } else if (activeTool === 'freehand') {
      fc.selection = false;
      fc.forEachObject((obj: FabricObject) => { obj.selectable = false; obj.evented = false; });
      fc.isDrawingMode = true;
      import('fabric').then((fabricModule) => {
        const brush = new fabricModule.PencilBrush(fc);
        brush.color = activeColor;
        brush.width = strokeWidth;
        fc.freeDrawingBrush = brush;
      });
    } else if (activeTool === 'highlight') {
      fc.selection = false;
      fc.forEachObject((obj: FabricObject) => { obj.selectable = false; obj.evented = false; });
      fc.isDrawingMode = true;
      const hexToRgba = (hex: string, alpha: number) => {
        if (!hex || hex.length < 7) return `rgba(255,0,0,${alpha})`;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
      };
      import('fabric').then((fabricModule) => {
        const brush = new fabricModule.PencilBrush(fc);
        brush.color = hexToRgba(activeColor, 0.35);
        brush.width = 20;
        fc.freeDrawingBrush = brush;
      });
    } else if (activeTool === 'eraser') {
      fc.selection = false;
      fc.isDrawingMode = false;
      fc.defaultCursor = 'crosshair';
      fc.hoverCursor = 'crosshair';
      fc.forEachObject((obj: FabricObject) => {
        obj.selectable = false;
        obj.evented = true;
        obj.hoverCursor = 'crosshair';
        obj.perPixelTargetFind = false;
      });
      let isErasing = false;
      const erasedObjects = new Set<FabricObject>();

      const eraseTarget = (target: FabricObject | null | undefined) => {
        if (target && !erasedObjects.has(target)) {
          erasedObjects.add(target);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fc.remove(target as any);
          fc.renderAll();
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eraserDown = (opt: any) => {
        isErasing = true;
        erasedObjects.clear();
        // Try Fabric's built-in target first
        if (opt.target) {
          eraseTarget(opt.target);
          return;
        }
        // Manual fallback: check all objects by bounding rect
        const pointer = fc.getScenePoint(opt.e);
        const objects = fc.getObjects();
        for (let i = objects.length - 1; i >= 0; i--) {
          const obj = objects[i];
          if (erasedObjects.has(obj)) continue;
          const br = obj.getBoundingRect();
          if (pointer.x >= br.left && pointer.x <= br.left + br.width &&
              pointer.y >= br.top && pointer.y <= br.top + br.height) {
            eraseTarget(obj);
            return;
          }
        }
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eraserMove = (opt: any) => {
        if (!isErasing) return;
        if (opt.target) {
          eraseTarget(opt.target);
          return;
        }
        const pointer = fc.getScenePoint(opt.e);
        const objects = fc.getObjects();
        for (let i = objects.length - 1; i >= 0; i--) {
          const obj = objects[i];
          if (erasedObjects.has(obj)) continue;
          const br = obj.getBoundingRect();
          if (pointer.x >= br.left && pointer.x <= br.left + br.width &&
              pointer.y >= br.top && pointer.y <= br.top + br.height) {
            eraseTarget(obj);
            return;
          }
        }
      };
      const eraserUp = () => {
        isErasing = false;
        erasedObjects.clear();
      };
      fc.on('mouse:down', eraserDown);
      fc.on('mouse:move', eraserMove);
      fc.on('mouse:up', eraserUp);
    } else if (activeTool === 'text') {
      fc.selection = false;
      fc.forEachObject((obj: FabricObject) => { obj.selectable = false; obj.evented = false; });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (opt: any) => {
        fc.off('mouse:down', handler);
        import('fabric').then((fabricModule) => {
          const pointer = fc.getScenePoint(opt.e);
          const text = new fabricModule.IText('', {
            left: pointer.x,
            top: pointer.y,
            fontSize: 16 + strokeWidth,
            fill: activeColor,
            fontFamily: 'Inter, sans-serif',
            editable: true,
          });
          fc.add(text);
          fc.setActiveObject(text);
          text.enterEditing();
          fc.renderAll();
          setActiveTool('select');
        });
      };
      fc.on('mouse:down', handler);
    } else if (['rectangle', 'circle', 'line', 'arrow'].includes(activeTool)) {
      fc.selection = false;
      fc.forEachObject((obj: FabricObject) => { obj.selectable = false; obj.evented = false; });
      let isDrawing = false;
      let startX = 0;
      let startY = 0;
      let shapeObj: FabricObject | null = null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const downHandler = (opt: any) => {
        isDrawing = true;
        const pointer = fc.getScenePoint(opt.e);
        startX = pointer.x;
        startY = pointer.y;

        import('fabric').then((fabricModule) => {
          if (activeTool === 'rectangle') {
            shapeObj = new fabricModule.Rect({
              left: startX, top: startY,
              width: 0, height: 0,
              fill: 'transparent',
              stroke: activeColor,
              strokeWidth: strokeWidth,
            });
          } else if (activeTool === 'circle') {
            shapeObj = new fabricModule.Ellipse({
              left: startX, top: startY,
              rx: 0, ry: 0,
              fill: 'transparent',
              stroke: activeColor,
              strokeWidth: strokeWidth,
            });
          } else if (activeTool === 'line' || activeTool === 'arrow') {
            shapeObj = new fabricModule.Line([startX, startY, startX, startY], {
              stroke: activeColor,
              strokeWidth: strokeWidth,
              selectable: true,
            });
          }
          if (shapeObj) {
            fc.add(shapeObj);
          }
        });
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const moveHandler = (opt: any) => {
        if (!isDrawing || !shapeObj) return;
        const pointer = fc.getScenePoint(opt.e);

        if (activeTool === 'rectangle') {
          const rect = shapeObj as unknown as Rect;
          rect.set({
            width: Math.abs(pointer.x - startX),
            height: Math.abs(pointer.y - startY),
            left: Math.min(startX, pointer.x),
            top: Math.min(startY, pointer.y),
          });
        } else if (activeTool === 'circle') {
          const ellipse = shapeObj as unknown as Ellipse;
          ellipse.set({
            rx: Math.abs(pointer.x - startX) / 2,
            ry: Math.abs(pointer.y - startY) / 2,
            left: Math.min(startX, pointer.x),
            top: Math.min(startY, pointer.y),
          });
        } else if (activeTool === 'line' || activeTool === 'arrow') {
          const line = shapeObj as unknown as Line;
          line.set({ x2: pointer.x, y2: pointer.y });
        }
        fc.renderAll();
        // Update object coordinates so getBoundingRect() returns correct values
        if (shapeObj) shapeObj.setCoords();
      };

      const upHandler = () => {
        isDrawing = false;
        // Ensure final coordinates are set for bounding rect detection
        if (shapeObj) shapeObj.setCoords();

        if (activeTool === 'arrow' && shapeObj) {
          const currentShape = shapeObj; // Capture local ref before async clear

          // Remove the plain line and replace with a grouped arrow
          import('fabric').then((fabricModule) => {
            const line = currentShape as unknown as Line;
            const x1 = line.x1!, y1 = line.y1!;

            // Retrieve latest position
            let x2 = line.x2!, y2 = line.y2!;

            // Re-read from object properties just in case
            // @ts-ignore
            if (line.get) {
              // @ts-ignore
              x2 = line.get('x2'); y2 = line.get('y2');
            }

            // Remove the temporary line
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fc.remove(currentShape as any);

            // Create the final line
            const arrowLine = new fabricModule.Line([x1, y1, x2, y2], {
              stroke: activeColor,
              strokeWidth: strokeWidth,
            });

            // Create arrowhead using Triangle for reliable rendering
            const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
            const headLength = 10 + (strokeWidth * 2); // Make arrowhead proportional to strokeWidth

            const arrowHead = new fabricModule.Triangle({
              left: x2,
              top: y2,
              angle: angle + 90,
              width: headLength,
              height: headLength,
              fill: activeColor,
              originX: 'center',
              originY: 'center',
              selectable: true
            });

            // Group line + arrowhead into a single object
            const group = new fabricModule.Group([arrowLine, arrowHead], {
              selectable: true,
            });
            fc.add(group);
            group.setCoords();
            fc.renderAll();
          });
        }
        shapeObj = null;
      };

      fc.on('mouse:down', downHandler);
      fc.on('mouse:move', moveHandler);
      fc.on('mouse:up', upHandler);
    }
  }, [activeTool, activeColor, strokeWidth, fabricReady]);

  const handleUndo = async () => {
    const fc = fabricCanvasRef.current;
    if (!fc || undoStackRef.current.length === 0) return;
    isUndoRedoRef.current = true;
    const current = JSON.stringify(fc.toJSON());
    redoStackRef.current.push(current);
    const prev = undoStackRef.current.pop()!;
    try {
      await fc.loadFromJSON(prev);
      fc.renderAll();
    } catch (e) {
      console.error('Undo failed:', e);
    }
    isUndoRedoRef.current = false;
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
  };

  const handleRedo = async () => {
    const fc = fabricCanvasRef.current;
    if (!fc || redoStackRef.current.length === 0) return;
    isUndoRedoRef.current = true;
    const current = JSON.stringify(fc.toJSON());
    undoStackRef.current.push(current);
    const next = redoStackRef.current.pop()!;
    try {
      await fc.loadFromJSON(next);
      fc.renderAll();
    } catch (e) {
      console.error('Redo failed:', e);
    }
    isUndoRedoRef.current = false;
    setCanRedo(redoStackRef.current.length > 0);
    setCanUndo(true);
  };

  const handleClear = () => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;

    // Use pushUndo instead of saveUndoState to track history properly
    if (!isUndoRedoRef.current && fc.getObjects().length > 0) {
      // Create a snapshot before clearing
      undoStackRef.current.push(JSON.stringify(fc.toJSON()));
      redoStackRef.current = [];
      setCanUndo(true);
      setCanRedo(false);

      // Prevent object:removed from pushing more states while clearing
      const wasUndoRedo = isUndoRedoRef.current;
      isUndoRedoRef.current = true;
      fc.clear();
      isUndoRedoRef.current = wasUndoRedo;

      fc.renderAll();
    }

    // Explicitly update annotation history
    annotationHistoryRef.current.set(currentPage, { objects: JSON.stringify(fc.toJSON()) });
  };

  // ── Export
  const handleExport = useCallback(async () => {
    if (!file) return;
    showToast('Exporting annotated PDF...', 'info');
    try {
      const { PDFDocument } = await import('pdf-lib');
      const fabricModule = await import('fabric'); // Load fabric for StaticCanvas

      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      // Save current page state to history to ensure it's included
      if (fabricCanvasRef.current) {
        const json = JSON.stringify(fabricCanvasRef.current.toJSON());
        annotationHistoryRef.current.set(currentPage, { objects: json });
      }

      // Process each page
      for (let i = 0; i < pages.length; i++) {
        const pageNum = i + 1;
        const historyData = annotationHistoryRef.current.get(pageNum);

        if (historyData?.objects) {
          const pdfPage = pages[i];
          const { width, height } = pdfPage.getSize();

          // Create a temporary static canvas to render the annotations
          const tempCanvasEl = document.createElement('canvas');
          tempCanvasEl.width = width;
          tempCanvasEl.height = height;

          const staticCanvas = new fabricModule.StaticCanvas(tempCanvasEl);
          // Set dimensions to match the PDF page (and the stored JSON coordinates)
          staticCanvas.setDimensions({ width, height });
          staticCanvas.backgroundColor = 'transparent';

          // Load the annotation data
          await staticCanvas.loadFromJSON(JSON.parse(historyData.objects));

          // Render to data URL
          const currentAnnotations = staticCanvas.toDataURL({ format: 'png' } as unknown as TDataUrlOptions);

          // Embed in PDF
          const imgBytes = await fetch(currentAnnotations).then((res) => res.arrayBuffer());
          const img = await pdfDoc.embedPng(imgBytes);
          pdfPage.drawImage(img, { x: 0, y: 0, width, height });

          // Clean up
          staticCanvas.dispose();
        }
      }

      const pdfBytes = await pdfDoc.save();
      downloadBlob(pdfBytes, `annotated_${file.name}`);
      showToast('PDF exported successfully!', 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast('Failed to export PDF: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }, [file, currentPage, showToast]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));

  const handlePrevPage = () => {
    if (currentPage > 1) {
      if (fabricCanvasRef.current) {
        const json = JSON.stringify(fabricCanvasRef.current.toJSON());
        annotationHistoryRef.current.set(currentPage, { objects: json });
      }
      setCurrentPage((p) => p - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < pageCount) {
      if (fabricCanvasRef.current) {
        const json = JSON.stringify(fabricCanvasRef.current.toJSON());
        annotationHistoryRef.current.set(currentPage, { objects: json });
      }
      setCurrentPage((p) => p + 1);
    }
  };

  // ── Pinch to Zoom
  const touchStartDistRef = useRef(0);
  const touchStartZoomRef = useRef(zoom);

  // ── Mouse Wheel Zoom
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomChange = e.deltaY * -0.005;
        setZoom((z) => Math.min(Math.max(z + zoomChange, 0.5), 4));
      }
    };

    viewport.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheelZoom);
  }, []);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = d;
      touchStartZoomRef.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (touchStartDistRef.current > 0) {
        const scale = d / touchStartDistRef.current;
        setZoom(Math.min(Math.max(touchStartZoomRef.current * scale, 0.5), 4));
      }
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-logo">
          <FileEdit size={22} />
          <span>PDF Royale</span>
        </div>
        <nav className="tab-nav">
          <button className={`tab-btn ${activeTab === 'editor' ? 'active' : ''}`} onClick={() => setActiveTab('editor')}>
            <Pen size={15} /><span>Editor</span>
          </button>
          <button className={`tab-btn ${activeTab === 'merge' ? 'active' : ''}`} onClick={() => setActiveTab('merge')}>
            <Merge size={15} /><span>Merge</span>
          </button>
          <button className={`tab-btn ${activeTab === 'remove' ? 'active' : ''}`} onClick={() => setActiveTab('remove')}>
            <Trash2 size={15} /><span>Remove</span>
          </button>
        </nav>
        <div className="header-actions">
          <button className="btn btn-sm" onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} />Open PDF
          </button>
          <input ref={fileInputRef} type="file" accept=".pdf" hidden onChange={(e) => handleFile(e.target.files)} />
        </div>
      </header>

      <div className="main-content">
        {activeTab === 'editor' && (
          <>
            {!file ? (
              <div className="welcome-screen">
                <div
                  className={`dropzone ${dragOver ? 'dragging' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files); }}
                >
                  <div className="dropzone-icon"><Upload /></div>
                  <h2>Open a PDF to get started</h2>
                  <p>Drop your PDF file here or click to browse. Edit, annotate, and export — all in your browser.</p>
                  <div className="dropzone-formats"><span className="format-badge">PDF</span></div>
                </div>
              </div>
            ) : (
              <div className="editor-layout">
                <Sidebar
                  file={file}
                  pageCount={pageCount}
                  currentPage={currentPage}
                  onPageChange={(p) => {
                    if (fabricCanvasRef.current) {
                      const json = JSON.stringify(fabricCanvasRef.current.toJSON());
                      annotationHistoryRef.current.set(currentPage, { objects: json });
                    }
                    setCurrentPage(p);
                  }}
                />
                <div className="pdf-viewer-area">
                  <Toolbar
                    activeTool={activeTool}
                    onToolChange={setActiveTool}
                    activeColor={activeColor}
                    onColorChange={setActiveColor}
                    strokeWidth={strokeWidth}
                    onStrokeWidthChange={setStrokeWidth}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    onClear={handleClear}
                    onExport={handleExport}
                    canUndo={canUndo}
                    canRedo={canRedo}
                  />
                  <div
                    className="pdf-viewport"
                    ref={viewportRef}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    style={{
                      touchAction: 'pan-x pan-y',
                      cursor: activeTool === 'hand' ? (isPanningRef.current ? 'grabbing' : 'grab') : 'default',
                    }}
                    onMouseDown={(e) => {
                      if (activeTool !== 'hand') return;
                      isPanningRef.current = true;
                      panStartRef.current = { x: e.clientX, y: e.clientY };
                      const vp = viewportRef.current;
                      if (vp) scrollStartRef.current = { x: vp.scrollLeft, y: vp.scrollTop };
                      e.preventDefault();
                    }}
                    onMouseMove={(e) => {
                      if (!isPanningRef.current) return;
                      const dx = e.clientX - panStartRef.current.x;
                      const dy = e.clientY - panStartRef.current.y;
                      const vp = viewportRef.current;
                      if (vp) {
                        vp.scrollLeft = scrollStartRef.current.x - dx;
                        vp.scrollTop = scrollStartRef.current.y - dy;
                      }
                    }}
                    onMouseUp={() => { isPanningRef.current = false; }}
                    onMouseLeave={() => { isPanningRef.current = false; }}
                  >
                    <PDFViewer
                      file={file}
                      currentPage={currentPage}
                      zoom={zoom}
                      onPageCountChange={setPageCount}
                      onPageChange={setCurrentPage}
                      onPageLoaded={(dimensions) => {
                        if (!initialFitDone && viewportRef.current && dimensions) {
                          const viewportHeight = viewportRef.current.clientHeight - 48;
                          const calculatedZoom = viewportHeight / dimensions.unscaledHeight;
                          setZoom(Math.min(calculatedZoom, 2));
                          setInitialFitDone(true);
                        }
                      }}
                      isHandTool={activeTool === 'hand'}
                    />
                  </div>
                  <div className="status-bar">
                    <span>{currentPage}/{pageCount}</span>
                    <div className="zoom-controls">
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={handlePrevPage} disabled={currentPage <= 1} style={{ opacity: currentPage <= 1 ? 0.3 : 1 }}>
                        <ChevronLeft size={16} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={handleNextPage} disabled={currentPage >= pageCount} style={{ opacity: currentPage >= pageCount ? 0.3 : 1 }}>
                        <ChevronRight size={16} />
                      </button>
                      <div className="toolbar-separator" style={{ height: '20px' }} />
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={handleZoomOut}><ZoomOut size={16} /></button>
                      <span>{Math.round(zoom * 100)}%</span>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={handleZoomIn}><ZoomIn size={16} /></button>
                    </div>
                    <span style={{ fontSize: '11px' }}>{file.name}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {activeTab === 'merge' && <MergePanel onToast={showToast} />}
        {activeTab === 'remove' && <RemovePagesPanel onToast={showToast} />}
      </div>

      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.type}`}>{toast.message}</div>
          ))}
        </div>
      )}
    </div>
  );
}
