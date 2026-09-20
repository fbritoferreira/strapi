import { run } from "./main";

const code = await run(process.argv.slice(2), {
	stdout: (line) => console.log(line),
	stderr: (line) => console.error(line),
	env: process.env,
	now: () => new Date(),
});
process.exit(code);
