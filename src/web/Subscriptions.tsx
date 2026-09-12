import { Badge, Button, Input, LayerCard } from "@nocoo/basalt";
import { ArrowDown, ArrowUp, Bug, GripVertical, Pencil, Plus, Rss, Trash2 } from "lucide-react";
import { type DragEvent, useState } from "react";
import type { Category, Feed } from "../shared/contracts";
import { moveBefore, type Save } from "./lib/panels-view-model";
import { dateLabel } from "./lib/reader";

interface Props {
	feeds: Feed[];
	categories: Category[];
	pending: boolean;
	save: Save;
	remove: (path: string, name: string, description: string) => Promise<void>;
}
const colors = { green: "绿色", blue: "蓝色", amber: "琥珀", violet: "紫色", rose: "玫红" };

function OrderControls({
	name,
	index,
	count,
	disabled,
	onMove,
	onDragStart,
	onDragEnd,
}: {
	name: string;
	index: number;
	count: number;
	disabled: boolean;
	onMove: (direction: 1 | -1) => void;
	onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
	onDragEnd?: () => void;
}) {
	return (
		<div className="order-controls">
			<Button
				variant="ghost"
				size="icon"
				className="drag-handle"
				draggable={!disabled}
				disabled={disabled}
				aria-label={`拖动排序 ${name}`}
				title="拖动排序，也可使用上下按钮"
				onDragStart={onDragStart}
				onDragEnd={onDragEnd}
			>
				<GripVertical size={15} />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				disabled={disabled || index === 0}
				aria-label={`上移 ${name}`}
				onClick={() => onMove(-1)}
			>
				<ArrowUp size={12} />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				disabled={disabled || index === count - 1}
				aria-label={`下移 ${name}`}
				onClick={() => onMove(1)}
			>
				<ArrowDown size={12} />
			</Button>
		</div>
	);
}

