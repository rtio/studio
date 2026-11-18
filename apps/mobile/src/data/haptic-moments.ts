import type { ChatEvent } from './chat-reply';

// The moments of a run the person feels on the phone.
export type HapticMoment = 'needs-answer' | 'finished' | 'failed';

// Which events of the live stream the person feels: the agent asked a
// question, or its turn ended. A turn that ends because someone pressed Stop,
// here or on the computer, is felt as nothing: the computer says it is
// stopping (`run.interrupting`) before the turn's end arrives with an error,
// and the phone knows its own Stop even when a reconnect lost that event. A
// run that ends with an error before its turn did (the agent crashed) is felt
// as a failure.
export function createHapticMoments() {
	const stopping = new Set< string >();
	// Runs whose turn ended for good (not paused for answers).
	const turnEnded = new Set< string >();

	return {
		// `stopped`: the phone asked the chat's run to stop.
		moment( event: ChatEvent, stopped: boolean ): HapticMoment | null {
			switch ( event.type ) {
				case 'question.asked':
					return 'needs-answer';
				case 'run.interrupting':
					stopping.add( event.runId );
					return null;
				case 'run.exited': {
					// The computer's last event of a run.
					const crashed =
						event.status === 'error' &&
						! turnEnded.has( event.runId ) &&
						! stopped &&
						! stopping.has( event.runId );
					stopping.delete( event.runId );
					turnEnded.delete( event.runId );
					return crashed ? 'failed' : null;
				}
				case 'turn.completed':
					if ( event.status !== 'paused' ) {
						turnEnded.add( event.runId );
					}
					if ( stopped || stopping.has( event.runId ) ) {
						return null;
					}
					if ( event.status === 'success' ) {
						return 'finished';
					}
					// `paused`: the turn waits for answers, felt when it asked.
					return event.status === 'error' || event.status === 'max_turns' ? 'failed' : null;
				default:
					return null;
			}
		},
		// Another computer, or none.
		clear() {
			stopping.clear();
			turnEnded.clear();
		},
	};
}
