import { describe, expect, it } from 'vitest';
import { messageActions } from './message-actions';

describe( 'messageActions', () => {
	it( 'offers to copy, edit or send again your own message', () => {
		const row = { kind: 'user' as const, key: 'u1', text: 'Add a menu', textOnly: true };

		expect( messageActions( row, true ) ).toEqual( [ 'copy', 'edit', 'send-again' ] );
		expect( messageActions( row, false ) ).toEqual( [ 'copy', 'edit' ] );
	} );

	it( 'only copies a message with images, files or a note, and offers nothing without text', () => {
		const row = { kind: 'user' as const, key: 'u1', text: 'Make this blue', textOnly: false };

		expect( messageActions( row, true ) ).toEqual( [ 'copy' ] );
		expect( messageActions( { ...row, text: ' ' }, true ) ).toEqual( [] );
		expect( messageActions( { ...row, text: '', textOnly: true }, true ) ).toEqual( [] );
	} );

	it( 'offers to copy or share a complete reply, and nothing while it is written', () => {
		const reply = { kind: 'assistant' as const, key: 'a1', text: 'Done.', streaming: false };

		expect( messageActions( reply, true ) ).toEqual( [ 'copy', 'share' ] );
		expect( messageActions( { ...reply, streaming: true }, true ) ).toEqual( [] );
	} );

	it( 'offers nothing on a step or a note', () => {
		expect(
			messageActions( { kind: 'note', key: 'n1', text: 'Stopped', tone: 'muted' }, true )
		).toEqual( [] );
	} );
} );
