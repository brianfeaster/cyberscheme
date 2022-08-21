"use strict";

////////////////////////////////////////////////////////////////////////////////
// Scanner

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

function scanner (scm) {
  init(scm);
  let tokens = [];
  while (!eof()) { tokens.push(...scanNextToken()); }
  return tokens;
};

//const CHAR_DOT = String.fromCharCode(183);
//let tokenClr = new Map([
//  [OPEN,"yellow"], [CLOSE,"yellow"], [STR,"brown"], [EOF,"orange"],
//  [ERROR, "red"], [DOT,"blue"], [NUM,"green"], [FLOAT,"lawngreen"],
//  [SYM,"mediumpurple"], [COMMENT,"bisque"], [WHITE,"white"]]);
//
//function dumpRawTokens (tokens) {
//  let e = CreateAppendChild("div", Vt100).AddClass('db');
//  for (let i=0; (i < tokens.length); i+=2) {
//    let tok = tokens[i];
//    let txt = tok==WHITE ? CHAR_DOT : tokens[i+1];
//    CreateAppendChild("span", e, txt).AddColor(tokenClr.get(tok)||"blue");
//  }
//}


////////////////////////////////////////////////////////////////////////////////
// Parser

function parse (tokens) {
  if (tokens.length < 2) { return null; }
  switch (tokens[0]) { case WHITE : case COMMENT : tokens.shift(); tokens.shift(); return parse(tokens); }
  let tok = tokens.shift();
  let txt = tokens.shift()
  switch (tok) {
    case OPEN : return parseList(tokens);
    case CLOSE : return null;
    case QUOTE : return cons("quote", cons(parse(tokens), null));
    case NUM :
    case FLOAT : return parseFloat(txt);
    case FALSE : return false;
    case TRUE : return true;
    case EOF : return undefined;
    default : return txt;
  }
}

function parseList (tokens) {
  if (tokens.length < 2) { return null; }
  switch (tokens[0]) {
    case WHITE :
    case COMMENT :
      tokens.shift();
      tokens.shift();
      return parseList(tokens);
  }
  let tok = tokens.shift();
  let txt = tokens.shift();
  switch (tok) {
    case OPEN : return cons(parseList(tokens), parseList(tokens));
    case CLOSE : return null;
    case EOF: return null;
    case DOT : let ret = parse(tokens);
               if (ret === undefined) { ret = null; }
               if (tokens[0]==CLOSE) {
                 tokens.shift(); // TODO assume/consume CLOSE
                 tokens.shift();
               }
               return ret;
    case QUOTE : return cons(cons("quote", cons(parse(tokens), null)), parseList(tokens));
    default : tokens.unshift(txt);
              tokens.unshift(tok);
              let a = parse(tokens);
              return cons(a, parseList(tokens));
  }
}

function parser (tokens) {
  let result = [];
  while (0 < tokens.length) {
    let e = parse(tokens);
    undefined !== e && result.push(e);
  }
  return result;
};


////////////////////////////////////////////////////////////////////////////////
// Objects

// Initial global environment
let tge = {z:2, args:[], parent:null, env:null, cont:null};

const cons = (a,b)=>{ return {car:a, cdr:b}; };

function sexpr2ary (sexpr) {
  let ret = [];
  while (sexpr && sexpr.constructor) {
    ret.push(sexpr.car);
    sexpr = sexpr.cdr;
  }
  return ret;
}

function ary2list (ary) {
  let i=1, len=ary.length, lst=null;
  while (i<=len) { lst = cons(ary[len-i++], lst); }
  return lst;
}

function log (...args) {
  //return; // Disable logging
  if (this !== undefined) {
    console.log( this + " " + args.map(str).join(" ") );
  } else if (1 !== args.length) {
    console.log( args.map(str).join(" ") );
  } else {
    console.log( args[0] );
  }
};


////////////////////////////////////////////////////////////////////////////////
// Compiler

function contPass (val, cont) {
  return cont
  ? function CONT_PASS () {
      this.args.push(val);
      return cont.bind(this);
    }
  : function CONT_PASS_TAIL () {
      this.env.args.push(val);
      return this.cont.bind(this.env);
    };
};

