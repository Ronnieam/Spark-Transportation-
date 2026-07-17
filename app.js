const STORAGE_KEY='sparkTransportationData';
const MIGRATION_FLAG='sparkTransportationMigratedFrom';
const LEGACY_KEYS=[
 'sparkTransportationPWA1','sparkTransportationV03','sparkTransportationV04',
 'sparkTransportationV05','sparkTransportationV07','sparkTransportationV1Beta',
 'sparkTransportationV1Beta1','sparkTransportationV1Beta2','sparkTransportationV1Beta3',
 'sparkTransportationV1Beta4','sparkTransportationV1Beta5','sparkTransportationV1Beta6',
 'sparkTransportationV1Beta7','sparkTransportationV1Beta8','sparkTransportationV1Beta9',
 'sparkTransportationV1Beta10'
];

function findLegacyData(){
  const keys=[...LEGACY_KEYS];
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(k&&k!==STORAGE_KEY&&k.toLowerCase().includes('sparktransportation'))keys.push(k);
  }
  for(const key of [...new Set(keys)]){
    const raw=localStorage.getItem(key);
    if(!raw)continue;
    try{
      const data=JSON.parse(raw);
      if(data&&typeof data==='object')return {key,data};
    }catch(e){}
  }
  return null;
}

function loadPersistentState(defaultState){
  const current=localStorage.getItem(STORAGE_KEY);
  if(current){
    try{return {...defaultState,...JSON.parse(current)};}catch(e){}
  }
  const legacy=findLegacyData();
  if(legacy){
    const merged={...defaultState,...legacy.data};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(merged));
    localStorage.setItem(MIGRATION_FLAG,legacy.key);
    return merged;
  }
  return defaultState;
}

function savePersistentState(state){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
}

function exportState(state){
  const payload={app:'Spark Transportation',version:'3.0.1',exportedAt:new Date().toISOString(),data:state};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='spark-transportation-backup-'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function importState(file,onSuccess,onError){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(reader.result);
      const restored=parsed.data||parsed;
      if(!restored||typeof restored!=='object'||!Array.isArray(restored.entries))throw new Error('Invalid');
      localStorage.setItem(STORAGE_KEY,JSON.stringify(restored));
      onSuccess(restored);
    }catch(e){onError(e);}
  };
  reader.readAsText(file);
}


const defaults={
 driverName:'',driverId:'',hireDate:'',ptoTierOverride:'auto',fiscalYearStart:'',mileageRate:.679,weekendRate:.749,
 liveLoadRate:12.75,liveUnloadRate:12.75,waitRate:17,manualAdp:0,
 hookRate:10,stopRate:12.75,arriveRate:12.75,arriveDropRate:12.75,
 layoverRate:42,chainRate:60,regionalRate:6
};
const DEFAULT_QUICK_ACTIVITY_ORDER=[
 'Live Load','Live Unload','Breakdown','Hook','Stop','Arrive',
 'Arrive Drop','Layover','Chain','Regional Pay','Meeting','Survey','Training'
];
const baseState={
 setup:{...defaults},
 active:null,
 locations:[],
 activeLocationIndex:null,
 entries:[],
 savedLocations:[],
 expandedSavedLocationId:null,
 locationFavorites:[],
 recentLocationIds:[],
 builtInLocationVersion:'',
 editingEntryIndex:null,
 quickActivityOrder:[...DEFAULT_QUICK_ACTIVITY_ORDER],
 payPeriodStart:'',
 payPeriodEnd:'',
 payPeriods:[],
 selectedPayPeriodId:null,
 pto:{
  balance:0,
  earnedThisFiscalYear:0,
  usedThisFiscalYear:0,
  safetyEarnedHours:0,
  carryoverHours:0,
  workedHoursProgress:0,
  earnedDaysThisFiscalYear:0,
  safetyQuarters:{},
  ledger:[],
  fiscalArchives:[],
  fiscalYearStart:'',
  lastProcessedEntryIds:[]
 },
 benefits:{
  calendarYear:new Date().getFullYear(),
  fmlAnnualHours:50,
  fmlUsedHours:0,
  bereavementUsedHours:0,
  ledger:[],
  calendarArchives:[]
 }
};
let state=loadPersistentState(baseState);
state.setup={...defaults,...(state.setup||{})};
if(!state.setup.hireDate&&state.hireDate)state.setup.hireDate=state.hireDate;
if(!String(state.setup.ptoTierOverride||'').trim())state.setup.ptoTierOverride='auto';

state.entries=Array.isArray(state.entries)?state.entries:[];
state.savedLocations=Array.isArray(state.savedLocations)?state.savedLocations:[];
state.expandedSavedLocationId=state.expandedSavedLocationId||null;
state.locationFavorites=Array.isArray(state.locationFavorites)?state.locationFavorites:[];
state.recentLocationIds=Array.isArray(state.recentLocationIds)?state.recentLocationIds:[];
state.builtInLocationVersion=state.builtInLocationVersion||'';
function loadBuiltInLocationDatabase(){
 try{
  if(!Array.isArray(state.savedLocations))state.savedLocations=[];
  if(!Array.isArray(window.BUILT_IN_DC_LOCATIONS))return;
  let changed=false;
  window.BUILT_IN_DC_LOCATIONS.forEach(location=>{
   if(!location||!location.number)return;
   const existingIndex=state.savedLocations.findIndex(existing=>
    String(existing&&existing.type||'').toLowerCase()==='dc' &&
    String(existing&&existing.number||'').trim()===String(location.number).trim()
   );
   if(existingIndex===-1){
    state.savedLocations.push({...location});
    changed=true;
   }else{
    const existing=state.savedLocations[existingIndex]||{};
    ['latitude','longitude','city','state','name','address','phone','notes'].forEach(key=>{
     if(!existing[key]&&location[key])existing[key]=location[key];
    });
    existing.builtIn=true;
    state.savedLocations[existingIndex]=existing;
   }
  });
  if(state.builtInLocationVersion!==window.BUILT_IN_LOCATION_VERSION){
   state.builtInLocationVersion=window.BUILT_IN_LOCATION_VERSION;
   changed=true;
  }
  if(changed)savePersistentState(state);
 }catch(error){
  console.error('Location database load failed:',error);
 }
}




(state.entries||[]).forEach(entry=>(entry.locations||[]).forEach(location=>(location.activities||[]).forEach(activity=>{
 if(activity.type==='Wait Time'){
  activity.paidHours=Math.round(num(activity.hours)*100)/100;
  activity.unpaidThresholdHours=0;
  activity.pay=activity.paidHours*num(activity.rate);
 }
})));
(state.locations||[]).forEach(location=>(location.activities||[]).forEach(activity=>{
 if(activity.type==='Wait Time'){
  activity.paidHours=Math.round(num(activity.hours)*100)/100;
  activity.unpaidThresholdHours=0;
  activity.pay=activity.paidHours*num(activity.rate);
 }
}));

