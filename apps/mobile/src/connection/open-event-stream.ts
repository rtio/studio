import { fetch as streamingFetch } from 'expo/fetch';
import { HttpError, UnauthorizedError } from './api-client';
import type { Connection } from './connection-store';
import type { StreamConnection } from './event-stream';

// Opens `GET /api/events` on the paired computer and feeds the text to the
// stream as it arrives. React Native's own `fetch` gives the body only at the
// end, so this uses Expo's streaming `fetch`. It resolves when the computer
// closes the stream and rejects when the request fails.
export async function openEventStream(
	connection: Connection,
	stream: StreamConnection
): Promise< void > {
	const response = await streamingFetch( `${ connection.baseUrl }/api/events`, {
		headers: { Accept: 'text/event-stream', Authorization: `Bearer ${ connection.token }` },
		signal: stream.signal,
	} );
	if ( response.status === 401 ) {
		throw new UnauthorizedError();
	}
	if ( ! response.ok || ! response.body ) {
		throw new HttpError( response.status, `The event stream answered ${ response.status }` );
	}

	stream.onOpen();
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	for (;;) {
		const { done, value } = await reader.read();
		if ( done ) {
			return;
		}
		stream.onData( decoder.decode( value, { stream: true } ) );
	}
}
