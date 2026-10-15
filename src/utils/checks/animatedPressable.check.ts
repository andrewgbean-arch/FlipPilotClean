// Run with: npx tsx src/utils/checks/animatedPressable.check.ts (from the app root).
// Found 2026-10-15 (owner): in History, deleting a flip (and "clear all") showed two blank pills — no "Delete",
// no "Cancel". History's AnimatedPressable wraps a Pressable in an Animated.View (for the press animation), and
// the buttons' style carried `flex: 1`. A flexed Pressable inside that auto-height wrapper is squashed down to
// its own padding on Android, so the label inside was never drawn. Nothing about it shows on a type-check, so
// this reads the screen's source: no style handed to an AnimatedPressable may carry flex. (Where the button
// sits in its row, e.g. half the width, goes in its `wrapperStyle` instead.)
/// <reference types="node" />
// (This file runs under Node, not on a phone: the reference is what gives it Node's file functions without
// adding them to the whole app's type-check.)
import fs from "fs";
import path from "path";
import ts from "typescript";

// (An optional path argument checks some other copy of the screen, which is how the check itself is tested.)
const FILE = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, "..", "..", "..", "app", "(tabs)", "history.tsx");
const sf = ts.createSourceFile(FILE, fs.readFileSync(FILE, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

let fail = 0;
const bad = (label: string, detail: string) => {
  fail++;
  console.log("FAIL", label, detail);
};
const lineOf = (node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

const FLEX_KEYS = new Set(["flex", "flexGrow", "flexShrink", "flexBasis"]);

const keysOf = (obj: ts.ObjectLiteralExpression): string[] =>
  obj.properties.flatMap((p) =>
    p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? [p.name.text] : []
  );

// 1. What each entry of `const styles = StyleSheet.create({...})` sets.
const styleKeys = new Map<string, string[]>();
const collectStyles = (node: ts.Node) => {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === "styles" &&
    node.initializer &&
    ts.isCallExpression(node.initializer)
  ) {
    const arg = node.initializer.arguments[0];
    if (arg && ts.isObjectLiteralExpression(arg)) {
      for (const prop of arg.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && ts.isObjectLiteralExpression(prop.initializer)) {
          styleKeys.set(prop.name.text, keysOf(prop.initializer));
        }
      }
    }
  }
  ts.forEachChild(node, collectStyles);
};
collectStyles(sf);
if (styleKeys.size < 10) bad("could not read the screen's styles", String(styleKeys.size));

// 2. Every <AnimatedPressable style={...}>: nothing it is given may set flex.
let usages = 0;
const checkStyle = (expr: ts.Node, at: number) => {
  const walk = (n: ts.Node) => {
    if (ts.isPropertyAccessExpression(n) && n.expression.getText(sf) === "styles") {
      const keys = styleKeys.get(n.name.text);
      if (!keys) {
        bad("an AnimatedPressable uses a style that could not be found", `styles.${n.name.text} (line ${at})`);
        return;
      }
      for (const k of keys) {
        if (FLEX_KEYS.has(k)) bad("an AnimatedPressable's style sets flex (its label would collapse)", `styles.${n.name.text}.${k} (line ${at})`);
      }
      return;
    }
    if (ts.isObjectLiteralExpression(n)) {
      for (const k of keysOf(n)) {
        if (FLEX_KEYS.has(k)) bad("an AnimatedPressable's style sets flex (its label would collapse)", `inline ${k} (line ${at})`);
      }
      return;
    }
    ts.forEachChild(n, walk);
  };
  walk(expr);
};

const findUsages = (node: ts.Node) => {
  if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(sf) === "AnimatedPressable") {
    usages++;
    const style = node.attributes.properties.find(
      (a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText(sf) === "style"
    );
    if (style?.initializer) checkStyle(style.initializer, lineOf(node));
  }
  ts.forEachChild(node, findUsages);
};
findUsages(sf);
// History has the two header icons, the best-flip card and the two confirm boxes' buttons (7 in all).
if (usages < 5) bad("could not find the screen's AnimatedPressable buttons", String(usages));

// 3. The component still lets a button say where it sits (the half-width in a row) on its OUTER view.
const text = sf.getFullText();
if (!/<Animated\.View style=\{\[wrapperStyle,/.test(text)) {
  bad("AnimatedPressable no longer puts wrapperStyle on its outer view", "the confirm boxes' buttons would not share the row");
}

console.log(`${usages} AnimatedPressable buttons, ${styleKeys.size} styles checked.`);
console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
