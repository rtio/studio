import { describe, expect, it } from 'vitest';
import { createConnectionHistory } from './connection-history';

describe( 'createConnectionHistory', () => {
	it( 'keeps when the link was last live and when its last problem began', () => {
		let time = 1000;
		const history = createConnectionHistory( () => time );

		history.note( 'live' );
		expect( history.store.get().lastLiveAt ).toBeNull();
		time = 2000;
		// Live until now.
		history.note( 'reconnecting' );
		time = 3000;
		// Still the same problem: it began at 2000.
		history.note( 'reconnecting' );

		expect( history.store.get() ).toEqual( {
			lastLiveAt: 2000,
			lastProblem: { status: 'reconnecting', at: 2000 },
		} );
	} );

	it( 'forgets everything for another computer', () => {
		const history = createConnectionHistory( () => 1000 );
		history.note( 'wrong-computer' );

		history.clear();

		expect( history.store.get() ).toEqual( { lastLiveAt: null, lastProblem: null } );
	} );

	it( 'does not carry the live link of the last computer into the history of the next', () => {
		const history = createConnectionHistory( () => 1000 );
		history.note( 'live' );

		history.clear();
		history.note( 'reconnecting' );

		expect( history.store.get().lastLiveAt ).toBeNull();
	} );
} );
