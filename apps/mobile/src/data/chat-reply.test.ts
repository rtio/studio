import { promptEntry } from '@studio/agent/protocol/transcript/tests/session-entries';
import { entriesToTranscriptItems } from '@studio/agent/protocol/transcript/transcript-items';
import { describe, expect, it } from 'vitest';
import { applyChatEvent, endReply, NOTHING_LIVE, visibleEntries, withoutRead } from './chat-reply';
import type { ChatEvent, ChatLive } from './chat-reply';

function assistant( text: string, toolCall = false ) {
	return {
		role: 'assistant',
		content: [
			{ type: 'text', text },
			...( toolCall ? [ { type: 'toolCall', id: 'call-1', name: 'Edit', arguments: {} } ] : [] ),
		],
	};
}

function update( text: string, runId = 'run-1' ): ChatEvent {
	return {
		runId,
		type: 'message',
		timestamp: '2026-11-17T10:00:02.000Z',
		inner: { type: 'message_update', message: assistant( text ) },
	};
}

function end( message: unknown, runId = 'run-1' ): ChatEvent {
	return { runId, type: 'message', inner: { type: 'message_end', message } };
}

// Plays events with marks 1, 2, 3, ...
function play( events: ChatEvent[], start: ChatLive = NOTHING_LIVE ) {
	let live = start;
	const reads: boolean[] = [];
	events.forEach( ( event, index ) => {
		const step = applyChatEvent( live, event, index + 1 );
		live = step.live;
		reads.push( step.read );
	} );
	return { live, reads };
}

function shownText( live: ChatLive, readAt = 0 ) {
	const items = entriesToTranscriptItems( visibleEntries( saved, readAt, live.replies ), {
		running: true,
		startedAt: null,
	} );
	return JSON.stringify( items );
}

const saved = [ promptEntry( 'Add a header' ) ];

describe( 'applyChatEvent and visibleEntries', () => {
	it( 'shows the reply as it streams, after what the computer saved', () => {
		const { live, reads } = play( [ update( 'Updat' ), update( 'Updating the header.' ) ] );

		expect( reads ).toEqual( [ false, false ] );
		expect( live.replies ).toHaveLength( 1 );
		expect( shownText( live ) ).toContain( 'Updating the header.' );
		expect( shownText( live ) ).toContain( '"streaming":true' );
	} );

	it( 'asks for a read at the end of a message, and keeps the reply until a later read', () => {
		const { live, reads } = play( [
			update( 'Updating' ),
			end( assistant( 'Updating the header.', true ) ),
		] );

		expect( reads ).toEqual( [ false, true ] );
		expect( live.replies[ 0 ] ).toMatchObject( { endedAt: 2 } );
		// A read that started before the end does not have the message yet.
		expect( visibleEntries( saved, 1, live.replies ) ).toHaveLength( 2 );
		// One that started at the end or later does.
		expect( visibleEntries( saved, 2, live.replies ) ).toBe( saved );
	} );

	it( 'shows the steps of a complete reply before the read', () => {
		const { live } = play( [ update( 'Updating' ), end( assistant( 'Updating.', true ) ) ] );

		expect( shownText( live ) ).toContain( '"kind":"tool-use"' );
	} );

	it( 'keeps a complete reply in view when the next one starts before the read', () => {
		const { live } = play( [
			update( 'First' ),
			end( assistant( 'First reply.' ) ),
			update( 'Second' ),
		] );

		expect( live.replies ).toHaveLength( 2 );
		expect( shownText( live ) ).toContain( 'First reply.' );
		expect( shownText( live ) ).toContain( 'Second' );
	} );

	it( 'drops the replies a read has', () => {
		const { live } = play( [
			update( 'First' ),
			end( assistant( 'First reply.' ) ),
			update( 'Second' ),
		] );

		const read = withoutRead( live, 2 );

		expect( read.replies ).toHaveLength( 1 );
		expect( shownText( read, 2 ) ).not.toContain( 'First reply.' );
		expect( withoutRead( read, 2 ) ).toBe( read );
	} );

	it( 'asks for a read when the prompt or a tool result is saved', () => {
		const { reads } = play( [
			end( { role: 'user', content: [] } ),
			end( { role: 'toolResult', toolCallId: 'call-1', content: [] } ),
		] );

		expect( reads ).toEqual( [ true, true ] );
	} );

	it.each( [
		'question.asked',
		'chat.artifact',
		'turn.completed',
		'run.interrupted',
		'run.exited',
	] )( 'asks for a read after %s', ( type ) => {
		expect( play( [ { runId: 'run-1', type } ] ).reads ).toEqual( [ true ] );
	} );

	it( 'ends a reply that was still streaming when the run stopped', () => {
		const { live } = play( [ update( 'Updat' ), { runId: 'run-1', type: 'run.interrupted' } ] );

		expect( live.replies[ 0 ] ).toMatchObject( { endedAt: 2 } );
		expect( visibleEntries( saved, 2, live.replies ) ).toBe( saved );
	} );

	it( 'ignores the late events of a stopped run once a new run started', () => {
		const { live, reads } = play( [
			{ runId: 'run-1', type: 'run.started' },
			update( 'Old' ),
			{ runId: 'run-2', type: 'run.started' },
			update( 'New', 'run-2' ),
			{ runId: 'run-1', type: 'run.exited' },
			update( 'Old again' ),
		] );

		expect( reads ).toEqual( [ false, false, false, false, false, false ] );
		expect( live.replies ).toEqual( [
			expect.objectContaining( { runId: 'run-2', endedAt: null } ),
		] );
	} );

	it( 'shows the error of a run that could not start, and drops it when the turn saved its own', () => {
		const failed = play( [ { runId: 'run-1', type: 'error', text: 'Site not found' } ] ).live;
		const closed = play( [ { runId: 'run-1', type: 'turn.completed' } ], failed ).live;

		expect( failed.error ).toBe( 'Site not found' );
		expect( closed.error ).toBeNull();
		expect( play( [ { runId: 'run-2', type: 'run.started' } ], failed ).live ).toEqual( {
			...NOTHING_LIVE,
			runId: 'run-2',
		} );
	} );

	it( 'ignores a message the transcript code could not read', () => {
		const broken = {
			runId: 'run-1',
			type: 'message',
			inner: { type: 'message_update', message: { role: 'assistant', content: 'text' } },
		};

		expect( play( [ broken ] ).live ).toBe( NOTHING_LIVE );
	} );

	it( 'changes nothing for events the chat does not show', () => {
		const start = play( [ update( 'Updating' ) ] ).live;
		const step = applyChatEvent(
			start,
			{ runId: 'run-1', type: 'message', inner: { type: 'tool_execution_start' } },
			9
		);

		expect( step ).toEqual( { live: start, read: false } );
		expect( step.live ).toBe( start );
	} );

	it( 'ends the reply being written when the stream opened again', () => {
		const { live } = play( [ update( 'Updating' ) ] );

		expect( endReply( live, 5 ).replies[ 0 ] ).toMatchObject( { endedAt: 5 } );
		expect( endReply( NOTHING_LIVE, 5 ) ).toBe( NOTHING_LIVE );
	} );
} );
