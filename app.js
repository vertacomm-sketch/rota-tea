"use strict";
/* ---------- utilidades ---------- */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>{try{return crypto.randomUUID()}catch(e){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16)})}};
const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const todayISO=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const parseISO=s=>{if(!s)return null;const[a,b,c]=s.split('-').map(Number);return new Date(a,b-1,c)};
const fmtBR=s=>{const d=parseISO(s);return d?String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear():''};
const fmtLong=s=>{const d=parseISO(s);return d?d.getDate()+' de '+MESES[d.getMonth()]+' de '+d.getFullYear():''};
const fmtStamp=ms=>{const d=new Date(ms);return d.toLocaleDateString('pt-BR')+' às '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})};
function addBusinessDays(date,n){const d=new Date(date);let k=0;while(k<n){d.setDate(d.getDate()+1);const w=d.getDay();if(w!==0&&w!==6)k++}return d}
const LS={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('on'),2600)}
function modal(html,bind){const m=$('#modal');$('#modal-box').style.maxWidth='';$('#modal-box').innerHTML=html;m.classList.add('on');if(bind)bind($('#modal-box'));const f=$('#modal-box').querySelector('button,input');if(f)f.focus()}
function closeModal(){$('#modal').classList.remove('on')}
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
function withTimeout(p,ms){return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej({code:'timeout'}),ms))])}
async function _unused_sha(s){try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')}catch(e){let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))|0;return 'x'+h}}


/* ---------- armazenamento: só neste aparelho ---------- */
const LSK={perfil:'rt_perfil',check:'rt_checklist',docs:'rt_docs'};
const Store={
  ready:true, user:{id:'local'},
  logged(){return true},
  _get(k,d){const v=LS.get(k);return v==null?d:v},
  _put(k,v){if(!LS.set(k,v))throw new Error('storage-full')},
  async getProfile(){return this._get(LSK.perfil,{})},
  async getChecklist(){return this._get(LSK.check,{})},
  async saveProfile(p){this._put(LSK.perfil,p)},
  async saveChecklist(c){this._put(LSK.check,c)},
  async listDocs(){return this._get(LSK.docs,[]).slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))},
  async saveDoc(doc){
    const all=this._get(LSK.docs,[]);const now=Date.now();
    doc.updatedAt=now;doc.createdAt=doc.createdAt||now;
    const copy=JSON.parse(JSON.stringify(doc));const i=all.findIndex(x=>x.id===doc.id);
    if(i>=0)all[i]=copy;else all.push(copy);this._put(LSK.docs,all);return doc;
  },
  async deleteDoc(id){this._put(LSK.docs,this._get(LSK.docs,[]).filter(x=>x.id!==id))},
  hasData(){return this._get(LSK.docs,[]).length>0||Object.keys(this._get(LSK.perfil,{})).some(k=>(this._get(LSK.perfil,{})[k]||'').toString().trim())},
  exportAll(){return {app:'rota-tea',versao:1,exportadoEm:new Date().toISOString(),perfil:this._get(LSK.perfil,{}),checklist:this._get(LSK.check,{}),documentos:this._get(LSK.docs,[])}},
  importAll(o){
    if(!o||o.app!=='rota-tea'||!Array.isArray(o.documentos))throw new Error('arquivo-invalido');
    const all=this._get(LSK.docs,[]);
    o.documentos.forEach(d=>{if(!d||!d.id||!d.type)return;const i=all.findIndex(x=>x.id===d.id);if(i<0)all.push(d);else if((d.updatedAt||0)>(all[i].updatedAt||0))all[i]=d});
    this._put(LSK.docs,all);
    if(o.perfil&&typeof o.perfil==='object')this._put(LSK.perfil,o.perfil);
    if(o.checklist&&typeof o.checklist==='object')this._put(LSK.check,o.checklist);
    return o.documentos.length;
  },
  eraseAll(){Object.values(LSK).forEach(k=>LS.del(k))}
};
let PROFILE={};
const STATUS={rascunho:'Rascunho',pronto:'Pronto para enviar',enviado:'Enviado',respondido:'Resposta recebida'};
function statusPill(d){if(d.type==='ficha')return '<span class="st st-ficha">Em acompanhamento</span>';const s=d.status||'rascunho';return '<span class="st st-'+s+'">'+STATUS[s]+'</span>'}
function errMsg(e){const m=String((e&&e.message)||e||'');
  if(/storage-full|quota/i.test(m))return 'O espaço deste navegador está cheio. Baixe uma cópia dos seus dados e exclua documentos antigos.';
  if(/arquivo-invalido|JSON/i.test(m))return 'Este arquivo não é uma cópia do Rota TEA.';
  return 'Não foi possível concluir agora. Tente novamente.'}
const CONTATO='contato@rotatea.com.br';

/* ---------- modelos ---------- */
const PROFILE_FIELDS=[
  {k:'responsavel_nome',label:'Seu nome (quem assina)',ph:'Nome completo'},
  {k:'responsavel_contato',label:'Seu contato para resposta',ph:'E-mail ou telefone'},
  {k:'cidade',label:'Cidade',ph:'Ex.: Campinas'},
  {k:'beneficiario',label:'Nome da pessoa beneficiária',ph:'Nome de quem usa o plano',help:'Se for criança ou adolescente, você pode usar só as iniciais.'},
  {k:'carteirinha',label:'Número da carteirinha',ph:'Número do beneficiário'},
  {k:'operadora',label:'Operadora do plano',ph:'Nome da operadora'}
];
const P=(k,label,ph,extra)=>Object.assign({k,label,ph,profile:true},extra||{});
const F={
  operadora:P('operadora','Operadora','Nome da operadora'),
  beneficiario:P('beneficiario','Beneficiário','Nome do beneficiário',{help:'Se for criança ou adolescente, você pode usar só as iniciais.'}),
  carteirinha:P('carteirinha','Carteirinha','Número'),
  cidade:P('cidade','Cidade','Cidade'),
  responsavel_nome:P('responsavel_nome','Seu nome (quem assina)','Nome completo'),
  responsavel_contato:P('responsavel_contato','Seu contato para resposta','E-mail ou telefone'),
  data:{k:'data',label:'Data da carta',type:'date',today:true}
};
const IDENT=[F.operadora,F.beneficiario,F.carteirinha];
const QOPTS=['Pessoa beneficiária (eu mesmo/a)','Mãe, pai ou responsável legal','Apoiador(a) em tomada de decisão apoiada','Curador(a)'];
const QDEF={mim:QOPTS[0],menor:QOPTS[1],adulto:QOPTS[2]};
F.qualidade={k:'qualidade',label:'Você assina como',type:'select',opts:QOPTS,get def(){return QDEF[PROFILE.para]||QOPTS[0]},help:'A pessoa autista adulta decide sobre a própria saúde e pode assinar com apoio. Só com curatela outra pessoa assina por ela.'};
const CLOSE=[F.cidade,F.data,F.responsavel_nome,F.qualidade,F.responsavel_contato];
function quali(f){const q=f.qualidade||QDEF[PROFILE.para]||QOPTS[0];const b=v(f,'beneficiario','NOME DO BENEFICIÁRIO');if(q===QOPTS[1])return ', na qualidade de mãe, pai ou responsável legal de '+b;if(q===QOPTS[2])return ', como apoiador(a) de '+b+', que também assina';if(q===QOPTS[3])return ', na qualidade de curador(a) de '+b;return ''}
function v(f,k,ph){const x=(f[k]||'').toString().trim();return x||'['+ph+']'}
function vd(f,k,ph){return f[k]?fmtBR(f[k]):'['+ph+']'}
function closingLine(f){return v(f,'cidade','CIDADE')+', '+(f.data?fmtLong(f.data):'[DATA]')+' | '+v(f,'responsavel_nome','SEU NOME')+quali(f)+' · '+v(f,'responsavel_contato','CONTATO')}

