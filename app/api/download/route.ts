import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

// Using OS temp directory for ephemeral storage
const TEMP_DIR = os.tmpdir();

export async function POST(req: NextRequest) {
    try {
        let filename: string | undefined;
        let fileData: string | undefined;

        const contentType = req.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            const json = await req.json();
            filename = json.filename;
            fileData = json.fileData;
        } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
            const formData = await req.formData();
            filename = formData.get('filename') as string;
            fileData = formData.get('fileData') as string;
        }

        if (!filename || !fileData) {
            return NextResponse.json({ error: 'Missing filename or fileData' }, { status: 400 });
        }

        // Decode base64
        const buffer = Buffer.from(fileData, 'base64');

        // Generate unique ID and save to temp
        const fileId = uuidv4();
        const filePath = path.join(TEMP_DIR, `pdf-export-${fileId}.pdf`);

        await fs.promises.writeFile(filePath, buffer);

        // Return the download URL
        return NextResponse.json({
            success: true,
            fileId,
            downloadUrl: `/api/download?fileId=${fileId}&filename=${encodeURIComponent(filename)}`
        });

    } catch (error) {
        console.error('Upload API error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const fileId = searchParams.get('fileId');
        const filename = searchParams.get('filename') || 'download.pdf';

        if (!fileId) {
            return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
        }

        // Validate fileId format to prevent path traversal
        if (!/^[a-zA-Z0-9-]+$/.test(fileId)) {
            return NextResponse.json({ error: 'Invalid fileId' }, { status: 400 });
        }

        const filePath = path.join(TEMP_DIR, `pdf-export-${fileId}.pdf`);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'File expired or not found' }, { status: 404 });
        }

        const fileBuffer = await fs.promises.readFile(filePath);

        // Schedule cleanup (optional, OS handles temp eventually, but good practice)
        // setTimeout(() => fs.unlinkSync(filePath), 60000); 

        // Return as attachment with comprehensive headers
        const encodedFilename = encodeURIComponent(filename).replace(/['()]/g, escape).replace(/\*/g, '%2A');

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
                'Content-Length': fileBuffer.length.toString(),
            },
        });

    } catch (error) {
        console.error('Download GET API error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
