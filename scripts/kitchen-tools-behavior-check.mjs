import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Execute the existing pure page calculations, not a separate test implementation.
function page(path, names) {
  const source = readFileSync(path, 'utf8');
  const script = source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
  const ast = ts.createSourceFile(path + '.ts', script, ts.ScriptTarget.Latest, true);
  const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)
    || ts.isVariableStatement(node) && node.declarationList.declarations.some(entry => names.includes(entry.name.getText(ast))));
  const code = ts.transpileModule(declarations.map(node => node.getText(ast)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText;
  const values = new Function(code + `\nreturn {${names.join(',')}};`)();
  const calculate = (name, args, values) => {
    const assignment = ast.statements.find(node => ts.isLabeledStatement(node) && node.label.text === '$'
      && ts.isExpressionStatement(node.statement) && ts.isBinaryExpression(node.statement.expression)
      && node.statement.expression.left.getText(ast) === name);
    assert.ok(assignment, 'Missing actual page calculation ' + name);
    return new Function(...args, 'return (' + assignment.statement.expression.right.getText(ast) + ')')(...values);
  };
  return { source, values, calculate };
}
const cost = page('src/routes/tools/food-cost/+page.svelte', ['rowCost']);
const ingredient = { purchasePrice: 20, purchaseAmount: 5, usedAmount: 0.5 };
assert.equal(cost.values.rowCost(ingredient), 2);
for (const fields of [{purchasePrice:-1},{purchaseAmount:0},{usedAmount:-1},{purchasePrice:Infinity},{purchaseAmount:NaN}]) {
  assert.equal(cost.values.rowCost({...ingredient,...fields}), 0);
}
const foodCost = cost.values.rowCost(ingredient) + cost.values.rowCost({...ingredient,purchasePrice:10});
assert.equal(foodCost,3);
assert.equal(cost.calculate('profit',['safeSalePrice','totalFoodCost'],[10,foodCost]),7);
assert.equal(cost.calculate('foodCostPercent',['safeSalePrice','totalFoodCost'],[10,foodCost]),30);
assert.equal(cost.calculate('marginPercent',['profit','safeSalePrice'],[7,10]),70);
assert.equal(cost.calculate('marginPercent',['profit','safeSalePrice'],[0,0]),0);
assert.ok(cost.source.includes('Gross Profit') && cost.source.includes('Gross Margin'));
const conversions = page('src/routes/conversions/+page.svelte', ['units']);
const convert = (group, amount, from, to) => conversions.calculate('convertedAmount',['safeAmount','fromMeasure','toMeasure'],
  [amount,conversions.values.units[group].find(row=>row.key===from),conversions.values.units[group].find(row=>row.key===to)]);
const close = (actual,expected) => assert.ok(Math.abs(actual-expected)<1e-9, `${actual} != ${expected}`);
close(convert('volume',1,'cup','tbsp'),16);close(convert('volume',1,'tbsp','tsp'),3);
close(convert('volume',1,'gallon','quart'),4);close(convert('volume',1,'liter','ml'),1000);
close(convert('volume',0.125,'cup','tbsp'),2);close(convert('weight',1,'pound','ounce'),16);
close(convert('weight',1,'ounce','gram'),28.349523125);
assert.equal(conversions.values.units.volume.some(row=>row.key==='pound'),false);
const safety=readFileSync('src/routes/tools/safety-healthcode/+page.svelte','utf8');
for(const text of ['155 F / 17 sec','145 F / 15 sec','within 6 hours total','local rules apply','not a universal code requirement','product label'])assert.ok(safety.includes(text),text);
assert.ok(!safety.includes('150-400 ppm'));
console.log('PASS actual kitchen calculations: compatible US volume/weight units, portion costs, invalid inputs, food-cost percentage/gross margin; FDA model-code reference boundaries retained');