export function Subscriptions({
	feeds,
	categories,
	pending,
	save,
	remove,
	onAdd,
	onDiagnose,
}: Props & { onAdd: () => void; onDiagnose: (feed: Feed) => void }) {
	const [search, setSearch] = useState("");
	const [editing, setEditing] = useState<string | null>(null);
	const [dragging, setDragging] = useState<string | null>(null);
	const matches = feeds.filter((feed) =>
		`${feed.title} ${feed.url}`.toLowerCase().includes(search.trim().toLowerCase()),
	);
	const groups = [
		...categories.map((category) => ({
			id: category.id,
			name: category.name,
			color: category.color,
		})),
		{ id: null, name: "未分类", color: "green" },
	];
	const orderDisabled = pending || Boolean(search.trim());
	const order = async (id: string, before: string | null, categoryId: string | null) => {
		setDragging(null);
		await save("/feeds/reorder", "POST", {
			ids: moveBefore(
				feeds.map((feed) => feed.id),
				id,
				before,
			),
			feedId: id,
			categoryId,
		});
	};
	const drop = (event: DragEvent, before: string | null, categoryId: string | null) => {
		const id = event.dataTransfer.getData("application/x-geekhub-feed");
		if (!id || orderDisabled || !feeds.some((feed) => feed.id === id)) return;
		event.preventDefault();
		event.stopPropagation();
		void order(id, before, categoryId);
	};
	return (
		<div className="form-stack subscription-manager">
			<div className="subscription-tools">
				<Input
					aria-label="筛选订阅源"
					placeholder="按名称或地址筛选…"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
				/>
				<Button size="sm" onClick={onAdd}>
					<Plus size={14} />
					添加订阅
				</Button>
			</div>
			<p className="field-hint">
				拖动手柄调整顺序，拖入其他分类即可移动。上下按钮也支持键盘和触屏操作。
				{search.trim() && " 清除筛选后可排序。"}
			</p>
			{!feeds.length && (
				<div className="empty-state">
					<Rss size={24} />
					<p>添加一个喜欢的网站，开始订阅。</p>
				</div>
			)}
			{feeds.length > 0 && !matches.length && <p className="empty-state">没有匹配的订阅源。</p>}
			{groups.map((group) => {
				const rows = matches.filter((feed) => feed.category_id === group.id);
				if (search.trim() && !rows.length) return null;
				return (
					<section
						key={group.id ?? "uncategorized"}
						className={`subscription-group ${dragging ? "accepts-drop" : ""}`}
						aria-label={`订阅分类 ${group.name}`}
						data-category-id={group.id ?? ""}
						onDragOver={(event) => {
							if (!orderDisabled && event.dataTransfer.types.includes("application/x-geekhub-feed"))
								event.preventDefault();
						}}
						onDrop={(event) => drop(event, null, group.id)}
					>
						<div className="subscription-group-title">
							<span
								className={`category-dot ${group.color}`}
								style={{ backgroundColor: group.color.startsWith("#") ? group.color : undefined }}
							/>
							<h3>{group.name}</h3>
							<span>{rows.length}</span>
						</div>
						<ul className="manage-list">
							{rows.map((feed, index) => (
								<li
									key={feed.id}
									data-feed-id={feed.id}
									className={dragging === feed.id ? "is-dragging" : ""}
									onDrop={(event) => {
										const bounds = event.currentTarget.getBoundingClientRect();
										drop(
											event,
											event.clientY > bounds.top + bounds.height / 2
												? (rows[index + 1]?.id ?? null)
												: feed.id,
											group.id,
										);
									}}
								>
									<LayerCard className="manage-feed">
										<div className="manage-feed-heading">
											<OrderControls
												name={feed.title}
												index={index}
												count={rows.length}
												disabled={orderDisabled}
												onMove={(direction) =>
													void order(
														feed.id,
														rows[index + (direction === 1 ? 2 : -1)]?.id ?? null,
														group.id,
													)
												}
												onDragEnd={() => setDragging(null)}
												onDragStart={(event) => {
													event.dataTransfer.setData("application/x-geekhub-feed", feed.id);
													event.dataTransfer.effectAllowed = "move";
													setDragging(feed.id);
												}}
											/>
											<div className="subscription-identity">
												<strong>{feed.title}</strong>
												<small title={feed.url}>{feed.url}</small>
											</div>
											<Button
												variant="ghost"
												size="icon"
												aria-label={`编辑 ${feed.title}`}
												aria-expanded={editing === feed.id}
												onClick={() => setEditing(editing === feed.id ? null : feed.id)}
											>
												<Pencil size={15} />
											</Button>
										</div>
										<div className="subscription-status">
											<span>
												{feed.total_count} 篇文章 · {feed.unread_count} 篇未读
											</span>
											<Badge>
												{!feed.is_active
													? "已暂停"
													: feed.status === "error"
														? "需要检查"
														: feed.status === "queued" || feed.status === "fetching"
															? "正在更新"
															: "定时更新"}
											</Badge>
											{Boolean(feed.auto_translate) && <Badge>自动翻译</Badge>}
										</div>
										{feed.last_error && <p className="inline-error">{feed.last_error}</p>}
										<div className="subscription-actions">
											<span>
												{feed.last_fetched_at
													? `${dateLabel(feed.last_fetched_at)}检查成功`
													: "尚未成功更新"}
											</span>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => onDiagnose(feed)}
												aria-label={`诊断 ${feed.title}`}
											>
												<Bug size={13} />
												检查源
											</Button>
											<Button
												variant="ghost"
												size="icon"
												disabled={pending}
												aria-label={`删除 ${feed.title}`}
												onClick={() =>
													void remove(
														`/feeds/${feed.id}`,
														`「${feed.title}」`,
														"该订阅及其中的文章、收藏和稍后阅读记录将一并删除。此操作不可撤销。",
													)
												}
											>
												<Trash2 size={14} />
											</Button>
										</div>
										{editing === feed.id && (
											<FeedEditor
												feed={feed}
												categories={categories}
												pending={pending}
												save={save}
												onDone={() => setEditing(null)}
											/>
										)}
									</LayerCard>
								</li>
							))}
						</ul>
						{!rows.length && <p className="category-drop-hint">可以把订阅拖到这里</p>}
					</section>
				);
			})}
		</div>
	);
}

