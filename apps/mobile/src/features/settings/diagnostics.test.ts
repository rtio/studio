import { describe, expect, it } from 'vitest';
import { diagnosticsText } from './diagnostics';

describe( 'diagnosticsText', () => {
	it( 'says what the phone tried and when', () => {
		const text = diagnosticsText( {
			appVersion: '0.1.0',
			platform: 'ios 27.0.1',
			computer: 'Mac',
			address: 'http://192.168.1.20:8098',
			status: 'reconnecting',
			history: {
				lastLiveAt: Date.UTC( 2026, 10, 18, 12, 0 ),
				lastProblem: { status: 'reconnecting', at: Date.UTC( 2026, 10, 18, 12, 5 ) },
			},
		} );

		expect( text ).toBe(
			[
				'Studio Mobile 0.1.0 on ios 27.0.1',
				'Computer: Mac at http://192.168.1.20:8098',
				'Link: reconnecting',
				'Last live: 2026-11-18T12:00:00.000Z',
				'Last problem: reconnecting 2026-11-18T12:05:00.000Z',
			].join( '\n' )
		);
	} );

	it( 'says now while the link is live', () => {
		const text = diagnosticsText( {
			appVersion: '0.1.0',
			platform: 'android 36',
			computer: 'Mac',
			address: 'http://127.0.0.1:8098',
			status: 'live',
			history: { lastLiveAt: Date.UTC( 2026, 10, 18, 12, 0 ), lastProblem: null },
		} );

		expect( text ).toContain( 'Last live: now' );
	} );

	it( 'says never and none before anything happened', () => {
		const text = diagnosticsText( {
			appVersion: '0.1.0',
			platform: 'android 36',
			computer: 'Mac',
			address: 'http://127.0.0.1:8098',
			status: 'connecting',
			history: { lastLiveAt: null, lastProblem: null },
		} );

		expect( text ).toContain( 'Last live: never' );
		expect( text ).toContain( 'Last problem: none' );
	} );
} );
