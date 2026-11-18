import type { ActiveRun } from './remote-schemas';

// What a chat is doing now. A chat that waits for an answer is also working,
// but the answer is what the person must act on, so it wins.
export type ChatActivity = 'working' | 'needs-answer';

// The run a chat has now, what it is doing, and since when (in milliseconds,
// by the computer's clock) when the phone knows it.
interface ChatRun {
	runId: string;
	activity: ChatActivity;
	since?: number;
}

// By chat id. A chat that is idle has no entry.
export type ActivityMap = Readonly< Record< string, ChatRun > >;

// One event of the `agent` channel, cut down to what the activity needs.
// `type` is `event.type`. `detail` is the type of the inner event of a
// `message` event.
export interface AgentEventInfo {
	sessionId: string;
	runId: string;
	type: string;
	detail?: string;
	// When the computer sent it, in milliseconds.
	at?: number;
}

// The state when the stream opens, from `GET /api/runs/active`. The stream
// cannot replay what it missed, so this is read again at every reconnect.
export function activityFromActiveRuns( runs: ActiveRun[] ): ActivityMap {
	const activity: Record< string, ChatRun > = {};
	for ( const run of runs ) {
		activity[ run.sessionId ] = {
			runId: run.runId,
			activity: run.pendingQuestions?.length ? 'needs-answer' : 'working',
			since: run.startedAt,
		};
	}
	return activity;
}

function withRun( activity: ActivityMap, sessionId: string, next: ChatRun | null ): ActivityMap {
	const current = activity[ sessionId ];
	if (
		current?.runId === next?.runId &&
		current?.activity === next?.activity &&
		current?.since === next?.since
	) {
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

// Applies one event of the `agent` channel.
export function applyAgentEvent( activity: ActivityMap, event: AgentEventInfo ): ActivityMap {
	const { sessionId, runId, type, detail, at } = event;
	const current = activity[ sessionId ];

	if ( type === 'run.started' ) {
		// The start the computer listed wins over a late copy of the event.
		const since = current?.runId === runId ? current.since ?? at : at;
		return withRun( activity, sessionId, { runId, activity: 'working', since } );
	}
	// The run keeps the start it has.
	const since = current?.since;
	// A stopped run leaves the computer's list at once, so a new run can start
	// in the same chat before the last events of the old one arrive. Those late
	// events must not touch the new run.
	if ( current && current.runId !== runId ) {
		return activity;
	}

	switch ( type ) {
		case 'turn.started':
			return withRun( activity, sessionId, { runId, activity: 'working', since } );
		case 'question.asked':
			return withRun( activity, sessionId, { runId, activity: 'needs-answer', since } );
		case 'message':
			// The computer sends no event when a question is answered there. The
			// agent going on after a question means it got its answer.
			return current?.activity === 'needs-answer' && detail && AGENT_WENT_ON.has( detail )
				? withRun( activity, sessionId, { runId, activity: 'working', since } )
				: activity;
		case 'turn.completed':
		case 'run.interrupting':
		case 'run.interrupted':
		case 'run.exited':
			return withRun( activity, sessionId, null );
		default:
			return activity;
	}
}
