"use client";

import { ThemeToggle as BasaltThemeToggle } from "@nocoo/basalt/components/theme-toggle";

export type ThemeToggleProps = { "aria-label"?: string };

export function ThemeToggle({ "aria-label": ariaLabel = "切换主题" }: ThemeToggleProps = {}) {
	return (
		<BasaltThemeToggle
			aria-label={ariaLabel}
			labels={{
				light: "切换为浅色主题",
				dark: "切换为深色主题",
				system: "跟随系统主题",
			}}
		/>
	);
}