function contPassFn (fn, cont) {
  return cont
  ? function CONT_PASS () {
      this.args.push(fn.bind(this)());
      return cont.bind(this);
    }
  : function CONT_PASS_TAIL () {
      this.env.args.push(fn.bind(this)());
      return this.cont.bind(this.env);
    };
};

function transpile (e, cont) {
  // Null object
  if (null === e || undefined === e) {
      return contPass(null, cont);
  }
  // Not a pair (intrinsic valued object)
  if (Object !== e.constructor) {
    if (Number === e.constructor) { // Number
      return contPass(e, cont);
    } else if (String === e.constructor && e.at(0) != '"') { // Symbol
      return contPassFn(function(){return this[e]}, cont);
    } else { // String (already includes quotes)
      return contPass(e, cont);
    };
  };

  let op = e.car;
  let args = sexpr2ary(e.cdr);
  let len = args.length;
  let cont2 = cont;

  switch (op) {
    case "+":
      cont = contPassFn(
          function ADD () {
            let res=0, l=len;
            while (l--) { res += this.args.pop(); };
            return res;
          }, cont);
      break;
    case "-":
      cont = contPassFn(
          function SUB () {
            let res=0, l=len;
            if (1 == l--) { return -this.args.pop(); }
            else {
              while (l--) { res += this.args.pop(); };
              return this.args.pop() - res;
            };
          }, cont);
      break;
    case "*":
      cont = contPassFn(
        function MUL () {
          let res=1, l=len;
          while (0<l--) { res *= this.args.pop(); };
          return res;
        }, cont);
      break;
    case "mul":
      cont = contPassFn(
        function INTMUL () {
          let res=1, l=len;
          while (0<l--) { res *= this.args.pop(); };
          return Math.floor(res);
        }, cont);
      break;
    case "/":
      cont = contPassFn(function DIV () {
          let res=1, l=len;
          if (1 == l--) { return  1/this.args.pop(); }
          else {
            while (l--) { res *= this.args.pop(); };
            return this.args.pop() / res;
          };
        }, cont);
      break;
    case "div":
      cont = contPassFn(function INTDIV () {
          let res=1, l=len;
          if (1 == l--) { return  1/this.args.pop(); }
          else {
            while (l--) { res *= this.args.pop(); };
            return Math.floor(this.args.pop() / res);
          };
        }, cont);
      break;
    case "%":
      cont = contPassFn(
        function MOD () {
          let d = this.args.pop();
          return this.args.pop() % d;
        },
        cont);
      break;
    case ">":
      cont = contPassFn(
        function GT () { return this.args.pop() < this.args.pop(); },
        cont);
      break;
    case "<":
      cont = contPassFn(
        function LT () { return this.args.pop() > this.args.pop(); },
        cont);
      break;
    case "=":
    case "eqv?":
      cont = contPassFn(
        function EQV () { return this.args.pop() == this.args.pop(); },
        cont);
      break;
    case "eq?":
      cont = contPassFn(
        function EQ () { return this.args.pop() === this.args.pop(); },
        cont);
      break;
    case "display" :
      cont = contPassFn(
        function DISPLAY () {
          1 < len && this.args.splice(-len+1);
          return postStdout(str(this.args.pop()));
        },
        cont);
      break;
    case "quote":
      return contPass(args[0], cont);
    case "time-utc":
      return contPassFn(Date.now, cont);
    case "yield":
      cont = function YIELD () {
        // Trigger a rescheduling by returning false with continuation saved and resumed eventually
        tge.cont = cont2.bind(cont?this:this.env);
        return false;
      };
      break;
    //case "yield": // Compile yield expression into ()
    //  return contPass(null, cont);
    case "list":
      cont = contPassFn(
        function LIST () { return ary2list(this.args.splice(-len)); },
        cont);
      break;
    case "cons":
      cont = contPassFn(
        function CONS () { return cons(...this.args.splice(-len)); },
        cont);
      break;
    case "car":
      cont = contPassFn(
        function CAR () { return this.args.pop().car; },
        cont);
      break;
    case "cdr":
      cont = contPassFn(
        function CDR () { return this.args.pop().cdr; },
        cont);
      break;
    case "set!":
      return transpile(args[1],
        contPassFn(
          function SETB () {
            let sym = args[0];
            let self = this;
            while (self.parent && !self.hasOwnProperty(sym)) { self = self.parent; }
            return self[sym] = this.args.pop();
          },
         cont));
    case "if" :
      let blockTrue = transpile(args[1], cont);
      let blockFalse = (len == 3)
        ? transpile(args[2], cont)
        : contPass(false, cont);
      return transpile(args[0],
        function IF () {
          return (this.args.pop())
            ? blockTrue.bind(this)
            : blockFalse.bind(this);
        });
    case "begin" :
      return transpileBlock(args, cont);
    case "rnd":
      cont = contPassFn(
        function RND () {
          return Math.floor(this.args.pop() * Math.random());
         }, cont);
      break;
    case "gcolor":
      cont = contPassFn(
        function GCOLOR () {
          let b= this.args.pop();
          let g= this.args.pop();
          let r= this.args.pop();
          return gfx.fillStyle = `rgb(${r},${g},${b})`;
         }, cont);
      break;
    case "gcolora":
      cont = contPassFn(
        function GCOLORA () {
          let a= this.args.pop();
          let b= this.args.pop();
          let g= this.args.pop();
          let r= this.args.pop();
          return gfx.fillStyle = `rgba(${r},${g},${b},${a})`;
         }, cont);
      break;
    case "gbox":
      cont = contPassFn(
        function GCOLOR () {
          let h= this.args.pop();
          let w= this.args.pop();
          let y= this.args.pop();
          let x= this.args.pop();
          return gfx.fillRect(x, y, w, h);
         }, cont);
      break;
    case "lambda" :
      let params = args.shift();
      let block = transpileBlock(args, null);
      return contPassFn(
        function LAMBDA () {
          return {env:this, params:params, block:block};
        },
        cont);
    default : // Procedure application
        cont = transpile(op, (cont)
          ?function PROCEDURE_APPLICATION () {
            let clos = this.args.pop();// Consider closure
            // Extend environment
            let env = Object.create(clos.env);
            env.parent = clos.env; // Duplicate prototype link to parent/lexical env
            env.cont = cont2; // Save current continuation
            env.env = this; // Save current env
            env.args = []; // where args will be pushed for procedure
            // Assign bound variables...
            let p = clos.params;
            let v = len && this.args.splice(-len);
            while (p && Object === p.constructor) { env[p.car]=v.shift(); p=p.cdr; };
            if (p && String === p.constructor) { env[p] = ary2list(v); } // rest arg
            return clos.block.bind(env);
          }
          :function PROCEDURE_APPLICATION_TAIL () {
            let clos = this.args.pop();// Consider closure
            // Extend environment
            let env = Object.create(clos.env);
            env.parent = clos.env; // Duplicate prototype link to parent/lexical env
            env.cont = this.cont; // Save current continuation
            env.env = this.env; // Save current env
            env.args = []; // where args will be pushed for procedure
            // Assign bound variables...
            let p = clos.params;
            let v = len && this.args.splice(-len);
            while (p && Object === p.constructor) { env[p.car]=v.shift(); p=p.cdr; };
            if (p && String === p.constructor) { env[p] = ary2list(v); } // rest arg
            return clos.block.bind(env);
          });
      break;
  };
  // procedure application arguments
  while (args.length) {
    cont = transpile(args.pop(), cont);
  };
  return cont;
}; // transpile

