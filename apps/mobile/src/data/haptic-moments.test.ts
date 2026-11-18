import { describe, expect, it } from 'vitest';
import { createHapticMoments } from './haptic-moments';

describe( 'createHapticMoments', () => {
	it( 'is felt when the agent asks a question and when its turn ends', () => {
		const moments = createHapticMoments();

		expect( moments.moment( { runId: 'run-1', type: 'question.asked' }, false ) ).toBe(
			'needs-answer'
		);
		expect(
			moments.moment( { runId: 'run-1', type: 'turn.completed', status: 'success' }, false )
		).toBe( 'finished' );
		expect(
			moments.moment( { runId: 'run-2', type: 'turn.completed', status: 'error' }, false )
		).toBe( 'failed' );
		expect(
			moments.moment( { runId: 'run-3', type: 'turn.completed', status: 'max_turns' }, false )
		).toBe( 'failed' );
	} );

	it( 'is not felt when a turn pauses for answers, nor for the rest of a run', () => {
		const moments = createHapticMoments();

		expect(
			moments.moment( { runId: 'run-1', type: 'turn.completed', status: 'paused' }, false )
		).toBeNull();
		for ( const type of [ 'run.started', 'message', 'run.exited', 'run.interrupted' ] ) {
			expect( moments.moment( { runId: 'run-1', type }, false ) ).toBeNull();
		}
	} );

	it( 'is not felt when a stopped turn ends, and forgets the stop once the run is over', () => {
		const moments = createHapticMoments();

		moments.moment( { runId: 'run-1', type: 'run.interrupting' }, false );
		expect(
			moments.moment( { runId: 'run-1', type: 'turn.completed', status: 'error' }, false )
		).toBeNull();
		// Another run is not stopped.
		expect(
			moments.moment( { runId: 'run-2', type: 'turn.completed', status: 'error' }, false )
		).toBe( 'failed' );

		moments.moment( { runId: 'run-1', type: 'run.exited' }, false );
		expect(
			moments.moment( { runId: 'run-1', type: 'turn.completed', status: 'error' }, false )
		).toBe( 'failed' );
	} );

	it( 'is not felt when the phone stopped the run, also if the computer did not say so', () => {
		const moments = createHapticMoments();

		expect(
			moments.moment( { runId: 'run-1', type: 'turn.completed', status: 'error' }, true )
		).toBeNull();
	} );

	it( 'is felt as a failure when a run ends with an error before its turn did', () => {
		const moments = createHapticMoments();

		expect( moments.moment( { runId: 'run-1', type: 'run.exited', status: 'error' }, false ) ).toBe(
			'failed'
		);

		// A turn that ended already was felt then.
		moments.moment( { runId: 'run-2', type: 'turn.completed', status: 'error' }, false );
		expect(
			moments.moment( { runId: 'run-2', type: 'run.exited', status: 'error' }, false )
		).toBeNull();

		// A paused turn did not end: the crash after it is felt.
		moments.moment( { runId: 'run-3', type: 'turn.completed', status: 'paused' }, false );
		expect( moments.moment( { runId: 'run-3', type: 'run.exited', status: 'error' }, false ) ).toBe(
			'failed'
		);

		// Nor a stopped run, nor one that ended well.
		moments.moment( { runId: 'run-4', type: 'run.interrupting' }, false );
		expect(
			moments.moment( { runId: 'run-4', type: 'run.exited', status: 'error' }, false )
		).toBeNull();
		expect(
			moments.moment( { runId: 'run-5', type: 'run.exited', status: 'error' }, true )
		).toBeNull();
		expect(
			moments.moment( { runId: 'run-6', type: 'run.exited', status: 'success' }, false )
		).toBeNull();
	} );

	it( 'forgets the stops for another computer', () => {
		const moments = createHapticMoments();
		moments.moment( { runId: 'run-1', type: 'run.interrupting' }, false );

		moments.clear();

		expect(
			moments.moment( { runId: 'run-1', type: 'turn.completed', status: 'error' }, false )
		).toBe( 'failed' );
	} );
} );
