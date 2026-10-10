import { IBinaryData, IExecuteSingleFunctions, IN8nHttpFullResponse, INodeExecutionData } from 'n8n-workflow';

const GENERIC_MIME = 'application/octet-stream';

/** File extension → MIME type, used only when the server sends no useful Content-Type. */
const MIME_BY_EXT: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	bmp: 'image/bmp',
	tiff: 'image/tiff',
	webp: 'image/webp',
	avif: 'image/avif',
	heic: 'image/heic',
	heif: 'image/heif',
	mp4: 'video/mp4',
	mov: 'video/quicktime',
};

/** MIME type → file extension, for naming files the server sent without a filename. */
const EXT_BY_MIME: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/gif': 'gif',
	'image/bmp': 'bmp',
	'image/tiff': 'tiff',
	'image/webp': 'webp',
	'image/avif': 'avif',
	'image/heic': 'heic',
	'image/heif': 'heif',
	'video/mp4': 'mp4',
	'video/quicktime': 'mov',
};

function resolveHeader(value: unknown, fallback: string): string {
	if (typeof value === 'string') return value;
	return fallback;
}

function extractFileName(contentDisposition: string): string | undefined {
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
	return bare?.[1]?.trim() || undefined;
}

/**
 * Name for a response that carried no filename: `<assetId>` plus a
 * `-thumbnail`/`-preview` suffix for the View operation, plus an extension
 * derived from the MIME type.
 */
function fallbackFileName(ctx: IExecuteSingleFunctions, mimeType: string): string {
	const assetId = String(ctx.getNodeParameter('assetId', '') || 'asset');
	const operation = ctx.getNodeParameter('operation', '') as string;
	const suffix = operation === 'view' ? `-${String(ctx.getNodeParameter('size', 'thumbnail'))}` : '';
	const ext = EXT_BY_MIME[mimeType];
	return ext ? `${assetId}${suffix}.${ext}` : `${assetId}${suffix}`;
}

export async function processBinaryResponse(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	responseData: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	// Drop parameters such as "; charset=binary" so the type can be matched.
	const contentType = resolveHeader(responseData.headers['content-type'], '').split(';')[0].trim().toLowerCase();
	const contentDisposition = resolveHeader(responseData.headers['content-disposition'], '');
	const headerFileName = extractFileName(contentDisposition);

	// The server knows the real type; the extension is only a fallback.
	let mimeType = contentType && contentType !== GENERIC_MIME ? contentType : '';
	if (!mimeType && headerFileName) {
		mimeType = MIME_BY_EXT[headerFileName.split('.').pop()?.toLowerCase() ?? ''] ?? '';
	}
	mimeType ||= GENERIC_MIME;

	const fileName = headerFileName ?? fallbackFileName(this, mimeType);

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
