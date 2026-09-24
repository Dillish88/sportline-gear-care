(() => {
  const track=document.getElementById('services'),cards=[...track.children];
  const dots=[...document.querySelectorAll('[data-slide]')];
  const prev=document.getElementById('service-prev'),next=document.getElementById('service-next');
  let current=0;
  function update(){
    const center=track.getBoundingClientRect().left+track.clientWidth/2;
    current=cards.reduce((best,c,i)=>Math.abs(c.getBoundingClientRect().left+c.offsetWidth/2-center)<Math.abs(cards[best].getBoundingClientRect().left+cards[best].offsetWidth/2-center)?i:best,0);
    dots.forEach((d,i)=>d.setAttribute('aria-current',String(i===current)));
    prev.disabled=current===0;next.disabled=current===cards.length-1;
  }
  function go(i){
    i=Math.max(0,Math.min(cards.length-1,i));
    track.scrollTo({left:track.scrollLeft+cards[i].getBoundingClientRect().left+cards[i].offsetWidth/2-(track.getBoundingClientRect().left+track.clientWidth/2),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  dots.forEach((d,i)=>d.onclick=()=>go(i));prev.onclick=()=>go(current-1);next.onclick=()=>go(current+1);
  track.addEventListener('scroll',update,{passive:true});
  track.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const i=e.key==='ArrowRight'?Math.min(current+1,2):Math.max(current-1,0);go(i);cards[i].focus({preventScroll:true});}});
  track.addEventListener('focusin',e=>{const i=cards.indexOf(e.target);if(i>=0)go(i);});
  window.addEventListener('resize',update);update();
})();
