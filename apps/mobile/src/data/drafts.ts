import { createValueStore } from '../lib/value-store';

// What the person typed in one chat's composer, and whether its last send failed.
export interface Draft {
	text: string;
	failed: boolean;
}

export const EMPTY_DRAFT: Draft = { text: '', failed: false };

// The key of the draft for a chat, or for a new chat on a site (or on none).
export function draftKey( chatId: string | null, siteId: string | null ): string {
	return chatId ?? `new:${ siteId ?? '' }`;
}

// Where the text of a failed send goes back: the draft it was typed in, or
// the chat the send made from the empty screen while that chat is open. A chat
// made that way has no prompt yet, so the drawer does not list it: once the
// person has left it, the text goes back to the empty screen of its site.
export function failedSendKey( typedIn: string, made: string | null, open: string | null ): string {
	return made !== null && made === open ? made : typedIn;
}

// The drafts of every chat, in memory while the app runs. A draft belongs to
// its chat: it is there again when the chat opens, and a send that fails puts
// its text back into the draft of the chat it was for, wherever the person is.
export function createDrafts() {
	const store = createValueStore< Readonly< Record< string, Draft > > >( {} );
	// Goes up with each `clear`.
	let generation = 0;

	function put( key: string, draft: Draft ) {
		const { [ key ]: _old, ...rest } = store.get();
		store.set( draft.text === '' && ! draft.failed ? rest : { ...rest, [ key ]: draft } );
	}

	const get = ( key: string ): Draft => store.get()[ key ] ?? EMPTY_DRAFT;

	return {
		store,
		get,
		// The person typed.
		set( key: string, text: string ) {
			put( key, { ...get( key ), text } );
		},
		// Take it when a send begins, and give it to `fail`.
		generation: () => generation,
		// A send of `text`, begun at `since`, failed. Text typed since then wins,
		// unless it is only spaces. A send begun before the drafts were cleared,
		// for another computer, puts nothing back.
		fail( key: string, text: string, since: number ) {
			if ( since !== generation ) {
				return;
			}
			const typed = get( key ).text;
			put( key, { text: typed.trim() ? typed : text, failed: true } );
		},
		// The person sends again.
		clearFailure( key: string ) {
			put( key, { ...get( key ), failed: false } );
		},
		// Another computer, or none.
		clear() {
			generation += 1;
			store.set( {} );
		},
	};
}

export const drafts = createDrafts();