function FeedEditor({
	feed,
	categories,
	pending,
	save,
	onDone,
}: {
	feed: Feed;
	categories: Category[];
	pending: boolean;
	save: Save;
	onDone: () => void;
}) {
	return (
		<form
			className="form-stack feed-edit"
			onSubmit={(event) => {
				event.preventDefault();
				const data = new FormData(event.currentTarget);
				void save(
					`/feeds/${feed.id}`,
					"PATCH",
					{
						title: data.get("title"),
						url: data.get("url"),
						site_url: data.get("site"),
						category_id: data.get("category") || null,
						refresh_minutes: Number(data.get("refresh")),
						auto_translate: data.get("translate") === "on",
						is_active: data.get("active") === "on",
					},
					onDone,
				);
			}}
		>
			<label className="field-label" htmlFor={`feed-title-${feed.id}`}>
				订阅名称
				<Input
					id={`feed-title-${feed.id}`}
					name="title"
					required
					maxLength={200}
					defaultValue={feed.title}
				/>
			</label>
			<label className="field-label" htmlFor={`feed-url-${feed.id}`}>
				RSS 地址
				<Input
					id={`feed-url-${feed.id}`}
					name="url"
					required
					maxLength={2048}
					defaultValue={feed.url}
				/>
			</label>
			<p className="field-hint">
				支持 RSS、Atom 和 rsshub://。修改地址会保留文章、收藏和稍后阅读。
			</p>
			<label className="field-label" htmlFor={`feed-site-${feed.id}`}>
				主站地址
				<Input
					id={`feed-site-${feed.id}`}
					name="site"
					type="url"
					maxLength={2048}
					defaultValue={feed.site_url}
					placeholder="https://example.com"
				/>
			</label>
			<div className="form-grid">
				<label className="field-label" htmlFor={`feed-category-${feed.id}`}>
					分类
					<select
						id={`feed-category-${feed.id}`}
						name="category"
						aria-label="分类"
						className="select-control"
						defaultValue={feed.category_id ?? ""}
					>
						<option value="">未分类</option>
						{categories.map((category) => (
							<option value={category.id} key={category.id}>
								{category.name}
							</option>
						))}
					</select>
				</label>
				<label className="field-label" htmlFor={`feed-refresh-${feed.id}`}>
					刷新间隔
					<select
						id={`feed-refresh-${feed.id}`}
						name="refresh"
						aria-label="刷新间隔"
						className="select-control"
						defaultValue={feed.refresh_minutes}
					>
						{[...new Set([15, 30, 60, 180, 360, 720, 1440, feed.refresh_minutes])]
							.sort((a, b) => a - b)
							.map((minutes) => (
								<option key={minutes} value={minutes}>
									{minutes < 60 ? `${minutes} 分钟` : `${minutes / 60} 小时`}
								</option>
							))}
					</select>
				</label>
			</div>
			<label className="checkbox-label">
				<input type="checkbox" name="translate" defaultChecked={Boolean(feed.auto_translate)} />
				自动翻译标题和简介
			</label>
			<label className="checkbox-label">
				<input type="checkbox" name="active" defaultChecked={Boolean(feed.is_active)} />
				定时更新订阅
			</label>
			<div className="form-actions">
				<Button variant="ghost" type="button" onClick={onDone}>
					取消
				</Button>
				<Button type="submit" disabled={pending}>
					{pending ? "保存中…" : "保存订阅"}
				</Button>
			</div>
		</form>
	);
}

