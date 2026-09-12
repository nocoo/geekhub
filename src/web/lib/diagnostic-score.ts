import type {
	ConnectionCheck,
	DiagnosticReport,
	FeedCandidate,
	FeedInspection,
} from "../../shared/contracts";

export interface DiagnosticDimension {
	id: string;
	label: string;
	weight: number;
	score: number | null;
	evidence: string;
	rule: string;
}

interface Recommendation {
	action: "keep" | "review" | "replace" | "pause";
	title: string;
	reason: string;
}

function connected(check: ConnectionCheck): boolean {
	return !check.error && check.status !== null && check.status >= 200 && check.status < 300;
}

function usable(inspection: FeedInspection): boolean {
	return connected(inspection) && inspection.entries !== null;
}

function recommend(
	report: DiagnosticReport,
	dimensions: DiagnosticDimension[],
	total: number,
	replacement: FeedCandidate | null,
): Recommendation {
	const { feed, staleAfterDays } = report;
	if (replacement)
		return {
			action: "replace",
			title: "建议核对后替换",
			reason: `当前源不可读或内容过旧；已找到可读的新地址，返回 ${replacement.inspection.entries} 条，最近内容距检查 ${replacement.inspection.ageDays} 天。请先核对内容属于同一订阅，再使用推荐地址。`,
		};
	if (!usable(feed))
		return feed.status === 404 || feed.status === 410
			? {
					action: "pause",
					title: "建议暂停并寻找新地址",
					reason: `当前 RSS 返回 HTTP ${feed.status}，尚未找到可确认的新地址。可先暂停并保留历史文章，再从主站确认新的订阅入口。`,
				}
			: {
					action: "review",
					title: "建议稍后复查",
					reason:
						"本次 RSS 请求或解析失败。限流、访问限制或临时网络故障都可能导致失败，单次检查不足以认定停更；可稍后重试或从主站重新发现。",
				};
	if (feed.entries === 0 || feed.readableEntries === 0)
		return {
			action: "review",
			title: "建议检查源内容",
			reason:
				"地址可以解析，但没有可读文章。请确认订阅路径是否正确，或从主站寻找新的 RSS；暂不建议删除已有文章。",
		};
	if (feed.ageDays !== null && feed.ageDays >= staleAfterDays)
		return {
			action: "pause",
			title: "建议确认停更后暂停",
			reason: `最近内容距检查 ${feed.ageDays} 天，超过 ${staleAfterDays} 天观察阈值，尚未验证到新鲜、可读的替代源。可查看主站，确认停更后暂停并保留文章；低频博客仍可继续订阅。`,
		};
	const unknown = dimensions.filter((dimension) => dimension.score === null);
	if (unknown.length)
		return {
			action: "review",
			title: "补充信息后再判断",
			reason: `${unknown.map((dimension) => dimension.label).join("、")}缺少依据，当前分数为暂定值。可核对文章日期、补充主站地址后重新检查，不能将未知项视为健康。`,
		};
	const weak = dimensions.filter((dimension) => dimension.score !== null && dimension.score < 80);
	if (total < 80 || weak.some((dimension) => dimension.score !== null && dimension.score < 60))
		return {
			action: "review",
			title: "建议保留并复查",
			reason: `RSS 仍有可读内容，重点关注${weak.map((dimension) => dimension.label).join("、")}。可结合下方检查结果稍后复查，暂不需要放弃订阅。`,
		};
	return {
		action: "keep",
		title: "建议保留订阅",
		reason: "RSS 可读取，内容未超过停更观察阈值，本次检查没有发现需要换源的问题。可继续订阅。",
	};
}

