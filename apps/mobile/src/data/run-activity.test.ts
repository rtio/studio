import { describe, expect, it } from 'vitest';
import { activityFromActiveRuns, applyAgentEvent } from './run-activity';
import type { ActivityMap } from './run-activity';

describe( 'activityFromActiveRuns', () => {
	it( 'marks a chat with a run as working, and one with an open question as needing an answer', () => {
		const activity = activityFromActiveRuns( [
			{ runId: 'run-1', sessionId: 'chat-1', pendingQuestions: [] },
			{ runId: 'run-2', sessionId: 'chat-2', pendingQuestions: [ { question: 'Which layout?' } ] },
			{ runId: 'run-3', sessionId: 'chat-3' },
		] );

		expect( activity ).toEqual( {
			'chat-1': 'working',
			'chat-2': 'needs-answer',
			'chat-3': 'working',
		} );
	} );

	it( 'is empty when no run is active', () => {
		expect( activityFromActiveRuns( [] ) ).toEqual( {} );
	} );
} );

describe( 'applyAgentEvent', () => {
	const idle: ActivityMap = {};

	it( 'follows a run from start to end', () => {
		const started = applyAgentEvent( idle, 'chat-1', 'run.started' );
		const asked = applyAgentEvent( started, 'chat-1', 'question.asked' );
		const answered = applyAgentEvent( asked, 'chat-1', 'message', 'message_start' );
		const completed = applyAgentEvent( answered, 'chat-1', 'turn.completed' );

		expect( started ).toEqual( { 'chat-1': 'working' } );
		expect( asked ).toEqual( { 'chat-1': 'needs-answer' } );
		expect( answered ).toEqual( { 'chat-1': 'working' } );
		expect( completed ).toEqual( {} );
	} );

	it( 'keeps a question open while another tool of the same turn reports', () => {
		const asked: ActivityMap = { 'chat-1': 'needs-answer' };

		for ( const detail of [ 'tool_execution_update', 'tool_execution_end', 'message_update' ] ) {
			expect( applyAgentEvent( asked, 'chat-1', 'message', detail ) ).toBe( asked );
		}
		expect( applyAgentEvent( asked, 'chat-1', 'message' ) ).toBe( asked );
		expect( applyAgentEvent( asked, 'chat-1', 'message', 'turn_start' ) ).toEqual( {
			'chat-1': 'working',
		} );
	} );

	it( 'ends the activity when the run is stopped or exits', () => {
		const working: ActivityMap = { 'chat-1': 'working' };

		for ( const type of [ 'run.interrupting', 'run.interrupted', 'run.exited' ] ) {
			expect( applyAgentEvent( working, 'chat-1', type ) ).toEqual( {} );
		}
	} );

	it( 'keeps the other chats as they are', () => {
		const both: ActivityMap = { 'chat-1': 'working', 'chat-2': 'needs-answer' };

		expect( applyAgentEvent( both, 'chat-1', 'run.exited' ) ).toEqual( {
			'chat-2': 'needs-answer',
		} );
	} );

	it( 'returns the same object when nothing changes', () => {
		const working: ActivityMap = { 'chat-1': 'working' };

		expect( applyAgentEvent( working, 'chat-1', 'message' ) ).toBe( working );
		expect( applyAgentEvent( working, 'chat-1', 'run.started' ) ).toBe( working );
		expect( applyAgentEvent( working, 'chat-2', 'run.exited' ) ).toBe( working );
		expect( applyAgentEvent( working, 'chat-1', 'preview.reload' ) ).toBe( working );
	} );

	it( 'does not start a chat on text alone', () => {
		expect( applyAgentEvent( idle, 'chat-1', 'message' ) ).toBe( idle );
	} );
} );