const TYPES={
  pedido:{
    name:'Solicitação inicial',tag:'Modelo 1',file:'Pedido_Terapia',
    desc:'Pedido de autorização e garantia de atendimento, com prescrição e relatório anexos.',
    tip:'Antes de enviar, confira os anexos, peça o protocolo e salve o comprovante da mensagem.',
    groups:[
      {t:'Identificação',fields:IDENT},
      {t:'O que você está pedindo',fields:[
        {k:'terapia',label:'Terapia ou procedimento',type:'textarea',ph:'DESCREVER TERAPIA OU PROCEDIMENTO',help:'Ex.: fonoaudiologia e terapia ocupacional.'},
        {k:'indicacao',label:'Profissionais, frequência e método indicados',type:'textarea',ph:'PROFISSIONAIS, FREQUÊNCIA E MÉTODO, SE HOUVER',help:'Use exatamente o que consta na prescrição ou no relatório.'}
      ]},
      {t:'Anexos',fields:[{k:'anexos',type:'checks',opts:['Prescrição','Relatório','Plano terapêutico','Documento de identificação','Carteirinha'],def:['Prescrição','Relatório','Plano terapêutico','Documento de identificação','Carteirinha']},{k:'anexos_outros',label:'Outros anexos',ph:'',optional:true}]},
      {t:'Assinatura',fields:CLOSE}
    ],
    build(f){return{
      to:'À '+v(f,'operadora','NOME DA OPERADORA'),
      meta:['Beneficiário: '+v(f,'beneficiario','NOME')+' | Carteirinha: '+v(f,'carteirinha','NÚMERO')],
      subject:'Assunto: solicitação de autorização e garantia de atendimento',
      paras:[
        'Solicito autorização e garantia de atendimento para '+v(f,'terapia','DESCREVER TERAPIA OU PROCEDIMENTO')+', conforme prescrição e relatório anexos.',
        'A indicação assistencial informa '+v(f,'indicacao','PROFISSIONAIS, FREQUÊNCIA E MÉTODO, SE HOUVER')+'. Peço que a operadora indique prestador habilitado e disponível dentro do prazo aplicável.',
        'Se não houver disponibilidade na rede, solicito alternativa adequada, inclusive fora da rede quando necessário, com custeio pela operadora e informação sobre transporte, se cabível.',
        'Peço número de protocolo e resposta clara e conclusiva, por escrito.'
      ],
      listTitle:'Anexos',list:attachList(f),
      closing:closingLine(f)}}
  },
  revisao:{
    name:'Justificativa e revisão',tag:'Modelo 2',file:'Pedido_Revisao',
    desc:'Pede a negativa ou a resposta por escrito, com fundamento, e a revisão da decisão.',
    tip:'Ao pedir revisão, cite o protocolo anterior e descreva em uma frase o que ainda precisa ser resolvido.',
    groups:[
      {t:'Identificação',fields:IDENT.concat([{k:'protocolo',label:'Protocolo anterior',ph:'NÚMERO'}])},
      {t:'O que aconteceu',fields:[
        {k:'data_pedido',label:'Data do pedido original',type:'date',ph:'DATA'},
        {k:'pedido',label:'O que foi solicitado',ph:'PEDIDO',help:'Ex.: autorização de sessões de terapia ocupacional.'},
        {k:'resposta',label:'O que você recebeu',type:'select',opts:['uma negativa','uma resposta incompleta','nenhuma solução até o momento'],def:'uma negativa'},
        {k:'resumo',label:'Resumo da resposta (opcional)',type:'textarea',optional:true,ph:'',help:'Uma ou duas frases, sem dados clínicos desnecessários.'}
      ]},
      {t:'Pedidos adicionais',fields:[
        {k:'junta',type:'toggle',label:'Incluir parágrafo sobre junta médica (divergência técnico-assistencial). Não marque em caso de urgência ou emergência.',def:false},
        {k:'rede',type:'toggle',label:'Incluir pedido de prestador por falta de rede',def:true}
      ]},
      {t:'Assinatura',fields:CLOSE}
    ],
    build(f){const p=[];
      let p1='Em '+vd(f,'data_pedido','DATA')+', solicitei '+v(f,'pedido','PEDIDO')+'. Recebi '+(f.resposta||'[NEGATIVA, RESPOSTA INCOMPLETA OU AUSÊNCIA DE SOLUÇÃO]')+'.';
      if((f.resumo||'').trim())p1+=' Em resumo: '+f.resumo.trim().replace(/\.?$/,'.');
      p.push(p1);
      p.push('Solicito a justificativa completa por escrito, em linguagem clara, com indicação da cláusula contratual ou norma utilizada e orientação para reanálise.');
      let p3='Peço também a revisão da decisão à luz da prescrição, do relatório assistencial e dos documentos anexos.';
      if(f.junta===true)p3+=' Caso exista divergência técnico-assistencial em hipótese que admita junta médica, solicito que a operadora informe formalmente o procedimento aplicável, sem ultrapassar os prazos de atendimento.';
      p.push(p3);
      if(f.rede!==false)p.push('Se a questão for falta de rede, peço indicação de prestador habilitado e disponível dentro do prazo, inclusive fora da rede quando necessário.');
      p.push('Aguardo resposta conclusiva e novo número de protocolo.');
      return{to:'À '+v(f,'operadora','NOME DA OPERADORA'),
        meta:['Beneficiário: '+v(f,'beneficiario','NOME')+' | Carteirinha: '+v(f,'carteirinha','NÚMERO')+' | Protocolo anterior: '+v(f,'protocolo','NÚMERO')],
        subject:'Assunto: justificativa escrita e revisão da resposta',paras:p,closing:closingLine(f)}}
  },
  ouvidoria:{
    name:'Reanálise pela Ouvidoria',tag:'Modelo 3',file:'Ouvidoria_Reanalise',
    desc:'Segunda análise dentro da operadora, com linha do tempo curta e solução pedida.',
    tip:'Envie à Ouvidoria uma linha do tempo curta: pedido, resposta recebida e solução que você solicita.',
    groups:[
      {t:'Identificação',fields:IDENT.concat([{k:'protocolos',label:'Protocolos anteriores',type:'textarea',ph:'NÚMEROS E DATAS',help:'Um por linha, com a data.'}])},
      {t:'Linha do tempo',fields:[
        {k:'descricao',label:'O que foi solicitado',ph:'DESCREVER'},
        {k:'data_pedido',label:'Data do pedido',type:'date',ph:'DATA'},
        {k:'ocorrido',label:'O que ocorreu até agora',type:'textarea',ph:'RESUMO OBJETIVO DA NEGATIVA, DEMORA OU FALTA DE REDE'},
        {k:'necessidade',label:'O que os documentos assistenciais indicam',type:'textarea',ph:'RESUMO DA NECESSIDADE'}
      ]},
      {t:'Pedidos adicionais',fields:[{k:'rede',type:'toggle',label:'Incluir pedido de alternativa custeada, transporte ou reembolso',def:true}]},
      {t:'Assinatura',fields:CLOSE}
    ],
    build(f){const p=[
      'Peço a reanálise da solicitação de '+v(f,'descricao','DESCREVER')+'. O pedido foi apresentado em '+vd(f,'data_pedido','DATA')+' e até o momento ocorreu '+v(f,'ocorrido','RESUMO OBJETIVO DA NEGATIVA, DEMORA OU FALTA DE REDE').replace(/\.$/,'')+'.',
      'Os documentos assistenciais indicam '+v(f,'necessidade','RESUMO DA NECESSIDADE').replace(/\.$/,'')+'. Anexo a prescrição, o relatório, os protocolos e as respostas recebidas.',
      'Solicito solução concreta, resposta conclusiva por escrito e informação sobre o prestador, a data de início e as demais providências necessárias.'];
      if(f.rede!==false)p.push('Se a rede não puder atender no prazo, peço alternativa custeada pela operadora e orientação sobre transporte ou reembolso, conforme o caso.');
      const prot=(f.protocolos||'').trim()?f.protocolos.trim().split(/\n+/).join('; '):'[NÚMEROS E DATAS]';
      return{to:'À OUVIDORIA DA '+v(f,'operadora','NOME DA OPERADORA').toUpperCase(),
        meta:['Beneficiário: '+v(f,'beneficiario','NOME')+' | Carteirinha: '+v(f,'carteirinha','NÚMERO'),'Protocolos anteriores: '+prot],
        subject:'Assunto: pedido de reanálise',paras:p,closing:closingLine(f)}}
  },
  ans:{
    name:'Relato para registro na ANS',tag:'Modelo 4',file:'Relato_ANS',
    desc:'Texto objetivo para registrar reclamação na ANS e pedir a intermediação pela NIP.',
    tip:'Depois de registrar a reclamação, acompanhe o e-mail informado e responda à ANS sobre a solução recebida.',
    groups:[
      {t:'Identificação',fields:[F.beneficiario,F.operadora,F.carteirinha,{k:'protocolo',label:'Protocolo da operadora (número e data)',ph:'NÚMERO E DATA'},
        {k:'assunto',label:'Assunto',type:'select',opts:['negativa de cobertura','demora na resposta','falta de rede','reembolso','outro'],def:'negativa de cobertura'}]},
      {t:'O relato',fields:[
        {k:'data_pedido',label:'Data do pedido à operadora',type:'date',ph:'DATA'},
        {k:'pedido',label:'O que foi pedido',ph:'DESCREVER O PEDIDO'},
        {k:'doc',label:'Documento que comprova a necessidade',ph:'PRESCRIÇÃO OU RELATÓRIO',def:'prescrição e relatório'},
        {k:'situacao',label:'A operadora…',type:'select',opts:['respondeu','não apresentou solução'],def:'respondeu'},
        {k:'resposta',label:'O que a operadora respondeu',type:'textarea',ph:'RESUMIR',showIf:f=>f.situacao!=='não apresentou solução'},
        {k:'data_limite',label:'Sem solução até',type:'date',ph:'DATA',showIf:f=>f.situacao==='não apresentou solução'},
        {k:'impacto',label:'Impacto atual',type:'textarea',ph:'DESCREVER DE FORMA OBJETIVA, SEM EXAGERO'},
        {k:'solucao',label:'Solução que você pede',ph:'AUTORIZAÇÃO, PRESTADOR, REEMBOLSO OU OUTRA SOLUÇÃO'},
        {k:'docs',label:'Documentos disponíveis',type:'textarea',ph:'LISTAR',help:'Um por linha.'}
      ]},
      {t:'Contato',fields:[F.responsavel_nome,F.responsavel_contato]}
    ],
    build(f){const resp=f.situacao==='não apresentou solução'?'A operadora não apresentou solução até '+vd(f,'data_limite','DATA')+'.':'A operadora respondeu que '+v(f,'resposta','RESUMIR').replace(/\.$/,'')+'.';
      const docs=(f.docs||'').trim()?f.docs.trim().split(/\n+/).join('; '):'[LISTAR]';
      return{to:'Relato para registro na ANS',
        meta:['Beneficiário: '+v(f,'beneficiario','NOME')+' | Operadora: '+v(f,'operadora','NOME')+' | Carteirinha: '+v(f,'carteirinha','NÚMERO'),'Protocolo da operadora: '+v(f,'protocolo','NÚMERO E DATA')],
        subject:'Assunto: '+(f.assunto||'[NEGATIVA, DEMORA, FALTA DE REDE OU REEMBOLSO]'),
        paras:['Em '+vd(f,'data_pedido','DATA')+', solicitei à operadora '+v(f,'pedido','DESCREVER O PEDIDO')+'. A necessidade está documentada por '+v(f,'doc','PRESCRIÇÃO OU RELATÓRIO')+'.',
          resp+' O impacto atual é '+v(f,'impacto','DESCREVER DE FORMA OBJETIVA, SEM EXAGERO').replace(/\.$/,'')+'.',
          'Peço a intermediação da ANS para que a operadora apresente resposta conclusiva e providencie '+v(f,'solucao','AUTORIZAÇÃO, PRESTADOR, REEMBOLSO OU OUTRA SOLUÇÃO')+'.',
          'Documentos disponíveis: '+docs+'.'],
        closing:v(f,'responsavel_nome','SEU NOME')+' · '+v(f,'responsavel_contato','CONTATO')}}
  },
  ficha:{
    name:'Ficha de Acompanhamento',tag:'Ficha',file:'Ficha_Acompanhamento',
    desc:'Uma linha para cada contato ou resposta, mais a linha do tempo essencial do caso.',
    tip:'Se um contato não gerar protocolo, registre o horário, o canal, capturas de tela e qualquer outro dado que comprove a tentativa.',
    groups:[
      {t:'Identificação',fields:[F.beneficiario,F.operadora,F.carteirinha,{k:'pedido_principal',label:'Pedido principal',ph:''}]},
      {t:'Contatos e respostas',rows:true},
      {t:'Linha do tempo essencial',fields:[
        {k:'d_primeiro',label:'Data do primeiro pedido',type:'date'},{k:'prazo',label:'Prazo informado',ph:''},
        {k:'d_resposta',label:'Data da negativa ou resposta',type:'date'},{k:'d_reanalise',label:'Reanálise solicitada em',type:'date'},
        {k:'ouvidoria',label:'Ouvidoria, se utilizada',ph:''},{k:'ans',label:'ANS/NIP, se utilizada',ph:''},
        {k:'resultado',label:'Resultado atual',type:'textarea',ph:''},{k:'proxima',label:'Próxima providência e responsável',type:'textarea',ph:''}
      ]}
    ]
  }
};
const ROWCOLS=[['data','Data','date'],['canal','Canal e contato'],['protocolo','Protocolo'],['resp','Pedido ou resposta'],['prazo','Prazo e próximo passo']];
function attachList(f){const a=(f.anexos||[]).slice();if((f.anexos_outros||'').trim())a.push(f.anexos_outros.trim());return a}

