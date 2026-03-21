import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { writeFile, readFile, unlink, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

const SOFFICE_PATHS = [
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/usr/local/bin/soffice',
    '/usr/local/bin/libreoffice',
];

function findSoffice(): string | null {
    // Check common paths
    for (const p of SOFFICE_PATHS) {
        try {
            require('fs').accessSync(p);
            return p;
        } catch { /* not found */ }
    }
    return null;
}

export async function POST(req: NextRequest) {
    const soffice = findSoffice();
    if (!soffice) {
        return NextResponse.json(
            { error: 'LibreOffice not found on server' },
            { status: 500 }
        );
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const tempDir = await mkdtemp(path.join(tmpdir(), 'docx-'));
        const inputPath = path.join(tempDir, file.name);
        await writeFile(inputPath, buffer);

        // Convert using LibreOffice
        await new Promise<void>((resolve, reject) => {
            execFile(
                soffice,
                [
                    '--headless',
                    '--convert-to', 'pdf',
                    '--outdir', tempDir,
                    inputPath,
                ],
                { timeout: 30000 },
                (error, _stdout, stderr) => {
                    if (error) {
                        reject(new Error(`LibreOffice error: ${stderr || error.message}`));
                    } else {
                        resolve();
                    }
                }
            );
        });

        const pdfName = file.name.replace(/\.docx$/i, '.pdf');
        const pdfPath = path.join(tempDir, pdfName);
        const pdfBuffer = await readFile(pdfPath);

        // Cleanup temp files
        await unlink(inputPath).catch(() => {});
        await unlink(pdfPath).catch(() => {});

        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${pdfName}"`,
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Conversion failed';
        console.error('Word to PDF conversion error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const config = {
    api: {
        bodyParser: false,
    },
};
