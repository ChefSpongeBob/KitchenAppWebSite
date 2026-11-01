#pragma once

const char GATEWAY_SETUP_PAGE[] PROGMEM = R"CRIMINI(<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Crimini | Gateway Wi-Fi</title>
<style nonce="%TOKEN%">
:root{color-scheme:light;font-family:Georgia,serif;color:#252521;background:#fbfaf6}
*{box-sizing:border-box}body{margin:0;padding:clamp(20px,5vw,60px)}main{max-width:560px;margin:auto}
header{padding-bottom:20px;border-bottom:1px solid #dedcd4}header strong{font-weight:400;font-size:32px;letter-spacing:.08em}
h1{font-size:25px;font-weight:400;margin:26px 0 10px}p{font:15px/1.6 Verdana,sans-serif;color:#55554d}
label{display:grid;gap:8px;margin:22px 0;font:14px Verdana,sans-serif}
input,select{width:100%;padding:12px 0;background:transparent;color:inherit;border:0;border-bottom:1px solid #c8c5bb;border-radius:0;font:16px Verdana,sans-serif}
button,a{display:inline-block;color:inherit;background:none;border:0;border-bottom:1px solid #bdb9ac;padding:9px 0;margin:8px 22px 8px 0;font:14px Verdana,sans-serif;cursor:pointer;text-decoration:none}
button:disabled{opacity:.5;cursor:wait}small{font:12px/1.5 Verdana,sans-serif;color:#66665e}
#message{min-height:2em;padding:14px 0;border-top:1px solid #dedcd4}#message.error{color:#9d302d}#complete{padding-top:18px}
[hidden]{display:none!important}
</style></head><body><main>
<header><strong>CRIMINI</strong><br><small>Gateway %SERIAL%</small></header>
<section id="entry"><h1>Set Restaurant Wi-Fi</h1><p>Choose your restaurant's 2.4 GHz network and enter its password.</p>
<form id="wifi"><label>Wi-Fi Network<select id="networks"><option value="">Enter network name</option></select></label>
<label id="manual">Network Name<input id="ssid" maxlength="32" required autocapitalize="none" spellcheck="false" autocomplete="off"></label>
<label>Wi-Fi Password<input id="password" type="password" maxlength="63" autocomplete="new-password"></label>
<button type="submit" id="connect">Connect Wi-Fi</button><button type="button" id="scan">Find Networks</button></form></section>
<p id="message" role="status" aria-live="polite"></p>
<section id="complete" hidden><h1>Connected to Crimini.</h1><p>Reconnect this computer or phone to its normal Wi-Fi. Return to Registered Equipment and select Check Connection.</p>
<button id="finish" type="button">Finish</button></section>
<script nonce="%TOKEN%">
const token='%TOKEN%', byId=id=>document.getElementById(id);
let polling=false, scanning=false, busy=false;
function message(text,error=false){byId('message').textContent=text;byId('message').classList.toggle('error',error);}
function lock(value){busy=value;for(const element of byId('wifi').elements)element.disabled=value;}
async function request(path,options={}){
 const response=await fetch(path,{...options,headers:{...options.headers,'X-Setup-Token':token},cache:'no-store'});
 const body=await response.json();if(!response.ok)throw Error(body.error||'Please try again.');return body;
}
byId('networks').onchange=()=>{byId('manual').hidden=Boolean(byId('networks').value);byId('ssid').required=!byId('networks').value;};
byId('scan').onclick=async()=>{
 if(scanning||busy)return;scanning=true;byId('scan').disabled=true;message('Finding networks...');
 try{let result=await request('/networks');for(let tries=0;result.scanning&&tries<15;tries++){
  await new Promise(resolve=>setTimeout(resolve,1000));result=await request('/networks');}
  if(result.scanning)throw Error('Network search timed out. Enter the network name or try again.');
  byId('networks').replaceChildren(new Option('Enter network name',''));
  for(const network of result.networks)byId('networks').add(new Option(network,network));
  byId('networks').onchange();message(result.networks.length?'Select a network.':'No networks found. Enter the network name.');
 }catch(error){message(error.message,true);}finally{scanning=false;byId('scan').disabled=busy;}
};
byId('wifi').onsubmit=async event=>{
 event.preventDefault();if(busy||scanning)return;
 const ssid=byId('networks').value||byId('ssid').value,password=byId('password').value;
 if(!ssid||new TextEncoder().encode(ssid).length>32){message('Check the network name. It is empty or too long.',true);return;}
 const passwordLength=new TextEncoder().encode(password).length;
 if(passwordLength>63||(passwordLength>0&&passwordLength<8)){message('Check the Wi-Fi password. It is too short or too long.',true);return;}
 lock(true);message('Connecting to Wi-Fi...');
 try{await request('/connect',{method:'POST',body:new URLSearchParams({ssid,password})});}
 catch(error){lock(false);message(error.message,true);}finally{byId('password').value='';}
};
async function status(){
 if(polling)return;polling=true;
 try{const result=await request('/status');
  lock(result.state==='joining'||result.state==='verifying');
  if(result.state==='connected'){byId('entry').hidden=true;byId('complete').hidden=false;message('Gateway connected.');clearInterval(timer);}
  else if(!scanning&&result.message)message(result.message,result.state==='error');
 }catch{if(!byId('complete').hidden)return;message('Reconnecting to the gateway. Stay on its setup Wi-Fi.');}
 finally{polling=false;}
}
byId('finish').onclick=async()=>{try{await request('/finish',{method:'POST'});byId('finish').disabled=true;message('Reconnect to your normal Wi-Fi, then return to Crimini.');}catch(error){message(error.message,true);}};
const timer=setInterval(status,2500);status();
</script></main></body></html>)CRIMINI";
