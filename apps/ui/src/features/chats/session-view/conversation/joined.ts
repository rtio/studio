import { getSender } from '@studio/agent/protocol/transcript/transcript-items';
import type { TranscriptItem } from '@studio/agent/protocol/transcript/transcript-items';

export interface Joined {
	joinedAbove?: boolean;
	joinedBelow?: boolean;
}

export function joinedAttributes( { joinedAbove, joinedBelow }: Joined ) {
	return {
		'data-joined-above': joinedAbove || undefined,
		'data-joined-below': joinedBelow || undefined,
	};
}
export function canJoinBubbles(
	item: TranscriptItem | undefined,
	adjacent: TranscriptItem | undefined
) {
	const isBubble = ( row: TranscriptItem | undefined ) =>
		row?.kind === 'user-text' ||
		row?.kind === 'assistant-text' ||
		row?.kind === 'agent-question-batch';
	return isBubble( item ) && isBubble( adjacent ) && getSender( item ) === getSender( adjacent );
}
