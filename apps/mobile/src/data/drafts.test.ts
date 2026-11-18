import { describe, expect, it } from 'vitest';
import { createDrafts, draftKey, EMPTY_DRAFT, failedSendKey } from './drafts';

describe( 'createDrafts', () => {
	it( 'keeps a draft for each chat', () => {
		const drafts = createDrafts();

		drafts.set( 'chat-1', 'Add a menu' );
		drafts.set( 'chat-2', 'Add a footer' );

		expect( drafts.get( 'chat-1' ).text ).toBe( 'Add a menu' );
		expect( drafts.get( 'chat-2' ).text ).toBe( 'Add a footer' );
		expect( drafts.get( 'chat-3' ) ).toEqual( EMPTY_DRAFT );
	} );

	it( 'puts a failed send back, unless the person typed something since', () => {
		const drafts = createDrafts();

		drafts.fail( 'chat-1', 'Add a menu', drafts.generation() );
		expect( drafts.get( 'chat-1' ) ).toEqual( { text: 'Add a menu', failed: true } );

		drafts.set( 'chat-2', 'Newer text' );
		drafts.fail( 'chat-2', 'Add a footer', drafts.generation() );
		expect( drafts.get( 'chat-2' ) ).toEqual( { text: 'Newer text', failed: true } );

		drafts.clearFailure( 'chat-1' );
		expect( drafts.get( 'chat-1' ) ).toEqual( { text: 'Add a menu', failed: false } );

		// Only spaces typed since: the text that was not sent comes back.
		drafts.set( 'chat-3', ' \n' );
		drafts.fail( 'chat-3', 'Add a map', drafts.generation() );
		expect( drafts.get( 'chat-3' ) ).toEqual( { text: 'Add a map', failed: true } );
	} );

	it( 'drops an empty draft, and forgets every draft for another computer', () => {
		const drafts = createDrafts();
		drafts.set( 'chat-1', 'Add a menu' );

		drafts.set( 'chat-1', '' );
		expect( drafts.store.get() ).toEqual( {} );

		drafts.set( 'chat-2', 'Add a footer' );
		drafts.clear();
		expect( drafts.store.get() ).toEqual( {} );
	} );

	it( 'puts nothing back from a send begun before another computer was chosen', () => {
		const drafts = createDrafts();
		const since = drafts.generation();

		drafts.clear();
		drafts.fail( 'chat-1', 'Add a menu', since );

		expect( drafts.store.get() ).toEqual( {} );
	} );
} );

describe( 'draftKey', () => {
	it( 'names a chat by its id, and a new chat by its site', () => {
		expect( draftKey( 'chat-1', 's1' ) ).toBe( 'chat-1' );
		expect( draftKey( null, 's1' ) ).toBe( 'new:s1' );
		expect( draftKey( null, null ) ).toBe( 'new:' );
	} );
} );

describe( 'failedSendKey', () => {
	it( 'puts the text back where it was typed, or in the chat the send made while it is open', () => {
		expect( failedSendKey( 'chat-1', null, 'chat-2' ) ).toBe( 'chat-1' );
		expect( failedSendKey( 'new:s1', null, null ) ).toBe( 'new:s1' );
		expect( failedSendKey( 'new:s1', 'chat-9', 'chat-9' ) ).toBe( 'chat-9' );
		// The person left the chat the send made: the drawer does not list it.
		expect( failedSendKey( 'new:s1', 'chat-9', 'chat-2' ) ).toBe( 'new:s1' );
	} );
} );
