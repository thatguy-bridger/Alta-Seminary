(function(){
try{
var KEY='alta-theme';
function resolve(mode){
if(mode==='dark')return'dark';
if(mode==='light')return'light';
return (window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';
}
function apply(mode){
var r=resolve(mode);
if(r==='dark')document.documentElement.setAttribute('data-theme','dark');
else document.documentElement.removeAttribute('data-theme');
}
var stored=localStorage.getItem(KEY)||'auto';
apply(stored);
window.AltaTheme={
get:function(){return localStorage.getItem(KEY)||'auto';},
set:function(m){localStorage.setItem(KEY,m);apply(m);}
};
if(window.matchMedia){
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(){
if((localStorage.getItem(KEY)||'auto')==='auto')apply('auto');
});
}
}catch(e){}
})();
