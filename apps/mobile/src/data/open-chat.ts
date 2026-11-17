import { createValueStore } from '../lib/value-store';
import { applyChatEvent, endReply, NOTHING_LIVE, withoutRead } from './chat-reply';
import type { ChatEvent, ChatLive } from './chat-reply';

export interface OpenChatState {
	chatId: string | null;
	live: ChatLive;
}

const NO_CHAT: OpenChatState = { chatId: null, live: NOTHING_LIVE };

// Text arrives many times a second while the agent writes. The chat draws it
// at most this often.
const DRAW_EVERY_MS = 50;

// The computer saves a tool result and the next message within moments, and
// each read downloads the whole chat. Reads asked for within this time are one
// read, which starts after all of them. A read on its way is never stopped (on
// a large chat that could keep every read from finishing while the agent
// works): when it arrives having started too early, the chat is read again.
const READ_AFTER_MS = 400;

// Keeps what the stream adds to the open chat. `read` is called when the chat
// changed on the computer and should be read again.
export function createOpenChat( read: ( chatId: string ) => void ) {
	const store = createValueStore< OpenChatState >( NO_CHAT );
	// Ahead of the store while a draw waits.
	let latest = NO_CHAT;
	// Goes up with each event. A read notes it when it starts (see chat-reply.ts).
	let marks = 0;
	// The mark at the last time a read was asked for.
	let wanted = 0;
	let drawTimer: ReturnType< typeof setTimeout > | null = null;
	let readTimer: ReturnType< typeof setTimeout > | null = null;

	function drawNow() {
		if ( drawTimer ) {
			clearTimeout( drawTimer );
			drawTimer = null;
		}
		store.set( latest );
	}

	function drawSoon() {
		if ( ! drawTimer && store.get() !== latest ) {
			drawTimer = setTimeout( drawNow, DRAW_EVERY_MS );
		}
	}

	function cancelRead() {
		if ( readTimer ) {
			clearTimeout( readTimer );
			readTimer = null;
		}
	}

	function readNow( chatId: string ) {
		cancelRead();
		wanted = marks;
		read( chatId );
	}

	function readSoon( chatId: string ) {
		if ( readTimer ) {
			return;
		}
		readTimer = setTimeout( () => {
			readTimer = null;
			if ( latest.chatId === chatId ) {
				readNow( chatId );
			}
		}, READ_AFTER_MS );
	}

	function reset( chatId: string | null ) {
		cancelRead();
		wanted = 0;
		latest = { chatId, live: NOTHING_LIVE };
		drawNow();
	}

	return {
		store,

		// The mark a read of the chat notes when it starts.
		mark: () => marks,

		// The phone opened this chat. What the stream added to another chat, or
		// to this one before, is out of date.
		select( chatId: string ) {
			reset( chatId );
		},

		handle( chatId: string, event: ChatEvent ) {
			if ( latest.chatId !== chatId ) {
				return;
			}
			marks += 1;
			const step = applyChatEvent( latest.live, event, marks );
			if ( step.live !== latest.live ) {
				latest = { chatId, live: step.live };
			}
			if ( step.read ) {
				drawNow();
				readSoon( chatId );
			} else {
				drawSoon();
			}
		},

		// A read that started at `readAt` arrived: drop the replies it has, and
		// read again if it started before the last time a read was asked for.
		settled( chatId: string, readAt: number ) {
			if ( latest.chatId !== chatId ) {
				return;
			}
			const live = withoutRead( latest.live, readAt );
			if ( live !== latest.live ) {
				latest = { chatId, live };
				drawNow();
			}
			if ( readAt < wanted ) {
				readSoon( chatId );
			}
		},

		// The stream opened again and may have missed events: read the chat now,
		// and let that read replace the reply being written.
		resync() {
			const { chatId } = latest;
			if ( ! chatId ) {
				return;
			}
			marks += 1;
			latest = { chatId, live: endReply( latest.live, marks ) };
			drawNow();
			readNow( chatId );
		},

		clear() {
			reset( null );
		},
	};
}
