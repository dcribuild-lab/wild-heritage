(() => {
  const id = name => document.getElementById(name);
  let route = [];
  const routes = new Map();
  let line;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], {type}));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function renderRoute() {
    line?.setLatLngs(route);
    id('routeCount').textContent = route.length + ' route points';
  }
  window.fieldTools = {
    show(mode) {
      if (!routes.has(mode)) routes.set(mode, []);
      route = routes.get(mode);
      id('drawRoute').checked = false;
      id('fieldNotes').value = '';
      renderRoute();
    },
    attach(map, waypoints) {
      line = L.polyline(route, {color:'#df7b1c', weight:4, interactive:false}).addTo(map);
      map.on('click', event => {
        if (!id('drawRoute').checked) return;
        route.push(event.latlng);
        renderRoute();
      });
      id('routeUndo').onclick = () => { route.pop(); renderRoute(); };
      id('saveFieldPack').onclick = () => {
        const pins = waypoints().filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
        const points = [...route, ...pins];
        if (!points.length) {
          id('routeCount').textContent = 'Add a route point or save a waypoint first.';
          return;
        }
        const bounds = L.latLngBounds(points);
        const center = bounds.getCenter();
        const longitudeScale = Math.max(.01, Math.cos(center.lat * Math.PI / 180));
        const scale = 300 / Math.max(.001, bounds.getNorth()-bounds.getSouth(), (bounds.getEast()-bounds.getWest())*longitudeScale);
        const xy = p => [200+(p.lng-center.lng)*longitudeScale*scale,200-(p.lat-center.lat)*scale];
        const drawing = '<svg viewBox="0 0 400 400" width="400" style="max-width:100%;background:#eaf0e1" role="img" aria-label="North-up route sketch"><text x="18" y="30">↑ N</text><polyline points="'+route.map(p=>xy(p).join(',')).join(' ')+'" fill="none" stroke="#a34900" stroke-width="3"/>'+pins.map((p,i)=>{const [x,y]=xy(p);return '<circle cx="'+x+'" cy="'+y+'" r="6" fill="#164434"/><text x="'+(x+9)+'" y="'+y+'">'+(i+1)+'</text>';}).join('')+'</svg>';
        const coordinates = p => p.lat.toFixed(5)+', '+p.lng.toFixed(5);
        download('wild-heritage-field-pack.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wild Heritage field pack</title><main style="font:16px system-ui;max-width:42rem;margin:auto;padding:1rem"><h1>Wild Heritage field pack</h1><p>North-up sketch of your points. Verify access and bring a reliable navigation map. Route segments are straight connections between selected points.</p>'+drawing+'<h2>Route points</h2><ol>'+route.map(p=>'<li>'+coordinates(p)+'</li>').join('')+'</ol><h2>Waypoints</h2><ol>'+pins.map(p=>'<li><strong>'+escape(p.name)+'</strong> · '+coordinates(p)+'<p>'+escape(p.notes||'')+'</p></li>').join('')+'</ol><h2>Field notes</h2><p style="white-space:pre-wrap">'+escape(id('fieldNotes').value)+'</p></main></html>','text/html;charset=utf-8');
      };
    }
  };

  const key = 'wildheritage.projectDrafts';
  let drafts = [];
  try { const saved=JSON.parse(localStorage.getItem(key)); if(Array.isArray(saved))drafts=saved; } catch {}
  const fields = ['projectName','projectPartner','projectArea','projectWork','projectMilestone'];
  function saveDrafts(next) {
    try { localStorage.setItem(key,JSON.stringify(next)); drafts=next; renderDrafts(); }
    catch { id('projectStatus').textContent='Could not save drafts on this device.'; }
  }
  function renderDrafts() {
    id('projectDrafts').replaceChildren(...drafts.map((draft,index)=>{
      const row=document.createElement('li');
      row.textContent=draft.projectName+' · '+draft.projectArea+' · '+(draft.projectPartner||'Partner pending')+' ';
      const edit=document.createElement('button');
      edit.textContent='Edit draft';
      edit.onclick=()=>{
        fields.forEach(field=>{id(field).value=draft[field]||'';});
        id('projectIndex').value=String(index);
        id('projectName').focus();
      };
      row.append(edit);
      return row;
    }));
  }
  id('projectForm').onsubmit=event=>{
    event.preventDefault();
    const draft=Object.fromEntries(fields.map(field=>[field,id(field).value.trim()]));
    if(!draft.projectName||!draft.projectArea||!draft.projectWork)return;
    const next=[...drafts];
    const index=id('projectIndex').value;
    if(index==='')next.push(draft);
    else next[Number(index)]=draft;
    saveDrafts(next);
    event.target.reset();
    id('projectIndex').value='';
  };
  id('exportProjects').onclick=()=>download('wild-heritage-project-drafts.json',JSON.stringify({version:1,projects:drafts},null,2),'application/json');
  renderDrafts();
})();