state.locations=Array.isArray(state.locations)?state.locations:[];
state.quickActivityOrder=Array.isArray(state.quickActivityOrder)?state.quickActivityOrder:[];
state.quickActivityOrder=[
 ...state.quickActivityOrder.filter(name=>DEFAULT_QUICK_ACTIVITY_ORDER.includes(name)),
 ...DEFAULT_QUICK_ACTIVITY_ORDER.filter(name=>!state.quickActivityOrder.includes(name))
];
state.payPeriods=Array.isArray(state.payPeriods)?state.payPeriods:[];
state.selectedPayPeriodId=state.selectedPayPeriodId||null;
state.pto=state.pto&&typeof state.pto==='object'?state.pto:{};
state.pto={
 balance:Number(state.pto.balance||0),
 earnedThisFiscalYear:Number(state.pto.earnedThisFiscalYear||0),
 usedThisFiscalYear:Number(state.pto.usedThisFiscalYear||0),
 safetyEarnedHours:Number(state.pto.safetyEarnedHours||0),
 carryoverHours:Number(state.pto.carryoverHours||0),
 workedHoursProgress:Number(state.pto.workedHoursProgress||0),
 earnedDaysThisFiscalYear:Number(state.pto.earnedDaysThisFiscalYear||0),
 safetyQuarters:state.pto.safetyQuarters||{},
 ledger:Array.isArray(state.pto.ledger)?state.pto.ledger:[],
 fiscalArchives:Array.isArray(state.pto.fiscalArchives)?state.pto.fiscalArchives:[],
 fiscalYearStart:state.pto.fiscalYearStart||state.setup.fiscalYearStart||'',
 lastProcessedEntryIds:Array.isArray(state.pto.lastProcessedEntryIds)?state.pto.lastProcessedEntryIds:[]
};
state.benefits=state.benefits&&typeof state.benefits==='object'?state.benefits:{};
state.benefits={
 calendarYear:Number(state.benefits.calendarYear||new Date().getFullYear()),
 fmlAnnualHours:Number(state.benefits.fmlAnnualHours||50),
 fmlUsedHours:Number(state.benefits.fmlUsedHours||0),
 bereavementUsedHours:Number(state.benefits.bereavementUsedHours||0),
 ledger:Array.isArray(state.benefits.ledger)?state.benefits.ledger:[],
 calendarArchives:Array.isArray(state.benefits.calendarArchives)?state.benefits.calendarArchives:[]
};


const $=id=>document.getElementById(id);
const num=v=>Number(v||0);

// Correct legacy Live Load / Live Unload values after numeric helpers are ready.
if(num(state.setup.liveLoadRate)===17||!num(state.setup.liveLoadRate))state.setup.liveLoadRate=12.75;
if(num(state.setup.liveUnloadRate)===17||!num(state.setup.liveUnloadRate))state.setup.liveUnloadRate=12.75;

if(!num(state.setup.liveLoadRate))state.setup.liveLoadRate=12.75;
if(!num(state.setup.liveUnloadRate))state.setup.liveUnloadRate=12.75;

function convertLegacyLiveActivity(activity){
 if(!['Live Load','Live Unload'].includes(activity.type))return;
 const configuredRate=12.75;
 const legacyCount=Math.max(1,num(activity.qty)||1);
 activity.kind='flat';
 activity.qty=legacyCount;
 activity.rate=configuredRate;
 activity.pay=legacyCount*configuredRate;
 delete activity.start;
 delete activity.stop;
 delete activity.hours;
 delete activity.paidHours;
 delete activity.unpaidThresholdHours;
}
(state.entries||[]).forEach(entry=>(entry.locations||[]).forEach(location=>(location.activities||[]).forEach(convertLegacyLiveActivity)));
(state.locations||[]).forEach(location=>(location.activities||[]).forEach(convertLegacyLiveActivity));

const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(num(v));
function formatPhone(value){
 const digits=String(value||'').replace(/\D/g,'').slice(0,10);
 if(digits.length<=3)return digits;
 if(digits.length<=6)return digits.slice(0,3)+'-'+digits.slice(3);
 return digits.slice(0,3)+'-'+digits.slice(3,6)+'-'+digits.slice(6);
}
function phoneDigits(value){
 return String(value||'').replace(/\D/g,'').slice(0,10);
}

function parseCurrencyInput(value){
 const cleaned=String(value??'').replace(/[$,\s]/g,'');
 const parsed=Number(cleaned);
 return Number.isFinite(parsed)?parsed:0;
}
function formatCurrencyInput(value){
 return parseCurrencyInput(value).toFixed(2);
}
function displayCurrencyFields(){
 state.setup.liveLoadRate=12.75;
 state.setup.liveUnloadRate=12.75;

 document.querySelectorAll('[data-currency-rate="true"]').forEach(input=>{
  input.value=formatCurrencyInput(input.value);
 });
}

const CURRENCY_SETUP_FIELDS=[
 'liveLoadRate','liveUnloadRate','waitRate','manualAdp','hookRate','stopRate',
 'arriveRate','arriveDropRate','layoverRate','chainRate','regionalRate'
];
function populateSetupFields(){
 Object.keys(defaults).forEach(key=>{
  const input=$(key);
  if(!input)return;
  if(['driverName','driverId','hireDate','ptoTierOverride','fiscalYearStart'].includes(key)){
   input.value=state.setup[key]??'';
  }else if(CURRENCY_SETUP_FIELDS.includes(key)){
   input.value=num(state.setup[key]).toFixed(2);
  }else{
   input.value=state.setup[key]??'';
  }
 });
 state.setup.liveLoadRate=12.75;
 state.setup.liveUnloadRate=12.75;
 displayCurrencyFields();
}

const pageOrder=['home','day','locations','history','reports','pto','setup','data'];
let currentPage='home';

function save(){savePersistentState(state);render();}

function dashboardPrimaryAction(){showPage('day');}
function quickAddActivity(type){
 if(!state.active){showPage('day');return;}
 showPage('day');
 setTimeout(()=>{if($('activityType')){$('activityType').value=type;updateActivityFields();$('activityType').scrollIntoView({behavior:'smooth',block:'center'});}},80);
}
function currentDashboardLocation(){
 if(state.activeLocationIndex===null||!state.locations[state.activeLocationIndex])return null;
 const active=state.locations[state.activeLocationIndex];
 return state.savedLocations.find(l=>l.type===active.type&&String(l.number)===String(active.number))||active;
}
function toggleDashboardLocation(){
 const box=$('dashboardLocationDetails');box.classList.toggle('hidden');
 $('locationToggle').textContent=box.classList.contains('hidden')?'Details':'Hide';
}
function callDashboardLocation(){const l=currentDashboardLocation();if(!l||!l.phone){alert('No phone number saved for the current location.');return;}callLocation(l.phone,l.extension||'');}
function directionsDashboardLocation(){const l=currentDashboardLocation();if(!l){alert('No current location selected.');return;}mapLocation(l);}
function greetingForNow(){const h=new Date().getHours();return h<12?'Good Morning':h<18?'Good Afternoon':'Good Evening';}
function lastCompletedDay(){
 return state.entries&&state.entries.length?state.entries[state.entries.length-1]:null;
}


function showPage(id){
 const target=$(id);
 if(!target){
  console.warn('Page not found:',id);
  return;
 }
 document.querySelectorAll('section').forEach(s=>s.classList.remove('active'));
 target.classList.add('active');
 currentPage=id;
 document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===id));
 if(id==='setup')populateSetupFields();
 try{render();}catch(error){
  console.error('Render error:',error);
  console.error('The page could not finish loading. Your saved data is still protected.');
 }
}
function decimalHours(a,b){if(!a||!b)return 0;const [ah,am]=a.split(':').map(Number),[bh,bm]=b.split(':').map(Number);let m=(bh*60+bm)-(ah*60+am);if(m<0)m+=1440;return Math.round((m/60)*100)/100;}
function hasUnpaid45MinuteThreshold(t){return t==='Breakdown';}
function paidTimedHours(t,totalHours){
 const unpaid=hasUnpaid45MinuteThreshold(t)?0.75:0;
 return Math.max(0,Math.round((num(totalHours)-unpaid)*100)/100);
}
function isTimed(t){return ['Breakdown','Meeting','Survey','Training'].includes(t);}
function defaultRate(t){
 if(t==='Live Load')return 12.75;
 if(t==='Live Unload')return 12.75;
 if(t==='Breakdown')return num(state.setup.waitRate);
 if(['Meeting','Survey','Training'].includes(t))return num(state.setup.manualAdp)/10;
 return {'Hook':state.setup.hookRate,'Stop':state.setup.stopRate,'Arrive':state.setup.arriveRate,'Arrive Drop':state.setup.arriveDropRate,'Layover':state.setup.layoverRate,'Chain':state.setup.chainRate,'Regional Pay':state.setup.regionalRate}[t]||0;
}

