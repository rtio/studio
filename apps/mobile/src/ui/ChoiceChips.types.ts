export interface ChoiceChipsProps {
	// What a screen reader says for the whole set.
	label: string;
	options: ReadonlyArray< { value: string; label: string } >;
	value: string | null;
	onChange: ( value: string ) => void;
}
