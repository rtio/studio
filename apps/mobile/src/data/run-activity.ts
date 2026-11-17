import type { ActiveRun } from './remote-schemas';

// What a chat is doing now. A chat that waits for an answer is also working,
// but the answer is what the person must act on, so it wins.
export type ChatActivity = 'working' | 'needs-answer';

// By chat id. A chat that is idle has no entry.
export type ActivityMap = Readonly< Record< string, ChatActivity > >;

// The state when the stream opens, from `GET /api/runs/active`. The stream
// cannot replay what it missed, so this is read again at every reconnect.
export function activityFromActiveRuns( runs: ActiveRun[] ): ActivityMap {
	const activity: Record< string, ChatActivity > = {};
	for ( const run of runs ) {
		activity[ run.sessionId ] = run.pendingQuestions?.length ? 'needs-answer' : 'working';
	}
	return activity;
}

function withActivity(
	activity: ActivityMap,
	sessionId: string,
	next: ChatActivity | null
): ActivityMap {
	if ( ( activity[ sessionId ] ?? null ) === next ) {
		// The same object, so nothing that reads it draws again. Most events of a
		// run are text arriving, which changes nothing here.
		return activity;
	}
	const { [ sessionId ]: _removed, ...rest } = activity;
	return next ? { ...rest, [ sessionId ]: next } : rest;
}

// The inner events that mean the agent went on after a question: it starts a
// new message or a new turn. Other inner events do not: the agent runs tools
// side by side, and one of them can end while the question still waits.
const AGENT_WENT_ON = new Set( [ 'message_start', 'turn_start' ] );

// Applies one event of the `agent` channel. `eventType` is `event.type`, and
// `detail` is the type of the inner event of a `message` event.
export function applyAgentEvent(
	activity: ActivityMap,
	sessionId: string,
	eventType: string,
	detail?: string
): ActivityMap {
	switch ( eventType ) {
		case 'run.started':
		case 'turn.started':
			return withActivity( activity, sessionId, 'working' );
		case 'question.asked':
			return withActivity( activity, sessionId, 'needs-answer' );
		case 'message':
			// The computer sends no event when a question is answered there. The
			// agent going on after a question means it got its answer.
			return activity[ sessionId ] === 'needs-answer' && detail && AGENT_WENT_ON.has( detail )
				? withActivity( activity, sessionId, 'working' )
				: activity;
		case 'turn.completed':
		case 'run.interrupting':
		case 'run.interrupted':
		case 'run.exited':
			return withActivity( activity, sessionId, null );
		default:
			return activity;
	}
}
