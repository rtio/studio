import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOpenChat } from './open-chat';
import type { ChatEvent } from './chat-reply';

function update( text: string ): ChatEvent {
	return {
		runId: 'run-1',
		type: 'message',
		timestamp: '2026-11-17T10:00:02.000Z',
		inner: {
			type: 'message_update',
			message: { role: 'assistant', content: [ { type: 'text', text } ] },
		},
	};
}

function end( text: string ): ChatEvent {
	return {
		runId: 'run-1',
		type: 'message',
		inner: {
			type: 'message_end',
			message: { role: 'assistant', content: [ { type: 'text', text } ] },
		},
	};
}

function replyText( chat: ReturnType< typeof createOpenChat > ) {
	return JSON.stringify( chat.store.get().live.replies.map( ( reply ) => reply.message ) );
}

beforeEach( () => {
	vi.useFakeTimers();
} );

afterEach( () => {
	vi.useRealTimers();
} );

describe( 'createOpenChat', () => {
	it( 'draws streamed text at most every 50 ms, with the latest text', () => {
		const chat = createOpenChat( vi.fn() );
		chat.select( 'chat-1' );

		chat.handle( 'chat-1', update( 'Up' ) );
		chat.handle( 'chat-1', update( 'Updating' ) );
		expect( chat.store.get().live.replies ).toEqual( [] );

		vi.advanceTimersByTime( 50 );
		expect( replyText( chat ) ).toContain( 'Updating' );
	} );

	it( 'draws at once when the computer saved something, and reads the chat once after 400 ms', () => {
		const read = vi.fn();
		const chat = createOpenChat( read );
		chat.select( 'chat-1' );

		chat.handle( 'chat-1', update( 'Updating' ) );
		chat.handle( 'chat-1', end( 'Updating the header.' ) );
		chat.handle( 'chat-1', { runId: 'run-1', type: 'question.asked' } );

		expect( replyText( chat ) ).toContain( 'Updating the header.' );
		expect( read ).not.toHaveBeenCalled();
		vi.advanceTimersByTime( 400 );
		expect( read ).toHaveBeenCalledTimes( 1 );
		expect( read ).toHaveBeenCalledWith( 'chat-1' );
	} );

	it( 'notes a mark for each event, so a read started after an end has it', () => {
		const chat = createOpenChat( vi.fn() );
		chat.select( 'chat-1' );
		chat.handle( 'chat-1', update( 'Updating' ) );
		const before = chat.mark();
		chat.handle( 'chat-1', end( 'Updating the header.' ) );
		const after = chat.mark();

		chat.settled( 'chat-1', before );
		expect( chat.store.get().live.replies ).toHaveLength( 1 );
		chat.settled( 'chat-1', after );
		expect( chat.store.get().live.replies ).toEqual( [] );
	} );

	it( 'reads again when a read arrives that started before the last time a read was asked for', () => {
		const read = vi.fn();
		const chat = createOpenChat( read );
		chat.select( 'chat-1' );
		// A read that started now, before the question below was saved.
		const early = chat.mark();
		chat.handle( 'chat-1', { runId: 'run-1', type: 'question.asked' } );
		vi.advanceTimersByTime( 400 );
		expect( read ).toHaveBeenCalledTimes( 1 );

		chat.settled( 'chat-1', early );
		vi.advanceTimersByTime( 400 );
		expect( read ).toHaveBeenCalledTimes( 2 );

		chat.settled( 'chat-1', chat.mark() );
		vi.advanceTimersByTime( 400 );
		expect( read ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'ignores events of a chat that is not open', () => {
		const read = vi.fn();
		const chat = createOpenChat( read );
		chat.select( 'chat-1' );

		chat.handle( 'chat-2', { runId: 'run-2', type: 'turn.completed' } );
		vi.advanceTimersByTime( 500 );

		expect( read ).not.toHaveBeenCalled();
		expect( chat.store.get() ).toEqual( {
			chatId: 'chat-1',
			live: { runId: null, replies: [], error: null },
		} );
	} );

	it( 'forgets what it streamed, and a read it was about to make, when another chat opens', () => {
		const read = vi.fn();
		const chat = createOpenChat( read );
		chat.select( 'chat-1' );
		chat.handle( 'chat-1', update( 'Updating' ) );
		chat.handle( 'chat-1', { runId: 'run-1', type: 'turn.completed' } );

		chat.select( 'chat-2' );
		chat.select( 'chat-1' );
		vi.advanceTimersByTime( 500 );

		expect( chat.store.get().live.replies ).toEqual( [] );
		expect( read ).not.toHaveBeenCalled();
	} );

	it( 'reads the chat at once after the stream opened again, and lets that read replace the reply', () => {
		const read = vi.fn();
		const chat = createOpenChat( read );
		chat.select( 'chat-1' );
		chat.handle( 'chat-1', update( 'Updating' ) );

		chat.resync();

		expect( read ).toHaveBeenCalledWith( 'chat-1' );
		expect( chat.store.get().live.replies[ 0 ].endedAt ).toBe( chat.mark() );
	} );

	it( 'does nothing when no chat is open', () => {
		const read = vi.fn();
		const chat = createOpenChat( read );

		chat.resync();
		chat.handle( 'chat-1', { runId: 'run-1', type: 'run.exited' } );
		vi.advanceTimersByTime( 500 );

		expect( read ).not.toHaveBeenCalled();
	} );
} );
