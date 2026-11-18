import {
	findOwnFreeFormOptionLabel,
	SKIPPED_QUESTION,
	STOPPED_WITHOUT_ANSWER,
} from '@studio/agent/protocol/tools';
import { replaceEqualDeep } from '@tanstack/react-query';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	Check,
	ChevronDown,
	ChevronRight,
	Circle,
	CircleStop,
	CircleX,
	ImageIcon,
	Square,
	TriangleAlert,
} from 'lucide-react-native';
import { memo, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { runControl } from '../../data/live-connection';
import { useRunState, useSentAnswers } from '../../data/use-run';
import { space } from '../../theme/typography';
import { useTheme } from '../../theme/use-theme';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Spinner';
import { Text } from '../../ui/Text';
import { Markdown } from './Markdown';
import { armQuestion, disarmQuestion, useArmedQuestion } from './armed-question';
import { answerLabels, questionView, shownPicks, toggleLabel } from './question-card';
import type { ChatRow, ToolState } from '../../data/chat-rows';
import type { ThemeColors } from '../../theme/theme';
import type { AgentQuestionRenderItem } from '@studio/agent/protocol/transcript/transcript-items';

const ICON_SIZE = 16;

interface ChatRowViewProps {
	row: ChatRow;
	chatId: string;
	onToggleTurn: ( key: string ) => void;
}

// Rows are built again on each draw while the agent writes. A row whose
// content did not change does not draw again.
function sameRow( before: ChatRowViewProps, after: ChatRowViewProps ): boolean {
	return (
		before.chatId === after.chatId &&
		before.onToggleTurn === after.onToggleTurn &&
		replaceEqualDeep( before.row, after.row ) === before.row
	);
}

// One row of the chat.
export const ChatRowView = memo( function ChatRowView( {
	row,
	chatId,
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
			return <Questions chatId={ chatId } questions={ row.questions } />;
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

// What was answered, when it is not one of the options: typed text, a skip,
// or a stop.
function otherAnswer(
	question: AgentQuestionRenderItem,
	answer: string | undefined
): string | null {
	const labels = answerLabels( question, answer );
	if ( ! answer || question.options.some( ( option ) => labels.includes( option.label ) ) ) {
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

// The questions of one batch. While the agent waits, each option is a button:
// one tap answers a single-choice question; a multiple-choice one takes its
// picks with Done. The model's own "Other" option lets the person type the
// answer in the composer. The answers go to the computer together once every
// question has one.
function Questions( {
	chatId,
	questions,
}: {
	chatId: string;
	questions: AgentQuestionRenderItem[];
} ) {
	const { colors } = useTheme();
	const state = useRunState( chatId );
	const sent = useSentAnswers( chatId );
	const armed = useArmedQuestion( chatId );
	// The picks of a multiple-choice question before Done, by question.
	const [ drafts, setDrafts ] = useState< Record< string, string[] > >( {} );
	// An answer from anywhere (the composer too) is done with the picks of
	// its question.
	const answeredBefore = useRef( state.pendingAnswers );
	useEffect( () => {
		const before = answeredBefore.current;
		answeredBefore.current = state.pendingAnswers;
		const answered = Object.keys( state.pendingAnswers ).filter(
			( question ) => state.pendingAnswers[ question ] !== before[ question ]
		);
		if ( answered.length > 0 ) {
			setDrafts( ( current ) => {
				const next = { ...current };
				answered.forEach( ( question ) => delete next[ question ] );
				return next;
			} );
		}
	}, [ state.pendingAnswers ] );
	const views = questions.map( ( question ) => questionView( question, state, sent ) );

	return (
		<View style={ [ styles.card, { borderColor: colors.border } ] }>
			{ questions.map( ( question, index ) => {
				const { open, answer } = views[ index ];
				const freeForm = findOwnFreeFormOptionLabel( question.options );
				const picks = shownPicks( question, views[ index ], drafts[ question.question ] );
				const other = otherAnswer( question, answer );

				// Sends an answer. The picks not sent yet are done with.
				const send = ( value: string ) => {
					setDrafts( ( { [ question.question ]: _sent, ...rest } ) => rest );
					runControl.answer( chatId, question.question, value );
				};

				const pick = ( label: string ) => {
					if ( label === freeForm ) {
						runControl.clearAnswer( chatId, question.question );
						armQuestion( chatId, question.question );
						return;
					}
					if ( armed === question.question ) {
						disarmQuestion();
					}
					if ( question.multiSelect ) {
						setDrafts( ( current ) => ( {
							...current,
							[ question.question ]: toggleLabel( picks, label ),
						} ) );
						return;
					}
					send( label );
				};

				return (
					<View key={ question.key } style={ styles.question }>
						<Text variant="bodyStrong">{ question.question }</Text>
						{ open && question.multiSelect && (
							<Text variant="caption" color="mutedForeground">
								{ __( 'Pick all that apply.' ) }
							</Text>
						) }
						{ question.options.map( ( option ) => {
							const picked =
								picks.includes( option.label ) ||
								( open && armed === question.question && option.label === freeForm );
							const content = (
								<>
									<View style={ styles.icon }>
										{ picked && <Check size={ ICON_SIZE } color={ colors.accentText } /> }
										{ ! picked &&
											open &&
											( question.multiSelect ? (
												<Square size={ ICON_SIZE } color={ colors.mutedForeground } />
											) : (
												<Circle size={ ICON_SIZE } color={ colors.mutedForeground } />
											) ) }
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
								</>
							);
							if ( ! open ) {
								return (
									<View key={ option.label } style={ styles.option }>
										{ content }
									</View>
								);
							}
							return (
								<Pressable
									key={ option.label }
									accessibilityRole={ question.multiSelect ? 'checkbox' : 'radio' }
									accessibilityState={ { checked: picked } }
									onPress={ () => pick( option.label ) }
									style={ [ styles.option, styles.choice ] }
								>
									{ content }
								</Pressable>
							);
						} ) }
						{ other && (
							<Text color="mutedForeground" style={ styles.other }>
								{ other }
							</Text>
						) }
						{ open && (
							<View style={ styles.actions }>
								{ question.multiSelect && (
									<Button
										label={ __( 'Done' ) }
										onPress={ () =>
											send( picks.length > 0 ? picks.join( ', ' ) : SKIPPED_QUESTION )
										}
									/>
								) }
								<Button
									variant="secondary"
									label={ __( 'Skip' ) }
									onPress={ () => send( SKIPPED_QUESTION ) }
								/>
							</View>
						) }
					</View>
				);
			} ) }
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
	choice: { minHeight: 44, alignItems: 'center' },
	actions: { flexDirection: 'row', gap: space[ 2 ] },
	optionText: { flex: 1 },
	other: { paddingLeft: 28 },
	note: { alignItems: 'flex-start', paddingVertical: space[ 1 ] },
	noteText: { flex: 1 },
} );
