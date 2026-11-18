import type { ChatRow } from '../../data/chat-rows';

// What a long press on a message offers.
export type MessageAction = 'copy' | 'edit' | 'send-again' | 'share';

// Your own message: copy it, edit it in the composer, or send it again (while
// the computer is connected). One with images, files or a note on the page is
// only copied: the composer takes text alone. A reply: copy or share it, once
// it is complete.
export function messageActions( row: ChatRow, connected: boolean ): MessageAction[] {
	if ( row.kind === 'user' ) {
		if ( row.text.trim() === '' ) {
			return [];
		}
		if ( ! row.textOnly ) {
			return [ 'copy' ];
		}
		return connected ? [ 'copy', 'edit', 'send-again' ] : [ 'copy', 'edit' ];
	}
	if ( row.kind === 'assistant' && ! row.streaming ) {
		return [ 'copy', 'share' ];
	}
	return [];
}