function renderHomeActivityRates(){
 document.querySelectorAll('#quickActivityRow .quick-btn[data-activity]').forEach(button=>{
  const activity=button.dataset.activity;
  let rateElement=button.querySelector('.quick-rate');
  if(!rateElement){
   rateElement=document.createElement('span');
   rateElement.className='quick-rate';
   button.appendChild(rateElement);
  }
  rateElement.textContent=`${money(defaultRate(activity))}${isTimed(activity)?'/hr':''}`;
 });
}

function toggleEmbeddedWaitTime(forceOpen=null){
 const fields=$('embeddedWaitFields');
 const button=$('embeddedWaitToggle');
 const open=forceOpen===null?fields.classList.contains('hidden'):forceOpen;
 fields.classList.toggle('hidden',!open);
 button.textContent=open?'Remove Wait Time':'+ Add Wait Time';
 if(!open){
  $('embeddedWaitHours').value='';
  updateEmbeddedWaitPreview();
 }
}
function embeddedWaitValues(){
 const totalHours=Math.max(0,num($('embeddedWaitHours')?.value));
 const paidHours=Math.round(totalHours*100)/100;
 const rate=num(state.setup.waitRate);
 return {totalHours,paidHours,rate,pay:paidHours*rate};
}
function updateEmbeddedWaitPreview(){
 if(!$('embeddedWaitPaidHours'))return;
 const values=embeddedWaitValues();
 $('embeddedWaitPaidHours').textContent=`${values.paidHours.toFixed(2)} hrs`;
 $('embeddedWaitPay').textContent=money(values.pay);
}

function updateActivityFields(){
 const t=$('activityType').value;
 $('timedFields').classList.toggle('hidden',!isTimed(t));
 $('flatFields').classList.toggle('hidden',!t||isTimed(t));
 $('commonFields').classList.toggle('hidden',!t);
 if(!t){
  toggleEmbeddedWaitTime(false);
  return;
 }
 if(isTimed(t))$('activityHourlyRate').value=defaultRate(t);
 else $('activityFlatRate').value=defaultRate(t);
 updateEmbeddedWaitPreview();
}
function startDay(){
 if(!$('dayDate').value||!$('beginMileage').value||!$('startTime').value){alert('Enter date, beginning mileage and start time.');return;}
 state.active={date:$('dayDate').value,beginMileage:num($('beginMileage').value),startTime:$('startTime').value};
 state.locations=[];state.activeLocationIndex=null;state.editingEntryIndex=null;save();
}
function startLocationFromData(data){
 state.locations.push({type:data.type,number:data.number,name:data.name||'',activities:[]});
 state.activeLocationIndex=state.locations.length-1;save();
}
function startLocation(){
 if(!$('locationNumber').value.trim()){alert('Enter a Store, Vendor or DC number.');return;}
 startLocationFromData({type:$('locationType').value,number:$('locationNumber').value.trim(),name:$('locationName').value.trim()});
 $('locationNumber').value='';$('locationName').value='';
}
function useSavedLocation(){
 const loc=state.savedLocations.find(x=>x.id===$('savedLocationSelect').value);
 if(!loc){alert('Choose a saved location.');return;}
 startLocationFromData(loc);
}
function addActivity(){
 if(state.activeLocationIndex===null){alert('Choose a location first.');return;}
 const t=$('activityType').value;if(!t){alert('Select an activity.');return;}
 let a;
 if(isTimed(t)){
  if(!$('activityStart').value||!$('activityStop').value){alert('Enter start and stop times.');return;}
  const h=decimalHours($('activityStart').value,$('activityStop').value),r=num($('activityHourlyRate').value);
  const paidHours=paidTimedHours(t,h);
  a={type:t,kind:'timed',start:$('activityStart').value,stop:$('activityStop').value,hours:h,paidHours,unpaidThresholdHours:hasUnpaid45MinuteThreshold(t)?0.75:0,rate:r,note:$('activityNote').value,pay:paidHours*r};
 }else{
  const q=Math.max(1,num($('activityQty').value)),r=num($('activityFlatRate').value);
  a={type:t,kind:'flat',qty:q,rate:r,note:$('activityNote').value,pay:q*r};
 }
 const activities=state.locations[state.activeLocationIndex].activities;
 activities.push(a);

 if(!$('embeddedWaitFields').classList.contains('hidden')){
  const wait=embeddedWaitValues();
  if(wait.totalHours>0){
   activities.push({
    type:'Wait Time',
    kind:'decimal-wait',
    linkedActivityType:t,
    hours:wait.totalHours,
    paidHours:wait.paidHours,
    unpaidThresholdHours:0,
    rate:wait.rate,
    note:`Wait time added with ${t}${$('activityNote').value?': '+$('activityNote').value:''}`,
    pay:wait.pay
   });
  }
 }

 ['activityStart','activityStop','activityHourlyRate','activityFlatRate','activityNote','embeddedWaitHours'].forEach(id=>$(id).value='');
 toggleEmbeddedWaitTime(false);
 $('activityType').value='';
 $('activityQty').value=1;
 updateActivityFields();
 save();
}
function selectLocation(i){state.activeLocationIndex=i;save();}
function removeActivity(li,ai){state.locations[li].activities.splice(ai,1);save();}
function removeLocation(i){if(confirm('Remove this location and all activities?')){state.locations.splice(i,1);state.activeLocationIndex=null;save();}}
function activityTotal(){return state.locations.reduce((s,l)=>s+(l.activities||[]).reduce((x,a)=>x+num(a.pay),0),0);}
function totalWaitHours(locations){
 return (locations||[]).reduce((total,location)=>
  total+(location.activities||[]).reduce((sum,activity)=>
   sum+(activity.type==='Wait Time'?num(activity.hours):0),0),0);
}
function mileagePreview(){
 if(!state.active)return 0;
 const bm=num($('editBeginMileage').value||state.active.beginMileage),em=num($('endMileage').value);
 if(!em||em<bm)return 0;
 const d=new Date(($('editDayDate').value||state.active.date)+'T12:00:00');
 const r=(d.getDay()===0||d.getDay()===6)?num(state.setup.weekendRate):num(state.setup.mileageRate);
 return (em-bm)*r;
}
function ptoPreview(){return $('ptoType').value==='none'?0:num($('ptoHours').value)*(num(state.setup.manualAdp)/10);}
function running(){return activityTotal()+mileagePreview()+ptoPreview();}
function saveDay(){
 const date=$('editDayDate').value,bm=num($('editBeginMileage').value),em=num($('endMileage').value),st=$('editStartTime').value,et=$('endTime').value;
 if(!date||!bm||!em||!st||!et){alert('Complete the day fields.');return;}
 if(em<bm){alert('Ending mileage cannot be lower.');return;}
 const d=new Date(date+'T12:00:00'),r=(d.getDay()===0||d.getDay()===6)?num(state.setup.weekendRate):num(state.setup.mileageRate);
 const miles=em-bm,mp=miles*r,ap=activityTotal(),pp=ptoPreview();
 const entry={date,beginMileage:bm,endMileage:em,startTime:st,endTime:et,miles,mileagePay:mp,locations:JSON.parse(JSON.stringify(state.locations)),activityPay:ap,ptoType:$('ptoType').value,ptoHours:num($('ptoHours').value),ptoPay:pp,total:mp+ap+pp};
 const isNewEntry=state.editingEntryIndex===null;
 if(isNewEntry){
  if(!applyPaidLeaveUsage(entry.ptoType,entry.ptoHours,entry.date))return;
  processPtoAccrual(entry);
  state.entries.push(entry);
 }else state.entries[state.editingEntryIndex]=entry;
 state.active=null;state.locations=[];state.activeLocationIndex=null;state.editingEntryIndex=null;save();showPage('history');
}
function cancelDay(){if(confirm('Cancel this day?')){state.active=null;state.locations=[];state.activeLocationIndex=null;state.editingEntryIndex=null;save();}}
function editHistoryDay(i){
 const e=state.entries[i];state.editingEntryIndex=i;state.active={date:e.date,beginMileage:e.beginMileage,startTime:e.startTime};
 state.locations=JSON.parse(JSON.stringify(e.locations||[]));state.activeLocationIndex=state.locations.length?0:null;showPage('day');
 setTimeout(()=>{$('editDayDate').value=e.date;$('editBeginMileage').value=e.beginMileage;$('editStartTime').value=e.startTime;$('endMileage').value=e.endMileage;$('endTime').value=e.endTime;$('ptoType').value=e.ptoType||'none';$('ptoHours').value=e.ptoHours||0;render();},0);
}
function deleteHistoryDay(i){if(confirm('Delete this saved day?')){state.entries.splice(i,1);save();}}
function toggleHistory(i){const el=$('history'+i);if(el)el.classList.toggle('hidden');}

