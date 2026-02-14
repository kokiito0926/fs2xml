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

async function loadNearestGitignore(startDir) {
	const ig = ignore();
	const currentDir = startDir;

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

	return { ig, baseDir: targetPattern };
}

const parseBool = (val, defaultVal) => {
	if (val === undefined || val === null) return defaultVal;
	if (typeof val === "boolean") return val;
	if (val === "true") return true;
	if (val === "false") return false;
	return !!val;
};

const searchRoot = path.resolve(argv._[0] || ".");

const includePattern = argv.include || "**/*";

const ignorePattern = [];
if(argv.ignore) {
	ignorePattern.push(argv.ignore);
}

const dot = parseBool(argv?.dot, false);

const useGitignore = parseBool(argv?.gitignore, true);
const { ig, baseDir } = useGitignore === false ? { ig: ignore(), baseDir: searchRoot } : await loadNearestGitignore(searchRoot);

let files = await glob(includePattern, {
	cwd: searchRoot,
	nodir: true,
	dot: dot,
	ignore: ignorePattern,
});

if (files.length === 0) {
	process.exit(1);
}

files = files.filter((file) => {
    const absoluteFile = path.resolve(searchRoot, file);
    const absoluteBase = path.resolve(baseDir);

    let relativeToGitignore = path.relative(absoluteBase, absoluteFile);

    relativeToGitignore = relativeToGitignore.replace(/\\/g, "/");

    if (relativeToGitignore.startsWith('..') || path.isAbsolute(relativeToGitignore)) {
        return true; 
    }

    if (relativeToGitignore === "" || relativeToGitignore === ".") return true;

    return !ig.ignores(relativeToGitignore);
});

if (files.length === 0) {
	process.exit(1);
}

const allFiles = [];
for (const file of files) {
    const absolutePath = path.resolve(searchRoot, file);

	const buffer = await fs.readFile(absolutePath);
	if (isBinary(buffer)) continue;

	let content = buffer.toString("utf8");
	if (!content) continue;

	// Filter invalid XML 1.0 characters: #x9, #xA, #xD, [#x20-#xD7FF], [#xE000-#xFFFD], [#x10000-#x10FFFF]
	// Using a common regex for stripping restricted characters
	content = content.replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, "");
	if (!content) continue;

	// content = content.replace(/]]>/g, "]]]]><![CDATA[>");
	// if (!content) return null;

	allFiles.push({
		name: path.basename(file),
		path: file.replace(/\\/g, "/"),
		content: content,
	});
}

if (!allFiles.length) {
	process.exit(1);
}

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

const builder = new xml2js.Builder({
	cdata: true,
	xmldec: { version: "1.0", encoding: "UTF-8" },
	renderOpts: { pretty: true },
});

const xmlOutput = builder.buildObject(xmlObject);
console.log(xmlOutput);
