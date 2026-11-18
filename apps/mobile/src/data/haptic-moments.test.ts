import { describe, expect, it } from 'vitest';
import { createHapticMoments } from './haptic-moments';

type Step = [ type: string, status?: string ];

// What the person feels for each event of one run, in the order the computer
// sends them.
function feel( steps: Step[], moments = createHapticMoments(), runId = 'run-1' ) {
	return steps.map( ( [ type, status ] ) => moments.moment( { runId, type, status } ) );
}

describe( 'createHapticMoments', () => {
	it( 'is felt when the agent asks a question, and once when its turn ends well', () => {
		expect(
			feel( [
				[ 'run.started' ],
				[ 'question.asked' ],
				[ 'turn.completed', 'paused' ],
				[ 'message' ],
				[ 'turn.completed', 'success' ],
				[ 'run.exited', 'success' ],
			] )
		).toEqual( [ null, 'needs-answer', null, null, 'finished', null ] );
	} );

	it( 'is felt as a failure when a turn fails, once, whatever comes after', () => {
		expect(
			feel( [
				[ 'turn.completed', 'error' ],
				[ 'run.exited', 'success' ],
			] )
		).toEqual( [ 'failed', null ] );
		expect(
			feel( [
				[ 'turn.completed', 'max_turns' ],
				[ 'run.exited', 'error' ],
			] )
		).toEqual( [ 'failed', null ] );
		// The person stops a process that lingers after its turn failed.
		expect(
			feel( [
				[ 'turn.completed', 'error' ],
				[ 'run.interrupting' ],
				[ 'run.interrupted' ],
				[ 'run.exited', 'success' ],
			] )
		).toEqual( [ 'failed', null, null, null ] );
	} );

	it( 'is felt as a failure when a run exits with an error before its turn ended', () => {
		expect( feel( [ [ 'run.started' ], [ 'run.exited', 'error' ] ] ) ).toEqual( [
			null,
			'failed',
		] );
		// A paused turn did not end.
		expect(
			feel( [
				[ 'turn.completed', 'paused' ],
				[ 'run.exited', 'error' ],
			] )
		).toEqual( [ null, 'failed' ] );
		// A turn that ended well was felt then.
		expect(
			feel( [
				[ 'turn.completed', 'success' ],
				[ 'run.exited', 'error' ],
			] )
		).toEqual( [ 'finished', null ] );
	} );

	it( 'is not felt when a run the computer is stopping ends', () => {
		expect(
			feel( [
				[ 'run.interrupting' ],
				[ 'turn.completed', 'error' ],
				[ 'run.interrupted' ],
				[ 'run.exited', 'error' ],
			] )
		).toEqual( [ null, null, null, null ] );
		// The agent was killed before its turn ended.
		expect( feel( [ [ 'run.interrupted' ], [ 'run.exited', 'error' ] ] ) ).toEqual( [
			null,
			null,
		] );
		// It ended well before the stop took hold.
		expect( feel( [ [ 'run.interrupting' ], [ 'turn.completed', 'success' ] ] ) ).toEqual( [
			null,
			null,
		] );
	} );

	it( 'keeps runs apart, and forgets a run once it exited', () => {
		const moments = createHapticMoments();
		feel( [ [ 'run.interrupting' ] ], moments, 'run-1' );

		expect( feel( [ [ 'turn.completed', 'success' ] ], moments, 'run-2' ) ).toEqual( [
			'finished',
		] );

		feel( [ [ 'run.exited', 'error' ] ], moments, 'run-1' );
		expect( feel( [ [ 'turn.completed', 'success' ] ], moments, 'run-1' ) ).toEqual( [
			'finished',
		] );
	} );

	it( 'forgets the stops for another computer', () => {
		const moments = createHapticMoments();
		feel( [ [ 'run.interrupting' ] ], moments );

		moments.clear();

		expect( feel( [ [ 'turn.completed', 'success' ] ], moments ) ).toEqual( [ 'finished' ] );
	} );
} );
