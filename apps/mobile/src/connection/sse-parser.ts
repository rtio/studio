export interface SseEvent {
	// The `event:` field, or 'message' when the block has none.
	event: string;
	// The `data:` lines of the block, joined with newlines.
	data: string;
}

// The longest event the parser keeps, in characters. An agent event with the
// output of a tool can be large, so the limit is generous.
const MAX_EVENT_LENGTH = 8_000_000;

// Use one parser per connection. A partial block left by a dropped connection
// would be joined to the start of the next stream.
export interface SseParser {
	// Feed decoded text as it arrives. Complete blocks are emitted at once.
	push( chunk: string ): void;
}

function parseBlock( block: string ): SseEvent | null {
	let event = 'message';
	const data: string[] = [];

	for ( const line of block.split( '\n' ) ) {
		if ( line === '' || line.startsWith( ':' ) ) {
			continue;
		}
		const colon = line.indexOf( ':' );
		const field = colon === -1 ? line : line.slice( 0, colon );
		let value = colon === -1 ? '' : line.slice( colon + 1 );
		if ( value.startsWith( ' ' ) ) {
			value = value.slice( 1 );
		}
		if ( field === 'event' ) {
			event = value || 'message';
		} else if ( field === 'data' ) {
			data.push( value );
		}
	}

	return data.length === 0 ? null : { event, data: data.join( '\n' ) };
}

export function createSseParser( onEvent: ( event: SseEvent ) => void ): SseParser {
	let buffer = '';

	return {
		push( chunk ) {
			// Normalizing the whole buffer also joins a CRLF that two chunks split.
			buffer = ( buffer + chunk ).replace( /\r\n/g, '\n' );
			// One event that never ends must not fill the phone's memory. It is
			// dropped, and the stream goes on with the next event.
			if ( buffer.length > MAX_EVENT_LENGTH && ! buffer.includes( '\n\n' ) ) {
				buffer = '';
				return;
			}
			let end = buffer.indexOf( '\n\n' );
			while ( end !== -1 ) {
				const parsed = parseBlock( buffer.slice( 0, end ) );
				buffer = buffer.slice( end + 2 );
				if ( parsed ) {
					onEvent( parsed );
				}
				end = buffer.indexOf( '\n\n' );
			}
		},
	};
}
