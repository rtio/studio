import { initialAgentRunState } from '@studio/agent/protocol/transcript/run-state';
import { describe, expect, it } from 'vitest';
import { answerLabels, answerTarget, questionView, shownPicks, toggleLabel } from './question-card';

const LAYOUT = { question: 'Which layout?', options: [] };
const PAGES = { question: 'Which pages?', options: [] };
const item = { key: 'q1', question: 'Which layout?', options: [] };
const ASKING = {
	...initialAgentRunState,
	phase: 'running' as const,
	pendingQuestions: [ LAYOUT, PAGES ],
};

describe( 'questionView', () => {
	it( 'is open while the agent waits for it, with the answer picked so far', () => {
		const state = { ...ASKING, pendingAnswers: { 'Which layout?': 'Grid' } };

		expect( questionView( item, state, {} ) ).toEqual( { open: true, answer: 'Grid' } );
	} );

	it( 'shows the answer the computer saved, also when the same question waits again', () => {
		expect( questionView( { ...item, pickedLabel: 'List' }, ASKING, {} ) ).toEqual( {
			open: false,
			answer: 'List',
		} );
	} );

	it( 'shows the answer the phone sent until a read has it', () => {
		const sent = { 'Which layout?': 'Grid' };

		expect( questionView( item, initialAgentRunState, sent ) ).toEqual( {
			open: false,
			answer: 'Grid',
		} );
	} );
} );

describe( 'answerTarget', () => {
	it( 'answers the question whose own "Other" was chosen, else the first one without an answer', () => {
		const state = { ...ASKING, pendingAnswers: { 'Which layout?': 'Grid' } };

		expect( answerTarget( state, null ) ).toBe( 'Which pages?' );
		expect( answerTarget( state, 'Which layout?' ) ).toBe( 'Which layout?' );
		expect( answerTarget( state, 'An old question' ) ).toBe( 'Which pages?' );
		expect( answerTarget( initialAgentRunState, null ) ).toBeNull();
	} );
} );

describe( 'answerLabels and toggleLabel', () => {
	it( 'splits a multiple-choice answer, and adds or takes out a label', () => {
		expect( answerLabels( { multiSelect: true }, 'Home, Blog' ) ).toEqual( [ 'Home', 'Blog' ] );
		expect( answerLabels( {}, 'Home, Blog' ) ).toEqual( [ 'Home, Blog' ] );
		expect( answerLabels( { multiSelect: true }, undefined ) ).toEqual( [] );
		expect( toggleLabel( [ 'Home' ], 'Blog' ) ).toEqual( [ 'Home', 'Blog' ] );
		expect( toggleLabel( [ 'Home', 'Blog' ], 'Home' ) ).toEqual( [ 'Blog' ] );
	} );
} );

describe( 'shownPicks', () => {
	const multi = { multiSelect: true };

	it( 'shows the picks not sent yet while the question is open', () => {
		expect( shownPicks( multi, { open: true, answer: undefined }, [ 'Home' ] ) ).toEqual( [
			'Home',
		] );
		expect( shownPicks( multi, { open: true, answer: 'Blog' }, undefined ) ).toEqual( [ 'Blog' ] );
	} );

	it( 'shows what was answered once the question is closed, whatever was picked before', () => {
		expect( shownPicks( multi, { open: false, answer: 'Blog' }, [ 'Home', 'About' ] ) ).toEqual( [
			'Blog',
		] );
	} );
} );
