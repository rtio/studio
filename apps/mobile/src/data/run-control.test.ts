import { STOPPED_WITHOUT_ANSWER } from '@studio/agent/protocol/tools';
import { initialAgentRunState } from '@studio/agent/protocol/transcript/run-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRunControl } from './run-control';
import type { ChatEvent } from './chat-reply';

interface Request {
	path: string;
	body?: unknown;
	resolve: ( value: unknown ) => void;
	reject: ( error: Error ) => void;
}

function setup() {
	const requests: Request[] = [];
	const shown: string[] = [];
	const dropped: string[] = [];
	const control = createRunControl( {
		post: ( path, body ) =>
			new Promise( ( resolve, reject ) => requests.push( { path, body, resolve, reject } ) ),
		newTurnId: () => 'turn-1',
		now: () => 1000,
		showPrompt: ( _chatId, text ) => {
			shown.push( text );
			return `shown-${ shown.length }`;
		},
		dropPrompt: ( _chatId, key ) => dropped.push( key ),
	} );
	const state = ( chatId = 'chat-1' ) => control.store.getState()[ chatId ] ?? initialAgentRunState;
	const handle = ( type: string, fields: Partial< ChatEvent > = {} ) =>
		control.handle( 'chat-1', { runId: 'run-1', type, ...fields } );
	return { control, requests, shown, dropped, state, handle };
}

// Lets promise callbacks and queued sends run.
const settle = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

const LAYOUT = { question: 'Which layout?', options: [ { label: 'Grid', description: '' } ] };
const COLORS = { question: 'Which colors?', options: [ { label: 'Blue', description: '' } ] };

