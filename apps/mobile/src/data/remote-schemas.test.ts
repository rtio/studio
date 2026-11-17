import { describe, expect, it } from 'vitest';
import { parseActiveRuns, parseSessions, parseSites, parseStreamMessage } from './remote-schemas';

describe( 'parseSites', () => {
	it( 'reads the sites and drops the address on the computer', () => {
		const payload = [ { id: 's1', name: 'My site', running: true, url: 'http://localhost:8881' } ];

		expect( parseSites( payload ) ).toEqual( [ { id: 's1', name: 'My site', running: true } ] );
	} );

	it( 'skips an item with the wrong shape and keeps the others', () => {
		const payload = [ { id: 's1', name: 'My site', running: true }, { id: 's2' }, 'nonsense' ];

		expect( parseSites( payload ).map( ( site ) => site.id ) ).toEqual( [ 's1' ] );
	} );

	it( 'reads anything that is not a list as no sites', () => {
		expect( parseSites( { error: 'Internal error' } ) ).toEqual( [] );
		expect( parseSites( undefined ) ).toEqual( [] );
	} );
} );

describe( 'parseSessions', () => {
	it( 'keeps what the drawer shows and drops the paths on the computer', () => {
		const payload = [
			{
				id: 'chat-1',
				filePath: '/Users/me/.studio/sessions/2026/11/17/chat-1.jsonl',
				createdAt: '2026-11-17T10:00:00.000Z',
				updatedAt: '2026-11-17T10:04:11.512Z',
				firstPrompt: 'Create a landing page',
				ownerSiteId: 's1',
				ownerSitePath: '/Users/me/Studio/my-site',
				ownerSiteName: 'My site',
				activeEnvironment: 'local',
				eventCount: 42,
				unread: true,
			},
		];

		expect( parseSessions( payload ) ).toEqual( [
			{
				id: 'chat-1',
				updatedAt: '2026-11-17T10:04:11.512Z',
				firstPrompt: 'Create a landing page',
				ownerSiteId: 's1',
				ownerSiteName: 'My site',
				activeEnvironment: 'local',
			},
		] );
	} );

	it( 'keeps a chat whose target is one the phone does not know', () => {
		const payload = [
			{ id: 'chat-1', updatedAt: '2026-11-17T10:00:00.000Z', activeEnvironment: 'staging' },
		];

		expect( parseSessions( payload ) ).toHaveLength( 1 );
	} );

	it( 'reads a draft that has only an id and a date', () => {
		const payload = [ { id: 'draft', updatedAt: '2026-11-17T10:00:00.000Z', eventCount: 0 } ];

		expect( parseSessions( payload ) ).toEqual( [
			{ id: 'draft', updatedAt: '2026-11-17T10:00:00.000Z' },
		] );
	} );
} );

describe( 'parseActiveRuns', () => {
	it( 'reads the run, its chat and its open questions', () => {
		const payload = [
			{
				runId: 'run-1',
				sessionId: 'chat-1',
				startedAt: 1794909600000,
				phase: 'running',
				pendingQuestions: [ { question: 'Which layout?', options: [] } ],
			},
		];

		const [ run ] = parseActiveRuns( payload );

		expect( run.runId ).toBe( 'run-1' );
		expect( run.sessionId ).toBe( 'chat-1' );
		expect( run.pendingQuestions ).toHaveLength( 1 );
	} );
} );

describe( 'parseStreamMessage', () => {
	it( 'reads an agent event', () => {
		const data =
			'{"channel":"agent","payload":{"runId":"run-1","sessionId":"chat-1","event":{"type":"run.started","timestamp":"2026-11-17T10:00:01.000Z"}}}';

		expect( parseStreamMessage( data ) ).toEqual( {
			channel: 'agent',
			payload: { runId: 'run-1', sessionId: 'chat-1', event: { type: 'run.started' } },
		} );
	} );

	it( 'keeps the type of the event that a message event wraps', () => {
		const wrapped =
			'{"channel":"agent","payload":{"runId":"run-1","sessionId":"chat-1","event":{"timestamp":"2026-11-17T10:00:02.000Z","type":"message","message":{"type":"message_start"}}}}';
		const text =
			'{"channel":"agent","payload":{"runId":"run-1","sessionId":"chat-1","event":{"type":"error","message":"Out of credits"}}}';

		expect( parseStreamMessage( wrapped ) ).toEqual( {
			channel: 'agent',
			payload: {
				runId: 'run-1',
				sessionId: 'chat-1',
				event: { type: 'message', detail: 'message_start' },
			},
		} );
		expect( parseStreamMessage( text ) ).toMatchObject( {
			payload: { event: { type: 'error', detail: undefined } },
		} );
	} );

	it( 'reads a site event with the site it is about', () => {
		const data =
			'{"channel":"site-event","payload":{"event":"site-updated","siteId":"s1","running":true,"site":{"id":"s1","name":"My site","running":true,"url":"http://localhost:8881"}}}';

		expect( parseStreamMessage( data ) ).toEqual( {
			channel: 'site-event',
			payload: {
				event: 'site-updated',
				siteId: 's1',
				site: { id: 's1', name: 'My site', running: true },
			},
		} );
	} );

	it( 'reads a site event for a site that is gone', () => {
		const data =
			'{"channel":"site-event","payload":{"event":"site-deleted","siteId":"s1","running":false}}';

		expect( parseStreamMessage( data ) ).toEqual( {
			channel: 'site-event',
			payload: { event: 'site-deleted', siteId: 's1' },
		} );
	} );

	it( 'returns null for another channel and for text that is not an event', () => {
		expect( parseStreamMessage( '{"channel":"placement","payload":{}}' ) ).toBeNull();
		expect( parseStreamMessage( 'not json' ) ).toBeNull();
		expect( parseStreamMessage( '{"channel":"agent","payload":{}}' ) ).toBeNull();
	} );
} );
