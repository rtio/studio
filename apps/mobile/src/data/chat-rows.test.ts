import {
	agentQuestionEntry,
	askUserAnswerEntry,
	assistantTextEntry,
	assistantToolCallEntry,
	promptEntry,
	toolResultEntry,
	turnClosedEntry,
} from '@studio/agent/protocol/transcript/tests/session-entries';
import { entriesToTranscriptItems } from '@studio/agent/protocol/transcript/transcript-items';
import { describe, expect, it } from 'vitest';
import { chatRows, chatRun, turnErrorText } from './chat-rows';
import type { SessionEntry } from './remote-schemas';

const NOTHING_OPEN = new Set< string >();

function rowsOf( entries: SessionEntry[], running = false, open = NOTHING_OPEN ) {
	return chatRows( entriesToTranscriptItems( entries, { running, startedAt: null } ), open );
}

function artifactEntry( widgets: unknown[] ): SessionEntry {
	return {
		type: 'custom',
		id: 'artifact',
		parentId: null,
		timestamp: '2026-06-05T12:00:02.000Z',
		customType: 'studio.chat_artifact',
		data: { version: 1, id: 'artifact-1', widgets },
	} as SessionEntry;
}

const editTurn = [
	promptEntry( 'Add a header' ),
	assistantToolCallEntry( 'Edit', { path: 'style.css' }, 'Updating the header.' ),
	toolResultEntry( 'Saved' ),
	assistantTextEntry( 'Done.' ),
	turnClosedEntry( 'success' ),
];

