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


////////////////////////////////////////////////////////////////////////////////
// Parser

const newPair = (a,b)=>{ return {car:a, cdr:b}; };

//let QUOTE=201, OPEN=202, CLOSE=203, STR=204, FALSE=205, TRUE=206, EOF=998, ERROR=999;
//let DOT=1002, NUM=1003, FLOAT=1004, SYM=1005, COMMENT=1098, WHITE=1099;

function parse (tokens) {
  if (tokens.length < 2) { return null; }
  switch (tokens[0]) { case WHITE : case COMMENT : tokens.shift(); tokens.shift(); return parse(tokens); }
  let tok = tokens.shift();
  let txt = tokens.shift()
  switch (tok) {
    case OPEN : return parseList(tokens);
    case CLOSE : return null;
    case QUOTE : return newPair("quote", newPair(parse(tokens), null));
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
    case OPEN : return newPair(parseList(tokens), parseList(tokens));
    case CLOSE : return null;
    case EOF: return null;
    case DOT : let ret = parse(tokens);
               if (ret === undefined) { ret = null; }
               if (tokens[0]==CLOSE) {
                 tokens.shift(); // TODO assume/consume CLOSE
                 tokens.shift();
               }
               return ret;
    case QUOTE : return newPair(newPair("quote", newPair(parse(tokens), null)), parseList(tokens));
    default : tokens.unshift(txt);
              tokens.unshift(tok);
              let a = parse(tokens);
              return newPair(a, parseList(tokens));
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
// Main


////////////////////////////////////////
// IPC
function postStdout (s) {
  postMessage({version:1, type:1, data:s});
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

function log (...args) {
  //return; // Disable console logging/debugging
  if (this !== undefined) {
    console.log( this + " " + args.map(str).join(" ") );
  } else if (1 !== args.length) {
    console.log( args.map(str).join(" ") );
  } else {
    console.log( args[0] );
  }
};

function floor (n) { return Math.floor(n); };
function rnd (n) { return floor(n*Math.random()); };

function sexpr2ary (sexpr) {
  let ret = [];
  while (sexpr && sexpr.constructor) {
    ret.push(sexpr.car);
    sexpr = sexpr.cdr;
  }
  return ret;
}

function cons (a,b) {
  return {car:a, cdr:b};
};

function ary2list (ary) {
  let i=1, len=ary.length, lst=null;
  while (i<=len) { lst = cons(ary[len-i++], lst); }
  return lst;
}

function strEnvSimple (e, showArgs=false) {
  return (!e) ? "()" :
    "("
    + Object.keys(e)
        .filter( (k)=>["args","parent","env","cont","contenv"].indexOf(k)<0 )
        .join(",")
    + (showArgs ? (e.args.map(o=>""+o).join(",")) : "")
    + ")";
};

function str (o, isPair) {
  try {
    return str_(o, isPair);
  } catch (e) {
    console.error(e);
    return e;
  }
}

function str_ (o, isPair) {
  let ret = "";
  if (null === o) {
    ret += isPair ? "" : "()";
  } else if (undefined === o) {
    ret += (isPair ? " . " : "") + "()";
  } else {
    switch (o.constructor) {
      case Array :
        ret += "[" + o.map((o)=>str_(o, false)).join(" ") + "]";
        break;
      case Object :
        if (o.hasOwnProperty("car")) {
          if (!isPair) { ret += "("; }
          ret +=  str_(o.car, false) + (o.cdr===null || o.cdr===undefined ? "" : o.cdr.constructor===Object ? " " : " . ") + str_(o.cdr, true);
          if (!isPair) { ret +=  ")"; }
        } else if (o.hasOwnProperty("block")) { // closure
          ret += "#CLZ{"
            + str_(o.params)
            + "{" + strEnvSimple(o.env) + "}"
            + o.block.name + "}";
        } else if (o.hasOwnProperty("args")) { // closure
          ret += "#ENV{"
            + Object.keys(o)
                .filter( (k)=>["args","parent","env","cont","contenv"].indexOf(k)<0 )
                .map( k=>k+":"+str_(o[k]) )
                .join(" ")
            + (o.hasOwnProperty("args") ? " args:" + str_(o.args) : "")
            + (o.hasOwnProperty("parent") ? " parent:" + strEnvSimple(o.parent) : "")
            + (o.hasOwnProperty("env") ? " env:" + strEnvSimple(o.env) : "")
            + (o.hasOwnProperty("cont") ? " cont:" + str_(o.cont) : "")
            + (o.hasOwnProperty("contenv") ? " contenv:" + strEnvSimple(o.contenv) : "")
            + "}";
        } else {
          ret += "{" + Object.keys(o).map((k)=>k+":"+str_(o[k])).join(", ") + "}";
        }
        break;
      case Function : ret += o.name; break;
      case Number : ret += o; break;
      case String : ret += o; break;
      default :
        if (o === true) { ret += "#t"; }
        else if (o === false) { ret += "#f"; }
        else { ret += (isPair ? "" : " . ") + JSON.stringify(o); }
    }
  }
  return ret;
} // str_


let tge = {z:2, args:[], parent:null, env:null, cont:null}; // Initial global environment
let lastEnv = null; // Set throughout evaluation for debugging purposes

function transmogrify (e, cont) {
  let r = transmogrify_(e, cont);
  return r;
}

function transmogrifyBlock (ary, cont) {
  if (0 == ary.length) {
    cont = transmogrify(null, cont);
  } else {
    cont = transmogrify(ary.pop(), cont);
  };
  while (ary.length) {
    cont = transmogrify(ary.pop(),
      ((cont)=>function POP_THEN () {
          this.args.pop();
          return cont.bind(this);
      })(cont));
  };
  return cont;
}

function contPass (val, cont) {
  return cont
  ? function CONT_PASS () {
      this.args.push(val); 
      return cont.bind(lastEnv=this);
    }
  : function CONT_PASS_TAIL () {
      this.env.args.push(val); 
      return this.cont.bind(lastEnv=this.env);
    };
};

function contPassFn (fn, cont) {
  return cont
  ? function CONT_PASS () {
      this.args.push(fn.bind(this)()); 
      return cont.bind(lastEnv=this);
    }
  : function CONT_PASS_TAIL () {
      this.env.args.push(fn.bind(this)()); 
      return this.cont.bind(lastEnv=this.env);
    };
};

function transmogrify_ (e, cont) {
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
          return floor(res);
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
            return floor(this.args.pop() / res);
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
          postStdout(str(this.args[this.args.length-1]));
          return this.args.pop();
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
        tge.cont = cont2.bind(lastEnv = cont?this:this.env);
        return false;
      };
      break;
      //return contPass(null, cont); // Compile yield as a null
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
      return transmogrify(args[1],
        contPassFn(
          function SETB () {
            let sym = args[0];
            let self = this;
            while (self.parent && !self.hasOwnProperty(sym)) { self = self.parent; }
            return self[sym] = this.args.pop();
          },
         cont));
    case "if" :
      let blockTrue = transmogrify(args[1], cont);
      let blockFalse = (len == 3)
        ? transmogrify(args[2], cont)
        : contPass(false, cont);
      return transmogrify(args[0],
        function IF () {
          return (this.args.pop())
            ? blockTrue.bind(lastEnv=this)
            : blockFalse.bind(lastEnv=this);
        });
    case "lambda" :
      let params = args.shift();
      let block = transmogrifyBlock(args, null);
      return contPassFn(
        function LAMBDA () {
          return {env:this, params:params, block:block};
        },
        cont);
    case "begin" :
      return transmogrifyBlock(args, cont);
    case "rnd":
      cont = contPassFn(
        function RND () {
          return rnd(this.args.pop());
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
    default : // Procedure application
        cont = transmogrify(op, (cont)
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
            return clos.block.bind(lastEnv=env);
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
            return clos.block.bind(lastEnv=env);
          });
      break;
  }
  // procedure application arguments
  while (args.length) {
    cont = transmogrify(args.pop(), cont);
  };

  return cont;
}


// Compile expression into a continuation
function compile (sexpers) {
  let cont;
  try {
     cont =
       transmogrifyBlock(sexpers, function REPL_END(){return false;})
         .bind(lastEnv=tge);
  } catch(err) {
     log(err);
     cont = `"EXCEPTION:compile() ${err}"`;
  };
  return cont;
}

////////////////////////////////////////

/*
let QUOTE=201, OPEN=202, CLOSE=203, STR=204, EOF=998, ERROR=999;
let DOT=1002, NUM=1003, FLOAT=1004, SYM=1005, COMMENT=1098, WHITE=1099;

let tokenClr = new Map([
  [OPEN,"yellow"], [CLOSE,"yellow"], [STR,"brown"], [EOF,"orange"], [ERROR, "red"], [DOT,"blue"], [NUM,"green"], [FLOAT,"lawngreen"], [SYM,"mediumpurple"], [COMMENT,"bisque"], [WHITE,"white"]]);

function dumpRawTokens (tokens) {
  let e = CreateAppendChild("div", Vt100).AddClass('db');
  for (let i=0; (i < tokens.length); i+=2) {
    let tok = tokens[i];
    let txt = tok==WHITE ? CHAR_DOT : tokens[i+1];
    CreateAppendChild("span", e, txt)
      .AddColor(tokenClr.get(tok) || "blue");
  }
  // Token scanning stats
  CreateAppendChild( "i", e, ` ${tokens.length/2} token${tokens.length/2==1?"":"s"}\n`)
    .AddColor("grey");

  Vt100.scrollTo(0, Vt100.scrollHeight - Vt100.clientHeight);
}
*/

////////////////////////////////////////


function run (cont) {
  let max = 1_000_000;
  //Vt100.NewChild("b", `${str(lastEnv)}\n`).AddClass('db').AddColor("grey");
  try {
    while (cont && max--) {
      //Vt100.NewChild("b", `${cont.name}\n`).AddClass('db').AddColor("darkmagenta");
      //log("VM:", cont.name, "\n", lastEnv)
      cont = cont();
      //log(null, lastEnv);
    }
  } catch(e) {
    log(e);
    tge.args.push(`"EXCEPTION:js: ${e.message}"`);
    cont = false;
  };

  if (tge.cont) { // yielding mid-evaluation
    cont = tge.cont;
    tge.cont = null;
  } else if (!cont) { // Completed evaluation
    postStdout(str(tge.args[0]));
    tge.args.splice(0); // clear environment's args array
    if (max <= 0) { postStdout("max CPS"); cont=false; };
  }
  return cont;
} // run


let vm = (()=>{
  let scheduled = false;
  let program = false;
  let brk = false;

  let exec = function () {
    scheduled = false;
    if (!brk && program) {
      program = run(program);
      if (!program) {
        log("CyberScheme WebWorker done.");
      } else {
        scheduled = true;
        setTimeout(exec, 0);
      };
    };
  };

  let self = {};

  self.run = function (prog) {
    program = prog;
    brk = false;
    scheduled || exec();
  };

  self.brk = function () {
    brk = program && !brk;
    scheduled || exec();
  };

  return self;
})();

////////////////////////////////////////

onmessage = function (msg) {
  msg = msg.data;
  //log(`CyberScheme WebWorker ${msg.version} ${msg.type} ${msg.data && msg.data.length}`);
  switch (msg.type) {
  case 1:
    let scm = msg.data;
    let tokens = scanner(scm);
    let sexpers = parser(tokens);
    let prog = compile(sexpers);
    vm.run(prog);
    break;
  case 2:
    vm.brk();
    break;
  default :
    log(`CyberScheme WebWorker unhandled type.`);
  };
};
