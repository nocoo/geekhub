"use client";

import { ProjectLinks } from "@nocoo/basalt/components/app-header";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@nocoo/basalt/components/tooltip";
import type { ReactElement } from "react";

export function HeaderTooltip({ label, children }: { label: string; children: ReactElement }) {
	return (
		<TooltipProvider delayDuration={0}>
			<Tooltip>
				<TooltipTrigger asChild>{children}</TooltipTrigger>
				<TooltipContent side="bottom" sideOffset={6}>
					{label}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export function GeekHubLinks() {
	return (
		<ProjectLinks
			github="nocoo/geekhub"
			hexly="geekhub"
			name="GeekHub"
			githubLabel="GeekHub GitHub 项目"
			hexlyLabel="GeekHub on hexly.ai"
		/>
	);
}
