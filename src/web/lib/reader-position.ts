import { type RefObject, useLayoutEffect } from "react";
import { readReadingPosition, saveReadingPosition } from "./reader-navigation";

export function useReadingPosition(
	ref: RefObject<HTMLElement | null>,
	key: string,
	ready: boolean,
	contentSelector?: string,
) {
	useLayoutEffect(() => {
		const element = ref.current;
		if (!ready || !element) return;
		const position = readReadingPosition(key);
		let restoring = true;
		const restore = () => {
			if (
				!restoring ||
				!element.clientHeight ||
				(contentSelector && !element.querySelector(contentSelector))
			)
				return;
			element.scrollTop = position.top;
			if (
				element.scrollTop >= position.top - 1 ||
				Array.from(element.querySelectorAll("img")).every((image) => image.complete)
			) {
				restoring = false;
				observer.disconnect();
			}
		};
		const observer = new ResizeObserver(restore);
		observer.observe(element.firstElementChild ?? element);
		const save = () => {
			if (!restoring && element.clientHeight) saveReadingPosition(key, { top: element.scrollTop });
		};
		const interrupt = () => {
			restoring = false;
			observer.disconnect();
			save();
		};
		restore();
		element.addEventListener("scroll", save, { passive: true });
		element.addEventListener("load", restore, true);
		const interactions = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
		for (const event of interactions) element.addEventListener(event, interrupt, { passive: true });
		window.addEventListener("pagehide", save);
		return () => {
			save();
			observer.disconnect();
			element.removeEventListener("scroll", save);
			element.removeEventListener("load", restore, true);
			for (const event of interactions) element.removeEventListener(event, interrupt);
			window.removeEventListener("pagehide", save);
		};
	}, [ref, key, ready, contentSelector]);
}
