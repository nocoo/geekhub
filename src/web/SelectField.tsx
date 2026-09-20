import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@nocoo/basalt/components/select";
import type { ReactNode } from "react";

/** Shared form layout; selection, keyboard navigation and form submission belong to Basalt. */
export function SelectField({
	options,
	id,
	label,
	name,
	value,
	defaultValue,
	onValueChange,
	disabled,
}: {
	options: { value: string; label: ReactNode }[];
	id?: string;
	label: string;
	name?: string;
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	disabled?: boolean;
}) {
	return (
		<Select
			name={name}
			value={value}
			defaultValue={defaultValue}
			onValueChange={onValueChange}
			disabled={disabled}
		>
			<SelectTrigger id={id} aria-label={label} className="select-control">
				<SelectValue />
			</SelectTrigger>
			<SelectContent className="select-options">
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