function ColorSelect({ color, label }: { color: string; label: string }) {
	return (
		<select className="select-control" name="color" defaultValue={color} aria-label={label}>
			{Object.entries(colors).map(([value, name]) => (
				<option value={value} key={value}>
					{name}
				</option>
			))}
			{color.startsWith("#") && <option value={color}>{color}</option>}
		</select>
	);
}

export function Categories({ categories, feeds, pending, save, remove }: Props) {
	const ids = categories.map((category) => category.id);
	const order = (id: string, before: string | null) =>
		void save("/categories/reorder", "POST", { ids: moveBefore(ids, id, before) });
	return (
		<div className="form-stack">
			<form
				className="category-create"
				onSubmit={(event) => {
					event.preventDefault();
					const form = event.currentTarget;
					const data = new FormData(form);
					void save(
						"/categories",
						"POST",
						{ name: data.get("name"), color: data.get("color") },
						() => form.reset(),
					);
				}}
			>
				<Input
					name="name"
					aria-label="新分类名称"
					placeholder="新分类名称"
					required
					maxLength={60}
				/>
				<ColorSelect color="green" label="新分类颜色" />
				<Button type="submit" disabled={pending}>
					<Plus size={14} />
					添加分类
				</Button>
			</form>
			<p className="field-hint">分类顺序会同步到左侧导航。删除分类后，其中的订阅会移到未分类。</p>
			<ul className="manage-list">
				{categories.map((category, index) => (
					<li
						key={category.id}
						data-category-order-id={category.id}
						onDragOver={(event) => {
							if (!pending && event.dataTransfer.types.includes("application/x-geekhub-category"))
								event.preventDefault();
						}}
						onDrop={(event) => {
							const id = event.dataTransfer.getData("application/x-geekhub-category");
							if (!pending && ids.includes(id)) {
								event.preventDefault();
								const bounds = event.currentTarget.getBoundingClientRect();
								order(
									id,
									event.clientY > bounds.top + bounds.height / 2
										? (ids[index + 1] ?? null)
										: category.id,
								);
							}
						}}
					>
						<LayerCard className="category-editor">
							<div className="category-editor-heading">
								<OrderControls
									name={`分类 ${category.name}`}
									index={index}
									count={categories.length}
									disabled={pending}
									onMove={(direction) =>
										order(category.id, ids[index + (direction === 1 ? 2 : -1)] ?? null)
									}
									onDragStart={(event) => {
										event.dataTransfer.setData("application/x-geekhub-category", category.id);
										event.dataTransfer.effectAllowed = "move";
									}}
								/>
								<span>
									{feeds.filter((feed) => feed.category_id === category.id).length} 个订阅
								</span>
							</div>
							<form
								className="category-row"
								onSubmit={(event) => {
									event.preventDefault();
									const data = new FormData(event.currentTarget);
									void save(`/categories/${category.id}`, "PATCH", {
										name: data.get("name"),
										color: data.get("color"),
										icon: data.get("icon"),
									});
								}}
							>
								<Input
									name="name"
									aria-label={`分类 ${category.name}`}
									defaultValue={category.name}
									required
									maxLength={60}
								/>
								<Input
									name="icon"
									aria-label={`分类图标 ${category.name}`}
									defaultValue={category.icon}
									placeholder="图标"
									maxLength={8}
									className="category-icon-input"
								/>
								<ColorSelect color={category.color} label={`分类颜色 ${category.name}`} />
								<Button type="submit" variant="outline" size="sm" disabled={pending}>
									保存
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label={`删除分类 ${category.name}`}
									disabled={pending}
									onClick={() =>
										void remove(
											`/categories/${category.id}`,
											`分类「${category.name}」`,
											"其中的订阅源会保留并移至未分类。",
										)
									}
								>
									<Trash2 size={14} />
								</Button>
							</form>
						</LayerCard>
					</li>
				))}
			</ul>
		</div>
	);
}
