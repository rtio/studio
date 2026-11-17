import { SKIPPED_QUESTION, STOPPED_WITHOUT_ANSWER } from '@studio/agent/protocol/tools';
import { replaceEqualDeep } from '@tanstack/react-query';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	Check,
	ChevronDown,
	ChevronRight,
	CircleStop,
	CircleX,
	ImageIcon,
	TriangleAlert,
} from 'lucide-react-native';
import { memo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { space } from '../../theme/typography';
import { useTheme } from '../../theme/use-theme';
import { Spinner } from '../../ui/Spinner';
import { Text } from '../../ui/Text';
import { Markdown } from './Markdown';
import type { ChatRow, ToolState } from '../../data/chat-rows';
import type { ThemeColors } from '../../theme/theme';
import type { AgentQuestionRenderItem } from '@studio/agent/protocol/transcript/transcript-items';

const ICON_SIZE = 16;

interface ChatRowViewProps {
	row: ChatRow;
	// The chat's run waits for an answer now.
	needsAnswer: boolean;
	onToggleTurn: ( key: string ) => void;
}

// Rows are built again on each draw while the agent writes. A row whose
// content did not change does not draw again.
function sameRow( before: ChatRowViewProps, after: ChatRowViewProps ): boolean {
	return (
		before.needsAnswer === after.needsAnswer &&
		before.onToggleTurn === after.onToggleTurn &&
		replaceEqualDeep( before.row, after.row ) === before.row
	);
}

// One row of the chat.
export const ChatRowView = memo( function ChatRowView( {
	row,
	needsAnswer,
	onToggleTurn,
}: ChatRowViewProps ) {
	switch ( row.kind ) {
		case 'user':
			return <UserBubble text={ row.text } />;
		case 'assistant':
			return (
				<View style={ styles.assistant }>
					<Markdown text={ row.text } streaming={ row.streaming } />
				</View>
			);
		case 'turn':
			return <TurnLine row={ row } onToggle={ onToggleTurn } />;
		case 'tool':
			return <ToolLine label={ row.label } detail={ row.detail } state={ row.state } />;
		case 'questions':
			return <Questions questions={ row.questions } needsAnswer={ needsAnswer } />;
		case 'note':
			return <Note text={ row.text } tone={ row.tone } />;
	}
}, sameRow );

function UserBubble( { text }: { text: string } ) {
	const { colors } = useTheme();

	return (
		<View style={ [ styles.bubble, { backgroundColor: colors.muted } ] }>
			<Text selectable>{ text }</Text>
		</View>
	);
}

function turnText( status: Extract< ChatRow, { kind: 'turn' } >[ 'status' ], steps: number ) {
	let text: string;
	switch ( status ) {
		case 'running':
			text = __( 'Working' );
			break;
		case 'interrupted':
			text = __( 'Stopped' );
			break;
		case 'error':
			text = __( 'Failed' );
			break;
		default:
			text = __( 'Worked' );
	}
	if ( steps === 0 ) {
		return text;
	}
	/* translators: 1: what the agent did (Worked, Stopped, ...), 2: number of steps. */
	return sprintf( _n( '%1$s · %2$d step', '%1$s · %2$d steps', steps ), text, steps );
}

function TurnLine( {
	row,
	onToggle,
}: {
	row: Extract< ChatRow, { kind: 'turn' } >;
	onToggle: ( key: string ) => void;
} ) {
	const { colors } = useTheme();
	const Chevron = row.expanded ? ChevronDown : ChevronRight;
	const content = (
		<>
			{ row.status === 'running' ? (
				<Spinner />
			) : (
				row.collapsible && <Chevron size={ ICON_SIZE } color={ colors.mutedForeground } />
			) }
			<Text variant="label" color={ row.status === 'error' ? 'destructive' : 'mutedForeground' }>
				{ turnText( row.status, row.steps ) }
			</Text>
		</>
	);

	if ( ! row.collapsible ) {
		return <View style={ styles.line }>{ content }</View>;
	}
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={ { expanded: row.expanded } }
			accessibilityHint={ row.expanded ? __( 'Hides the steps' ) : __( 'Shows the steps' ) }
			onPress={ () => onToggle( row.key ) }
			android_ripple={ { color: colors.muted } }
			style={ ( { pressed } ) => [
				styles.line,
				pressed && Platform.OS !== 'android' && { opacity: 0.6 },
			] }
		>
			{ content }
		</Pressable>
	);
}

function toolIcon( state: ToolState, colors: ThemeColors ) {
	switch ( state ) {
		case 'running':
			return <Spinner />;
		case 'done':
			return <Check size={ ICON_SIZE } color={ colors.mutedForeground } />;
		case 'failed':
			return <CircleX size={ ICON_SIZE } color={ colors.destructive } />;
		case 'stopped':
			return <CircleStop size={ ICON_SIZE } color={ colors.mutedForeground } />;
	}
}