describe( 'chatRows', () => {
	it( 'folds a finished turn to one line and keeps the final reply in view', () => {
		const rows = rowsOf( editTurn );

		expect( rows.map( ( row ) => row.kind ) ).toEqual( [ 'user', 'turn', 'assistant' ] );
		expect( rows[ 0 ] ).toMatchObject( { text: 'Add a header' } );
		expect( rows[ 1 ] ).toMatchObject( {
			status: 'success',
			steps: 1,
			collapsible: true,
			expanded: false,
		} );
		expect( rows[ 2 ] ).toMatchObject( { text: 'Done.', streaming: false } );
	} );

	it( 'shows every step of a turn the person opened', () => {
		const turnKey = rowsOf( editTurn )[ 1 ].key;
		const rows = rowsOf( editTurn, false, new Set( [ turnKey ] ) );

		expect( rows.map( ( row ) => row.kind ) ).toEqual( [
			'user',
			'turn',
			'assistant',
			'tool',
			'assistant',
		] );
		expect( rows[ 1 ] ).toMatchObject( { expanded: true } );
		expect( rows[ 3 ] ).toMatchObject( { label: 'Edit', detail: 'style.css', state: 'done' } );
	} );

	it( 'keeps a running turn open, with its step running', () => {
		const rows = rowsOf(
			[ promptEntry( 'Add a header' ), assistantToolCallEntry( 'Edit', { path: 'style.css' } ) ],
			true
		);

		expect( rows.map( ( row ) => row.kind ) ).toEqual( [ 'user', 'turn', 'tool' ] );
		expect( rows[ 1 ] ).toMatchObject( { status: 'running', collapsible: false, expanded: true } );
		expect( rows[ 2 ] ).toMatchObject( { state: 'running' } );
	} );

	it( "gives a running turn its run's start, and else the prompt's time", () => {
		const entries = [
			promptEntry( 'Add a header' ),
			assistantToolCallEntry( 'Edit', { path: 'style.css' } ),
		];
		const activity = { c1: { runId: 'run-1', activity: 'working' as const, since: 5000 } };
		const turnOf = ( run: { running: boolean; startedAt: number | null } ) =>
			chatRows( entriesToTranscriptItems( entries, run ), NOTHING_OPEN )[ 1 ];

		expect( turnOf( chatRun( activity, 'c1' ) ) ).toMatchObject( {
			kind: 'turn',
			status: 'running',
			startedAt: 5000,
		} );
		// The run's start is not known: the prompt's time.
		expect(
			turnOf( chatRun( { c1: { runId: 'run-1', activity: 'working' } }, 'c1' ) )
		).toMatchObject( { startedAt: Date.parse( entries[ 0 ].timestamp ) } );
		expect( chatRun( activity, 'c2' ) ).toEqual( { running: false, startedAt: null } );
	} );

	it( 'marks a step that never got its result as stopped', () => {
		const entries = [
			promptEntry( 'Add a header' ),
			assistantToolCallEntry( 'Edit', { path: 'style.css' } ),
			turnClosedEntry( 'interrupted' ),
		];
		const turnKey = rowsOf( entries )[ 1 ].key;
		const rows = rowsOf( entries, false, new Set( [ turnKey ] ) );

		expect( rows[ 1 ] ).toMatchObject( { kind: 'turn', status: 'interrupted' } );
		expect( rows[ 2 ] ).toMatchObject( { kind: 'tool', state: 'stopped' } );
	} );

	it( 'marks a step whose result is an error as failed', () => {
		const entries = [
			promptEntry( 'Add a header' ),
			assistantToolCallEntry( 'Edit', { path: 'style.css' } ),
			toolResultEntry( 'No such file', true ),
			turnClosedEntry( 'success' ),
		];
		const turnKey = rowsOf( entries )[ 1 ].key;

		expect( rowsOf( entries, false, new Set( [ turnKey ] ) )[ 2 ] ).toMatchObject( {
			kind: 'tool',
			state: 'failed',
		} );
	} );

	it( 'shows a plain answer with no line above it', () => {
		const rows = rowsOf( [
			promptEntry( 'Hi' ),
			assistantTextEntry( 'Hello! What should we build?' ),
			turnClosedEntry( 'success' ),
		] );

		expect( rows.map( ( row ) => row.kind ) ).toEqual( [ 'user', 'assistant' ] );
	} );

	it( 'shows the error that closed a turn', () => {
		const rows = rowsOf( [
			promptEntry( 'Hi' ),
			turnClosedEntry( 'error', 'Error: studio_out_of_credits' ),
		] );

		expect( rows ).toContainEqual(
			expect.objectContaining( {
				kind: 'note',
				tone: 'error',
				text: 'You are out of AI credits. Add credits in Studio on your computer.',
			} )
		);
	} );

	it( 'keeps answered questions in view with the answer', () => {
		const rows = rowsOf( [
			promptEntry( 'Make a gallery' ),
			agentQuestionEntry( 'Which layout?', [ 'Grid', 'List' ] ),
			askUserAnswerEntry( 'answer-1', 'Grid' ),
			assistantTextEntry( 'Using a grid.' ),
			turnClosedEntry( 'success' ),
		] );
		const questions = rows.find( ( row ) => row.kind === 'questions' );

		expect( questions ).toMatchObject( {
			questions: [ expect.objectContaining( { question: 'Which layout?', pickedLabel: 'Grid' } ) ],
		} );
	} );

	it( 'shows a screenshot as its description and the design system preview as nothing', () => {
		const screenshot = {
			type: 'media',
			widgetProps: {
				url: 'file:///Users/someone/shot.png',
				mediaKind: 'image',
				alt: 'Screenshot of http://localhost:8881 (desktop light)',
				source: { type: 'local', path: '/Users/someone/shot.png' },
			},
		};
		const designSystem = { type: 'site-preview', widgetProps: { path: 'studio:design-system' } };

		const shot = rowsOf( [
			promptEntry( 'Show me' ),
			artifactEntry( [ screenshot ] ),
			turnClosedEntry( 'success' ),
		] );
		const preview = rowsOf( [
			promptEntry( 'Show me' ),
			artifactEntry( [ designSystem ] ),
			turnClosedEntry( 'success' ),
		] );

		expect( shot ).toContainEqual(
			expect.objectContaining( {
				kind: 'note',
				tone: 'muted',
				text: 'Screenshot of http://localhost:8881 (desktop light)',
			} )
		);
		expect( preview.some( ( row ) => row.kind === 'note' ) ).toBe( false );
	} );
} );

describe( 'turnErrorText', () => {
	it( 'keeps the message of a provider error without its status and body', () => {
		expect(
			turnErrorText( '529 {"type":"error","error":{"type":"overloaded","message":"Overloaded"}}' )
		).toBe( 'Overloaded' );
	} );

	it( 'says something when the error has no text', () => {
		expect( turnErrorText( '' ) ).toBe(
			'Something went wrong and this turn was stopped. Please try again.'
		);
	} );
} );
