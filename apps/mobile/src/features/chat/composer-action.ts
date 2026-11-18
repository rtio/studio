import type { AgentRunState } from '@studio/agent/protocol/transcript/run-state';

// What the composer's button does now.
export type ComposerAction = 'send' | 'queue' | 'answer' | 'stop' | 'force-stop';

// As in Studio's own composer (apps/ui/src/features/composer/composer.tsx): a
// busy chat with nothing typed, or with a send on its way, offers Stop; a
// second Stop forces it. Text typed while a question waits answers it, and
// text typed while the chat is busy waits in the queue.
export function composerAction(
	state: AgentRunState,
	{ hasText, sending, answering }: { hasText: boolean; sending: boolean; answering: boolean }
): ComposerAction {
	const busy = state.phase !== 'idle' || state.pendingQuestions.length > 0;
	if ( busy && ( sending || ! hasText ) ) {
		return state.isInterrupting ? 'force-stop' : 'stop';
	}
	if ( answering ) {
		return 'answer';
	}
	return busy ? 'queue' : 'send';
}
