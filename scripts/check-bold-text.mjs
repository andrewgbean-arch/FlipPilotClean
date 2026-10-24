// Run with: npm run check:boldtext (from the app root). Exits 1 if it finds a problem.
//
// Plain text (no font weight) whose box is only as wide as its words loses its last letter on a phone with Android's
// "Bold text" switched on: "Back" showed as "Bac" on a Samsung S22 (24 Oct 2026). The reason, and the fix, are in
// src/styles/boldTextSafe.ts. This script finds the risky shapes with the TypeScript parser, reading StyleSheet.create
// blocks and inline styles, so a new one cannot creep in unnoticed:
//   - a <Text> (react-native) with no fontWeight or fontFamily in its style, not inside another <Text>, that
//   - has its own alignSelf other than stretch, or
//   - sits in a row with no flex, flexGrow, width or minWidth on it, or
//   - sits in a column whose alignItems is center, flex-start or flex-end.
// Fixes, in order of preference: stretch it to the full width, give it `flex: 1`, or add `stableWeight` to its style.
// A single-glyph text (an icon, an emoji, a bullet, a "+") cannot lose "its last letter", so those are let through;
// anything else that is right as it is can carry a `// bold-ok` comment on its line or the line above.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require(join(root, "node_modules", "typescript", "lib", "typescript.js"));

const DYN = "__dynamic";
const GLYPH = /^(\{icon\}|\{[\w.]*emoji\}|•|\+|\{prefix\})$/;
const ALIGNED = new Set(["center", "flex-start", "flex-end"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (["node_modules", "checks", "__tests__", "assets"].includes(name)) continue;
      walk(p, out);
    } else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const litValue = (n) => {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isNumericLiteral(n)) return Number(n.text);
  if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(n.operand)) return -Number(n.operand.text);
  return undefined;
};
const propName = (n) => (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n) ? n.text : null);
const EMPTY = () => ({ props: new Map(), unknown: false });
const UNKNOWN = () => ({ props: new Map(), unknown: true });
const merge = (a, b) => ({ props: new Map([...a.props, ...b.props]), unknown: a.unknown || b.unknown });

