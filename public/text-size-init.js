(function(){
try{
var KEY='alta-text-scale';
var STEPS=[0.9,1,1.1,1.25,1.4];
function apply(scale){
document.documentElement.style.setProperty('--text-scale',String(scale));
}
var stored=parseFloat(localStorage.getItem(KEY));
var initial=STEPS.indexOf(stored)!==-1?stored:1;
apply(initial);
window.AltaTextSize={
STEPS:STEPS,
get:function(){
var s=parseFloat(localStorage.getItem(KEY));
return STEPS.indexOf(s)!==-1?s:1;
},
set:function(scale){
localStorage.setItem(KEY,String(scale));
apply(scale);
}
};
}catch(e){}
})();
