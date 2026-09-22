import { run } from "./main";

const code = await run(process.argv.slice(2), {
	stdout: (line) => console.log(line),
	stderr: (line) => console.error(line),
	env: process.env,
	now: () => new Date(),
	cwd: process.cwd(),
});
// Deliberate: process.exitCode alone can leave the --url path waiting on
// keep-alive sockets from the admin login fetch, so force the exit here.
process.exit(code);
