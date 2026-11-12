import { describe, it, expect } from 'vitest';
import { compile } from '../src/compiler/index.js';

const VALID = `hold num a ^= 5;
hold num b ^= 10;
hold num sum;
hold Switch big ^= off;
hold Text msg ^= "done";
hold frac pi ^= 3.14;
hold glyph grade ^= 'A';
sum ^= a ^+ b ^* 2;
when (sum ^> 20) {
big ^= on;
} otherwise {
big ^= off;
}
repeat (a ^< b) {
a ^= a ^+ 1;
}
reveal(sum);
reveal(msg);`;

describe('valid.txt', () => {
  const r = compile(VALID);
  it('parses with ^* below ^+', () => {
    const assign = r.parser.tree.find((n) => n.label === 'Assignment: sum');
    expect(assign.children[0].label).toBe('Operator: ^+');
    expect(assign.children[0].children[1].label).toBe('Operator: ^*');
  });
  it('has 7 symbols and no errors; TAC starts correctly; loop jumps to L3', () => {
    expect(r.semantic.symbols).toHaveLength(7);
    expect(r.icg.tac.slice(6, 9)).toEqual(['  t1 = b * 2', '  t2 = a + t1', '  sum = t2']);
    expect(r.icg.tac).toContain('  goto L3');
  });
  it('prints 25 and done', () => expect(r.output.output).toBe('25\ndone'));
});

describe('syntax errors', () => {
  const msg = (s) => compile(s).parser.errors[0];
  it('1', () => expect(msg('hold num a ^= 5;\nhold num b ^= 10\na ^= a ^+ b;')).toBe("Syntax Error at line 3: expected ';' but found 'a'"));
  it('2', () => expect(msg('hold num a ^= 5;\nwhen (a ^> 3 {\nreveal(a);\n}')).toBe("Syntax Error at line 2: expected ')' but found '{'"));
  it('3', () => expect(msg('hold num a;\na ^= 5 ^+ ;')).toBe("Syntax Error at line 2: expected an expression but found ';'"));
  it('4', () => expect(msg('hold num a;\n^= 5;')).toBe("Syntax Error at line 2: a statement cannot start with '^='"));
});

it('semantic_error.txt gives six errors on lines 2,4,5,6,7,10', () => {
  const r = compile(`hold num a ^= 5;
hold num a ^= 7;
hold Text name ^= "ali";
hold Switch ok ^= 3;
b ^= a ^+ 1;
a ^= a ^+ name;
when (a ^^ "ali") {
reveal(a);
}
when (a) {
reveal(a);
}`);
  expect(r.semantic.errors.map((e) => Number(e.match(/line (\d+)/)[1]))).toEqual([2, 4, 5, 6, 7, 10]);
  expect(r.icg.status).toBe('skipped');
});

it('icg_expression', () => {
  const r = compile('hold num a ^= 2;\nhold num b ^= 3;\nhold num c ^= 4;\nhold num x;\nx ^= (a ^+ b) ^* c ^- 4;');
  expect(r.icg.tac.slice(-4)).toEqual(['  t1 = a + b', '  t2 = t1 * c', '  t3 = t2 - 4', '  x = t3']);
  expect(r.output.status).toBe('ok');
});

it('icg_loop_ifelse nests L1-L4 and runs', () => {
  const r = compile(`hold num i ^= 0;
hold num total ^= 0;
repeat (i ^< 5) {
when (i ^^ 3) {
total ^= total ^+ 10;
} otherwise {
total ^= total ^+ 1;
}
i ^= i ^+ 1;
}
reveal(total);`);
  expect(r.icg.tac.filter((l) => l.endsWith(':'))).toEqual(['L1:', 'L3:', 'L4:', 'L2:']);
  expect(r.output.output).toBe('14'); // four iterations add 1, i==3 adds 10
});

it('runtime safeguards', () => {
  expect(compile('hold num a ^= 1 ^/ 0;').output.errors[0]).toMatch(/division by zero/);
  expect(compile('repeat (on) { }').output.errors[0]).toMatch(/infinite loop/);
  expect(compile('reveal(7 ^/ 2);reveal(7.0 ^/ 2);').output.output).toBe('3\n3.5');
});