function transpileBlock (ary, cont) {
  if (0 == ary.length) {
    cont = transpile(null, cont);
  } else {
    cont = transpile(ary.pop(), cont);
  };
  while (ary.length) {
    cont = transpile(ary.pop(),
      ((cont)=>function POP_THEN () {
          this.args.pop();
          return cont.bind(this);
      })(cont));
  };
  return cont;
}

// Compile expression into a continuation
function compile (sexpr) {
  try {
    return transpileBlock(sexpr, function REPL_END(){return false;})
        .bind(tge);
  } catch(e) {
    console.error(e);
    postStdout(`EXCEPTION: compile() ${e}`);
  };
};


////////////////////////////////////////////////////////////////////////////////
// Serializing

function strEnvSimple (e, showArgs=false) {
  return (!e) ? "()" :
    "("
    + Object.keys(e)
        .filter( (k)=>["args","parent","env","cont","contenv"].indexOf(k)<0 )
        .join(",")
    + (showArgs ? (e.args.map(o=>""+o).join(",")) : "")
    + ")";
};


function str (o, isPair) { try {
  let ret = "";
  if (null === o) {
    ret += isPair ? "" : "()";
  } else if (undefined === o) {
    ret += (isPair ? " . " : "") + "()";
  } else {
    switch (o.constructor) {
      case Array :
        ret += "[" + o.map((o)=>str(o, false)).join(" ") + "]";
        break;
      case Object :
        if (o.hasOwnProperty("car")) {
          if (!isPair) { ret += "("; }
          ret +=  str(o.car, false) + (o.cdr===null || o.cdr===undefined ? "" : o.cdr.constructor===Object ? " " : " . ") + str(o.cdr, true);
          if (!isPair) { ret +=  ")"; }
        } else if (o.hasOwnProperty("block")) { // closure
          ret += "#CLZ{"
            + str(o.params)
            + "{" + strEnvSimple(o.env) + "}"
            + o.block.name + "}";
        } else if (o.hasOwnProperty("args")) { // closure
          ret += "#ENV{"
            + Object.keys(o)
                .filter( (k)=>["args","parent","env","cont","contenv"].indexOf(k)<0 )
                .map( k=>k+":"+str(o[k]) )
                .join(" ")
            + (o.hasOwnProperty("args") ? " args:" + str(o.args) : "")
            + (o.hasOwnProperty("parent") ? " parent:" + strEnvSimple(o.parent) : "")
            + (o.hasOwnProperty("env") ? " env:" + strEnvSimple(o.env) : "")
            + (o.hasOwnProperty("cont") ? " cont:" + str(o.cont) : "")
            + (o.hasOwnProperty("contenv") ? " contenv:" + strEnvSimple(o.contenv) : "")
            + "}";
        } else {
          ret += "{" + Object.keys(o).map((k)=>k+":"+str(o[k])).join(", ") + "}";
        };
        break;
      case Function : ret += o.name; break;
      case Number : ret += o; break;
      case String : ret += o; break;
      default :
        if (o === true) { ret += "#t"; }
        else if (o === false) { ret += "#f"; }
        else { ret += (isPair ? "" : " . ") + JSON.stringify(o); };
    };
  };
  return ret;
} catch (e) {
  console.error(e);
  return e;
};}; // str()


