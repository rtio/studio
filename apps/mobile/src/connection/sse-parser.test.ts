import { describe, expect, it } from 'vitest';
import { createSseParser } from './sse-parser';
import type { SseEvent } from './sse-parser';

function collect() {
	const events: SseEvent[] = [];
	const parser = createSseParser( ( event ) => events.push( event ) );
	return { events, parser };
}

describe( 'createSseParser', () => {
	it( 'emits one event for one complete block', () => {
		const { events, parser } = collect();
		parser.push( 'data: {"channel":"agent"}\n\n' );
		expect( events ).toEqual( [ { event: 'message', data: '{"channel":"agent"}' } ] );
	} );

	it( 'waits for the blank line when a block arrives in pieces', () => {
		const { events, parser } = collect();
		parser.push( 'data: {"chan' );
		expect( events ).toEqual( [] );
		parser.push( 'nel":"agent"}\n' );
		expect( events ).toEqual( [] );
		parser.push( '\n' );
		expect( events ).toEqual( [ { event: 'message', data: '{"channel":"agent"}' } ] );
	} );

	it( 'emits every event when one chunk holds several blocks', () => {
		const { events, parser } = collect();
		parser.push( 'data: 1\n\ndata: 2\n\ndata: 3' );
		expect( events.map( ( event ) => event.data ) ).toEqual( [ '1', '2' ] );
		parser.push( '\n\n' );
		expect( events.map( ( event ) => event.data ) ).toEqual( [ '1', '2', '3' ] );
	} );

	it( 'ignores comment lines such as the keep-alive', () => {
		const { events, parser } = collect();
		parser.push( ': connected\n\n: ping\n\ndata: 1\n\n' );
		expect( events ).toEqual( [ { event: 'message', data: '1' } ] );
	} );

	it( 'reads the event name', () => {
		const { events, parser } = collect();
		parser.push( 'event: tick\ndata: 1\n\n' );
		expect( events ).toEqual( [ { event: 'tick', data: '1' } ] );
	} );

	it( 'joins several data lines with a newline', () => {
		const { events, parser } = collect();
		parser.push( 'data: first\ndata: second\n\n' );
		expect( events ).toEqual( [ { event: 'message', data: 'first\nsecond' } ] );
	} );

	it( 'accepts CRLF line endings, also when a chunk splits one', () => {
		const { events, parser } = collect();
		parser.push( 'data: 1\r\n\r' );
		parser.push( '\ndata: 2\r\n\r\n' );
		expect( events.map( ( event ) => event.data ) ).toEqual( [ '1', '2' ] );
	} );

	it( 'keeps a value that has no space after the colon', () => {
		const { events, parser } = collect();
		parser.push( 'data:1\n\n' );
		expect( events ).toEqual( [ { event: 'message', data: '1' } ] );
	} );
} );
