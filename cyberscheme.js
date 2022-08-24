"use strict";

////////////////////////////////////////////////////////////////////////////////
// Scanner

function makeStatesTable (desc) {
  // Table initialized with default state (first state in desc array)
  let states = Array.from(new Array(257), (_)=>desc[0]);
  for (let i=1; (i < desc.length); i+=2) {
    desc[i]
      .split("")
      .forEach((c)=>states[c.charCodeAt()]=desc[i+1] );
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
let tge = {z:2, stack:[], parent:null, env:null, cont:null};

const cons = (a,b)=>{ return {car:a, cdr:b}; };

function sexpr2ary (sexpr) {
  let ret = [];
  while (sexpr && sexpr.constructor === Object) {
    ret.push(sexpr.car);
    sexpr = sexpr.cdr;
  }
  //if (sexpr) { ret.push(str(sexpr)); } // TODO improper lists
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

// At runtime, does the right thing with the result and returns the proper bound continuation.
// Note:  (seq && !cont) will never occur
function ret_cont (self, res, cont, seq) {
  seq || tge.stack.push(res);
  return (cont)
    ? cont.bind(self)
    : self.cont.bind(self.env);
}

function contPass (val, cont, seq) {
  return function INTRINSIC () {
    return ret_cont(this, val, cont, seq);
  };
};

function contPassFn (fn, cont, seq) {
  return function PRIMITIVE () {
    return ret_cont(this, fn(), cont, seq);
  };
};

function transpile (e, continuation, seq) {
  // Null object
  if (null === e || undefined === e) {
      return contPass(null, continuation, seq);
  }
  // Not a pair (intrinsic valued object)
  if (Object !== e.constructor) {
    if (String === e.constructor && e.at(0) != '"') { // Symbol (not a string)
      return function SYM_LOOKUP () {
        return ret_cont(this, this[e], continuation, seq);
      };
    } else { // Number or string or ...?
      return contPass(e, continuation, seq);
    };
  };

  let op = e.car;
  let args = sexpr2ary(e.cdr);
  let len = args.length;
  let cont = continuation;

  switch (op) {
  case "quote":
    return contPass(args[0], continuation, seq);
  case "+":
    cont = function ADD () {
      let res=0, l=len;
      while (l--) { res += tge.stack.pop(); };
      return ret_cont(this, res, continuation, seq);
    };
    break;
  case "-":
    cont = function SUB () {
      let res=0, l=len;
      if (1 == l) { res = -tge.stack.pop(); }
      else {
        while (--l) { res += tge.stack.pop(); };
        res = tge.stack.pop() - res;
      };
      return ret_cont(this, res, continuation, seq);
    };
    break;
  case "*":
    cont = function MUL () {
      let res=1, l=len;
      while (l--) { res *= tge.stack.pop(); };
      return ret_cont(this, res, continuation, seq);
    };
    break;
  case "mul":
    cont = function INTMUL () {
      let res=1, l=len;
      while (l--) { res *= tge.stack.pop(); };
      return ret_cont(this, Math.floor(res), continuation, seq);
    };
    break;
  case "/":
    cont = function DIV () {
      let res=1, l=len;
      if (1 == l) { res = 1/tge.stack.pop(); }
      else {
        while (--l) { res *= tge.stack.pop(); };
        res = tge.stack.pop() / res;
      };
      return ret_cont(this, res, continuation, seq);
    };
    break;
  case "quotient":
    cont = function INTQUOTIENT () {
        let res=1, l=len;
        if (1 == l) { res = 1/tge.stack.pop(); }
        else {
          while (--l) { res *= tge.stack.pop(); };
          res = Math.floor(tge.stack.pop() / res);
        };
        return ret_cont(this, res, continuation, seq);
      };
    break;
  case "%":
    cont = function MOD () {
      let d = tge.stack.pop();
      let res = tge.stack.pop() % d;
      return ret_cont(this, res, continuation, seq);
    };
    break;
  case ">":
    cont = function GT () {
        let res = tge.stack.pop() < tge.stack.pop();
        return ret_cont(this, res, continuation, seq);
      };
    break;
  case ">=":
    cont = function GTEQ () {
        let res = tge.stack.pop() <= tge.stack.pop();
        return ret_cont(this, res, continuation, seq);
      };
    break;
  case "<=":
    cont = function LTEQ () {
        let res = tge.stack.pop() >= tge.stack.pop();
        return ret_cont(this, res, continuation, seq);
      };
    break;
  case "<":
    cont = function LT () {
        let res = tge.stack.pop() > tge.stack.pop();
        return ret_cont(this, res, continuation, seq);
      };
    break;
  case "eq?": case "==":
    cont = contPassFn(
      function EQ () { return tge.stack.pop() === tge.stack.pop(); },
      continuation, seq);
    break;
  case "eqv?": case "=":
    cont = function EQV () {
      let res = tge.stack.pop() == tge.stack.pop();
      return ret_cont(this, res, continuation, seq);
    };
    break;
  case "clear" :
    cont = function CLEAR () {
      postStdoutClear();
      return ret_cont(this, "\"", continuation, seq); // TODO weird string hack
    };
    break;
  case "display" :
    cont = function DISPLAY () {
      let res = "", l=len;
      while (l--) {
        res = tge.stack.at(-l-1)
        postStdout(str(res));
      };
      len && tge.stack.splice(-len);
      return ret_cont(this, res, continuation, seq);
    };
    break;
  case "time-utc":
    return contPassFn(Date.now, continuation, seq);
  case "yield":
    cont = function YIELD () {
      // Trigger a rescheduling by returning false with continuation saved and resumed eventually
      let ret = null, l=len;
      while (l--) { ret = tge.stack.pop(); }
      tge.cont = ret_cont(this, ret, continuation, seq);
      return false;
    };
    break;
  case "list":
    cont = function LIST () {
       let res = ary2list(tge.stack.splice(-len));
       return ret_cont(this, res, continuation, seq);
    };
    break;
  case "cons":
    cont = contPassFn(
      function CONS () { return cons(...tge.stack.splice(-len)); },
      continuation, seq);
    break;
  case "car":
    cont = function CAR () {
      let res = tge.stack.pop().car;
      return ret_cont(this, res, continuation, seq);
    };
    break;
  case "cdr":
    cont = function CDR () {
      let res = tge.stack.pop().cdr;
      return ret_cont(this, res, continuation, seq);
    };
    break;
  case "set!":
    return transpile(args[1],
      function SETB () {
        let sym = args[0];
        let self = this;
        while (self.parent && !self.hasOwnProperty(sym)) { self = self.parent; }
        let res = self[sym] = tge.stack.pop();
        return ret_cont(this, res, continuation, seq);
      });
  case "if" :
    let blockTrue = transpile(args[1], continuation, seq);
    let blockFalse = (3==len)
      ? transpile(args[2], continuation, seq)
      : contPass(false, continuation, seq);
    return transpile(args[0],
      function IF () {
        return (tge.stack.pop())
          ? blockTrue.bind(this)
          : blockFalse.bind(this);
      });
  case "begin" :
    return compileSequence(args, continuation, seq);
  case "rnd":
    cont = contPassFn(
      function RND () {
        return Math.floor(tge.stack.pop() * Math.random());
      }, continuation, seq);
    break;
  case "gcolor":
    cont = function GCOLOR () {
        let b= tge.stack.pop();
        let g= tge.stack.pop();
        let r= tge.stack.pop();
        let res = gfx.fillStyle = `rgb(${r},${g},${b})`;
        return ret_cont(this, res, continuation, seq);
       };
    break;
  case "gcolora":
    cont = function GCOLORA () {
        let a= tge.stack.pop();
        let b= tge.stack.pop();
        let g= tge.stack.pop();
        let r= tge.stack.pop();
        let res = gfx.fillStyle = `rgba(${r},${g},${b},${a})`;
        return ret_cont(this, res, continuation, seq);
       };
    break;
  case "gbox":
    cont = function GBOX () {
        let h= tge.stack.pop();
        let w= tge.stack.pop();
        let y= tge.stack.pop();
        let x= tge.stack.pop();
        let res = gfx.fillRect(x, y, w, h);
        return ret_cont(this, res, continuation, seq);
       };
    break;
  case "fill":
    cont = function FILL () {
        gfx.fill();
        return ret_cont(this, null, continuation, seq);
       };
    break;
  case "lambda" :
    let params = args.shift();
    let block = compileSequence(args, null);
    return function LAMBDA () {
      let closure = {env:this, params:params, block:block};
      return ret_cont(this, closure, continuation, seq);
    };
  case "call-with-current-continuation": case "call/cc":
    return transpile(args[0],
      function CALL_CC () {
        let clos = tge.stack.pop();
        if (clos.constructor !== Object) { postStdout(`ERROR: Illegal Closure: ${str(clos)}  Expression: ${str(e)}\n`); return false; };
        // Extend environment
        let env = Object.create(clos.env);
        env.parent = clos.env; // Duplicate prototype link to parent/lexical env
        // Figure out the continuation
        if (continuation) {
          env.cont = (seq)
            ? function () {
                tge.stack.pop();
                return continuation.bind(this);
               }
            : continuation;
          env.env = this; // Save current env
        } else { // The continuation of a procedure application in a tail position
          env.cont = this.cont;
          env.env = this.env; // Save parent env
        }
        // Assign continuation to bound variable
        let p = clos.params;
        let v = [{cont:env.cont.bind(env.env), stack:tge.stack.concat()}];
        while (p && Object === p.constructor) {
          let o = v.shift();
          env[p.car] = o===undefined ? null : o;
          p=p.cdr;
        };
        if (p && String === p.constructor) {
          env[p] = ary2list(v);
         } // rest arg
        return clos.block.bind(env);
      });
  default : // Procedure application.  For now only handle closure applications
    cont = transpile(op,
      function PROCEDURE_APPLICATION () {
        let clos = tge.stack.pop();// Consider closure
        if (clos.hasOwnProperty("cont")) {
          tge.stack = clos.stack.concat(tge.stack.splice(-len));
          return clos.cont;
        };
        if (clos.constructor !== Object) { postStdout(`ERROR: Illegal Closure: ${str(clos)}  Expression: ${str(e)}\n`); return false; };
        // Extend environment
        let env = Object.create(clos.env);
        env.parent = clos.env; // Duplicate prototype link to parent/lexical env
        // Figure out the continuation
        if (continuation) {
          env.cont = (seq)
            ? function () {
                tge.stack.pop();
                return continuation.bind(this);
               }
            : continuation;
          env.env = this; // Save current env
        } else { // The continuation of a procedure application in a tail position
          env.cont = this.cont;
          env.env = this.env; // Save parent env
        }
        // Assign bound variables...
        let v = len ? tge.stack.splice(-len) : [];
        let p = clos.params;
        while (p && Object === p.constructor) {
          let o = v.shift();
          env[p.car] = o===undefined ? null : o;
          p=p.cdr;
        };
        if (p && String === p.constructor) {
          env[p] = ary2list(v);
         } // rest arg
        return clos.block.bind(env);
      });
    break;
  };
  // Compile arguments to the primitive or procedure application.
  while (args.length) {
    cont = transpile(args.pop(), cont);
  };
  return cont;
}; // transpile()

function compileSequence (ary, continuation, seq, printEach) {
  continuation = transpile(
      (ary.length) ? ary.pop() : null, // Empty blocks are null
      continuation,
      seq);
  while (ary.length) {
    continuation = (printEach)
      ? transpile(
          ary.pop(),
          ((cont)=>function POP_THEN () {
              postStdout(str(this.stack.pop())+"\n");
              return cont.bind(this);
            })(continuation),
          false)
      : transpile(ary.pop(), continuation, true);
  };
  return continuation;
}; // compileSequence()

// Compile expression into a continuation
function compile (sexpr) {
  try {
    return compileSequence(sexpr,
        function REPL_END(){}, // final continuation returns false and halts VM
        false, // The sequence itself is not a sequencecd expression (keep value on stack)
        true  // Print each sequence value (Useful in a REPL).
      ).bind(tge);
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
    + (showArgs ? (e.stack.map(o=>""+o).join(",")) : "")
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
          ret += "#CLOSURE{"
            + str(o.params)
            //+ "{" + strEnvSimple(o.env) + "}"
            //+ o.block.name
            + "}" ;
        } else if (o.hasOwnProperty("cont")) { // CONTINUATION
          ret += "#CONTINUATION{}";
        } else if (o.hasOwnProperty("stack")) { // closure
          ret += "#ENV{"
            + Object.keys(o)
                .filter( (k)=>["stack","parent","env","cont","contenv"].indexOf(k)<0 )
                .map( k=>k+":"+str(o[k]) )
                .join(" ")
            + (o.hasOwnProperty("stack") ? " stack:" + str(o.stack) : "")
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
  const max = 5_000_000;
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
      tge.stack.push(`"EXCEPTION: ${e}"`);
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
    postStdout(str(tge.stack.pop()));
    if (tge.stack.length) { postStdout(str(tge.stack)); } // print extra args
  };

  let execContinue = function () {
    scheduled || exec();
  }

  self.run = function (prg) {
    brk = false;
    prog = prg;
    tge.stack.splice(0);
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
};

function postStdoutClear () {
  postMessage({version:1, type:2});
};

function postFillStyle (s) {
  postMessage({version:1, type:10, data:s});
};

function postFillRect (x,y,w,h) {
  postMessage({version:1, type:20, data:[x,y,w,h]});
};

function postFill () {
  postMessage({version:1, type:30});
};

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
  this.fill = function () {
    postFill();
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
    console.error(`CyberScheme WebWorker unhandled onmessage:\n${msg}`);
  };
};