/** Scores describe the saved inspection, never a live uptime or editorial-quality measurement. */
export function assessDiagnostic(report: DiagnosticReport) {
	const { feed, sites, staleAfterDays } = report;
	const available = usable(feed);
	const age = feed.ageDays;
	const stale = age !== null && age >= staleAfterDays;
	const empty = feed.entries === 0 || feed.readableEntries === 0;
	const sample = Math.min(200, feed.entries ?? 0);
	const validDates = Math.max(0, (feed.entries ?? 0) - feed.undatedEntries - feed.futureEntries);
	const reachable = sites.filter(connected);
	const https = reachable.some((site) => site.finalUrl.startsWith("https:"));
	const dimensions: DiagnosticDimension[] = [
		{
			id: "availability",
			label: "RSS 可用性",
			weight: 30,
			score: available ? 100 : 0,
			evidence: available
				? `HTTP ${feed.status}，RSS / Atom 解析成功。`
				: feed.error || "未能成功获取并解析 RSS / Atom。",
			rule: "HTTP 2xx 且 RSS / Atom 解析成功得 100 分，否则 0 分。",
		},
		{
			id: "freshness",
			label: "内容新鲜度",
			weight: 30,
			score:
				age === null
					? null
					: age >= staleAfterDays * 4
						? 0
						: age >= staleAfterDays * 2
							? 10
							: stale
								? 30
								: age > 30
									? 60
									: age > 7
										? 85
										: 100,
			evidence:
				age === null
					? "没有可用于判断新鲜度的日期，不能确认是否停更。"
					: `最近内容距检查 ${age} 天；${staleAfterDays} 天为疑似停更的观察阈值。`,
			rule: `7 天内 100 分，30 天内 85 分，不足 ${staleAfterDays} 天 60 分；达到 ${staleAfterDays} / ${staleAfterDays * 2} / ${staleAfterDays * 4} 天分别为 30 / 10 / 0 分。缺少有效日期不计分。`,
		},
		{
			id: "integrity",
			label: "条目完整度",
			weight: 20,
			score: !available
				? null
				: feed.entries
					? Math.round((feed.readableEntries / sample) * 80 + (validDates / feed.entries) * 20)
					: 0,
			evidence: !available
				? "RSS 检查未成功，无法评估条目结构。"
				: `返回 ${feed.entries} 条；前 ${sample} 条中 ${feed.readableEntries} 条有标题和安全链接；全量 ${validDates} 条日期有效。`,
			rule: "可读条目比例占 80%（最多检查前 200 条），有效日期比例占 20%（全部条目）；空源 0 分。不以条目多少评价内容质量。",
		},
		{
			id: "speed",
			label: "响应速度",
			weight: 10,
			score: !available
				? null
				: feed.durationMs <= 1000
					? 100
					: feed.durationMs <= 3000
						? 85
						: feed.durationMs <= 5000
							? 60
							: feed.durationMs <= 10000
								? 30
								: 10,
			evidence: available
				? `本次获取 RSS 用时 ${feed.durationMs} ms；单次耗时不代表长期稳定性。`
				: "本次 RSS 未成功读取，失败请求的耗时不计为速度得分。",
			rule: "≤1 秒 100 分，≤3 秒 85 分，≤5 秒 60 分，≤10 秒 30 分，更慢 10 分。",
		},
		{
			id: "site",
			label: "主站可达性",
			weight: 10,
			score: !sites.length ? null : https ? 100 : reachable.length ? 60 : 0,
			evidence: !sites.length
				? "未确认主站地址，可填写网站首页后重新检查。"
				: https
					? "主站可通过 HTTPS 访问；不要求 HTTP 入口同时可用。"
					: reachable.length
						? "仅确认 HTTP 可访问，尚未确认 HTTPS 可达。"
						: "本次主站 HTTP / HTTPS 均未成功连接，可稍后复查。",
			rule: "最终到达 HTTPS 得 100 分，仅 HTTP 可达得 60 分，均失败 0 分；未知主站不计分。",
		},
	];
	const assessed = dimensions.filter((dimension) => dimension.score !== null);
	const coverage = assessed.reduce((sum, dimension) => sum + dimension.weight, 0);
	const weighted = dimensions.reduce(
		(sum, dimension) => sum + (dimension.score ?? 0) * dimension.weight,
		0,
	);
	const ceiling = !available ? 39 : empty ? 49 : stale ? 59 : 100;
	const limit = !available
		? "当前 RSS 不可用，总分上限为 39 分。"
		: empty
			? "没有可读文章，总分上限为 49 分。"
			: stale
				? "内容超过停更观察阈值，总分上限为 59 分。"
				: null;
	const total = Math.min(ceiling, Math.round(weighted / coverage));
	const freshCandidates = report.candidates
		.flatMap((candidate) => {
			const inspection = candidate.inspection;
			return usable(inspection) &&
				inspection.readableEntries > 0 &&
				inspection.entries !== 0 &&
				inspection.ageDays !== null &&
				inspection.ageDays < staleAfterDays &&
				inspection.finalUrl !== feed.finalUrl
				? [{ candidate, age: inspection.ageDays }]
				: [];
		})
		.sort((a, b) => a.age - b.age);
	const replacement = !available || empty || stale ? (freshCandidates[0]?.candidate ?? null) : null;
	return {
		total,
		coverage,
		dimensions,
		limit,
		replacement,
		recommendation: recommend(report, dimensions, total, replacement),
	};
}

export type DiagnosticAssessment = ReturnType<typeof assessDiagnostic>;
