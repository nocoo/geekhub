import { z } from "zod";

export const categoryInput = z
	.object({
		name: z.string().trim().min(1).max(60),
		color: z
			.union([
				z.enum(["green", "blue", "amber", "violet", "rose"]),
				z.string().regex(/^#[0-9a-fA-F]{6}$/),
			])
			.default("green"),
		icon: z.string().trim().max(8).optional(),
		sort_order: z.number().int().min(0).max(10000).optional(),
	})
	.strict();
export const feedInput = z
	.object({
		url: z.string().trim().min(1).max(2048),
		title: z.string().trim().max(200).optional(),
		category_id: z.string().min(1).max(100).nullable().optional(),
	})
	.strict();
export const feedUpdate = z
	.object({
		url: z.string().trim().min(1).max(2048).optional(),
		site_url: z.string().trim().max(2048).optional(),
		title: z.string().trim().min(1).max(200).optional(),
		category_id: z.string().min(1).max(100).nullable().optional(),
		auto_translate: z.boolean().optional(),
		is_active: z.boolean().optional(),
		refresh_minutes: z.number().int().min(15).max(1440).optional(),
	})
	.strict()
	.refine((v) => Object.keys(v).length > 0, "至少修改一项设置");
export const orderInput = z
	.object({
		ids: z
			.array(z.string().min(1).max(100))
			.min(1)
			.max(500)
			.refine((ids) => new Set(ids).size === ids.length, "排序不能包含重复项目"),
	})
	.strict();
export const feedOrderInput = orderInput
	.extend({
		feedId: z.string().min(1).max(100).optional(),
		categoryId: z.string().min(1).max(100).nullable().optional(),
	})
	.refine(
		(value) => (value.feedId === undefined) === (value.categoryId === undefined),
		"移动订阅需要指定分类",
	);
export const diagnosticInput = z
	.object({
		siteUrl: z.string().trim().min(1).max(2048).optional(),
	})
	.strict();
export const articleUpdate = z
	.object({
		is_read: z.boolean().optional(),
		is_starred: z.boolean().optional(),
		is_later: z.boolean().optional(),
	})
	.strict()
	.refine((v) => Object.keys(v).length > 0, "至少修改一项阅读状态");
export const preferencesInput = z
	.object({
		theme: z.enum(["dark", "light", "system"]).optional(),
		fontSize: z.number().int().min(14).max(24).optional(),
		fontFamily: z.enum(["serif", "sans"]).optional(),
		showImages: z.boolean().optional(),
		rsshubUrl: z.string().trim().min(1).max(2048).optional(),
	})
	.strict();
export const aiInput = z
	.object({
		provider: z.string().trim().min(1).max(100).optional(),
		apiKey: z.string().trim().max(4096).optional(),
		model: z.string().trim().min(1).max(200).optional(),
		baseURL: z.string().trim().max(2048).optional(),
		sdkType: z.enum(["openai", "anthropic"]).optional(),
		authType: z.enum(["apiKey", "bearer"]).optional(),
	})
	.strict();
export const aiActionInput = z
	.object({
		action: z.enum(["summary", "translate", "translate-title"]),
		force: z.boolean().default(false),
	})
	.strict();
export const cleanupInput = z
	.object({
		days: z.number().int().min(1).max(3650),
		feedId: z.string().max(100).optional(),
		onlyRead: z.boolean().default(true),
	})
	.strict();
export const markReadInput = z
	.object({ feedId: z.string().max(100).optional(), categoryId: z.string().max(100).optional() })
	.strict();
export const cursorSchema = z.object({
	date: z.string().datetime(),
	id: z.string().min(1).max(100),
});

export function encodeCursor(date: string, id: string): string {
	return btoa(JSON.stringify({ date, id }));
}
export function decodeCursor(cursor: string) {
	return cursorSchema.parse(JSON.parse(atob(cursor)));
}

export function publicUrl(input: string): URL {
	const url = new URL(input);
	const host = url.hostname.toLowerCase();
	if (
		!/^https?:$/.test(url.protocol) ||
		url.username ||
		url.password ||
		!host.includes(".") ||
		host.startsWith("[") ||
		/^\d+(?:\.\d+){3}$/.test(host) ||
		/\.(?:localhost|local|internal|test|invalid|onion)$/.test(host)
	) {
		throw new Error("请使用公开网站的 HTTP 或 HTTPS 地址");
	}
	url.hash = "";
	return url;
}

export function resolveFeedUrl(input: string, rsshubUrl: string): string {
	if (!input.startsWith("rsshub://")) return publicUrl(input).href;
	const route = input.slice("rsshub://".length).replace(/^\/+/, "");
	if (!route || route.includes("..")) throw new Error("RSSHub 路由不能为空或包含上级路径");
	const slash = route.indexOf("/");
	if (slash > 0 && route.slice(0, slash).includes(".")) return publicUrl(`https://${route}`).href;
	const base = publicUrl(rsshubUrl);
	return publicUrl(`${base.href.replace(/\/+$/, "")}/${route}`).href;
}
