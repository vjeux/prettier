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

let tryCount = 0;
while (true) {
  tryCount++;
  var randomAST = esfuzz.generate({ maxDepth: 7 });
  var randomJS = esfuzz.render(randomAST);
  if (boringRegex.test(randomJS)) {
    continue;
  }

  var options = randomOptions();

  var prettierJS1 = null;
  var prettierJS1Error = null;
  try {
    prettierJS1 = prettier.format(randomJS, options);
  } catch (error) {
    if (error.toString().indexOf('SyntaxError') !== -1) {
      continue;
    }
    prettierJS1Error = error;
  }


  var prettierJS2 = null;
  var prettierJS2Error = null;
  if (!prettierJS1Error) {
    try {
      prettierJS2 = prettier.format(prettierJS1, options);
    } catch (error) {
      prettierJS2Error = error;
    }
  }

  var hasError = Boolean(prettierJS1Error || prettierJS2Error);
  var hasDiff = !hasError && prettierJS1 !== prettierJS2;
  if (hasError || hasDiff) {
    break;
  }
}

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
  message + ' after ' + tryCount + ' tries',
]
  .filter(part => part !== null)
  .join("\n");

console.log(output);

fs.writeFileSync(__dirname + "/random.js", randomJS);
fs.writeFileSync(__dirname + "/prettier1.js", prettierJS1);
fs.writeFileSync(__dirname + "/prettier2.js", prettierJS2);
