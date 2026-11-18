import { initialAgentRunState } from '@studio/agent/protocol/transcript/run-state';
import { describe, expect, it } from 'vitest';
import { composerAction } from './composer-action';

const IDLE = initialAgentRunState;
const RUNNING = { ...IDLE, phase: 'running' as const, runId: 'run-1' };
const QUESTION = { question: 'Which layout?', options: [] };
const typed = { hasText: true, sending: false, answering: false };
const empty = { hasText: false, sending: false, answering: false };

describe( 'composerAction', () => {
	it( 'sends when the chat is idle', () => {
		expect( composerAction( IDLE, typed ) ).toBe( 'send' );
	} );

	it( 'queues text typed while the chat is busy, and stops when nothing is typed', () => {
		expect( composerAction( RUNNING, typed ) ).toBe( 'queue' );
		expect( composerAction( RUNNING, empty ) ).toBe( 'stop' );
		expect( composerAction( { ...RUNNING, phase: 'winding_down' }, typed ) ).toBe( 'queue' );
	} );

	it( 'offers Stop while its own send is on the way', () => {
		const starting = { ...IDLE, phase: 'starting' as const };

		expect( composerAction( starting, { ...typed, sending: true } ) ).toBe( 'stop' );
	} );

	it( 'forces the stop when the run is already stopping', () => {
		const stopping = { ...RUNNING, phase: 'winding_down' as const, isInterrupting: true };

		expect( composerAction( stopping, empty ) ).toBe( 'force-stop' );
	} );

	it( 'answers the question with typed text', () => {
		const asking = { ...RUNNING, pendingQuestions: [ QUESTION ] };

		expect( composerAction( asking, { ...typed, answering: true } ) ).toBe( 'answer' );
		expect( composerAction( asking, { ...empty, answering: true } ) ).toBe( 'stop' );
	} );
} );
