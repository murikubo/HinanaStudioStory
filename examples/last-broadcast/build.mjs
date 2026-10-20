import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseProject, start, next, choose, matches } from '../../src/model.ts';
import { inspectFlow } from '../../src/flow.ts';
const root=path.dirname(fileURLToPath(import.meta.url));
let serial=0;
const d=(speaker,text,extra={})=>({id:`lb-block-${++serial}`,type:'dialogue',speaker,text,choices:[],...extra});
const n=(text,extra={})=>d('',text,extra), y=(text,extra={})=>d('서윤',text,extra), me=(text,extra={})=>d('나',text,extra);
const option=(text,target,condition)=>({id:`lb-choice-${++serial}`,text,target,...(condition?{condition}:{})});
const c=(text,choices)=>({id:`lb-block-${++serial}`,type:'choice',speaker:'나',text,choices});
const warm={character:'seoyun-smile'}, hidden={character:'__none'};
const scenes=[];
function scene(id,title,lines,nextScene='',extra={}){scenes.push({id,title,background:'room-sunset',character:'seoyun-neutral',position:'right',characterScale:92,bgm:'memory',volume:.36,loop:true,transition:'fade',duration:700,characterMotion:'fade',bgmFade:1000,lines,next:nextScene,...extra});}
scene('arrival','01 · 먼지가 기억하는 목소리',[
 n('학교가 문을 닫는 날, 방송실 열쇠는 이상하리만큼 가벼웠다. 네 해 동안 잊고 지낸 쇠붙이가 주머니 안에서 조용히 부딪쳤다.',{...hidden,sfx:'chime',sfxVolume:.2}),
 n('교실은 이미 비어 있었다. 내년이면 이 건물은 작은 도서관이 된다고 했다. 사라지는 것보다 이름이 바뀌는 것이 조금 낯설었다.',hidden),
 n('반쯤 열린 방송실 문 너머로 종이 냄새와 따뜻한 먼지 냄새가 났다. 책상 위의 낡은 마이크만은 아직 제 자리를 지키고 있었다.',hidden),
 y('늦었네. 네가 안 오면 이 테이프들을 전부 혼자 들을 뻔했어. 그러면 오늘 안에 정리가 안 끝났을걸.'),
 me('버스를 하나 놓쳤어. 그런데 정말 전부 버리는 거야? 네가 날짜까지 적어 놓았던 테이프들인데.'),
 y('남길 것만 고르래. 새 도서관에 보관함 하나는 만들어 준대. 딱 한 상자만. 추억에도 정원이라는 게 있나 봐.'),
 n('서윤은 웃으려다 말고, 손에 든 빈 카드를 뒤집었다. 카디건 소매에 묻은 먼지를 털어 내는 동작이 유난히 천천했다.'),
 y('마지막 방송도 하나 녹음해 달래. 대단한 건 아니고, 문 닫을 때 틀 인사말. 그런데 첫 문장부터 안 써져.'),
 me('매일 점심시간에 그렇게 잘했으면서. 마이크 앞에만 앉으면 다른 사람 같았는데.'),
 y('그때는 내일 할 방송이 있었잖아. 오늘은 끝내고 나면 다음 대본이 없어서 그런가 봐.'),
 n('책상 한쪽에는 준비된 원고와 이름 없는 테이프가 놓여 있었다. 나는 상자 손잡이에서 손을 떼고 서윤 쪽으로 의자를 돌렸다.'),
 c('마지막 인사를 쓰지 못한 서윤에게, 나는 먼저 무엇을 할까?',[
  option('대본은 잠깐 두고, 네 이야기를 듣고 싶어.','listen'),
  option('일단 테이프부터 정리하자. 천천히 생각해도 돼.','tidy')
 ])
]);
scene('listen','02A · 먼저 듣는 사람',[
 me('시간이 조금 걸려도 괜찮아. 오늘 사람들이 무슨 말을 듣고 싶어 할지 말고, 네가 무슨 말을 하고 싶은지부터 알려 줘.',{effects:[{variableId:'courage',operation:'add',value:1}]}),
 y('그런 질문은 반칙이지. 늘 방송실에 있었는데, 정작 나는 제대로 인사하고 나온 적이 없는 것 같아.'),
 y('졸업식 날에도 장비만 끄고 갔거든. 고맙다는 말은 나중에도 할 수 있을 줄 알았어. 나중이 이렇게 먼 날일 줄은 몰랐고.'),
 n('서윤은 카드 모서리를 만지작거렸다. 문장을 고르는 사람의 침묵을 나는 처음으로 서두르지 않고 기다렸다.'),
 me('그럼 오늘 하면 되겠다. 잘 쓴 인사보다, 네 목소리로 한 번 들으면 그걸로 충분한 사람도 있을 거야.'),
 y('응. 그 말을 네가 먼저 해 줘서 다행이다. 혼자 생각할 때는 자꾸 너무 늦은 것만 같았거든.',warm),
 n('그녀는 빈 카드에 한 글자를 적었다가 지웠다. 이번에는 지운 자리를 오래 바라보지 않았다.')
],'tape');
scene('tidy','02B · 빈칸을 남기는 정리',[
 me('한 상자만 남겨야 한다면 제대로 골라야겠네. 녹음은 그다음에 해도 돼. 손이 바쁘면 문장이 떠오를지도 몰라.'),
 y('좋아. 그럼 넌 라벨 없는 것들. 나는 날짜 적힌 것들. 수상한 테이프가 나오면 먼저 나한테 검사받고.'),
 n('우리는 책상 양쪽에 앉았다. 케이스가 맞물리는 소리가 빗방울처럼 일정하게 이어졌다. 말하지 않아도 편한 시간은 오랜만이었다.'),
 me('이건 제목이 “절대 재생 금지”인데? 네 글씨 같은데, 이런 게 오히려 가장 궁금하다는 건 알고 쓴 거야?'),
 y('그건 정말 금지야. 아마 발음 연습하다가 웃음이 터진 녹음일 거야. 나도 기억이 안 나니까 더 위험해.'),
 n('서윤이 내 쪽으로 손을 뻗다가 웃었다. 정리할 수 없는 것들은 잠깐 책상 가운데에 두기로 했다. 빈칸을 남기는 것도 정리였다.'),
 y('그래도 같이하니까 낫네. 혼자였으면 빈 케이스까지 다 아깝다고 하고 있었을 것 같아.',warm)
],'tape');
scene('tape','03 · 녹음되지 않은 인사',[
 n('상자 바닥에서 작은 테이프 하나가 나왔다. 라벨에는 날짜 대신 “내일, 이어서”라고 적혀 있었다. 그 아래엔 익숙한 내 이름이 보였다.'),
 me('이것도 네가 정리한 거야? 내 이름이 왜 여기 있어? 나는 원고 읽다가 혀가 꼬인 것밖에는 기억이 안 나는데.'),
 y('졸업식 전날 녹음. 네가 편집해 준다고 가져갔다가 돌려준 거. 뒤에 뭔가 남아 있었는데, 끝까지는 안 들었어.'),
 n('나는 재생 버튼에 손을 올렸다. 서윤은 고개를 끄덕였다. 짧은 기계음 뒤로, 조금 높고 서투른 예전의 내 목소리가 흘러나왔다.',{sfx:'click',sfxVolume:.42}),
 d('테이프 속 나','이상으로 오늘의 점심 방송을 마칩니다. 그리고… 아, 이건 방송에 넣지 말고. 서윤아, 내일 시간 좀 있어?'),
 n('녹음은 거기서 끝나 있었다. 그 뒤에 무슨 말을 하려 했는지는, 빈 테이프의 가느다란 소음만이 대신하고 있었다.',{sfx:'stop',sfxVolume:.3}),
 y('네가 내일을 너무 많이 남겨 놨네. 그날도, 오늘도. 무슨 이야기를 하려고 했는데?'),
 me('방송을 계속할까 고민했어. 대학에 가서도. 그런데 네가 그만둔다고 하면 나도 그만둘 것 같아서, 먼저 묻기가 싫었어.'),
 y('나는 네가 이미 다른 일로 바쁜 줄 알았어. 그래서 묻지 않은 건데. 둘 다 상대가 먼저 정한 줄 알았구나.'),
 n('우리는 잠깐 마주 보다가 웃었다. 누군가 크게 잘못한 일도 아닌데, 오래 닫혀 있던 작은 서랍 하나가 열리는 기분이었다.'),
 me('결국 우리 둘 다 다른 일을 하고 있네. 나는 매일 회의록을 쓰고, 넌 책을 고르고. 말과 목소리를 완전히 떠나지는 못했지만.'),
 y('서점에서 손님한테 책을 권할 때 가끔 생각해. 방송도 이런 일이었구나. 모르는 누군가에게, 지금 필요한 말을 골라 주는 거.'),
 n('창문으로 들어온 빛이 카드 위에서 조금씩 옮겨 갔다. 버리지 않을 테이프의 자리를 한 칸 비워 두자, 상자의 모양이 정해졌다.'),
 y('이건 남기자. 잘된 방송은 아니지만, 끝나지 않은 방송도 하나쯤 있어야 다음 사람이 이어서 할 수 있을 것 같아.'),
 me('그럼 마지막 인사도 완벽하게 끝내려고 하지 말자. 오늘 고마웠다는 말만 제대로 전하면 되는 거 아닐까?'),
 y('그렇게 말하니까 할 수 있을 것 같기도 해. 다만, 막상 불이 들어오면 준비한 문장 뒤로 숨어 버릴지도 모르겠다.'),
 c('녹음 버튼을 누르기 전, 나는 서윤에게 어떤 말을 건넬까?',[
  option('틀려도 괜찮아. 지금 하고 싶은 말을 해 줘.','honest'),
  option('준비한 원고로 시작하자. 내가 옆에서 맞춰 줄게.','script')
 ])
]);
scene('honest','04A · 원고 밖의 한 문장',[
 me('틀리면 다시 녹음하면 돼. 지금 하고 싶은 말을 해 줘. 내일이면 잊어버릴 것 같은 말부터.',{effects:[{variableId:'courage',operation:'add',value:1}]}),
 y('그럼 첫 줄만 적어 둘래. 그다음은 잘 모르겠어도. 말하는 동안 생각나는 걸 믿어 볼게.'),
 n('서윤은 빼곡한 원고를 뒤집었다. 뒷면에 쓴 문장은 짧았다. “여러분 덕분에, 제 목소리를 좋아하게 되었습니다.”'),
 me('좋은 첫 문장이네. 나는 편집 안 할게. 말이 조금 겹치거나 숨이 들어가도, 그건 오늘 여기 있었다는 증거니까.'),
 y('대신 너무 웃기게 숨 쉬면 한 번만 잘라 줘. 용기 내는 거랑 영원히 남겨도 되는 거랑은 좀 다르잖아.',warm),
 n('우리는 마지막으로 소리를 맞췄다. 헤드폰을 건네는 손끝이 가벼웠다. 이번에는 녹음 버튼 앞에서 아무도 시간을 끌지 않았다.'),
 y('준비됐어. 네가 옆에서 듣고 있다는 것까지 같이 녹음되는 기분이야. 자, 시작해 보자.',warm)
],'on-air');
scene('script','04B · 함께 읽는 속도',[
 me('처음부터 전부 바꾸지 않아도 돼. 준비한 원고로 시작하자. 내가 옆에서 맞춰 줄게. 중간에 다른 말이 나오면 그때 따라가고.'),
 y('응. 첫 걸음부터 크게 내디디려고 해서 어려웠나 봐. 첫 문장은 익숙한 걸로 할래. “안녕하세요, 방송부입니다.”'),
 n('서윤은 원고를 반듯하게 폈다. 나는 줄이 바뀔 때마다 손가락으로 다음 문장을 가리키기로 했다. 예전에 자주 하던 방식이었다.'),
 me('네가 천천히 읽으면 나도 천천히 넘길게. 방송이 조금 길어져도, 오늘은 다음 순서 기다리는 사람 없잖아.'),
 y('점심시간도 아니고. 급하게 음악을 틀 이유도 없고. 이렇게 편한 방송은 처음일지도 모르겠다.',warm),
 n('우리는 마지막으로 소리를 맞췄다. 오래된 다이얼은 여전히 조금씩 어긋났지만, 서로의 속도를 맞추는 일은 생각보다 쉬웠다.'),
 y('준비됐어. 네가 한 줄씩 같이 읽어 주니까, 혼자 인사하는 기분이 아니라서 좋아. 시작하자.',warm)
],'on-air');
scene('on-air','05 · 마지막 방송이 끝나기 전에',[
 n('녹음기의 붉은 불이 켜졌다. 우리는 그 작은 빛을 보면서 잠깐 숨을 골랐다. 창밖에서는 운동장 빗자루가 바닥을 스치는 소리가 났다.',{sfx:'click',sfxVolume:.4}),
 y('안녕하세요, 방송부입니다. 오늘은 이 학교에서 보내는 마지막 인사를 녹음하고 있습니다. 평소보다 조금 천천히 말해도 괜찮겠지요.'),
 y('매일 같은 시간에 같은 음악을 틀던 일이, 그때는 아주 작은 일인 줄 알았습니다. 그런데 작은 일들이 모여서 하루의 모양을 만들었네요.'),
 n('나는 다음 줄을 가리키려다 손을 멈췄다. 서윤은 원고를 내려다보지 않고 있었다. 익숙한 인사 다음에, 오늘의 목소리가 이어지고 있었다.'),
 y('듣고 계신 분이 한 분뿐인 날도 있었을 겁니다. 그래도 누군가는 잠깐 고개를 들었을 거라고 생각하면, 이 방이 그렇게 작지는 않았어요.'),
 y('복도에서 들은 노래 하나나, 점심시간의 시시한 이야기가 기억난다면… 그 기억을 새 건물에도 조금 가져가 주세요. 저희도 그러겠습니다.',warm),
 n('말끝이 아주 조금 떨렸다. 나는 손가락을 원고 대신 책상 위에 놓았다. 다음 문장을 대신해 줄 수는 없지만, 기다리는 일은 할 수 있었다.'),
 y('그리고 제 옆에서 원고를 넘겨 주던 사람에게도요. 내일 하자고 남겨 둔 이야기는, 지금부터 조금씩 해 보려고 합니다.',warm),
 me('응. 이번에는 들었어. 끝까지.'),
 n('내 목소리까지 들어간 걸 깨닫고 서로 눈이 커졌다. 서윤이 먼저 웃었다. 녹음기의 불은 여전히 켜져 있었고, 나는 이번에도 지우지 않았다.'),
 y('오늘 방송을 마칩니다. 이곳에서 보낸 시간에, 그리고 서로의 말을 기다려 준 모든 분께… 고맙습니다.'),
 n('정지 버튼이 내려앉았다. 방송실이 갑자기 조용해졌다. 하지만 조금 전과 달리, 그 침묵에는 다음에 할 말이 들어갈 자리가 있었다.',{sfx:'stop',sfxVolume:.32}),
 c('상자를 닫기 전, 나는 마지막 카드를 집어 들었다.',[
  option('“내일, 이어서” 뒤에 다음 약속을 적는다.','tomorrow',{variableId:'courage',operator:'>=',value:2}),
  option('오늘의 날짜를 적고, 녹음한 인사를 함께 남긴다.','archive')
 ])
],'',{background:'room-dusk',bgm:'music-tomorrow',volume:.33});
scene('tomorrow','ENDING A · 내일, 이어서',[
 me('이 카드, 아직 빈자리가 있네. 내일 다섯 시. 역 앞 카페. 이번에는 녹음 없이 이야기하자. 내가 먼저 물어볼게.'),
 y('내일도 이 시간? 좋아. 대신 시간 맞춰 와. 다음 방송 기다리는 사람이 한 명은 있는 거니까.',warm),
 n('서윤은 내 글씨 아래에 작은 체크 표시를 했다. “내일, 이어서”라는 오래된 라벨 옆에, 처음으로 정확한 약속이 생겼다.'),
 y('오늘 네가 먼저 들어 줘서 나도 내 말을 꺼낼 수 있었어. 다음에는 내가 먼저 물어볼게. 요즘 네 하루는 어떤 모양이야?',warm),
 me('그건 길어질 것 같은데. 버스 한 대쯤은 놓쳐도 될 만큼. 내일 이어서 할까? 아니, 첫 문장만 지금 말할게.'),
 n('카드가 테이프 케이스 안으로 들어갔다. 남겨 두는 말과 미루는 말은 다른 것이었다. 이번에는 그 차이를 조금 알 것 같았다.'),
 n('우리는 불을 끄고 상자를 함께 들었다. 복도를 걸어 나오는 동안 새로 생길 도서관의 창가 자리를 상상했다.',{character:'__none',sfx:'chime',sfxVolume:.25}),
 n('어떤 방은 문을 닫아도 그 안에서 배운 일을 끝내지 않는다. 나는 무언가를 정리하러 왔다가, 다음 이야기를 약속하고 돌아갔다.',hidden),
 d('','마지막 방송은 끝났다. 내일의 첫 문장은, 이미 시작되어 있었다.',hidden)
],'',{background:'room-dusk',bgm:'music-tomorrow',character:'seoyun-smile',volume:.3});
scene('archive','ENDING B · 한 상자 분량의 안녕',[
 n('나는 카드에 오늘의 날짜를 천천히 적었다. 서윤은 그 옆에 “마지막 방송” 대신 “함께 남긴 인사”라고 덧붙였다.'),
 me('이렇게 적으면 나중에 누가 들어도 오늘 둘이 있었다는 걸 알겠네. 잘 마친 방송 하나보다, 그게 더 정확한 제목 같아.'),
 y('응. 다음 사람이 상자를 열면 조금 어색하게 웃겠지. 왜 마지막에 편집도 안 한 목소리가 두 개나 들어 있냐고.',warm),
 n('우리는 맨 위에 그 테이프를 놓았다. “내일, 이어서”라고 적힌 예전의 테이프도 바로 옆에 남겼다. 끝나지 않은 말까지 함께 보관하기로 했다.'),
 y('아직 다 하지는 못한 것 같아. 그래도 오늘 한 만큼은 분명히 남았네. 다음에 만나면, 남은 것도 조금씩 이야기하자.'),
 me('그래. 완벽하게 정리한 다음에 연락하려고 하지는 말자. 별일 없어도 그냥, 오늘 들은 노래 하나 보내는 정도로.'),
 n('서윤이 고개를 끄덕였다. 커다란 약속 대신 손에 들어오는 만큼의 인사를 나눴다. 그 작은 무게가, 생각보다 오래 남을 것 같았다.',warm),
 n('불을 끈 방송실에는 저녁빛만 남았다. 우리는 상자 양쪽을 나누어 들고 문을 닫았다. 열쇠는 들어올 때보다 조금 따뜻했다.',{character:'__none',sfx:'chime',sfxVolume:.22}),
 d('','모든 이야기를 끝내지 않아도 괜찮다. 오늘 전한 인사만으로, 닫힌 문 하나가 조금 덜 쓸쓸해졌다.',hidden)
],'',{background:'room-dusk',bgm:'music-tomorrow',character:'seoyun-smile',volume:.3});
const definitions=[
 ['room-sunset','방송실 · 노을','background','broadcast-sunset.png'],['room-dusk','방송실 · 저녁','background','broadcast-dusk.png'],
 ['seoyun-neutral','서윤 · 망설임','character','seoyun-neutral.png'],['seoyun-smile','서윤 · 미소','character','seoyun-smile.png'],
 ['memory','BGM · 먼지가 기억하는 목소리','audio','memory-loop.wav'],['music-tomorrow','BGM · 내일의 첫 문장','audio','tomorrow-loop.wav'],
 ['click','효과음 · 녹음 버튼','audio','record-click.wav'],['stop','효과음 · 테이프 정지','audio','tape-stop.wav'],['chime','효과음 · 작은 종소리','audio','soft-chime.wav']
];
const assets=await Promise.all(definitions.map(async([id,name,type,file])=>({id,name,type,url:`data:${file.endsWith('.png')?'image/png':'audio/wav'};base64,${(await readFile(path.join(root,'assets',file))).toString('base64')}`})));
const project={version:1,id:'last-broadcast-original-v1',title:'마지막 방송이 끝나기 전에',startScene:'arrival',variables:[{id:'courage',name:'함께 낸 용기',initial:0}],scenes,assets};
parseProject(JSON.stringify(project));
const issues=inspectFlow(project);if(issues.length)throw Error(JSON.stringify(issues));
const routes=[];
function walk(session,text=0,blocks=0,decisions=[]){
 const s=project.scenes.find(s=>s.id===session.sceneId),line=s.lines[session.index];text+=line.text.length;blocks++;
 if(line.type==='choice')for(const option of line.choices.filter(c=>matches(c.condition,session.variables)))walk(choose(project,session,option.id),text+option.text.length,blocks,[...decisions,option.text]);
 else {const following=next(project,session);if(following)walk(following,text,blocks,decisions);else routes.push({ending:s.title,characters:text,blocks,estimatedMinutes:Number((text/900+.35).toFixed(1)),decisions});}
}
walk(start(project,project.startScene));
await writeFile(path.join(root,'마지막 방송이 끝나기 전에.hinanastory'),JSON.stringify(project));
await writeFile(path.join(root,'routes.json'),JSON.stringify(routes,null,2));
console.log(JSON.stringify({scenes:scenes.length,blocks:scenes.reduce((n,s)=>n+s.lines.length,0),bytes:Buffer.byteLength(JSON.stringify(project)),routes:routes.map(({decisions,...r})=>r)},null,2));
