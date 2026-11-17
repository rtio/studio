import { describe, expect, it } from 'vitest';
import { chatsOfSite, chatTitle, listChats, searchChats, withUpdatedSite } from './chat-list';
import type { Session } from './remote-schemas';

const SESSIONS: Session[] = [
	{
		id: 'older',
		updatedAt: '2026-11-16T09:00:00.000Z',
		firstPrompt: 'add a contact form',
		ownerSiteId: 's1',
		ownerSiteName: 'Bakery',
	},
	{
		id: 'newer',
		updatedAt: '2026-11-17T10:00:00.000Z',
		title: 'Landing page',
		firstPrompt: 'Create a landing page',
		ownerSiteId: 's2',
		ownerSiteName: 'Portfolio',
		activeEnvironment: 'live',
	},
	{
		id: 'archived',
		updatedAt: '2026-11-17T11:00:00.000Z',
		firstPrompt: 'Old work',
		archived: true,
	},
	{ id: 'draft', updatedAt: '2026-11-17T12:00:00.000Z' },
	{ id: 'unbound', updatedAt: '2026-11-15T08:00:00.000Z', firstPrompt: 'Explain block themes' },
];

describe( 'chatTitle', () => {
	it( 'uses the given name, then the first prompt, then the fallback', () => {
		expect( chatTitle( SESSIONS[ 1 ], 'New chat' ) ).toBe( 'Landing page' );
		expect( chatTitle( SESSIONS[ 0 ], 'New chat' ) ).toBe( 'Add a contact form' );
		expect( chatTitle( SESSIONS[ 3 ], 'New chat' ) ).toBe( 'New chat' );
	} );

	it( 'ignores a name that is only spaces', () => {
		expect( chatTitle( { ...SESSIONS[ 0 ], title: '   ' }, 'New chat' ) ).toBe(
			'Add a contact form'
		);
	} );
} );

describe( 'listChats', () => {
	it( 'lists the chats newest first, without archived chats and drafts', () => {
		const chats = listChats( SESSIONS, {}, 'New chat' );

		expect( chats.map( ( chat ) => chat.id ) ).toEqual( [ 'newer', 'older', 'unbound' ] );
	} );

	it( 'carries the site, the activity and the live target of each chat', () => {
		const chats = listChats(
			SESSIONS,
			{ older: { runId: 'run-1', activity: 'needs-answer' } },
			'New chat'
		);

		expect( chats[ 0 ] ).toEqual( {
			id: 'newer',
			title: 'Landing page',
			siteId: 's2',
			siteName: 'Portfolio',
			activity: null,
			live: true,
		} );
		expect( chats[ 1 ].activity ).toBe( 'needs-answer' );
		expect( chats[ 2 ] ).toMatchObject( { siteId: null, siteName: null, live: false } );
	} );

	it( 'keeps a draft that is working', () => {
		const chats = listChats(
			SESSIONS,
			{ draft: { runId: 'run-1', activity: 'working' } },
			'New chat'
		);

		expect( chats[ 0 ] ).toMatchObject( { id: 'draft', title: 'New chat', activity: 'working' } );
	} );

	it( 'does not change the list it was given', () => {
		const before = SESSIONS.map( ( session ) => session.id );

		listChats( SESSIONS, {}, 'New chat' );

		expect( SESSIONS.map( ( session ) => session.id ) ).toEqual( before );
	} );
} );

describe( 'chatsOfSite', () => {
	const chats = listChats( SESSIONS, {}, 'New chat' );

	it( 'returns the chats of one site', () => {
		expect( chatsOfSite( chats, 's1' ).map( ( chat ) => chat.id ) ).toEqual( [ 'older' ] );
	} );

	it( 'returns every chat when no site is chosen', () => {
		expect( chatsOfSite( chats, null ) ).toHaveLength( 3 );
	} );
} );

describe( 'searchChats', () => {
	const chats = listChats( SESSIONS, {}, 'New chat' );

	it( 'finds chats of every site whose title has every word, in any case', () => {
		expect( searchChats( chats, 'PAGE landing' ).map( ( chat ) => chat.id ) ).toEqual( [
			'newer',
		] );
		expect( searchChats( chats, 'a' ).map( ( chat ) => chat.id ) ).toEqual( [
			'newer',
			'older',
			'unbound',
		] );
	} );

	it( 'finds nothing for an empty query or a word no title has', () => {
		expect( searchChats( chats, '   ' ) ).toEqual( [] );
		expect( searchChats( chats, 'landing zebra' ) ).toEqual( [] );
	} );
} );

describe( 'withUpdatedSite', () => {
	const sites = [
		{ id: 's1', name: 'Bakery', running: false },
		{ id: 's2', name: 'Portfolio', running: true },
	];

	it( 'replaces the site that changed and keeps the order', () => {
		expect( withUpdatedSite( sites, { id: 's1', name: 'Bakery', running: true } ) ).toEqual( [
			{ id: 's1', name: 'Bakery', running: true },
			{ id: 's2', name: 'Portfolio', running: true },
		] );
	} );

	it( 'adds a site the list does not have', () => {
		const next = withUpdatedSite( sites, { id: 's3', name: 'Shop', running: false } );

		expect( next.map( ( site ) => site.id ) ).toEqual( [ 's1', 's2', 's3' ] );
	} );
} );
