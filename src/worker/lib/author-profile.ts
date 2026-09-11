import { z } from "zod";
import type { Session, User } from "../../shared/contracts";
import { publicUrl } from "../../shared/validation";
import { readBounded, userAgent } from "./network";

const profileSchema = z.object({
	name: z.string().trim().max(120).nullish(),
	avatar: z.string().trim().nullish(),
});

export async function withAuthorProfile(user: User): Promise<Session["user"]> {
	const fallback = { ...user, avatarUrl: null };
	try {
		const digest = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(user.email.trim().toLowerCase()),
		);
		const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join(
			"",
		);
		// Only the normalized email hash leaves the Worker, matching Lyre's public profile contract.
		const response = await fetch(`https://lizheng.blog/api/authors/profile?hash=${hash}`, {
			headers: { Accept: "application/json", "User-Agent": userAgent },
			redirect: "error",
			signal: AbortSignal.timeout(2500),
			cf: { cacheTtl: 300, cacheEverything: true },
		});
		if (!response.ok) {
			await response.body?.cancel();
			return fallback;
		}
		const profile = profileSchema.parse(
			JSON.parse(new TextDecoder().decode(await readBounded(response, 16 * 1024))),
		);
		return {
			...user,
			name: profile.name || user.name,
			avatarUrl: profile.avatar ? publicUrl(profile.avatar).href : null,
		};
	} catch {
		return fallback;
	}
}