describe( 'createRunControl', () => {
	it( 'sends a trimmed prompt with a turn id, and follows the run it starts', async () => {
		const { control, requests, shown, state } = setup();

		const sent = control.send( 'chat-1', '  Add a blog  ' );

		expect( requests[ 0 ] ).toMatchObject( {
			path: '/api/sessions/chat-1/messages',
			body: { prompt: 'Add a blog', turnId: 'turn-1' },
		} );
		expect( shown ).toEqual( [ 'Add a blog' ] );
		expect( state().phase ).toBe( 'starting' );

		requests[ 0 ].resolve( { runId: 'run-1' } );
		await sent;

		expect( state() ).toMatchObject( { phase: 'running', runId: 'run-1' } );
	} );

	it( 'sends nothing for a blank prompt', async () => {
		const { control, requests } = setup();

		await control.send( 'chat-1', ' \n ' );

		expect( requests ).toHaveLength( 0 );
	} );

	it( 'takes the prompt away and leaves the chat idle when the computer refuses it', async () => {
		const { control, requests, dropped, state } = setup();

		const sent = control.send( 'chat-1', 'Add a blog' );
		requests[ 0 ].reject( new Error( 'Internal error' ) );

		await expect( sent ).rejects.toThrow( 'Internal error' );
		expect( dropped ).toEqual( [ 'shown-1' ] );
		expect( state().phase ).toBe( 'idle' );
	} );

	it( 'queues a prompt while the chat has a run, and sends it when the run exits', async () => {
		const { control, requests, state, handle } = setup();
		handle( 'run.started' );

		await control.send( 'chat-1', 'Then add a menu' );
		handle( 'turn.completed' );
		await settle();

		// The computer keeps the run until its process exits.
		expect( requests ).toHaveLength( 0 );
		expect( state().queuedPrompts ).toMatchObject( [ { prompt: 'Then add a menu' } ] );

		handle( 'run.exited' );
		await settle();

		expect( requests[ 0 ].body ).toMatchObject( { prompt: 'Then add a menu' } );
		expect( state().queuedPrompts ).toEqual( [] );
	} );

	it( 'drops the queue and says so when a queued prompt is refused', async () => {
		const { control, requests, state, handle } = setup();
		handle( 'run.started' );
		await control.send( 'chat-1', 'Then add a menu' );
		await control.send( 'chat-1', 'And a footer' );
		handle( 'run.exited' );
		await settle();

		requests[ 0 ].reject( new Error( 'Internal error' ) );
		await settle();

		expect( requests ).toHaveLength( 1 );
		expect( state().queuedPrompts ).toEqual( [] );
		expect( control.notices.get() ).toEqual( { 'chat-1': 'queue-failed' } );
	} );

	it( 'stays idle when the run exits before the computer answers the send', async () => {
		const { control, requests, state, handle } = setup();

		const sent = control.send( 'chat-1', 'Add a blog' );
		handle( 'run.started' );
		handle( 'run.exited' );
		requests[ 0 ].resolve( { runId: 'run-1' } );
		await sent;

		expect( state().phase ).toBe( 'idle' );
	} );

	it( 'ignores the events of another run of the chat', () => {
		const { state, handle } = setup();
		handle( 'run.started' );

		handle( 'turn.completed', { runId: 'run-0' } );

		expect( state().phase ).toBe( 'running' );
	} );

	it( 'answers open questions with the stopped text before it stops the run', async () => {
		const { control, requests, state, handle } = setup();
		handle( 'run.started' );
		handle( 'question.asked', { questions: [ LAYOUT, COLORS ] } );
		control.answer( 'chat-1', 'Which layout?', 'Grid' );

		const stopping = control.stop( 'chat-1' );

		expect( requests[ 0 ] ).toMatchObject( {
			path: '/api/runs/run-1/answer',
			body: { answers: { 'Which layout?': 'Grid', 'Which colors?': STOPPED_WITHOUT_ANSWER } },
		} );
		requests[ 0 ].resolve( undefined );
		await settle();

		expect( requests[ 1 ].path ).toBe( '/api/runs/run-1/interrupt' );
		requests[ 1 ].resolve( undefined );
		await stopping;
		expect( state() ).toMatchObject( {
			phase: 'winding_down',
			isInterrupting: true,
			pendingQuestions: [],
		} );
	} );

	it( 'stops at once when no question is open, and stops again by force', async () => {
		const { control, requests, handle } = setup();
		handle( 'run.started' );

		const first = control.stop( 'chat-1' );
		requests[ 0 ].resolve( undefined );
		await first;
		const second = control.stop( 'chat-1' );
		requests[ 1 ].resolve( undefined );
		await second;

		expect( requests.map( ( request ) => request.path ) ).toEqual( [
			'/api/runs/run-1/interrupt',
			'/api/runs/run-1/interrupt',
		] );
	} );

	it( 'holds the queue until the stopped run exits, and ignores its late events', async () => {
		const { control, requests, state, handle } = setup();
		handle( 'run.started' );
		const stopping = control.stop( 'chat-1' );
		requests[ 0 ].resolve( undefined );
		await stopping;

		await control.send( 'chat-1', 'Try again with a grid' );
		handle( 'turn.completed' );
		handle( 'question.asked', { questions: [ LAYOUT ] } );
		await settle();

		expect( requests ).toHaveLength( 1 );
		expect( state() ).toMatchObject( { phase: 'winding_down', pendingQuestions: [] } );

		handle( 'run.interrupted' );
		await settle();

		expect( requests[ 1 ].body ).toMatchObject( { prompt: 'Try again with a grid' } );
	} );

	it( 'stops a run the computer has not named yet once it does', async () => {
		const { control, requests, state } = setup();
		const sent = control.send( 'chat-1', 'Add a blog' );

		await control.stop( 'chat-1' );
		expect( requests ).toHaveLength( 1 );
		expect( state().isInterrupting ).toBe( true );

		requests[ 0 ].resolve( { runId: 'run-1' } );
		await sent;

		expect( requests[ 1 ].path ).toBe( '/api/runs/run-1/interrupt' );
		expect( state() ).toMatchObject( { runId: 'run-1', isInterrupting: true } );
	} );

	it( 'sends the answers of a batch in one request once every question has one', () => {
		const { control, requests, state, handle } = setup();
		handle( 'run.started' );
		handle( 'question.asked', { questions: [ LAYOUT, COLORS ] } );

		control.answer( 'chat-1', 'Which layout?', 'Grid' );
		expect( requests ).toHaveLength( 0 );
		expect( state().pendingAnswers ).toEqual( { 'Which layout?': 'Grid' } );

		control.answer( 'chat-1', 'Which colors?', 'Blue, green' );

		expect( requests[ 0 ] ).toMatchObject( {
			path: '/api/runs/run-1/answer',
			body: { answers: { 'Which layout?': 'Grid', 'Which colors?': 'Blue, green' } },
		} );
		expect( state().pendingQuestions ).toEqual( [] );
		expect( control.sentAnswers.get() ).toEqual( {
			'chat-1': { 'Which layout?': 'Grid', 'Which colors?': 'Blue, green' },
		} );
	} );

	it( 'opens the questions again when the answers do not reach the computer', async () => {
		const { control, requests, state, handle } = setup();
		handle( 'run.started' );
		handle( 'question.asked', { questions: [ LAYOUT ] } );

		control.answer( 'chat-1', 'Which layout?', 'Grid' );
		requests[ 0 ].reject( new Error( 'Not reachable' ) );
		await settle();

		expect( state().pendingQuestions ).toEqual( [ LAYOUT ] );
		expect( control.sentAnswers.get() ).toEqual( {} );
		expect( control.notices.get() ).toEqual( { 'chat-1': 'answer-failed' } );
	} );

	it( 'closes the questions when the agent goes on after an answer from elsewhere', () => {
		const { state, handle } = setup();
		handle( 'run.started' );
		handle( 'question.asked', { questions: [ LAYOUT ] } );

		handle( 'message', { inner: { type: 'message_start' } } );

		expect( state().pendingQuestions ).toEqual( [] );
	} );

	it( 'takes the runs the computer lists and ends the ones it no longer lists', () => {
		const { control, state } = setup();
		control.handle( 'chat-2', { runId: 'run-2', type: 'run.started' } );

		control.hydrate( [ { runId: 'run-1', sessionId: 'chat-1', pendingQuestions: [ LAYOUT ] } ] );

		expect( state() ).toMatchObject( {
			phase: 'running',
			runId: 'run-1',
			pendingQuestions: [ LAYOUT ],
		} );
		expect( state( 'chat-2' ).phase ).toBe( 'idle' );
	} );

	it( 'drops questions the computer no longer lists for the run', () => {
		const { control, state, handle } = setup();
		handle( 'run.started' );
		handle( 'question.asked', { questions: [ LAYOUT ] } );

		control.hydrate( [ { runId: 'run-1', sessionId: 'chat-1', pendingQuestions: [] } ] );

		expect( state().pendingQuestions ).toEqual( [] );
	} );

	it( 'forgets every chat', async () => {
		const { control, state, handle } = setup();
		handle( 'run.started' );
		await control.send( 'chat-1', 'Then add a menu' );

		control.clear();

		expect( state() ).toEqual( initialAgentRunState );
	} );

	it( 'keeps a run that started while its own send was refused', async () => {
		const { control, requests, dropped, state, handle } = setup();

		const sent = control.send( 'chat-1', 'Add a blog' );
		// Studio on the computer sent first; the phone's send gets a 500.
		handle( 'run.started', { runId: 'run-computer' } );
		requests[ 0 ].reject( new Error( 'Internal error' ) );

		await expect( sent ).rejects.toThrow( 'Internal error' );
		expect( dropped ).toEqual( [ 'shown-1' ] );
		expect( state() ).toMatchObject( { phase: 'running', runId: 'run-computer' } );
	} );

	it( 'stops the run its own send names, also when a run starts first', async () => {
		const { control, requests, state, handle } = setup();
		const sent = control.send( 'chat-1', 'Add a blog' );
		await control.stop( 'chat-1' );

		handle( 'run.started' );
		expect( requests ).toHaveLength( 1 );

		requests[ 0 ].resolve( { runId: 'run-1' } );
		await sent;

		expect( requests.map( ( request ) => request.path ) ).toEqual( [
			'/api/sessions/chat-1/messages',
			'/api/runs/run-1/interrupt',
		] );
		expect( state() ).toMatchObject( { runId: 'run-1', isInterrupting: true } );
	} );

	it( 'answers the questions of a Stop once, however often it is tapped', async () => {
		const { control, requests, handle } = setup();
		handle( 'run.started' );
		handle( 'question.asked', { questions: [ LAYOUT ] } );

		const first = control.stop( 'chat-1' );
		const second = control.stop( 'chat-1' );
		await second;
		requests[ 0 ].resolve( undefined );
		await settle();
		requests[ 1 ].resolve( undefined );
		await first;

		expect( requests.map( ( request ) => request.path ) ).toEqual( [
			'/api/runs/run-1/answer',
			'/api/runs/run-1/interrupt',
		] );
	} );

	it( 'changes nothing when a request answers after the chats were forgotten', async () => {
		const { control, requests, state, handle } = setup();
		handle( 'run.started' );
		await control.send( 'chat-1', 'Then add a menu' );
		handle( 'run.exited' );
		await settle();

		control.clear();
		requests[ 0 ].reject( new Error( 'Not connected' ) );
		await settle();

		expect( state() ).toEqual( initialAgentRunState );
		expect( control.notices.get() ).toEqual( {} );
	} );

	it( 'keeps what the events said about a chat that changed while the runs were read', async () => {
		const { control, requests, state, handle } = setup();
		handle( 'run.started' );
		await control.send( 'chat-1', 'Then add a menu' );

		control.beginHydrate();
		handle( 'run.exited' );
		await settle();
		expect( state().phase ).toBe( 'starting' );
		// The list was read before the run exited.
		control.hydrate( [ { runId: 'run-1', sessionId: 'chat-1', pendingQuestions: [] } ] );

		expect( state().phase ).toBe( 'starting' );
		expect( requests ).toHaveLength( 1 );
	} );

	describe( 'a stopped run the computer no longer lists', () => {
		afterEach( () => {
			vi.useRealTimers();
		} );

		it( 'counts as ended a moment later, when its process has surely exited', async () => {
			vi.useFakeTimers();
			const { control, requests, state, handle } = setup();
			handle( 'run.started' );
			const stopping = control.stop( 'chat-1' );
			requests[ 0 ].resolve( undefined );
			await stopping;
			await control.send( 'chat-1', 'Try again with a grid' );

			control.beginHydrate();
			control.hydrate( [] );
			await vi.advanceTimersByTimeAsync( 2000 );
			expect( state().phase ).toBe( 'winding_down' );

			await vi.advanceTimersByTimeAsync( 1000 );
			expect( state().phase ).toBe( 'starting' );
			expect( requests[ 1 ].body ).toMatchObject( { prompt: 'Try again with a grid' } );
		} );
	} );
} );
