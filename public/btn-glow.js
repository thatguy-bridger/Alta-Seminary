(function(){
try{
// Same cursor-tracked radial glow as the Social Links block's hover fill
// (SocialLinksBlock.jsx), generalized to every .btn/.btn-* button site-wide
// (both the public site's Button block and the admin app's own Button
// component share those same classes -- see components.css) instead of
// being a one-off React effect wired into a single block. A single
// document-level pointermove listener (not one listener per button) works
// identically whether the button lives in a plain Astro page or inside the
// admin's React SPA, and needs no per-component changes to "turn on" --
// components.css's own .btn::after is what actually renders the glow, this
// only ever supplies WHERE it's centered via two CSS custom properties.
document.addEventListener('pointermove', function(e){
var btn = e.target.closest && e.target.closest('.btn');
if(!btn) return;
var rect = btn.getBoundingClientRect();
btn.style.setProperty('--btn-glow-x', ((e.clientX - rect.left) / rect.width * 100) + '%');
btn.style.setProperty('--btn-glow-y', ((e.clientY - rect.top) / rect.height * 100) + '%');
}, { passive: true });
}catch(e){}
})();
