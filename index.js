#!/usr/bin/env node

// >> $ ./index.js "./example/example.txt"
// >> $ ./index.js "./example/sub/example.js"

// >> $ ./index.js "./example/**/*.txt"
// >> $ ./index.js "./example/**/*.txt" --ignore "./example/ignore/**"

import { fs, path, minimist, glob } from "zx";
import { create } from "xmlbuilder2";

const args = minimist(process.argv.slice(2));
const target = args._[0] || "**/*";

const defaultIgnore = ["node_modules/**", ".git/**"];

const userIgnore = args.ignore ? (Array.isArray(args.ignore) ? args.ignore : [args.ignore]) : [];

const ignorePatterns = [...defaultIgnore, ...userIgnore].filter(Boolean);

const files = await glob(target, {
	ignore: ignorePatterns,
	nodir: true,
});

async function getFileData(filePath) {
	let content = await fs.readFile(filePath, "utf8");
	if (!content) return null;

	content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
	if (!content) return null;

	return {
		name: path.basename(filePath),
		path: filePath.replace(/\\/g, "/"),
		content: content,
	};
}

if (files.length === 0) {
	process.stderr.write(`No files matched the pattern: ${pattern}\n`);
	process.exit(0);
}

let xmlOutput = "";

if (files.length === 1) {
	const data = await getFileData(files[0]);
	if (!data) {
		process.exit(1);
	}

	xmlOutput = create({ version: "1.0", encoding: "UTF-8" })
		.ele("file")
		.ele("name")
		.txt(data.name)
		.up()
		.ele("path")
		.txt(data.path)
		.up()
		.ele("content")
		.txt(data.content)
		// .dat(data.content)
		.up()
		.end({ prettyPrint: true });
} else {
	const allFiles = [];
	for (const file of files) {
		const fileData = await getFileData(file);
		if (!fileData) continue;

		allFiles.push(fileData);
	}
	if (!allFiles.length) {
		process.exit(1);
	}
	// console.log(allFiles);

	const root = create({ version: "1.0", encoding: "UTF-8" }).ele("files");
	for (const f of allFiles) {
		root.ele("file")
			.ele("name")
			.txt(f.name)
			.up()
			.ele("path")
			.txt(f.path)
			.up()
			.ele("content")
			.txt(f.content)
			// .dat(f.content)
			.up()
			.up();
	}
	xmlOutput = root.end({ prettyPrint: true });
}

console.log(xmlOutput);
