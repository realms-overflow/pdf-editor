'use client';

import React from 'react';
import {
    MousePointer2,
    Pencil,
    Highlighter,
    Type,
    Square,
    Circle,
    ArrowRight,
    Minus,
    Undo2,
    Redo2,
    Trash2,
    Download,
    Eraser,
} from 'lucide-react';

export type AnnotationTool =
    | 'select'
    | 'freehand'
    | 'highlight'
    | 'text'
    | 'rectangle'
    | 'circle'
    | 'arrow'
    | 'line'
    | 'eraser';

interface ToolbarProps {
    activeTool: AnnotationTool;
    onToolChange: (tool: AnnotationTool) => void;
    activeColor: string;
    onColorChange: (color: string) => void;
    strokeWidth: number;
    onStrokeWidthChange: (width: number) => void;
    onUndo: () => void;
    onRedo: () => void;
    onClear: () => void;
    onExport: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'];

const TOOLS: { id: AnnotationTool; icon: React.ReactNode; label: string }[] = [
    { id: 'select', icon: <MousePointer2 />, label: 'Select' },
    { id: 'freehand', icon: <Pencil />, label: 'Draw' },
    { id: 'highlighter' as AnnotationTool, icon: <Highlighter />, label: 'Highlight' },
    { id: 'text', icon: <Type />, label: 'Text' },
    { id: 'rectangle', icon: <Square />, label: 'Rectangle' },
    { id: 'circle', icon: <Circle />, label: 'Circle' },
    { id: 'arrow', icon: <ArrowRight />, label: 'Arrow' },
    { id: 'line', icon: <Minus />, label: 'Line' },
    { id: 'eraser', icon: <Eraser />, label: 'Eraser' },
];

// Fix the highlight tool id mapping
TOOLS[2].id = 'highlight';

export default function Toolbar({
    activeTool,
    onToolChange,
    activeColor,
    onColorChange,
    strokeWidth,
    onStrokeWidthChange,
    onUndo,
    onRedo,
    onClear,
    onExport,
    canUndo,
    canRedo,
}: ToolbarProps) {
    return (
        <div className="toolbar">
            <div className="toolbar-group">
                {TOOLS.map((tool) => (
                    <button
                        key={tool.id}
                        className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
                        onClick={() => onToolChange(tool.id)}
                    >
                        {tool.icon}
                        <span className="tooltip">{tool.label}</span>
                    </button>
                ))}
            </div>

            <div className="toolbar-separator" />

            <div className="toolbar-group">
                <button
                    className="tool-btn"
                    onClick={onUndo}
                    disabled={!canUndo}
                    style={{ opacity: canUndo ? 1 : 0.4 }}
                >
                    <Undo2 />
                    <span className="tooltip">Undo</span>
                </button>
                <button
                    className="tool-btn"
                    onClick={onRedo}
                    disabled={!canRedo}
                    style={{ opacity: canRedo ? 1 : 0.4 }}
                >
                    <Redo2 />
                    <span className="tooltip">Redo</span>
                </button>
                <button className="tool-btn" onClick={onClear}>
                    <Trash2 />
                    <span className="tooltip">Clear All</span>
                </button>
            </div>

            <div className="toolbar-separator" />

            <div className="color-picker-wrapper">
                {COLORS.map((color) => (
                    <button
                        key={color}
                        className={`color-btn ${activeColor === color ? 'active' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => onColorChange(color)}
                    />
                ))}
            </div>

            <div className="toolbar-separator" />

            <div className="stroke-width-selector">
                <label>Size</label>
                <input
                    type="range"
                    min={1}
                    max={20}
                    value={strokeWidth}
                    onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', minWidth: '20px' }}>
                    {strokeWidth}
                </span>
            </div>

            <div style={{ marginLeft: 'auto' }}>
                <button className="btn btn-primary" onClick={onExport}>
                    <Download size={16} />
                    <span>Export & Download (v2)</span>
                </button>
            </div>
        </div>
    );
}
