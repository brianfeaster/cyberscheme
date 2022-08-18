"use strict"

function log () { console.log(...arguments); }

function makeStatesTable (desc) {
  let states = Array.from(new Array(257), (_)=>desc[0]); // table initialied with default state
  for (let i=1; (i < desc.length); i+=2) {
    desc[i]
      .split("")
      .forEach( (c) => states[c.charCodeAt()] = desc[i+1] );
  }
  return states;
}

function makeStateMachine (...args) {
  let table = [];
  for (let i=0; (i < args.length); i+=2) {
    table[args[i]] = makeStatesTable(args[i+1]);
  }
  return table;
}

// Intermediate states
let Start=0, Comment=1, White=2, Dot=3, Dash=4, Floatsym=5, Num=6, Float=7, Sym=8, Str=9, Hash=10;
// Final states
let QUOTE=201, OPEN=202, CLOSE=203, STR=204, FALSE=205, TRUE=206, EOF=998, ERROR=999;
// Final states requiring unget
let DOT=1002, NUM=1003, FLOAT=1004, SYM=1005, COMMENT=1098, WHITE=1099;

let fsm = makeStateMachine(
  Start, [ERROR,
          ";",Comment, "\b\t\n\v\f\r ",White, ".",Dot, "-",Dash, "0123456789",Num, "'",QUOTE, "([{",OPEN, ")]}",CLOSE,
          "\"",Str, "!$%@*+/:<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ\\^_abcdefghijklmnopqrstuvwxyz|~",Sym, "#",Hash,
          "\u0100",EOF],
  Comment, [Comment, "\n\u0100",COMMENT],
  White,   [WHITE, "\b\t\n\v\f\r ",White],
  Dot,     [DOT, "0123456789",Float,             "!$%@*+-./:<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ\\^_abcdefghijklmnopqrstuvwxyz|~",Sym],
  Dash,    [SYM, ".",Floatsym, "0123456789",Num,  "!$%@*+-/:<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ\\^_abcdefghijklmnopqrstuvwxyz|~",Sym],
  Floatsym,[SYM, "0123456789",Float,             "!$%@*+-./:<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ\\^_abcdefghijklmnopqrstuvwxyz|~",Sym],
  Num,     [NUM, "0123456789",Num, ".",Float,     "!$%@*+-/:<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ\\^_abcdefghijklmnopqrstuvwxyz|~",Sym],
  Float,   [FLOAT, "0123456789",Float,           "!$%@*+-./:<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ\\^_abcdefghijklmnopqrstuvwxyz|~",Sym],
  Sym,     [SYM,                       "!$%@*+-./0123456789:<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ\\^_abcdefghijklmnopqrstuvwxyz|~",Sym],
  Str,     [Str, "\"\u0100",STR],
  Hash,    [Str, "fF",FALSE,  "tT",TRUE]
);

let text="", start=0, ptr=0, state=Start;
function DB () { log([start, ptr, ...token()]); }
function init (txt) { text=txt;  start = ptr = state = 0; };
function getc () { return text.length<=ptr ? 256 : text.charCodeAt(ptr++); }
function ungetc () { 0<ptr && ptr--;  }
function isFinalState () { return 100 <= state; }
function isFinalUngetState () { return 1000 <= state; }
function isUseableToken () { return (state%100) < 50; }
function token () {
  return [
    state,
    state==EOF ? "#eof" : text.substr(start, ptr-start)
  ];
};
function reset () { state=Start; start=ptr; }
function eof () { return state == EOF; }
function scanNextToken () {
  isFinalState() && reset(); // Reset state machine if called from a final state.
  let c;
  while (!isFinalState()) { state = fsm[state][c=getc()]; }
  if ( isFinalUngetState() && c!=256 ) { ungetc(); } // Maybe unget last char but only if not EOF
  return token();
}

onmessage = function (e) {
  init(e.data);
  let tokens = [];
  while (!eof()) { tokens.push(...scanNextToken()); }
  postMessage(tokens);
};

log("WebWorker listening: scanner");
