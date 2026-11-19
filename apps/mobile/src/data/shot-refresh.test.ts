import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShotRefresh } from './shot-refresh';

const SITES: Record< string, string > = { 'chat-1': 's1', 'chat-2': 's1', 'chat-3': 's2' };

function setup() {
	const refresh = vi.fn();
	const shots = createShotRefresh( {
		siteOfChat: ( chatId ) => SITES[ chatId ],
		refresh,
		now: Date.now,
	} );
	return { shots, refresh };
}

beforeEach( () => {
	vi.useFakeTimers();
} );

afterEach( () => {
	vi.useRealTimers();
} );

describe( 'createShotRefresh', () => {
	it( 'refreshes the shown site when its preview reloads or a run in one of its chats ends', () => {
		const { shots, refresh } = setup();
		shots.show( 's1' );

		shots.handle( 'chat-1', { type: 'preview.reload' } );
		vi.advanceTimersByTime( 1000 );
		shots.handle( 'chat-2', { type: 'run.exited' } );

		expect( refresh ).toHaveBeenCalledTimes( 2 );
		expect( refresh ).toHaveBeenCalledWith( 's1' );
	} );

	it( 'leaves other events, other sites and a closed sheet alone', () => {
		const { shots, refresh } = setup();

		shots.handle( 'chat-1', { type: 'run.exited' } );
		shots.show( 's1' );
		shots.handle( 'chat-1', { type: 'turn.completed' } );
		shots.handle( 'chat-3', { type: 'run.exited' } );
		shots.handle( 'chat-unknown', { type: 'preview.reload' } );

		expect( refresh ).not.toHaveBeenCalled();
	} );

	it( 'refreshes at most once a second, and once more at the end of that second', () => {
		const { shots, refresh } = setup();
		shots.show( 's1' );

		shots.handle( 'chat-1', { type: 'preview.reload' } );
		vi.advanceTimersByTime( 300 );
		shots.handle( 'chat-1', { type: 'preview.reload' } );
		shots.handle( 'chat-1', { type: 'run.exited' } );
		expect( refresh ).toHaveBeenCalledTimes( 1 );

		vi.advanceTimersByTime( 699 );
		expect( refresh ).toHaveBeenCalledTimes( 1 );
		vi.advanceTimersByTime( 1 );
		expect( refresh ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'drops a waiting refresh when the sheet closes or shows another site', () => {
		const { shots, refresh } = setup();
		shots.show( 's1' );
		shots.handle( 'chat-1', { type: 'preview.reload' } );
		shots.handle( 'chat-1', { type: 'run.exited' } );

		shots.show( null );
		vi.advanceTimersByTime( 1000 );
		expect( refresh ).toHaveBeenCalledTimes( 1 );

		shots.show( 's1' );
		shots.handle( 'chat-1', { type: 'preview.reload' } );
		shots.handle( 'chat-1', { type: 'run.exited' } );
		shots.show( 's2' );
		vi.advanceTimersByTime( 1000 );
		expect( refresh ).toHaveBeenCalledTimes( 2 );
		expect( refresh ).toHaveBeenLastCalledWith( 's1' );
	} );
} );
