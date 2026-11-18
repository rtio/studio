import { STOPPED_WITHOUT_ANSWER } from '@studio/agent/protocol/tools';
import {
	createSessionStateStore,
	initialAgentRunState,
} from '@studio/agent/protocol/transcript/run-state';
import { z } from 'zod';
import { createValueStore } from '../lib/value-store';
import type { ChatEvent } from './chat-reply';
import type { ActiveRun } from './remote-schemas';
import type { ValueStore } from '../lib/value-store';
import type {
	AgentRunAction,
	AgentRunState,
	SessionStateStore,
} from '@studio/agent/protocol/transcript/run-state';

// What went wrong outside the composer's own send, by chat. The composer
// shows it until the person acts on the chat again.
export type RunNotice = 'queue-failed' | 'answer-failed' | 'stop-failed';

export interface RunControlParts {
	// Sends a request to the paired computer. Rejects when the computer cannot
	// be reached or refuses.
	post: ( path: string, body?: unknown ) => Promise< unknown >;
	// A random UUID. The computer names the turn with it, and keeps the prompt
	// off the agent's command line when there is one.
	newTurnId: () => string;
	now: () => number;
	// Shows a sent prompt in the open chat until a read of the chat has it
	// (data/open-chat.ts), and takes it away when the send failed.
	showPrompt: ( chatId: string, text: string ) => string;
	dropPrompt: ( chatId: string, key: string ) => void;
}

export interface RunControl {
	// The run state of each chat: the shared reducer of Studio's own app.
	store: SessionStateStore;
	notices: ValueStore< Readonly< Record< string, RunNotice > > >;
	// The answers of the last batch sent from the phone, by chat. They show
	// on the question card until a read of the chat has them.
	sentAnswers: ValueStore< Readonly< Record< string, Readonly< Record< string, string > > > > >;
	// Sends a prompt, or queues it while the chat is busy. Rejects when the
	// computer did not take it; the prompt is then neither sent nor queued.
	send: ( chatId: string, text: string ) => Promise< void >;
	stop: ( chatId: string ) => Promise< void >;
	answer: ( chatId: string, question: string, answer: string ) => void;
	clearAnswer: ( chatId: string, question: string ) => void;
	removeQueued: ( chatId: string, id: string ) => void;
	// One event of the agent channel, for any chat.
	handle: ( chatId: string, event: ChatEvent ) => void;
	// Call right before `GET /api/runs/active` goes out, then `hydrate` with
	// what it listed. A chat that changed in between keeps what its events said.
	beginHydrate: () => void;
	hydrate: ( runs: ActiveRun[] ) => void;
	// Forgets every chat, for another computer or none.
	clear: () => void;
}

// The inner events that mean the agent went on after a question: it starts a
// new message or a new turn (see run-activity.ts).
const AGENT_WENT_ON = new Set( [ 'message_start', 'turn_start' ] );

// A stopped run leaves the computer's list of active runs at once, while its
// process still writes the chat for a moment; the computer kills it after 2 s.
// A chat that is stopping and not listed waits this long before it counts as
// idle and sends what it queued.
const STOPPED_RUN_GRACE_MS = 3000;

const runIdSchema = z.object( { runId: z.string() } );

const messagesPath = ( chatId: string ) =>
	`/api/sessions/${ encodeURIComponent( chatId ) }/messages`;
const answerPath = ( runId: string ) => `/api/runs/${ encodeURIComponent( runId ) }/answer`;
const interruptPath = ( runId: string ) => `/api/runs/${ encodeURIComponent( runId ) }/interrupt`;

// A prompt waits while the chat has a run, a question or earlier prompts.
// The computer refuses a message while the chat's run is there, and keeps the
// run until its process exits, after the turn ended.
function mustQueue( state: AgentRunState ): boolean {
	return (
		state.phase !== 'idle' || state.pendingQuestions.length > 0 || state.queuedPrompts.length > 0
	);
}

function withKey< Value >(
	record: Readonly< Record< string, Value > >,
	key: string,
	value: Value | null
): Readonly< Record< string, Value > > {
	if ( value === null ) {
		if ( ! ( key in record ) ) {
			return record;
		}
		const { [ key ]: _removed, ...rest } = record;
		return rest;
	}
	return record[ key ] === value ? record : { ...record, [ key ]: value };
}

