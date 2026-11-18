import {
	getMediaAltText,
	isDesignSystemPreviewWidget,
} from '@studio/agent/protocol/chat-artifacts';
import {
	formatErrorMessage,
	isAiAccessRequiredError,
	isAiBlockedError,
	isOutOfCreditsError,
	isUsageCapError,
} from '@studio/agent/protocol/errors';
import { getToolDisplay } from '@studio/agent/protocol/transcript/tool-display';
import { __ } from '@wordpress/i18n';
import type { ActivityMap } from './run-activity';
import type { StudioChatArtifactWidgetDraft } from '@studio/agent/protocol/chat-artifacts';
import type {
	AgentQuestionRenderItem,
	TranscriptItem,
	TurnActivity,
} from '@studio/agent/protocol/transcript/transcript-items';

export type ToolState = 'running' | 'done' | 'failed' | 'stopped';

// One row of the chat list. The transcript items come from the code the
// computer's own chat view uses; these rows are how the phone lays them out.
export type ChatRow =
	| { kind: 'user'; key: string; text: string }
	| { kind: 'assistant'; key: string; text: string; streaming: boolean }
	| {
			kind: 'turn';
			key: string;
			status: TurnActivity[ 'status' ];
			// When the turn started, in milliseconds: the run's start, else the
			// prompt's time.
			startedAt: number | null;
			steps: number;
			collapsible: boolean;
			expanded: boolean;
	  }
	| { kind: 'tool'; key: string; label: string; detail: string; state: ToolState }
	| { kind: 'questions'; key: string; questions: AgentQuestionRenderItem[] }
	| { kind: 'note'; key: string; text: string; tone: 'muted' | 'error' };

type InnerItem = TurnActivity[ 'items' ][ number ];

// What the transcript needs of a chat's run: whether one is going, and when it
// started by the computer's clock, if the phone knows. The drawer shows the
// same start.
export function chatRun(
	activity: ActivityMap,
	chatId: string
): { running: boolean; startedAt: number | null } {
	const run = activity[ chatId ];
	return { running: run !== undefined, startedAt: run?.since ?? null };
}

function toolState( item: Extract< InnerItem, { kind: 'tool-use' } > ): ToolState {
	if ( item.result ) {
		return item.result.isError ? 'failed' : 'done';
	}
	return item.running ? 'running' : 'stopped';
}

// The error that closed a turn, as the person reads it. The phone cannot read
// the credit balance or the reset date, so these say where to look instead.
export function turnErrorText( message: string ): string {
	if ( isOutOfCreditsError( message ) ) {
		return __( 'You are out of AI credits. Add credits in Studio on your computer.' );
	}
	if ( isUsageCapError( message ) ) {
		return __( 'You reached your monthly AI usage limit. Try again later.' );
	}
	if ( isAiBlockedError( message ) || isAiAccessRequiredError( message ) ) {
		return __( 'Studio Code is not available for this account. Check Studio on your computer.' );
	}
	return (
		formatErrorMessage( message ) ||
		__( 'Something went wrong and this turn was stopped. Please try again.' )
	);
}

// The phone cannot load the computer's screenshots, so an artifact shows as
// its description. The design system preview has none and shows nothing, as
// on the computer.
function artifactText( widgets: StudioChatArtifactWidgetDraft[] ): string {
	return widgets
		.filter( ( widget ) => ! isDesignSystemPreviewWidget( widget ) )
		.map( ( widget ) => getMediaAltText( widget, __( 'Image' ) ) )
		.join( '\n' );
}

function pushItem( rows: ChatRow[], item: InnerItem | Exclude< TranscriptItem, TurnActivity > ) {
	switch ( item.kind ) {
		case 'user-text':
			rows.push( { kind: 'user', key: item.key, text: item.text } );
			return;
		case 'assistant-text':
			rows.push( {
				kind: 'assistant',
				key: item.key,
				text: item.text,
				streaming: item.streaming === true,
			} );
			return;
		case 'tool-use': {
			const { label, detail } = getToolDisplay( item.name, item.input );
			rows.push( { kind: 'tool', key: item.key, label, detail, state: toolState( item ) } );
			return;
		}
		case 'agent-question-batch':
			rows.push( { kind: 'questions', key: item.key, questions: item.questions } );
			return;
		case 'chat-artifact': {
			const text = artifactText( item.widgets );
			if ( text ) {
				rows.push( { kind: 'note', key: item.key, text, tone: 'muted' } );
			}
			return;
		}
		case 'error-marker':
			rows.push( {
				kind: 'note',
				key: item.key,
				text: turnErrorText( item.message ),
				tone: 'error',
			} );
			return;
	}
}

// What stays in view when a finished turn is folded: what the person may
// need to act on or read, as on the computer.
function keptWhenFolded( item: InnerItem ): boolean {
	return (
		item.kind === 'agent-question-batch' ||
		item.kind === 'chat-artifact' ||
		( item.kind === 'assistant-text' && item.persistent === true )
	);
}

// Lays out the transcript. A finished turn with tool steps is folded to one
// line unless its key is in `expandedTurns`. A turn that is still running is
// always open.
export function chatRows(
	items: TranscriptItem[],
	expandedTurns: ReadonlySet< string >
): ChatRow[] {
	const rows: ChatRow[] = [];
	for ( const item of items ) {
		if ( item.kind !== 'activity' ) {
			pushItem( rows, item );
			continue;
		}
		const steps = item.items.filter( ( inner ) => inner.kind === 'tool-use' ).length;
		const collapsible = item.status !== 'running' && steps > 0;
		const expanded = ! collapsible || expandedTurns.has( item.key );
		// A plain answer with no steps needs no "Worked" line above it.
		if ( steps > 0 || item.status !== 'success' ) {
			rows.push( {
				kind: 'turn',
				key: item.key,
				status: item.status,
				startedAt: item.startedAt,
				steps,
				collapsible,
				expanded,
			} );
		}
		for ( const inner of item.items ) {
			if ( expanded || keptWhenFolded( inner ) ) {
				pushItem( rows, inner );
			}
		}
	}
	return rows;
}
