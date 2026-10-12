/* 匠考通关宝 - 题库加载器 */
(function(){
  var boot=document.getElementById("boot");
  var bootTxt=boot?boot.querySelector(".boot-txt"):null;
  function setTxt(t){ if(bootTxt) bootTxt.textContent=t; }
  function loadScript(u){
    return new Promise(function(res,rej){
      var el=document.createElement("script");
      el.src=u; el.onload=res; el.onerror=function(){el.remove();rej(new Error(u));};
      document.head.appendChild(el);
    });
  }
  var CDNS=["gcore.jsdelivr.net","fastly.jsdelivr.net","cdn.jsdelivr.net"];
  function srcOf(n,host){ return "https://"+host+"/gh/yuxjanchi/qixiu-shuati@main/part"+n+".js"; }
  function loadPart(n){
    var chain=CDNS.map(function(h){return srcOf(n,h);}).concat(["part"+n+".js"]);
    var p=Promise.reject();
    chain.forEach(function(u){ p=p.catch(function(){ return loadScript(u); }); });
    return p;
  }
  var seq=Promise.resolve();
  for(var i=1;i<=5;i++){
    (function(n){ seq=seq.then(function(){ setTxt("题库加载中 "+n+"/5 …"); return loadPart(n); }); })(i);
  }
  seq.then(function(){
    window.__Q=[].concat(window.__P1||[],window.__P2||[],window.__P3||[],window.__P4||[],window.__P5||[]);
    if(window.__Q.length<8000){ throw new Error("题库数据不完整"); }
    if(boot) boot.remove();
    var ms=document.createElement("script");
    ms.src="main.js";
    document.body.appendChild(ms);
  }).catch(function(){
    if(boot){
      boot.innerHTML='<div style="text-align:center;color:#3E4C5C;font-size:15px;line-height:1.8">题库加载失败，请检查网络后重试</div><button onclick="location.reload()" style="margin-top:12px;padding:10px 28px;border:none;border-radius:24px;background:#0B5FA5;color:#fff;font-size:15px">重新加载</button>';
    }
  });
})();