// Sends, queues, stops and answers for the chats of the paired computer, as
// Studio's own app does (apps/ui/src/data/agent-runs/provider.tsx).
export function createRunControl( parts: RunControlParts ): RunControl {
	const store = createSessionStateStore();
	const notices = createValueStore< Readonly< Record< string, RunNotice > > >( {} );
	const sentAnswers = createValueStore<
		Readonly< Record< string, Readonly< Record< string, string > > > >
	>( {} );
	// Goes up with each change of a chat's run. A send that sees it moved while
	// its request was on the way knows the run's own events got there first.
	const revisions = new Map< string, number >();
	// The run each chat follows. Events of another run are late events of a run
	// that ended.
	const followed = new Map< string, string >();
	// Runs the phone stopped. Only their end still matters.
	const stopped = new Set< string >();
	// Chats stopped before the computer named their run.
	const stopOnStart = new Set< string >();
	// Chats whose Stop is answering open questions now.
	const stopping = new Set< string >();
	// The revisions when `GET /api/runs/active` went out, until `hydrate`.
	let revisionsBeforeHydrate: Map< string, number > | null = null;
	let queueIds = 0;
	// Goes up when the phone forgets every chat. A request that comes back
	// after that belongs to another computer.
	let generation = 0;

	const stateOf = ( chatId: string ): AgentRunState =>
		store.getState()[ chatId ] ?? initialAgentRunState;

	function dispatch( chatId: string, action: AgentRunAction ) {
		if ( ! action.type.startsWith( 'queue_' ) ) {
			revisions.set( chatId, ( revisions.get( chatId ) ?? 0 ) + 1 );
		}
		store.dispatch( chatId, action );
	}

	function setNotice( chatId: string, notice: RunNotice | null ) {
		notices.set( withKey( notices.get(), chatId, notice ) );
	}

	function setSent( chatId: string, answers: Record< string, string > | null ) {
		sentAnswers.set( withKey( sentAnswers.get(), chatId, answers ) );
	}

	// Sends the first queued prompt of an idle chat. Called after the events
	// that can make a chat idle have been handled.
	function drain( chatId: string ) {
		const state = stateOf( chatId );
		const next = state.phase === 'idle' ? state.queuedPrompts[ 0 ] : undefined;
		if ( ! next ) {
			return;
		}
		dispatch( chatId, { type: 'queue_shift' } );
		const mine = generation;
		startRun( chatId, next.prompt ).catch( () => {
			if ( mine !== generation ) {
				return;
			}
			// The next one would most likely fail the same way.
			dispatch( chatId, { type: 'queue_clear' } );
			setNotice( chatId, 'queue-failed' );
		} );
	}

	function drainSoon( chatId: string ) {
		queueMicrotask( () => drain( chatId ) );
	}

	// The computer named the run of a chat that was stopped before that.
	function stopStartedRun( chatId: string, runId: string ) {
		stopOnStart.delete( chatId );
		stopped.add( runId );
		dispatch( chatId, {
			type: 'hydrate_active_run',
			runId,
			startedAt: parts.now(),
			interrupting: true,
		} );
		parts.post( interruptPath( runId ) ).catch( () => setNotice( chatId, 'stop-failed' ) );
	}

	function endRun( chatId: string ) {
		followed.delete( chatId );
		dispatch( chatId, { type: 'run_ended' } );
		setSent( chatId, null );
		drainSoon( chatId );
	}

	// Ends a stopped run the computer no longer lists, once its process has
	// surely exited. Its late events stay ignored.
	function endStoppedRunSoon( chatId: string, runId: string ) {
		const mine = generation;
		setTimeout( () => {
			if ( mine === generation && stateOf( chatId ).runId === runId ) {
				endRun( chatId );
			}
		}, STOPPED_RUN_GRACE_MS );
	}

	async function startRun( chatId: string, prompt: string ): Promise< void > {
		// Before the request, so a second send in the meantime is queued.
		dispatch( chatId, { type: 'send_pending', startedAt: parts.now() } );
		// After `clear` this no longer matches either, so an answer that comes
		// back for another computer changes nothing.
		const revision = revisions.get( chatId );
		const shown = parts.showPrompt( chatId, prompt );
		let runId: string;
		try {
			const response = await parts.post( messagesPath( chatId ), {
				prompt,
				turnId: parts.newTurnId(),
			} );
			runId = runIdSchema.parse( response ).runId;
		} catch ( error ) {
			parts.dropPrompt( chatId, shown );
			stopOnStart.delete( chatId );
			// The queue stays. It goes when the person sends again or the
			// stream opens again. A run that started meanwhile (Studio on the
			// computer sent first, or this send timed out after it started)
			// stays: its events moved the chat on.
			if ( revisions.get( chatId ) === revision ) {
				dispatch( chatId, { type: 'run_ended' } );
			}
			throw error;
		}
		if ( stopOnStart.has( chatId ) ) {
			stopStartedRun( chatId, runId );
			return;
		}
		if ( revisions.get( chatId ) !== revision ) {
			return;
		}
		dispatch( chatId, { type: 'send_start', runId, startedAt: parts.now() } );
		followed.set( chatId, runId );
	}

	return {
		store,
		notices,
		sentAnswers,

		async send( chatId, text ) {
			const prompt = text.trim();
			if ( ! prompt ) {
				return;
			}
			setNotice( chatId, null );
			if ( mustQueue( stateOf( chatId ) ) ) {
				queueIds += 1;
				dispatch( chatId, { type: 'queue_append', prompt: { id: `q${ queueIds }`, prompt } } );
				// A chat that is idle with prompts left from a failed send sends them now.
				drainSoon( chatId );
				return;
			}
			await startRun( chatId, prompt );
		},

		async stop( chatId ) {
			const state = stateOf( chatId );
			const { runId } = state;
			// A second tap while the first one answers the questions would send
			// them again, and then a second interrupt, which kills the agent.
			if ( state.phase === 'idle' || stopping.has( chatId ) ) {
				return;
			}
			setNotice( chatId, null );
			if ( state.isInterrupting ) {
				// A second Stop: the computer kills the agent.
				if ( runId ) {
					await parts
						.post( interruptPath( runId ) )
						.catch( () => setNotice( chatId, 'stop-failed' ) );
				}
				return;
			}
			if ( runId && state.pendingQuestions.length > 0 ) {
				// The agent waits for the answers and not for the stop. Without an
				// answer to its question it would also stop asking with cards.
				const answers = { ...state.pendingAnswers };
				for ( const { question } of state.pendingQuestions ) {
					if ( typeof answers[ question ] !== 'string' ) {
						answers[ question ] = STOPPED_WITHOUT_ANSWER;
					}
				}
				const mine = generation;
				stopping.add( chatId );
				try {
					await parts.post( answerPath( runId ), { answers } );
				} catch {
					if ( mine === generation ) {
						setNotice( chatId, 'stop-failed' );
					}
					return;
				} finally {
					stopping.delete( chatId );
				}
				if ( mine !== generation || stateOf( chatId ).runId !== runId ) {
					return;
				}
			}
			if ( runId ) {
				stopped.add( runId );
				// Its own run is known now: this Stop replaces one pressed before.
				stopOnStart.delete( chatId );
			} else {
				stopOnStart.add( chatId );
			}
			followed.delete( chatId );
			dispatch( chatId, { type: 'interrupt_requested' } );
			if ( runId ) {
				await parts
					.post( interruptPath( runId ) )
					.catch( () => setNotice( chatId, 'stop-failed' ) );
			}
		},

		answer( chatId, question, answer ) {
			const state = stateOf( chatId );
			const { runId, pendingQuestions } = state;
			if ( ! runId || ! pendingQuestions.some( ( pending ) => pending.question === question ) ) {
				return;
			}
			const answers = { ...state.pendingAnswers, [ question ]: answer };
			if (
				! pendingQuestions.every( ( pending ) => typeof answers[ pending.question ] === 'string' )
			) {
				dispatch( chatId, { type: 'question_answered', question, answer } );
				return;
			}
			// The computer takes one answer per batch, with every question in it.
			setNotice( chatId, null );
			dispatch( chatId, { type: 'batch_dispatched' } );
			setSent( chatId, answers );
			parts.post( answerPath( runId ), { answers } ).catch( () => {
				if ( stateOf( chatId ).runId !== runId ) {
					return;
				}
				setSent( chatId, null );
				dispatch( chatId, { type: 'questions_added', questions: pendingQuestions } );
				setNotice( chatId, 'answer-failed' );
			} );
		},

		clearAnswer( chatId, question ) {
			if ( question in stateOf( chatId ).pendingAnswers ) {
				dispatch( chatId, { type: 'question_answer_cleared', question } );
			}
		},

		removeQueued( chatId, id ) {
			dispatch( chatId, { type: 'queue_remove', id } );
		},

		handle( chatId, event ) {
			const { runId, type } = event;
			if ( stopped.has( runId ) ) {
				if ( type === 'run.exited' || type === 'run.interrupted' ) {
					stopped.delete( runId );
					if ( stateOf( chatId ).runId === runId ) {
						endRun( chatId );
					}
				}
				return;
			}
			if ( type === 'run.started' ) {
				// Even with a Stop waiting for the run's name, this run is not
				// taken for the phone's own: Studio on the computer may have
				// started it. The answer to the phone's send names its run.
				followed.set( chatId, runId );
				dispatch( chatId, {
					type: 'hydrate_active_run',
					runId,
					startedAt: parts.now(),
					interrupting: false,
				} );
				return;
			}
			const following = followed.get( chatId );
			if ( following !== undefined && following !== runId ) {
				return;
			}
			const state = stateOf( chatId );
			switch ( type ) {
				case 'question.asked':
					if ( event.questions?.length ) {
						dispatch( chatId, { type: 'questions_added', questions: event.questions } );
					}
					return;
				case 'message':
					// The computer sends no event when a question is answered there.
					if (
						state.pendingQuestions.length > 0 &&
						event.inner &&
						AGENT_WENT_ON.has( event.inner.type )
					) {
						dispatch( chatId, { type: 'batch_dispatched' } );
					}
					return;
				case 'turn.completed':
					dispatch( chatId, { type: 'turn_completed' } );
					return;
				case 'run.interrupting':
					// Stopped on the computer.
					dispatch( chatId, { type: 'interrupt_requested' } );
					return;
				case 'run.interrupted':
				case 'run.exited':
					if ( state.runId === runId ) {
						endRun( chatId );
					}
					return;
			}
		},

		beginHydrate() {
			revisionsBeforeHydrate = new Map( revisions );
		},

		hydrate( runs ) {
			// Events that arrived while the list was read are newer than it.
			const before = revisionsBeforeHydrate;
			revisionsBeforeHydrate = null;
			const changed = ( chatId: string ) =>
				before !== null && revisions.get( chatId ) !== before.get( chatId );
			const listed = new Map( runs.map( ( run ) => [ run.sessionId, run ] ) );
			for ( const [ chatId, state ] of Object.entries( store.getState() ) ) {
				// A chat whose send is on its way is not listed yet.
				if (
					state.phase === 'idle' ||
					state.phase === 'starting' ||
					listed.has( chatId ) ||
					changed( chatId )
				) {
					continue;
				}
				if ( state.isInterrupting && state.runId ) {
					endStoppedRunSoon( chatId, state.runId );
				} else {
					endRun( chatId );
				}
			}
			for ( const run of runs ) {
				const chatId = run.sessionId;
				if ( stopped.has( run.runId ) || changed( chatId ) ) {
					continue;
				}
				const questions = run.pendingQuestions ?? [];
				// Answered elsewhere while the stream was down. The reducer keeps old
				// questions when the list is empty.
				if ( questions.length === 0 && stateOf( chatId ).pendingQuestions.length > 0 ) {
					dispatch( chatId, { type: 'batch_dispatched' } );
				}
				followed.set( chatId, run.runId );
				dispatch( chatId, {
					type: 'hydrate_active_run',
					runId: run.runId,
					startedAt: parts.now(),
					interrupting: false,
					pendingQuestions: questions,
				} );
			}
			for ( const chatId of Object.keys( store.getState() ) ) {
				drainSoon( chatId );
			}
		},

		clear() {
			generation += 1;
			for ( const chatId of Object.keys( store.getState() ) ) {
				dispatch( chatId, { type: 'queue_clear' } );
				dispatch( chatId, { type: 'run_ended' } );
			}
			revisions.clear();
			followed.clear();
			stopped.clear();
			stopOnStart.clear();
			stopping.clear();
			notices.set( {} );
			sentAnswers.set( {} );
		},
	};
}
