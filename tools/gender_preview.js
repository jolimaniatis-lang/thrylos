#!/usr/bin/env node
/* Προεπισκόπηση προτεινόμενων τιμών gender για schedule/season.json — ΔΕΝ γράφει στη βάση ούτε στο data/.
   Χρήση: node tools/gender_preview.js [season.json] [out.json]
   Κανόνας: gender προτείνεται μόνο όταν η κεντρική ταξινόμηση του index.html (classifyText) είναι βέβαιη,
   ή όταν υπάρχει επιβεβαίωση από επίσημη πηγή στον πίνακα EVIDENCE παρακάτω. Αλλιώς μένει χωρίς πεδίο. */
const fs=require("fs"),vm=require("vm"),path=require("path");
const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const a=html.indexOf("const TEAMS=["),b=html.indexOf("function liveCardOf");
const ctx=vm.runInNewContext(html.slice(a,b)+";({TEAM_BY,classifyTeam,classifyText})",{});
const season=JSON.parse(fs.readFileSync(process.argv[2]||path.join(root,"data/schedule/season.json"),"utf8"));
/* επιβεβαιώσεις από επίσημες πηγές (έρευνα 02/11/2026) */
const EVIDENCE={
 "2026-10-06|Αννόβερο":{g:"m",src:"European Aquatics – Champions League Men 2026-27, όμιλος Olympiacos–Sabadell–Jadran–Waspo'98 Hannover· 06/10 Ολυμπιακός–Hannover 17-10 (en.wikipedia.org/wiki/2026–27_European_Aquatics_Champions_League)"},
 "2026-10-27|Γιαντράν Έρτσεγκ Νόβι":{g:"m",src:"europeanaquatics.org: «Champions League Men: Olympiacos edge Jadran on penalties after 28-goal thriller» — 27/10, Group A, Day 2, 19-17 στα πέναλτι"},
 "2026-11-27|MRK Sloga Doboj":{g:"m",src:"eurohandball.com: EHF European Cup Men, Round 3, Olympiacos SFP–MRK Sloga Doboj, 27/11 15:30 CET Ηλιούπολη"},
 "2026-11-28|MRK Sloga Doboj":{g:"m",src:"eurohandball.com: EHF European Cup Men, Round 3, MRK Sloga Doboj–Olympiacos SFP, 28/11 10:30 CET Ηλιούπολη"}};
const out=[],stats={text:0,evidence:0,unclassified:0,already:0};
for(const m of season.matches){
  const r=ctx.classifyTeam(m.sport,m.comp,m.gender),k=m.d+"|"+m.opp;
  let prop=null,why="";
  if(r.id&&!r.rule.startsWith("πεδίο")){prop=ctx.TEAM_BY[r.id].g;why="τίτλος: "+r.rule;stats.text++}
  else if(r.id){prop=m.gender;why="υπάρχει ήδη";stats.already++}
  else if(EVIDENCE[k]){prop=EVIDENCE[k].g;why="επίσημη πηγή: "+EVIDENCE[k].src;stats.evidence++}
  else{why="ΑΜΦΙΒΟΛΙΑ: "+r.why;stats.unclassified++}
  /* έλεγχος: η τιμή με πηγή πρέπει να ταξινομείται ΣΩΣΤΑ μέσω του πεδίου */
  if(prop){const chk=ctx.classifyTeam(m.sport,m.comp,prop);if(!chk.id||ctx.TEAM_BY[chk.id].g!==prop)why+=" ⚠ ΑΝΤΙΦΑΣΗ ΜΕ ΤΙΤΛΟ"}
  out.push({d:m.d,sport:m.sport,comp:m.comp,opp:m.opp,proposed:prop,team:prop?ctx.TEAM_BY[ctx.classifyTeam(m.sport,m.comp,prop).id||"x"]?.id||null:null,why});
}
const bad=out.filter(o=>/ΑΝΤΙΦΑΣΗ/.test(o.why));
console.log(JSON.stringify({total:season.matches.length,...stats,contradictions:bad.length},null,0));
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(out,null,1));
process.exitCode=bad.length||stats.unclassified?1:0;