function toggleSavedLocationForm(forceState=null){
 const form=$('savedLocationForm'),button=$('savedLocationToggleButton');
 const open=forceState===true?true:forceState===false?false:form.classList.contains('hidden');
 form.classList.toggle('hidden',!open);button.textContent=open?'Hide':'Show';
}
function clearSavedLocationForm(){
 ['savedNumber','savedName','savedAddress','savedCity','savedState','savedPhone','savedExtension','savedContact','savedHours','savedGateCode','savedAppointment','savedNotes'].forEach(id=>$(id).value='');
 $('savedType').value='Store';$('editingSavedLocationIndex').value='';$('saveLocationButton').textContent='Save Location';$('cancelLocationEditButton').classList.add('hidden');
}
function saveLocation(){
 if(!$('savedNumber').value.trim()){alert('Enter a location number.');return;}
 const l={id:Date.now().toString(),type:$('savedType').value,number:$('savedNumber').value.trim(),name:$('savedName').value.trim(),address:$('savedAddress').value.trim(),city:$('savedCity').value.trim(),state:$('savedState').value.trim(),phone:formatPhone($('savedPhone').value),extension:$('savedExtension').value.trim(),contact:$('savedContact').value.trim(),hours:$('savedHours').value.trim(),gateCode:$('savedGateCode').value.trim(),appointment:$('savedAppointment').value.trim(),notes:$('savedNotes').value.trim()};
 const idx=$('editingSavedLocationIndex').value;
 if(idx==='')state.savedLocations.push(l);else{l.id=state.savedLocations[Number(idx)].id;state.savedLocations[Number(idx)]=l;}
 clearSavedLocationForm();toggleSavedLocationForm(false);save();
}
function editSavedLocation(i){
 const l=state.savedLocations[i];
 [['savedType','type'],['savedNumber','number'],['savedName','name'],['savedAddress','address'],['savedCity','city'],['savedState','state'],['savedPhone','phone'],['savedExtension','extension'],['savedContact','contact'],['savedHours','hours'],['savedGateCode','gateCode'],['savedAppointment','appointment'],['savedNotes','notes']].forEach(([id,key])=>$(id).value=l[key]||'');
 $('editingSavedLocationIndex').value=i;$('saveLocationButton').textContent='Update Location';$('cancelLocationEditButton').classList.remove('hidden');toggleSavedLocationForm(true);window.scrollTo({top:0,behavior:'smooth'});
}
function cancelLocationEdit(){clearSavedLocationForm();}
function deleteSavedLocation(i){if(confirm('Delete this saved location?')){state.savedLocations.splice(i,1);save();}}
function cleanPhone(p){return String(p||'').replace(/[^0-9+]/g,'');}
function callLocation(phone,ext){const p=cleanPhone(phone);if(!p){alert('No phone number saved.');return;}window.location.href='tel:'+p+(ext?','+String(ext).replace(/[^0-9]/g,''):'');}
function rememberRecentLocation(id){
 if(!id)return;
 state.recentLocationIds=[id,...state.recentLocationIds.filter(item=>item!==id)].slice(0,25);
 savePersistentState(state);
}
function mapLocation(l){
 rememberRecentLocation(l.id);
 const coordinates=l.latitude&&l.longitude?`${l.latitude},${l.longitude}`:'';
 const q=coordinates||[l.address,l.city,l.state].filter(Boolean).join(', ');
 if(!q){alert('No address or coordinates saved.');return;}
 window.location.href='https://maps.apple.com/?q='+encodeURIComponent(q);
}
function toggleLocationFavorite(id,event){
 if(event)event.stopPropagation();
 const exists=state.locationFavorites.includes(id);
 state.locationFavorites=exists?state.locationFavorites.filter(item=>item!==id):[...state.locationFavorites,id];
 savePersistentState(state);
 renderSavedLocations();
}

function saveSetup(){
 const currencyFields=new Set(CURRENCY_SETUP_FIELDS);
 Object.keys(defaults).forEach(k=>{
  if(['driverName','driverId','hireDate','ptoTierOverride','fiscalYearStart'].includes(k))state.setup[k]=$(k).value;
  else if(currencyFields.has(k))state.setup[k]=parseCurrencyInput($(k).value);
  else state.setup[k]=num($(k).value);
 });
 displayCurrencyFields();
 if(!String(state.setup.ptoTierOverride||'').trim())state.setup.ptoTierOverride='auto';
 state.pto.fiscalYearStart=state.setup.fiscalYearStart||state.pto.fiscalYearStart;
 savePersistentState(state);
 render();
 renderPto();
 showPage('home');
}
function exportBackup(){
 ensureCurrentPayPeriod();
 if(state.payPeriodStart&&state.payPeriodEnd)upsertPayPeriod(state.payPeriodStart,state.payPeriodEnd,'current');
 savePersistentState(state);
 exportState(state);
}
function importBackup(){
 const file=$('importFile').files[0];if(!file){alert('Choose a backup file first.');return;}
 importState(file,restored=>{
  restored.payPeriods=Array.isArray(restored.payPeriods)?restored.payPeriods:[];
  restored.pto=restored.pto&&typeof restored.pto==='object'?restored.pto:{
   balance:0,earnedThisFiscalYear:0,usedThisFiscalYear:0,safetyEarnedHours:0,
   carryoverHours:0,workedHoursProgress:0,earnedDaysThisFiscalYear:0,
   safetyQuarters:{},ledger:[],fiscalArchives:[],fiscalYearStart:'',lastProcessedEntryIds:[]
  };
  restored.benefits=restored.benefits&&typeof restored.benefits==='object'?restored.benefits:{
   calendarYear:new Date().getFullYear(),fmlAnnualHours:50,fmlUsedHours:0,
   bereavementUsedHours:0,ledger:[],calendarArchives:[]
  };
  if(restored.payPeriodStart&&restored.payPeriodEnd){
   const id=payPeriodId(restored.payPeriodStart,restored.payPeriodEnd);
   if(!restored.payPeriods.some(period=>period.id===id)){
    restored.payPeriods.push({id,start:restored.payPeriodStart,end:restored.payPeriodEnd,status:'current',createdAt:new Date().toISOString()});
   }
  }
  state=restored;
  savePersistentState(state);
  alert('Backup restored, including payroll history.');
  location.reload();
 },()=>alert('Invalid backup file.'));
}


