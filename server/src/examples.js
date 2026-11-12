// Sample programs: every test file from the Labs 2-4 PDF.
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
const E = (slug, title, category, expected_note, source) => ({ slug, title, category, expected_note, source });
export const EXAMPLES = [
  E('valid', 'valid.txt', 'valid', 'Parse tree with ^* below ^+; 7 symbols; prints 25 and done', VALID),
  E('syntax_error1', 'syntax_error1.txt', 'syntax_error', "Syntax Error at line 3: expected ';' but found 'a'", 'hold num a ^= 5;\nhold num b ^= 10\na ^= a ^+ b;'),
  E('syntax_error2', 'syntax_error2.txt', 'syntax_error', "Syntax Error at line 2: expected ')' but found '{'", 'hold num a ^= 5;\nwhen (a ^> 3 {\n  reveal(a);\n}'),
  E('syntax_error3', 'syntax_error3.txt', 'syntax_error', "Syntax Error at line 2: expected an expression but found ';'", 'hold num a;\na ^= 5 ^+ ;'),
  E('syntax_error4', 'syntax_error4.txt', 'syntax_error', "Syntax Error at line 2: a statement cannot start with '^='", 'hold num a;\n^= 5;'),
  E('semantic_error', 'semantic_error.txt', 'semantic_error', 'Six errors on lines 2, 4, 5, 6, 7, 10', 'hold num a ^= 5;\nhold num a ^= 7;\nhold Text name ^= "ali";\nhold Switch ok ^= 3;\nb ^= a ^+ 1;\na ^= a ^+ name;\nwhen (a ^^ "ali") {\n  reveal(a);\n}\nwhen (a) {\n  reveal(a);\n}'),
  E('icg_expression', 'icg_expression.txt', 'icg', 't1 = a + b, t2 = t1 * c, t3 = t2 - 4, x = t3', 'hold num a ^= 2;\nhold num b ^= 3;\nhold num c ^= 4;\nhold num x;\nx ^= (a ^+ b) ^* c ^- 4;\nreveal(x);'),
  E('icg_if', 'icg_if.txt', 'icg', 'One label (L1) after the block', 'hold num a ^= 8;\nhold num r ^= 0;\nwhen (a ^> 5) {\n  r ^= 1;\n}\nreveal(r);'),
  E('icg_ifelse', 'icg_ifelse.txt', 'icg', 'Two labels and one goto', 'hold num a ^= 8;\nhold num r ^= 0;\nwhen (a ^> 5) {\n  r ^= 1;\n} otherwise {\n  r ^= 2;\n}\nreveal(r);'),
  E('icg_loop_ifelse', 'icg_loop_ifelse.txt', 'icg', 'Labels L1-L4 nested; prints 14', 'hold num i ^= 0;\nhold num total ^= 0;\nrepeat (i ^< 5) {\n  when (i ^^ 3) {\n    total ^= total ^+ 10;\n  } otherwise {\n    total ^= total ^+ 1;\n  }\n  i ^= i ^+ 1;\n}\nreveal(total);'),
];
