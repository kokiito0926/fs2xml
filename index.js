#!/usr/bin/env node

// >> $ ./index.js ../../workspace/
// >> $ ./index.js ../../workspace/ > ./example.xml

import { fs, path, minimist } from "zx";
import { create } from "xmlbuilder2";

const args = minimist(process.argv.slice(2));
const target = args._[0] || ".";

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

if (!fs.existsSync(target)) {
	console.error(`Error: Cannnot access '${target}'; No such file or directory.`);
	process.exit(1);
}

const stats = await fs.stat(target);

let xmlOutput = "";

if (stats.isFile()) {
	const data = await getFileData(target);
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
		.up()
		.end({ prettyPrint: true });
} else {
	const files = await fs.readdir(target, { recursive: true });
	if (!files.length) {
		process.exit(1);
	}
	// console.log(files);

	const allFiles = [];
	for (const file of files) {
		const filePath = path.join(target, file);
		const fStats = await fs.stat(filePath);
		if (fStats.isDirectory()) continue;

		// console.error(file);

		const fileData = await getFileData(filePath);
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
			.up()
			.up();
	}
	xmlOutput = root.end({ prettyPrint: true });
}

console.log(xmlOutput);