let pendingLocationImportRows=[];
let pendingLocationImportHeaders=[];

function toggleLocationImportForm(){
 const form=$('locationImportForm');
 const button=$('locationImportToggle');
 const open=form.classList.contains('hidden');
 form.classList.toggle('hidden',!open);
 button.textContent=open?'Hide':'Show';
}

function parseCsvText(text){
 const rows=[];
 let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const char=text[i],next=text[i+1];
  if(char==='"'){
   if(quoted&&next==='"'){cell+='"';i++;}
   else quoted=!quoted;
  }else if(char===','&&!quoted){
   row.push(cell);cell='';
  }else if((char==='\n'||char==='\r')&&!quoted){
   if(char==='\r'&&next==='\n')i++;
   row.push(cell);cell='';
   if(row.some(value=>String(value).trim()!==''))rows.push(row);
   row=[];
  }else cell+=char;
 }
 row.push(cell);
 if(row.some(value=>String(value).trim()!==''))rows.push(row);
 return rows;
}

function rowsToObjects(rows){
 if(!rows.length)return {headers:[],data:[]};
 const headers=rows[0].map((header,index)=>String(header||`Column ${index+1}`).trim());
 const data=rows.slice(1).map(row=>{
  const object={};
  headers.forEach((header,index)=>object[header]=row[index]??'');
  return object;
 });
 return {headers,data};
}

async function readLocationImportFile(){
 const input=$('locationImportFile');
 const file=input.files&&input.files[0];
 if(!file){alert('Choose a CSV or Excel file first.');return;}
 $('locationImportMessage').textContent='Reading spreadsheet…';

 try{
  let parsed;
  const lower=file.name.toLowerCase();
  if(lower.endsWith('.csv')){
   const text=await file.text();
   parsed=rowsToObjects(parseCsvText(text));
  }else{
   if(!window.XLSX){
    throw new Error('Excel reader unavailable. Save the spreadsheet as CSV and import the CSV file.');
   }
   const buffer=await file.arrayBuffer();
   const workbook=XLSX.read(buffer,{type:'array'});
   const sheet=workbook.Sheets[workbook.SheetNames[0]];
   const data=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:false});
   const headers=data.length?Object.keys(data[0]):[];
   parsed={headers,data};
  }

  pendingLocationImportHeaders=parsed.headers;
  pendingLocationImportRows=parsed.data;
  if(!pendingLocationImportHeaders.length||!pendingLocationImportRows.length){
   throw new Error('No usable rows were found in that spreadsheet.');
  }
  populateLocationMappingSelectors();
  $('locationImportMapping').classList.remove('hidden');
  $('locationImportRowCount').textContent=pendingLocationImportRows.length;
  updateLocationImportPreview();
  $('locationImportMessage').textContent='Spreadsheet loaded. Confirm the column matches below.';
 }catch(error){
  console.error(error);
  $('locationImportMessage').textContent=error.message||'The spreadsheet could not be read.';
 }
}

const LOCATION_MAP_FIELDS=[
 ['mapType',['type','location type','facility type']],
 ['mapNumber',['number','store #','store number','dc #','dc number','location number','facility number']],
 ['mapName',['name','store name','facility name','location name']],
 ['mapAddress',['address','street','street address']],
 ['mapCity',['city']],
 ['mapState',['state','st']],
 ['mapPhone',['phone','phone number','telephone']],
 ['mapExtension',['extension','ext']],
 ['mapContact',['contact','contact person','receiving contact']],
 ['mapHours',['receiving hours','hours','delivery hours']],
 ['mapGateCode',['gate code','gate']],
 ['mapAppointment',['appointment','appointment number','appt']],
 ['mapNotes',['notes','directions','comments']]
];

function bestHeaderMatch(candidates){
 const normalized=pendingLocationImportHeaders.map(header=>({header,normalized:String(header).trim().toLowerCase()}));
 for(const candidate of candidates){
  const exact=normalized.find(item=>item.normalized===candidate);
  if(exact)return exact.header;
 }
 for(const candidate of candidates){
  const partial=normalized.find(item=>item.normalized.includes(candidate));
  if(partial)return partial.header;
 }
 return '';
}

function populateLocationMappingSelectors(){
 LOCATION_MAP_FIELDS.forEach(([id,candidates])=>{
  const select=$(id);
  const selected=bestHeaderMatch(candidates);
  select.innerHTML='<option value="">Not included</option>'+pendingLocationImportHeaders.map(header=>
   `<option value="${escapeHtml(header)}"${header===selected?' selected':''}>${escapeHtml(header)}</option>`
  ).join('');
  select.onchange=updateLocationImportPreview;
 });
 if(!$('mapNumber').value&&pendingLocationImportHeaders.length)$('mapNumber').value=pendingLocationImportHeaders[0];
}

function escapeHtml(value){
 return String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
 })[char]);
}

function mappedValue(row,selectId){
 const header=$(selectId).value;
 return header?String(row[header]??'').trim():'';
}

function normalizeLocationType(value){
 const raw=String(value||'').trim().toLowerCase();
 if(raw.includes('distribution')||raw==='dc'||raw.startsWith('dc '))return 'DC';
 if(raw.includes('vendor'))return 'Vendor';
 if(raw.includes('store')||raw==='wm'||raw==='walmart')return 'Store';
 return value?String(value).trim():'Store';
}

