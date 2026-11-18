import type { AgentRunState } from '@studio/agent/protocol/transcript/run-state';
import type { AgentQuestionRenderItem } from '@studio/agent/protocol/transcript/transcript-items';

export interface QuestionView {
	// The agent waits for this question and the phone can answer it.
	open: boolean;
	// The answer to show: an option label, labels joined with ", ", typed text,
	// or the text of a skip or a stop.
	answer: string | undefined;
}

// What a question of the chat shows. A question the computer saved an answer
// for is closed, also when a later batch asks the same text again.
export function questionView(
	item: AgentQuestionRenderItem,
	state: AgentRunState,
	sent: Readonly< Record< string, string > >
): QuestionView {
	if ( item.pickedLabel ) {
		return { open: false, answer: item.pickedLabel };
	}
	if ( state.pendingQuestions.some( ( pending ) => pending.question === item.question ) ) {
		return { open: true, answer: state.pendingAnswers[ item.question ] };
	}
	// Sent from the phone, and not read back from the computer yet.
	return { open: false, answer: sent[ item.question ] };
}

// The question that text typed in the composer answers: the one whose own
// "Other" option was chosen, else the first one without an answer.
export function answerTarget( state: AgentRunState, armed: string | null ): string | null {
	if ( armed && state.pendingQuestions.some( ( pending ) => pending.question === armed ) ) {
		return armed;
	}
	const waiting = state.pendingQuestions.find(
		( pending ) => typeof state.pendingAnswers[ pending.question ] !== 'string'
	);
	return waiting?.question ?? null;
}

// The labels in an answer. Studio joins the labels of a multiple-choice answer
// with ", ".
export function answerLabels(
	item: Pick< AgentQuestionRenderItem, 'multiSelect' >,
	answer: string | undefined
): string[] {
	if ( ! answer ) {
		return [];
	}
	return item.multiSelect ? answer.split( ', ' ) : [ answer ];
}

// The labels a question shows checked. Picks not sent yet count only while
// the question is open: once it is answered, what was sent shows.
export function shownPicks(
	item: Pick< AgentQuestionRenderItem, 'multiSelect' >,
	view: QuestionView,
	draft: string[] | undefined
): string[] {
	return ( view.open ? draft : undefined ) ?? answerLabels( item, view.answer );
}

// Adds a label to a multiple-choice selection, or takes it out.
export function toggleLabel( selection: string[], label: string ): string[] {
	return selection.includes( label )
		? selection.filter( ( picked ) => picked !== label )
		: [ ...selection, label ];
}
