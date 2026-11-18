import { describe, expect, it } from 'vitest';
import { groupChats } from './chat-groups';
import type { ChatRow } from './chat-list';

function chat( id: string, activity: ChatRow[ 'activity' ] ): ChatRow {
	return { id, title: id, siteId: null, siteName: null, activity, live: false };
}

describe( 'groupChats', () => {
	it( 'puts the chats that wait for an answer first, then those at work, then the rest', () => {
		const sections = groupChats(
			[
				chat( 'a', null ),
				chat( 'b', 'working' ),
				chat( 'c', 'needs-answer' ),
				chat( 'd', null ),
				chat( 'e', 'working' ),
			],
			false
		);

		expect(
			sections.map( ( section ) => [ section.group, section.chats.map( ( c ) => c.id ) ] )
		).toEqual( [
			[ 'needs-you', [ 'c' ] ],
			[ 'working', [ 'b', 'e' ] ],
			[ 'rest', [ 'a', 'd' ] ],
		] );
	} );

	it( 'leaves out a group with no chat', () => {
		expect(
			groupChats( [ chat( 'a', null ) ], false ).map( ( section ) => section.group )
		).toEqual( [ 'rest' ] );
		expect( groupChats( [], false ) ).toEqual( [] );
	} );

	it( 'keeps search results in one group, and none when nothing matched', () => {
		const sections = groupChats( [ chat( 'a', null ), chat( 'b', 'needs-answer' ) ], true );

		expect(
			sections.map( ( section ) => [ section.group, section.chats.map( ( c ) => c.id ) ] )
		).toEqual( [ [ 'results', [ 'a', 'b' ] ] ] );
		expect( groupChats( [], true ) ).toEqual( [] );
	} );
} );
