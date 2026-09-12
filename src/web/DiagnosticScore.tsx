import { Button, LayerCard } from "@nocoo/basalt";
import { ArrowDown } from "lucide-react";
import { useId } from "react";
import type { DiagnosticAssessment, DiagnosticDimension } from "./lib/diagnostic-score";

function ScoreRadar({ dimensions }: { dimensions: DiagnosticDimension[] }) {
	const titleId = useId();
	const axes = dimensions.map((dimension, index) => {
		const angle = (index * 2 * Math.PI) / dimensions.length - Math.PI / 2;
		return { ...dimension, x: Math.cos(angle), y: Math.sin(angle) };
	});
	const point = (axis: (typeof axes)[number], radius: number) =>
		`${150 + axis.x * radius},${130 + axis.y * radius}`;
	const complete = axes.every((axis) => axis.score !== null);
	return (
		<figure className="score-radar">
			<svg viewBox="0 0 300 260" role="img" aria-labelledby={titleId}>
				<title id={titleId}>
					诊断维度雷达图：
					{axes
						.map((axis) => `${axis.label} ${axis.score === null ? "未知" : `${axis.score} 分`}`)
						.join("，")}
				</title>
				{[25, 50, 75, 100].map((level) => (
					<polygon
						key={level}
						points={axes.map((axis) => point(axis, level * 0.78)).join(" ")}
						className="score-radar-grid"
					/>
				))}
				{axes.map((axis) => (
					<line
						key={axis.id}
						x1="150"
						y1="130"
						x2={150 + axis.x * 78}
						y2={130 + axis.y * 78}
						className="score-radar-grid"
					/>
				))}
				{complete && (
					<polygon
						points={axes.map((axis) => point(axis, (axis.score ?? 0) * 0.78)).join(" ")}
						className="score-radar-area"
					/>
				)}
				{axes.map((axis) => (
					<g key={axis.id}>
						{axis.score !== null && (
							<circle
								cx={150 + axis.x * axis.score * 0.78}
								cy={130 + axis.y * axis.score * 0.78}
								r="3"
								className="score-radar-point"
							/>
						)}
						<text x={150 + axis.x * 110} y={130 + axis.y * 110} textAnchor="middle">
							<tspan>{axis.label}</tspan>
							<tspan x={150 + axis.x * 110} dy="15">
								{axis.score === null ? "未知" : axis.score}
							</tspan>
						</text>
					</g>
				))}
			</svg>
			<figcaption>外圈为 100 分{complete ? "" : " · 未知项不绘点，不填充面积"}</figcaption>
		</figure>
	);
}

export function DiagnosticScore({
	assessment,
	onShowReplacement,
}: {
	assessment: DiagnosticAssessment;
	onShowReplacement: () => void;
}) {
	const { total, coverage, dimensions, recommendation, replacement, limit } = assessment;
	return (
		<LayerCard
			className="diagnostic-card diagnostic-score"
			data-recommendation={recommendation.action}
		>
			<div className="score-overview">
				<div className="score-total">
					<span>{coverage === 100 ? "综合评分" : "暂定评分"}</span>
					<output data-testid="diagnostic-total" aria-label={`总分 ${total}，满分 100`}>
						{total}
						<small>/ 100</small>
					</output>
					<span>
						已评估 {dimensions.filter((dimension) => dimension.score !== null).length} /{" "}
						{dimensions.length} 项
					</span>
				</div>
				<div className="score-recommendation">
					<h3>{recommendation.title}</h3>
					<p>{recommendation.reason}</p>
					{replacement && (
						<Button size="sm" variant="outline" onClick={onShowReplacement}>
							查看推荐地址 <ArrowDown size={13} />
						</Button>
					)}
				</div>
			</div>
			<div className="score-breakdown">
				<ScoreRadar dimensions={dimensions} />
				<dl className="score-dimensions" aria-label="诊断分项评分">
					{dimensions.map((dimension) => (
						<div key={dimension.id}>
							<dt>
								{dimension.label}
								<span>权重 {dimension.weight}%</span>
							</dt>
							<dd>
								<div className="score-dimension-value">
									<div className="score-track" aria-hidden="true">
										{dimension.score !== null && <span style={{ width: `${dimension.score}%` }} />}
									</div>
									<strong>{dimension.score === null ? "未知" : `${dimension.score} / 100`}</strong>
								</div>
								<p>{dimension.evidence}</p>
							</dd>
						</div>
					))}
				</dl>
			</div>
			{limit && <p className="diagnostic-warning">{limit}</p>}
			<details className="score-rules">
				<summary>评分规则与依据</summary>
				<p>
					总分为各维度按权重计算的平均分，再应用评分上限。本次已知项覆盖 {coverage}% 权重；
					未知项不算作 0 分，剩余权重按比例计算，结果标为暂定评分。
				</p>
				<ul>
					{dimensions.map((dimension) => (
						<li key={dimension.id}>
							<strong>{dimension.label}：</strong>
							{dimension.rule}
						</li>
					))}
				</ul>
				<p>
					评分对应报告的检查时间，反映本次可用性，不评价内容质量或长期在线率。低频博客请结合主站判断。
				</p>
			</details>
		</LayerCard>
	);
}
