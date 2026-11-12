// Single source of truth for the language reference (also used to generate database/seed.sql).
export const KEYWORD_ROWS = [
  ['hold', 'DECLARE', 'keyword', 'Declare a variable'], ['reveal', 'PRINT', 'keyword', 'Print a value'],
  ['when', 'IF', 'keyword', 'If condition'], ['otherwise', 'ELSE', 'keyword', 'Else branch'],
  ['repeat', 'LOOP', 'keyword', 'Loop while condition holds'], ['craft', 'CRAFT', 'keyword', 'Reserved'],
  ['on', 'TRUE', 'keyword', 'Switch literal true'], ['off', 'FALSE', 'keyword', 'Switch literal false'],
  ['num', 'INT_TYPE', 'type', 'Integer (5)'], ['frac', 'FLOAT_TYPE', 'type', 'Decimal (3.14)'],
  ['Text', 'STRING_TYPE', 'type', 'String ("done")'], ['Switch', 'BOOL_TYPE', 'type', 'Boolean (on / off)'],
  ['glyph', 'CHAR_TYPE', 'type', "Character ('A')"],
  ['^=', 'ASSIGN', 'operator', 'Assignment'], ['^+', 'PLUS', 'operator', 'Addition'], ['^-', 'MINUS', 'operator', 'Subtraction'],
  ['^*', 'MULT', 'operator', 'Multiplication'], ['^/', 'DIV', 'operator', 'Division'], ['^>', 'GT', 'operator', 'Greater than'],
  ['^<', 'LT', 'operator', 'Less than'], ['^^', 'EQ', 'operator', 'Equal'], ['^!', 'NEQ', 'operator', 'Not equal'],
];
export const GRAMMAR = `program    -> stmt_list EOF
stmt_list  -> stmt stmt_list | epsilon
stmt       -> decl | assign | if_stmt | while_stmt | print_stmt
decl       -> hold type ID ';' | hold type ID '^=' expr ';'
type       -> num | frac | Text | Switch | glyph
assign     -> ID '^=' expr ';'
if_stmt    -> when '(' expr ')' block | when '(' expr ')' block otherwise block
while_stmt -> repeat '(' expr ')' block
print_stmt -> reveal '(' expr ')' ';'
block      -> '{' stmt_list '}'
expr       -> arith | arith relop arith
relop      -> '^>' | '^<' | '^^' | '^!'
arith      -> term { ('^+' | '^-') term }
term       -> factor { ('^*' | '^/') factor }
factor     -> NUM | STR | CHAR | on | off | ID | '(' expr ')'`;
export const SEMANTIC_RULES = [
  'A variable cannot be declared twice', 'A variable must be declared before use',
  'Assigned value must match the variable type (a num may be stored in a frac)',
  '^+ ^- ^* ^/ ^> ^< need num/frac operands', '^^ and ^! need operands of the same type (num and frac may be mixed)',
  'The condition of when / repeat must be Switch',
];
export const TYPE_TABLE = [['num', 'int', '5'], ['frac', 'float', '3.14'], ['Text', 'string', '"done"'], ['Switch', 'boolean', 'on / off'], ['glyph', 'char', "'A'"]];
