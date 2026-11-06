(() => {
  const outings = [
    {id:'blackstone-walk',category:'Family',title:'Habitat detective walk',place:'Blackstone River State Park, Rhode Island',time:'30–60 minutes',plan:'Start near the Kelly House and walk an out-and-back section of the Blackstone Bikeway. Turn back halfway through your available time. Look for food, water, and shelter for wildlife without disturbing it.',bring:'Water, walking shoes, and paper for a habitat sketch.',access:'Shared path. Check trail conditions, parking, restrooms, and accessibility with the park before leaving.',url:'https://home.nps.gov/blrv/planyourvisit/placestogo.htm',source:'National Park Service park guide'},
    {id:'olney-pond',category:'Recreation',title:'Scout an afternoon at Olney Pond',place:'Lincoln Woods State Park, Rhode Island',time:'1–3 hours',plan:'Use the official launch listing to plan a visit. Scout from a permitted shore area, or plan a paddle or fishing trip if conditions and current rules allow.',bring:'Water, sun protection, and a fitted life jacket if boating.',access:'The state lists a public boat launch. Confirm parking, launch restrictions, fishing rules, and facilities before leaving.',url:'https://dem.ri.gov/natural-resources-bureau/fish-wildlife/freshwater-fishing/public-boat-launching-sites',source:'Rhode Island DEM launch directory'},
    {id:'park-stewardship',category:'Stewardship',title:'Find a public-land volunteer day',place:'United States · choose an opportunity near you',time:'Set by the host',plan:'Use the National Park Service directory to find an approved workday. Ask the host about the task, age requirements, and whether equipment is provided. Afterward, log your hours in Conserve.',bring:'Use the host’s equipment and clothing list.',access:'Confirm the meeting location, accessibility, availability, and registration with the host.',url:'https://www.nps.gov/subjects/volunteer/become.htm',source:'National Park Service volunteer directory'}
  ];
  const stamps = ['Habitat detectives','Follow the rain','Leave it better'];
  const id = name => document.getElementById(name);
  const key = 'wildheritage.adventures.v1';
  let data = {};
  try { data=JSON.parse(localStorage.getItem(key))||{}; } catch {}
  data.stamps=Array.isArray(data.stamps)?data.stamps:[];
  data.journal=Array.isArray(data.journal)?data.journal:[];
  function save(next) {
    try { localStorage.setItem(key,JSON.stringify(next)); data=next; return true; }
    catch { id('adventureStatus').textContent='This device could not save the change.'; return false; }
  }
  const element=(tag,value)=>{
    const node=document.createElement(tag);
    node.textContent=value;
    return node;
  };
  function button(label,action) {
    const node=element('button',label);
    node.type='button';
    node.onclick=action;
    return node;
  }
  async function share(text,url) {
    try {
      if(navigator.share) await navigator.share({title:'Wild Heritage',text,...(url?{url}:{})});
      else {
        await navigator.clipboard.writeText([text,url].filter(Boolean).join('\n'));
        id('adventureStatus').textContent='Copied for sharing.';
      }
    } catch (error) {
      if(error.name!=='AbortError')id('adventureStatus').textContent='Sharing was unavailable on this device.';
    }
  }
  function download(outing) {
    const body=[outing.title,outing.place,outing.time,outing.plan,'Bring: '+outing.bring,'Access and facilities: '+outing.access,'Official source: '+outing.url,'Source checked November 6, 2026. This field card contains notes. Download maps separately.'].join('\n\n');
    const url=URL.createObjectURL(new Blob([body],{type:'text/plain;charset=utf-8'}));
    const anchor=document.createElement('a');
    anchor.href=url;
    anchor.download=outing.id+'-field-card.txt';
    anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function renderOutings() {
    const category=id('adventureFilter').value;
    id('adventureCards').replaceChildren(...outings.filter(o=>!category||o.category===category).map(o=>{
      const card=element('article','');
      card.className='card';
      card.id='outing-'+o.id;
      const source=element('a',o.source);
      source.href=o.url;
      source.target='_blank';
      source.rel='noopener';
      card.append(element('h3',o.title),element('p',o.category+' · '+o.place+' · '+o.time),element('p',o.plan),element('p','Bring: '+o.bring),element('p',o.access),source,element('p','Official source checked November 6, 2026.'));
      const actions=element('div','');
      actions.className='row';
      actions.append(button('Share outing',()=>share(o.title,new URL('./#outing-'+o.id,location.href).href)),button('Download field notes',()=>download(o)));
      card.append(actions);
      return card;
    }));
  }
  function renderPassport() {
    id('passportCount').textContent=data.stamps.length+' of '+stamps.length+' stamps earned on this device.';
    id('passportStamps').replaceChildren(...stamps.map(stamp=>{
      const earned=data.stamps.includes(stamp);
      const control=button((earned?'✓ ':'Earn stamp · ')+stamp,()=>{
        if(save({...data,stamps:earned?data.stamps.filter(s=>s!==stamp):[...data.stamps,stamp]}))renderPassport();
      });
      control.setAttribute('aria-pressed',String(earned));
      return control;
    }));
  }
  function renderJournal() {
    id('tripEntries').replaceChildren(...data.journal.slice().reverse().map(entry=>{
      const item=element('li',entry.activity+' · '+entry.date+' · '+entry.text+' ');
      item.append(button('Share summary',()=>share('I went out with Wild Heritage. Activity: '+entry.activity+'. Date: '+entry.date+'.',new URL('./',location.href).href)),button('Delete',()=>{
        if(confirm('Delete this trip entry?')&&save({...data,journal:data.journal.filter(e=>e!==entry)}))renderJournal();
      }));
      return item;
    }));
  }
  id('adventureFilter').onchange=renderOutings;
  id('tripForm').onsubmit=event=>{
    event.preventDefault();
    const text=id('tripText').value.trim();
    if(!text)return;
    const entry={activity:id('tripActivity').value,date:new Date().toLocaleDateString(),text};
    if(save({...data,journal:[...data.journal,entry]})){
      id('tripText').value='';
      renderJournal();
    }
  };
  function openSharedOuting(){
    const outing=outings.find(o=>location.hash==='#outing-'+o.id);
    if(!outing)return;
    id('homeBtn').click();
    id('adventureFilter').value=outing.category;
    renderOutings();
    requestAnimationFrame(()=>id('outing-'+outing.id).scrollIntoView());
  }
  window.addEventListener('hashchange',openSharedOuting);
  renderOutings();
  renderPassport();
  renderJournal();
  openSharedOuting();
})();