////////////////////////////////////////////////////////////////////////////////
// VM

let vm = (()=>{
  const max = 1_000_000;
  let scheduled = false;
  let brk = false;
  let prog = false;
  let self = {};

  let exec = function () {
    scheduled = false;
    if (!prog || brk) { return; }
    try {
      let m = max;
      while (m-- && (prog=prog()));
    } catch(e) {
      console.error(e);
      tge.args.push(`"EXCEPTION: ${e}"`);
      prog = null;
    };
    if (!prog && tge.cont) { // Running program yielded
      prog = tge.cont;
      tge.cont = null;
    };
    if (prog) { // Schedule program continued execution
      scheduled = true;
      setTimeout(exec, 0);
      return;
    }
    // Display result and done executing
    postStdout(str(tge.args.pop()));
    if (tge.args.length) { postStdout(str(tge.args)); } // print extra args
  };

  let execContinue = function () {
    scheduled || exec();
  }

  self.run = function (prg) {
    brk = false;
    prog = prg;
    tge.args.splice(0);
    execContinue();
  };

  self.brk = function () {
    brk = prog && !brk;
    execContinue();
  };

  return self;
})();


////////////////////////////////////////////////////////////////////////////////
// IPC

function postStdout (s) {
  postMessage({version:1, type:1, data:s});
  return s;
}

function postFillStyle (s) {
  postMessage({version:1, type:10, data:s});
}

function postFillRect (x,y,w,h) {
  postMessage({version:1, type:20, data:[x,y,w,h]});
}

var gfx = new (function () {
  let fillStyle;
  this.fillStyle = `rgb(0,0,0)`;
  this.fillRect = function (x, y, w, h) {
    if (fillStyle != this.fillStyle) {
      fillStyle = this.fillStyle;
      postFillStyle(fillStyle);
    };
    postFillRect(x,y,w,h);
  };
})();


onmessage = function (msg) {
  msg = msg.data;
  switch (msg.type) {
  case 1:
    vm.run(compile(parser(scanner(msg.data))));
    break;
  case 2:
    vm.brk();
    break;
  default :
    log(`CyberScheme WebWorker unhandled type.`);
  };
};