function mappedLocation(row,index){
 const number=mappedValue(row,'mapNumber');
 return {
  id:`import-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
  type:normalizeLocationType(mappedValue(row,'mapType')),
  number,
  name:mappedValue(row,'mapName'),
  address:mappedValue(row,'mapAddress'),
  city:mappedValue(row,'mapCity'),
  state:mappedValue(row,'mapState').toUpperCase(),
  phone:formatPhone(mappedValue(row,'mapPhone')),
  extension:mappedValue(row,'mapExtension'),
  contact:mappedValue(row,'mapContact'),
  hours:mappedValue(row,'mapHours'),
  gateCode:mappedValue(row,'mapGateCode'),
  appointment:mappedValue(row,'mapAppointment'),
  notes:mappedValue(row,'mapNotes')
 };
}

function mappedLocations(){
 return pendingLocationImportRows.map(mappedLocation).filter(location=>location.number);
}

function updateLocationImportPreview(){
 const locations=mappedLocations();
 $('locationImportValidCount').textContent=locations.length;
 const preview=locations.slice(0,5);
 $('locationImportPreview').innerHTML=preview.length?preview.map(location=>`
  <div class="import-preview-row">
   <b>${escapeHtml(location.type)} #${escapeHtml(location.number)}</b>
   <span>${escapeHtml([location.name,location.city,location.state].filter(Boolean).join(' • ')||'No additional details')}</span>
  </div>`).join(''):'<div class="muted small">Map a location-number column to create the preview.</div>';
}

function mergeLocationDetails(existing,incoming){
 const merged={...existing};
 ['name','address','city','state','phone','extension','contact','hours','gateCode','appointment','notes'].forEach(key=>{
  if(!merged[key]&&incoming[key])merged[key]=incoming[key];
 });
 return merged;
}

function importMappedLocations(){
 const locations=mappedLocations();
 if(!locations.length){alert('No valid locations are ready to import. The Number column is required.');return;}
 const mode=$('locationDuplicateMode').value;
 let added=0,updated=0,skipped=0;

 locations.forEach(location=>{
  const index=state.savedLocations.findIndex(existing=>
   String(existing.type).toLowerCase()===String(location.type).toLowerCase()&&
   String(existing.number).trim()===String(location.number).trim()
  );
  if(index===-1){
   state.savedLocations.push(location);added++;return;
  }
  if(mode==='skip'){skipped++;return;}
  if(mode==='replace'){
   location.id=state.savedLocations[index].id||location.id;
   state.savedLocations[index]=location;
   updated++;return;
  }
  state.savedLocations[index]=mergeLocationDetails(state.savedLocations[index],location);
  updated++;
 });

 savePersistentState(state);
 renderSavedLocations();
 $('locationImportMessage').textContent=`Import complete: ${added} added, ${updated} updated, ${skipped} skipped.`;
 alert(`Locations imported.\n\nAdded: ${added}\nUpdated: ${updated}\nSkipped: ${skipped}`);
}

function downloadLocationImportTemplate(){
 const headers=['Type','Number','Name','Address','City','State','Phone','Extension','Contact','Receiving Hours','Gate Code','Appointment','Notes'];
 const example=['Store','1234','Example Store','100 Main St','Phoenix','AZ','602-818-4551','','Receiving','05:00-14:00','','','Use receiving entrance'];
 const csv=[headers,example].map(row=>row.map(value=>`"${String(value).replace(/"/g,'""')}"`).join(',')).join('\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
 const link=document.createElement('a');
 link.href=URL.createObjectURL(blob);
 link.download='spark-location-import-template.csv';
 link.click();
 setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}

function toggleSavedLocationDetails(id){
 state.expandedSavedLocationId=state.expandedSavedLocationId===id?null:id;
 if(state.expandedSavedLocationId)rememberRecentLocation(id);
 else savePersistentState(state);
 renderSavedLocations();
}

