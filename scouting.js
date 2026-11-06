(() => {
  const ri = 'https://services2.arcgis.com/S8zZg9pg23JUEexQ/arcgis/rest/services/';
  const dem = 'https://dem.ri.gov/natural-resources-bureau/fish-wildlife/hunting';
  const parcels = 'https://risegis.ri.gov/hosting/rest/services/RIDEM/Tax_Parcels/MapServer/0';
  const layers = [
    {name:'RI tax parcels', url:parcels, zoom:16, color:'#f3a32d', title:'PlatLot',
      fields:{Acres:'Mapped acres',Last_UPD:'Source update',E911Desc:'Land use',PctForest:'Forest cover (%)'}},
    {name:'RI state conservation', url:ri+'ENV_Conservation_Lands_State_spf/FeatureServer/0', zoom:10, color:'#087b50', title:'NAME',
      fields:{DEM_AREA:'DEM area',ACQ_TYPE:'Protection type',ManArea:'Management area',Pub_Access:'Dataset access code',HUNTING:'Dataset hunting code',Acres:'Mapped acres'}},
    {name:'RI local conservation', url:ri+'ENV_Conservation_Lands_Local_spf/FeatureServer/0', zoom:10, color:'#2178c5', title:'Com_Name', fields:{GIS_Acre:'Mapped acres',P_Year:'Protection year'}}
  ];
  const id = name => document.getElementById(name);
  const key = 'wildheritage.scouting.v1';
  let records = [];
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(saved)) records = saved;
  } catch {}
  const workTypes = ['Habitat restoration','Invasive species monitoring','Trail maintenance','Litter cleanup','Wildlife monitoring','Other stewardship'];
  const mastLevels = ['None','Light','Moderate','Heavy'];
  const validPoint = p => Array.isArray(p) && p.length===2 && p.every(Number.isFinite) && Math.abs(p[0])<=90 && Math.abs(p[1])<=180;
  const validCount = (value,min,max) => Number.isInteger(value) && value>=min && value<=max;
  function validRecord(entry) {
    if (!entry || typeof entry.time!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(entry.time) ||
        !Number.isFinite(Date.parse(entry.time)) || typeof entry.notes!=='string' || entry.notes.length>500) return false;
    if (entry.kind==='sit') return validCount(entry.minutes,1,1440) && validCount(entry.deer,0,1000);
    if (entry.kind==='mast') return validPoint(entry.point) && mastLevels.includes(entry.mast);
    return entry.kind==='work' && validPoint(entry.point) && workTypes.includes(entry.work) && validCount(entry.minutes,1,1440);
  }
  records=records.filter(validRecord);
  const directions=['N','NE','E','SE','S','SW','W','NW','Calm','Unknown'];
  const seasonFor=time=>['Winter','Spring','Summer','Fall'][Math.floor(Number(time.slice(5,7))%12/3)];
  let preferences={};
  try { preferences=JSON.parse(localStorage.getItem('wildheritage.mapPreferences'))||{}; } catch {}
  let activeMode;
  let applyPreferences;
  let map;
  let workPins;
  let pins;
  let selectedPoint;
  const windows = ['5–9 AM','9 AM–1 PM','1–5 PM','5–9 PM','9 PM–5 AM'];
  function insights() {
    const groups = windows.map(label => ({label,hours:0,deer:0,count:0}));
    pins?.clearLayers();
    workPins?.clearLayers();
    const work = records.filter(entry=>entry.kind==='work');
    id('workSummary').textContent=work.length+' stewardship visits · '+(work.reduce((total,entry)=>total+entry.minutes,0)/60).toFixed(1)+' hours contributed';
    for (const entry of records) {
      if (entry.kind === 'sit') {
        if(id('filterSeason').value && seasonFor(entry.time)!==id('filterSeason').value)continue;
        if(id('filterWind').value && (entry.wind||'Unknown')!==id('filterWind').value)continue;
        const hour = Number(entry.time.slice(11,13));
        const group = groups[hour>=5&&hour<9?0:hour>=9&&hour<13?1:hour>=13&&hour<17?2:hour>=17&&hour<21?3:4];
        group.hours += entry.minutes / 60;
        group.deer += entry.deer;
        group.count++;
      } else if (pins) {
        const note = document.createElement('div');
        const stewardship=entry.kind==='work';
        note.textContent = (stewardship?entry.work+' · '+entry.minutes+' min':'Acorn mast: '+entry.mast)+' · '+entry.time.replace('T',' ')+' '+entry.notes;
        L.circleMarker(entry.point,{radius:7,color:stewardship?'#123f37':'#703d16',fillColor:stewardship?'#38c6a3':'#f3a32d',fillOpacity:.9}).bindPopup(note).addTo(stewardship?workPins:pins);
      }
    }
    id('scoutInsights').replaceChildren(...groups.filter(g=>g.count).sort((a,b)=>b.deer/b.hours-a.deer/a.hours).map(g=>{
      const row=document.createElement('li');
      row.textContent=g.label+' starts · '+(g.deer/g.hours).toFixed(2)+' deer/hour · '+g.count+' sits · '+g.hours.toFixed(1)+' hours'+(g.count<3?' · early signal':'');
      return row;
    }));
    const matching=groups.reduce((count,group)=>count+group.count,0);
    id('scoutSummary').textContent=matching+' matching sits. Windows with fewer than 3 sits are marked early signal. Sits are grouped by local start time. Log zero-sighting sits too. Small samples and where you choose to sit affect the results.';
    id('scoutHistory').replaceChildren(...records.slice().reverse().map(entry=>{
      const row=document.createElement('li');
      row.textContent=entry.time.replace('T',' ')+' · '+(entry.kind==='sit'?entry.deer+' deer in '+entry.minutes+' min':entry.kind==='work'?entry.work+' · '+entry.minutes+' min':'Acorn mast: '+entry.mast)+(entry.notes?' · '+entry.notes:'')+' ';
      const remove=document.createElement('button');
      remove.type='button';
      remove.textContent='Delete';
      remove.onclick=()=>{if(confirm('Delete this observation?')) save(records.filter(r=>r!==entry));};
      row.append(remove);
      return row;
    }));
  }
  function save(next) {
    try { localStorage.setItem(key,JSON.stringify(next)); }
    catch { id('scoutStatus').textContent='Could not save this change. Device storage may be full.'; return false; }
    records=next;
    insights();
    return true;
  }
  function setupLog() {
    const form=id('scoutForm');
    const kind=id('scoutKind');
    const refresh=()=>{
      const mast=kind.value==='mast';
      const work=kind.value==='work';
      id('sitFields').hidden=mast;
      id('workFields').hidden=!work;
      id('deerFields').hidden=work;
      id('windField').hidden=mast||work;
      id('mastFields').hidden=!mast;
      id('scoutMinutes').disabled=mast;
      id('scoutDeer').disabled=mast||work;
    };
    id('scoutWork').replaceChildren(...workTypes.map(label=>new Option(label)));
    id('scoutWind').replaceChildren(...['Unknown',...directions.filter(d=>d!=='Unknown')].map(d=>new Option(d)));
    id('filterWind').replaceChildren(new Option('All winds',''),...directions.map(d=>new Option(d)));
    id('filterSeason').onchange=insights;
    id('filterWind').onchange=insights;
    kind.onchange=refresh;
    refresh();
    const now=new Date();
    id('scoutTime').value=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
    form.onsubmit=event=>{
      event.preventDefault();
      const point=selectedPoint?.() || map?.getCenter();
      const entry={kind:kind.value,time:id('scoutTime').value,notes:id('scoutNotes').value.trim()};
      if (kind.value!=='sit') {
        if (!point) { id('scoutStatus').textContent='Open the map before adding a mapped observation.'; return; }
        entry.point=[point.lat,point.lng];
        if(kind.value==='mast') entry.mast=id('scoutMast').value;
        else { entry.work=id('scoutWork').value; entry.minutes=id('scoutMinutes').valueAsNumber; }
      } else {
        entry.minutes=id('scoutMinutes').valueAsNumber;
        entry.deer=id('scoutDeer').valueAsNumber;
        entry.wind=id('scoutWind').value;
      }
      if(validRecord(entry) && save([...records,entry])) {
        id('scoutNotes').value='';
        id('scoutStatus').textContent='Observation saved on this device.';
      }
    };
    id('scoutExport').onclick=()=>{
      const url=URL.createObjectURL(new Blob([JSON.stringify({format:'wild-heritage-observations',version:1,records},null,2)],{type:'application/json'}));
      const link=document.createElement('a');
      link.href=url;
      link.download='wild-heritage-observations.json';
      link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    id('scoutImport').onchange=async event=>{
      const file=event.target.files[0];
      if(!file)return;
      try {
        if(file.size>10_000_000)throw Error();
        const backup=JSON.parse(await file.text());
        if(backup.format!=='wild-heritage-observations'||backup.version!==1||!Array.isArray(backup.records)||!backup.records.every(validRecord))throw Error();
        const signature=({kind,time,notes,minutes,deer,mast,work,point,wind})=>JSON.stringify([kind,time,notes,minutes,deer,mast,work,point,wind||"Unknown"]);
        const existing=new Set(records.map(signature));
        const additions=backup.records.filter(entry=>{
          const key=signature(entry);
          if(existing.has(key))return false;
          existing.add(key);
          return true;
        });
        if(save([...records,...additions]))id('scoutStatus').textContent=additions.length+' new observations imported.';
      } catch { id('scoutStatus').textContent='Could not import this observations backup.'; }
      finally { event.target.value=''; }
    };
    insights();
  }
  id('loadWeather').onclick=async event=>{
    const button=event.currentTarget;
    const status=id('weatherStatus');
    const results=id('weatherHours');
    const point=selectedPoint?.()||map?.getCenter();
    if(!point){status.textContent='Select a point on the map first.';return;}
    const coordinates=point.lat.toFixed(3)+','+point.lng.toFixed(3);
    button.disabled=true;
    results.replaceChildren();
    status.textContent='Loading NWS forecast for '+coordinates+'…';
    try {
      const request=async url=>{
        const response=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/geo+json'}});
        if(!response.ok)throw Error();
        return response.json();
      };
      const grid=await request('https://api.weather.gov/points/'+coordinates);
      const url=new URL(grid.properties.forecastHourly);
      if(url.origin!=='https://api.weather.gov')throw Error();
      const forecast=await request(url);
      for(const hour of forecast.properties.periods.slice(0,12)){
        const row=document.createElement('li');
        const time=new Intl.DateTimeFormat(undefined,{hour:'numeric',weekday:'short',timeZone:grid.properties.timeZone}).format(new Date(hour.startTime));
        const rain=hour.probabilityOfPrecipitation?.value;
        row.textContent=time+' · '+hour.windDirection+' '+hour.windSpeed+' · '+hour.temperature+'°'+hour.temperatureUnit+' · '+hour.shortForecast+(rain==null?'':' · '+rain+'% precipitation');
        results.append(row);
      }
      status.textContent='NWS hourly forecast for '+coordinates+' · '+grid.properties.timeZone.replaceAll('_',' ');
    }catch{status.textContent='Forecast unavailable for '+coordinates+'. Check your connection or choose another U.S. location.';}
    finally{button.disabled=false;}
  };
  window.scouting = {
    show(mode){
      activeMode=mode;
      applyPreferences?.();
      const panel=id('scouting');
      panel.hidden=mode!=='hunt'&&mode!=='conserve';
      id('huntingInsights').hidden=mode!=='hunt';
      id('scoutKind').value=mode==='conserve'?'work':'sit';
      id('scoutKind').onchange();
    },
    attach(instance, streets, getPoint) {
      map=instance;
      selectedPoint=getPoint;
      const national='https://basemap.nationalmap.gov/arcgis/rest/services/';
      const tiles=(service)=>L.tileLayer(national+service+'/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:16,maxZoom:19,attribution:'USGS The National Map'});
      pins=L.layerGroup().addTo(map);
      workPins=L.layerGroup().addTo(map);
      const protectedAreas=L.tileLayer('https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/PADUS3_0PublicAccess/MapServer/tile/{z}/{y}/{x}',{
        maxZoom:19,opacity:.65,attribution:'USGS GAP · PAD-US 3.0 (2022)'
      });
      const ExportTiles=L.TileLayer.extend({
        getTileUrl(coords){
          const crs=L.CRS.EPSG3857;
          const nw=crs.project(crs.pointToLatLng(L.point(coords.x*256,coords.y*256),coords.z));
          const se=crs.project(crs.pointToLatLng(L.point((coords.x+1)*256,(coords.y+1)*256),coords.z));
          const query=new URLSearchParams({bbox:[nw.x,se.y,se.x,nw.y].join(','),bboxSR:'3857',imageSR:'3857',size:'256,256',format:'png32',transparent:'true',f:'image'});
          if(this.options.rasterFunction){
            query.set('renderingRule',JSON.stringify({rasterFunction:this.options.rasterFunction}));
          }
          return this._url+'?'+query;
        }
      });
      const wetlands=new ExportTiles('https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/export',{minZoom:11,maxZoom:19,opacity:.7,attribution:'USFWS National Wetlands Inventory'});
      const water=L.tileLayer(national+'USGSHydroCached/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:16,maxZoom:19,opacity:.75,attribution:'USGS National Map hydrography'});
      const overlays={'U.S. rivers & waterbodies':water,'U.S. wetlands':wetlands,'US protected lands (PAD-US 3.0)':protectedAreas,'My acorn observations':pins,'My stewardship work':workPins};
      for(const item of layers) {
        const group=L.geoJSON(null,{
          style:{color:item.color,weight:2,fillOpacity:item.title==='PlatLot'?.08:.22},
          onEachFeature(feature,layer){
            const data=feature.properties||{};
            const panel=document.createElement('div');
            const heading=document.createElement('strong');
            heading.textContent=data[item.title]||item.name;
            panel.append(heading);
            for(const [field,label] of Object.entries(item.fields||{})){
              if(data[field]==null||data[field]==='') continue;
              const line=document.createElement('div');
              line.textContent=label+': '+data[field];
              panel.append(line);
            }
            const link=document.createElement('a');
            link.href=item.title==='PlatLot'?'https://www.rigis.org/pages/municipal-gis-resources':dem;
            link.target='_blank';link.rel='noopener';
            link.textContent=item.title==='PlatLot'?'Municipal assessor resources':'Check official DEM maps and rules';
            panel.append(link);
            layer.bindPopup(panel);
            const labelZoom=item.title==='PlatLot'?17:13;
            const labelText=data[item.title];
            if(labelText!=null&&String(labelText).trim()&&map.getZoom()>=labelZoom){
              const mapLabel=document.createElement('span');
              mapLabel.textContent=String(labelText);
              layer.bindTooltip(mapLabel,{permanent:true,direction:'center',className:'boundary-label',interactive:false});
            }
          }
        });
        overlays[item.name]=group;
        const status=document.createElement('div');
        status.hidden=true;
        id('layerStatus').append(status);
        let controller;
        let timer;
        async function load(){
          controller?.abort();
          group.clearLayers();
          if(!map.hasLayer(group)){status.hidden=true;return;}
          status.hidden=false;
          if(map.getZoom()<item.zoom){status.textContent=item.name+' · zoom in to '+item.zoom;return;}
          const bounds=map.getBounds();
          if(!bounds.intersects(L.latLngBounds([41.14,-71.91],[42.03,-71.11]))){
            status.textContent=item.name+' · Rhode Island coverage';return;
          }
          const request=new AbortController();
          controller=request;
          const query=new URLSearchParams({f:'geojson',where:'1=1',geometry:bounds.toBBoxString(),geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:[item.title,...Object.keys(item.fields||{})].join(','),returnZ:'false',returnM:'false',resultRecordCount:'1200'});
          status.textContent=item.name+' · loading…';
          try{
            const response=await fetch(item.url+'/query?'+query,{signal:request.signal});
            const data=await response.json();
            if(!response.ok||!Array.isArray(data.features)) throw Error('Invalid layer response');
            if(request.signal.aborted||!map.hasLayer(group))return;
            group.addData(data);
            status.textContent=item.name+' · '+(data.features.length>=1200?'zoom in for complete results':data.features.length+' features in view');
          }catch(error){
            if(!request.signal.aborted)status.textContent=item.name+' · source unavailable. Pan or toggle to retry.';
          }
        }
        group.on('add remove',load);
        map.on('moveend',()=>{clearTimeout(timer);timer=setTimeout(load,180);});
        if(item.name==='RI state conservation')group.addTo(map);
      }
      const basemaps={Streets:streets,'USGS topographic':tiles('USGSTopo'),'USGS aerial imagery':tiles('USGSImageryOnly'),'USGS hybrid imagery + topo':tiles('USGSImageryTopo'),'USGS shaded relief':tiles('USGSShadedReliefOnly')};
      const elevation='https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage';
      const terrainFunctions={
        'Bare-earth hillshade':'Hillshade',
        'Elevation colors':'Elevation Tinted Hillshade',
        'Slope steepness':'Slope Map',
        'Slope direction':'Aspect Map'
      };
      const terrain=Object.fromEntries(Object.entries(terrainFunctions).map(([name,rasterFunction])=>[name,
        new ExportTiles(elevation,{rasterFunction,maxNativeZoom:17,maxZoom:19,attribution:'USGS 3DEP bare-earth elevation'})
      ]));
      Object.assign(basemaps,terrain);
      const panel=id('layersDashboard');
      const groups=[
        ['Basemap',Object.fromEntries(Object.entries(basemaps).filter(([name])=>!Object.hasOwn(terrain,name))),true],
        ['Terrain views',terrain,true],
        ['Land & access',Object.fromEntries(Object.entries(overlays).filter(([name])=>!name.startsWith('My ')&&name!=='U.S. wetlands'&&name!=='U.S. rivers & waterbodies')),false],
        ['Water & habitat',{'U.S. wetlands':wetlands,'U.S. rivers & waterbodies':water},false],
        ['My fieldwork',Object.fromEntries(Object.entries(overlays).filter(([name])=>name.startsWith('My '))),false]
      ];
      const hints={
        'Bare-earth hillshade':'USGS 3DEP · ground relief with canopy excluded from the elevation model',
        'Elevation colors':'USGS 3DEP · color and shadow show elevation changes',
        'Slope steepness':'USGS 3DEP · compare steep and gentle ground',
        'Slope direction':'USGS 3DEP · shows the direction a slope faces',
        'U.S. rivers & waterbodies':'USGS National Map · streams, lakes and water features',
        'U.S. wetlands':'National Wetlands Inventory · zoom 11+ · mapped habitat',
        Streets:'Roads, paths and place names',
        'USGS topographic':'Contours and mapped features',
        'USGS aerial imagery':'Overhead photography',
        'USGS hybrid imagery + topo':'Photography with map detail',
        'USGS shaded relief':'Shaded terrain shape',
        'RI tax parcels':'Rhode Island reference boundaries · zoom 16+ · parcel IDs at 17+',
        'RI state conservation':'Rhode Island state conservation · names at zoom 13+',
        'RI local conservation':'Rhode Island local conservation · zoom 10+',
        'US protected lands (PAD-US 3.0)':'U.S. protected areas · check official access rules',
        'My acorn observations':'Acorn checks saved on this device',
        'My stewardship work':'Stewardship visits saved on this device'
      };
      const controls=[];
      for(const [title,layers,base] of groups){
        const field=document.createElement('fieldset');
        const legend=document.createElement('legend');
        legend.textContent=title;
        field.append(legend);
        for(const [name,layer] of Object.entries(layers)){
          const label=document.createElement('label');
          const input=document.createElement('input');
          input.type=base?'radio':'checkbox';
          if(base)input.name='wildheritage-basemap';
          const nameText=document.createElement('span');
          nameText.textContent=name;
          const hint=document.createElement('small');
          hint.textContent=hints[name];
          label.append(input,nameText,hint);
          field.append(label);
          controls.push({input,layer});
          input.onchange=()=>{
            if(base){
              Object.values(basemaps).forEach(other=>{if(other!==layer)map.removeLayer(other);});
              map.addLayer(layer);
            }else if(input.checked)map.addLayer(layer);
            else map.removeLayer(layer);
            savePreferences();
            syncControls();
          };
        }
        id('layerChoices').append(field);
      }
      function syncControls(){
        for(const {input,layer} of controls)input.checked=map.hasLayer(layer);
        const count=Object.values(overlays).filter(layer=>map.hasLayer(layer)).length;
        id('mapLayers').textContent='Layers · '+count+' on';
      }
      id('mapLayers').onclick=()=>{
        panel.hidden=!panel.hidden;
        id('mapLayers').setAttribute('aria-expanded',String(!panel.hidden));
      };
      id('resetLayers').onclick=()=>{
        delete preferences[activeMode];
        applyPreferences();
        savePreferences();
      };
      id('mapWind').onclick=()=>{
        const weather=id('weatherPanel');
        weather.open=true;
        weather.scrollIntoView({block:'nearest'});
        id('loadWeather').focus();
      };
      id('mapOffline').onclick=()=>{id('offlineInfo').hidden=!id('offlineInfo').hidden;};
      applyPreferences=()=>{

          const defaults=activeMode==='young'?[]:activeMode==='conserve'?['RI local conservation','My stewardship work','U.S. wetlands']:['RI state conservation','My acorn observations'];
          const saved=preferences[activeMode]||{};
          const base=Object.hasOwn(basemaps,saved.base)?saved.base:activeMode==='conserve'?'USGS topographic':'Streets';
          for(const [name,layer] of Object.entries(basemaps)){
            if(name===base)map.addLayer(layer);
            else map.removeLayer(layer);
          }
          const enabled=Array.isArray(saved.overlays)?saved.overlays:defaults;
          for(const [name,layer] of Object.entries(overlays)){
            if(enabled.includes(name))map.addLayer(layer);
            else map.removeLayer(layer);
          }
        syncControls();
      };
      function savePreferences(){
        preferences[activeMode]={
          base:Object.keys(basemaps).find(name=>map.hasLayer(basemaps[name])),
          overlays:Object.keys(overlays).filter(name=>map.hasLayer(overlays[name]))
        };
        try { localStorage.setItem('wildheritage.mapPreferences',JSON.stringify(preferences)); } catch {}
      }
      applyPreferences();
      insights();
    }
  };
  setupLog();
})();