function allFields(type){const out=[];TYPES[type].groups.forEach(g=>(g.fields||[]).forEach(x=>out.push(x)));return out}
function newDoc(type){
  const t=TYPES[type];const f={};
  allFields(type).forEach(x=>{
    if(x.profile&&PROFILE[x.k])f[x.k]=PROFILE[x.k];
    else if(x.today)f[x.k]=todayISO();
    else if(x.def!==undefined)f[x.k]=Array.isArray(x.def)?x.def.slice():x.def;
  });
  const doc={id:uid(),type,status:'rascunho',title:t.name+(PROFILE.beneficiario?' · '+PROFILE.beneficiario.split(' ')[0]:''),fields:f};
  if(type==='ficha')doc.rows=[{data:todayISO(),canal:'',protocolo:'',resp:'',prazo:''}];
  return doc;
}
function missingCount(doc){
  if(doc.type==='ficha')return 0;
  const b=TYPES[doc.type].build(doc.fields);
  const txt=[b.to].concat(b.meta,[b.subject],b.paras,[b.closing]).join(' ');
  return (txt.match(/\[[^\]]+\]/g)||[]).length;
}


/* ---------- PDF ---------- */
function pdfReady(){return !!(window.jspdf&&window.jspdf.jsPDF)}
function pdfBase(kindLabel){
  const {jsPDF}=window.jspdf;const pdf=new jsPDF({unit:'mm',format:'a4'});
  const W=210,M=20;
  const header=()=>{pdf.setFillColor(23,50,77);pdf.rect(0,0,W,18,'F');pdf.setFillColor(232,115,90);pdf.rect(0,18,W,1.6,'F');
    if(window.__LOGO){try{pdf.addImage(window.__LOGO,'PNG',M,3.2,34.5,11.7)}catch(e){pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(13);pdf.text('ROTA TEA',M,11.5)}}else{pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(13);pdf.setCharSpace(0.6);pdf.text('ROTA TEA',M,11.5);pdf.setCharSpace(0);}
    pdf.setFont('helvetica','bold');pdf.setFontSize(7);pdf.setTextColor(233,185,73);pdf.text('CARTILHA PARA FAMÍLIAS  •  SAÚDE SUPLEMENTAR',W-M,11.5,{align:'right'})};
  header();
  pdf.setTextColor(19,120,107);pdf.setFont('helvetica','bold');pdf.setFontSize(8);pdf.text(kindLabel.toUpperCase(),M,30);
  const st={pdf,W,M,y:38,header};
  st.need=h=>{if(st.y+h>270){pdf.addPage();header();st.y=30}};
  st.text=(txt,o)=>{o=o||{};pdf.setFont('helvetica',o.bold?'bold':'normal');pdf.setFontSize(o.size||10.5);const c=o.color||[29,39,51];pdf.setTextColor(c[0],c[1],c[2]);
    const lines=pdf.splitTextToSize(String(txt),W-2*M-(o.indent||0));const lh=(o.size||10.5)*0.47;
    lines.forEach(l=>{st.need(lh);pdf.text(l,M+(o.indent||0),st.y);st.y+=lh});st.y+=(o.after==null?3:o.after)};
  st.finish=()=>{const n=pdf.getNumberOfPages();for(let i=1;i<=n;i++){pdf.setPage(i);pdf.setDrawColor(19,120,107);pdf.setLineWidth(.3);pdf.line(M,282,W-M,282);
    pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.setTextColor(90,101,114);
    pdf.text('Gerado na plataforma Rota TEA em '+new Date().toLocaleDateString('pt-BR')+'. Material educativo: não substitui orientação jurídica individual.',M,287);
    pdf.text(i+' / '+n,W-M,287,{align:'right'})}};
  return st;
}
function docPdf(doc){
  const t=TYPES[doc.type];const st=pdfBase(doc.type==='ficha'?'Acompanhe cada passo':t.tag+' · '+t.name);const pdf=st.pdf;
  if(doc.type==='ficha'){
    const f=doc.fields;
    st.text('Ficha de Acompanhamento',{bold:true,size:15,color:[23,50,77],after:4});
    [['Beneficiário',f.beneficiario],['Operadora',f.operadora],['Carteirinha',f.carteirinha],['Pedido principal',f.pedido_principal]].forEach(([a,b])=>st.text(a+': '+(b||'—'),{after:1}));
    st.y+=3;
    pdf.autoTable({startY:st.y,margin:{left:st.M,right:st.M,top:28},head:[ROWCOLS.map(c=>c[1])],
      body:(doc.rows||[]).map(r=>ROWCOLS.map(c=>c[2]==='date'?fmtBR(r[c[0]]):(r[c[0]]||''))),
      styles:{font:'helvetica',fontSize:8.5,cellPadding:2.2,lineColor:[226,229,233],lineWidth:.2,textColor:[29,39,51]},
      headStyles:{fillColor:[19,120,107],textColor:255},alternateRowStyles:{fillColor:[251,250,246]},
      didDrawPage:()=>{st.header()}});
    st.y=pdf.lastAutoTable.finalY+10;
    st.need(20);st.text('Linha do tempo essencial',{bold:true,size:12,color:[23,50,77],after:3});
    [['Data do primeiro pedido',fmtBR(f.d_primeiro)],['Prazo informado',f.prazo],['Data da negativa ou resposta',fmtBR(f.d_resposta)],['Reanálise solicitada em',fmtBR(f.d_reanalise)],['Ouvidoria, se utilizada',f.ouvidoria],['ANS/NIP, se utilizada',f.ans],['Resultado atual',f.resultado],['Próxima providência e responsável',f.proxima]]
      .forEach(([a,b])=>st.text(a+': '+(b||'—'),{after:1.5}));
  }else{
    const b=t.build(doc.fields);
    st.text(b.to,{bold:true,size:11,after:1});
    b.meta.forEach(m=>st.text(m,{size:10,after:1}));
    st.y+=1;st.text(b.subject,{bold:true,size:10.5,after:5});
    b.paras.forEach(p=>st.text(p,{after:3.5}));
    if(b.list&&b.list.length){st.y+=1;st.text(b.listTitle+':',{bold:true,size:10,after:1});st.text(b.list.join(' • '),{size:10,after:3})}
    st.y+=5;st.text(b.closing,{size:10.5});
  }
  st.finish();return pdf;
}
function checklistPdf(state){
  const st=pdfBase('Checklist de documentos');
  st.text('Checklist de documentos',{bold:true,size:15,color:[23,50,77],after:2});
  const total=CHECK.reduce((a,g)=>a+g.items.length,0),done=CHECK.reduce((a,g)=>a+g.items.filter((_,i)=>state[g.id+'_'+i]).length,0);
  st.text(done+' de '+total+' itens reunidos'+(PROFILE.beneficiario?' · Beneficiário: '+PROFILE.beneficiario:''),{size:9.5,color:[90,101,114],after:5});
  CHECK.forEach(g=>{st.need(14);st.text(g.t,{bold:true,size:11.5,color:[23,50,77],after:2});
    g.items.forEach((it,i)=>{const ok=!!state[g.id+'_'+i];st.need(6);const pdf=st.pdf;pdf.setDrawColor(19,120,107);pdf.setLineWidth(.35);pdf.rect(st.M,st.y-3.4,3.8,3.8);
      if(ok){pdf.setDrawColor(19,120,107);pdf.setLineWidth(.6);pdf.line(st.M+.8,st.y-1.5,st.M+1.7,st.y-.3);pdf.line(st.M+1.7,st.y-.3,st.M+3.3,st.y-2.9)}
      st.text(it,{indent:7,after:1.6,color:ok?[90,101,114]:[29,39,51]})});st.y+=3});
  if((state.notes||'').trim()){st.need(14);st.text('Observações',{bold:true,size:11.5,color:[23,50,77],after:2});st.text(state.notes.trim())}
  st.finish();return st.pdf;
}
async function deliverPdf(pdf,filename){
  if(false){
    try{await Store.dl.save({filename,data:pdf.output('blob')});toast('PDF pronto: '+filename);return}
    catch(e){if(e&&e.code==='declined'){toast('Download cancelado.');return}if(e&&e.code==='rate_limited'){toast('Aguarde um instante e tente de novo.');return}}
  }
  try{const url=URL.createObjectURL(pdf.output('blob'));const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);toast('PDF gerado: '+filename)}
  catch(e){toast('Não foi possível baixar o PDF neste navegador.')}
}
function fileName(doc){const base=(doc.type==='ficha'?todayISO():(doc.fields.data||todayISO()));return base+'_'+TYPES[doc.type].file+'.pdf'}
function downloadDoc(doc){
  if(!pdfReady()){toast('O gerador de PDF ainda está carregando. Tente em alguns segundos.');return}
  const go=()=>deliverPdf(docPdf(doc),fileName(doc));
  const miss=missingCount(doc);
  if(miss>0){modal('<h3>Ainda há '+miss+' campo'+(miss>1?'s':'')+' em branco</h3><p>Os trechos em destaque na prévia vão sair entre colchetes no PDF. Você pode completar agora ou baixar assim mesmo.</p><div class="row"><button class="btn btn-ghost" data-x>Completar</button><button class="btn btn-coral" data-go>Baixar assim mesmo</button></div>',
    b=>{b.querySelector('[data-x]').onclick=closeModal;b.querySelector('[data-go]').onclick=()=>{closeModal();go()}});return}
  go();
}