function renderSavedLocations(){
 const searchEl=$('locationSearch');
 if(!searchEl)return;
 const q=(searchEl.value||'').toLowerCase().trim();
 const typeFilter=$('locationTypeFilter')?$('locationTypeFilter').value:'';
 const viewFilter=$('locationViewFilter')?$('locationViewFilter').value:'';
 const recentOrder=new Map(state.recentLocationIds.map((id,index)=>[id,index]));

 let rows=state.savedLocations.map((location,index)=>({location,index})).filter(({location})=>{
  const searchable=[location.type,location.number,location.name,location.address,location.city,location.state,location.phone,location.contact,location.notes]
   .join(' ').toLowerCase();
  if(q&&!searchable.includes(q))return false;
  if(typeFilter&&location.type!==typeFilter)return false;
  if(viewFilter==='favorites'&&!state.locationFavorites.includes(location.id))return false;
  if(viewFilter==='recent'&&!recentOrder.has(location.id))return false;
  return true;
 });

 if(viewFilter==='recent'){
  rows.sort((a,b)=>(recentOrder.get(a.location.id)??999)-(recentOrder.get(b.location.id)??999));
 }else{
  rows.sort((a,b)=>{
   const typeCompare=String(a.location.type).localeCompare(String(b.location.type));
   if(typeCompare)return typeCompare;
   return String(a.location.number).localeCompare(String(b.location.number),undefined,{numeric:true});
  });
 }

 const total=state.savedLocations.length;
 const dcCount=state.savedLocations.filter(location=>location.type==='DC').length;
 const favoriteCount=state.locationFavorites.filter(id=>state.savedLocations.some(location=>location.id===id)).length;
 if($('directoryTotalCount'))$('directoryTotalCount').textContent=total;
 if($('directoryDcCount'))$('directoryDcCount').textContent=dcCount;
 if($('directoryFavoriteCount'))$('directoryFavoriteCount').textContent=favoriteCount;

 $('savedLocationList').innerHTML=rows.length?rows.map(({location,index})=>{
  const open=state.expandedSavedLocationId===location.id;
  const favorite=state.locationFavorites.includes(location.id);
  const subtitle=[location.name,location.city,location.state].filter(Boolean).join(' • ');
  return `<div class="saved-location-compact">
   <button type="button" class="saved-location-summary" onclick="toggleSavedLocationDetails('${location.id}')">
    <span class="location-summary-text">
      <b>${escapeHtml(location.type)} #${escapeHtml(location.number)}</b>
      <span class="location-summary-sub">${escapeHtml(subtitle||'Location details')}</span>
    </span>
    <span class="favorite-location" onclick="toggleLocationFavorite('${location.id}',event)" aria-label="Favorite">${favorite?'★':'☆'}</span>
    <span class="saved-location-chevron">${open?'▲':'▼'}</span>
   </button>
   <div class="saved-location-details ${open?'':'hidden'}">
    ${location.name?`<div class="kv"><span>Name</span><b>${escapeHtml(location.name)}</b></div>`:''}
    ${location.address||location.city||location.state?`<div class="kv"><span>Address</span><b>${escapeHtml([location.address,location.city,location.state].filter(Boolean).join(', '))}</b></div>`:''}
    ${location.latitude&&location.longitude?`<div class="kv"><span>Coordinates</span><b>${escapeHtml(location.latitude)}, ${escapeHtml(location.longitude)}</b></div>`:''}
    ${location.phone?`<div class="kv"><span>Phone</span><b>${escapeHtml(location.phone)}${location.extension?' ext. '+escapeHtml(location.extension):''}</b></div>`:''}
    ${location.contact?`<div class="kv"><span>Contact</span><b>${escapeHtml(location.contact)}</b></div>`:''}
    ${location.hours?`<div class="kv"><span>Receiving hours</span><b>${escapeHtml(location.hours)}</b></div>`:''}
    ${location.gateCode?`<div class="kv"><span>Gate code</span><b>${escapeHtml(location.gateCode)}</b></div>`:''}
    ${location.appointment?`<div class="kv"><span>Appointment</span><b>${escapeHtml(location.appointment)}</b></div>`:''}
    ${location.notes?`<div class="saved-location-notes">${escapeHtml(location.notes)}</div>`:''}
    <div class="directory-actions">
     ${location.phone?`<button class="green" onclick="callLocation('${String(location.phone).replace(/'/g,"\\'")}','${String(location.extension||'').replace(/'/g,"\\'")}')">Call</button>`:'<button class="secondary" disabled>No Phone</button>'}
     <button class="primary" onclick='mapLocation(${JSON.stringify(location)})'>Directions</button>
     <button class="secondary" onclick="toggleLocationFavorite('${location.id}',event)">${favorite?'Unfavorite':'Favorite'}</button>
    </div>
    <div class="actions">
     <button class="secondary" onclick="editSavedLocation(${index})">Edit</button>
     <button class="danger" onclick="deleteSavedLocation(${index})">Delete</button>
    </div>
   </div>
  </div>`;
 }).join(''):'<div class="muted small">No locations match your search or filters.</div>';
}

function render(){
 renderHomeActivityRates();
 $('startBox').classList.toggle('hidden',!!state.active);$('activeBox').classList.toggle('hidden',!state.active);
 $('dayHeading').textContent=state.editingEntryIndex===null?'Start / Edit Day':'Edit Saved Day';
 $('saveDayButton').textContent=state.editingEntryIndex===null?'End Day & Save':'Save History Changes';

 if(state.active){
  if(!$('editDayDate').value)$('editDayDate').value=state.active.date;
  if(!$('editBeginMileage').value)$('editBeginMileage').value=state.active.beginMileage;
  if(!$('editStartTime').value)$('editStartTime').value=state.active.startTime;
 }


 const now=new Date();
 $('todayDateLabel').textContent=now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
 $('dashboardGreeting').textContent=greetingForNow()+(state.setup.driverName?', '+state.setup.driverName:'');
 const completedDay=state.active?null:lastCompletedDay();
 const activityCount=state.active
  ?state.locations.reduce((s,l)=>s+(l.activities||[]).length,0)
  :completedDay?(completedDay.locations||[]).reduce((s,l)=>s+(l.activities||[]).length,0):0;
 const activePay=state.active?running():(completedDay?num(completedDay.total):0);
 $('dashboardStatus').textContent=state.active?'On Duty':completedDay?'Day Complete':'Ready to Start';
 $('dashboardStatusMeta').textContent=state.active
  ?`Started ${state.active.startTime} • ${activityCount} activities`
  :completedDay
   ?`${completedDay.date} • ${completedDay.miles||0} miles • ${activityCount} activities`
   :'No active day';
 $('statusDot').style.background=state.active?'#44d17a':completedDay?'#3d8bfd':'#ffb000';
 $('dashboardPrimaryButton').textContent=state.active?'Resume Day':'Start New Day';
 const dl=currentDashboardLocation();
 $('dashboardLocationTitle').textContent=dl?`${dl.type} #${dl.number}`:'No location selected';
 $('dashboardLocationName').textContent=dl?(dl.name||'Current activity location'):'Start or resume your day to add a location.';
 $('dashboardContact').textContent=dl&&dl.contact||'—';
 $('dashboardHours').textContent=dl&&dl.hours||'—';
 $('dashboardGate').textContent=dl&&dl.gateCode||'—';
 $('dashboardAppointment').textContent=dl&&dl.appointment||'—';
 $('dashboardNotes').textContent=dl&&dl.notes||'';
 $('dashboardCallButton').disabled=!(dl&&dl.phone);
 $('dashboardDirectionsButton').disabled=!(dl&&(dl.address||dl.city||dl.state));
 const dashMp=state.active?mileagePreview():(completedDay?num(completedDay.mileagePay):0);
 const dashAp=state.active?activityTotal():(completedDay?num(completedDay.activityPay):0);
 const dashPp=state.active?ptoPreview():(completedDay?num(completedDay.ptoPay):0);
 const dashboardGrandTotal=state.active?(dashMp+dashAp+dashPp):(completedDay?num(completedDay.total):0);
 $('dashboardMileagePay').textContent=money(dashMp);
 $('dashboardActivityPay').textContent=money(dashAp);
 $('dashboardPtoPay').textContent=money(dashPp);
 $('dashboardTotalPay').textContent=money(dashboardGrandTotal);

 $('homeStatus').textContent=state.active
  ?`Day in progress: ${state.active.date} • ${state.active.startTime} • mileage ${state.active.beginMileage}`
  :completedDay
   ?`Completed day: ${completedDay.date}`
   :'No active day.';
 $('runningTotal').textContent=money(dashboardGrandTotal);
 $('runningDetail').textContent=state.active
  ?`${state.locations.length} locations • ${state.locations.reduce((s,l)=>s+(l.activities||[]).length,0)} activities`
  :completedDay
   ?`${(completedDay.locations||[]).length} locations • ${activityCount} activities`
   :'No active day';
 $('milesToday').textContent=state.active&&$('endMileage').value
  ?Math.max(0,num($('endMileage').value)-num($('editBeginMileage').value||state.active.beginMileage))
  :completedDay?num(completedDay.miles):0;
 $('locationsToday').textContent=state.active?state.locations.length:(completedDay?(completedDay.locations||[]).length:0);
 $('activitiesToday').textContent=activityCount;
 const dashboardWaitHours=state.active?totalWaitHours(state.locations):(completedDay?totalWaitHours(completedDay.locations):0);
 $('waitTimeToday').textContent=`${dashboardWaitHours.toFixed(2)} hrs`;
 $('adpToday').textContent=money(state.setup.manualAdp);
 $('dayCount').textContent=state.entries.length;
 $('totalPay').textContent=money(state.entries.reduce((s,e)=>s+num(e.total),0));

 $('savedLocationSelect').innerHTML='<option value="">Choose saved location</option>'+state.savedLocations.map(l=>`<option value="${l.id}">${l.type} #${l.number} ${l.name||''}</option>`).join('');
 $('activeLocationBox').classList.toggle('hidden',state.activeLocationIndex===null);
 if(state.activeLocationIndex!==null&&state.locations[state.activeLocationIndex]){
  const l=state.locations[state.activeLocationIndex];$('activeLocationTitle').textContent=`${l.type} #${l.number}`;$('activeLocationSubtitle').textContent=l.name||'Activities added here belong to this location.';
 }

 $('locationGroups').innerHTML=state.locations.length?state.locations.map((l,li)=>`<div class="location-card"><b>${l.type} #${l.number}</b> ${state.activeLocationIndex===li?'<span class="pill">Active</span>':''}<div class="muted small">${l.name||''}</div><div class="kv"><span>Activities</span><b>${(l.activities||[]).length}</b></div><div class="kv"><span>Location total</span><b>${money((l.activities||[]).reduce((s,a)=>s+num(a.pay),0))}</b></div>${(l.activities||[]).map((a,ai)=>`<div class="entry"><b>${a.type}</b><div class="muted small">${['timed','decimal-wait'].includes(a.kind)?`${a.kind==='decimal-wait'
 ?`${num(a.hours).toFixed(2)} total hrs • ${num(a.hours).toFixed(2)} paid hrs • ${money(a.rate)}/hr${a.linkedActivityType?` • with ${a.linkedActivityType}`:''}`
 :`${a.start}–${a.stop} • ${num(a.hours).toFixed(2)} total hrs${hasUnpaid45MinuteThreshold(a.type)?` • ${num(a.paidHours!==undefined?a.paidHours:paidTimedHours(a.type,a.hours)).toFixed(2)} paid hrs`:''} • ${money(a.rate)}/hr`}`:`Qty ${a.qty} • ${money(a.rate)} each`}</div>${a.note?`<div>${a.note}</div>`:''}<b>${money(a.pay)}</b><button class="danger top-gap-sm" onclick="removeActivity(${li},${ai})">Remove</button></div>`).join('')}<div class="actions"><button class="secondary" onclick="selectLocation(${li})">Add More Here</button><button class="danger" onclick="removeLocation(${li})">Remove Location</button></div></div>`).join(''):'<div class="muted small">No locations added.</div>';

 const mp=mileagePreview(),ap=activityTotal(),pp=ptoPreview();
 $('previewMileage').textContent=money(mp);$('previewActivity').textContent=money(ap);$('previewPto').textContent=money(pp);$('previewTotal').textContent=money(mp+ap+pp);

 renderSavedLocations();renderHistory();

 renderPayPeriodReport();
 renderPayPeriodArchive();
 if($('aboutDataStatus'))$('aboutDataStatus').textContent='Ready';
 if($('aboutWorkdays'))$('aboutWorkdays').textContent=state.entries.length;
 if($('aboutLocations'))$('aboutLocations').textContent=state.savedLocations.length;
 if($('aboutPayPeriods'))$('aboutPayPeriods').textContent=state.payPeriods.length;
 if($('aboutCurrentPayroll'))$('aboutCurrentPayroll').textContent=state.payPeriodStart&&state.payPeriodEnd
  ?`${displayReportDate(state.payPeriodStart)} – ${displayReportDate(state.payPeriodEnd)}`
  :'Not set';
 $('migrationStatus').textContent=localStorage.getItem(MIGRATION_FLAG)||'None';
}

