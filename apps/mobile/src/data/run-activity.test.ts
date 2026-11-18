import { describe, expect, it } from 'vitest';
import { activityFromActiveRuns, applyAgentEvent } from './run-activity';
import type { ActivityMap, AgentEventInfo } from './run-activity';

function event( type: string, fields: Partial< AgentEventInfo > = {} ): AgentEventInfo {
	return { sessionId: 'chat-1', runId: 'run-1', type, ...fields };
}

const WORKING: ActivityMap = { 'chat-1': { runId: 'run-1', activity: 'working' } };
const ASKED: ActivityMap = { 'chat-1': { runId: 'run-1', activity: 'needs-answer' } };

describe( 'activityFromActiveRuns', () => {
	it( 'marks a chat with a run as working, and one with an open question as needing an answer', () => {
		const activity = activityFromActiveRuns( [
			{ runId: 'run-1', sessionId: 'chat-1', pendingQuestions: [] },
			{
				runId: 'run-2',
				sessionId: 'chat-2',
				pendingQuestions: [ { question: 'Which layout?', options: [] } ],
			},
			{ runId: 'run-3', sessionId: 'chat-3' },
		] );

		expect( activity ).toEqual( {
			'chat-1': { runId: 'run-1', activity: 'working' },
			'chat-2': { runId: 'run-2', activity: 'needs-answer' },
			'chat-3': { runId: 'run-3', activity: 'working' },
		} );
	} );

	it( 'is empty when no run is active', () => {
		expect( activityFromActiveRuns( [] ) ).toEqual( {} );
	} );
} );

describe( 'applyAgentEvent', () => {
	const idle: ActivityMap = {};

	it( 'follows a run from start to end', () => {
		const started = applyAgentEvent( idle, event( 'run.started' ) );
		const asked = applyAgentEvent( started, event( 'question.asked' ) );
		const answered = applyAgentEvent( asked, event( 'message', { detail: 'message_start' } ) );
		const completed = applyAgentEvent( answered, event( 'turn.completed' ) );

		expect( started ).toEqual( WORKING );
		expect( asked ).toEqual( ASKED );
		expect( answered ).toEqual( WORKING );
		expect( completed ).toEqual( {} );
	} );

	it( 'keeps a question open while another tool of the same turn reports', () => {
		for ( const detail of [ 'tool_execution_update', 'tool_execution_end', 'message_update' ] ) {
			expect( applyAgentEvent( ASKED, event( 'message', { detail } ) ) ).toBe( ASKED );
		}
		expect( applyAgentEvent( ASKED, event( 'message' ) ) ).toBe( ASKED );
		expect( applyAgentEvent( ASKED, event( 'message', { detail: 'turn_start' } ) ) ).toEqual(
			WORKING
		);
	} );

	it( 'ends the activity when the run is stopped or exits', () => {
		for ( const type of [ 'run.interrupting', 'run.interrupted', 'run.exited' ] ) {
			expect( applyAgentEvent( WORKING, event( type ) ) ).toEqual( {} );
		}
	} );

	it( 'ignores the last events of a stopped run when a new run has started in the chat', () => {
		const second = applyAgentEvent( WORKING, event( 'run.started', { runId: 'run-2' } ) );

		expect( second ).toEqual( { 'chat-1': { runId: 'run-2', activity: 'working' } } );
		expect( applyAgentEvent( second, event( 'run.interrupted' ) ) ).toBe( second );
		expect( applyAgentEvent( second, event( 'run.exited' ) ) ).toBe( second );
		expect( applyAgentEvent( second, event( 'question.asked' ) ) ).toBe( second );
		expect( applyAgentEvent( second, event( 'run.exited', { runId: 'run-2' } ) ) ).toEqual( {} );
	} );

	it( 'keeps the other chats as they are', () => {
		const both: ActivityMap = {
			...WORKING,
			'chat-2': { runId: 'run-2', activity: 'needs-answer' },
		};

		expect( applyAgentEvent( both, event( 'run.exited' ) ) ).toEqual( {
			'chat-2': { runId: 'run-2', activity: 'needs-answer' },
		} );
	} );

	it( 'returns the same object when nothing changes', () => {
		expect( applyAgentEvent( WORKING, event( 'message', { detail: 'message_update' } ) ) ).toBe(
			WORKING
		);
		expect( applyAgentEvent( WORKING, event( 'run.started' ) ) ).toBe( WORKING );
		expect( applyAgentEvent( WORKING, event( 'run.exited', { sessionId: 'chat-2' } ) ) ).toBe(
			WORKING
		);
		expect( applyAgentEvent( WORKING, event( 'preview.reload' ) ) ).toBe( WORKING );
	} );

	it( 'picks up a run it first hears of through a question or a new turn', () => {
		expect( applyAgentEvent( idle, event( 'question.asked' ) ) ).toEqual( ASKED );
		expect( applyAgentEvent( idle, event( 'turn.started' ) ) ).toEqual( WORKING );
	} );

	it( 'does not start a chat on text alone', () => {
		expect( applyAgentEvent( idle, event( 'message', { detail: 'message_start' } ) ) ).toBe( idle );
	} );
} );
