const SYSTEM = `
You are the creation engine for Idea2Anything AI Studio.

Return ONLY valid JSON. No markdown and no code fences.

Return:
{
  "type": "mobile|app|website|video|social|document|business|study|workflow|itinerary|spreadsheet|presentation|other",
  "title": "string",
  "summary": "string",
  "sections": ["string"],
  "items": ["string"],
  "output": {},
  "video": null
}

Be practical and specific.
For mobile apps, use sections for screens and items for features/integrations.
For presentations, use sections for slides.
For itineraries, use sections for days/stops.
For spreadsheet plans, use sections for sheets/sections.

If type is "video", include:
"video": {
  "format": "9:16",
  "durationSeconds": number,
  "hook": "string",
  "caption": "string",
  "hashtags": ["string"],
  "musicMood": "string",
  "scenes": [
    {"title":"string","text":"short on-screen text","voiceover":"short voiceover","duration":number}
  ]
}

Do not claim live third-party connections, bookings, publishing, payments, or data access unless configured.
Do not include secret API keys.
`;

function jr(status,body){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"*"}})}
function clean(t=""){let v=String(t).trim().replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();const a=v.indexOf("{"),b=v.lastIndexOf("}");if(a>=0&&b>a)v=v.slice(a,b+1);return v}
function modelFor(mode){if(process.env.OPENAI_MODEL)return process.env.OPENAI_MODEL;return mode==="deep"?"gpt-5":mode==="balanced"?"gpt-5-mini":"gpt-5-mini"}

export default async(request)=>{
 if(request.method==="OPTIONS")return new Response("",{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS"}});
 if(request.method!=="POST")return jr(405,{ok:false,error:"Method not allowed."});
 try{
  if(!process.env.OPENAI_API_KEY)return jr(500,{ok:false,error:"OPENAI_API_KEY is not configured in Netlify."});
  const b=await request.json().catch(()=>({})),idea=String(b.idea||"").trim(),type=String(b.type||"auto"),style=String(b.style||"Modern"),instruction=String(b.instruction||"").trim(),reference=String(b.reference||"").slice(0,12000),previous=b.previous?JSON.stringify(b.previous).slice(0,10000):"";
  if(!idea)return jr(400,{ok:false,error:"Please describe what you want to create."});
  const model=modelFor(String(b.mode||"fast"));
  const input=`USER REQUEST:\n${idea}\n\nREQUESTED TYPE:\n${type}\n\nSTYLE:\n${style}\n\n${instruction?`MODIFICATION REQUEST:\n${instruction}\n\n`:""}${reference?`REFERENCE MATERIAL:\n${reference}\n\n`:""}${previous?`PREVIOUS PROJECT:\n${previous}\n\n`:""}Create the project now. If type is auto, infer the best type.`;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  let r;try{r=await fetch("https://api.openai.com/v1/responses",{method:"POST",signal:controller.signal,headers:{"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model,instructions:SYSTEM,input,max_output_tokens:2200,store:false})})}finally{clearTimeout(timer)}
  const raw=await r.text();if(!r.ok){let detail=`HTTP ${r.status}`;try{const x=JSON.parse(raw);detail=x?.error?.message||detail}catch{}console.error("OpenAI API error",r.status,raw);return jr(r.status,{ok:false,error:"OpenAI request failed.",detail})}
  let data;try{data=JSON.parse(raw)}catch{return jr(502,{ok:false,error:"OpenAI returned unreadable data."})}
  let out=data.output_text||"";if(!out&&Array.isArray(data.output))for(const item of data.output)for(const x of item?.content||[])if(x?.type==="output_text"&&x?.text)out+=x.text;
  if(!out)return jr(502,{ok:false,error:"AI returned no project."});
  let project;try{project=JSON.parse(clean(out))}catch{return jr(502,{ok:false,error:"AI returned invalid project data.","detail":"Please try again."})}
  return jr(200,{ok:true,model,project})
 }catch(e){console.error(e);if(e?.name==="AbortError")return jr(504,{ok:false,error:"AI took too long. Please try again."});return jr(500,{ok:false,error:"AI server error.",detail:String(e?.message||e)})}
};