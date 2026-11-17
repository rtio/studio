export interface ChoiceRowProps< Value extends string > {
	// What a screen reader says for the whole control.
	label: string;
	options: ReadonlyArray< { value: Value; label: string } >;
	value: Value;
	onChange: ( value: Value ) => void;
}
