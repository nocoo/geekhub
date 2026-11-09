if (process.argv[2] !== "push") throw new Error("Expected push");
const tasks = ["test:l2", "gate:security"];
const results = await Promise.all(
	tasks.map(async (task) => {
		const child = Bun.spawn(["bun", "run", task], { stdout: "inherit", stderr: "inherit" });
		return { task, code: await child.exited };
	}),
);
if (results.some((result) => result.code)) process.exit(1);
