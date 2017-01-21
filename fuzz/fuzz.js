const chalk = require("chalk");
const codeFrame = require("babel-code-frame");
const jsdiff = require("diff");
const esfuzz = require("esfuzz");
const random = require("esfuzz/lib/random");
const fs = require("fs");
const prettier = require("../");

function randomOptions() {
  return {
    printWidth: random.randomInt(200),
    tabWidth: random.randomInt(12),
    singleQuote: random.randomBool(),
    trailingComma: random.randomBool(),
    bracketSpacing: random.randomBool(),
    parser: random.randomElement([ "babylon", "flow" ])
  };
}

function colorizeDiff(part) {
  const color = part.added
    ? chalk.bgGreen
    : part.removed ? chalk.bgRed : chalk.grey;
  const value = part.value;
  return value === "\n" ? color(" ") + "\n" : color(value);
}

function highlight(text) {
  return codeFrame(text, null, null, {
    highlightCode: true,
    linesBelow: Infinity
  });
}

function formatError(num, error) {
  return [ "prettier.format " + num + " error:", error && error.stack ].join(
    "\n"
  );
}

const boringRegex = /^[\s;]*$|with/;

let randomAST;
let randomJS;
do {
  randomAST = esfuzz.generate({ maxDepth: 7 });
  randomJS = esfuzz.render(randomAST);
} while (boringRegex.test(randomJS));

const options = randomOptions();

let prettierJS1 = null;
let prettierJS1Error = null;
try {
  prettierJS1 = prettier.format(randomJS, options);
} catch (error) {
  prettierJS1Error = error;
}

let prettierJS2 = null;
let prettierJS2Error = null;
if (!prettierJS1Error) {
  try {
    prettierJS2 = prettier.format(prettierJS1, options);
  } catch (error) {
    prettierJS2Error = error;
  }
}

const hasError = Boolean(prettierJS1Error || prettierJS2Error);

const hasDiff = !hasError && prettierJS1 !== prettierJS2;
const diffString = hasDiff
  ? jsdiff.diffChars(prettierJS1, prettierJS2).map(colorizeDiff).join("")
  : "";

const message = hasDiff
  ? chalk.red("Diff")
  : hasError ? chalk.red("Error") : chalk.green("Success!");

const separator = "─".repeat(process.stdout.columns);

const output = [
  highlight(randomJS),
  separator,
  hasDiff || hasError ? diffString : highlight(prettierJS1),
  prettierJS1Error ? formatError(1, prettierJS1Error) : null,
  prettierJS2Error ? formatError(2, prettierJS2Error) : null,
  separator,
  JSON.stringify(options, null, 2),
  separator,
  message
]
  .filter(part => part !== null)
  .join("\n");

console.log(output);

fs.writeFileSync(__dirname + "/random.js", randomJS);
fs.writeFileSync(__dirname + "/prettier1.js", prettierJS1);
fs.writeFileSync(__dirname + "/prettier2.js", prettierJS2);
