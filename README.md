## fs2xml

fs2xmlは、ファイルをXML形式でまとめることができるコマンドラインのツールです。  
ファイルをXML形式でまとめるようにすると、大規模言語モデルに与えやすくなります。

## インストール

```bash
$ npm install --global @kokiito0926/fs2xml
```

## 使用方法

カレントディレクトリ内のすべてのファイルをXML形式でまとめます。

```bash
$ fs2xml
```

特定のディレクトリ内のすべてのファイルをXML形式でまとめます。

```bash
$ fs2xml ./src
```

--includeのオプションを用いると、特定のパターンを含めることができます。

```bash
$ fs2xml ./src --include "**/*.txt"
```

--ignoreのオプションを用いると、特定のパターンを除外することができます。

```bash
$ fs2xml ./src --ignore "**/*.log"
```

デフォルトでは、ドットのファイルは読み込まれません。  
--dotのオプションを用いると、ドットのファイルも読み込むことができます。

```bash
$ fs2xml ./src/ --dot true
```

デフォルトでは、.gitignoreが自動的に読み込まれるようになっております。  
--gitignoreのオプションにfalseを渡すようにすれば、そのような挙動を無効化することができます。

```bash
$ fs2xml ./src --gitignore false
```

## 出力例

```xml
<?xml version="1.0" encoding="UTF-8"?>
<files>
	<file>
		<name>example.js</name>
		<path>src/example.js</path>
		<content>console.log("Hello world!");</content>
	</file>
</files>
```

## ライセンス

[MIT](LICENSE)