function problemsIn(file) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const sheets = new Map();
  const objs = new Map();
  let importsText = false;

  const objectProps = (obj) => {
    const r = EMPTY();
    for (const p of obj.properties) {
      if (ts.isPropertyAssignment(p)) {
        const name = propName(p.name);
        if (!name) r.unknown = true;
        else r.props.set(name, litValue(p.initializer) ?? DYN);
      } else if (ts.isShorthandPropertyAssignment(p)) r.props.set(p.name.text, DYN);
      else if (ts.isSpreadAssignment(p)) {
        const inner = resolveStyle(p.expression);
        for (const [k, v] of inner.props) r.props.set(k, v);
        if (inner.unknown) r.unknown = true;
      } else r.unknown = true;
    }
    return r;
  };

  const collect = (n) => {
    if (ts.isImportDeclaration(n) && n.moduleSpecifier.text === "react-native" && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings)) {
      if (n.importClause.namedBindings.elements.some((el) => el.name.text === "Text")) importsText = true;
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const init = n.initializer;
      if (ts.isCallExpression(init) && ts.isPropertyAccessExpression(init.expression) && init.expression.expression.getText() === "StyleSheet" && init.expression.name.text === "create" && init.arguments[0] && ts.isObjectLiteralExpression(init.arguments[0])) {
        const m = new Map();
        for (const p of init.arguments[0].properties) if (ts.isPropertyAssignment(p) && propName(p.name) && ts.isObjectLiteralExpression(p.initializer)) m.set(propName(p.name), objectProps(p.initializer));
        sheets.set(n.name.text, m);
      } else if (ts.isObjectLiteralExpression(init) && !objs.has(n.name.text)) objs.set(n.name.text, init);
    }
    ts.forEachChild(n, collect);
  };
  collect(sf);
  if (!importsText) return [];

  function resolveStyle(e) {
    if (!e) return EMPTY();
    if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e)) return resolveStyle(e.expression);
    if (ts.isObjectLiteralExpression(e)) return objectProps(e);
    if (ts.isArrayLiteralExpression(e)) return e.elements.reduce((acc, el) => merge(acc, resolveStyle(el)), EMPTY());
    if (ts.isConditionalExpression(e)) return merge(resolveStyle(e.whenTrue), resolveStyle(e.whenFalse));
    if (ts.isBinaryExpression(e)) {
      const op = e.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) return merge(resolveStyle(e.left), resolveStyle(e.right));
      return UNKNOWN();
    }
    if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) {
      if (!ts.isBlock(e.body)) return resolveStyle(e.body);
      let ret = null;
      e.body.forEachChild((s) => { if (ts.isReturnStatement(s) && s.expression) ret = s.expression; });
      return ret ? resolveStyle(ret) : UNKNOWN();
    }
    if (ts.isIdentifier(e)) {
      if (e.text === "undefined") return EMPTY();
      if (e.text === "stableWeight") return { props: new Map([["fontWeight", "400"]]), unknown: false };
      const o = objs.get(e.text);
      return o ? objectProps(o) : UNKNOWN();
    }
    if (e.kind === ts.SyntaxKind.NullKeyword || e.kind === ts.SyntaxKind.FalseKeyword || e.kind === ts.SyntaxKind.TrueKeyword) return EMPTY();
    if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression)) {
      const sheet = sheets.get(e.expression.text);
      if (sheet) return sheet.get(e.name.text) ?? UNKNOWN();
    }
    return UNKNOWN();
  }

  const attr = (el, name) => {
    const attrs = ts.isJsxElement(el) ? el.openingElement.attributes : el.attributes;
    for (const a of attrs.properties) if (ts.isJsxAttribute(a) && a.name.text === name && a.initializer && ts.isJsxExpression(a.initializer)) return a.initializer.expression;
    return null;
  };
  const tagOf = (el) => (ts.isJsxElement(el) ? el.openingElement.tagName.getText() : el.tagName.getText());
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const excerpt = (el) => (ts.isJsxElement(el) ? el.children.map((c) => c.getText().replace(/\s+/g, " ").trim()).join(" ").trim() : "");
  const LAYOUT = ["View", "Pressable", "TouchableOpacity", "TouchableHighlight", "TouchableWithoutFeedback", "SafeAreaView", "Animated.View", "ScrollView", "KeyboardAvoidingView", "LinearGradient", "Modal", "FlatList"];

  const found = [];
  const visit = (n, anc) => {
    let next = anc;
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = tagOf(n);
      if (tag === "Text" && !anc.some((a) => a.tag === "Text")) {
        const own = resolveStyle(attr(n, "style"));
        const has = (k) => own.props.has(k);
        const line = lineOf(n);
        const suppressed = /bold-ok/.test(lines[line - 1] ?? "") || /bold-ok/.test(lines[line - 2] ?? "");
        if (!has("fontWeight") && !has("fontFamily") && !own.unknown && !suppressed && !GLYPH.test(excerpt(n))) {
          const parent = anc.length ? anc[anc.length - 1] : null;
          const alignSelf = own.props.get("alignSelf");
          const grows = has("flex") || has("flexGrow") || has("width") || has("minWidth");
          let reason = null;
          if (alignSelf && alignSelf !== "stretch" && !grows) reason = `its own alignSelf is ${alignSelf}`;
          else if (parent && !parent.custom && LAYOUT.includes(parent.tag)) {
            const dir = parent.style.props.get("flexDirection") ?? "column";
            const align = parent.tag === "ScrollView" ? parent.contentAlign : parent.style.props.get("alignItems") ?? "stretch";
            if ((dir === "row" || dir === "row-reverse") && !grows && alignSelf !== "stretch") reason = "it sits in a row with no flex on it";
            else if (dir === "column" && (ALIGNED.has(align) || align === DYN) && alignSelf !== "stretch" && !grows) reason = `its column is aligned ${align === DYN ? "by a variable" : align}`;
          }
          if (reason) found.push({ line, reason, text: excerpt(n).slice(0, 50) });
        }
      }
      const desc = { tag, style: resolveStyle(attr(n, "style")), custom: !LAYOUT.includes(tag) && tag !== "Text" && /^[A-Z]/.test(tag) };
      if (tag === "ScrollView") desc.contentAlign = resolveStyle(attr(n, "contentContainerStyle")).props.get("alignItems") ?? "stretch";
      next = [...anc, desc];
    }
    ts.forEachChild(n, (c) => visit(c, next));
  };
  visit(sf, []);
  return found;
}

const files = [];
for (const d of ["app", "src"]) walk(join(root, d), files);
let total = 0;
for (const f of files) {
  const found = problemsIn(f);
  if (!found.length) continue;
  console.log(`\n${relative(root, f).replace(/\\/g, "/")}`);
  for (const x of found) {
    total++;
    console.log(`  line ${x.line}: "${x.text}" has no font weight and ${x.reason}`);
  }
}
if (total) {
  console.log(`\n${total} text(s) could lose their last letter on a phone with Bold text on.`);
  console.log("Add `stableWeight` (src/styles/boldTextSafe.ts) to the style, give it flex: 1 or a fontWeight, or stretch it to the full width.");
  console.log("If it is right as it is, put `// bold-ok` on its line or the line above.");
  process.exit(1);
}
console.log("check:boldtext OK: no plain short text is left with a box only as wide as its words.");
