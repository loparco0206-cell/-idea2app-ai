const SYSTEM = `
You are the creation engine for Idea2Anything AI Studio.

Return ONLY valid JSON.

Base shape:
{
  "type": "mobile|app|website|video|social|document|business|other",
  "title": "string",
  "summary": "string",
  "sections": ["string"],
  "items": ["string"],
  "output": {},
  "mobile": null
}

If type is "mobile", create a practical cross-platform iOS + Android starter using Expo/React Native.
Also return:
"mobile": {
  "appjs": "complete App.js source code",
  "packageJson": {},
  "appJson": {},
  "easJson": {},
  "readme": "setup/build instructions",
  "envExample": "safe example environment variables only"
}

Mobile requirements:
- Expo/React Native starter
- Works on both iOS and Android
- Use only dependencies listed in packageJson
- Include bottom-tab style navigation or simple screen switching
- Include at least Home, one core-action screen, History, and Settings when appropriate
- Use AsyncStorage for prototype local storage
- Keep secrets out of client code
- For AI, payments, maps, login, push notifications, camera, or cloud database, create safe placeholders and clear integration points
- app.json must include iOS and Android identifiers as editable placeholders
- eas.json must include preview and production build profiles
- README must explain:
  npm install
  npx expo start
  eas build -p ios
  eas build -p android
- Do not claim App Store or Google Play submission is automatic
- Do not include private API keys

For non-mobile project types, return mobile:null.
`;

function jr(status,body){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"*"}})}
function clean(t=""){let v=String(t).trim().replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();const a=v.indexOf("{"),b=v.lastIndexOf("}");if(a>=0&&b>a)v=v.slice(a,b+1);return v}
function cfg(mode){if(mode==="deep")return{model:"gpt-5.6-sol",effort:"medium"};if(mode==="balanced")return{model:"gpt-5.6-terra",effort:"low"};return{model:"gpt-5.6-luna",effort:"none"}}

export default async(request)=>{
 if(request.method==="OPTIONS")return new Response("",{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS"}});
 if(request.method!=="POST")return jr(405,{ok:false,error:"Method not allowed."});
 try{
  if(!process.env.OPENAI_API_KEY)return jr(500,{ok:false,error:"OPENAI_API_KEY is not configured."});
  const b=await request.json().catch(()=>({})),idea=String(b.idea||"").trim(),type=String(b.type||"auto"),style=String(b.style||"Modern"),instruction=String(b.instruction||"").trim(),previous=b.previous?JSON.stringify(b.previous).slice(0,14000):"";
  if(!idea)return jr(400,{ok:false,error:"Please enter an idea."});
  const c=cfg(String(b.mode||"fast")),model=process.env.OPENAI_MODEL||c.model;
  const input=`USER REQUEST:\n${idea}\n\nREQUESTED TYPE:\n${type}\n\nSTYLE:\n${style}\n\n${instruction?`MODIFICATION:\n${instruction}\n\n`:""}${previous?`PREVIOUS PROJECT:\n${previous}\n\n`:""}Create the project now. If type is auto, infer the best type.`;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  let r;try{r=await fetch("https://api.openai.com/v1/responses",{method:"POST",signal:controller.signal,headers:{"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model,reasoning:{effort:c.effort},text:{verbosity:"low"},instructions:SYSTEM,input,max_output_tokens:4200,store:false})})}finally{clearTimeout(timer)}
  const raw=await r.text();if(!r.ok){let detail=`HTTP ${r.status}`;try{const x=JSON.parse(raw);detail=x?.error?.message||detail}catch{}return jr(r.status,{ok:false,error:"OpenAI request failed.",detail})}
  let data;try{data=JSON.parse(raw)}catch{return jr(502,{ok:false,error:"OpenAI returned unreadable data."})}
  let out=data.output_text||"";if(!out&&Array.isArray(data.output))for(const item of data.output)for(const x of item?.content||[])if(x?.type==="output_text"&&x?.text)out+=x.text;
  let project;try{project=JSON.parse(clean(out))}catch{return jr(502,{ok:false,error:"AI returned invalid project data."})}
  return jr(200,{ok:true,model,project})
 }catch(e){if(e?.name==="AbortError")return jr(504,{ok:false,error:"AI took too long. Try Fast mode."});return jr(500,{ok:false,error:"AI server error.",detail:String(e?.message||e)})}
};