#!/usr/bin/env node

import { fs, path, argv, glob } from "zx";
import ignore from "ignore";
import globParent from "glob-parent";
import xml2js from "xml2js";

function isBinary(buffer) {
	for (let i = 0; i < Math.min(buffer.length, 4096); i++) {
		if (buffer[i] === 0) return true;
	}
	return false;
}

async function loadNearestGitignore(targetPattern) {
	const ig = ignore();

	const parentDir = globParent(targetPattern);
	let currentDir = path.resolve(parentDir);

	try {
		const stats = await fs.stat(currentDir);
		if (stats.isFile()) {
			currentDir = path.dirname(currentDir);
		}
	} catch (e) { }

	// console.error('Debug: loading gitignore for', targetPattern, 'baseDir:', currentDir);
	while (true) {
		const gitignorePath = path.join(currentDir, ".gitignore");
		// console.error('Debug: checking', gitignorePath);

		if (fs.existsSync(gitignorePath)) {
			// console.error('Debug: found gitignore at', gitignorePath);
			const content = await fs.readFile(gitignorePath, "utf8");
			ig.add(content);

			return { ig, baseDir: currentDir };
		}

		const parent = path.dirname(currentDir);
		if (parent === currentDir) break;
		currentDir = parent;
	}

	return { ig, baseDir: process.cwd() };
}

const parseBool = (val, defaultVal) => {
	if (val === undefined || val === null) return defaultVal;
	if (typeof val === "boolean") return val;
	if (val === "true") return true;
	if (val === "false") return false;
	return !!val;
};

const target = (argv?._[0] || "**/*").replace(/\\/g, "/");
const dot = parseBool(argv?.dot, false);
const useGitignore = parseBool(argv?.gitignore, true);

const { ig, baseDir } =
	useGitignore === false ? { ig: ignore(), baseDir: process.cwd() } : await loadNearestGitignore(target);

const ignorePattern = [];
if(argv.ignore) {
	ignorePattern.push(argv.ignore);
}

let files = await glob(target, {
	ignore: ignorePattern,
	nodir: true,
	dot: dot,
});

files = files.filter((file) => {
	const relativePath = path.relative(baseDir, path.resolve(file));
	if (relativePath === "") return true;
	return !ig.ignores(relativePath);
});

async function getFileData(filePath) {
	const buffer = await fs.readFile(filePath);
	if (isBinary(buffer)) {
		return null;
	}

	let content = buffer.toString("utf8");
	if (!content) return null;

	// Filter invalid XML 1.0 characters: #x9, #xA, #xD, [#x20-#xD7FF], [#xE000-#xFFFD], [#x10000-#x10FFFF]
	// Using a common regex for stripping restricted characters
	content = content.replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, "");
	if (!content) return null;

	// content = content.replace(/]]>/g, "]]]]><![CDATA[>");
	// if (!content) return null;

	return {
		name: path.basename(filePath),
		path: filePath.replace(/\\/g, "/"),
		content: content,
	};
}

if (files.length === 0) {
	process.exit(1);
}

const allFiles = [];
for (const file of files) {
	const fileData = await getFileData(file);
	if (!fileData) continue;
	allFiles.push(fileData);
}

if (!allFiles.length) {
	process.exit(1);
}

const builder = new xml2js.Builder({
	cdata: true,
	xmldec: { version: "1.0", encoding: "UTF-8" },
	renderOpts: { pretty: true },
});

// Always use <files><file>...</file></files> structure for consistency
// Using { _: content } ensures xml2js handles CDATA correctly for strings containing ]]>
const xmlObject = {
	files: {
		file: allFiles.map((f) => ({
			name: f.name,
			path: f.path,
			content: { _: f.content },
		})),
	},
};

const xmlOutput = builder.buildObject(xmlObject);
console.log(xmlOutput);
