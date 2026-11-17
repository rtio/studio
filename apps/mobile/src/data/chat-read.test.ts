import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { createChatReader, requestChatRead } from './chat-read';

const KEY = [ 'chat', 'device-1', 'chat-1' ] as const;

function deferred< T >() {
	let resolve!: ( value: T ) => void;
	const promise = new Promise< T >( ( onResolve ) => {
		resolve = onResolve;
	} );
	return { promise, resolve };
}

// Lets the query cache run its callbacks.
const settle = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

describe( 'requestChatRead', () => {
	it( 'reads nothing while the chat query is disabled, as it is while the link is not live', async () => {
		const client = new QueryClient();
		const queryFn = vi.fn( async () => 'chat' );
		const observer = new QueryObserver( client, { queryKey: KEY, queryFn, enabled: false } );
		const stop = observer.subscribe( () => {} );

		await requestChatRead( client, KEY );
		await settle();

		expect( queryFn ).not.toHaveBeenCalled();
		stop();
	} );

	it( 'reads an enabled chat again, and does not stop a read on its way', async () => {
		const client = new QueryClient();
		const reads: Array< { signal: AbortSignal; answer: ReturnType< typeof deferred< string > > } > =
			[];
		const queryFn = vi.fn( ( { signal }: { signal: AbortSignal } ) => {
			const answer = deferred< string >();
			reads.push( { signal, answer } );
			return answer.promise;
		} );
		const observer = new QueryObserver( client, {
			queryKey: KEY,
			queryFn,
			staleTime: Infinity,
		} );
		const stop = observer.subscribe( () => {} );
		await settle();
		reads[ 0 ].answer.resolve( 'first' );
		await settle();

		void requestChatRead( client, KEY );
		await settle();
		expect( queryFn ).toHaveBeenCalledTimes( 2 );

		void requestChatRead( client, KEY );
		await settle();
		expect( queryFn ).toHaveBeenCalledTimes( 2 );
		expect( reads[ 1 ].signal.aborted ).toBe( false );
		stop();
	} );
} );

describe( 'createChatReader', () => {
	it( 'notes the mark before the request', async () => {
		let marks = 2;
		const get = vi.fn( async () => {
			// An event arrives while the computer answers.
			marks = 5;
			return { entries: [] };
		} );

		const read = await createChatReader( get, () => marks )( 'chat 1' );

		expect( read ).toEqual( { entries: [], readAt: 2 } );
		expect( get ).toHaveBeenCalledWith( '/api/sessions/chat%201', { signal: undefined } );
	} );

	it( 'fails when the computer does not send a chat', async () => {
		const reader = createChatReader(
			async () => ( { error: 'Internal error' } ),
			() => 0
		);

		await expect( reader( 'chat-1' ) ).rejects.toThrow( 'did not send a chat' );
	} );
} );
