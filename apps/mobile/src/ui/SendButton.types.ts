import type { LucideIcon } from 'lucide-react-native';

export interface SendButtonProps {
	icon: LucideIcon;
	// What a screen reader says. The button shows no text.
	label: string;
	disabled: boolean;
	onPress: () => void;
}