// A tool step as one line. Its result stays on the computer: it can be long,
// and it can hold secrets.
function ToolLine( { label, detail, state }: { label: string; detail: string; state: ToolState } ) {
	const { colors } = useTheme();

	return (
		<View style={ [ styles.line, styles.step ] }>
			<View style={ styles.icon }>{ toolIcon( state, colors ) }</View>
			<Text variant="label" numberOfLines={ 1 } style={ styles.stepText }>
				{ label }
				{ detail ? <Text color="mutedForeground">{ ` ${ detail }` }</Text> : null }
			</Text>
		</View>
	);
}

function isPicked( question: AgentQuestionRenderItem, label: string ): boolean {
	const answer = question.pickedLabel;
	if ( ! answer ) {
		return false;
	}
	return question.multiSelect ? answer.split( ', ' ).includes( label ) : answer === label;
}

// What was answered, when it is not one of the options: typed text, a skip,
// or a stop.
function otherAnswer( question: AgentQuestionRenderItem ): string | null {
	const answer = question.pickedLabel;
	if ( ! answer || question.options.some( ( option ) => isPicked( question, option.label ) ) ) {
		return null;
	}
	if ( answer === SKIPPED_QUESTION ) {
		return __( 'Skipped' );
	}
	if ( answer === STOPPED_WITHOUT_ANSWER ) {
		return __( 'Stopped without an answer' );
	}
	return answer;
}

function Questions( {
	questions,
	needsAnswer,
}: {
	questions: AgentQuestionRenderItem[];
	needsAnswer: boolean;
} ) {
	const { colors } = useTheme();
	const waiting = questions.some( ( question ) => ! question.pickedLabel );

	return (
		<View style={ [ styles.card, { borderColor: colors.border } ] }>
			{ questions.map( ( question ) => {
				const other = otherAnswer( question );
				return (
					<View key={ question.key } style={ styles.question }>
						<Text variant="bodyStrong">{ question.question }</Text>
						{ question.options.map( ( option ) => {
							const picked = isPicked( question, option.label );
							return (
								<View key={ option.label } style={ styles.option }>
									<View style={ styles.icon }>
										{ picked && <Check size={ ICON_SIZE } color={ colors.accentText } /> }
									</View>
									<View style={ styles.optionText }>
										<Text
											variant={ picked ? 'bodyStrong' : 'body' }
											color={ picked ? 'accentText' : 'foreground' }
										>
											{ option.label }
										</Text>
										{ option.description ? (
											<Text variant="caption" color="mutedForeground">
												{ option.description }
											</Text>
										) : null }
									</View>
								</View>
							);
						} ) }
						{ other && (
							<Text color="mutedForeground" style={ styles.other }>
								{ other }
							</Text>
						) }
					</View>
				);
			} ) }
			{ waiting && needsAnswer && (
				<Text variant="caption" color="mutedForeground">
					{ __( 'The agent is waiting. Answer on your computer for now.' ) }
				</Text>
			) }
		</View>
	);
}

function Note( { text, tone }: { text: string; tone: 'muted' | 'error' } ) {
	const { colors } = useTheme();
	const color = tone === 'error' ? colors.destructive : colors.mutedForeground;
	const Icon = tone === 'error' ? TriangleAlert : ImageIcon;

	return (
		<View
			style={ [ styles.line, styles.note ] }
			accessibilityRole={ tone === 'error' ? 'alert' : undefined }
		>
			<View style={ styles.icon }>
				<Icon size={ ICON_SIZE } color={ color } />
			</View>
			<Text
				color={ tone === 'error' ? 'destructive' : 'mutedForeground' }
				style={ styles.noteText }
			>
				{ text }
			</Text>
		</View>
	);
}

const styles = StyleSheet.create( {
	bubble: {
		alignSelf: 'flex-end',
		maxWidth: '85%',
		borderRadius: 18,
		paddingHorizontal: space[ 4 ],
		paddingVertical: space[ 2 ] + 2,
		marginVertical: space[ 2 ],
	},
	assistant: { marginVertical: space[ 1 ] },
	line: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space[ 2 ],
		minHeight: 32,
	},
	step: { paddingLeft: space[ 1 ] },
	stepText: { flex: 1 },
	icon: { width: 20, alignItems: 'center' },
	card: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 12,
		padding: space[ 3 ],
		gap: space[ 3 ],
		marginVertical: space[ 2 ],
	},
	question: { gap: space[ 2 ] },
	option: { flexDirection: 'row', gap: space[ 2 ] },
	optionText: { flex: 1 },
	other: { paddingLeft: 28 },
	note: { alignItems: 'flex-start', paddingVertical: space[ 1 ] },
	noteText: { flex: 1 },
} );