/* ---------- checklist ---------- */
const CHECK=[
  {id:'plano',t:'Plano e identificação',items:['Carteirinha e número do beneficiário','Contrato ou condições gerais do plano','Documento do beneficiário e do responsável','Comprovante de endereço, se relevante para rede ou transporte']},
  {id:'trat',t:'Indicação e acompanhamento do tratamento',items:['Prescrição atualizada','Relatório clínico com necessidade individualizada','Plano terapêutico, objetivos, frequência e profissionais envolvidos','Relatórios de evolução e avaliações disponíveis']},
  {id:'op',t:'Pedido e resposta da operadora',items:['Cópia do pedido enviado','Protocolos com data, canal e assunto','Autorizações, exigências e respostas recebidas','Negativa por escrito e fundamento informado','Provas de falta de vaga ou prestador adequado']},
  {id:'reemb',t:'Reembolso, deslocamento e reclamações',items:['Notas fiscais ou recibos e comprovantes de pagamento','Comprovantes de transporte, quando cabível','Pedido e resposta de reembolso','Protocolo e resposta da Ouvidoria, se utilizada','Registro da ANS/NIP e retorno sobre a solução']}
];
let CK={};let ckTimer=null;
function renderChecklist(){
  $('#ck-list').innerHTML=CHECK.map(g=>'<div class="ck-group"><h2 class="sec-title">'+esc(g.t)+'</h2>'+g.items.map((it,i)=>{const k=g.id+'_'+i;return '<label class="ck'+(CK[k]?' done':'')+'"><input type="checkbox" data-k="'+k+'"'+(CK[k]?' checked':'')+'><span>'+esc(it)+'</span></label>'}).join('')+'</div>').join('');
  $('#ck-notes').value=CK.notes||'';ckProgress();
  $('#ck-save').textContent='Suas marcações ficam salvas só neste aparelho.';
}
function ckProgress(){const total=CHECK.reduce((a,g)=>a+g.items.length,0);const done=Object.keys(CK).filter(k=>k!=='notes'&&CK[k]).length;$('#ck-bar').style.width=(done/total*100)+'%';$('#ck-count').textContent=done+' de '+total+' itens reunidos'}
function ckPersist(){if(!Store.logged())return;clearTimeout(ckTimer);ckTimer=setTimeout(async()=>{try{await Store.saveChecklist(CK);$('#ck-save').textContent='Salvo às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}catch(e){$('#ck-save').textContent='Não foi possível salvar agora.'}},900)}
$('#ck-list').addEventListener('change',e=>{const k=e.target.dataset.k;if(!k)return;if(e.target.checked)CK[k]=true;else delete CK[k];e.target.closest('.ck').classList.toggle('done',e.target.checked);ckProgress();ckPersist()});
$('#ck-notes').addEventListener('input',e=>{CK.notes=e.target.value;ckPersist()});
$('#ck-pdf').addEventListener('click',()=>{if(!pdfReady()){toast('O gerador de PDF ainda está carregando.');return}deliverPdf(checklistPdf(CK),todayISO()+'_Checklist_Familia.pdf')});



/* ---------- lista de modelos ---------- */
function renderModelos(){
  $('#m-list').innerHTML=['pedido','revisao','ouvidoria','ans','ficha'].map(k=>{const t=TYPES[k];return '<div class="card mcard"><span class="pill'+(k==='ficha'?' coral':'')+'">'+esc(t.tag)+'</span><h3>'+esc(t.name)+'</h3><p>'+esc(t.desc)+'</p><p class="src" style="font-size:.85rem"><b style="color:var(--teal)">Dica:</b> '+esc(t.tip)+'</p><div class="row"><button class="btn btn-coral btn-sm" data-new="'+k+'">Preencher agora</button></div></div>'}).join('');
}


/* ---------- navegação ---------- */
const PRIVATE=['painel','documentos','modelos','checklist','cadastro','editor'];
const VIEWS=['inicio','guia','mapa','base','fontes','contato','privacidade'].concat(PRIVATE);
const AREA={
  painel:['Minha área · salva só neste aparelho','Minha área','Prepare seus documentos aqui. Nada do que você digita é enviado à equipe do Rota TEA: fica só neste aparelho.'],
  documentos:['Minha área · salva só neste aparelho','Meus documentos','Os documentos que você preencheu neste aparelho. Continue, revise e baixe em PDF.'],
  modelos:['Minha área · salva só neste aparelho','Novo documento','Escolha o modelo. Os dados de “Meus dados” já entram preenchidos.'],
  checklist:['Minha área · salva só neste aparelho','Checklist','Separe o que existe e marque o que falta. As marcações ficam neste aparelho.'],
  cadastro:['Minha área · salva só neste aparelho','Meus dados','Dados que preenchem os documentos. Registre só o indispensável.']
};
function renderAreaTop(v){
  const sec=$('#v-'+v);const top=sec&&sec.querySelector('.area-top');if(!top)return;
  const a=AREA[v];
  top.innerHTML='<div class="wrap"><div class="kicker">'+esc(a[0])+'</div><h1>'+esc(a[1])+'</h1><p>'+esc(a[2])+'</p><nav class="atabs" aria-label="Minha área">'+
    [['painel','Início'],['documentos','Meus documentos'],['modelos','Novo documento'],['checklist','Checklist'],['cadastro','Meus dados']].map(([k,l])=>'<a href="#'+k+'" class="'+(k===v?'on':'')+'"'+(k===v?' aria-current="page"':'')+'>'+l+'</a>').join('')+'</nav></div>';
}
function renderAcct(){
  const a=$('#acct');if(a)a.innerHTML='<a class="btn btn-coral btn-sm" href="#painel" style="color:#fff">Minha área</a>';
}
let EDIT=null;
function route(){
  let v=(location.hash||'#inicio').slice(1);
  if(v==='entrar'||v==='admin')v='painel';
  if(!VIEWS.includes(v))v='inicio';
  if(v==='editor'&&!EDIT)v='documentos';
  if(v!=='editor')leaveEditor();
  showView(v);
  if(PRIVATE.includes(v)&&v!=='editor')renderAreaTop(v);
  if(v==='painel')renderPainel();
  if(v==='documentos')renderDocs();
  if(v==='cadastro')renderProfile();
  if(v==='checklist')renderChecklist();
  if(v==='editor')renderEditor();
  window.scrollTo(0,0);
}
function showView(v){
  $$('.view').forEach(s=>{const on=s.id==='v-'+v;s.classList.toggle('on',on);s.toggleAttribute('hidden',!on)});
  $$('.nav a[data-v]').forEach(a=>{const on=a.dataset.v===v;a.classList.toggle('on',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  $('#nav').classList.remove('open');$('#burger').setAttribute('aria-expanded','false');
}
function go(v){if(location.hash==='#'+v)route();else location.hash=v}
window.addEventListener('hashchange',route);
$('#burger').addEventListener('click',()=>{const o=$('#nav').classList.toggle('open');$('#burger').setAttribute('aria-expanded',o)});
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-new]');
  if(b){e.preventDefault();openEditor(newDoc(b.dataset.new),true)}
});
async function loadUserData(){
  try{PROFILE=await Store.getProfile()}catch(e){PROFILE={}}
  try{CK=await Store.getChecklist()}catch(e){CK={}}
}
function fmtPhone(d){d=(d||'').replace(/\D/g,'').slice(0,11);if(d.length<=2)return d?'('+d:'';if(d.length<=6)return '('+d.slice(0,2)+') '+d.slice(2);if(d.length<=10)return '('+d.slice(0,2)+') '+d.slice(2,6)+'-'+d.slice(6);return '('+d.slice(0,2)+') '+d.slice(2,7)+'-'+d.slice(7)}
document.addEventListener('input',e=>{const el=e.target;if(el.matches&&(el.matches('[data-phone]')||el.name==='whatsapp')){el.value=fmtPhone(el.value)}});

/* ---------- meus dados ---------- */
function deviceNotice(){
  return '<div class="callout tip local-note"><b class="tag">SEUS DADOS FICAM COM VOCÊ</b>Tudo o que você preenche fica salvo só neste aparelho e neste navegador. A equipe do Rota TEA não recebe, não vê e não guarda nada. Se limpar os dados do navegador ou trocar de aparelho, você perde o que não baixou: use <b>Baixar cópia</b> para guardar e <b>Abrir cópia</b> para continuar em outro lugar.</div>';
}
function backupCard(){
  return '<div class="card backup"><h3>Cópia dos seus dados</h3><p class="src" style="margin-top:0">A cópia é um arquivo com seus documentos, o checklist e “Meus dados”. Guarde em um lugar seguro, como faria com um documento pessoal.</p>'+
   '<div class="row"><button type="button" class="btn btn-teal btn-sm" data-backup>Baixar cópia</button><label class="btn btn-ghost btn-sm" style="cursor:pointer">Abrir cópia<input type="file" accept=".json,application/json" data-restore hidden></label><button type="button" class="btn btn-danger btn-sm" data-erase>Apagar tudo deste aparelho</button></div></div>';
}
function downloadBackup(){
  const blob=new Blob([JSON.stringify(Store.exportAll(),null,1)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='RotaTEA_copia_'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);toast('Cópia baixada. Guarde o arquivo em um lugar seguro.');
}
document.addEventListener('click',e=>{
  if(e.target.closest('[data-backup]')){downloadBackup();return}
  if(e.target.closest('[data-erase]')){
    modal('<h3>Apagar tudo deste aparelho?</h3><p>Seus documentos, o checklist e “Meus dados” serão apagados deste navegador. Não há como desfazer. Os PDFs e as cópias que você já baixou continuam com você.</p><div class="row"><button class="btn btn-ghost" data-x>Cancelar</button><button class="btn btn-danger" data-y>Apagar tudo</button></div>',
      bx=>{bx.querySelector('[data-x]').onclick=closeModal;bx.querySelector('[data-y]').onclick=()=>{closeModal();Store.eraseAll();PROFILE={};CK={};EDIT=null;toast('Tudo foi apagado deste aparelho.');go('painel')}});
  }
});
document.addEventListener('change',e=>{
  const inp=e.target.closest('[data-restore]');if(!inp||!inp.files||!inp.files[0])return;
  const fr=new FileReader();
  fr.onload=async()=>{try{const n=Store.importAll(JSON.parse(fr.result));await loadUserData();toast(n+' documento'+(n===1?'':'s')+' recuperado'+(n===1?'':'s')+'.');route()}catch(err){toast(errMsg(err))}inp.value=''};
  fr.readAsText(inp.files[0]);
});
const PARA={mim:'Para mim (eu sou a pessoa beneficiária)',menor:'Para uma criança ou adolescente que represento',adulto:'Para um adulto que eu apoio ou represento'};
function renderProfile(){
  const b=$('#prof-body');const para=PROFILE.para||'';
  b.innerHTML=deviceNotice()+'<div class="card"><h3>Dados para os documentos</h3><form id="prof-f">'+
   '<label class="f"><span>Para quem é o pedido?</span><select class="inp" name="para"><option value="">Escolha</option>'+Object.keys(PARA).map(k=>'<option value="'+k+'"'+(para===k?' selected':'')+'>'+esc(PARA[k])+'</option>').join('')+'</select></label>'+
   '<div class="callout tip" data-adulto hidden style="margin-top:0"><b class="tag">PESSOA ADULTA</b>A pessoa autista adulta decide sobre a própria saúde e pode assinar o pedido, com o apoio que escolher (Estatuto da Pessoa com Deficiência, arts. 6º, 84 e 85). Se houver tomada de decisão apoiada, ela assina junto com os apoiadores (Código Civil, art. 1.783-A). Só com curatela outra pessoa assina por ela, nos limites fixados pelo juiz.</div>'+
   '<div class="fgrid">'+PROFILE_FIELDS.map(p=>'<label class="f" data-pf="'+p.k+'"><span>'+esc(p.label)+'</span><input class="inp" name="'+p.k+'" value="'+esc(PROFILE[p.k]||'')+'" placeholder="'+esc(p.ph)+'">'+(p.help?'<small>'+esc(p.help)+'</small>':'')+'</label>').join('')+
   '</div><div class="callout att" style="margin-top:4px"><b class="tag">DADOS DE SAÚDE</b>Terapias, frequência e relatórios são dados de saúde. Coloque nos documentos só o indispensável para o pedido, e anexe relatórios e laudos apenas na hora de enviar à operadora, nunca aqui.</div>'+
   '<button class="btn btn-coral">Salvar meus dados</button></form></div>'+backupCard();
  const f=$('#prof-f');
  const sync=()=>{const mim=f.elements.para.value==='mim';const box=f.querySelector('[data-pf="beneficiario"]');if(box)box.hidden=mim;const ad=f.querySelector('[data-adulto]');if(ad)ad.hidden=f.elements.para.value!=='adulto'};
  f.elements.para.addEventListener('change',sync);sync();
  f.onsubmit=async e=>{e.preventDefault();const fd=Object.fromEntries(new FormData(e.target));Object.keys(fd).forEach(k=>fd[k]=fd[k].trim());
    if(fd.para==='mim')fd.beneficiario=fd.responsavel_nome;
    try{await Store.saveProfile(fd);PROFILE=fd;toast('Dados salvos neste aparelho. Os próximos documentos já virão preenchidos.')}catch(err){toast(errMsg(err))}};
}

/* ---------- painel ---------- */
async function renderPainel(){
  const b=$('#painel-body');b.innerHTML='<div class="loading">Carregando…</div>';
  try{DOCS=await Store.listDocs()}catch(e){b.innerHTML='<div class="empty"><h3>Não foi possível carregar agora</h3><p class="src">'+esc(errMsg(e))+'</p></div>';return}
  const filled=PROFILE_FIELDS.filter(p=>(PROFILE[p.k]||'').trim()).length;
  const total=CHECK.reduce((a,g)=>a+g.items.length,0),done=Object.keys(CK).filter(k=>k!=='notes'&&CK[k]).length;
  const cnt=k=>DOCS.filter(d=>d.type!=='ficha'&&(d.status||'rascunho')===k).length;
  const ficha=DOCS.find(d=>d.type==='ficha');
  const prox=ficha&&(ficha.fields.proxima||'').trim();
  let next;
  if(filled<PROFILE_FIELDS.length)next=['Preencha “Meus dados”','Com seu nome, a operadora e a carteirinha preenchidos, os documentos já saem prontos para revisar. Tudo fica só neste aparelho.','<a class="btn btn-coral btn-sm" href="#cadastro">Preencher meus dados</a>'];
  else if(!DOCS.some(d=>d.type==='pedido'))next=['Faça o pedido ao plano','Comece pela solicitação inicial, com prescrição e relatório anexos. Depois peça o protocolo.','<button class="btn btn-coral btn-sm" data-new="pedido">Preencher solicitação inicial</button>'];
  else if(!ficha)next=['Acompanhe o prazo','Crie a ficha de acompanhamento e registre cada contato, protocolo e resposta.','<button class="btn btn-coral btn-sm" data-new="ficha">Criar ficha de acompanhamento</button>'];
  else if(prox)next=['Próxima providência (da sua ficha)',prox,'<button class="btn btn-coral btn-sm" data-open="'+ficha.id+'">Abrir ficha</button>'];
  else next=['Mantenha a ficha em dia','Registre na ficha cada novo contato e a próxima providência.','<button class="btn btn-coral btn-sm" data-open="'+ficha.id+'">Abrir ficha</button>'];
  b.innerHTML=deviceNotice()+'<div class="stats">'+
    '<div class="stat"><div class="lbl">Meus dados</div><div class="big">'+filled+'/'+PROFILE_FIELDS.length+'</div><div class="src">campos preenchidos</div><a href="#cadastro">Revisar →</a></div>'+
    '<div class="stat"><div class="lbl">Checklist</div><div class="big">'+done+'/'+total+'</div><div class="progress"><i style="width:'+(done/total*100)+'%"></i></div><a href="#checklist">Abrir checklist →</a></div>'+
    '<div class="stat"><div class="lbl">Documentos</div><div class="big">'+DOCS.length+'</div><div class="src">'+cnt('rascunho')+' rascunho · '+cnt('pronto')+' pronto · '+cnt('enviado')+' enviado · '+cnt('respondido')+' respondido</div><a href="#documentos">Ver todos →</a></div></div>'+
    '<div class="next"><div class="lbl" style="font-size:.74rem;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:#a8432d">Próximo passo</div><h3 style="margin:6px 0">'+esc(next[0])+'</h3><p class="src" style="font-size:.95rem">'+esc(next[1])+'</p>'+next[2]+'</div>'+
    '<h2 class="sec-title">Continue de onde parou</h2>'+
    (DOCS.length?'<div class="dlist">'+DOCS.slice(0,3).map(docCard).join('')+'</div>':'<div class="empty"><img class="empty-img" src="img/area-familia.webp" alt=""><h3>Nenhum documento ainda</h3><p class="src">Os documentos que você preencher neste aparelho aparecem aqui.</p><a class="btn btn-coral" href="#modelos">Novo documento</a></div>')+backupCard();
}
$('#painel-body').addEventListener('click',docActions);

/* ---------- meus documentos ---------- */
let DOCS=[];let DFILTER='todos';let DQUERY='';
function docCard(d){const t=TYPES[d.type]||{tag:'',name:''};const miss=missingCount(d);
  return '<div class="dcard"><div style="display:flex;gap:6px;flex-wrap:wrap"><span class="pill'+(d.type==='ficha'?' coral':'')+'">'+esc(t.tag)+'</span>'+statusPill(d)+'</div><h3>'+esc(d.title||t.name)+'</h3><div class="when">Atualizado em '+fmtStamp(d.updatedAt)+(miss?' · <span style="color:#b4402a">'+miss+' campo'+(miss>1?'s':'')+' em branco</span>':'')+'</div><div class="row"><button class="btn btn-teal btn-sm" data-open="'+d.id+'">Abrir e revisar</button><button class="btn btn-ghost btn-sm" data-pdf="'+d.id+'">Baixar PDF</button><button class="btn btn-ghost btn-sm" data-dup="'+d.id+'">Duplicar</button><button class="btn btn-danger btn-sm" data-del="'+d.id+'">Excluir</button></div></div>'}
async function renderDocs(){
  const b=$('#docs-body');b.innerHTML='<div class="loading">Carregando seus documentos…</div>';
  try{DOCS=await Store.listDocs()}catch(e){b.innerHTML='<div class="empty"><h3>Não foi possível carregar agora</h3><p class="src">'+esc(errMsg(e))+'</p></div>';return}
  if(!DOCS.length){b.innerHTML='<div class="empty"><img class="empty-img" src="img/area-familia.webp" alt=""><h3>Nenhum documento ainda</h3><p class="src">Comece pelo pedido ao plano. O que você preencher fica salvo neste aparelho e aparece aqui.</p><p class="src">Tem uma cópia salva? <label class="linkbtn" style="cursor:pointer">Abrir cópia<input type="file" accept=".json,application/json" data-restore hidden></label></p><button class="btn btn-coral" data-new="pedido">Preencher solicitação inicial</button> <a class="btn btn-ghost" href="#modelos">Ver todos os modelos</a></div>';return}
  const chips=[['todos','Todos'],['pedido','Solicitação'],['revisao','Revisão'],['ouvidoria','Ouvidoria'],['ans','ANS'],['ficha','Ficha']];
  b.innerHTML='<div class="toolbar"><input class="inp" id="dq" placeholder="Buscar pelo nome" value="'+esc(DQUERY)+'"><div class="chips">'+chips.map(([k,l])=>'<button class="chip'+(DFILTER===k?' on':'')+'" data-chip="'+k+'">'+l+'</button>').join('')+'</div><a class="btn btn-coral btn-sm" href="#modelos" style="margin-left:auto">+ Novo documento</a></div><div id="dl"></div>';
  b.insertAdjacentHTML('beforeend',backupCard());
  drawDocList();
  $('#dq').addEventListener('input',e=>{DQUERY=e.target.value;drawDocList()});
}
function drawDocList(){
  const q=DQUERY.trim().toLowerCase();
  const list=DOCS.filter(d=>(DFILTER==='todos'||d.type===DFILTER)&&(!q||(d.title||'').toLowerCase().includes(q)));
  $$('[data-chip]').forEach(c=>c.classList.toggle('on',c.dataset.chip===DFILTER));
  $('#dl').innerHTML=list.length?'<div class="dlist">'+list.map(docCard).join('')+'</div>':'<p class="src">Nenhum documento encontrado com esse filtro.</p>';
}
async function docActions(e){
  const g=k=>e.target.closest('[data-'+k+']');let el;
  const find=id=>DOCS.find(d=>d.id===id);
  if(el=g('chip')){DFILTER=el.dataset.chip;drawDocList();return}
  if(el=g('open')){const d=find(el.dataset.open);if(d)openEditor(JSON.parse(JSON.stringify(d)),false)}
  else if(el=g('pdf'))downloadDoc(find(el.dataset.pdf));
  else if(el=g('dup')){const d=JSON.parse(JSON.stringify(find(el.dataset.dup)));d.id=uid();d.title=(d.title||'')+' (cópia)';d.status='rascunho';try{await Store.saveDoc(d);toast('Cópia criada.');route()}catch(err){toast(errMsg(err))}}
  else if(el=g('del')){const d=find(el.dataset.del);modal('<h3>Excluir este documento?</h3><p>“'+esc(d.title)+'” será apagado deste aparelho. Os PDFs que você já baixou continuam no seu aparelho.</p><div class="row"><button class="btn btn-ghost" data-x>Cancelar</button><button class="btn btn-coral" data-y>Excluir</button></div>',
    bx=>{bx.querySelector('[data-x]').onclick=closeModal;bx.querySelector('[data-y]').onclick=async()=>{closeModal();try{await Store.deleteDoc(d.id);toast('Documento excluído.');route()}catch(err){toast(errMsg(err))}}})}
}
$('#docs-body').addEventListener('click',docActions);

/* ---------- editor ---------- */
let edDirty=false,edTimer=null,edSaving=false;
function openEditor(doc,isNew){EDIT={doc,isNew,saved:!isNew};edDirty=!!isNew&&false;go('editor')}
function leaveEditor(){if(EDIT&&edDirty&&Store.logged())saveEdit(true);clearTimeout(edTimer)}
function fieldHTML(x,f){
  if(x.showIf&&!x.showIf(f))return '';
  const val=f[x.k];const help=x.help?'<small>'+esc(x.help)+'</small>':'';const id='fx-'+x.k;
  const lab='<span>'+esc(x.label||'')+(x.optional?' <em style="font-weight:400;color:var(--muted)">(opcional)</em>':'')+'</span>';
  const full=(x.type==='textarea'||x.type==='checks')?' full':'';
  if(x.type==='toggle')return '<label class="toggle full"><input type="checkbox" data-f="'+x.k+'"'+(val!==false?' checked':'')+'><span>'+esc(x.label)+'</span></label>';
  if(x.type==='checks')return '<div class="f full" style="margin-bottom:14px"><div class="checks">'+x.opts.map(o=>'<label><input type="checkbox" data-c="'+x.k+'" value="'+esc(o)+'"'+((val||[]).includes(o)?' checked':'')+'>'+esc(o)+'</label>').join('')+'</div></div>';
  if(x.type==='select')return '<label class="f'+full+'">'+lab+'<select class="inp" data-f="'+x.k+'">'+x.opts.map(o=>'<option'+(val===o?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select>'+help+'</label>';
  if(x.type==='textarea')return '<label class="f full">'+lab+'<textarea class="inp" data-f="'+x.k+'" placeholder="'+esc(x.ph?x.ph.charAt(0)+x.ph.slice(1).toLowerCase():'')+'">'+esc(val||'')+'</textarea>'+help+'</label>';
  return '<label class="f'+full+'">'+lab+'<input class="inp" '+(x.type==='date'?'type="date"':'')+' data-f="'+x.k+'" value="'+esc(val||'')+'" placeholder="'+esc(x.ph?x.ph.charAt(0)+x.ph.slice(1).toLowerCase():'')+'">'+help+'</label>';
}
function rowsHTML(rows){
  return '<div class="rows-ed">'+rows.map((r,i)=>'<div class="r"><div class="hd">Registro '+(i+1)+'<button type="button" class="btn btn-danger btn-sm" data-rdel="'+i+'">Remover</button></div><div class="fgrid">'+
    ROWCOLS.map(c=>'<label class="f'+(c[0]==='resp'||c[0]==='prazo'?' full':'')+'"><span>'+c[1]+'</span>'+(c[0]==='resp'||c[0]==='prazo'?'<textarea class="inp" style="min-height:60px" data-r="'+i+'" data-rk="'+c[0]+'">'+esc(r[c[0]]||'')+'</textarea>':'<input class="inp" '+(c[2]==='date'?'type="date"':'')+' data-r="'+i+'" data-rk="'+c[0]+'" value="'+esc(r[c[0]]||'')+'">')+'</label>').join('')+
    '</div></div>').join('')+'<button type="button" class="btn btn-ghost btn-sm" id="radd">+ Adicionar registro</button></div>';
}
function formHTML(doc){
  return TYPES[doc.type].groups.map(g=>'<fieldset class="fs"><legend>'+esc(g.t)+'</legend>'+(g.rows?rowsHTML(doc.rows||[]):'<div class="fgrid">'+g.fields.map(x=>fieldHTML(x,doc.fields)).join('')+'</div>')+'</fieldset>').join('');
}
const markPH=s=>esc(s).replace(/\[[^\]]+\]/g,m=>'<mark>'+m+'</mark>');
function previewHTML(doc){
  const t=TYPES[doc.type];let inner='';
  if(doc.type==='ficha'){const f=doc.fields;const dash=x=>x?esc(x):'<span style="color:#aaa">—</span>';
    inner='<p class="meta"><b>Beneficiário:</b> '+dash(f.beneficiario)+' · <b>Operadora:</b> '+dash(f.operadora)+'</p><p class="meta"><b>Carteirinha:</b> '+dash(f.carteirinha)+' · <b>Pedido principal:</b> '+dash(f.pedido_principal)+'</p>'+
    '<table><thead><tr>'+ROWCOLS.map(c=>'<th>'+c[1]+'</th>').join('')+'</tr></thead><tbody>'+((doc.rows||[]).map(r=>'<tr>'+ROWCOLS.map(c=>'<td>'+esc(c[2]==='date'?fmtBR(r[c[0]]):r[c[0]]||'')+'</td>').join('')+'</tr>').join('')||'<tr><td colspan="5">Nenhum registro</td></tr>')+'</tbody></table>'+
    '<p style="font-weight:700;color:var(--navy);margin:8px 0 4px">Linha do tempo essencial</p>'+
    [['Primeiro pedido',fmtBR(f.d_primeiro)],['Prazo informado',f.prazo],['Negativa ou resposta',fmtBR(f.d_resposta)],['Reanálise solicitada em',fmtBR(f.d_reanalise)],['Ouvidoria',f.ouvidoria],['ANS/NIP',f.ans],['Resultado atual',f.resultado],['Próxima providência',f.proxima]].map(([a,b])=>'<div><b>'+a+':</b> '+dash(b)+'</div>').join('');
  }else{const b=t.build(doc.fields);
    inner='<p class="to">'+markPH(b.to)+'</p>'+b.meta.map(m=>'<p class="meta">'+markPH(m)+'</p>').join('')+'<p class="subj">'+markPH(b.subject)+'</p>'+b.paras.map(p=>'<p>'+markPH(p)+'</p>').join('')+
      (b.list&&b.list.length?'<p><b>'+b.listTitle+':</b> '+esc(b.list.join(' • '))+'</p>':'')+'<p class="closing">'+markPH(b.closing)+'</p>';}
  return '<div class="paper"><div class="ph"><b>ROTA TEA</b><span>Prévia do PDF</span></div><div class="pb"><div class="doc-kind">'+esc(doc.type==='ficha'?t.name:t.tag+' · '+t.name)+'</div>'+inner+'</div></div>';
}
function renderEditor(){
  const {doc}=EDIT;const t=TYPES[doc.type];
  $('#ed-body').innerHTML='<div class="ed-bar"><div class="wrap" style="max-width:1240px"><button class="btn btn-ghost btn-sm" id="ed-back">← Voltar</button><input class="ed-title" id="ed-title" value="'+esc(doc.title)+'" aria-label="Nome do documento"><span class="status" id="ed-status"></span>'+
    (doc.type!=='ficha'?'<select class="ed-status" id="ed-st" aria-label="Situação do documento">'+Object.keys(STATUS).map(k=>'<option value="'+k+'"'+((doc.status||'rascunho')===k?' selected':'')+'>'+STATUS[k]+'</option>').join('')+'</select><button class="btn btn-ghost btn-sm" id="ed-copy">Copiar texto</button>':'')+'<button class="btn btn-teal btn-sm" id="ed-save">Salvar</button><button class="btn btn-coral btn-sm" id="ed-pdf">Baixar PDF</button></div></div>'+
    '<div class="ed"><div><div class="ed-form" id="ed-form">'+formHTML(doc)+'</div><div class="callout tip"><b class="tag">DICA</b>'+esc(t.tip)+'</div></div><div class="ed-prev" id="ed-prev">'+previewHTML(doc)+'</div></div>';
  setStatus();
  const form=$('#ed-form');
  form.addEventListener('input',onEdInput);form.addEventListener('change',onEdInput);
  form.addEventListener('click',e=>{const d=e.target.closest('[data-rdel]');if(d){doc.rows.splice(+d.dataset.rdel,1);rerenderForm();touch()}if(e.target.id==='radd'){doc.rows.push({data:todayISO(),canal:'',protocolo:'',resp:'',prazo:''});rerenderForm();touch()}});
  $('#ed-title').addEventListener('input',e=>{doc.title=e.target.value;touch()});
  $('#ed-back').onclick=()=>go('documentos');const stl=$('#ed-st');if(stl)stl.onchange=()=>{doc.status=stl.value;touch()};
  $('#ed-save').onclick=()=>saveEdit(false);
  $('#ed-pdf').onclick=()=>downloadDoc(doc);
  const cp=$('#ed-copy');if(cp)cp.onclick=async()=>{const b=t.build(doc.fields);const txt=[b.to].concat(b.meta,['',b.subject,''],b.paras.map(p=>p+'\n'),b.list&&b.list.length?[b.listTitle+': '+b.list.join(' • '),'']:[],[b.closing]).join('\n');
    try{await navigator.clipboard.writeText(txt);toast('Texto copiado. Cole no e-mail ou no chat da operadora.')}catch(e){toast('Não foi possível copiar automaticamente.')}};
}
function rerenderForm(){const y=window.scrollY;$('#ed-form').innerHTML=formHTML(EDIT.doc);$('#ed-prev').innerHTML=previewHTML(EDIT.doc);window.scrollTo(0,y)}
function onEdInput(e){
  const doc=EDIT.doc,el=e.target;
  if(el.dataset.f){const x=allFields(doc.type).find(z=>z.k===el.dataset.f);doc.fields[el.dataset.f]=el.type==='checkbox'?el.checked:el.value;
    if(x&&x.type==='select'&&e.type==='change'&&allFields(doc.type).some(z=>z.showIf)){rerenderForm();touch();return}}
  else if(el.dataset.c){doc.fields[el.dataset.c]=$$('[data-c="'+el.dataset.c+'"]:checked').map(i=>i.value)}
  else if(el.dataset.r!==undefined){doc.rows[+el.dataset.r][el.dataset.rk]=el.value}
  else return;
  $('#ed-prev').innerHTML=previewHTML(doc);touch();
}
function touch(){edDirty=true;setStatus();if(Store.logged()){clearTimeout(edTimer);edTimer=setTimeout(()=>saveEdit(true),1500)}}
function setStatus(){const s=$('#ed-status');if(!s)return;
  if(edSaving)s.textContent='Salvando…';
  else if(edDirty)s.textContent='Salvando em instantes…';
  else s.textContent=EDIT.doc.updatedAt?'Salvo em '+fmtStamp(EDIT.doc.updatedAt):'';}
async function saveEdit(auto){
  if(!EDIT)return;const doc=EDIT.doc;
  if(!Store.logged())return;
  if(edSaving)return;edSaving=true;setStatus();
  try{await Store.saveDoc(doc);EDIT.saved=true;edDirty=false;if(!auto)toast('Documento salvo em “Meus documentos”.')}
  catch(e){EDIT.err=true;toast(errMsg(e))}
  edSaving=false;setStatus();
}


/* ---------- calculadora de prazo ---------- */
(function(){const d=$('#calc-d'),t=$('#calc-t'),o=$('#calc-o');d.value=todayISO();
  const run=()=>{const dt=parseISO(d.value);if(!dt){o.textContent='';return}const r=addBusinessDays(dt,+t.value);o.textContent='Data de referência: '+r.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})+'.'};
  d.addEventListener('input',run);t.addEventListener('change',run);run();})();



/* ---------- acessibilidade: preferências ---------- */
(function(){
  const H=document.documentElement,btn=$('#a11y-btn'),pan=$('#a11y-panel');
  let P=LS.get('rt_a11y')||{fs:0,hc:false,ul:false,rm:false};
  function apply(){H.setAttribute('data-fs',String(P.fs||0));['hc','ul','rm'].forEach(k=>H.classList.toggle(k,!!P[k]));
    $$('[data-fsz]',pan).forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.fsz===(P.fs||0))));
    $$('[data-opt]',pan).forEach(i=>i.checked=!!P[i.dataset.opt]);LS.set('rt_a11y',P)}
  function open(o){pan.hidden=!o;btn.setAttribute('aria-expanded',String(o));if(o){const f=pan.querySelector('[aria-pressed="true"]');if(f)f.focus()}}
  btn.addEventListener('click',()=>open(pan.hidden));
  pan.addEventListener('click',e=>{const f=e.target.closest('[data-fsz]');if(f){P.fs=+f.dataset.fsz;apply()}
    if(e.target.closest('[data-a11y-close]')){open(false);btn.focus()}
    if(e.target.closest('[data-a11y-reset]')){P={fs:0,hc:false,ul:false,rm:false};apply()}});
  pan.addEventListener('change',e=>{const i=e.target.closest('[data-opt]');if(i){P[i.dataset.opt]=i.checked;apply()}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!pan.hidden){open(false);btn.focus()}});
  document.addEventListener('click',e=>{if(!pan.hidden&&!e.target.closest('#a11y-panel')&&!e.target.closest('#a11y-btn'))open(false)});
  document.addEventListener('click',e=>{if(e.target.closest('[data-skip]')){e.preventDefault();const m=$('#main');m.focus();m.scrollIntoView()}});
  apply();
})();



