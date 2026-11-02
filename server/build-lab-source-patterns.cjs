// Syntax-aware views for bounded first-party source checks. Never executes code.
const {parse}=require('@babel/parser');
const SOURCE_RECOGNIZER_VERSION='babel-syntax-views-v1:'+require('@babel/parser/package.json').version;
function sourceViews(source){
 let ast;try{ast=parse(source,{sourceType:'unambiguous',plugins:['jsx'],allowAwaitOutsideFunction:true,attachComment:false});}
 catch{throw Error('Bundled source syntax could not be inspected.');}
 const code=source.split(''),text=source.split(''),calls=[];
 function literals(node){
  if(!node)return [];
  if(node.type==='StringLiteral')return [node.value];
  if(node.type==='RegExpLiteral')return [node.pattern];
  if(node.type==='TemplateLiteral'&&!node.expressions.length)return [node.quasis.map(q=>q.value.cooked||'').join('')];
  if(node.type==='ObjectExpression')return node.properties.flatMap(p=>p.type==='ObjectProperty'?literals(p.value):[]);
  if(node.type==='ArrayExpression')return node.elements.flatMap(literals);
  return [];
 }
 function mask(output,start,end){for(let i=start;i<end;i++)if(source[i]!=='\n'&&source[i]!=='\r')output[i]=' ';}
 for(const comment of ast.comments||[]){mask(code,comment.start,comment.end);mask(text,comment.start,comment.end);}
 const pending=[ast.program];
 while(pending.length){
  const node=pending.pop();
  if(node.type==='CallExpression'||node.type==='OptionalCallExpression'){
   const callee=node.callee,method=callee.type==='Identifier'?callee.name:!callee.computed&&callee.property?.type==='Identifier'?callee.property.name:null;
   if(method)calls.push({method,start:node.start,firstString:node.arguments[0]?.type==='StringLiteral'?node.arguments[0].value:null,values:node.arguments.flatMap(literals)});
  }
  if(['StringLiteral','TemplateElement'].includes(node.type))mask(code,node.start,node.end);
  if(['RegExpLiteral','JSXText'].includes(node.type)){mask(code,node.start,node.end);mask(text,node.start,node.end);}
  for(const [key,value] of Object.entries(node)){
   if(['comments','leadingComments','innerComments','trailingComments','loc','extra','tokens'].includes(key))continue;
   if(Array.isArray(value)){for(const child of value)if(child&&typeof child.type==='string')pending.push(child);}
   else if(value&&typeof value.type==='string')pending.push(value);
  }
 }
 return {code:code.join(''),text:text.join(''),calls:calls.sort((a,b)=>a.start-b.start)};
}
// The IA stylesheet is CSS, not JavaScript. Only mask its comments and quoted
// strings; selectors do not establish computed styles or cascade behavior.
function cssView(source,keepStrings){
 let state='code',quote='',out='';
 for(let i=0;i<source.length;i++){
  const c=source[i],n=source[i+1],blank=c==='\n'||c==='\r'?c:' ';
  if(state==='comment'){if(c==='*'&&n==='/'){out+='  ';i++;state='code';}else out+=blank;continue;}
  if(state==='string'){
   if(c==='\\'){out+=keepStrings?c+(n||''):' '+(n===undefined?'':n==='\n'?'\n':' ');i++;}
   else{out+=keepStrings?c:blank;if(c===quote)state='code';}continue;
  }
  if(c==='/'&&n==='*'){state='comment';out+='  ';i++;}
  else if(c==='"'||c==="'"){state='string';quote=c;out+=keepStrings?c:' ';}
  else out+=c;
 }
 return out;
}
function maskSource(source,{keepStrings=false,lineComments=true}={}){
 if(!lineComments)return cssView(source,keepStrings);
 const views=sourceViews(source);return keepStrings?views.text:views.code;
}
module.exports={maskSource,sourceViews,SOURCE_RECOGNIZER_VERSION};