if(!state.setup.fiscalYearStart&&!state.pto.fiscalYearStart){
 const suggested=suggestedFiscalStart();
 state.setup.fiscalYearStart=suggested;
 state.pto.fiscalYearStart=suggested;
 savePersistentState(state);
}
populateSetupFields();
$('dayDate').value=new Date().toISOString().slice(0,10);
document.addEventListener('input',e=>{
 if(['editBeginMileage','editDayDate','endMileage','ptoType','ptoHours'].includes(e.target.id))render();
 if(['payPeriodStart','payPeriodEnd'].includes(e.target.id))renderPayPeriodReport();
 if(e.target.id==='embeddedWaitHours')updateEmbeddedWaitPreview();
});

let touchStartX=null,touchStartY=null;
document.addEventListener('touchstart',e=>{const t=e.changedTouches[0];touchStartX=t.screenX;touchStartY=t.screenY;},{passive:true});
document.addEventListener('touchend',e=>{if(touchStartX===null)return;const t=e.changedTouches[0],dx=t.screenX-touchStartX,dy=t.screenY-touchStartY;touchStartX=touchStartY=null;if(Math.abs(dx)<60||Math.abs(dx)<=Math.abs(dy))return;const i=pageOrder.indexOf(currentPage);if(dx<0&&i<pageOrder.length-1)showPage(pageOrder[i+1]);else if(dx>0&&i>0)showPage(pageOrder[i-1]);},{passive:true});

if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
document.querySelectorAll('[data-currency-rate="true"]').forEach(input=>{
 input.addEventListener('focus',()=>{
  input.value=String(parseCurrencyInput(input.value));
  input.select();
 });
 input.addEventListener('input',()=>{
  input.value=input.value.replace(/[^0-9.]/g,'').replace(/(\..*)\./g,'$1');
 });
 input.addEventListener('blur',()=>{
  input.value=formatCurrencyInput(input.value);
 });
});
displayCurrencyFields();

$('savedPhone').addEventListener('input',e=>{
 const cursor=e.target.selectionStart;
 const before=e.target.value;
 e.target.value=formatPhone(before);
});
loadBuiltInLocationDatabase();
render();




(function(){
  const grid=document.getElementById('quickActivityRow');
  const toggle=document.getElementById('quickReorderToggle');
  const reset=document.getElementById('quickResetOrder');
  if(!grid||!toggle)return;

  let reorderMode=false;
  let active=null;
  let ghost=null;
  let pointerId=null;
  let offsetX=0;
  let offsetY=0;
  let startX=0;
  let startY=0;
  let moved=false;
  let downTime=0;

  const MOVE_LIMIT=9;
  const TAP_LIMIT=500;
  const items=()=>Array.from(grid.querySelectorAll('.quick-btn[data-activity]'));

  function saveOrder(){
    try{
      state.quickActivityOrder=items().map(button=>button.dataset.activity);
      savePersistentState(state);
    }catch(error){
      console.warn('Could not save quick activity order',error);
    }
  }

  function restoreOrder(){
    try{
      const order=Array.isArray(state.quickActivityOrder)?state.quickActivityOrder:DEFAULT_QUICK_ACTIVITY_ORDER;
      order.forEach(name=>{
        const button=items().find(item=>item.dataset.activity===name);
        if(button)grid.appendChild(button);
      });
    }catch(error){
      console.warn('Could not restore quick activity order',error);
    }
  }

  function setMode(enabled){
    reorderMode=enabled;
    grid.classList.toggle('reorder-mode',enabled);
    toggle.textContent=enabled?'Done':'Reorder';

    finishDrag();
    if(enabled&&navigator.vibrate)navigator.vibrate(20);
  }

  function beginDrag(button,event){
    active=button;
    pointerId=event.pointerId;

    const rect=button.getBoundingClientRect();
    offsetX=event.clientX-rect.left;
    offsetY=event.clientY-rect.top;

    button.classList.add('drag-source');

    ghost=button.cloneNode(true);
    ghost.classList.add('quick-drag-ghost');
    ghost.style.width=rect.width+'px';
    ghost.style.height=rect.height+'px';
    ghost.style.left=(event.clientX-offsetX)+'px';
    ghost.style.top=(event.clientY-offsetY)+'px';
    document.body.appendChild(ghost);

    try{button.setPointerCapture(pointerId);}catch(_){}
  }

  function moveDrag(event){
    if(!active||!ghost)return;

    ghost.style.left=(event.clientX-offsetX)+'px';
    ghost.style.top=(event.clientY-offsetY)+'px';

    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.quick-btn[data-activity]');
    if(!target||target===active||!grid.contains(target))return;

    const rect=target.getBoundingClientRect();
    const targetCenterY=rect.top+rect.height/2;
    const targetCenterX=rect.left+rect.width/2;

    const after =
      event.clientY>targetCenterY ||
      (Math.abs(event.clientY-targetCenterY)<rect.height/3 && event.clientX>targetCenterX);

    if(after){
      grid.insertBefore(active,target.nextSibling);
    }else{
      grid.insertBefore(active,target);
    }
  }

  function finishDrag(){
    if(ghost)ghost.remove();
    ghost=null;

    if(active){
      active.classList.remove('drag-source');
      if(pointerId!==null){
        try{active.releasePointerCapture(pointerId);}catch(_){}
      }
    }

    active=null;
    pointerId=null;
  }

  toggle.addEventListener('click',()=>{
    if(reorderMode)saveOrder();
    setMode(!reorderMode);
  });

  if(reset){
    reset.addEventListener('click',()=>{
      if(!confirm('Reset activities to the default order?'))return;
      state.quickActivityOrder=[...DEFAULT_QUICK_ACTIVITY_ORDER];
      DEFAULT_QUICK_ACTIVITY_ORDER.forEach(name=>{
        const button=items().find(item=>item.dataset.activity===name);
        if(button)grid.appendChild(button);
      });
      savePersistentState(state);
      setMode(false);
    });
  }

  grid.addEventListener('pointerdown',event=>{
    const button=event.target.closest('.quick-btn[data-activity]');
    if(!button)return;

    startX=event.clientX;
    startY=event.clientY;
    downTime=Date.now();
    moved=false;

    if(reorderMode){
      event.preventDefault();
      beginDrag(button,event);
    }else{
      active=button;
      pointerId=event.pointerId;
    }
  },{passive:false});

  grid.addEventListener('pointermove',event=>{
    if(event.pointerId!==pointerId)return;

    if(Math.hypot(event.clientX-startX,event.clientY-startY)>MOVE_LIMIT){
      moved=true;
    }

    if(reorderMode&&active){
      event.preventDefault();
      moveDrag(event);
    }
  },{passive:false});

  grid.addEventListener('pointerup',event=>{
    if(event.pointerId!==pointerId)return;

    if(reorderMode){
      saveOrder();
      finishDrag();
      return;
    }

    const button=active;
    const elapsed=Date.now()-downTime;
    finishDrag();

    if(button&&!moved&&elapsed<=TAP_LIMIT){
      quickAddActivity(button.dataset.activity);
    }
  });

  grid.addEventListener('pointercancel',()=>{
    finishDrag();
  });

  grid.addEventListener('click',event=>{
    if(event.target.closest('.quick-btn[data-activity]')){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);

  restoreOrder();
  setMode(false);
})();