/* ---------- ouvir esta página ---------- */
(function(){
  const S=window.speechSynthesis,start=$('#tts-start'),bar=$('#tts-bar'),tog=$('#tts-toggle'),stat=$('#tts-status');
  if(!S||!window.SpeechSynthesisUtterance)return;
  start.hidden=false;
  let blocks=[],bi=0,parts=[],pi=0,playing=false,voice=null,cur=null;
  function pickVoice(){const v=S.getVoices();voice=v.find(x=>/pt[-_]BR/i.test(x.lang)&&/google|luciana|francisca|natural/i.test(x.name))||v.find(x=>/pt[-_]BR/i.test(x.lang))||v.find(x=>/^pt/i.test(x.lang))||null}
  pickVoice();S.onvoiceschanged=pickVoice;
  function collect(){
    const root=$('.view.on');if(!root)return[];
    const els=$$('h1,h2,h3,h4,p,li,dt,dd,th,td,blockquote,figcaption,label,.lead',root).filter(el=>{
      if(el.closest('[aria-hidden="true"],button,select,textarea,.sr,.tts-bar,nav'))return false;
      if(!el.offsetParent&&getComputedStyle(el).position!=='fixed')return false;
      const p=el.parentElement&&el.parentElement.closest('h1,h2,h3,h4,p,li,dt,dd,th,td,blockquote,figcaption,label');
      return !(p&&root.contains(p));
    });
    return els.map(el=>({el,t:(el.innerText||'').replace(/\s+/g,' ').trim()})).filter(b=>b.t.length>1);
  }
  function split(t){const out=[];t.split(/(?<=[.!?;:])\s+/).forEach(s=>{s=s.trim();if(!s)return;
    while(s.length>220){let k=s.lastIndexOf(' ',220);if(k<80)k=220;out.push(s.slice(0,k));s=s.slice(k).trim()}if(s)out.push(s)});return out}
  function mark(el){if(cur)cur.classList.remove('tts-on');cur=el;if(el){el.classList.add('tts-on');const r=el.getBoundingClientRect();if(r.top<80||r.bottom>innerHeight-90)el.scrollIntoView({block:'center',behavior:document.documentElement.classList.contains('rm')?'auto':'smooth'})}}
  function speak(){
    if(!playing)return;
    if(bi>=blocks.length){stop();toast('Leitura concluída.');return}
    if(pi===0){parts=split(blocks[bi].t);mark(blocks[bi].el)}
    if(pi>=parts.length){bi++;pi=0;speak();return}
    const u=new SpeechSynthesisUtterance(parts[pi]);u.lang='pt-BR';if(voice)try{u.voice=voice}catch(e){}u.rate=1;
    u.onend=()=>{if(!playing)return;pi++;speak()};
    u.onerror=e=>{if(e.error==='interrupted'||e.error==='canceled')return;pi++;speak()};
    S.speak(u);
  }
  function play(){playing=true;bar.classList.remove('paused');tog.textContent='Pausar';stat.textContent='Lendo…';S.cancel();speak()}
  function pause(){playing=false;S.cancel();bar.classList.add('paused');tog.textContent='Continuar';stat.textContent='Pausado'}
  function stop(){playing=false;S.cancel();bar.hidden=true;mark(null);blocks=[]}
  start.addEventListener('click',()=>{blocks=collect();bi=0;pi=0;if(!blocks.length){toast('Não há texto para ler nesta tela.');return}
    $('#a11y-panel').hidden=true;$('#a11y-btn').setAttribute('aria-expanded','false');bar.hidden=false;play();tog.focus()});
  tog.addEventListener('click',()=>{if(playing)pause();else{pi=0;play()}});
  $('#tts-stop').addEventListener('click',()=>{stop();$('#a11y-btn').focus()});
  window.addEventListener('hashchange',()=>{if(!bar.hidden)stop()});
  window.addEventListener('beforeunload',()=>S.cancel());
})();

