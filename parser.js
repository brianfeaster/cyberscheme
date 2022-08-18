"use strict"

function log (...args) { console.log(...args); }
function Pair (a,b) { this.car = a; this.cdr = b; }

let QUOTE=201, OPEN=202, CLOSE=203, STR=204, FALSE=205, TRUE=206, EOF=998, ERROR=999;
let DOT=1002, NUM=1003, FLOAT=1004, SYM=1005, COMMENT=1098, WHITE=1099;

function parse (tokens) {
  if (tokens.length < 2) { return null; }
  switch (tokens[0]) { case WHITE : case COMMENT : tokens.shift(); tokens.shift(); return parse(tokens); }
  let tok = tokens.shift();
  let txt = tokens.shift()
  switch (tok) {
    case OPEN : return parseList(tokens);
    case CLOSE : return null;
    case QUOTE : return new Pair("quote", new Pair(parse(tokens), null));
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
    case OPEN : return new Pair(parseList(tokens), parseList(tokens));
    case CLOSE : return null;
    case EOF: return null;
    case DOT : let ret = parse(tokens);
               if (ret === undefined) { ret = null; }
               if (tokens[0]==CLOSE) {
                 tokens.shift(); // TODO assume/consume CLOSE
                 tokens.shift();
               }
               return ret;
    case QUOTE : return new Pair(new Pair("quote", new Pair(parse(tokens), null)), parseList(tokens));
    default : tokens.unshift(txt);
              tokens.unshift(tok);
              let a = parse(tokens);
              return new Pair(a, parseList(tokens));
  }
}

onmessage = function (e) {
  let tokens = e.data;
  let result = [];
  while (0 < tokens.length) {
    let e = parse(tokens);
    undefined !== e && result.push(e);
  }
  postMessage(result);
};


log("WebWorker listening: parser");

