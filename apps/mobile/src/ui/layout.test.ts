import { describe, expect, it } from 'vitest';
import { deriveLayout } from './layout';

const NO_INSETS = { left: 0, right: 0 };

describe( 'deriveLayout', () => {
	it( 'keeps the drawer sliding on an iPhone', () => {
		expect( deriveLayout( { width: 402, insets: NO_INSETS } ) ).toEqual( {
			usableWidth: 402,
			drawerPinned: false,
			sideInsets: NO_INSETS,
		} );
	} );

	it( 'takes the status column of a closed iPhone Duo out of the room', () => {
		expect( deriveLayout( { width: 466, insets: { left: 0, right: 84 } } ) ).toEqual( {
			usableWidth: 382,
			drawerPinned: false,
			sideInsets: { left: 0, right: 84 },
		} );
	} );

	it( 'pins the drawer on an open iPhone Duo', () => {
		expect( deriveLayout( { width: 951, insets: { left: 0, right: 84 } } ) ).toEqual( {
			usableWidth: 867,
			drawerPinned: true,
			sideInsets: { left: 0, right: 84 },
		} );
	} );

	it( 'pins the drawer on a tablet window', () => {
		expect( deriveLayout( { width: 1280, insets: NO_INSETS } ) ).toEqual( {
			usableWidth: 1280,
			drawerPinned: true,
			sideInsets: NO_INSETS,
		} );
	} );

	it( 'pins the drawer from 720 points of usable width', () => {
		expect( deriveLayout( { width: 719, insets: NO_INSETS } ).drawerPinned ).toBe( false );
		expect( deriveLayout( { width: 720, insets: NO_INSETS } ).drawerPinned ).toBe( true );
	} );

	it( 'takes both side insets off before it decides', () => {
		expect( deriveLayout( { width: 800, insets: { left: 50, right: 50 } } ) ).toEqual( {
			usableWidth: 700,
			drawerPinned: false,
			sideInsets: { left: 50, right: 50 },
		} );
	} );

	it( 'leaves the left safe area to the pinned drawer', () => {
		expect( deriveLayout( { width: 900, insets: { left: 50, right: 50 } } ) ).toEqual( {
			usableWidth: 800,
			drawerPinned: true,
			sideInsets: { left: 0, right: 50 },
		} );
	} );
} );
