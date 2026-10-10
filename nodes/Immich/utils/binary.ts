import { IBinaryData, IExecuteSingleFunctions, IN8nHttpFullResponse, INodeExecutionData } from 'n8n-workflow';

const MIME_MAP: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	bmp: 'image/bmp',
	tiff: 'image/tiff',
	webp: 'image/webp',
	heic: 'image/heic',
	heif: 'image/heif',
	mp4: 'video/mp4',
	mov: 'video/quicktime',
};

function resolveHeader(value: unknown, fallback: string): string {
	if (typeof value === 'string') return value;
	return fallback;
}

function extractFileName(contentDisposition: string): string {
	// RFC 5987 extended form takes precedence, e.g. filename*=UTF-8''my%20file.jpg
	const extended = contentDisposition.match(/filename\*=[^']*'[^']*'([^;]+)/i);
	if (extended?.[1]) {
		const value = extended[1].trim();
		try {
			return decodeURIComponent(value);
		} catch {
			return value;
		}
	}
	// Quoted form, e.g. filename="my file.jpg"
	const quoted = contentDisposition.match(/filename="([^"]+)"/i);
	if (quoted?.[1]) {
		return quoted[1];
	}
	// Bare form, e.g. filename=my-file.jpg
	const bare = contentDisposition.match(/filename=([^;]+)/i);
	return bare?.[1]?.trim() ?? 'downloaded-file';
}

export async function processBinaryResponse(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	responseData: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const contentType = resolveHeader(responseData.headers['content-type'], 'application/octet-stream');
	const contentDisposition = resolveHeader(responseData.headers['content-disposition'], '');

	const fileName = extractFileName(contentDisposition);
	const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
	const mimeType = MIME_MAP[ext] ?? contentType;

	const binaryData: IBinaryData = await this.helpers.prepareBinaryData(
		responseData.body as Buffer,
		fileName,
		mimeType,
	);

	return items.map((item) => {
		item.json = {};
		item.binary = { data: binaryData };
		return item;
	});
}
