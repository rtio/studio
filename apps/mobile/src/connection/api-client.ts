// The part of `fetch` this client uses. The app passes the global `fetch`;
// tests pass a fake.
export type FetchLike = (
	url: string,
	init?: {
		method?: string;
		headers?: Record< string, string >;
		body?: string;
		signal?: AbortSignal;
	}
) => Promise< { ok: boolean; status: number; json: () => Promise< unknown > } >;

// No answer: the computer is off, `studio remote` is not running, the phone is
// on another network, or the request timed out.
export class UnreachableError extends Error {
	constructor() {
		super( 'The computer did not answer' );
		this.name = 'UnreachableError';
	}
}

// The computer answered 401: this phone is not paired, or not any more.
export class UnauthorizedError extends Error {
	constructor() {
		super( 'This phone is not paired with the computer' );
		this.name = 'UnauthorizedError';
	}
}

// Any other answer that is not a success.
export class HttpError extends Error {
	readonly status: number;

	constructor( status: number, message: string ) {
		super( message );
		this.name = 'HttpError';
		this.status = status;
	}
}

export interface ApiClientOptions {
	// Scheme, host and port, with no trailing slash.
	baseUrl: string;
	// The device token. Pairing has none yet.
	token?: string;
	fetch: FetchLike;
	timeoutMs?: number;
	// Called when the computer answers 401, before the error is thrown.
	onUnauthorized?: () => void;
}

export interface ApiClient {
	get: ( path: string ) => Promise< unknown >;
	post: ( path: string, body?: unknown ) => Promise< unknown >;
	delete: ( path: string ) => Promise< unknown >;
}

function readErrorMessage( payload: unknown, status: number ): string {
	if ( payload && typeof payload === 'object' && 'error' in payload ) {
		const message = ( payload as { error: unknown } ).error;
		if ( typeof message === 'string' && message ) {
			return message;
		}
	}
	return `Request failed with status ${ status }`;
}

// Talks to remote mode on the computer. Answers are returned as `unknown`: the
// caller checks their shape.
export function createApiClient( options: ApiClientOptions ): ApiClient {
	const { baseUrl, token, fetch, timeoutMs = 10_000, onUnauthorized } = options;

	async function request( method: string, path: string, body?: unknown ): Promise< unknown > {
		const controller = new AbortController();
		const timer = setTimeout( () => controller.abort(), timeoutMs );
		const headers: Record< string, string > = { Accept: 'application/json' };
		if ( token ) {
			headers.Authorization = `Bearer ${ token }`;
		}
		if ( body !== undefined ) {
			headers[ 'Content-Type' ] = 'application/json';
		}

		let response;
		try {
			response = await fetch( `${ baseUrl }${ path }`, {
				method,
				headers,
				body: body === undefined ? undefined : JSON.stringify( body ),
				signal: controller.signal,
			} );
		} catch {
			throw new UnreachableError();
		} finally {
			clearTimeout( timer );
		}

		if ( response.status === 401 ) {
			onUnauthorized?.();
			throw new UnauthorizedError();
		}
		if ( response.status === 204 ) {
			return undefined;
		}

		let payload: unknown;
		try {
			payload = await response.json();
		} catch {
			payload = undefined;
		}
		if ( ! response.ok ) {
			throw new HttpError( response.status, readErrorMessage( payload, response.status ) );
		}
		return payload;
	}

	return {
		get: ( path ) => request( 'GET', path ),
		post: ( path, body ) => request( 'POST', path, body ),
		delete: ( path ) => request( 'DELETE', path ),
	};
}