/* ---------- início ---------- */
renderModelos();renderAcct();
fetch('img/logo-light.png').then(r=>r.blob()).then(b=>new Promise(res=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.readAsDataURL(b)})).then(d=>{window.__LOGO=d}).catch(()=>{});
(async()=>{await loadUserData();route()})();
/* limpeza de chaves da versão anterior (cadastro de teste) */
try{Object.keys(localStorage).forEach(k=>{if(/^sb-|supabase/i.test(k))localStorage.removeItem(k)});Object.keys(sessionStorage).forEach(k=>{if(/^sb-|supabase/i.test(k))sessionStorage.removeItem(k)})}catch(e){}
/* VLibras: inicia quando o script oficial terminar de carregar */
(function(){const init=()=>{try{if(window.VLibras&&!window.__vlw){window.__vlw=new window.VLibras.Widget('https://vlibras.gov.br/app')}}catch(e){}};
 const s=document.querySelector('script[src*="vlibras-plugin"]');if(window.VLibras)init();else if(s)s.addEventListener('load',init);})();
/* tabelas legíveis no celular: cada célula recebe o título da coluna */
document.querySelectorAll('table.t').forEach(t=>{const h=[...t.querySelectorAll('thead th')].map(x=>x.textContent.trim());t.querySelectorAll('tbody tr').forEach(r=>[...r.children].forEach((c,i)=>{if(h[i])c.setAttribute('data-label',h[i])}))});
