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

	it( 'forgets the stops for another computer', () => {
		const moments = createHapticMoments();
		moments.moment( { runId: 'run-1', type: 'run.interrupting' }, false );

		moments.clear();

		expect(
			moments.moment( { runId: 'run-1', type: 'turn.completed', status: 'error' }, false )
		).toBe( 'failed' );
	} );
} );
